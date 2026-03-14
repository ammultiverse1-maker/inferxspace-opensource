"""
API Dependencies for InferX API Platform
Handles authentication, authorization, rate limiting, and CSRF validation
"""

from datetime import datetime, timezone
from typing import Optional, Annotated
from uuid import UUID

from fastapi import Depends, HTTPException, Request, Response, Cookie, Header
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.core.redis import RedisClient, get_redis
from app.core.security import (
    decode_access_token,
    decode_refresh_token,
    hash_api_key,
    validate_csrf_token,
    get_rate_limit_key,
    TokenExpiredError,
    InvalidTokenError,
    CSRFError,
)
from app.core.config import settings, RATE_LIMIT_TIERS
from app.models.models import User, APIKey, UserCredit, RateLimit


# HTTP Bearer token security
security = HTTPBearer(auto_error=False)


class AuthenticationError(HTTPException):
    """Authentication error exception"""
    def __init__(self, detail: str = "Authentication failed"):
        super().__init__(status_code=401, detail=detail)


class AuthorizationError(HTTPException):
    """Authorization error exception"""
    def __init__(self, detail: str = "Access denied"):
        super().__init__(status_code=403, detail=detail)


class RateLimitExceededError(HTTPException):
    """Rate limit exceeded exception"""
    def __init__(self, detail: str = "Rate limit exceeded", retry_after: int = 60):
        super().__init__(
            status_code=429,
            detail=detail,
            headers={"Retry-After": str(retry_after)}
        )


class InsufficientCreditsError(HTTPException):
    """Insufficient credits exception"""
    def __init__(self, detail: str = "Insufficient credits"):
        super().__init__(status_code=402, detail=detail)


# ============================================================================
# User Authentication (JWT from cookies)
# ============================================================================

async def get_current_user(
    request: Request,
    db: AsyncSession = Depends(get_db),
    redis: RedisClient = Depends(get_redis),
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    access_token: Optional[str] = Cookie(None, alias="access_token"),
) -> User:
    """
    Get current authenticated user from JWT token
    Token can be from Authorization header or HTTP-only cookie
    """
    token = None

    # Log incoming cookies and headers for debugging
    try:
        print("[AUTH DEBUG] Request cookies:", dict(request.cookies))
    except Exception as e:
        print("[AUTH DEBUG] Could not read request.cookies:", e)

    try:
        auth_header = request.headers.get("authorization")
        print("[AUTH DEBUG] Authorization header:", auth_header)
    except Exception as e:
        print("[AUTH DEBUG] Could not read Authorization header:", e)

    # Try to get token from Authorization header first
    if credentials:
        token = credentials.credentials
        print("[AUTH DEBUG] Token extracted from Authorization header (truncated):", token[:20] if token else None)
    # Fallback to cookie
    elif access_token:
        token = access_token
        print("[AUTH DEBUG] Token extracted from cookie (truncated):", token[:20] if token else None)
    else:
        print("[AUTH DEBUG] No token found in header or cookie")
    
    if not token:
        raise AuthenticationError("Not authenticated")
    
    try:
        payload = decode_access_token(token)
        user_id = payload.get("sub")
        
        if not user_id:
            raise AuthenticationError("Invalid token payload")
        
        # Check if token is blacklisted
        jti = payload.get("jti")
        if jti and await redis.is_token_blacklisted(jti):
            raise AuthenticationError("Token has been revoked")
        
        # Get user from database
        result = await db.execute(
            select(User).where(User.id == UUID(user_id), User.is_active == True)
        )
        user = result.scalar_one_or_none()
        
        if not user:
            raise AuthenticationError("User not found or inactive")
        
        return user
        
    except TokenExpiredError:
        raise AuthenticationError("Token has expired")
    except InvalidTokenError as e:
        raise AuthenticationError(str(e))


async def get_current_active_user(
    current_user: User = Depends(get_current_user)
) -> User:
    """Ensure user is active"""
    if not current_user.is_active:
        raise AuthorizationError("User account is deactivated")
    return current_user


async def get_admin_user(
    current_user: User = Depends(get_current_user)
) -> User:
    """Ensure user is an admin or super_admin"""
    if not current_user.is_active:
        raise AuthorizationError("User account is deactivated")
    role = getattr(current_user, "role", "user")
    if role not in ("admin", "super_admin"):
        raise AuthorizationError("Admin access required")
    return current_user


async def get_super_admin_user(
    current_user: User = Depends(get_current_user)
) -> User:
    """Ensure user is a super_admin"""
    if not current_user.is_active:
        raise AuthorizationError("User account is deactivated")
    role = getattr(current_user, "role", "user")
    if role != "super_admin":
        raise AuthorizationError("Super admin access required")
    return current_user


async def get_optional_user(
    request: Request,
    db: AsyncSession = Depends(get_db),
    redis: RedisClient = Depends(get_redis),
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    access_token: Optional[str] = Cookie(None, alias="access_token"),
) -> Optional[User]:
    """Get current user if authenticated, None otherwise"""
    try:
        return await get_current_user(request, db, redis, credentials, access_token)
    except AuthenticationError:
        return None


