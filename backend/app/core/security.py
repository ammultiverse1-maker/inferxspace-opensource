"""
Security utilities for InferX API Platform
Implements OWASP Top 10 security measures:
- A01: Broken Access Control -> JWT-based auth with proper validation
- A02: Cryptographic Failures -> bcrypt password hashing, secure token generation
- A03: Injection -> Parameterized queries via SQLAlchemy
- A04: Insecure Design -> Proper rate limiting and input validation
- A05: Security Misconfiguration -> Secure defaults and settings
- A06: Vulnerable Components -> Updated dependencies
- A07: Authentication Failures -> Secure session management
- A08: Software Integrity -> CSRF protection
- A09: Security Logging -> Comprehensive audit logging
- A10: SSRF -> Input validation for external requests
"""

import secrets
import hashlib
import hmac
from datetime import datetime, timedelta, timezone
from typing import Optional, Tuple, Dict, Any
from uuid import UUID

from jose import jwt, JWTError
import bcrypt
from itsdangerous import URLSafeTimedSerializer, BadSignature, SignatureExpired

from app.core.config import settings


# CSRF Token serializer
csrf_serializer = URLSafeTimedSerializer(settings.CSRF_SECRET_KEY)


# Security headers for all responses
SECURITY_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "X-XSS-Protection": "1; mode=block",
    "Strict-Transport-Security": f"max-age={settings.HSTS_MAX_AGE}; includeSubDomains",
    "Content-Security-Policy": settings.CONTENT_SECURITY_POLICY,
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "geolocation=(), microphone=(), camera=()",
}


class SecurityError(Exception):
    """Base security exception"""
    pass


class TokenExpiredError(SecurityError):
    """Token has expired"""
    pass


class InvalidTokenError(SecurityError):
    """Token is invalid"""
    pass


class CSRFError(SecurityError):
    """CSRF validation failed"""
    pass


# ============================================================================
# Password Hashing
# ============================================================================

