"""Orchestrator — coordinates the full per-package analysis pipeline."""

import logging
from datetime import datetime, timedelta, timezone

import httpx
from sqlalchemy import select

from agents.incident_retriever import retrieve_incidents
from agents.risk_classifier import classify_package
from agents.signal_collector import collect_signals, resolve_package
from core.database import PackageResult, async_session
from core.github_client import GitHubRateLimitError

logger = logging.getLogger(__name__)

_RISK_COLORS = {
    "Healthy": "green",
    "At Risk": "amber",
    "Dying": "red",
    "Unresolved": None,
}


def _parse_iso_datetime(value: str | None) -> datetime | None:
    """Parse an ISO-8601 timestamp into a timezone-aware datetime."""
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


def _days_since(dt: datetime | None) -> float | None:
    """Return days elapsed since dt, or None if dt is missing."""
    if dt is None:
        return None
    now = datetime.now(timezone.utc)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return (now - dt).total_seconds() / 86400


async def get_cached_result(
    package_name: str,
    ecosystem: str,
    max_age_hours: int = 6,
) -> dict | None:
    """Return cached result from PackageResult if analysed within max_age_hours."""
    try:
        cutoff = datetime.now(timezone.utc) - timedelta(hours=max_age_hours)
        async with async_session() as session:
            result = await session.execute(
                select(PackageResult)
                .where(PackageResult.package_name == package_name)
                .where(PackageResult.ecosystem == ecosystem)
                .where(PackageResult.created_at > cutoff)
                .order_by(PackageResult.created_at.desc())
                .limit(1)
            )
            row = result.scalars().first()
            if row:
                risk_class = row.risk_class or "Unresolved"
                return {
                    "risk_score": row.risk_score,
                    "risk_class": risk_class,
                    "risk_color": _RISK_COLORS.get(risk_class),
                    "confidence": float(row.confidence) if row.confidence else 0,
                    "probabilities": {"healthy": 0, "at_risk": 0, "dying": 0},
                    "top_signals": row.top_signals or [],
                    "shap_chart_data": row.shap_chart_data or [],
                    "incidents": row.incidents or [],
                    "github": row.github_repo,
                    "error": None,
                    "cached": True,
                }
    except Exception as exc:
        logger.warning("Cache lookup failed for %s: %s", package_name, exc)
    return None


async def analyse_without_github(package_name: str, ecosystem: str) -> dict:
    """Fallback analysis using registry metadata only."""
    days_since_release: float | None = None
    version: str | None = None
    classifiers: list[str] = []

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            if ecosystem == "npm":
                response = await client.get(
                    f"https://registry.npmjs.org/{package_name}/latest"
                )
                if response.status_code == 404:
                    return _unresolved_result(package_name)
                if response.status_code != 200:
                    return _unresolved_result(package_name)
                data = response.json()
                version = data.get("version")
                modified = data.get("time", {}).get("modified")
                days_since_release = _days_since(_parse_iso_datetime(modified))
            else:
                response = await client.get(
                    f"https://pypi.org/pypi/{package_name}/json"
                )
                if response.status_code == 404:
                    return _unresolved_result(package_name)
                if response.status_code != 200:
                    return _unresolved_result(package_name)
                data = response.json()
                info = data.get("info", {})
                version = info.get("version")
                classifiers = info.get("classifiers") or []
                releases = data.get("releases", {})
                if version and version in releases and releases[version]:
                    upload_time = releases[version][0].get("upload_time")
                    days_since_release = _days_since(_parse_iso_datetime(upload_time))
                elif info.get("upload_time"):
                    days_since_release = _days_since(
                        _parse_iso_datetime(info.get("upload_time"))
                    )
    except Exception as exc:
        logger.warning(
            "Registry fallback failed package=%s error=%s", package_name, exc
        )
        return _unresolved_result(package_name)

    if days_since_release is None:
        return _unresolved_result(package_name)

    if days_since_release > 730:
        risk_class, risk_score, confidence = "Dying", 75, 45.0
    elif days_since_release >= 365:
        risk_class, risk_score, confidence = "At Risk", 55, 40.0
    else:
        risk_class, risk_score, confidence = "Healthy", 15, 35.0

    classifier_note = ""
    if classifiers:
        status = next(
            (c for c in classifiers if c.startswith("Development Status ::")),
            None,
        )
        if status:
            classifier_note = f"; status: {status.split('::')[-1].strip()}"

    signal_text = (
        f"Registry-only analysis: last release v{version} was "
        f"{days_since_release:.0f} days ago{classifier_note}"
    )

    return {
        "risk_score": risk_score,
        "risk_class": risk_class,
        "risk_color": _RISK_COLORS[risk_class],
        "confidence": confidence,
        "probabilities": {"healthy": 0, "at_risk": 0, "dying": 0},
        "top_signals": [
            {
                "feature": "days_since_last_release",
                "value": round(days_since_release, 1),
                "shap_value": 0.0,
                "importance": 0.0,
                "direction": "increases",
                "human_readable": signal_text,
            }
        ],
        "shap_chart_data": [],
        "incidents": [],
        "github": None,
        "error": None,
        "low_confidence": True,
    }


def _unresolved_result(package_name: str) -> dict:
    """Build a result dict for packages with no registry or release data."""
    return {
        "risk_score": None,
        "risk_class": "Unresolved",
        "risk_color": None,
        "confidence": 0,
        "probabilities": {"healthy": 0, "at_risk": 0, "dying": 0},
        "top_signals": [],
        "shap_chart_data": [],
        "incidents": [],
        "github": None,
        "error": f"No registry data found for {package_name}",
        "low_confidence": True,
    }


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
        cached = await get_cached_result(package_name, ecosystem)
        if cached:
            return cached

        repo_info = await resolve_package(package_name, ecosystem)
        if not repo_info:
            return await analyse_without_github(package_name, ecosystem)

        owner, repo = repo_info

        logger.info("Collecting signals for %s/%s", owner, repo)
        signals = await collect_signals(owner, repo)

        classification = classify_package(signals)

        incidents: list[dict] = []
        if classification.get("risk_score", 0) >= 50:
            top_signal_texts = [
                s.get("human_readable", "")
                for s in classification.get("top_signals", [])[:3]
            ]
            incidents = retrieve_incidents(package_name, top_signal_texts)

        return {
            **classification,
            "github": f"{owner}/{repo}",
            "incidents": incidents,
            "error": None,
        }

    except GitHubRateLimitError:
        return {
            "risk_score": None,
            "risk_class": "Unresolved",
            "risk_color": None,
            "error": "GitHub rate limited — retry in 1 hour",
            "error_code": "GITHUB_RATE_LIMITED",
            "github": None,
            "top_signals": [],
            "shap_chart_data": [],
            "incidents": [],
            "confidence": 0,
            "probabilities": {"healthy": 0, "at_risk": 0, "dying": 0},
            "low_confidence": True,
        }
    except Exception as exc:
        logger.error("Analysis failed for %s: %s", package_name, exc)
        return _error_result(package_name, str(exc))
