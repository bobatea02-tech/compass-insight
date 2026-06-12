"""Signal Collector agent — resolves packages and computes 18 GitHub behavioral features."""

import asyncio
import logging
import re
from datetime import datetime, timezone

import httpx
import numpy as np
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer

from core.github_client import github_get
from ml.features import FEATURE_NAMES

logger = logging.getLogger(__name__)

_analyzer = SentimentIntensityAnalyzer()

FRUSTRATION_KEYWORDS = [
    "fix broken",
    "hotfix",
    "revert",
    "regression",
    "again",
    "still broken",
    "critical fix",
    "emergency",
    "workaround",
    "bandaid",
]

DEFAULTS: dict[str, float] = {
    "commit_freq_mean_52w": 0.0,
    "commit_freq_trend_slope": 0.0,
    "commit_gap_max_days": 365.0,
    "zero_commit_weeks_ratio": 1.0,
    "commit_msg_sentiment_mean": 0.0,
    "commit_msg_sentiment_trend": 0.0,
    "commit_frustration_ratio": 0.0,
    "top_contributor_pct": 100.0,
    "active_contributors_90d": 0.0,
    "open_closed_ratio": 1.0,
    "unresponded_issue_ratio": 1.0,
    "pr_merge_rate": 0.0,
    "stale_pr_ratio": 1.0,
    "days_since_last_release": 365.0,
    "release_freq_trend_slope": 0.0,
    "repo_age_days": 365.0,
    "is_archived": 0.0,
    "days_since_maintainer_comment": 365.0,
}

_GITHUB_URL_PATTERN = re.compile(
    r"github\.com[/:]([\w.-]+)/([\w.-]+?)(?:\.git)?(?:[/\?#]|$)"
)


def _parse_github_url(url: str) -> tuple[str, str] | None:
    """Extract (owner, repo) from a GitHub URL string."""
    if not url:
        return None
    match = _GITHUB_URL_PATTERN.search(url.strip())
    if not match:
        return None
    owner, repo = match.group(1), match.group(2)
    return owner, repo.rstrip("/")


def _find_github_url_in_values(values: list | dict | str | None) -> str | None:
    """Search nested structures for the first GitHub repository URL."""
    if values is None:
        return None
    if isinstance(values, str):
        return values if "github.com" in values.lower() else None
    if isinstance(values, dict):
        for value in values.values():
            found = _find_github_url_in_values(value)
            if found:
                return found
        return None
    if isinstance(values, list):
        for item in values:
            found = _find_github_url_in_values(item)
            if found:
                return found
    return None


def _parse_iso_datetime(value: str | None) -> datetime | None:
    """Parse an ISO-8601 timestamp into a timezone-aware datetime."""
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


def _days_since(dt: datetime | None, now: datetime | None = None) -> float:
    """Return the number of days elapsed since the given datetime."""
    if dt is None:
        return 365.0
    now = now or datetime.now(timezone.utc)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return max(0.0, (now - dt).total_seconds() / 86400)


def _default_signals() -> dict[str, float]:
    """Return a copy of default feature values in FEATURE_NAMES order."""
    return {name: DEFAULTS[name] for name in FEATURE_NAMES}


async def resolve_package(name: str, ecosystem: str) -> tuple[str, str] | None:
    """Resolve a package name to GitHub (owner, repo), or None if not found."""
    async with httpx.AsyncClient(timeout=10) as client:
        try:
            if ecosystem == "pypi":
                response = await client.get(f"https://pypi.org/pypi/{name}/json")
                if response.status_code == 404:
                    return None
                response.raise_for_status()
                data = response.json()
                project_urls = data.get("info", {}).get("project_urls") or {}
                github_url = _find_github_url_in_values(project_urls)
                if not github_url:
                    home_page = data.get("info", {}).get("home_page", "")
                    github_url = home_page if "github.com" in home_page.lower() else None
            elif ecosystem == "npm":
                response = await client.get(
                    f"https://registry.npmjs.org/{name}/latest"
                )
                if response.status_code == 404:
                    return None
                response.raise_for_status()
                data = response.json()
                repository = data.get("repository")
                if isinstance(repository, dict):
                    github_url = repository.get("url", "")
                else:
                    github_url = str(repository) if repository else ""
            else:
                return None

            if not github_url:
                return None
            return _parse_github_url(github_url)
        except Exception as exc:
            logger.warning(
                "Package resolution failed package=%s ecosystem=%s error=%s",
                name,
                ecosystem,
                exc,
            )
            return None


