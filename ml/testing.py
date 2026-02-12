import pandas as pd
import joblib

from sklearn.metrics import confusion_matrix
from sklearn.model_selection import train_test_split
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.pipeline import Pipeline
from sklearn.metrics import classification_report, f1_score

from sklearn.linear_model import LogisticRegression
from sklearn.svm import LinearSVC
from sklearn.naive_bayes import MultinomialNB
from sklearn.linear_model import SGDClassifier
from sklearn.ensemble import RandomForestClassifier

# 1) Load/clean (same as yours)
df = pd.read_csv("ml/sample_tickets.csv")
df = df.dropna(subset=["text", "category"])
df = df[df["text"].str.strip() != ""]
df["text"] = df["text"].str.lower().str.replace(r"[^a-z0-9\s]", "", regex=True)

X = df["text"]
y = df["category"]

# 2) Split (same as yours)
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42, stratify=y
)

# Shared vectorizer settings
tfidf = TfidfVectorizer(
    stop_words="english",
    ngram_range=(1, 2),
    max_features=20000,
    min_df=2
)

# 3) Models to compare
models = {
    "LinearSVC": LinearSVC(),
    "LogReg": LogisticRegression(max_iter=3000, class_weight="balanced"),
    "MultinomialNB": MultinomialNB(),
    "SGD (hinge)": SGDClassifier(loss="hinge", random_state=42),
    "RandomForest": RandomForestClassifier(n_estimators=300, random_state=42),
}

results = []

for name, clf in models.items():
    pipeline = Pipeline([
        ("tfidf", tfidf),
        ("clf", clf),
    ])

    pipeline.fit(X_train, y_train)
    y_pred = pipeline.predict(X_test)

    macro_f1 = f1_score(y_test, y_pred, average="macro")
    results.append((name, macro_f1))

    print(f"\n=== {name} | macro F1={macro_f1:.4f} ===")
    print(classification_report(y_test, y_pred))

# Sort and show best
results.sort(key=lambda x: x[1], reverse=True)
best_name, best_score = results[0]
print("\nBest model:", best_name, "macro F1:", best_score)


labels = ["Access", "Hardware", "Network", "Password Reset", "Software"]

cm = confusion_matrix(y_test, y_pred, labels=labels)

cm_df = pd.DataFrame(cm, index=labels, columns=labels)
print(cm_df)