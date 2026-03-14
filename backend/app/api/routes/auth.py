"""
Authentication API routes
Implements secure login, signup, token refresh, logout, and OAuth
"""

from datetime import datetime, timedelta, timezone
from typing import Optional
from uuid import UUID
import secrets

from fastapi import APIRouter, Depends, HTTPException, Request, Response, Cookie
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.core.redis import RedisClient, get_redis
from app.core.config import settings
from app.core.security import (
    hash_password,
    verify_password,
    create_access_token,
    create_refresh_token,
    decode_refresh_token,
    generate_csrf_token,
    generate_session_id,
    TokenExpiredError,
    InvalidTokenError,
)
from app.core.oauth import get_google_user_info, get_github_user_info
from app.models.models import User, UserCredit, RateLimit
from app.schemas.auth import (
    UserSignupRequest,
    UserLoginRequest,
    AuthResponse,
    TokenResponse,
    UserResponse,
    CSRFTokenResponse,
    MessageResponse,
    ChangePasswordRequest,
)
from app.api.deps import (
    CurrentUser,
    CSRFVerified,
    RateLimited,
)


router = APIRouter(prefix="/auth", tags=["Authentication"])


# ============================================================================
# CSRF Token
# ============================================================================

@router.get("/csrf", response_model=CSRFTokenResponse)
async def get_csrf_token(
    request: Request,
    response: Response,
):
    """
    Get a new CSRF token
    Token is also set in a cookie for double-submit validation
    """
    session_id = generate_session_id()
    csrf_token = generate_csrf_token(session_id)
    
    # Set CSRF token in cookie
    response.set_cookie(
        key="csrf_token",
        value=csrf_token,
        max_age=settings.CSRF_TOKEN_EXPIRE_MINUTES * 60,
        httponly=False,  # Must be readable by JavaScript
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE,
        domain=settings.COOKIE_DOMAIN,
        path='/',
    )
    
    return CSRFTokenResponse(
        csrf_token=csrf_token,
        expires_in=settings.CSRF_TOKEN_EXPIRE_MINUTES * 60
    )


# ============================================================================
# User Registration
# ============================================================================

@router.post("/signup", response_model=AuthResponse, status_code=201)
async def signup(
    request: UserSignupRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
    redis: RedisClient = Depends(get_redis),
):
    """
    Register a new user account
    """
    # Check if email already exists
    result = await db.execute(
        select(User).where(User.email == request.email.lower())
    )
    existing_user = result.scalar_one_or_none()
    
    if existing_user:
        raise HTTPException(
            status_code=409,
            detail="An account with this email already exists"
        )
    
    # Create user
    password_hash = hash_password(request.password)
    
    user = User(
        email=request.email.lower(),
        password_hash=password_hash,
        name=request.name,
        company=request.company,
    )
    db.add(user)
    await db.flush()
    
    # Create initial credit balance (free tier gets 100K tokens)
    credits = UserCredit(
        user_id=user.id,
        balance_tokens=100000,  # Welcome bonus
        total_purchased=100000,
    )
    db.add(credits)
    
    # Create rate limit entry (free tier)
    rate_limit = RateLimit(user_id=user.id, tier="free")
    db.add(rate_limit)
    
    await db.commit()
    await db.refresh(user)
    
    # Generate tokens
    session_id = generate_session_id()
    
    access_token = create_access_token(
        subject=str(user.id),
        user_data={
            "email": user.email,
            "session_id": session_id,
        },
    )
    
    refresh_token = create_refresh_token(subject=str(user.id))
    
    # Set tokens in HTTP-only cookies
    _set_auth_cookies(response, access_token, refresh_token)
    
    # Generate CSRF token
    csrf_token = generate_csrf_token(session_id)
    response.set_cookie(
        key="csrf_token",
        value=csrf_token,
        max_age=settings.CSRF_TOKEN_EXPIRE_MINUTES * 60,
        httponly=False,
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE,
        domain=settings.COOKIE_DOMAIN,
        path='/',
    )
    
    return AuthResponse(
        user=UserResponse.model_validate(user),
        tokens=TokenResponse(
            access_token=access_token,
            expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        ),
        csrf_token=csrf_token,
    )