def _compute_commit_features(
    commit_activity: list | dict,
    commits: list | dict,
) -> dict[str, float]:
    """Compute commit-frequency features from GitHub commit activity and commits."""
    features: dict[str, float] = {}

    weeks: list[int] = []
    if isinstance(commit_activity, list) and commit_activity:
        recent = commit_activity[-52:] if len(commit_activity) >= 52 else commit_activity
        weeks = [int(w.get("total", 0) or 0) for w in recent if isinstance(w, dict)]

    if weeks:
        features["commit_freq_mean_52w"] = float(np.mean(weeks))
        features["zero_commit_weeks_ratio"] = float(
            sum(1 for w in weeks if w == 0) / max(len(weeks), 1)
        )
        if len(weeks) >= 2:
            x = np.arange(len(weeks), dtype=float)
            features["commit_freq_trend_slope"] = float(np.polyfit(x, weeks, 1)[0])
        else:
            features["commit_freq_trend_slope"] = 0.0
    else:
        features["commit_freq_mean_52w"] = DEFAULTS["commit_freq_mean_52w"]
        features["commit_freq_trend_slope"] = DEFAULTS["commit_freq_trend_slope"]
        features["zero_commit_weeks_ratio"] = DEFAULTS["zero_commit_weeks_ratio"]

    commit_dates: list[datetime] = []
    if isinstance(commits, list):
        for item in commits:
            if not isinstance(item, dict):
                continue
            commit_obj = item.get("commit", {})
            author = commit_obj.get("author", {}) if isinstance(commit_obj, dict) else {}
            date_str = author.get("date") if isinstance(author, dict) else None
            parsed = _parse_iso_datetime(date_str)
            if parsed:
                commit_dates.append(parsed)

    if len(commit_dates) >= 2:
        commit_dates.sort()
        gaps = [
            (commit_dates[i + 1] - commit_dates[i]).total_seconds() / 86400
            for i in range(len(commit_dates) - 1)
        ]
        features["commit_gap_max_days"] = float(max(gaps))
    else:
        features["commit_gap_max_days"] = DEFAULTS["commit_gap_max_days"]

    return features


def _compute_sentiment_features(commits: list | dict) -> dict[str, float]:
    """Compute VADER sentiment features from commit messages."""
    messages: list[str] = []
    if isinstance(commits, list):
        for item in commits:
            if not isinstance(item, dict):
                continue
            commit_obj = item.get("commit", {})
            message = commit_obj.get("message", "") if isinstance(commit_obj, dict) else ""
            if message:
                messages.append(str(message))

    messages = messages[:100]
    if not messages:
        return {
            "commit_msg_sentiment_mean": DEFAULTS["commit_msg_sentiment_mean"],
            "commit_msg_sentiment_trend": DEFAULTS["commit_msg_sentiment_trend"],
            "commit_frustration_ratio": DEFAULTS["commit_frustration_ratio"],
        }

    scores = [_analyzer.polarity_scores(m)["compound"] for m in messages]
    frustration_count = sum(
        1
        for m in messages
        if any(kw in m.lower() for kw in FRUSTRATION_KEYWORDS)
    )

    features: dict[str, float] = {
        "commit_msg_sentiment_mean": float(np.mean(scores)),
        "commit_frustration_ratio": float(frustration_count / len(messages)),
    }

    if len(scores) >= 50:
        recent = scores[:25]
        older = scores[25:50]
        features["commit_msg_sentiment_trend"] = float(np.mean(recent) - np.mean(older))
    elif len(scores) >= 2:
        mid = len(scores) // 2
        features["commit_msg_sentiment_trend"] = float(
            np.mean(scores[:mid]) - np.mean(scores[mid:])
        )
    else:
        features["commit_msg_sentiment_trend"] = 0.0

    return features


