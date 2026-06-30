from groq import Groq
from dotenv import load_dotenv
import os
import json
import math
from concurrent.futures import ThreadPoolExecutor, as_completed

load_dotenv()
client = Groq(api_key=os.getenv("GROQ_API_KEY"))

MODEL = "openai/gpt-oss-120b"  # faster and better at structured JSON

BLOOMS_DISTRIBUTION = {
    "Remember": 0.20,
    "Understand": 0.20,
    "Apply": 0.15,
    "Analyze": 0.20,
    "Evaluate": 0.15,
    "Create": 0.10,
}

QUESTION_TYPE_DISTRIBUTION = {
    "Remember":   {"MCQ": 0.50, "True/False": 0.30, "Identification": 0.20, "Essay": 0.00},
    "Understand": {"MCQ": 0.50, "True/False": 0.25, "Identification": 0.25, "Essay": 0.00},
    "Apply":      {"MCQ": 0.40, "True/False": 0.20, "Identification": 0.20, "Essay": 0.20},
    "Analyze":    {"MCQ": 0.40, "True/False": 0.10, "Identification": 0.20, "Essay": 0.30},
    "Evaluate":   {"MCQ": 0.30, "True/False": 0.10, "Identification": 0.20, "Essay": 0.40},
    "Create":     {"MCQ": 0.20, "True/False": 0.00, "Identification": 0.20, "Essay": 0.60},
}

def compute_tos(total_items, topics):
    tos = []
    for i, topic in enumerate(topics):
        is_last = i == len(topics) - 1
        topic_weight = topic.get("weight", 1.0 / len(topics))
        topic_items = round(total_items * topic_weight)
        if is_last:
            assigned = sum(t["total_items"] for t in tos)
            topic_items = total_items - assigned

        bloom_items = {}
        bloom_remaining = topic_items
        bloom_levels = list(BLOOMS_DISTRIBUTION.keys())

        for j, level in enumerate(bloom_levels):
            if j == len(bloom_levels) - 1:
                bloom_items[level] = bloom_remaining
            else:
                count = math.floor(topic_items * BLOOMS_DISTRIBUTION[level])
                bloom_items[level] = count
                bloom_remaining -= count

        bloom_breakdown = {}
        for level, count in bloom_items.items():
            type_dist = QUESTION_TYPE_DISTRIBUTION[level]
            type_breakdown = {}
            type_remaining = count
            types = list(type_dist.keys())
            for k, qtype in enumerate(types):
                if k == len(types) - 1:
                    type_breakdown[qtype] = type_remaining
                else:
                    n = math.floor(count * type_dist[qtype])
                    type_breakdown[qtype] = n
                    type_remaining -= n
            bloom_breakdown[level] = {"total": count, "types": type_breakdown}

        tos.append({
            "topic": topic["name"],
            "weight": round(topic_weight * 100, 1),
            "total_items": topic_items,
            "bloom_breakdown": bloom_breakdown
        })
    return tos

def detect_subject(syllabus_text):
    prompt = f"""
    Extract subject info from this syllabus.
    Return JSON only, no markdown, no extra text.
    Format: {{"name": "Subject Name", "code": "CODE101", "description": "Brief description"}}
    SYLLABUS: {syllabus_text[:2000]}
    """
    response = client.chat.completions.create(
        model=MODEL,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.1,
    )
    return json.loads(response.choices[0].message.content)

def detect_topics(syllabus_text, module_text):
    prompt = f"""
    Extract main topics with weights from this syllabus and module.
    Weights must add up to exactly 1.0.
    Return JSON only, no markdown, no extra text.
    Format: {{"topics": [{{"name": "Topic 1", "weight": 0.30}}, ...]}}
    SYLLABUS: {syllabus_text[:2000]}
    MODULE: {module_text[:2000]}
    """
    response = client.chat.completions.create(
        model=MODEL,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.1,
    )
    return json.loads(response.choices[0].message.content)

def _generate_questions_for_topic(topic_entry, module_text, subject_name):
    """Generate ALL questions for one topic in a single API call."""
    topic = topic_entry["topic"]

    # Build a summary of what questions are needed
    question_specs = []
    for bloom_level, data in topic_entry["bloom_breakdown"].items():
        for qtype, count in data["types"].items():
            if count == 0:
                continue
            question_specs.append(f"- {count} {qtype} question(s) at Bloom's {bloom_level} level")

    if not question_specs:
        return []

    specs_text = "\n".join(question_specs)

    prompt = f"""
    Generate questions about "{topic}" for the subject "{subject_name}".
    
    Required questions:
    {specs_text}
    
    Rules:
    - MCQ: must have 4 choices (A-D) and one correct answer
    - True/False: clear statement, correct answer is "True" or "False"
    - Identification: one word or short phrase answer, options is null
    - Essay: open-ended question, options is null, correct_answer is null
    
    Return JSON only, no markdown, no extra text.
    Format:
    {{
        "questions": [
            {{
                "bloom_level": "Remember",
                "type": "MCQ",
                "topic": "{topic}",
                "question": "Question here?",
                "options": ["A. opt1", "B. opt2", "C. opt3", "D. opt4"],
                "correct_answer": "A. opt1",
                "explanation": "Why this is correct"
            }}
        ]
    }}
    
    MODULE CONTEXT: {module_text[:3000]}
    """

    response = client.chat.completions.create(
        model=MODEL,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.7,
    )

    result = json.loads(response.choices[0].message.content)
    return result.get("questions", [])


def generate_questions_from_tos(module_text, syllabus_text, tos, subject_name):
    """
    Generate questions for ALL topics in parallel.
    One API call per topic instead of one per question type.
    """
    all_questions = []

    # Run all topic generations in parallel (max 5 threads to avoid rate limits)
    with ThreadPoolExecutor(max_workers=5) as executor:
        futures = {
            executor.submit(
                _generate_questions_for_topic,
                topic_entry,
                module_text,
                subject_name
            ): topic_entry["topic"]
            for topic_entry in tos
        }

        for future in as_completed(futures):
            topic_name = futures[future]
            try:
                questions = future.result()
                all_questions.extend(questions)
                print(f"✓ Generated {len(questions)} questions for topic: {topic_name}")
            except Exception as e:
                print(f"✗ Failed to generate questions for topic '{topic_name}': {e}")

    return all_questions