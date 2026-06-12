"""Single-package synchronous analysis route."""

from fastapi import APIRouter, Query
from fastapi.responses import JSONResponse

from agents.orchestrator import analyse_package
from core.github_client import GitHubRateLimitError

router = APIRouter()


@router.get("/package/{package_name}")
async def get_package(
    package_name: str,
    ecosystem: str = Query(default="pypi", pattern="^(pypi|npm)$"),
):
    """Analyze a single package by name and return the full result synchronously."""
    try:
        result = await analyse_package(package_name, ecosystem)
    except GitHubRateLimitError:
        return JSONResponse(
            status_code=503,
            content={
                "detail": "GitHub API is currently unavailable. Try again in a few minutes."
            },
        )

    if result.get("error"):
        return JSONResponse(
            status_code=404,
            content={
                "detail": (
                    f"Package '{package_name}' not found on PyPI or has no GitHub source."
                )
            },
        )

    return {
        "package_name": package_name,
        "github_repo": result.get("github"),
        "risk_score": result.get("risk_score"),
        "risk_class": result.get("risk_class"),
        "risk_color": result.get("risk_color"),
        "confidence": result.get("confidence"),
        "probabilities": result.get("probabilities"),
        "top_signals": result.get("top_signals"),
        "shap_chart_data": result.get("shap_chart_data"),
        "incidents": result.get("incidents", []),
    }
