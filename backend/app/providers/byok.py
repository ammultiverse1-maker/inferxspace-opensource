"""
BYOK Provider Router — Bring Your Own Keys
Routes requests to the appropriate provider based on model name.
Users configure their own API keys in .env
"""

import logging
from typing import Optional, Dict, Any, AsyncGenerator
import httpx

from app.core.config import settings, MODEL_PRICING

logger = logging.getLogger("inferx.providers")


class ProviderError(Exception):
    """Provider request failed"""
    def __init__(self, message: str, status_code: int = 500):
        super().__init__(message)
        self.status_code = status_code


class ModelNotFoundError(ProviderError):
    """No provider configured for this model"""
    pass


class NoAPIKeyError(ProviderError):
    """Provider API key not configured"""
    pass


# Base URLs for each provider
PROVIDER_ENDPOINTS = {
    "openai": "https://api.openai.com/v1",
    "anthropic": "https://api.anthropic.com/v1",
    "gemini": "https://generativelanguage.googleapis.com/v1beta/openai",
    "groq": "https://api.groq.com/openai/v1",
    "mistral": "https://api.mistral.ai/v1",
    "together": "https://api.together.xyz/v1",
    "custom": settings.CUSTOM_PROVIDER_URL or "http://localhost:8080/v1",
}

# Map model prefix → provider
MODEL_PROVIDER_MAP = {
    "gpt-": "openai",
    "o1": "openai",
    "o3": "openai",
    "claude-": "anthropic",
    "gemini-": "gemini",
    "llama-3": "groq",
    "llama3": "groq",
    "mixtral-": "groq",
    "mistral-": "mistral",
    "open-mistral": "mistral",
    "codestral": "mistral",
    "together-": "together",
}


def get_provider_for_model(model_id: str) -> str:
    """Determine which provider handles this model."""
    # Check pricing table first (exact match)
    if model_id in MODEL_PRICING:
        return MODEL_PRICING[model_id]["provider"]

    # Prefix matching
    lower = model_id.lower()
    for prefix, provider in MODEL_PROVIDER_MAP.items():
        if lower.startswith(prefix):
            return provider

    # Fall back to custom provider if set
    if settings.CUSTOM_PROVIDER_URL:
        return "custom"

    raise ModelNotFoundError(
        f"No provider found for model '{model_id}'. "
        "Configure CUSTOM_PROVIDER_URL in .env for self-hosted models.",
        status_code=404
    )


def get_api_key(provider: str) -> str:
    """Get API key for provider. Raises if not configured."""
    key_map = {
        "openai": settings.OPENAI_API_KEY,
        "anthropic": settings.ANTHROPIC_API_KEY,
        "gemini": settings.GEMINI_API_KEY,
        "groq": settings.GROQ_API_KEY,
        "mistral": settings.MISTRAL_API_KEY,
        "together": settings.TOGETHER_API_KEY,
        "custom": settings.CUSTOM_PROVIDER_KEY or "none",
    }
    key = key_map.get(provider)
    if not key:
        raise NoAPIKeyError(
            f"No API key configured for provider '{provider}'. "
            f"Set {provider.upper()}_API_KEY in your .env file.",
            status_code=401
        )
    return key


def get_provider_headers(provider: str, api_key: str) -> Dict[str, str]:
    """Build request headers for provider."""
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}",
    }
    if provider == "anthropic":
        headers["anthropic-version"] = "2023-06-01"
        headers["x-api-key"] = api_key
        del headers["Authorization"]
    return headers


async def proxy_chat_completion(
    model: str,
    payload: Dict[str, Any],
    stream: bool = False,
) -> Any:
    """
    Forward a chat completion request to the appropriate provider.
    Returns the raw response (or streaming response).
    """
    provider = get_provider_for_model(model)
    api_key = get_api_key(provider)
    base_url = PROVIDER_ENDPOINTS[provider]
    endpoint = f"{base_url}/chat/completions"

    # Handle Anthropic's different API format
    if provider == "anthropic":
        endpoint = f"{PROVIDER_ENDPOINTS['anthropic']}/messages"
        payload = _convert_to_anthropic(payload)

    headers = get_provider_headers(provider, api_key)

    async with httpx.AsyncClient(timeout=settings.REQUEST_TIMEOUT_SECONDS) as client:
        if stream:
            async def stream_response():
                async with client.stream("POST", endpoint, json=payload, headers=headers) as resp:
                    if resp.status_code != 200:
                        error_body = await resp.aread()
                        raise ProviderError(
                            f"Provider {provider} returned {resp.status_code}: {error_body.decode()}",
                            status_code=resp.status_code
                        )
                    async for chunk in resp.aiter_bytes():
                        yield chunk
            return stream_response()
        else:
            resp = await client.post(endpoint, json=payload, headers=headers)
            if resp.status_code != 200:
                raise ProviderError(
                    f"Provider {provider} returned {resp.status_code}: {resp.text}",
                    status_code=resp.status_code
                )
            return resp.json()


def _convert_to_anthropic(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Convert OpenAI-format payload to Anthropic Messages API format."""
    messages = payload.get("messages", [])
    system_prompt = None
    converted_messages = []

    for msg in messages:
        if msg["role"] == "system":
            system_prompt = msg["content"]
        else:
            converted_messages.append(msg)

    result = {
        "model": payload["model"],
        "messages": converted_messages,
        "max_tokens": payload.get("max_tokens", 1024),
    }
    if system_prompt:
        result["system"] = system_prompt
    if "temperature" in payload:
        result["temperature"] = payload["temperature"]
    if "stream" in payload:
        result["stream"] = payload["stream"]

    return result


def list_available_models() -> list:
    """Return models that have configured provider keys."""
    available = []
    for model_id, info in MODEL_PRICING.items():
        provider = info["provider"]
        try:
            get_api_key(provider)
            available.append({
                "id": model_id,
                "provider": provider,
                "input_price_per_1m": info["input"],
                "output_price_per_1m": info["output"],
            })
        except NoAPIKeyError:
            pass  # Skip models without configured keys

    # Always add custom if URL is set
    if settings.CUSTOM_PROVIDER_URL:
        available.append({
            "id": "custom",
            "provider": "custom",
            "input_price_per_1m": 0.0,
            "output_price_per_1m": 0.0,
        })

    return available