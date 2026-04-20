import argparse
import os
from pathlib import Path

import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression, SGDClassifier
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix, f1_score
from sklearn.model_selection import train_test_split
from sklearn.naive_bayes import MultinomialNB
from sklearn.pipeline import Pipeline
from sklearn.svm import LinearSVC


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = PROJECT_ROOT / "ml" / "data"
DEFAULT_TRAIN_DATASET = DATA_DIR / "helpdesk_tickets_synthetic.csv"
DEFAULT_EVAL_DATASET = DATA_DIR / "helpdesk_tickets_unseen_test.csv"


def parse_args():
    # Supports either train/test split evaluation or train-on-one / evaluate-on-another.
    parser = argparse.ArgumentParser(
        description=(
            "Compare text classification models on IT ticket data. "
            "Can either use a train/test split on one dataset or train on one dataset "
            "and evaluate on a separate unseen dataset."
        )
    )
    parser.add_argument(
        "--train-dataset",
        default=os.environ.get("TICKET_TRAIN_DATASET_PATH", str(DEFAULT_TRAIN_DATASET)),
        help="Path to the training CSV dataset.",
    )
    parser.add_argument(
        "--eval-dataset",
        default=os.environ.get("TICKET_EVAL_DATASET_PATH", str(DEFAULT_EVAL_DATASET)),
        help=(
            "Optional path to a separate evaluation CSV dataset. "
            "If provided, models are trained on --train-dataset and evaluated on this dataset."
        ),
    )
    parser.add_argument(
        "--test-size",
        type=float,
        default=0.2,
        help=(
            "Test split size when evaluating on the training dataset itself. "
            "Ignored when --eval-dataset is provided."
        ),
    )
    parser.add_argument(
        "--show-confusion-matrix",
        action="store_true",
        help="Print confusion matrices for the best-performing model and LinearSVC.",
    )
    return parser.parse_args()


def load_dataset(dataset_path: Path) -> tuple[pd.Series, pd.Series]:
    # Keeps only rows with usable ticket text and labels.
    df = pd.read_csv(dataset_path)
    df = df.dropna(subset=["description", "issue_type"])
    df["description"] = df["description"].astype(str).str.strip()
    df = df[df["description"] != ""]
    return df["description"], df["issue_type"]


def print_full_dataframe(df: pd.DataFrame):
    with pd.option_context(
        "display.max_rows", None,
        "display.max_columns", None,
        "display.width", None,
        "display.max_colwidth", None,
    ):
        print(df)


def build_vectorizer() -> TfidfVectorizer:
    # Shared text representation used by every model in the comparison.
    return TfidfVectorizer(
        stop_words="english",
        ngram_range=(1, 2),
        max_features=40000,
        min_df=2,
        sublinear_tf=True,
    )


def build_models():
    # Candidate classifiers compared on the same TF-IDF features.
    return {
        "LinearSVC": LinearSVC(),
        "LogisticRegression": LogisticRegression(
            max_iter=3000,
            class_weight="balanced",
            random_state=42,
        ),
        "MultinomialNB": MultinomialNB(),
        "SGDClassifier (hinge)": SGDClassifier(
            loss="hinge",
            random_state=42,
        ),
        "RandomForestClassifier": RandomForestClassifier(
            n_estimators=300,
            random_state=42,
            n_jobs=1,
        ),
    }