def _compute_contributor_features(
    contributors: list | dict,
    commits: list | dict,
) -> dict[str, float]:
    """Compute contributor concentration and recent activity features."""
    top_pct = DEFAULTS["top_contributor_pct"]
    if isinstance(contributors, list) and contributors:
        counts = [
            int(c.get("contributions", 0) or 0)
            for c in contributors
            if isinstance(c, dict)
        ]
        total = sum(counts)
        if total > 0:
            top_pct = float(max(counts) / total * 100)

    active_90d = 0.0
    now = datetime.now(timezone.utc)
    cutoff = now.timestamp() - 90 * 86400
    authors: set[str] = set()

    if isinstance(commits, list):
        for item in commits:
            if not isinstance(item, dict):
                continue
            author = item.get("author") or {}
            login = author.get("login") if isinstance(author, dict) else None
            commit_obj = item.get("commit", {})
            author_info = (
                commit_obj.get("author", {}) if isinstance(commit_obj, dict) else {}
            )
            date_str = author_info.get("date") if isinstance(author_info, dict) else None
            parsed = _parse_iso_datetime(date_str)
            if parsed and parsed.timestamp() >= cutoff:
                name = login or author_info.get("name", "")
                if name:
                    authors.add(str(name))

    active_90d = float(len(authors))

    return {
        "top_contributor_pct": top_pct,
        "active_contributors_90d": active_90d,
    }


def _filter_issues(issues: list | dict) -> list[dict]:
    """Return issue items only, excluding pull requests masquerading as issues."""
    if not isinstance(issues, list):
        return []
    return [
        item
        for item in issues
        if isinstance(item, dict) and "pull_request" not in item
    ]


def _compute_issue_features(
    open_issues: list | dict,
    closed_issues: list | dict,
) -> dict[str, float]:
    """Compute open/closed and unresponded issue ratios."""
    open_list = _filter_issues(open_issues)
    closed_list = _filter_issues(closed_issues)
    total = len(open_list) + len(closed_list)

    if total == 0:
        return {
            "open_closed_ratio": DEFAULTS["open_closed_ratio"],
            "unresponded_issue_ratio": DEFAULTS["unresponded_issue_ratio"],
        }

    unresponded = sum(
        1 for issue in open_list + closed_list if int(issue.get("comments", 0) or 0) == 0
    )
    return {
        "open_closed_ratio": float(len(open_list) / max(total, 1)),
        "unresponded_issue_ratio": float(unresponded / max(total, 1)),
    }


def _compute_pr_features(pulls: list | dict) -> dict[str, float]:
    """Compute pull request merge rate and stale ratio."""
    if not isinstance(pulls, list) or not pulls:
        return {
            "pr_merge_rate": DEFAULTS["pr_merge_rate"],
            "stale_pr_ratio": DEFAULTS["stale_pr_ratio"],
        }

    total = len(pulls)
    merged = sum(1 for pr in pulls if isinstance(pr, dict) and pr.get("merged_at"))
    now = datetime.now(timezone.utc)
    stale_cutoff = now.timestamp() - 30 * 86400

    stale = 0
    for pr in pulls:
        if not isinstance(pr, dict):
            continue
        if pr.get("merged_at") or pr.get("state") != "open":
            continue
        updated = _parse_iso_datetime(pr.get("updated_at"))
        if updated and updated.timestamp() < stale_cutoff:
            stale += 1

    return {
        "pr_merge_rate": float(merged / max(total, 1)),
        "stale_pr_ratio": float(stale / max(total, 1)),
    }


