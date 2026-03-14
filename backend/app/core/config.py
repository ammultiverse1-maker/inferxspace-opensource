"""
Configuration settings for InferX Open Source
All secrets come from environment variables - never hardcode credentials.
"""

import os
from typing import List, Optional
from pydantic_settings import BaseSettings
from pydantic import Field


class Settings(BaseSettings):

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "case_sensitive": True,
        "extra": "ignore",
    }

    # Application
    APP_NAME: str = "InferX"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False
    ENVIRONMENT: str = Field(default="development")

    # Server
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    WORKERS: int = 1

    # CORS
    CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://localhost:3000",
    ]
    CORS_ALLOW_CREDENTIALS: bool = True

    # Database
    DATABASE_URL: str = Field(default="sqlite+aiosqlite:///./inferx.db")
    DB_POOL_SIZE: int = 10
    DB_MAX_OVERFLOW: int = 20
    DB_POOL_TIMEOUT: int = 30

    # Redis (optional - for rate limiting and session caching)
    REDIS_URL: str = Field(default="redis://localhost:6379/0")
    REDIS_ENABLED: bool = False  # Set to true if you have Redis

    # JWT
    SECRET_KEY: str = Field(default="CHANGE_THIS_IN_PRODUCTION_USE_RANDOM_256_BIT_KEY")
    REFRESH_SECRET_KEY: str = Field(default="CHANGE_THIS_REFRESH_KEY_IN_PRODUCTION")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Security
    CSRF_SECRET_KEY: str = Field(default="CHANGE_THIS_CSRF_KEY_IN_PRODUCTION")
    CSRF_TOKEN_EXPIRE_MINUTES: int = 60
    COOKIE_SECURE: bool = False  # Set True in production with HTTPS
    COOKIE_HTTPONLY: bool = True
    COOKIE_SAMESITE: str = "lax"
    COOKIE_DOMAIN: Optional[str] = None

    # Password hashing
    PASSWORD_HASH_ROUNDS: int = 12

    # Rate limiting
    RATE_LIMIT_ENABLED: bool = True
    RATE_LIMIT_PER_MINUTE: int = 60
    RATE_LIMIT_PER_HOUR: int = 1000
    RATE_LIMIT_PER_DAY: int = 10000

    # OAuth (optional - configure your own app credentials)
    GOOGLE_CLIENT_ID: Optional[str] = None
    GOOGLE_CLIENT_SECRET: Optional[str] = None
    GITHUB_CLIENT_ID: Optional[str] = None
    GITHUB_CLIENT_SECRET: Optional[str] = None

    # === BYOK - Bring Your Own Keys ===
    # Configure the providers you want to enable.
    # Add your own API keys here.

    # OpenAI
    OPENAI_API_KEY: Optional[str] = None

    # Anthropic (Claude)
    ANTHROPIC_API_KEY: Optional[str] = None

    # Google Gemini
    GEMINI_API_KEY: Optional[str] = None

    # Groq (fast inference)
    GROQ_API_KEY: Optional[str] = None

    # Mistral
    MISTRAL_API_KEY: Optional[str] = None

    # Together AI
    TOGETHER_API_KEY: Optional[str] = None

    # Custom / Self-hosted vLLM endpoint
    CUSTOM_PROVIDER_URL: Optional[str] = None
    CUSTOM_PROVIDER_KEY: Optional[str] = None

    # === Free Tier Settings ===
    FREE_TIER_ENABLED: bool = True
    FREE_TIER_DAILY_TOKEN_LIMIT: int = 10000
    FREE_TIER_RPM: int = 10
    FREE_TIER_RPD: int = 100

    # Request settings
    MAX_REQUEST_SIZE_MB: int = 10
    MAX_TOKENS_PER_REQUEST: int = 32768
    REQUEST_TIMEOUT_SECONDS: int = 120

    # HSTS
    HSTS_MAX_AGE: int = 31536000
    CONTENT_SECURITY_POLICY: str = "default-src 'self'"

    # Logging
    LOG_LEVEL: str = "INFO"


settings = Settings()


# Model pricing table (tokens per 1M, in USD)
# Update these to match your provider's actual pricing
MODEL_PRICING = {
    "gpt-4o": {"input": 5.0, "output": 15.0, "provider": "openai"},
    "gpt-4o-mini": {"input": 0.15, "output": 0.6, "provider": "openai"},
    "gpt-3.5-turbo": {"input": 0.5, "output": 1.5, "provider": "openai"},
    "claude-3-5-sonnet-20241022": {"input": 3.0, "output": 15.0, "provider": "anthropic"},
    "claude-3-haiku-20240307": {"input": 0.25, "output": 1.25, "provider": "anthropic"},
    "gemini-1.5-pro": {"input": 1.25, "output": 5.0, "provider": "gemini"},
    "gemini-1.5-flash": {"input": 0.075, "output": 0.3, "provider": "gemini"},
    "llama-3.1-70b-versatile": {"input": 0.59, "output": 0.79, "provider": "groq"},
    "llama-3.1-8b-instant": {"input": 0.05, "output": 0.08, "provider": "groq"},
    "mixtral-8x7b-32768": {"input": 0.24, "output": 0.24, "provider": "groq"},
    "mistral-large-latest": {"input": 2.0, "output": 6.0, "provider": "mistral"},
    "mistral-7b-instruct": {"input": 0.25, "output": 0.25, "provider": "mistral"},
}

# Rate limit tiers
RATE_LIMIT_TIERS = {
    "free": {"rpm": 10, "rpd": 100, "max_tokens": 4096},
    "basic": {"rpm": 60, "rpd": 1000, "max_tokens": 16384},
    "pro": {"rpm": 200, "rpd": 10000, "max_tokens": 32768},
    "enterprise": {"rpm": 1000, "rpd": 100000, "max_tokens": 128000},
}