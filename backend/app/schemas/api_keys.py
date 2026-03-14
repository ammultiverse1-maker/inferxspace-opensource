"""
Pydantic schemas for API key management
"""

from datetime import datetime
from typing import Optional, List
from uuid import UUID
from pydantic import BaseModel, Field


# ============================================================================
# Request Schemas
# ============================================================================

class APIKeyCreateRequest(BaseModel):
    """Create new API key request"""
    name: str = Field(..., min_length=1, max_length=100, description="Name for the API key")
    
    class Config:
        json_schema_extra = {
            "example": {
                "name": "Production API Key"
            }
        }


class APIKeyUpdateRequest(BaseModel):
    """Update API key name request"""
    name: str = Field(..., min_length=1, max_length=100)


# ============================================================================
# Response Schemas
# ============================================================================

class APIKeyResponse(BaseModel):
    """API key response (without full key)"""
    id: UUID
    name: Optional[str]
    key_prefix: str
    is_active: bool
    last_used_at: Optional[datetime]
    created_at: datetime
    
    class Config:
        from_attributes = True


class APIKeyCreateResponse(BaseModel):
    """API key creation response (includes full key - only shown once)"""
    id: UUID
    name: Optional[str]
    key: str  # Full API key - only returned on creation
    key_prefix: str
    created_at: datetime
    message: str = "Store this API key securely. It will not be shown again."
    
    class Config:
        json_schema_extra = {
            "example": {
                "id": "550e8400-e29b-41d4-a716-446655440000",
                "name": "Production API Key",
                "key": "sk_live_abc123def456...",
                "key_prefix": "sk_live_abc1",
                "created_at": "2026-01-18T10:00:00Z",
                "message": "Store this API key securely. It will not be shown again."
            }
        }


class APIKeyListResponse(BaseModel):
    """List of API keys response"""
    keys: List[APIKeyResponse]
    total: int


class APIKeyRegenerateResponse(BaseModel):
    """API key regeneration response"""
    id: UUID
    name: Optional[str]
    key: str  # New full API key
    key_prefix: str
    message: str = "API key has been regenerated. Store the new key securely."
