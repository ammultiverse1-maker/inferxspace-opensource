"""
OpenAI-Compatible Chat Completions API — BYOK Edition
Routes requests to your configured providers.
Tracks usage and deducts credits.
"""

import time
import uuid
import json
import logging
from datetime import datetime, timezone
from typing import Optional, AsyncGenerator, List, Dict, Any
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse, JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.core.config import settings, MODEL_PRICING
from app.models.models import UsageLog, UserCredit, CreditTransaction
from app.schemas.completions import (
    ChatCompletionRequest,
    ChatCompletionResponse,
)
from app.api.deps import get_user_from_api_key, get_current_active_user
from app.providers.byok import (
    proxy_chat_completion,
    list_available_models,
    get_provider_for_model,
    ModelNotFoundError,
    NoAPIKeyError,
    ProviderError,
)

logger = logging.getLogger("inferx.completions")
router = APIRouter(prefix="/v1", tags=["Inference"])


# ============================================================================
# Helper: calculate cost
# ============================================================================

def _calculate_cost(model: str, input_tokens: int, output_tokens: int) -> tuple[Decimal, Decimal]:
    pricing = MODEL_PRICING.get(model, {"input": 1.0, "output": 1.0})
    input_cost = Decimal(str(input_tokens)) * Decimal(str(pricing["input"])) / Decimal("1000000")
    output_cost = Decimal(str(output_tokens)) * Decimal(str(pricing["output"])) / Decimal("1000000")
    return input_cost, output_cost


# ============================================================================
# Chat Completions
# ============================================================================

@router.post("/chat/completions")
async def chat_completions(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """
    OpenAI-compatible chat completions endpoint.
    Reads Bearer token from Authorization header to identify user.
    Routes to the appropriate provider based on model name.
    """
    # Authenticate user via API key
    try:
        user = await get_user_from_api_key(request, db)
    except HTTPException as e:
        if e.status_code == 401:
            raise HTTPException(
                status_code=401,
                detail="Invalid or missing API key. Generate one in the dashboard."
            )
        raise

    # Parse request body
    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON body")

    model = body.get("model", "")
    if not model:
        raise HTTPException(status_code=400, detail="'model' field is required")

    stream = body.get("stream", False)
    start_time = time.time()
    request_id = f"chatcmpl-{uuid.uuid4().hex[:24]}"

    # Check credits
    result = await db.execute(select(UserCredit).where(UserCredit.user_id == user.id))
    credits = result.scalar_one_or_none()
    if credits and credits.balance_tokens <= 0 and not settings.FREE_TIER_ENABLED:
        raise HTTPException(status_code=402, detail="Insufficient credits. Top up your balance.")

    # Forward to provider
    try:
        response_data = await proxy_chat_completion(model, body, stream=stream)
    except ModelNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except NoAPIKeyError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except ProviderError as e:
        raise HTTPException(status_code=e.status_code, detail=str(e))

    if stream:
        # Stream SSE response, log usage from final chunk
        async def stream_and_log():
            total_input = 0
            total_output = 0
            async for chunk in response_data:
                yield chunk
                # Try to parse usage from final delta chunk
                try:
                    decoded = chunk.decode("utf-8")
                    if '"usage"' in decoded:
                        data_part = decoded.replace("data: ", "").strip()
                        if data_part and data_part != "[DONE]":
                            parsed = json.loads(data_part)
                            usage = parsed.get("usage") or {}
                            total_input = usage.get("prompt_tokens", 0)
                            total_output = usage.get("completion_tokens", 0)
                except Exception:
                    pass

            # Log usage after stream completes
            if total_input or total_output:
                await _log_usage(db, user.id, model, request_id, total_input, total_output, start_time)

        return StreamingResponse(stream_and_log(), media_type="text/event-stream")

    # Non-streaming: log usage from response
    usage = response_data.get("usage", {})
    input_tokens = usage.get("prompt_tokens", 0)
    output_tokens = usage.get("completion_tokens", 0)

    await _log_usage(db, user.id, model, request_id, input_tokens, output_tokens, start_time)

    return JSONResponse(content=response_data)


async def _log_usage(db, user_id, model, request_id, input_tokens, output_tokens, start_time):
    """Write a UsageLog entry and deduct credits."""
    try:
        latency_ms = int((time.time() - start_time) * 1000)
        input_cost, output_cost = _calculate_cost(model, input_tokens, output_tokens)
        total_cost_tokens = int((input_cost + output_cost) * Decimal("1000000"))

        log = UsageLog(
            user_id=user_id,
            request_id=request_id,
            model_id=model,
            endpoint="/v1/chat/completions",
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            input_cost=input_cost,
            output_cost=output_cost,
            latency_ms=latency_ms,
            status="success",
        )
        db.add(log)

        # Deduct from credits
        result = await db.execute(select(UserCredit).where(UserCredit.user_id == user_id))
        credits = result.scalar_one_or_none()
        if credits:
            credits.balance_tokens = max(0, credits.balance_tokens - total_cost_tokens)
            credits.total_used += total_cost_tokens

        await db.commit()
    except Exception as e:
        logger.warning(f"Failed to log usage: {e}")


# ============================================================================
# Models
# ============================================================================

@router.get("/models")
async def list_models():
    """List all models available with your configured provider keys."""
    models = list_available_models()
    return {
        "object": "list",
        "data": [
            {
                "id": m["id"],
                "object": "model",
                "created": 1700000000,
                "owned_by": m["provider"],
            }
            for m in models
        ],
    }