import argparse
import os
from pathlib import Path

import joblib
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics import accuracy_score, classification_report, f1_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.svm import LinearSVC


DEFAULT_DATASET = Path(
    r"C:\Users\GGGba.DESKTOP-5RI379L\Downloads\it_ticket_issue_type_dataset_harder_58000.csv"
)
PROJECT_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUTPUTS = [
    PROJECT_ROOT / "ml" / "ticket_classifier.pkl",
    PROJECT_ROOT / "backend" / "ml" / "ticket_classifier.pkl",
]


def parse_args():
    parser = argparse.ArgumentParser(
        description="Train the IT issue-type classifier from a CSV dataset."
    )
    parser.add_argument(
        "--dataset",
        default=os.environ.get("TICKET_DATASET_PATH", str(DEFAULT_DATASET)),
        help="Path to the CSV dataset.",
    )
    return parser.parse_args()


def load_dataset(dataset_path: Path) -> tuple[pd.Series, pd.Series]:
    df = pd.read_csv(dataset_path)
    df = df.dropna(subset=["description", "issue_type"])
    df["description"] = df["description"].astype(str).str.strip()
    df = df[df["description"] != ""]

    return df["description"], df["issue_type"]


def build_pipeline() -> Pipeline:
    return Pipeline(
        [
            (
                "tfidf",
                TfidfVectorizer(
                    stop_words="english",
                    ngram_range=(1, 2),
                    max_features=40000,
                    min_df=2,
                    sublinear_tf=True,
                ),
            ),
            ("clf", LinearSVC()),
        ]
    )


def main():
    args = parse_args()
    dataset_path = Path(args.dataset).expanduser()

    if not dataset_path.exists():
        raise FileNotFoundError(f"Dataset not found: {dataset_path}")

    X, y = load_dataset(dataset_path)

    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y,
        test_size=0.2,
        random_state=42,
        stratify=y,
    )

    pipeline = build_pipeline()
    pipeline.fit(X_train, y_train)

    y_pred = pipeline.predict(X_test)

    print(f"Dataset: {dataset_path}")
    print(f"Rows used: {len(X)}")
    print(f"Labels: {y.nunique()}")
    print(f"Accuracy: {accuracy_score(y_test, y_pred):.4f}")
    print(f"Macro F1: {f1_score(y_test, y_pred, average='macro'):.4f}")
    print("\nClassification Report:\n")
    print(classification_report(y_test, y_pred))

    for output_path in DEFAULT_OUTPUTS:
        output_path.parent.mkdir(parents=True, exist_ok=True)
        joblib.dump(pipeline, output_path)
        print(f"Saved model to {output_path}")


if __name__ == "__main__":
    main()
