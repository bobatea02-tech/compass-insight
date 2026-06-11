"""Async Redis cache wrapper with graceful degradation."""

import json
import logging
import os
from typing import Any

import redis.asyncio as redis

logger = logging.getLogger(__name__)

_redis_client: redis.Redis | None = None


def _get_client() -> redis.Redis:
    """Return the shared async Redis client, creating it on first use."""
    global _redis_client
    if _redis_client is None:
        _redis_client = redis.from_url(os.environ["REDIS_URL"], decode_responses=True)
    return _redis_client


async def get_cached(key: str) -> Any | None:
    """Retrieve and deserialize a cached value, returning None on miss or error."""
    try:
        raw = await _get_client().get(key)
        if raw is None:
            return None
        return json.loads(raw)
    except Exception as exc:
        logger.warning("Redis GET failed key=%s error=%s", key, exc)
        return None


async def set_cached(key: str, value: Any, ttl: int = 21600) -> None:
    """Serialize and store a value in Redis with the given TTL."""
    try:
        await _get_client().set(key, json.dumps(value), ex=ttl)
    except Exception as exc:
        logger.warning("Redis SET failed key=%s error=%s", key, exc)


async def ping_redis() -> bool:
    """Ping Redis and return True if the connection is healthy."""
    try:
        await _get_client().ping()
        return True
    except Exception as exc:
        logger.warning("Redis ping failed error=%s", exc)
        return False
