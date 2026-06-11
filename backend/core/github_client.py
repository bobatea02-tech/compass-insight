"""Async GitHub API client with Redis caching and retry logic."""

import asyncio
import hashlib
import logging
import os
import httpx

from core.cache import get_cached, set_cached

logger = logging.getLogger(__name__)

GITHUB_API_BASE = "https://api.github.com"
CACHE_TTL = 21600
MAX_RETRIES = 3


class GitHubRateLimitError(Exception):
    """Raised when the GitHub API returns 403 (rate limit exceeded)."""


def _cache_key(path: str, params: dict | None) -> str:
    """Build a namespaced Redis cache key from the request path and params."""
    digest = hashlib.md5(f"{path}{params}".encode()).hexdigest()
    return f"gh:{digest}"


async def github_get(
    client: httpx.AsyncClient,
    path: str,
    params: dict | None = None,
) -> dict | list:
    """Make a cached, retried GET request to the GitHub API."""
    cache_key = _cache_key(path, params)
    cached = await get_cached(cache_key)
    if cached is not None:
        return cached

    token = os.environ["GITHUB_TOKEN"]
    headers = {
        "Authorization": f"token {token}",
        "Accept": "application/vnd.github+json",
    }
    url = f"{GITHUB_API_BASE}{path}"

    for attempt in range(1, MAX_RETRIES + 1):
        try:
            response = await client.get(url, params=params, headers=headers)
        except Exception as exc:
            logger.error("GitHub request failed path=%s error=%s", path, exc)
            raise

        if response.status_code == 202:
            if attempt < MAX_RETRIES:
                logger.warning(
                    "202 on stats endpoint, retrying attempt=%d path=%s",
                    attempt,
                    path,
                )
                await asyncio.sleep(2**attempt)
                continue
            logger.warning("202 persisted after retries path=%s", path)
            return {}

        if response.status_code == 404:
            return {}

        if response.status_code == 403:
            raise GitHubRateLimitError(f"GitHub rate limit exceeded for {path}")

        response.raise_for_status()
        data: dict | list = response.json()
        await set_cached(cache_key, data, ttl=CACHE_TTL)
        return data

    return {}
