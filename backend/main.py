"""Compass FastAPI application entry point."""

import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path

import chromadb
from dotenv import load_dotenv
from fastapi import FastAPI, Response
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()

from core.cache import ping_redis
from core.database import init_db, ping_postgres
from routes import analyze, history, package

import gc
gc.collect()  # Force garbage collection after startup

logger = logging.getLogger(__name__)

VERSION = "1.0.0"
MODEL_DIR = Path("ml/models")
MODEL_FILES = [
    MODEL_DIR / "compass_model.joblib",
    MODEL_DIR / "compass_explainer.joblib",
    MODEL_DIR / "feature_names.joblib",
]
CHROMA_PATH = "./chroma_db"
CHROMA_COLLECTION = "incident_postmortems"

_app_state: dict[str, bool] = {
    "model_loaded": False,
    "chromadb_connected": False,
    "redis_connected": False,
    "postgres_connected": False,
}

def _build_cors_origins() -> list[str]:
    """Build the explicit CORS origin allowlist from environment and defaults."""
    origins = [
        "http://localhost:5173",
        "http://localhost:4173",
    ]
    frontend_url = os.environ.get("FRONTEND_URL", "")
    if frontend_url:
        origins.append(frontend_url)
    return origins


def _check_model_files() -> None:
    """Verify all required model artifacts exist, raising if any are missing."""
    missing = [str(path) for path in MODEL_FILES if not path.exists()]
    if missing:
        raise RuntimeError(
            f"Model files not found: {', '.join(missing)}. Run: python ml/train.py"
        )


def _check_chromadb() -> bool:
    """Return True if the incident postmortem ChromaDB collection is available."""
    try:
        client = chromadb.PersistentClient(path=CHROMA_PATH)
        client.get_collection(CHROMA_COLLECTION)
        return True
    except Exception as exc:
        logger.warning("ChromaDB incident corpus not found error=%s", exc)
        return False


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Run startup checks and initialize external dependencies."""
    _check_model_files()
    _app_state["model_loaded"] = True

    _app_state["redis_connected"] = await ping_redis()
    if not _app_state["redis_connected"]:
        logger.warning("Redis unavailable at startup — cache degraded")

    try:
        await init_db()
        _app_state["postgres_connected"] = await ping_postgres()
    except Exception as exc:
        logger.error("Database initialization failed error=%s", exc)
        _app_state["postgres_connected"] = False

    _app_state["chromadb_connected"] = _check_chromadb()

    logger.info("Compass startup complete")
    yield


app = FastAPI(title="Compass API", version=VERSION, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_build_cors_origins(),
    allow_origin_regex=r"https://.*\.lovable\.app",
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
    allow_credentials=False,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:4173",
        "https://*.lovable.app",
        "https://compass-insight.pages.dev/",  # ← add this
        os.environ.get("FRONTEND_URL", ""),
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(analyze.router)
app.include_router(history.router)
app.include_router(package.router)


@app.get("/health")
async def health(response: Response) -> dict:
    """Return health status for all critical and non-critical components."""
    redis_ok = await ping_redis()
    postgres_ok = await ping_postgres()
    chromadb_ok = _check_chromadb()
    model_ok = all(path.exists() for path in MODEL_FILES)

    _app_state["redis_connected"] = redis_ok
    _app_state["postgres_connected"] = postgres_ok
    _app_state["chromadb_connected"] = chromadb_ok
    _app_state["model_loaded"] = model_ok

    critical_ok = model_ok and postgres_ok
    if not critical_ok:
        response.status_code = 503

    return {
        "status": "ok" if critical_ok else "degraded",
        "version": VERSION,
        "model_loaded": model_ok,
        "chromadb_connected": chromadb_ok,
        "redis_connected": redis_ok,
        "postgres_connected": postgres_ok,
    }
