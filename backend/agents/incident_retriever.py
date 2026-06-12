"""Incident Retriever agent — semantic search over postmortem corpus."""

import logging

from core.vector_store import corpus_size, search_incidents

logger = logging.getLogger(__name__)


def retrieve_incidents(
    package_name: str,
    risk_signals: list[str],
    n_results: int = 3,
) -> list[dict]:
    """Search incident postmortem corpus for incidents relevant to this package and its top risk signals."""
    if corpus_size() == 0:
        return []

    signal_text = " ".join(risk_signals[:2])
    query = f"{package_name} {signal_text} production incident outage abandoned"

    try:
        return search_incidents(query, n_results)
    except Exception as exc:
        logger.warning("Incident retrieval failed for %s: %s", package_name, exc)
        return []
