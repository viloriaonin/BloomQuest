"""
export_generated_questions.py

Pulls every question your app has generated (with its AI-assigned Bloom level)
out of the database, and saves it as a CSV that can be added to the training
data. Run this locally, where your database.env and Postgres connection work.

Usage:
    python export_generated_questions.py

Produces:
    real_generated_questions.csv   (columns: question, bloom_level, reviewed)

The exported labels are predictions until a human reviews them. Mark a row's
reviewed value as True after checking its Bloom level before training.
"""

import os
import csv
from pathlib import Path
from dotenv import load_dotenv
from sqlalchemy import create_engine, text

load_dotenv(dotenv_path=str(Path(__file__).resolve().parent / "database.env"))
DATABASE_URL = os.getenv("DATABASE_URL")

OUTPUT_FILE = "real_generated_questions.csv"


def main():
    if not DATABASE_URL:
        print("DATABASE_URL not found. Make sure database.env is set up correctly.")
        return

    engine = create_engine(DATABASE_URL)

    with engine.connect() as conn:
        result = conn.execute(
            text("SELECT question, bloom_level FROM generated_questions WHERE question IS NOT NULL AND bloom_level IS NOT NULL")
        )
        rows = result.fetchall()

    print(f"Found {len(rows)} generated questions in the database.")

    with open(OUTPUT_FILE, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["question", "bloom_level", "reviewed"])
        for row in rows:
            writer.writerow([row[0], row[1], False])

    print(f"Saved to {OUTPUT_FILE}")


if __name__ == "__main__":
    main()
