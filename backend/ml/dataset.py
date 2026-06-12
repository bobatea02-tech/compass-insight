"""Dataset labeling and synthetic data generation for model training."""

import numpy as np
import pandas as pd

from ml.features import FEATURE_NAMES


def label_repo(signals: dict, is_archived: bool) -> int:
    """Return health class label: 0 Healthy, 1 At Risk, 2 Dying."""
    if is_archived:
        return 2
    if (
        signals["commit_freq_mean_52w"] < 0.05
        and signals["zero_commit_weeks_ratio"] > 0.92
    ):
        return 2
    if (
        signals["commit_freq_trend_slope"] < -0.4
        and signals["top_contributor_pct"] > 88
    ):
        return 1
    if signals["zero_commit_weeks_ratio"] > 0.55:
        return 1
    if signals["days_since_last_release"] > 365:
        return 1
    return 0


def _clip_feature(name: str, value: float) -> float:
    """Clip a feature value to its realistic range from the technical spec."""
    ranges: dict[str, tuple[float, float]] = {
        "commit_freq_mean_52w": (0.0, 50.0),
        "commit_freq_trend_slope": (-5.0, 5.0),
        "commit_gap_max_days": (0.0, 365.0),
        "zero_commit_weeks_ratio": (0.0, 1.0),
        "commit_msg_sentiment_mean": (-1.0, 1.0),
        "commit_msg_sentiment_trend": (-2.0, 2.0),
        "commit_frustration_ratio": (0.0, 1.0),
        "top_contributor_pct": (0.0, 100.0),
        "active_contributors_90d": (0.0, 50.0),
        "open_closed_ratio": (0.0, 5.0),
        "unresponded_issue_ratio": (0.0, 1.0),
        "pr_merge_rate": (0.0, 1.0),
        "stale_pr_ratio": (0.0, 1.0),
        "days_since_last_release": (0.0, 730.0),
        "release_freq_trend_slope": (-30.0, 30.0),
        "repo_age_days": (0.0, 5000.0),
        "is_archived": (0.0, 1.0),
        "days_since_maintainer_comment": (0.0, 365.0),
    }
    low, high = ranges.get(name, (0.0, float("inf")))
    return float(np.clip(value, low, high))


def generate_synthetic_dataset(n_samples: int = 500) -> pd.DataFrame:
    """Generate a reproducible synthetic dataset for pipeline testing."""
    np.random.seed(42)

    class_counts = {
        0: int(n_samples * 0.60),
        1: int(n_samples * 0.25),
        2: n_samples - int(n_samples * 0.60) - int(n_samples * 0.25),
    }

    class_profiles: dict[int, dict[str, tuple[float, float]]] = {
        0: {
            "commit_freq_mean_52w": (8.0, 2.0),
            "commit_freq_trend_slope": (0.3, 0.5),
            "commit_gap_max_days": (14.0, 7.0),
            "zero_commit_weeks_ratio": (0.08, 0.05),
            "commit_msg_sentiment_mean": (0.35, 0.15),
            "commit_msg_sentiment_trend": (0.05, 0.1),
            "commit_frustration_ratio": (0.05, 0.03),
            "top_contributor_pct": (35.0, 10.0),
            "active_contributors_90d": (12.0, 4.0),
            "open_closed_ratio": (0.3, 0.15),
            "unresponded_issue_ratio": (0.15, 0.08),
            "pr_merge_rate": (0.75, 0.1),
            "stale_pr_ratio": (0.08, 0.05),
            "days_since_last_release": (45.0, 30.0),
            "release_freq_trend_slope": (-1.0, 2.0),
            "repo_age_days": (1200.0, 400.0),
            "is_archived": (0.0, 0.0),
            "days_since_maintainer_comment": (30.0, 15.0),
        },
        1: {
            "commit_freq_mean_52w": (1.5, 0.8),
            "commit_freq_trend_slope": (-0.8, 0.3),
            "commit_gap_max_days": (60.0, 25.0),
            "zero_commit_weeks_ratio": (0.65, 0.12),
            "commit_msg_sentiment_mean": (0.0, 0.12),
            "commit_msg_sentiment_trend": (-0.15, 0.1),
            "commit_frustration_ratio": (0.18, 0.08),
            "top_contributor_pct": (82.0, 8.0),
            "active_contributors_90d": (3.0, 1.5),
            "open_closed_ratio": (0.55, 0.2),
            "unresponded_issue_ratio": (0.45, 0.15),
            "pr_merge_rate": (0.45, 0.15),
            "stale_pr_ratio": (0.35, 0.12),
            "days_since_last_release": (420.0, 80.0),
            "release_freq_trend_slope": (5.0, 4.0),
            "repo_age_days": (1800.0, 500.0),
            "is_archived": (0.0, 0.0),
            "days_since_maintainer_comment": (180.0, 40.0),
        },
        2: {
            "commit_freq_mean_52w": (0.02, 0.02),
            "commit_freq_trend_slope": (-1.5, 0.4),
            "commit_gap_max_days": (200.0, 60.0),
            "zero_commit_weeks_ratio": (0.95, 0.04),
            "commit_msg_sentiment_mean": (-0.25, 0.15),
            "commit_msg_sentiment_trend": (-0.3, 0.12),
            "commit_frustration_ratio": (0.35, 0.12),
            "top_contributor_pct": (96.0, 3.0),
            "active_contributors_90d": (0.5, 0.5),
            "open_closed_ratio": (0.85, 0.15),
            "unresponded_issue_ratio": (0.75, 0.12),
            "pr_merge_rate": (0.15, 0.1),
            "stale_pr_ratio": (0.7, 0.15),
            "days_since_last_release": (600.0, 80.0),
            "release_freq_trend_slope": (12.0, 5.0),
            "repo_age_days": (2500.0, 600.0),
            "is_archived": (0.8, 0.4),
            "days_since_maintainer_comment": (330.0, 30.0),
        },
    }

    rows: list[dict[str, float | int]] = []
    for health_class, count in class_counts.items():
        profile = class_profiles[health_class]
        for _ in range(count):
            row: dict[str, float | int] = {"health_class": health_class}
            for feature in FEATURE_NAMES:
                mean, std = profile[feature]
                value = float(np.random.normal(mean, std))
                row[feature] = _clip_feature(feature, value)
            rows.append(row)

    perm = np.random.permutation(len(rows))
    rows = [rows[i] for i in perm]
    return pd.DataFrame(rows)[FEATURE_NAMES + ["health_class"]]
