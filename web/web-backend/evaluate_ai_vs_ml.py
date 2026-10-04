"""
evaluate_ai_vs_ml.py

Runs BOTH classifiers -- Gemini (classify_question) and your trained ML
model (classify_question_ml) -- against the SAME held-out test questions
from blooms_taxonomy_dataset.csv (the ones with real, expert-assigned
ground-truth labels that were never used for training).

This gives a fair, apples-to-apples accuracy comparison, unlike the
bloom_comparison_log.txt file which only shows agreement between the two,
not correctness against ground truth.

Usage:
    python evaluate_ai_vs_ml.py

Produces:
    evaluation_report.txt   (accuracy, F1, per-class breakdown for both)

Note: this calls the Gemini API once per test question, so it uses your
API quota and takes a while. It samples SAMPLE_SIZE questions (balanced
across classes) rather than the full test set, to keep this practical.
"""

import pandas as pd
import re
import time
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, accuracy_score, f1_score

from classifier import classify_question, classify_question_ml

DATA_PATH = "blooms_taxonomy_dataset.csv"
REPORT_OUT = "evaluation_report.txt"
SAMPLE_SIZE = 120  # ~20 per class, keeps API usage/time reasonable

BLOOM_LABELS = {
    "BT1": "Remember",
    "BT2": "Understand",
    "BT3": "Apply",
    "BT4": "Analyze",
    "BT5": "Evaluate",
    "BT6": "Create",
}


def clean_text(text: str) -> str:
    text = text.lower().strip()
    text = re.sub(r"\s+", " ", text)
    return text


def main():
    print("Loading dataset and recreating the exact same train/test split used during training...")
    df = pd.read_csv(DATA_PATH)
    df = df.dropna(subset=["Questions", "Category"])
    df["clean_question"] = df["Questions"].apply(clean_text)

    X = df["clean_question"]
    y = df["Category"]

    # Same random_state and test_size as train_bloom_classifier.py, so this
    # is the exact same held-out test set the ML model was scored on.
    _, X_test, _, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    test_df = pd.DataFrame({"question": X_test, "true_code": y_test})

    # Sample a balanced subset across classes to keep API calls manageable
    per_class = max(1, SAMPLE_SIZE // 6)
    sample_df = pd.concat([
        g.sample(min(len(g), per_class), random_state=42)
        for _, g in test_df.groupby("true_code")
    ]).reset_index(drop=True)
    print(f"Evaluating on {len(sample_df)} sampled test questions (never used for ML training).")

    true_labels = []
    gemini_preds = []
    ml_preds = []

    for i, row in sample_df.iterrows():
        true_label = BLOOM_LABELS[row["true_code"]]
        true_labels.append(true_label)

        ml_pred = classify_question_ml(row["question"])
        ml_preds.append(ml_pred)

        gemini_pred = classify_question(row["question"])
        gemini_preds.append(gemini_pred)

        print(f"[{i+1}/{len(sample_df)}] true={true_label:<12} gemini={gemini_pred:<12} ml={ml_pred:<12}")
        time.sleep(0.5)  # be gentle on API rate limits

    gemini_acc = accuracy_score(true_labels, gemini_preds)
    gemini_f1 = f1_score(true_labels, gemini_preds, average="weighted")
    ml_acc = accuracy_score(true_labels, ml_preds)
    ml_f1 = f1_score(true_labels, ml_preds, average="weighted")

    print(f"\n=== RESULTS ===")
    print(f"Gemini  -> accuracy: {gemini_acc:.3f}, weighted F1: {gemini_f1:.3f}")
    print(f"ML model -> accuracy: {ml_acc:.3f}, weighted F1: {ml_f1:.3f}")

    with open(REPORT_OUT, "w", encoding="utf-8") as f:
        f.write("=== AI (Gemini) vs ML Model -- Accuracy Comparison ===\n")
        f.write(f"Evaluated on {len(sample_df)} held-out test questions with known, expert-assigned labels\n\n")

        f.write(f"Gemini accuracy: {gemini_acc:.3f}\n")
        f.write(f"Gemini weighted F1: {gemini_f1:.3f}\n\n")
        f.write("Gemini per-class report:\n")
        f.write(classification_report(true_labels, gemini_preds, digits=3))

        f.write(f"\n\nML model accuracy: {ml_acc:.3f}\n")
        f.write(f"ML model weighted F1: {ml_f1:.3f}\n\n")
        f.write("ML model per-class report:\n")
        f.write(classification_report(true_labels, ml_preds, digits=3))

    print(f"\nFull report saved to {REPORT_OUT}")


if __name__ == "__main__":
    main()
