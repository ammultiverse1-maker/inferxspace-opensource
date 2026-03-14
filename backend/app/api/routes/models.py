"""
Models API routes
List and get available LLM models — sourced from provider registry + config
"""

from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from app.core.config import MODEL_PRICING
from app.providers.registry import provider_registry, PROVIDER_CONFIGS, VIRTUAL_MODEL_PROVIDERS
from app.schemas.models import (
    ModelResponse,
    ModelPricingInfo,
    ModelsListResponse,
    ModelDetailResponse,
    OpenAIModelObject,
    OpenAIModelsListResponse,
)
from app.api.deps import CurrentUser, OptionalUser


router = APIRouter(prefix="/models", tags=["Models"])


# ============================================================================
# List Models (Dashboard) — from registry + config (single source of truth)
# ============================================================================

@router.get("", response_model=ModelsListResponse)
async def list_models(
    current_user: OptionalUser,
    active_only: bool = Query(True),
):
    """
    List all available models with pricing.
    Sources from VIRTUAL_MODEL_PROVIDERS + MODEL_PRICING config.
    """
    virtual_models = provider_registry.get_all_virtual_models()

    models = []
    seen_ids = set()
    for vm in virtual_models:
        pricing_data = vm.get("pricing", {})
        input_per_1k = pricing_data.get("input_per_1k", 0)
        output_per_1k = pricing_data.get("output_per_1k", 0)

        # Skip duplicates (auto model may duplicate an existing model)
        if vm["id"] in seen_ids:
            continue
        seen_ids.add(vm["id"])

        models.append(ModelResponse(
            id=vm["id"],
            name=vm["name"],
            provider=vm.get("provider", "InferX"),
            context_window=vm.get("context_window"),
            max_output_tokens=vm.get("max_tokens"),
            pricing=ModelPricingInfo(
                input_per_1k=input_per_1k,
                output_per_1k=output_per_1k,
                input_per_1m=round(input_per_1k * 1000, 2),
                output_per_1m=round(output_per_1k * 1000, 2),
            ),
            supports_streaming=vm.get("supports_streaming", True),
            supports_function_calling=False,
            is_free=vm.get("is_free", True),
            is_paid_available=vm.get("is_paid_available", False),
            free_delay_ms=vm.get("free_delay_ms", 0),
            is_active=True,
            deployment_type="shared",
        ))

    return ModelsListResponse(
        models=models,
        total=len(models),
    )


# ============================================================================
# Get Model Details
# ============================================================================

@router.get("/{model_id}", response_model=ModelDetailResponse)
async def get_model(
    model_id: str,
    current_user: OptionalUser,
):
    """
    Get detailed information about a specific model
    """
    pricing = MODEL_PRICING.get(model_id)
    if not pricing:
        raise HTTPException(status_code=404, detail="Model not found")

    # Get provider info
    providers = VIRTUAL_MODEL_PROVIDERS.get(model_id, [])
    primary_provider = providers[0] if providers else "unknown"
    config = PROVIDER_CONFIGS.get(primary_provider)
    provider_name = config.display_name if config else primary_provider
    context_window = pricing.get("context_window", config.context_window if config else None)
    max_tokens = config.max_tokens_default if config else 4096

    input_per_1k = pricing.get("input_per_1k", 0)
    output_per_1k = pricing.get("output_per_1k", 0)
    now = datetime.now(timezone.utc)

    return ModelDetailResponse(
        id=model_id,
        name=model_id.replace("-", " ").title(),
        provider=provider_name,
        context_window=context_window,
        max_output_tokens=max_tokens,
        pricing=ModelPricingInfo(
            input_per_1k=input_per_1k,
            output_per_1k=output_per_1k,
            input_per_1m=round(input_per_1k * 1000, 2),
            output_per_1m=round(output_per_1k * 1000, 2),
        ),
        supports_streaming=True,
        supports_function_calling=False,
        is_free=pricing.get("is_free", True),
        is_paid_available=pricing.get("is_paid_available", False),
        free_delay_ms=pricing.get("free_delay_ms", 0),
        is_active=True,
        deployment_type="shared",
        gpu_type=None,
        created_at=now,
        updated_at=now,
    )


# ============================================================================
# OpenAI-Compatible Models Endpoint
# ============================================================================

@router.get("/v1/models", response_model=OpenAIModelsListResponse, include_in_schema=False)
async def list_models_openai_compat():
    """
    OpenAI-compatible models list endpoint
    Note: This is also available at /v1/models for full compatibility
    """
    model_data = []
    
    model_owners = {
        "llama-3.1-8b-instruct": "meta",
        "llama-3.1-70b-instruct": "meta",
        "mistral-7b-instruct": "mistral",
        "mixtral-8x7b-instruct": "mistral",
        "qwen-2.5-7b-instruct": "alibaba",
        "bge-large-en-v1.5": "baai",
    }
    
    for model_id in MODEL_PRICING.keys():
        model_data.append(OpenAIModelObject(
            id=model_id,
            created=int(datetime(2024, 1, 1, tzinfo=timezone.utc).timestamp()),
            owned_by=model_owners.get(model_id, "inferx"),
        ))
    
    return OpenAIModelsListResponse(data=model_data)
