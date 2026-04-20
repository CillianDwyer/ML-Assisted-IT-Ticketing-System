import argparse
import os
from pathlib import Path

import joblib
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.pipeline import Pipeline
from sklearn.svm import LinearSVC


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = PROJECT_ROOT / "ml" / "data"
DEFAULT_DATASET = DATA_DIR / "helpdesk_tickets_synthetic.csv"
DEFAULT_OUTPUTS = [
    PROJECT_ROOT / "ml" / "ticket_classifier.pkl",
    PROJECT_ROOT / "backend" / "ml" / "ticket_classifier.pkl",
]


def parse_args():
    # Lets the training dataset be overridden without editing the script.
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
    # Keeps only rows with usable ticket text and labels.
    df = pd.read_csv(dataset_path)
    df = df.dropna(subset=["description", "issue_type"])
    df["description"] = df["description"].astype(str).str.strip()
    df = df[df["description"] != ""]

    return df["description"], df["issue_type"]


def build_pipeline() -> Pipeline:
    # Matches the runtime model structure used by the backend.
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

    pipeline = build_pipeline()
    pipeline.fit(X, y)

    print(f"Dataset: {dataset_path}")
    print(f"Rows used: {len(X)}")
    print(f"Labels: {y.nunique()}")
    print("Training mode: full dataset")

    # Save the same trained pipeline to both ML and backend runtime locations.
    for output_path in DEFAULT_OUTPUTS:
        output_path.parent.mkdir(parents=True, exist_ok=True)
        joblib.dump(pipeline, output_path)
        print(f"Saved model to {output_path}")


if __name__ == "__main__":
    main()
