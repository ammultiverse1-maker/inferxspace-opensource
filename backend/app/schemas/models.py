"""
Pydantic schemas for models endpoint
"""

from datetime import datetime
from typing import Optional, List
from uuid import UUID
from pydantic import BaseModel, Field, ConfigDict


# ============================================================================
# Response Schemas
# ============================================================================

class ModelPricingInfo(BaseModel):
    """Model pricing information"""
    model_config = ConfigDict(protected_namespaces=())
    
    input_per_1k: float = 0  # Price per 1K input tokens (INR)
    output_per_1k: float = 0  # Price per 1K output tokens (INR)
    input_per_1m: float = 0  # Price per 1M input tokens (INR)
    output_per_1m: float = 0  # Price per 1M output tokens (INR)
    currency: str = "INR"


class ModelResponse(BaseModel):
    """Single model information"""
    model_config = ConfigDict(from_attributes=True, protected_namespaces=())
    
    id: str
    name: str
    provider: Optional[str]
    context_window: Optional[int]
    max_output_tokens: Optional[int]
    pricing: ModelPricingInfo
    supports_streaming: bool
    supports_function_calling: bool = False
    is_free: bool = False
    is_paid_available: bool = False
    free_delay_ms: int = 0
    is_active: bool = True
    deployment_type: str = "shared"  # shared, dedicated


class ModelsListResponse(BaseModel):
    """List of available models"""
    models: List[ModelResponse]
    total: int


class ModelDetailResponse(ModelResponse):
    """Detailed model information"""
    gpu_type: Optional[str]
    description: Optional[str] = None
    use_cases: List[str] = []
    created_at: datetime
    updated_at: datetime


# ============================================================================
# OpenAI Compatible Response
# ============================================================================

class OpenAIModelObject(BaseModel):
    """OpenAI-compatible model object"""
    id: str
    object: str = "model"
    created: int
    owned_by: str
    
    class Config:
        json_schema_extra = {
            "example": {
                "id": "llama-3.1-70b-instruct",
                "object": "model",
                "created": 1706140800,
                "owned_by": "meta"
            }
        }


class OpenAIModelsListResponse(BaseModel):
    """OpenAI-compatible models list response"""
    object: str = "list"
    data: List[OpenAIModelObject]