# ============================================================================
# User Login
# ============================================================================

@router.post("/login", response_model=AuthResponse)
async def login(
    request: UserLoginRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
    redis: RedisClient = Depends(get_redis),
):
    """
    Authenticate user and issue tokens
    """
    print(f"[LOGIN DEBUG] Login attempt for email: {request.email}")
    
    # Find user by email
    result = await db.execute(
        select(User).where(User.email == request.email.lower())
    )
    user = result.scalar_one_or_none()
    
    print(f"[LOGIN DEBUG] User found: {user is not None}")
    if user:
        print(f"[LOGIN DEBUG] User active: {user.is_active}")
        password_valid = verify_password(request.password, user.password_hash)
        print(f"[LOGIN DEBUG] Password verification: {password_valid}")
    
    if not user or not verify_password(request.password, user.password_hash):
        print(f"[LOGIN DEBUG] Login failed - authentication error")
        raise HTTPException(
            status_code=401,
            detail="Incorrect email or password"
        )
    
    if not user.is_active:
        print(f"[LOGIN DEBUG] User not active")
        raise HTTPException(
            status_code=403,
            detail="Account has been deactivated"
        )
    
    # Generate tokens
    session_id = generate_session_id()
    
    access_token = create_access_token(
        subject=str(user.id),
        user_data={
            "email": user.email,
            "session_id": session_id,
        },
    )
    
    refresh_token = create_refresh_token(subject=str(user.id))
    
    # Store session in Redis
    await redis.set_session(session_id, {
        "user_id": str(user.id),
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    
    # Set tokens in HTTP-only cookies
    _set_auth_cookies(response, access_token, refresh_token)
    
    # Generate CSRF token
    csrf_token = generate_csrf_token(session_id)
    response.set_cookie(
        key="csrf_token",
        value=csrf_token,
        max_age=settings.CSRF_TOKEN_EXPIRE_MINUTES * 60,
        httponly=False,
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE,
        domain=settings.COOKIE_DOMAIN,
        path='/',
    )
    
    print(f"[LOGIN DEBUG] Set cookies - access_token, refresh_token, csrf_token")
    print(f"[LOGIN DEBUG] Cookie settings - httponly={settings.COOKIE_HTTPONLY}, secure={settings.COOKIE_SECURE}, samesite={settings.COOKIE_SAMESITE}, domain={settings.COOKIE_DOMAIN}")
    
    return AuthResponse(
        user=UserResponse.model_validate(user),
        tokens=TokenResponse(
            access_token=access_token,
            expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        ),
        csrf_token=csrf_token,
    )


# ============================================================================
# Token Refresh
# ============================================================================

@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(
    response: Response,
    refresh_token: Optional[str] = Cookie(None, alias="refresh_token"),
    db: AsyncSession = Depends(get_db),
    redis: RedisClient = Depends(get_redis),
):
    """
    Refresh access token using refresh token from cookie
    """
    if not refresh_token:
        raise HTTPException(status_code=401, detail="Refresh token not found")
    
    try:
        payload = decode_refresh_token(refresh_token)
        user_id = payload.get("sub")
        jti = payload.get("jti")
        
        # Check if refresh token is blacklisted
        if jti and await redis.is_token_blacklisted(jti):
            raise HTTPException(status_code=401, detail="Token has been revoked")
        
        # Get user
        result = await db.execute(
            select(User).where(User.id == UUID(user_id), User.is_active == True)
        )
        user = result.scalar_one_or_none()
        
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        
        # Generate new tokens
        session_id = generate_session_id()
        
        new_access_token = create_access_token(
            subject=str(user.id),
            user_data={
                "email": user.email,
                "session_id": session_id,
            },
        )
        
        new_refresh_token = create_refresh_token(subject=str(user.id))
        
        # Blacklist old refresh token
        if jti:
            ttl = int(payload.get("exp", 0) - datetime.now(timezone.utc).timestamp())
            if ttl > 0:
                await redis.blacklist_token(jti, ttl)
        
        # Set new tokens in cookies
        _set_auth_cookies(response, new_access_token, new_refresh_token)
        
        return TokenResponse(
            access_token=new_access_token,
            expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        )
        
    except TokenExpiredError:
        raise HTTPException(status_code=401, detail="Refresh token has expired")
    except InvalidTokenError as e:
        raise HTTPException(status_code=401, detail=str(e))


# ============================================================================
# Logout
# ============================================================================

@router.post("/logout", response_model=MessageResponse)
async def logout(
    response: Response,
    current_user: CurrentUser,
    redis: RedisClient = Depends(get_redis),
    refresh_token: Optional[str] = Cookie(None, alias="refresh_token"),
):
    """
    Logout user and invalidate tokens
    """
    # Blacklist refresh token if present
    if refresh_token:
        try:
            payload = decode_refresh_token(refresh_token)
            jti = payload.get("jti")
            if jti:
                ttl = int(payload.get("exp", 0) - datetime.now(timezone.utc).timestamp())
                if ttl > 0:
                    await redis.blacklist_token(jti, ttl)
        except (TokenExpiredError, InvalidTokenError):
            pass  # Token already invalid, proceed with logout
    
    # Clear cookies
    response.delete_cookie("access_token")
    response.delete_cookie("refresh_token")
    response.delete_cookie("csrf_token")
    
    return MessageResponse(message="Successfully logged out")


# ============================================================================
# Get Current User
# ============================================================================

@router.get("/me", response_model=UserResponse)
async def get_me(current_user: CurrentUser):
    """
    Get current authenticated user
    """
    return UserResponse.model_validate(current_user)


# ============================================================================
# Change Password
# ============================================================================

@router.post("/change-password", response_model=MessageResponse)
async def change_password(
    request: ChangePasswordRequest,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
    _csrf: CSRFVerified = None,
):
    """
    Change user password
    """
    # Verify current password
    if not verify_password(request.current_password, current_user.password_hash):
        raise HTTPException(status_code=401, detail="Current password is incorrect")
    
    # Hash new password
    current_user.password_hash = hash_password(request.new_password)
    await db.commit()
    
    return MessageResponse(message="Password changed successfully")


# ============================================================================
# OAuth Authentication
# ============================================================================

@router.post("/oauth/google", response_model=AuthResponse)
async def google_oauth(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
    redis: RedisClient = Depends(get_redis),
):
    """
    Authenticate user with Google OAuth token (ID token JWT from @react-oauth/google).
    If user already exists (signed up via email/password), seamlessly logs them in.
    If user is new, creates an account.
    """
    body = await request.json()
    token = body.get("token")
    user_info_from_client = body.get("user_info")
    
    if not token:
        raise HTTPException(status_code=400, detail="Token is required")
    
    # Verify and decode Google token (supports both access token and ID token flows)
    user_info = await get_google_user_info(token, user_info_from_client)
    if not user_info:
        raise HTTPException(status_code=401, detail="Invalid Google token")
    
    email = user_info.get("email")
    name = user_info.get("name", "")
    
    if not email:
        raise HTTPException(status_code=400, detail="Email not provided by Google")
    
    # Check if user already exists (may have signed up via email/password)
    result = await db.execute(
        select(User).where(User.email == email.lower())
    )
    user = result.scalar_one_or_none()
    
    if user:
        # Existing user — just log them in seamlessly
        # Update name if it was empty (e.g. signed up with email only)
        if not user.name and name:
            user.name = name
        # Mark email as verified since Google verified it
        if not user.email_verified:
            user.email_verified = True
        await db.commit()
        await db.refresh(user)
    else:
        # New user — create account
        random_password = secrets.token_urlsafe(32)
        
        user = User(
            email=email.lower(),
            name=name,
            password_hash=hash_password(random_password),
            is_active=True,
            email_verified=True,
        )
        db.add(user)
        await db.flush()
        
        # Initialize user credits
        user_credit = UserCredit(
            user_id=user.id,
            balance=0,
            total_purchased=0,
            total_spent=0
        )
        db.add(user_credit)
        
        # Initialize rate limit
        rate_limit = RateLimit(
            user_id=user.id,
            requests_today=0,
            last_request_date=datetime.now(timezone.utc).date()
        )
        db.add(rate_limit)
        await db.commit()
        await db.refresh(user)
    
    # Generate session + tokens (same as login flow)
    session_id = generate_session_id()
    
    access_token = create_access_token(
        subject=str(user.id),
        user_data={
            "email": user.email,
            "session_id": session_id,
        },
    )
    
    refresh_token = create_refresh_token(subject=str(user.id))
    
    # Store session in Redis
    await redis.set_session(session_id, {
        "user_id": str(user.id),
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    
    # Set tokens in HTTP-only cookies
    _set_auth_cookies(response, access_token, refresh_token)
    
    # Generate CSRF token
    csrf_token = generate_csrf_token(session_id)
    response.set_cookie(
        key="csrf_token",
        value=csrf_token,
        max_age=settings.CSRF_TOKEN_EXPIRE_MINUTES * 60,
        httponly=False,
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE,
        domain=settings.COOKIE_DOMAIN,
        path='/',
    )
    
    return AuthResponse(
        user=UserResponse.model_validate(user),
        tokens=TokenResponse(
            access_token=access_token,
            expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        ),
        csrf_token=csrf_token,
    )


@router.post("/oauth/github", response_model=AuthResponse)
async def github_oauth(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
    redis: RedisClient = Depends(get_redis),
):
    """
    Authenticate user with GitHub OAuth token.
    If user already exists, seamlessly logs them in.
    """
    body = await request.json()
    token = body.get("token")
    
    if not token:
        raise HTTPException(status_code=400, detail="Token is required")
    
    # Get user info from GitHub
    user_info = await get_github_user_info(token)
    if not user_info:
        raise HTTPException(status_code=401, detail="Invalid GitHub token")
    
    email = user_info.get("email")
    name = user_info.get("name") or user_info.get("login", "")
    
    if not email:
        raise HTTPException(
            status_code=400, 
            detail="Email not provided by GitHub. Please make your email public in GitHub settings."
        )
    
    # Check if user exists
    result = await db.execute(
        select(User).where(User.email == email.lower())
    )
    user = result.scalar_one_or_none()
    
    if user:
        # Existing user — seamless login
        if not user.name and name:
            user.name = name
        if not user.email_verified:
            user.email_verified = True
        await db.commit()
        await db.refresh(user)
    else:
        # New user — create account
        random_password = secrets.token_urlsafe(32)
        
        user = User(
            email=email.lower(),
            name=name,
            password_hash=hash_password(random_password),
            is_active=True,
            email_verified=True,
        )
        db.add(user)
        await db.flush()
        
        # Initialize user credits
        user_credit = UserCredit(
            user_id=user.id,
            balance=0,
            total_purchased=0,
            total_spent=0
        )
        db.add(user_credit)
        
        # Initialize rate limit
        rate_limit = RateLimit(
            user_id=user.id,
            requests_today=0,
            last_request_date=datetime.now(timezone.utc).date()
        )
        db.add(rate_limit)
        await db.commit()
        await db.refresh(user)
    
    # Generate session + tokens
    session_id = generate_session_id()
    
    access_token = create_access_token(
        subject=str(user.id),
        user_data={
            "email": user.email,
            "session_id": session_id,
        },
    )
    
    refresh_token = create_refresh_token(subject=str(user.id))
    
    await redis.set_session(session_id, {
        "user_id": str(user.id),
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    
    _set_auth_cookies(response, access_token, refresh_token)
    
    csrf_token = generate_csrf_token(session_id)
    response.set_cookie(
        key="csrf_token",
        value=csrf_token,
        max_age=settings.CSRF_TOKEN_EXPIRE_MINUTES * 60,
        httponly=False,
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE,
        domain=settings.COOKIE_DOMAIN,
        path='/',
    )
    
    return AuthResponse(
        user=UserResponse.model_validate(user),
        tokens=TokenResponse(
            access_token=access_token,
            expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        ),
        csrf_token=csrf_token,
    )


@router.post("/oauth/github/callback", response_model=AuthResponse)
async def github_oauth_callback(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
    redis: RedisClient = Depends(get_redis),
):
    """
    Handle GitHub OAuth callback with authorization code
    Expects: { "code": "github_authorization_code" }
    """
    import httpx
    
    body = await request.json()
    code = body.get("code")
    
    if not code:
        raise HTTPException(status_code=400, detail="Authorization code is required")
    
    # Exchange code for access token
    try:
        async with httpx.AsyncClient() as client:
            token_response = await client.post(
                'https://github.com/login/oauth/access_token',
                headers={'Accept': 'application/json'},
                data={
                    'client_id': settings.GITHUB_CLIENT_ID,
                    'client_secret': settings.GITHUB_CLIENT_SECRET,
                    'code': code
                }
            )
            
            if token_response.status_code != 200:
                raise HTTPException(status_code=400, detail="Failed to exchange code for token")
            
            token_data = token_response.json()
            access_token = token_data.get('access_token')
            
            if not access_token:
                raise HTTPException(status_code=400, detail="No access token received from GitHub")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"GitHub OAuth error: {str(e)}")
    
    # Get user info from GitHub
    user_info = await get_github_user_info(access_token)
    if not user_info:
        raise HTTPException(status_code=401, detail="Failed to get user info from GitHub")
    
    email = user_info.get("email")
    name = user_info.get("name") or user_info.get("login", "")
    
    if not email:
        raise HTTPException(
            status_code=400, 
            detail="Email not provided by GitHub. Please make your email public in GitHub settings."
        )
    
    # Check if user exists
    result = await db.execute(
        select(User).where(User.email == email.lower())
    )
    user = result.scalar_one_or_none()
    
    if user:
        # Existing user — seamless login
        if not user.name and name:
            user.name = name
        if not user.email_verified:
            user.email_verified = True
        await db.commit()
        await db.refresh(user)
    else:
        # New user — create account
        random_password = secrets.token_urlsafe(32)
        
        user = User(
            email=email.lower(),
            name=name,
            password_hash=hash_password(random_password),
            is_active=True,
            email_verified=True,
        )
        db.add(user)
        await db.flush()
        
        # Initialize user credits
        user_credit = UserCredit(
            user_id=user.id,
            balance=0,
            total_purchased=0,
            total_spent=0
        )
        db.add(user_credit)
        
        # Initialize rate limit
        rate_limit = RateLimit(
            user_id=user.id,
            requests_today=0,
            last_request_date=datetime.now(timezone.utc).date()
        )
        db.add(rate_limit)
        await db.commit()
        await db.refresh(user)
    
    # Generate session + tokens
    session_id = generate_session_id()
    
    jwt_access_token = create_access_token(
        subject=str(user.id),
        user_data={
            "email": user.email,
            "session_id": session_id,
        },
    )
    
    jwt_refresh_token = create_refresh_token(subject=str(user.id))
    
    await redis.set_session(session_id, {
        "user_id": str(user.id),
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    
    _set_auth_cookies(response, jwt_access_token, jwt_refresh_token)
    
    csrf_token = generate_csrf_token(session_id)
    response.set_cookie(
        key="csrf_token",
        value=csrf_token,
        max_age=settings.CSRF_TOKEN_EXPIRE_MINUTES * 60,
        httponly=False,
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE,
        domain=settings.COOKIE_DOMAIN,
        path='/',
    )
    
    return AuthResponse(
        user=UserResponse.model_validate(user),
        tokens=TokenResponse(
            access_token=jwt_access_token,
            expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        ),
        csrf_token=csrf_token,
    )


# ============================================================================
# Helper Functions
# ============================================================================

def _set_auth_cookies(response: Response, access_token: str, refresh_token: str):
    """Set authentication cookies"""
    # Access token cookie
    response.set_cookie(
        key="access_token",
        value=access_token,
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        httponly=settings.COOKIE_HTTPONLY,
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE,
        domain=settings.COOKIE_DOMAIN,
        path='/',
    )
    
    # Refresh token cookie
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        max_age=settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
        httponly=settings.COOKIE_HTTPONLY,
        secure=settings.COOKIE_SECURE,
        samesite=settings.COOKIE_SAMESITE,
        domain=settings.COOKIE_DOMAIN,
        path='/',
    )
