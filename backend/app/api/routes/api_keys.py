"""
API Keys management routes
"""

from datetime import datetime, timezone
from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.core.database import get_db
from app.core.redis import RedisClient, get_redis
from app.core.security import generate_api_key, hash_api_key, get_key_prefix
from app.models.models import APIKey
from app.schemas.api_keys import (
    APIKeyCreateRequest,
    APIKeyUpdateRequest,
    APIKeyResponse,
    APIKeyCreateResponse,
    APIKeyListResponse,
    APIKeyRegenerateResponse,
)
from app.schemas.auth import MessageResponse
from app.api.deps import CurrentUser, CSRFVerified


router = APIRouter(prefix="/api-keys", tags=["API Keys"])


# ============================================================================
# List API Keys
# ============================================================================

@router.get("", response_model=APIKeyListResponse)
async def list_api_keys(
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    """
    List all API keys for the current user
    """
    result = await db.execute(
        select(APIKey)
        .where(APIKey.user_id == current_user.id, APIKey.is_active == True)
        .order_by(APIKey.created_at.desc())
    )
    keys = result.scalars().all()
    
    return APIKeyListResponse(
        keys=[APIKeyResponse.model_validate(key) for key in keys],
        total=len(keys),
    )


# ============================================================================
# Create API Key
# ============================================================================

@router.post("", response_model=APIKeyCreateResponse, status_code=201)
async def create_api_key(
    request: APIKeyCreateRequest,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
    _csrf: CSRFVerified = None,
):
    """
    Create a new API key
    The full key is only returned once - store it securely!
    """
    # Check limit (max 10 active keys)
    result = await db.execute(
        select(func.count(APIKey.id)).where(
            APIKey.user_id == current_user.id,
            APIKey.is_active == True
        )
    )
    active_count = result.scalar() or 0
    
    if active_count >= 10:
        raise HTTPException(
            status_code=400,
            detail="Maximum of 10 active API keys allowed"
        )
    
    # Generate new key
    full_key, key_hash = generate_api_key()
    key_prefix = get_key_prefix(full_key)
    
    # Create API key record
    api_key = APIKey(
        user_id=current_user.id,
        key_hash=key_hash,
        key_prefix=key_prefix,
        name=request.name,
    )
    db.add(api_key)
    await db.commit()
    await db.refresh(api_key)
    
    return APIKeyCreateResponse(
        id=api_key.id,
        name=api_key.name,
        key=full_key,
        key_prefix=key_prefix,
        created_at=api_key.created_at,
    )


# ============================================================================
# Get API Key
# ============================================================================

@router.get("/{key_id}", response_model=APIKeyResponse)
async def get_api_key(
    key_id: UUID,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    """
    Get a specific API key by ID
    """
    result = await db.execute(
        select(APIKey).where(
            APIKey.id == key_id,
            APIKey.user_id == current_user.id
        )
    )
    api_key = result.scalar_one_or_none()
    
    if not api_key:
        raise HTTPException(status_code=404, detail="API key not found")
    
    return APIKeyResponse.model_validate(api_key)


# ============================================================================
# Update API Key
# ============================================================================

@router.put("/{key_id}", response_model=APIKeyResponse)
async def update_api_key(
    key_id: UUID,
    request: APIKeyUpdateRequest,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
    _csrf: CSRFVerified = None,
):
    """
    Update API key name
    """
    result = await db.execute(
        select(APIKey).where(
            APIKey.id == key_id,
            APIKey.user_id == current_user.id
        )
    )
    api_key = result.scalar_one_or_none()
    
    if not api_key:
        raise HTTPException(status_code=404, detail="API key not found")
    
    api_key.name = request.name
    await db.commit()
    await db.refresh(api_key)
    
    return APIKeyResponse.model_validate(api_key)


# ============================================================================
# Regenerate API Key
# ============================================================================

@router.post("/{key_id}/regenerate", response_model=APIKeyRegenerateResponse)
async def regenerate_api_key(
    key_id: UUID,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
    redis: RedisClient = Depends(get_redis),
    _csrf: CSRFVerified = None,
):
    """
    Regenerate an API key
    The old key will be invalidated immediately
    """
    result = await db.execute(
        select(APIKey).where(
            APIKey.id == key_id,
            APIKey.user_id == current_user.id
        )
    )
    api_key = result.scalar_one_or_none()
    
    if not api_key:
        raise HTTPException(status_code=404, detail="API key not found")
    
    # Invalidate old key cache
    await redis.invalidate_api_key_cache(api_key.key_hash)
    
    # Generate new key
    full_key, key_hash = generate_api_key()
    key_prefix = get_key_prefix(full_key)
    
    # Update record
    api_key.key_hash = key_hash
    api_key.key_prefix = key_prefix
    await db.commit()
    await db.refresh(api_key)
    
    return APIKeyRegenerateResponse(
        id=api_key.id,
        name=api_key.name,
        key=full_key,
        key_prefix=key_prefix,
    )


# ============================================================================
# Delete API Key
# ============================================================================

@router.delete("/{key_id}", response_model=MessageResponse)
async def delete_api_key(
    key_id: UUID,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
    redis: RedisClient = Depends(get_redis),
    _csrf: CSRFVerified = None,
):
    """
    Delete (deactivate) an API key
    """
    result = await db.execute(
        select(APIKey).where(
            APIKey.id == key_id,
            APIKey.user_id == current_user.id
        )
    )
    api_key = result.scalar_one_or_none()
    
    if not api_key:
        raise HTTPException(status_code=404, detail="API key not found")
    
    # Invalidate cache
    await redis.invalidate_api_key_cache(api_key.key_hash)
    
    # Soft delete
    api_key.is_active = False
    await db.commit()
    
    return MessageResponse(message="API key deleted successfully")


# ============================================================================
# Revoke All API Keys
# ============================================================================

@router.post("/revoke-all", response_model=MessageResponse)
async def revoke_all_api_keys(
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
    redis: RedisClient = Depends(get_redis),
    _csrf: CSRFVerified = None,
):
    """
    Revoke all API keys for the current user
    """
    # Get all active keys
    result = await db.execute(
        select(APIKey).where(
            APIKey.user_id == current_user.id,
            APIKey.is_active == True
        )
    )
    keys = result.scalars().all()
    
    # Invalidate caches and deactivate
    for key in keys:
        await redis.invalidate_api_key_cache(key.key_hash)
        key.is_active = False
    
    await db.commit()
    
    return MessageResponse(message=f"Revoked {len(keys)} API key(s)")
