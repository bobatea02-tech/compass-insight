"""Report Generator agent — LangChain + Gemini streaming dependency health reports."""

import logging
import os
from typing import AsyncGenerator

from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import ChatPromptTemplate
from langchain_google_genai import ChatGoogleGenerativeAI

logger = logging.getLogger(__name__)

llm = ChatGoogleGenerativeAI(
    model="gemini-2.0-flash",
    temperature=0.2,
    google_api_key=os.environ.get("GEMINI_API_KEY"),
)

report_prompt = ChatPromptTemplate.from_messages(
    [
        (
            "system",
            """You are a senior software engineer
writing a dependency health report for a development team.
You are direct, specific, and technical. Never use filler phrases.
Format your response in exactly three sections:

## Executive Summary
Two sentences maximum. State the most critical finding and
overall risk level.

## Package Analysis
One paragraph per high-risk or at-risk package only.
Reference specific behavioral signals. Name exact numbers.
Do not write about healthy packages.

## Recommendations
A numbered list of 3-5 specific, actionable steps.
Each step names a specific package and a specific action.""",
        ),
        (
            "human",
            """Manifest: {manifest_name}
Packages analyzed: {package_count}

HIGH RISK packages (Dying):
{high_risk}

AT RISK packages:
{at_risk}

Write the dependency health report:""",
        ),
    ]
)

report_chain = report_prompt | llm | StrOutputParser()


def format_package_summary(name: str, result: dict) -> str:
    """Format one package result as a summary line for the prompt."""
    signals = result.get("top_signals", [])
    signal_text = "; ".join(s.get("human_readable", "") for s in signals[:2])
    risk_score = result.get("risk_score", 0)
    github = result.get("github", "unknown")
    return f"- {name} (score: {risk_score}/100, repo: {github}): {signal_text}"


async def generate_report_stream(
    manifest_name: str,
    package_count: int,
    high_risk: list[tuple[str, dict]],
    at_risk: list[tuple[str, dict]],
) -> AsyncGenerator[str, None]:
    """Stream the LLM report token by token, falling back to structured text if Gemini fails."""
    high_risk_text = (
        "\n".join(format_package_summary(name, result) for name, result in high_risk)
        or "None"
    )

    at_risk_text = (
        "\n".join(
            format_package_summary(name, result) for name, result in at_risk[:5]
        )
        or "None"
    )

    try:
        async for token in report_chain.astream(
            {
                "manifest_name": manifest_name,
                "package_count": package_count,
                "high_risk": high_risk_text,
                "at_risk": at_risk_text,
            }
        ):
            yield token
    except Exception as exc:
        logger.error("Gemini streaming failed: %s", exc)
        fallback = f"""## Executive Summary
Analysis of {manifest_name} ({package_count} packages) identified
{len(high_risk)} critical and {len(at_risk)} at-risk dependencies.

## Package Analysis
"""
        for name, result in high_risk:
            fallback += f"\n{format_package_summary(name, result)}\n"

        fallback += "\n## Recommendations\n"
        for i, (name, _) in enumerate(high_risk[:3], 1):
            fallback += f"{i}. Evaluate alternatives to {name} immediately.\n"

        yield fallback
