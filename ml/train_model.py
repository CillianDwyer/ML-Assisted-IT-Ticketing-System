import pandas as pd
import joblib

from sklearn.model_selection import train_test_split
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.svm import LinearSVC
from sklearn.pipeline import Pipeline
from sklearn.metrics import classification_report

# =========================
# 1. Load and clean data
# =========================
df = pd.read_csv("ml/sample_tickets.csv")

# Remove empty or missing text rows
df = df.dropna(subset=["text"])
df = df[df["text"].str.strip() != ""]

# Basic text cleaning
df["text"] = (
    df["text"]
    .str.lower()
    .str.replace(r"[^a-z0-9\s]", "", regex=True)
)

X = df["text"]
y = df["category"]

# =========================
# 2. Train / Test split
# =========================
X_train, X_test, y_train, y_test = train_test_split(
    X,
    y,
    test_size=0.2,
    random_state=42,
    stratify=y
)

# =========================
# 3. Pipeline (TF-IDF + SVM)
# =========================
pipeline = Pipeline([
    ("tfidf", TfidfVectorizer(
        stop_words="english",
        ngram_range=(1, 2),
        max_features=20000,
        min_df=2
    )),
    ("clf", LinearSVC())
])

# =========================
# 4. Train model
# =========================
pipeline.fit(X_train, y_train)

# =========================
# 5. Evaluate
# =========================
y_pred = pipeline.predict(X_test)

print("\nClassification Report:\n")
print(classification_report(y_test, y_pred))

# =========================
# 6. Save model
# =========================
joblib.dump(pipeline, "ticket_classifier.pkl")

print("\nModel saved as ticket_classifier.pkl")
