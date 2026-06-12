"""Orchestrator — coordinates the full per-package analysis pipeline."""

import logging

from agents.incident_retriever import retrieve_incidents
from agents.risk_classifier import classify_package
from agents.signal_collector import collect_signals, resolve_package
from core.github_client import GitHubRateLimitError

logger = logging.getLogger(__name__)


def _error_result(package_name: str, message: str) -> dict:
    """Build a standardized error result dict for a failed package analysis."""
    return {
        "risk_score": None,
        "risk_class": "Unknown",
        "risk_color": None,
        "error": message,
        "github": None,
        "top_signals": [],
        "shap_chart_data": [],
        "incidents": [],
        "confidence": 0,
        "probabilities": {"healthy": 0, "at_risk": 0, "dying": 0},
    }


async def analyse_package(package_name: str, ecosystem: str = "pypi") -> dict:
    """Run the full analysis pipeline for one package, returning a WebSocket-ready result dict."""
    try:
        repo_info = await resolve_package(package_name, ecosystem)
        if not repo_info:
            return _error_result(
                package_name,
                f"No GitHub repository found for {package_name}",
            )

        owner, repo = repo_info

        logger.info("Collecting signals for %s/%s", owner, repo)
        signals = await collect_signals(owner, repo)

        classification = classify_package(signals)

        incidents: list[dict] = []
        if classification.get("risk_score", 0) >= 50:
            top_signal_texts = [
                s.get("human_readable", "")
                for s in classification.get("top_signals", [])[:2]
            ]
            incidents = retrieve_incidents(package_name, top_signal_texts)

        return {
            **classification,
            "github": f"{owner}/{repo}",
            "incidents": incidents,
            "error": None,
        }

    except GitHubRateLimitError:
        raise
    except Exception as exc:
        logger.error("Analysis failed for %s: %s", package_name, exc)
        return _error_result(package_name, str(exc))
