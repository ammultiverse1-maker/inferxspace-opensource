"""
Pydantic schemas for the free tier API endpoints.
"""

from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


# ============================================================================
# Free Tier Quota & Status
# ============================================================================

class FreeTierQuotaResponse(BaseModel):
    """User's current free tier quota status"""
    tokens_used: int
    tokens_limit: int
    tokens_remaining: int
    requests_used: int
    requests_limit: int
    requests_remaining: int
    reset_at: str


class FreeTierModelInfo(BaseModel):
    """Info about a single free tier model"""
    id: str
    name: str
    provider: str
    actual_model: str
    context_window: int
    max_tokens: int
    supports_streaming: bool
    is_free: bool = True
    pricing: Dict[str, Any]


class FreeTierModelsResponse(BaseModel):
    """List of all available free tier models"""
    models: List[FreeTierModelInfo]
    total: int


# ============================================================================
# Provider Status
# ============================================================================

class ProviderStatusInfo(BaseModel):
    """Status of a single provider"""
    provider_id: str
    display_name: str
    status: str  # healthy, degraded, down, no_keys
    keys_count: int
    available: bool


class ProvidersStatusResponse(BaseModel):
    """Status of all providers"""
    providers: List[ProviderStatusInfo]
    total_available: int
