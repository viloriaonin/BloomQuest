from groq import Groq
from dotenv import load_dotenv
import os

load_dotenv()
client = Groq(api_key=os.getenv("GROQ_API_KEY"))

MODEL = "openai/gpt-oss-20b"

BLOOMS_LEVELS = ["Remember", "Understand", "Apply", "Analyze", "Evaluate", "Create"]

def classify_question(question_text):
    prompt = f"""
    Classify this question into one of the six Bloom's Taxonomy levels:
    Remember, Understand, Apply, Analyze, Evaluate, Create.
    
    Question: "{question_text}"
    
    Return only the level name, nothing else.
    Example: Remember
    """
    response = client.chat.completions.create(
        model=MODEL,
        messages=[{"role": "user", "content": prompt}],
        temperature=0,
    )
    result = response.choices[0].message.content.strip()
    if result not in BLOOMS_LEVELS:
        return "Remember"
    return result