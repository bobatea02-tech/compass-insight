"""SQLAlchemy async database models and persistence helpers."""

import logging
import os
import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import Integer, Numeric, String, Text, TIMESTAMP, select, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy.pool import NullPool

logger = logging.getLogger(__name__)

def _prepared_statement_name() -> str:
    """Generate unique prepared statement names for pgbouncer compatibility."""
    return f"__asyncpg_{uuid.uuid4()}__"


engine = create_async_engine(
    os.environ["DATABASE_URL"],
    echo=False,
    poolclass=NullPool,
    connect_args={
        "statement_cache_size": 0,
        "prepared_statement_name_func": _prepared_statement_name,
    },
)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    """Declarative base for all Compass ORM models."""


class Analysis(Base):
    """Persisted manifest analysis summary."""

    __tablename__ = "analyses"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    manifest_name: Mapped[str] = mapped_column(String(255), nullable=False)
    ecosystem: Mapped[str] = mapped_column(String(10), nullable=False)
    package_count: Mapped[int] = mapped_column(Integer, nullable=False)
    healthy_count: Mapped[int] = mapped_column(Integer, default=0)
    at_risk_count: Mapped[int] = mapped_column(Integer, default=0)
    dying_count: Mapped[int] = mapped_column(Integer, default=0)
    skipped_count: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), default=datetime.utcnow
    )


class PackageResult(Base):
    """Per-package risk classification result linked to an analysis."""

    __tablename__ = "package_results"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    analysis_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    package_name: Mapped[str] = mapped_column(String(255), nullable=False)
    github_repo: Mapped[str | None] = mapped_column(String(255))
    ecosystem: Mapped[str] = mapped_column(String(10), nullable=False)
    risk_score: Mapped[int | None] = mapped_column(Integer)
    risk_class: Mapped[str | None] = mapped_column(String(20))
    confidence: Mapped[float | None] = mapped_column(Numeric(5, 2))
    top_signals: Mapped[dict | None] = mapped_column(JSONB)
    shap_chart_data: Mapped[list | None] = mapped_column(JSONB)
    incidents: Mapped[list | None] = mapped_column(JSONB)
    raw_features: Mapped[dict | None] = mapped_column(JSONB)
    error_message: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), default=datetime.utcnow
    )


async def init_db() -> None:
    """Create all database tables if they do not already exist."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def ping_postgres() -> bool:
    """Return True if the database connection is healthy."""
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        return True
    except Exception as exc:
        logger.warning("PostgreSQL ping failed error=%s", exc)
        return False


async def save_analysis(
    manifest_name: str,
    ecosystem: str,
    package_count: int,
    healthy_count: int,
    at_risk_count: int,
    dying_count: int,
    skipped_count: int,
    results: dict,
) -> None:
    """Save analysis results to PostgreSQL."""
    async with async_session() as session:
        analysis = Analysis(
            manifest_name=manifest_name,
            ecosystem=ecosystem,
            package_count=package_count,
            healthy_count=healthy_count,
            at_risk_count=at_risk_count,
            dying_count=dying_count,
            skipped_count=skipped_count,
        )
        session.add(analysis)
        await session.flush()

        for pkg_name, result in results.items():
            if result.get("error"):
                continue
            session.add(
                PackageResult(
                    analysis_id=analysis.id,
                    package_name=pkg_name,
                    github_repo=result.get("github"),
                    ecosystem=ecosystem,
                    risk_score=result.get("risk_score"),
                    risk_class=result.get("risk_class"),
                    confidence=result.get("confidence"),
                    top_signals=result.get("top_signals"),
                    shap_chart_data=result.get("shap_chart_data"),
                    incidents=result.get("incidents"),
                )
            )

        await session.commit()


async def get_history() -> list[dict[str, Any]]:
    """Return the last 10 completed analyses with summary metadata."""
    async with async_session() as session:
        result = await session.execute(
            select(Analysis).order_by(Analysis.created_at.desc()).limit(10)
        )
        analyses = result.scalars().all()

        history: list[dict[str, Any]] = []
        for analysis in analyses:
            pkg_result = await session.execute(
                select(PackageResult).where(
                    PackageResult.analysis_id == analysis.id
                )
            )
            packages = list(pkg_result.scalars().all())

            top_dying_package: str | None = None
            top_dying_score: int | None = None
            dying_packages = [
                p for p in packages if p.risk_class == "Dying" and p.risk_score
            ]
            if dying_packages:
                top = max(dying_packages, key=lambda p: p.risk_score or 0)
                top_dying_package = top.package_name
                top_dying_score = top.risk_score

            history.append(
                {
                    "id": str(analysis.id),
                    "manifest_name": analysis.manifest_name,
                    "ecosystem": analysis.ecosystem,
                    "package_count": analysis.package_count,
                    "healthy_count": analysis.healthy_count,
                    "at_risk_count": analysis.at_risk_count,
                    "dying_count": analysis.dying_count,
                    "created_at": analysis.created_at.isoformat(),
                    "top_dying_package": top_dying_package,
                    "top_dying_score": top_dying_score,
                }
            )

        return history


async def get_analysis_by_id(analysis_id: str) -> dict[str, Any] | None:
    """Return full package-level results for a single analysis run."""
    try:
        analysis_uuid = uuid.UUID(analysis_id)
    except ValueError:
        return None

    async with async_session() as session:
        result = await session.execute(
            select(Analysis).where(Analysis.id == analysis_uuid)
        )
        analysis = result.scalars().first()
        if not analysis:
            return None

        pkg_result = await session.execute(
            select(PackageResult).where(PackageResult.analysis_id == analysis.id)
        )
        packages = [
            {
                "package_name": pkg.package_name,
                "github_repo": pkg.github_repo,
                "risk_score": pkg.risk_score,
                "risk_class": pkg.risk_class,
                "confidence": float(pkg.confidence) if pkg.confidence else None,
                "top_signals": pkg.top_signals,
                "shap_chart_data": pkg.shap_chart_data,
                "incidents": pkg.incidents,
            }
            for pkg in pkg_result.scalars().all()
        ]

        return {
            "id": str(analysis.id),
            "manifest_name": analysis.manifest_name,
            "ecosystem": analysis.ecosystem,
            "package_count": analysis.package_count,
            "healthy_count": analysis.healthy_count,
            "at_risk_count": analysis.at_risk_count,
            "dying_count": analysis.dying_count,
            "skipped_count": analysis.skipped_count,
            "created_at": analysis.created_at.isoformat(),
            "packages": packages,
        }
