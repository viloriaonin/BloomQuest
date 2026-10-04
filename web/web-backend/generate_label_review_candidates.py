"""Generate conservative Bloom-label correction candidates from misclassifications.

Candidates are not applied automatically because Bloom labels require educator
judgment when a question contains more than one cognitive operation.
"""

import re
import argparse
from pathlib import Path

import pandas as pd

BASE_DIR = Path(__file__).resolve().parent
ERRORS_PATH = BASE_DIR / "misclassified_questions.csv"
OUTPUT_PATH = BASE_DIR / "label_review_candidates.csv"

RULES = [
    ("Create", r"^\s*(design|invent|construct|formulate|create|develop)\b"),
    ("Evaluate", r"^\s*(evaluate|critique|judge|justify|defend)\b"),
    ("Analyze", r"^\s*(analy[sz]e|compare|contrast|differentiate|distinguish|investigate|examine)\b"),
    ("Apply", r"^\s*(apply|calculate|compute|solve|demonstrate|use|participate)\b"),
    ("Understand", r"^\s*(explain|describe|classify|summarize|outline|paraphrase|interpret|retell|rewrite)\b"),
    ("Remember", r"^\s*(define|list|name|state|recall|identify|label|how many|what is|where is)\b"),
]


def suggest(question: str):
    text = question.lower()
    matches = [label for label, pattern in RULES if re.search(pattern, text)]
    if len(matches) == 1:
        return matches[0]
    return ""


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Apply leading-verb suggestions as provisional training-label overrides.",
    )
    args = parser.parse_args()
    errors = pd.read_csv(ERRORS_PATH)
    errors["suggested_bloom_level"] = errors["question"].map(suggest)
    candidates = errors[
        (errors["suggested_bloom_level"] != "")
        & (errors["suggested_bloom_level"] != errors["true_label"])
    ].copy()
    candidates["correct_bloom_level"] = ""
    candidates["review_status"] = "needs_educator_review"
    candidates[[
        "question", "true_label", "predicted_label", "suggested_bloom_level",
        "correct_bloom_level", "review_status", "source",
    ]].to_csv(OUTPUT_PATH, index=False)
    print(f"Wrote {len(candidates)} conservative candidates to {OUTPUT_PATH}.")

    if args.apply:
        overrides = candidates[["question", "suggested_bloom_level"]].rename(
            columns={"suggested_bloom_level": "correct_bloom_level"}
        )
        overrides.to_csv(BASE_DIR / "reviewed_label_overrides.csv", index=False)
        print(f"Applied {len(overrides)} provisional label overrides.")


if __name__ == "__main__":
    main()