def _compute_release_features(releases: list | dict) -> dict[str, float]:
    """Compute release recency and frequency trend features."""
    if not isinstance(releases, list) or not releases:
        return {
            "days_since_last_release": DEFAULTS["days_since_last_release"],
            "release_freq_trend_slope": DEFAULTS["release_freq_trend_slope"],
        }

    published_dates: list[datetime] = []
    for release in releases:
        if not isinstance(release, dict):
            continue
        parsed = _parse_iso_datetime(release.get("published_at"))
        if parsed:
            published_dates.append(parsed)

    if not published_dates:
        return {
            "days_since_last_release": DEFAULTS["days_since_last_release"],
            "release_freq_trend_slope": DEFAULTS["release_freq_trend_slope"],
        }

    published_dates.sort(reverse=True)
    days_since = _days_since(published_dates[0])

    slope = 0.0
    if len(published_dates) >= 3:
        published_dates.sort()
        intervals = [
            (published_dates[i + 1] - published_dates[i]).total_seconds() / 86400
            for i in range(len(published_dates) - 1)
        ]
        if len(intervals) >= 2:
            x = np.arange(len(intervals), dtype=float)
            slope = float(np.polyfit(x, intervals, 1)[0])

    return {
        "days_since_last_release": float(min(days_since, 730.0)),
        "release_freq_trend_slope": float(np.clip(slope, -30.0, 30.0)),
    }


def _compute_repo_features(
    repo_data: list | dict,
    days_since_last_release: float,
) -> dict[str, float]:
    """Compute repository metadata features."""
    if not isinstance(repo_data, dict) or not repo_data:
        return {
            "repo_age_days": DEFAULTS["repo_age_days"],
            "is_archived": DEFAULTS["is_archived"],
            "days_since_maintainer_comment": DEFAULTS["days_since_maintainer_comment"],
        }

    created = _parse_iso_datetime(repo_data.get("created_at"))
    repo_age = _days_since(created)
    is_archived = 1.0 if repo_data.get("archived") is True else 0.0
    maintainer_comment = min(days_since_last_release + 30.0, 365.0)

    return {
        "repo_age_days": float(min(repo_age, 5000.0)),
        "is_archived": is_archived,
        "days_since_maintainer_comment": maintainer_comment,
    }


async def collect_signals(owner: str, repo: str) -> dict[str, float]:
    """Collect 18 behavioral signals for a GitHub repository."""
    base = f"/repos/{owner}/{repo}"

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            (
                repo_data,
                commit_activity,
                commits,
                open_issues,
                closed_issues,
                pulls,
                contributors,
                releases,
            ) = await asyncio.gather(
                github_get(client, base),
                github_get(client, f"{base}/stats/commit_activity"),
                github_get(client, f"{base}/commits", {"per_page": 100}),
                github_get(client, f"{base}/issues", {"state": "open", "per_page": 100}),
                github_get(
                    client, f"{base}/issues", {"state": "closed", "per_page": 100}
                ),
                github_get(client, f"{base}/pulls", {"state": "all", "per_page": 100}),
                github_get(client, f"{base}/contributors", {"per_page": 100}),
                github_get(client, f"{base}/releases", {"per_page": 30}),
            )

        signals: dict[str, float] = {}
        signals.update(_compute_commit_features(commit_activity, commits))
        signals.update(_compute_sentiment_features(commits))
        signals.update(_compute_contributor_features(contributors, commits))
        signals.update(_compute_issue_features(open_issues, closed_issues))
        signals.update(_compute_pr_features(pulls))
        release_features = _compute_release_features(releases)
        signals.update(release_features)
        signals.update(
            _compute_repo_features(repo_data, release_features["days_since_last_release"])
        )

        return {name: float(signals.get(name, DEFAULTS[name])) for name in FEATURE_NAMES}

    except Exception as exc:
        logger.error(
            "Signal collection failed owner=%s repo=%s error=%s", owner, repo, exc
        )
        return _default_signals()
