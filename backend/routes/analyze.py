"""Analysis routes — manifest parsing and WebSocket analysis pipeline."""

import asyncio
import json
import logging
import uuid

from fastapi import APIRouter, File, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse

from agents.orchestrator import analyse_package
from agents.report_generator import generate_report_stream
from core.database import save_analysis
from core.github_client import GitHubRateLimitError

logger = logging.getLogger(__name__)

router = APIRouter()


def parse_manifest(content: str, filename: str) -> tuple[list[str], str]:
    """Parse requirements.txt or package.json into (package_names, ecosystem)."""
    packages: list[str] = []
    ecosystem = "pypi"

    try:
        if filename.endswith("package.json"):
            ecosystem = "npm"
            data = json.loads(content)
            deps = {
                **data.get("dependencies", {}),
                **data.get("devDependencies", {}),
            }
            packages = list(deps.keys())

        else:
            for line in content.splitlines():
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                pkg = (
                    line.split(">=")[0]
                    .split("==")[0]
                    .split("<=")[0]
                    .split("~=")[0]
                    .split("!=")[0]
                    .split("[")[0]
                    .split(">")[0]
                    .split("<")[0]
                    .strip()
                )
                if pkg:
                    packages.append(pkg)
    except Exception:
        pass

    return packages, ecosystem


@router.post("/analyze/parse")
async def parse_upload(file: UploadFile = File(...)):
    """Validate and parse an uploaded manifest file."""
    if not file.filename or not file.filename.endswith((".txt", ".json")):
        return JSONResponse(
            status_code=400,
            content={"detail": "Only .txt and .json files accepted"},
        )

    content = (await file.read()).decode("utf-8", errors="ignore")
    if not content.strip():
        return JSONResponse(status_code=422, content={"detail": "File is empty"})

    packages, ecosystem = parse_manifest(content, file.filename)
    capped = len(packages) > 25
    packages = packages[:25]

    return {
        "filename": file.filename,
        "ecosystem": ecosystem,
        "packages": packages,
        "package_count": len(packages),
        "capped": capped,
        "cap_limit": 25,
    }


@router.websocket("/ws/analyze")
async def analyze_websocket(websocket: WebSocket):
    """Main analysis WebSocket — streams per-package results and report tokens."""
    await websocket.accept()

    try:
        data = await websocket.receive_json()
        content = data.get("content", "")
        filename = data.get("filename", "requirements.txt")

        if not content.strip():
            await websocket.send_json(
                {
                    "type": "error",
                    "message": "Empty file content",
                    "code": "MANIFEST_PARSE_ERROR",
                }
            )
            return

        packages, ecosystem = parse_manifest(content, filename)
        if not packages:
            await websocket.send_json(
                {
                    "type": "error",
                    "message": "No packages found in manifest",
                    "code": "NO_PACKAGES_FOUND",
                }
            )
            return

        packages = packages[:25]

        await websocket.send_json(
            {
                "type": "start",
                "total": len(packages),
                "packages": packages,
            }
        )

        results: dict[str, dict] = {}
        high_risk: list[tuple[str, dict]] = []
        at_risk: list[tuple[str, dict]] = []
        semaphore = asyncio.Semaphore(5)
        package_indices = {pkg: idx + 1 for idx, pkg in enumerate(packages)}

        async def analyse_one(pkg: str) -> None:
            async with semaphore:
                await websocket.send_json(
                    {
                        "type": "progress",
                        "package": pkg,
                        "current": package_indices[pkg],
                        "total": len(packages),
                    }
                )

                result = await analyse_package(pkg, ecosystem)
                results[pkg] = result

                await websocket.send_json(
                    {
                        "type": "package_result",
                        "package": pkg,
                        "result": result,
                    }
                )

                risk_class = result.get("risk_class", "Unknown")
                if risk_class == "Dying":
                    high_risk.append((pkg, result))
                elif risk_class == "At Risk":
                    at_risk.append((pkg, result))

        await asyncio.gather(*[analyse_one(pkg) for pkg in packages])

        await websocket.send_json(
            {
                "type": "generating_report",
                "message": "Generating dependency health report...",
            }
        )

        async for token in generate_report_stream(
            manifest_name=filename,
            package_count=len(packages),
            high_risk=high_risk,
            at_risk=at_risk,
        ):
            await websocket.send_json({"type": "report_token", "token": token})

        healthy = sum(
            1 for r in results.values() if r.get("risk_class") == "Healthy"
        )
        dying = sum(1 for r in results.values() if r.get("risk_class") == "Dying")
        at_risk_count = sum(
            1 for r in results.values() if r.get("risk_class") == "At Risk"
        )
        skipped = sum(
            1 for r in results.values() if r.get("risk_class") == "Unknown"
        )

        analysis_id = str(uuid.uuid4())

        await websocket.send_json(
            {
                "type": "complete",
                "summary": {
                    "total_analyzed": len(packages),
                    "healthy": healthy,
                    "at_risk": at_risk_count,
                    "dying": dying,
                    "skipped": skipped,
                    "analysis_id": analysis_id,
                },
            }
        )

        try:
            await save_analysis(
                filename,
                ecosystem,
                len(packages),
                healthy,
                at_risk_count,
                dying,
                skipped,
                results,
            )
        except Exception as exc:
            logger.warning("Failed to save analysis: %s", exc)

    except WebSocketDisconnect:
        pass
    except GitHubRateLimitError:
        try:
            await websocket.send_json(
                {
                    "type": "error",
                    "message": "GitHub API rate limit exceeded. Please try again later.",
                    "code": "GITHUB_RATE_LIMITED",
                }
            )
        except Exception:
            pass
    except Exception as exc:
        try:
            await websocket.send_json(
                {
                    "type": "error",
                    "message": str(exc),
                    "code": "UNKNOWN_ERROR",
                }
            )
        except Exception:
            pass
