"""History routes — past analysis retrieval."""

import logging

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from core.database import get_analysis_by_id, get_history

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/history")
async def history():
    """Return the last 10 completed analyses with summary metadata."""
    try:
        analyses = await get_history()
        return {"analyses": analyses}
    except Exception as exc:
        logger.warning("History retrieval failed error=%s", exc)
        return {"analyses": []}


@router.get("/history/{analysis_id}")
async def history_detail(analysis_id: str):
    """Return full package-level results for one analysis run."""
    try:
        analysis = await get_analysis_by_id(analysis_id)
        if not analysis:
            return JSONResponse(
                status_code=404,
                content={"detail": f"Analysis '{analysis_id}' not found"},
            )
        return analysis
    except Exception as exc:
        logger.warning("History detail failed error=%s", exc)
        return JSONResponse(
            status_code=404,
            content={"detail": "Analysis not found"},
        )
