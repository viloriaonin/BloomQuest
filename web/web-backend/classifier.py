import os
import logging
from pathlib import Path
from google import genai
from dotenv import load_dotenv

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

def classify_question(question_text: str, *args, **kwargs) -> str:
    """
    Classifies an evaluation question into a definitive Bloom's Taxonomy level
    using a live, non-mocked dynamic Google Gemini endpoint.
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
