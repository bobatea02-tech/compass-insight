"""Risk Classifier agent — XGBoost prediction with SHAP explanations."""

from pathlib import Path

import joblib
import numpy as np
import pandas as pd

MODELS_DIR = Path(__file__).resolve().parent.parent / "ml" / "models"

_MODEL_PATH = MODELS_DIR / "compass_model.joblib"
_EXPLAINER_PATH = MODELS_DIR / "compass_explainer.joblib"
_FEATURE_NAMES_PATH = MODELS_DIR / "feature_names.joblib"

for _path, _label in [
    (_MODEL_PATH, "compass_model.joblib"),
    (_EXPLAINER_PATH, "compass_explainer.joblib"),
    (_FEATURE_NAMES_PATH, "feature_names.joblib"),
]:
    if not _path.exists():
        raise RuntimeError(
            f"Model file not found: {_label}. Run: python ml/train.py"
        )

model = joblib.load(_MODEL_PATH)
explainer = joblib.load(_EXPLAINER_PATH)
feature_names: list[str] = joblib.load(_FEATURE_NAMES_PATH)

RISK_LABELS = {0: "Healthy", 1: "At Risk", 2: "Dying"}
RISK_COLORS = {0: "green", 1: "amber", 2: "red"}


def feature_to_sentence(feature: str, value: float, direction: str) -> str:
    """Map a feature name and value to a human-readable explanation."""
    if feature == "top_contributor_pct":
        return f"Single contributor makes {value:.0f}% of all commits"
    if feature == "commit_freq_mean_52w":
        return f"Averaging {value:.1f} commits per week"
    if feature == "zero_commit_weeks_ratio":
        return f"{value * 100:.0f}% of recent weeks had zero commits"
    if feature == "commit_msg_sentiment_mean":
        tone = (
            "negative"
            if value < -0.1
            else "positive"
            if value > 0.1
            else "neutral"
        )
        return f"Commit message tone is {tone}"
    if feature == "days_since_last_release":
        return f"Last release was {value:.0f} days ago"
    if feature == "pr_merge_rate":
        return f"Only {value * 100:.0f}% of pull requests are being merged"
    if feature == "stale_pr_ratio":
        return f"{value * 100:.0f}% of PRs are stale (open >30 days)"
    if feature == "is_archived":
        return "Repository is officially archived on GitHub"
    return f"{feature.replace('_', ' ')}: {value:.3f}"


def classify_package(signals: dict[str, float]) -> dict:
    """Run XGBoost classification and SHAP explanation."""
    row = {name: signals.get(name, 0.0) for name in feature_names}
    features = pd.DataFrame([row], columns=feature_names).fillna(0)

    probabilities = model.predict_proba(features)[0]
    predicted_class = int(np.argmax(probabilities))

    shap_raw = explainer.shap_values(features)
    if isinstance(shap_raw, list):
        class_shap = shap_raw[predicted_class][0]
    else:
        arr = np.asarray(shap_raw)
        if arr.ndim == 3:
            class_shap = arr[0, :, predicted_class]
        else:
            class_shap = arr[0]

    shap_series = pd.Series(class_shap, index=feature_names)
    top_3 = shap_series.abs().nlargest(3)

    top_signals = []
    for feature_name in top_3.index:
        value = float(features[feature_name].iloc[0])
        shap_val = float(shap_series[feature_name])
        direction = "increases" if shap_val > 0 else "decreases"
        top_signals.append(
            {
                "feature": feature_name,
                "value": round(value, 3),
                "shap_value": round(shap_val, 4),
                "importance": round(abs(shap_val), 4),
                "direction": direction,
                "human_readable": feature_to_sentence(feature_name, value, direction),
            }
        )

    risk_score = round(float(probabilities[1] * 50 + probabilities[2] * 100))

    sorted_features = shap_series.abs().sort_values(ascending=False).index[:10]
    shap_chart_data = [
        {
            "feature": f,
            "shap": round(float(shap_series[f]), 4),
            "value": round(float(features[f].iloc[0]), 3),
        }
        for f in sorted_features
    ]

    return {
        "risk_score": risk_score,
        "risk_class": RISK_LABELS[predicted_class],
        "risk_color": RISK_COLORS[predicted_class],
        "confidence": round(float(probabilities[predicted_class]) * 100, 1),
        "probabilities": {
            "healthy": round(float(probabilities[0]) * 100, 1),
            "at_risk": round(float(probabilities[1]) * 100, 1),
            "dying": round(float(probabilities[2]) * 100, 1),
        },
        "top_signals": top_signals,
        "shap_chart_data": shap_chart_data,
    }
