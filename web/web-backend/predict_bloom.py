"""
predict_bloom.py

Small helper for loading the trained Bloom's Taxonomy model and using it
to classify new questions. Import this from classifier.py.

Usage:
    from predict_bloom import predict_bloom_level

    result = predict_bloom_level("Explain how photosynthesis works.")
    print(result)
    # {'level_code': 'BT2', 'level_name': 'Understand', 'confidence': 0.81}
"""

import re
import joblib
import os

_MODEL_PATH = os.path.join(os.path.dirname(__file__), "bloom_classifier.pkl")

_bundle = None  # loaded lazily, once, the first time it's needed


def _load_bundle():
    global _bundle
    if _bundle is None:
        _bundle = joblib.load(_MODEL_PATH)
    return _bundle


def _clean_text(text: str) -> str:
    text = text.lower().strip()
    text = re.sub(r"\s+", " ", text)
    return text


def predict_bloom_level(question: str) -> dict:
    """
    Predicts the Bloom's Taxonomy level of a single question.

    Returns a dict:
        {
            "level_code": "BT1".."BT6",
            "level_name": "Remember" / "Understand" / ... / "Create",
            "confidence": float between 0 and 1 (approximate),
        }
    """
    bundle = _load_bundle()
    vectorizer = bundle["vectorizer"]
    model = bundle["model"]
    label_meanings = bundle["label_meanings"]

    cleaned = _clean_text(question)
    vec = vectorizer.transform([cleaned])

    prediction = model.predict(vec)[0]

    # LinearSVC has no predict_proba by default; use decision_function
    # distances as a rough confidence proxy. LogisticRegression has
    # real probabilities, so use those when available.
    confidence = None
    if hasattr(model, "predict_proba"):
        probs = model.predict_proba(vec)[0]
        confidence = float(max(probs))
    elif hasattr(model, "decision_function"):
        scores = model.decision_function(vec)[0]
        # softmax-normalize the raw scores into something 0-1 for display
        import numpy as np
        exp_scores = np.exp(scores - np.max(scores))
        probs = exp_scores / exp_scores.sum()
        confidence = float(max(probs))

    return {
        "level_code": prediction,
        "level_name": label_meanings.get(prediction, prediction),
        "confidence": round(confidence, 3) if confidence is not None else None,
    }


def predict_bloom_batch(questions: list) -> list:
    """Same as predict_bloom_level but for a list of questions at once."""
    return [predict_bloom_level(q) for q in questions]


if __name__ == "__main__":
    # Quick manual test when running this file directly
    samples = [
        "List the phases of mitosis.",
        "Explain why the French Revolution began.",
        "Solve for x in the equation 2x + 5 = 15.",
        "Compare and contrast monarchy and democracy.",
        "Evaluate the effectiveness of renewable energy policies.",
        "Design a mobile app that helps students study Bloom's taxonomy.",
    ]
    for q in samples:
        print(q, "->", predict_bloom_level(q))
