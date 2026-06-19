"""Incident Retriever agent — semantic search over postmortem corpus."""

import logging
from urllib.parse import urlparse

from core.vector_store import corpus_size, search_incidents

logger = logging.getLogger(__name__)

_SOURCE_TITLES: dict[str, str] = {
    "blog.cloudflare.com": "Cloudflare Engineering Blog",
    "github.blog": "GitHub Blog",
    "netflixtechblog.com": "Netflix Tech Blog",
    "aws.amazon.com": "AWS Blog",
    "cloud.google.com": "Google Cloud Blog",
    "engineering.fb.com": "Meta Engineering Blog",
    "dropbox.tech": "Dropbox Tech Blog",
    "stripe.com": "Stripe Engineering Blog",
}


def _extract_source_title(source_url: str) -> str:
    """Derive a human-readable title from an incident source URL."""
    if not source_url:
        return "Unknown Source"

    parsed = urlparse(source_url)
    domain = parsed.netloc.lower().replace("www.", "")

    if domain in _SOURCE_TITLES:
        return _SOURCE_TITLES[domain]

    for key, title in _SOURCE_TITLES.items():
        if domain == key or domain.endswith(f".{key}"):
            return title

    if "cloudflare" in domain:
        return "Cloudflare Engineering Blog"
    if "github" in domain:
        return "GitHub Blog"
    if "amazon" in domain or domain.startswith("aws."):
        return "AWS Blog"
    if "netflix" in domain:
        return "Netflix Tech Blog"

    label = domain.split(".")[0] if "." in domain else domain
    return label.replace("-", " ").title()


def retrieve_incidents(
    package_name: str,
    risk_signals: list[str],
    n_results: int = 3,
) -> list[dict]:
    """Search incident postmortem corpus for incidents relevant to this package and its top risk signals."""
    if corpus_size() == 0:
        return []

    query = (
        f"{package_name} "
        f"{' '.join(risk_signals[:3])} "
        f"production incident outage abandoned "
        f"dependency failure"
    )

    try:
        results = search_incidents(query, n_results)
        enriched: list[dict] = []
        for item in results:
            if item.get("similarity", 0) <= 0.40:
                continue
            source_url = item.get("source_url", "")
            enriched.append(
                {
                    **item,
                    "source_title": _extract_source_title(source_url),
                }
            )
        return enriched
    except Exception as exc:
        logger.warning("Incident retrieval failed for %s: %s", package_name, exc)
        return []
