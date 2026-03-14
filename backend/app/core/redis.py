"""
Redis connection and caching utilities for InferX API Platform
Used for:
- Session caching
- Rate limiting
- API key caching
- Request queuing
"""

import json
import logging
from typing import Optional, Any
from datetime import timedelta

from app.core.config import settings

logger = logging.getLogger("inferx.redis")


class MockRedisClient:
    """
    In-memory mock Redis client for development without Redis
    """
    
    def __init__(self):
        self._store: dict = {}
    
    async def get(self, key: str) -> Optional[str]:
        return self._store.get(key)
    
    async def set(self, key: str, value: str, ex: int = None) -> bool:
        self._store[key] = value
        return True
    
    async def delete(self, key: str) -> int:
        if key in self._store:
            del self._store[key]
            return 1
        return 0
    
    async def exists(self, key: str) -> int:
        return 1 if key in self._store else 0
    
    async def expire(self, key: str, seconds: int) -> bool:
        return True
    
    async def incr(self, key: str) -> int:
        val = int(self._store.get(key, 0)) + 1
        self._store[key] = str(val)
        return val
    
    async def incrby(self, key: str, amount: int) -> int:
        val = int(self._store.get(key, 0)) + amount
        self._store[key] = str(val)
        return val
    
    def pipeline(self):
        return MockPipeline(self)
    
    async def ping(self):
        return True
    
    async def close(self):
        pass


class MockPipeline:
    """Mock Redis pipeline"""
    def __init__(self, client: MockRedisClient):
        self._client = client
        self._commands = []
    
    def incr(self, key: str):
        self._commands.append(("incr", key))
        return self
    
    def incrby(self, key: str, amount: int):
        self._commands.append(("incrby", key, amount))
        return self
    
    def expire(self, key: str, seconds: int):
        self._commands.append(("expire", key, seconds))
        return self
    
    async def execute(self):
        results = []
        for cmd in self._commands:
            if cmd[0] == "incr":
                val = await self._client.incr(cmd[1])
                results.append(val)
            elif cmd[0] == "incrby":
                val = await self._client.incrby(cmd[1], cmd[2])
                results.append(val)
            elif cmd[0] == "expire":
                results.append(True)
        return results


