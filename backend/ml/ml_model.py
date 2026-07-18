import os
import re

import joblib
import numpy as np

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Reject inputs with too little text to classify at all.
MIN_DESCRIPTION_WORDS = 3
MIN_UNIQUE_TOKENS = 2
MIN_ALNUM_CHARS = 8

# Confidence gate: the margin gap between the model's top choice and its
# runner-up. On training-distribution text virtually all tickets clear 0.30,
# so this only bites ambiguous or off-topic input. On the harder unseen test
# set it auto-routes ~54% of tickets at 88% accuracy (vs 67% ungated) and
# rejects most non-IT text; everything below the gap lands in the Admin
# Review Queue for a human.
MIN_MARGIN_GAP = 0.25

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
    if alnum_chars < MIN_ALNUM_CHARS:
        return False

    return True


def predict_category(text: str):
    if classifier is None:
        return "Uncategorized"

    normalized = _normalize_text(text)
    if not _has_enough_signal(normalized):
        return "Uncategorized"

    scores = classifier.decision_function([normalized])[0]
    top_two = np.sort(scores)[-2:]
    if top_two[1] - top_two[0] < MIN_MARGIN_GAP:
        # Low-confidence predictions go to admin review instead of a wrong team.
        return "Uncategorized"

    return classifier.classes_[int(np.argmax(scores))]