def main():
    args = parse_args()
    train_dataset_path = Path(args.train_dataset).expanduser()
    eval_dataset_path = Path(args.eval_dataset).expanduser() if args.eval_dataset else None

    if not train_dataset_path.exists():
        raise FileNotFoundError(f"Training dataset not found: {train_dataset_path}")

    X_train_all, y_train_all = load_dataset(train_dataset_path)

    if eval_dataset_path:
        if not eval_dataset_path.exists():
            raise FileNotFoundError(f"Evaluation dataset not found: {eval_dataset_path}")
        X_test, y_test = load_dataset(eval_dataset_path)
        X_train = X_train_all
        y_train = y_train_all
        # Guard against evaluation labels that the model never saw during training.
        labels_in_train = set(y_train.unique())
        labels_in_eval = set(y_test.unique())
        missing_from_train = sorted(labels_in_eval - labels_in_train)
        if missing_from_train:
            raise ValueError(
                "Evaluation dataset contains labels not present in the training dataset: "
                + ", ".join(missing_from_train)
            )
        print(f"Training dataset: {train_dataset_path}")
        print(f"Training rows used: {len(X_train)}")
        print(f"Evaluation dataset: {eval_dataset_path}")
        print(f"Evaluation rows used: {len(X_test)}")
        print(f"Shared labels: {len(labels_in_eval)}")
    else:
        X_train, X_test, y_train, y_test = train_test_split(
            X_train_all,
            y_train_all,
            test_size=args.test_size,
            random_state=42,
            stratify=y_train_all,
        )
        print(f"Dataset: {train_dataset_path}")
        print(f"Rows used: {len(X_train_all)}")
        print(f"Labels: {y_train_all.nunique()}")
        print(
            f"Evaluation mode: random {int((1 - args.test_size) * 100)}/"
            f"{int(args.test_size * 100)} split from the same dataset"
        )

    print(f"Training labels: {y_train.nunique()}")
    print(f"Evaluation labels: {y_test.nunique()}")

    results = []
    predictions_by_model = {}

    for name, clf in build_models().items():
        # Every model uses the same vectorizer so the comparison stays fair.
        pipeline = Pipeline(
            [
                ("tfidf", build_vectorizer()),
                ("clf", clf),
            ]
        )

        pipeline.fit(X_train, y_train)
        y_pred = pipeline.predict(X_test)
        predictions_by_model[name] = y_pred

        accuracy = accuracy_score(y_test, y_pred)
        macro_f1 = f1_score(y_test, y_pred, average="macro")
        weighted_f1 = f1_score(y_test, y_pred, average="weighted")
        results.append((name, accuracy, macro_f1, weighted_f1))

        print(f"\n=== {name} ===")
        print(f"Accuracy: {accuracy:.4f}")
        print(f"Macro F1: {macro_f1:.4f}")
        print(f"Weighted F1: {weighted_f1:.4f}")
        print("\nClassification Report:\n")
        print(classification_report(y_test, y_pred))

    # Rank models by macro F1 so class balance matters more than raw accuracy alone.
    results.sort(key=lambda row: row[2], reverse=True)
    best_name, best_accuracy, best_macro_f1, best_weighted_f1 = results[0]

    print("\n=== Summary (sorted by Macro F1) ===")
    for name, accuracy, macro_f1, weighted_f1 in results:
        print(
            f"{name}: accuracy={accuracy:.4f}, "
            f"macro_f1={macro_f1:.4f}, weighted_f1={weighted_f1:.4f}"
        )

    print(
        f"\nBest model: {best_name} | "
        f"accuracy={best_accuracy:.4f} | "
        f"macro_f1={best_macro_f1:.4f} | "
        f"weighted_f1={best_weighted_f1:.4f}"
    )

    if args.show_confusion_matrix:
        labels = sorted(y_test.unique())
        cm = confusion_matrix(
            y_test,
            predictions_by_model[best_name],
            labels=labels,
        )
        cm_df = pd.DataFrame(cm, index=labels, columns=labels)
        print(f"\nConfusion Matrix for best model: {best_name}\n")
        print_full_dataframe(cm_df)

        linear_svc_name = "LinearSVC"
        if linear_svc_name in predictions_by_model:
            linear_svc_cm = confusion_matrix(
                y_test,
                predictions_by_model[linear_svc_name],
                labels=labels,
            )
            linear_svc_cm_df = pd.DataFrame(
                linear_svc_cm,
                index=labels,
                columns=labels,
            )
            print(f"\nConfusion Matrix for chosen model: {linear_svc_name}\n")
            print_full_dataframe(linear_svc_cm_df)

            # Save the chosen deployment model's confusion matrix for reporting.
            output_path = PROJECT_ROOT / "ml" / "linear_svc_confusion_matrix.csv"
            linear_svc_cm_df.to_csv(output_path)
            print(f"\nSaved LinearSVC confusion matrix to {output_path}")


if __name__ == "__main__":
    main()