class RedisClient:
    """
    Async Redis client wrapper with connection management
    Falls back to in-memory mock if Redis is unavailable
    """
    
    def __init__(self):
        self._client = None
        self._is_mock = False
    
    async def connect(self):
        """Initialize Redis connection, fall back to mock if unavailable"""
        try:
            import redis.asyncio as redis
            self._client = redis.from_url(
                settings.REDIS_URL,
                password=settings.REDIS_PASSWORD,
                db=settings.REDIS_DB,
                encoding="utf-8",
                decode_responses=True,
                max_connections=50,
            )
            await self._client.ping()
            logger.info("Redis connection established")
            self._is_mock = False
        except Exception as e:
            logger.warning(f"Redis unavailable ({e}), using in-memory mock")
            self._client = MockRedisClient()
            self._is_mock = True
    
    async def disconnect(self):
        """Close Redis connection"""
        if self._client:
            await self._client.close()
    
    @property
    def client(self):
        if not self._client:
            raise RuntimeError("Redis client not initialized. Call connect() first.")
        return self._client
    
    # ========================================================================
    # Basic Operations
    # ========================================================================
    
    async def get(self, key: str) -> Optional[str]:
        """Get a value by key"""
        return await self.client.get(key)
    
    async def set(
        self,
        key: str,
        value: str,
        expire: Optional[int] = None
    ) -> bool:
        """Set a value with optional expiration in seconds"""
        return await self.client.set(key, value, ex=expire)
    
    async def delete(self, key: str) -> int:
        """Delete a key"""
        return await self.client.delete(key)
    
    async def exists(self, key: str) -> bool:
        """Check if key exists"""
        return await self.client.exists(key) > 0
    
    async def expire(self, key: str, seconds: int) -> bool:
        """Set expiration on a key"""
        return await self.client.expire(key, seconds)
    
    # ========================================================================
    # JSON Operations
    # ========================================================================
    
    async def get_json(self, key: str) -> Optional[Any]:
        """Get and parse JSON value"""
        value = await self.get(key)
        if value:
            return json.loads(value)
        return None
    
    async def set_json(
        self,
        key: str,
        value: Any,
        expire: Optional[int] = None
    ) -> bool:
        """Serialize and set JSON value"""
        return await self.set(key, json.dumps(value), expire=expire)
    
    # ========================================================================
    # Rate Limiting Operations
    # ========================================================================
    
    async def increment_rate_limit(
        self,
        key: str,
        window_seconds: int = 60
    ) -> int:
        """
        Increment rate limit counter using sliding window
        Returns current count
        """
        pipe = self.client.pipeline()
        pipe.incr(key)
        pipe.expire(key, window_seconds)
        results = await pipe.execute()
        return results[0]
    
    async def get_rate_limit(self, key: str) -> int:
        """Get current rate limit count"""
        value = await self.get(key)
        return int(value) if value else 0
    
    async def check_rate_limit(
        self,
        key: str,
        limit: int,
        window_seconds: int = 60
    ) -> tuple[bool, int]:
        """
        Check if rate limit is exceeded
        Returns (is_allowed, current_count)
        """
        current = await self.increment_rate_limit(key, window_seconds)
        return current <= limit, current
    
    # ========================================================================
    # Session Operations
    # ========================================================================
    
    async def set_session(
        self,
        session_id: str,
        data: dict,
        expire_hours: int = 24
    ) -> bool:
        """Store session data"""
        key = f"session:{session_id}"
        return await self.set_json(key, data, expire=expire_hours * 3600)
    
    async def get_session(self, session_id: str) -> Optional[dict]:
        """Retrieve session data"""
        key = f"session:{session_id}"
        return await self.get_json(key)
    
    async def delete_session(self, session_id: str) -> int:
        """Delete session"""
        key = f"session:{session_id}"
        return await self.delete(key)
    
    # ========================================================================
    # API Key Cache Operations
    # ========================================================================
    
    async def cache_api_key(
        self,
        key_hash: str,
        user_data: dict,
        expire_minutes: int = 15
    ) -> bool:
        """Cache API key lookup result"""
        cache_key = f"api_key:{key_hash}"
        return await self.set_json(cache_key, user_data, expire=expire_minutes * 60)
    
    async def get_cached_api_key(self, key_hash: str) -> Optional[dict]:
        """Get cached API key data"""
        cache_key = f"api_key:{key_hash}"
        return await self.get_json(cache_key)
    
    async def invalidate_api_key_cache(self, key_hash: str) -> int:
        """Invalidate API key cache"""
        cache_key = f"api_key:{key_hash}"
        return await self.delete(cache_key)
    
    # ========================================================================
    # Token Blacklist (for logout)
    # ========================================================================
    
    async def blacklist_token(
        self,
        jti: str,
        expire_seconds: int
    ) -> bool:
        """Add token to blacklist"""
        key = f"blacklist:{jti}"
        return await self.set(key, "1", expire=expire_seconds)
    
    async def is_token_blacklisted(self, jti: str) -> bool:
        """Check if token is blacklisted"""
        key = f"blacklist:{jti}"
        return await self.exists(key)
    
    # ========================================================================
    # Credit Reservation (Optimistic Locking)
    # ========================================================================
    
    async def reserve_credits(
        self,
        user_id: str,
        amount: int,
        request_id: str,
        expire_seconds: int = 300
    ) -> bool:
        """Reserve credits for a request"""
        key = f"credit_reserve:{user_id}:{request_id}"
        return await self.set(key, str(amount), expire=expire_seconds)
    
    async def release_credit_reservation(
        self,
        user_id: str,
        request_id: str
    ) -> int:
        """Release credit reservation after processing"""
        key = f"credit_reserve:{user_id}:{request_id}"
        return await self.delete(key)


# Singleton instance
redis_client = RedisClient()


async def get_redis() -> RedisClient:
    """Dependency for getting Redis client"""
    return redis_client
