import os
import logging
from pathlib import Path
from google import genai
from dotenv import load_dotenv
from predict_bloom import predict_bloom_level

logger = logging.getLogger(__name__)

# Load the project-specific environment file that stores the Gemini key.
load_dotenv(dotenv_path=str(Path(__file__).resolve().parent / "database.env"))

api_key = os.getenv("GEMINI_API_KEY")
if api_key:
    client = genai.Client(api_key=api_key)
else:
    client = None
    logger.warning("GEMINI_API_KEY is not set. Manual classification will fall back to 'Understand' instead of crashing.")

MODEL_NAME = "gemini-flash-lite-latest"

# Maps the trained model's short codes (BT1..BT6) to the same plain-word
# labels the Gemini classifier already returns, so both are interchangeable.
BT_CODE_TO_LABEL = {
    "BT1": "Remember",
    "BT2": "Understand",
    "BT3": "Apply",
    "BT4": "Analyze",
    "BT5": "Evaluate",
    "BT6": "Create",
}


def classify_question(question_text: str, *args, **kwargs) -> str:
    """
    Classifies an evaluation question into a definitive Bloom's Taxonomy level
    using a live, non-mocked dynamic Google Gemini endpoint.

    (Unchanged from before — still the function the rest of the app uses.)
    """
    prompt = (
        f"Classify this question text into exactly ONE level of Bloom's Taxonomy "
        f"(Remember, Understand, Apply, Analyze, Evaluate, Create).\n"
        f"Return ONLY the single word answer.\n\n"
        f"Question: {question_text}"
    )

    if client is None:
        logger.warning("Skipping Gemini classification because no API key is configured.")
        return "Understand"

    try:
        response = client.models.generate_content(
            model=MODEL_NAME,
            contents=prompt
        )

        if not response or not response.text:
            return "Understand"

        result = response.text.strip()

        # Clean up punctuation or formatting noise if the model introduces any
        result = result.replace('"', '').replace("'", "").replace(".", "").replace("*", "")

        valid_levels = ["Remember", "Understand", "Apply", "Analyze", "Evaluate", "Create"]

        # Exact match check
        if result in valid_levels:
            logger.info(f"Successfully classified question live to: {result}")
            return result

        # Fallback structural keyword lookup scan
        for level in valid_levels:
            if level.lower() in result.lower():
                logger.info(f"Keyword matched classification fallback to: {level}")
                return level

        return "Understand"

    except Exception as e:
        logger.error(f"Classification live link runtime error occurred: {str(e)}")
        return "Understand"


def classify_question_ml(question_text: str) -> str:
    """
    Classifies a question using the locally trained ML model
    (TF-IDF + Logistic Regression, trained on ~8,700 real questions).

    Returns the same plain-word format as classify_question(), e.g. "Understand".
    No API key or internet connection needed — this runs entirely offline.
    """
    try:
        result = predict_bloom_level(question_text)
        return BT_CODE_TO_LABEL.get(result["level_code"], "Understand")
    except Exception as e:
        logger.error(f"ML classifier error: {str(e)}")
        return "Understand"


def classify_question_dual(question_text: str) -> dict:
    """
    Runs BOTH classifiers on the same question and returns both results
    together, for comparison/logging. Does not change what the rest of
    the app currently sees from classify_question().
    """
    gemini_result = classify_question(question_text)

    ml_raw = predict_bloom_level(question_text)
    ml_result = BT_CODE_TO_LABEL.get(ml_raw["level_code"], "Understand")

    return {
        "gemini": gemini_result,
        "ml_model": ml_result,
        "ml_confidence": ml_raw["confidence"],
        "agree": gemini_result == ml_result,
    }