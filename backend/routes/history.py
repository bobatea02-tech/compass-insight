"""History routes — past analysis retrieval."""

import logging

from fastapi import APIRouter

from core.database import get_history

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/history")
async def history():
    """Return the last 10 completed analyses with per-package summaries."""
    try:
        analyses = await get_history()
        return {"analyses": analyses}
    except Exception as exc:
        logger.warning("History retrieval failed error=%s", exc)
        return {"analyses": []}
