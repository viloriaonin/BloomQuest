"""
train_bloom_classifier_v2.py

Retrains the Bloom's Taxonomy classifier using BOTH:
  1. blooms_taxonomy_dataset.csv   (the original ~8,700 Kaggle questions, short-style)
  2. real_generated_questions.csv (your app's own scenario-style questions,
                                    exported via export_generated_questions.py)

Combining these directly targets the style mismatch found during testing:
the original dataset is short/direct questions, while your app generates
longer, scenario-based ones. Training on a mix of both should generalize
much better to what your app actually produces.

Produces:
  - bloom_classifier.pkl   (the retrained model + vectorizer)
  - training_report.txt    (accuracy / per-class performance)
"""

import pandas as pd
import joblib
import re
import os

from sklearn.model_selection import train_test_split
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.svm import LinearSVC
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import classification_report, accuracy_score, f1_score

KAGGLE_PATH = "blooms_taxonomy_dataset.csv"
REAL_PATH = "real_generated_questions.csv"
MODEL_OUT = "bloom_classifier.pkl"
REPORT_OUT = "training_report.txt"

BLOOM_LABELS = {
    "BT1": "Remember",
    "BT2": "Understand",
    "BT3": "Apply",
    "BT4": "Analyze",
    "BT5": "Evaluate",
    "BT6": "Create",
}
LABEL_TO_CODE = {v: k for k, v in BLOOM_LABELS.items()}


def clean_text(text: str) -> str:
    text = text.lower().strip()
    text = re.sub(r"\s+", " ", text)
    return text


def load_combined_dataset():
    kaggle_df = pd.read_csv(KAGGLE_PATH)
    kaggle_df = kaggle_df.dropna(subset=["Questions", "Category"])
    kaggle_df = kaggle_df.rename(columns={"Questions": "question", "Category": "bloom_code"})
    kaggle_df = kaggle_df[["question", "bloom_code"]]
    kaggle_df["source"] = "kaggle"

    if os.path.exists(REAL_PATH):
        real_df = pd.read_csv(REAL_PATH)
        real_df = real_df.dropna(subset=["question", "bloom_level"])
        # Real data uses plain labels like "Remember" -- convert to BT codes
        real_df["bloom_code"] = real_df["bloom_level"].map(LABEL_TO_CODE)
        real_df = real_df.dropna(subset=["bloom_code"])
        real_df = real_df[["question", "bloom_code"]]
        real_df["source"] = "app_generated"
        print(f"Adding {len(real_df)} real app-generated questions to training data.")
    else:
        real_df = pd.DataFrame(columns=["question", "bloom_code", "source"])
        print(f"No {REAL_PATH} found -- training on Kaggle data only. "
              f"Run export_generated_questions.py first to include real app data.")

    combined = pd.concat([kaggle_df, real_df], ignore_index=True)
    combined = combined.drop_duplicates(subset=["question"])
    return combined


def main():
    print("Loading and combining datasets...")
    df = load_combined_dataset()
    df["clean_question"] = df["question"].apply(clean_text)

    print(f"Total training examples: {len(df)}")
    print(df["bloom_code"].value_counts())
    print(df["source"].value_counts())

    X = df["clean_question"]
    y = df["bloom_code"]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    print("\nVectorizing text (TF-IDF)...")
    vectorizer = TfidfVectorizer(
        ngram_range=(1, 2),
        min_df=2,
        max_df=0.9,
        sublinear_tf=True,
    )
    X_train_vec = vectorizer.fit_transform(X_train)
    X_test_vec = vectorizer.transform(X_test)

    candidates = {
        "LinearSVC": LinearSVC(class_weight="balanced", C=1.0, max_iter=5000),
        "LogisticRegression": LogisticRegression(
            class_weight="balanced", max_iter=2000, C=5.0
        ),
    }

    best_name, best_model, best_f1 = None, None, -1
    report_lines = []

    for name, model in candidates.items():
        print(f"\nTraining {name}...")
        model.fit(X_train_vec, y_train)
        preds = model.predict(X_test_vec)

        acc = accuracy_score(y_test, preds)
        f1 = f1_score(y_test, preds, average="weighted")
        report = classification_report(y_test, preds, digits=3)

        print(f"{name} -> accuracy: {acc:.3f}, weighted F1: {f1:.3f}")
        report_lines.append(f"=== {name} ===\naccuracy: {acc:.3f}\nweighted F1: {f1:.3f}\n{report}\n")

        if f1 > best_f1:
            best_name, best_model, best_f1 = name, model, f1

    print(f"\nBest model: {best_name} (weighted F1: {best_f1:.3f})")

    bundle = {
        "vectorizer": vectorizer,
        "model": best_model,
        "model_name": best_name,
        "label_meanings": BLOOM_LABELS,
    }
    joblib.dump(bundle, MODEL_OUT)
    print(f"Saved model to {MODEL_OUT}")

    with open(REPORT_OUT, "w") as f:
        f.write(f"Best model: {best_name} (weighted F1: {best_f1:.3f})\n\n")
        f.write("\n".join(report_lines))
    print(f"Saved report to {REPORT_OUT}")


if __name__ == "__main__":
    main()
