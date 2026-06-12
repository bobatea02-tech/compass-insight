"""XGBoost training pipeline for the Compass risk classifier."""

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

_backend_dir = Path(__file__).resolve().parent.parent
if str(_backend_dir) not in sys.path:
    sys.path.insert(0, str(_backend_dir))

import joblib
import numpy as np
import pandas as pd
import shap
from sklearn.metrics import accuracy_score, classification_report, f1_score
from sklearn.model_selection import train_test_split
from xgboost import XGBClassifier

from ml.dataset import generate_synthetic_dataset
from ml.features import FEATURE_NAMES

MODELS_DIR = Path(__file__).resolve().parent / "models"


def train(csv_path: str | None = None) -> tuple:
    """Train the XGBoost classifier and save model artifacts."""
    MODELS_DIR.mkdir(parents=True, exist_ok=True)

    dataset_type = "synthetic"
    if csv_path is None:
        df = generate_synthetic_dataset(500)
    else:
        dataset_type = "real"
        df = pd.read_csv(csv_path)

    df = df.dropna(subset=FEATURE_NAMES + ["health_class"])
    X = df[FEATURE_NAMES].fillna(0)
    y = df["health_class"].astype(int)

    print("Class distribution:")
    print(y.value_counts().sort_index().to_string())
    print()

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.20, stratify=y, random_state=42
    )

    model = XGBClassifier(
        n_estimators=400,
        max_depth=5,
        learning_rate=0.04,
        subsample=0.8,
        colsample_bytree=0.75,
        min_child_weight=3,
        gamma=0.1,
        reg_alpha=0.1,
        reg_lambda=1.0,
        scale_pos_weight=2,
        objective="multi:softprob",
        num_class=3,
        eval_metric="mlogloss",
        random_state=42,
        n_jobs=-1,
    )

    model.fit(X_train, y_train, eval_set=[(X_test, y_test)], verbose=False)

    y_pred = model.predict(X_test)
    report = classification_report(
        y_test,
        y_pred,
        target_names=["Healthy", "At Risk", "Dying"],
    )
    print(report)

    accuracy = float(accuracy_score(y_test, y_pred))
    f1_macro = float(f1_score(y_test, y_pred, average="macro"))

    explainer = shap.TreeExplainer(model)

    joblib.dump(model, MODELS_DIR / "compass_model.joblib")
    joblib.dump(explainer, MODELS_DIR / "compass_explainer.joblib")
    joblib.dump(FEATURE_NAMES, MODELS_DIR / "feature_names.joblib")

    metadata = {
        "accuracy": round(accuracy, 4),
        "f1_macro": round(f1_macro, 4),
        "n_samples": int(len(df)),
        "trained_at": datetime.now(timezone.utc).isoformat(),
        "dataset_type": dataset_type,
    }
    with open(MODELS_DIR / "training_metadata.json", "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2)

    return model, explainer


if __name__ == "__main__":
    train()
    with open(MODELS_DIR / "training_metadata.json", encoding="utf-8") as f:
        metadata = json.load(f)
    print("Model saved to backend/ml/models/")
    print(f"Accuracy: {metadata['accuracy']}")
    print(f"F1 macro: {metadata['f1_macro']}")
