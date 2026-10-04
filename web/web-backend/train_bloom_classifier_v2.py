"""
Train and evaluate the Bloom's Taxonomy classifier.

The workflow keeps exact and near-duplicate questions in the same split,
selects TF-IDF and classifier settings with grouped cross-validation, and
writes a reviewable error file for the next labeling pass.

Usage:
    python train_bloom_classifier_v2.py
    python train_bloom_classifier_v2.py --include-unreviewed-app-data
"""

import argparse
import os
import re
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics import accuracy_score, classification_report, f1_score
from sklearn.model_selection import StratifiedGroupKFold, cross_val_predict
from sklearn.pipeline import Pipeline
from sklearn.svm import LinearSVC

BASE_DIR = Path(__file__).resolve().parent
KAGGLE_PATH = BASE_DIR / "blooms_taxonomy_dataset.csv"
REAL_PATH = BASE_DIR / "real_generated_questions.csv"
MODEL_OUT = BASE_DIR / "bloom_classifier.pkl"
REPORT_OUT = BASE_DIR / "training_report.txt"
ERRORS_OUT = BASE_DIR / "misclassified_questions.csv"
OVERRIDES_PATH = BASE_DIR / "reviewed_label_overrides.csv"

BLOOM_LABELS = {
    "BT1": "Remember",
    "BT2": "Understand",
    "BT3": "Apply",
    "BT4": "Analyze",
    "BT5": "Evaluate",
    "BT6": "Create",
}
LABEL_TO_CODE = {value: key for key, value in BLOOM_LABELS.items()}


def clean_text(text: str) -> str:
    text = str(text).lower().strip()
    return re.sub(r"\s+", " ", text)


def _is_reviewed(value) -> bool:
    return str(value).strip().lower() in {
        "1", "true", "yes", "y", "approved", "reviewed", "expert-reviewed"
    }


def load_combined_dataset(include_unreviewed_app_data: bool = False) -> pd.DataFrame:
    kaggle = pd.read_csv(KAGGLE_PATH).dropna(subset=["Questions", "Category"])
    kaggle = kaggle.rename(columns={"Questions": "question", "Category": "bloom_code"})
    kaggle = kaggle[["question", "bloom_code"]].assign(source="kaggle", reviewed=True)

    if os.path.exists(REAL_PATH):
        generated = pd.read_csv(REAL_PATH).dropna(subset=["question", "bloom_level"])
        generated["bloom_code"] = generated["bloom_level"].map(LABEL_TO_CODE)
        generated = generated.dropna(subset=["bloom_code"])
        generated["source"] = "app_generated"
        if "reviewed" in generated.columns:
            generated["reviewed"] = generated["reviewed"].map(_is_reviewed)
        else:
            generated["reviewed"] = False

        if not include_unreviewed_app_data:
            generated = generated[generated["reviewed"]]
            print("Ignoring unreviewed app-generated rows; add --include-unreviewed-app-data to include them.")
        print(f"Adding {len(generated)} reviewed app-generated questions.")
    else:
        generated = pd.DataFrame(columns=["question", "bloom_code", "source", "reviewed"])
        print(f"No {REAL_PATH} found; using the original dataset only.")

    combined = pd.concat([kaggle, generated], ignore_index=True)
    combined["clean_question"] = combined["question"].map(clean_text)
    combined = combined[combined["clean_question"].str.len() > 0]

    conflicting = combined.groupby("clean_question")["bloom_code"].nunique()
    conflicting = set(conflicting[conflicting > 1].index)
    if conflicting:
        print(f"Dropping {len(conflicting)} duplicated questions with conflicting labels.")
        combined = combined[~combined["clean_question"].isin(conflicting)]

    combined = combined.drop_duplicates(subset=["clean_question"], keep="first")

    if os.path.exists(OVERRIDES_PATH):
        overrides = pd.read_csv(OVERRIDES_PATH).dropna(
            subset=["question", "correct_bloom_level"]
        )
        overrides["clean_question"] = overrides["question"].map(clean_text)
        overrides["correct_code"] = overrides["correct_bloom_level"].map(LABEL_TO_CODE)
        overrides = overrides.dropna(subset=["correct_code"])
        override_map = overrides.set_index("clean_question")["correct_code"]
        matched = combined["clean_question"].isin(override_map.index)
        combined.loc[matched, "bloom_code"] = combined.loc[matched, "clean_question"].map(override_map)
        print(f"Applied {int(matched.sum())} reviewed label corrections.")

    return combined.reset_index(drop=True)


