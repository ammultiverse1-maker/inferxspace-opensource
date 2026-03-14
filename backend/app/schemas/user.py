"""
Pydantic schemas for user and settings endpoints
"""

from datetime import datetime
from typing import Optional
from uuid import UUID
from pydantic import BaseModel, EmailStr, Field


# ============================================================================
# Request Schemas
# ============================================================================

class UserUpdateRequest(BaseModel):
    """Update user profile request"""
    name: Optional[str] = Field(None, max_length=255)
    company: Optional[str] = Field(None, max_length=255)


class UserSettingsUpdateRequest(BaseModel):
    """Update user settings request"""
    email_notifications: Optional[bool] = None
    usage_alerts: Optional[bool] = None
    low_balance_threshold: Optional[int] = Field(None, ge=0)
    default_model: Optional[str] = Field(None, max_length=100)
    theme: Optional[str] = Field(None, pattern="^(light|dark|system)$")


# ============================================================================
# Response Schemas
# ============================================================================

class UserProfileResponse(BaseModel):
    """User profile response"""
    id: UUID
    email: str
    name: Optional[str] = None
    company: Optional[str] = None
    is_active: bool
    email_verified: bool
    tier: str = "free"
    created_at: datetime
    
    class Config:
        from_attributes = True


class UserSettingsResponse(BaseModel):
    """User settings response"""
    email_notifications: bool = True
    usage_alerts: bool = True
    low_balance_threshold: int = 100000  # tokens
    default_model: str = "llama-3.1-70b-instruct"
    theme: str = "system"
    
    class Config:
        from_attributes = True


class UserDashboardResponse(BaseModel):
    """Dashboard overview response"""
    user: UserProfileResponse
    balance_tokens: int
    balance_inr: float
    this_month_usage: int
    total_spend: float
    active_api_keys: int
    recent_requests: int
