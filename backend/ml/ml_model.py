import joblib
import os
import re

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MIN_DESCRIPTION_WORDS = 3
MIN_UNIQUE_TOKENS = 2
MIN_ALNUM_CHARS = 8

classifier = None

try:
    classifier = joblib.load(
        os.path.join(BASE_DIR, "ticket_classifier.pkl")
    )
except Exception as e:
    print("ML model failed to load:", e)

def _normalize_text(text: str) -> str:
    return re.sub(r"\s+", " ", (text or "").strip())

def _has_enough_signal(text: str) -> bool:
    normalized = _normalize_text(text)
    tokens = re.findall(r"[A-Za-z0-9]+", normalized.lower())

    if len(tokens) < MIN_DESCRIPTION_WORDS:
        return False

    if len(set(tokens)) < MIN_UNIQUE_TOKENS:
        return False

    # Reject descriptions that are mostly punctuation or otherwise too sparse.
    alnum_chars = sum(ch.isalnum() for ch in normalized)
    return alnum_chars >= MIN_ALNUM_CHARS

def predict_category(text: str):
    if classifier is None:
        return "Uncategorized"

    normalized = _normalize_text(text)
    if not _has_enough_signal(normalized):
        return "Uncategorized"

    return classifier.predict([normalized])[0]
