import joblib
import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

classifier = None

try:
    classifier = joblib.load(
        os.path.join(BASE_DIR, "ticket_classifier.pkl")
    )
except Exception as e:
    print("ML model failed to load:", e)

def predict_category(text: str):
    if classifier is None:
        return "Uncategorized"
    return classifier.predict([text])[0]