def hash_password(password: str) -> str:
    """
    Hash a password using bcrypt with salt
    OWASP A02: Cryptographic Failures - Using strong hashing
    """
    # Encode password to bytes and truncate to 72 bytes if necessary
    password_bytes = password.encode('utf-8')[:72]
    salt = bcrypt.gensalt(rounds=settings.PASSWORD_HASH_ROUNDS)
    hashed = bcrypt.hashpw(password_bytes, salt)
    return hashed.decode('utf-8')


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verify a password against its hash
    Uses constant-time comparison to prevent timing attacks
    """
    # Encode password to bytes and truncate to 72 bytes if necessary
    password_bytes = plain_password.encode('utf-8')[:72]
    hashed_bytes = hashed_password.encode('utf-8')
    return bcrypt.checkpw(password_bytes, hashed_bytes)


def check_password_strength(password: str) -> Tuple[bool, str]:
    """
    Check password strength requirements
    OWASP A07: Authentication Failures - Enforce strong passwords
    """
    if len(password) < 8:
        return False, "Password must be at least 8 characters long"
    if not any(c.isupper() for c in password):
        return False, "Password must contain at least one uppercase letter"
    if not any(c.islower() for c in password):
        return False, "Password must contain at least one lowercase letter"
    if not any(c.isdigit() for c in password):
        return False, "Password must contain at least one digit"
    if not any(c in "!@#$%^&*()_+-=[]{}|;:,.<>?" for c in password):
        return False, "Password must contain at least one special character"
    return True, "Password meets requirements"


# ============================================================================
# JWT Token Management
# ============================================================================

def create_access_token(
    subject: str,
    user_data: Dict[str, Any],
    expires_delta: Optional[timedelta] = None
) -> str:
    """
    Create a JWT access token
    OWASP A01: Broken Access Control - Proper token-based access control
    """
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode = {
        "sub": subject,
        "exp": expire,
        "iat": datetime.now(timezone.utc),
        "type": "access",
        **user_data
    }
    
    encoded_jwt = jwt.encode(
        to_encode,
        settings.JWT_SECRET_KEY,
        algorithm=settings.JWT_ALGORITHM
    )
    return encoded_jwt


def create_refresh_token(
    subject: str,
    expires_delta: Optional[timedelta] = None
) -> str:
    """
    Create a JWT refresh token with longer expiry
    """
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    
    to_encode = {
        "sub": subject,
        "exp": expire,
        "iat": datetime.now(timezone.utc),
        "type": "refresh",
        "jti": secrets.token_urlsafe(16)  # Unique token ID for revocation
    }
    
    encoded_jwt = jwt.encode(
        to_encode,
        settings.JWT_REFRESH_SECRET_KEY,
        algorithm=settings.JWT_ALGORITHM
    )
    return encoded_jwt


def decode_access_token(token: str) -> Dict[str, Any]:
    """
    Decode and validate access token
    Raises TokenExpiredError or InvalidTokenError
    """
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM]
        )
        if payload.get("type") != "access":
            raise InvalidTokenError("Invalid token type")
        return payload
    except jwt.ExpiredSignatureError:
        raise TokenExpiredError("Access token has expired")
    except JWTError as e:
        raise InvalidTokenError(f"Invalid access token: {str(e)}")


def decode_refresh_token(token: str) -> Dict[str, Any]:
    """
    Decode and validate refresh token
    """
    try:
        payload = jwt.decode(
            token,
            settings.JWT_REFRESH_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM]
        )
        if payload.get("type") != "refresh":
            raise InvalidTokenError("Invalid token type")
        return payload
    except jwt.ExpiredSignatureError:
        raise TokenExpiredError("Refresh token has expired")
    except JWTError as e:
        raise InvalidTokenError(f"Invalid refresh token: {str(e)}")


# ============================================================================
# CSRF Protection
# ============================================================================

def generate_csrf_token(session_id: str) -> str:
    """
    Generate a CSRF token tied to user session
    OWASP A08: Software Integrity - CSRF protection
    """
    return csrf_serializer.dumps(session_id)


def validate_csrf_token(token: str, expected_session_id: str) -> bool:
    """
    Validate CSRF token
    Returns True if valid, False otherwise
    """
    try:
        session_id = csrf_serializer.loads(
            token,
            max_age=settings.CSRF_TOKEN_EXPIRE_MINUTES * 60
        )
        return hmac.compare_digest(session_id, expected_session_id)
    except (BadSignature, SignatureExpired):
        return False


# ============================================================================
# API Key Management
# ============================================================================

def generate_api_key(prefix: Optional[str] = None) -> Tuple[str, str]:
    """
    Generate a new API key
    Returns (full_key, hashed_key)
    """
    if prefix is None:
        prefix = settings.API_KEY_PREFIX
    
    # Generate random key
    key_bytes = secrets.token_bytes(settings.API_KEY_LENGTH)
    key_hex = key_bytes.hex()
    full_key = f"{prefix}{key_hex}"
    
    # Hash for storage
    hashed_key = hash_api_key(full_key)
    
    return full_key, hashed_key


def hash_api_key(api_key: str) -> str:
    """
    Hash an API key using SHA-256 for fast lookup
    Note: API keys are randomly generated, so bcrypt is not necessary
    """
    return hashlib.sha256(api_key.encode()).hexdigest()


def get_key_prefix(api_key: str) -> str:
    """
    Get the prefix of an API key for display purposes
    """
    return api_key[:12] if len(api_key) >= 12 else api_key


# ============================================================================
# Session Management
# ============================================================================

def generate_session_id() -> str:
    """
    Generate a secure session ID
    """
    return secrets.token_urlsafe(32)


# ============================================================================
# Input Sanitization
# ============================================================================

def sanitize_input(value: str, max_length: int = 10000) -> str:
    """
    Sanitize user input to prevent injection attacks
    OWASP A03: Injection
    """
    if not value:
        return ""
    
    # Truncate to max length
    value = value[:max_length]
    
    # Remove null bytes
    value = value.replace('\x00', '')
    
    return value


def validate_uuid(uuid_string: str) -> bool:
    """
    Validate UUID format
    """
    try:
        UUID(uuid_string)
        return True
    except (ValueError, AttributeError):
        return False


# ============================================================================
# Rate Limiting Helpers
# ============================================================================

def get_rate_limit_key(identifier: str, window: str = "minute") -> str:
    """
    Generate a rate limit key for Redis
    """
    now = datetime.now(timezone.utc)
    
    if window == "minute":
        time_key = now.strftime("%Y%m%d%H%M")
    elif window == "hour":
        time_key = now.strftime("%Y%m%d%H")
    elif window == "day":
        time_key = now.strftime("%Y%m%d")
    else:
        time_key = now.strftime("%Y%m%d%H%M")
    
    return f"rate_limit:{identifier}:{window}:{time_key}"


# ============================================================================
# Security Headers
# ============================================================================

SECURITY_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "X-XSS-Protection": "1; mode=block",
    "Strict-Transport-Security": f"max-age={settings.HSTS_MAX_AGE}; includeSubDomains",
    "Content-Security-Policy": settings.CONTENT_SECURITY_POLICY,
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "geolocation=(), microphone=(), camera=()",
    "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
    "Pragma": "no-cache"
}
