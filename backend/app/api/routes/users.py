"""
User profile and settings API routes
"""

from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.core.database import get_db
from app.models.models import User, UserCredit, APIKey, UsageLog, RateLimit
from app.schemas.user import (
    UserProfileResponse,
    UserUpdateRequest,
    UserSettingsUpdateRequest,
    UserSettingsResponse,
    UserDashboardResponse,
)
from app.schemas.auth import MessageResponse
from app.api.deps import CurrentUser, CSRFVerified


router = APIRouter(prefix="/users", tags=["Users"])


# ============================================================================
# User Profile
# ============================================================================

@router.get("/me", response_model=UserProfileResponse)
async def get_profile(
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    """
    Get current user profile
    """
    # Get user's tier
    result = await db.execute(
        select(RateLimit.tier).where(RateLimit.user_id == current_user.id)
    )
    tier = result.scalar_one_or_none() or "free"
    
    return UserProfileResponse(
        id=current_user.id,
        email=current_user.email,
        name=current_user.name,
        company=current_user.company,
        is_active=current_user.is_active,
        email_verified=current_user.email_verified,
        tier=tier,
        created_at=current_user.created_at,
    )


@router.put("/me", response_model=UserProfileResponse)
async def update_profile(
    request: UserUpdateRequest,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
    _csrf: CSRFVerified = None,
):
    """
    Update user profile
    """
    if request.name is not None:
        current_user.name = request.name
    
    if request.company is not None:
        current_user.company = request.company
    
    current_user.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(current_user)
    
    # Get tier
    result = await db.execute(
        select(RateLimit.tier).where(RateLimit.user_id == current_user.id)
    )
    tier = result.scalar_one_or_none() or "free"
    
    return UserProfileResponse(
        id=current_user.id,
        email=current_user.email,
        name=current_user.name,
        company=current_user.company,
        is_active=current_user.is_active,
        email_verified=current_user.email_verified,
        tier=tier,
        created_at=current_user.created_at,
    )


# ============================================================================
# Dashboard Overview
# ============================================================================

@router.get("/me/dashboard", response_model=UserDashboardResponse)
async def get_dashboard(
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    """
    Get dashboard overview data
    """
    # Get credit balance
    result = await db.execute(
        select(UserCredit).where(UserCredit.user_id == current_user.id)
    )
    credits = result.scalar_one_or_none()
    balance_tokens = credits.balance_tokens if credits else 0
    
    # Get this month's usage
    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    
    result = await db.execute(
        select(
            func.coalesce(func.sum(UsageLog.input_tokens + UsageLog.output_tokens), 0)
        ).where(
            UsageLog.user_id == current_user.id,
            UsageLog.created_at >= month_start
        )
    )
    this_month_usage = result.scalar() or 0
    
    # Get total spend
    result = await db.execute(
        select(
            func.coalesce(func.sum(UsageLog.input_cost + UsageLog.output_cost), 0)
        ).where(UsageLog.user_id == current_user.id)
    )
    total_spend = float(result.scalar() or 0)
    
    # Get active API keys count
    result = await db.execute(
        select(func.count(APIKey.id)).where(
            APIKey.user_id == current_user.id,
            APIKey.is_active == True
        )
    )
    active_api_keys = result.scalar() or 0
    
    # Get recent requests count (last 7 days)
    week_ago = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_ago = week_ago.replace(day=now.day - 7) if now.day > 7 else week_ago
    
    result = await db.execute(
        select(func.count(UsageLog.id)).where(
            UsageLog.user_id == current_user.id,
            UsageLog.created_at >= week_ago
        )
    )
    recent_requests = result.scalar() or 0
    
    # Get tier
    result = await db.execute(
        select(RateLimit.tier).where(RateLimit.user_id == current_user.id)
    )
    tier = result.scalar_one_or_none() or "free"
    
    # Calculate balance in INR (1 INR = 10,000 tokens)
    balance_inr = round(balance_tokens / 10000, 2)
    
    return UserDashboardResponse(
        user=UserProfileResponse(
            id=current_user.id,
            email=current_user.email,
            name=current_user.name,
            company=current_user.company,
            is_active=current_user.is_active,
            email_verified=current_user.email_verified,
            tier=tier,
            created_at=current_user.created_at,
        ),
        balance_tokens=balance_tokens,
        balance_inr=balance_inr,
        this_month_usage=this_month_usage,
        total_spend=total_spend,
        active_api_keys=active_api_keys,
        recent_requests=recent_requests,
    )


# ============================================================================
# User Settings
# ============================================================================

@router.get("/me/settings", response_model=UserSettingsResponse)
async def get_settings(current_user: CurrentUser):
    """
    Get user settings
    Note: Settings would typically be stored in a separate table
    For now, returning defaults
    """
    return UserSettingsResponse()


@router.put("/me/settings", response_model=UserSettingsResponse)
async def update_settings(
    request: UserSettingsUpdateRequest,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
    _csrf: CSRFVerified = None,
):
    """
    Update user settings
    """
    # In a real implementation, this would update a settings table
    # For now, just return the updated values
    return UserSettingsResponse(
        email_notifications=request.email_notifications or True,
        usage_alerts=request.usage_alerts or True,
        low_balance_threshold=request.low_balance_threshold or 100000,
        default_model=request.default_model or "llama-3.1-70b-instruct",
        theme=request.theme or "system",
    )


# ============================================================================
# Account Deletion
# ============================================================================

@router.delete("/me", response_model=MessageResponse)
async def delete_account(
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
    _csrf: CSRFVerified = None,
):
    """
    Delete user account (soft delete)
    """
    current_user.is_active = False
    current_user.email = f"deleted_{current_user.id}@deleted.local"
    current_user.updated_at = datetime.now(timezone.utc)
    
    await db.commit()
    
    return MessageResponse(message="Account has been deactivated")