# ============================================================================
# API Key Authentication (for vLLM proxy endpoints)
# ============================================================================

async def get_user_from_api_key(
    request: Request,
    db: AsyncSession = Depends(get_db),
    redis: RedisClient = Depends(get_redis),
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> User:
    """
    Authenticate user via API key (Bearer token)
    Used for /v1/* endpoints (OpenAI-compatible)
    """
    if not credentials:
        raise AuthenticationError("API key required")
    
    api_key = credentials.credentials
    
    # Handle internal system key for RAG and other internal calls
    if api_key == settings.INTERNAL_SYSTEM_KEY or api_key == "sk_system_test_key":
        # Get user ID from custom header or use a default test user
        internal_user_id = request.headers.get("X-Internal-User-ID")
        if not internal_user_id:
            # For testing, try to find a test user
            result = await db.execute(
                select(User).where(User.email == "test@example.com", User.is_active == True)
            )
            test_user = result.scalar_one_or_none()
            if test_user:
                internal_user_id = str(test_user.id)
            else:
                raise AuthenticationError("Test user not found - run create_test_key.py first")
        
        # Get user from database
        result = await db.execute(
            select(User).where(User.id == UUID(internal_user_id), User.is_active == True)
        )
        user = result.scalar_one_or_none()
        if not user:
            raise AuthenticationError("Internal user not found")
        
        # Mark as internal call in request state
        request.state.api_key_id = None
        return user
    
    # Validate key format
    if not (api_key.startswith(settings.API_KEY_PREFIX) or 
            api_key.startswith(settings.API_KEY_TEST_PREFIX)):
        raise AuthenticationError("Invalid API key format")
    
    key_hash = hash_api_key(api_key)
    
    # Check cache first
    cached_data = await redis.get_cached_api_key(key_hash)
    if cached_data:
        # Get user from database using cached user_id
        result = await db.execute(
            select(User).where(User.id == UUID(cached_data["user_id"]), User.is_active == True)
        )
        user = result.scalar_one_or_none()
        if user:
            # Store API key ID in request state for logging
            request.state.api_key_id = cached_data["api_key_id"]
            return user
    
    # Look up API key in database
    result = await db.execute(
        select(APIKey)
        .join(User)
        .where(
            APIKey.key_hash == key_hash,
            APIKey.is_active == True,
            User.is_active == True
        )
    )
    api_key_obj = result.scalar_one_or_none()
    
    if not api_key_obj:
        raise AuthenticationError("Invalid API key")
    
    # Update last used timestamp
    api_key_obj.last_used_at = datetime.now(timezone.utc)
    await db.commit()
    
    # Get user
    result = await db.execute(
        select(User).where(User.id == api_key_obj.user_id)
    )
    user = result.scalar_one_or_none()
    
    if not user or not user.is_active:
        raise AuthenticationError("User not found or inactive")
    
    # Cache for future requests
    await redis.cache_api_key(key_hash, {
        "user_id": str(user.id),
        "api_key_id": str(api_key_obj.id)
    })
    
    # Store in request state
    request.state.api_key_id = str(api_key_obj.id)
    
    return user


# ============================================================================
# Combined Authentication (API Key or Cookie)
# ============================================================================

async def get_authenticated_user(
    request: Request,
    db: AsyncSession = Depends(get_db),
    redis: RedisClient = Depends(get_redis),
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    access_token: Optional[str] = Cookie(None, alias="access_token"),
) -> User:
    """
    Authenticate user via API key (preferred) or cookie JWT
    Used for endpoints that need to support both external API calls and dashboard access
    """
    # Try API key authentication first
    if credentials:
        try:
            return await get_user_from_api_key(request, db, redis, credentials)
        except AuthenticationError:
            pass  # Fall through to cookie auth
    
    # Try cookie authentication
    try:
        return await get_current_user(request, db, redis, credentials, access_token)
    except AuthenticationError:
        raise AuthenticationError("Authentication required (API key or login)")


# ============================================================================
# CSRF Protection (for state-changing operations)
# ============================================================================

async def verify_csrf_token(
    request: Request,
    x_csrf_token: Optional[str] = Header(None, alias="X-CSRF-Token"),
    csrf_token: Optional[str] = Cookie(None, alias="csrf_token"),
) -> bool:
    """
    Verify CSRF token for state-changing operations
    Token must be sent in X-CSRF-Token header and match cookie
    """
    # Skip CSRF check in development / testing mode
    if settings.ENVIRONMENT in ("development", "testing"):
        return True
    
    if not x_csrf_token:
        raise HTTPException(
            status_code=403,
            detail="CSRF token missing",
            headers={"X-CSRF-Required": "true"}
        )
    
    if not csrf_token:
        raise HTTPException(
            status_code=403,
            detail="CSRF cookie missing"
        )
    
    # Get session ID from access token cookie
    access_token = request.cookies.get("access_token")
    if not access_token:
        raise AuthenticationError("Not authenticated")
    
    try:
        payload = decode_access_token(access_token)
        session_id = payload.get("session_id", payload.get("sub"))
        
        if not validate_csrf_token(x_csrf_token, session_id):
            raise HTTPException(status_code=403, detail="Invalid CSRF token")
            
    except (TokenExpiredError, InvalidTokenError):
        raise AuthenticationError("Invalid or expired token")
    
    return True


# ============================================================================
# Rate Limiting
# ============================================================================

async def check_rate_limit(
    request: Request,
    redis: RedisClient = Depends(get_redis),
    user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> bool:
    """
    Check rate limits for authenticated user
    Uses tier-based rate limiting
    """
    if not settings.RATE_LIMIT_ENABLED:
        return True
    
    # Get user's rate limit tier
    result = await db.execute(
        select(RateLimit).where(RateLimit.user_id == user.id)
    )
    rate_limit = result.scalar_one_or_none()
    
    tier = rate_limit.tier if rate_limit else "free"
    limits = RATE_LIMIT_TIERS.get(tier, RATE_LIMIT_TIERS["free"])
    
    user_id = str(user.id)
    
    # Check per-minute limit
    minute_key = get_rate_limit_key(user_id, "minute")
    is_allowed, current = await redis.check_rate_limit(
        minute_key,
        limits["requests_per_minute"],
        60
    )
    
    if not is_allowed:
        raise RateLimitExceededError(
            f"Rate limit exceeded: {limits['requests_per_minute']} requests per minute",
            retry_after=60
        )
    
    # Check per-day limit
    day_key = get_rate_limit_key(user_id, "day")
    is_allowed, current = await redis.check_rate_limit(
        day_key,
        limits["requests_per_day"],
        86400
    )
    
    if not is_allowed:
        raise RateLimitExceededError(
            f"Daily rate limit exceeded: {limits['requests_per_day']} requests per day",
            retry_after=3600
        )
    
    # Store limits in request for response headers
    request.state.rate_limit = {
        "limit": limits["requests_per_minute"],
        "remaining": max(0, limits["requests_per_minute"] - current),
        "reset": 60
    }
    
    return True


async def check_api_rate_limit(
    request: Request,
    redis: RedisClient = Depends(get_redis),
    user: User = Depends(get_authenticated_user),
    db: AsyncSession = Depends(get_db),
) -> bool:
    """
    Check rate limits for API key authenticated requests
    """
    # Reuse the generic rate limit checker but allow either API key or cookie-authenticated user
    return await check_rate_limit(request, redis, user, db)


# ============================================================================
# Credit Balance Check
# ============================================================================

async def check_credit_balance(
    request: Request,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_authenticated_user),
    redis: RedisClient = Depends(get_redis),
) -> UserCredit:
    """
    Check if user has sufficient credits for the request
    """
    result = await db.execute(
        select(UserCredit).where(UserCredit.user_id == user.id)
    )
    credits = result.scalar_one_or_none()
    
    if not credits:
        raise InsufficientCreditsError("No credit balance found. Please purchase credits.")
    
    # Check available balance (total - reserved)
    available = credits.balance_tokens - credits.reserved_tokens
    
    if available <= 0:
        raise InsufficientCreditsError(
            "Insufficient credits. Please purchase more credits to continue."
        )
    
    # Store credits in request state for later use
    request.state.user_credits = credits
    
    return credits


# ============================================================================
# Request ID Generation
# ============================================================================

async def get_request_id(request: Request) -> str:
    """Generate or retrieve request ID"""
    import uuid
    
    # Check if request ID was provided
    request_id = request.headers.get("X-Request-ID")
    
    if not request_id:
        request_id = f"req_{uuid.uuid4().hex[:24]}"
    
    # Store in request state
    request.state.request_id = request_id
    
    return request_id


# ============================================================================
# IP Address Extraction
# ============================================================================

def get_client_ip(request: Request) -> str:
    """
    Get client IP address, handling proxies
    """
    # Check X-Forwarded-For header (for proxies)
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        # Take the first IP (original client)
        return forwarded.split(",")[0].strip()
    
    # Check X-Real-IP header
    real_ip = request.headers.get("X-Real-IP")
    if real_ip:
        return real_ip
    
    # Fallback to direct client
    if request.client:
        return request.client.host
    
    return "unknown"


# ============================================================================
# Annotated Dependencies for cleaner code
# ============================================================================

CurrentUser = Annotated[User, Depends(get_current_active_user)]
OptionalUser = Annotated[Optional[User], Depends(get_optional_user)]
APIKeyUser = Annotated[User, Depends(get_user_from_api_key)]
AuthenticatedUser = Annotated[User, Depends(get_authenticated_user)]
CSRFVerified = Annotated[bool, Depends(verify_csrf_token)]
RateLimited = Annotated[bool, Depends(check_rate_limit)]
APIRateLimited = Annotated[bool, Depends(check_api_rate_limit)]
CreditCheck = Annotated[UserCredit, Depends(check_credit_balance)]
RequestID = Annotated[str, Depends(get_request_id)]