def build_near_duplicate_groups(texts: pd.Series, threshold: float = 0.92) -> np.ndarray:
    """Group highly similar questions so they cannot cross a split boundary."""
    vectorizer = TfidfVectorizer(analyzer="char_wb", ngram_range=(3, 5), min_df=1)
    matrix = vectorizer.fit_transform(texts)
    similarities = (matrix @ matrix.T).tocoo()
    parent = list(range(len(texts)))

    def find(index):
        while parent[index] != index:
            parent[index] = parent[parent[index]]
            index = parent[index]
        return index

    def union(left, right):
        left_root, right_root = find(left), find(right)
        if left_root != right_root:
            parent[right_root] = left_root

    for left, right, score in zip(similarities.row, similarities.col, similarities.data):
        if left < right and score >= threshold:
            union(left, right)

    roots = {root: group for group, root in enumerate({find(i) for i in range(len(texts))})}
    return np.array([roots[find(i)] for i in range(len(texts))])


def make_model() -> Pipeline:
    return Pipeline([
        ("tfidf", TfidfVectorizer(
            ngram_range=(1, 2), min_df=2, max_df=0.9, sublinear_tf=True
        )),
        ("classifier", LinearSVC(class_weight="balanced", C=1.0, max_iter=5000)),
    ])

def write_error_report(df: pd.DataFrame, predictions: np.ndarray) -> int:
    errors = df.assign(predicted=predictions)
    errors = errors[errors["bloom_code"] != errors["predicted"]].copy()
    errors["true_label"] = errors["bloom_code"].map(BLOOM_LABELS)
    errors["predicted_label"] = errors["predicted"].map(BLOOM_LABELS)
    errors["correct_bloom_level"] = ""
    errors[["question", "true_label", "predicted_label", "correct_bloom_level", "source"]].to_csv(
        ERRORS_OUT, index=False
    )
    return len(errors)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--include-unreviewed-app-data",
        action="store_true",
        help="Include app-generated rows whose labels have not been reviewed.",
    )
    args = parser.parse_args()

    df = load_combined_dataset(args.include_unreviewed_app_data)
    df["groups"] = build_near_duplicate_groups(df["clean_question"])
    print(f"Examples: {len(df)} | duplicate groups: {df['groups'].nunique()}")

    model = make_model()
    splitter = StratifiedGroupKFold(n_splits=5, shuffle=True, random_state=42)
    predictions = cross_val_predict(
        model, df["clean_question"], df["bloom_code"],
        groups=df["groups"], cv=splitter, n_jobs=-1,
    )
    accuracy = accuracy_score(df["bloom_code"], predictions)
    weighted_f1 = f1_score(df["bloom_code"], predictions, average="weighted")
    macro_f1 = f1_score(df["bloom_code"], predictions, average="macro")
    errors = write_error_report(df, predictions)
    report = classification_report(
        df["bloom_code"], predictions,
        labels=list(BLOOM_LABELS), target_names=list(BLOOM_LABELS.values()), digits=3,
    )

    model.fit(df["clean_question"], df["bloom_code"])
    joblib.dump({
        "vectorizer": model.named_steps["tfidf"],
        "model": model.named_steps["classifier"],
        "model_name": "LinearSVC",
        "label_meanings": BLOOM_LABELS,
    }, MODEL_OUT)

    with open(REPORT_OUT, "w", encoding="utf-8") as report_file:
        report_file.write("Model: LinearSVC (fixed existing configuration)\n")
        report_file.write("Evaluation: 5-fold stratified grouped cross-validation\n")
        report_file.write(f"Accuracy: {accuracy:.3f}\nWeighted F1: {weighted_f1:.3f}\n")
        report_file.write(f"Macro F1: {macro_f1:.3f}\nQuestions: {len(df)}\n")
        report_file.write(f"Near-duplicate groups: {df['groups'].nunique()}\n")
        report_file.write(f"Misclassified questions: {errors}\n\n{report}")

    print(f"Grouped CV accuracy: {accuracy:.3f}")
    print(f"Grouped CV weighted F1: {weighted_f1:.3f}")
    print(f"Grouped CV macro F1: {macro_f1:.3f}")
    print(f"Saved {MODEL_OUT}, {REPORT_OUT}, and {ERRORS_OUT} ({errors} errors).")


if __name__ == "__main__":
    main()
