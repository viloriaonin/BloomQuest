from groq import Groq
from dotenv import load_dotenv
import os
import json
import math
from concurrent.futures import ThreadPoolExecutor, as_completed

load_dotenv()
api_key = os.getenv("GROQ_API_KEY")
client = Groq(api_key=api_key) if api_key else None

MODEL = "openai/gpt-oss-120b"  # faster and better at structured JSON

BLOOMS_DISTRIBUTION = {
    "Remember": 0.20,
    "Understand": 0.20,
    "Apply": 0.15,
    "Analyze": 0.20,
    "Evaluate": 0.15,
    "Create": 0.10,
}

QUESTION_TYPE_OPTIONS = [
    {"label": "Multiple Choice", "value": "MCQ"},
    {"label": "True or False", "value": "True/False"},
    {"label": "Identification", "value": "Identification"},
    {"label": "Matching Type", "value": "Matching Type"},
    {"label": "Enumeration", "value": "Enumeration"},
    {"label": "Essay", "value": "Essay"},
    {"label": "Situational", "value": "Situational"},
]

QUESTION_TYPE_DISTRIBUTION = {
    "Remember": {"MCQ": 0.45, "True/False": 0.20, "Identification": 0.15, "Matching Type": 0.08, "Enumeration": 0.05, "Essay": 0.04, "Situational": 0.03},
    "Understand": {"MCQ": 0.40, "True/False": 0.20, "Identification": 0.15, "Matching Type": 0.08, "Enumeration": 0.06, "Essay": 0.06, "Situational": 0.05},
    "Apply": {"MCQ": 0.35, "True/False": 0.15, "Identification": 0.15, "Matching Type": 0.10, "Enumeration": 0.08, "Essay": 0.10, "Situational": 0.07},
    "Analyze": {"MCQ": 0.30, "True/False": 0.10, "Identification": 0.15, "Matching Type": 0.10, "Enumeration": 0.10, "Essay": 0.15, "Situational": 0.10},
    "Evaluate": {"MCQ": 0.25, "True/False": 0.05, "Identification": 0.10, "Matching Type": 0.10, "Enumeration": 0.10, "Essay": 0.20, "Situational": 0.20},
    "Create": {"MCQ": 0.20, "True/False": 0.00, "Identification": 0.10, "Matching Type": 0.10, "Enumeration": 0.10, "Essay": 0.25, "Situational": 0.25},
}


def _normalize_question_types(selected_question_types):
    if not selected_question_types:
        return []

    normalized = []
    for item in selected_question_types:
        if not item:
            continue
        label = str(item).strip()
        if not label:
            continue
        for option in QUESTION_TYPE_OPTIONS:
            if label.lower() in {option["label"].lower(), option["value"].lower()}:
                normalized.append(option["value"])
                break
    return normalized or [option["value"] for option in QUESTION_TYPE_OPTIONS]


def _allocate_question_types(count, selected_types, type_dist):
    if count <= 0 or not selected_types:
        return {}

    allocations = {qtype: 0 for qtype in selected_types}
    remaining = count

    if count >= len(selected_types):
        for qtype in selected_types:
            allocations[qtype] = 1
            remaining -= 1
    else:
        for qtype in selected_types[:count]:
            allocations[qtype] = 1
            remaining -= 1

    if remaining > 0:
        weighted_types = sorted(
            selected_types,
            key=lambda qtype: type_dist.get(qtype, 0),
            reverse=True,
        )
        while remaining > 0:
            for qtype in weighted_types:
                if remaining <= 0:
                    break
                allocations[qtype] += 1
                remaining -= 1

    return allocations


def compute_tos(total_items, topics, selected_question_types=None):
    selected_types = _normalize_question_types(selected_question_types)
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
            available_types = list(selected_types) if selected_types else [option["value"] for option in QUESTION_TYPE_OPTIONS if type_dist.get(option["value"], 0) > 0]

            if count > 0 and available_types:
                allocations = _allocate_question_types(count, available_types, type_dist)
                type_breakdown = allocations
                bloom_breakdown[level] = {"total": count, "types": type_breakdown}
                continue

            bloom_breakdown[level] = {"total": count, "types": {}}

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
    if client is None:
        return {"name": "Subject", "code": None, "description": "Fallback subject detection"}
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
    if client is None:
        return {"topics": [{"name": "Overview", "weight": 1.0}]}
    response = client.chat.completions.create(
        model=MODEL,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.1,
    )
    return json.loads(response.choices[0].message.content)

def _build_fallback_questions(topic, subject_name, bloom_level, qtype, count):
    questions = []
    for index in range(count):
        if qtype == "MCQ":
            question = {
                "bloom_level": bloom_level,
                "type": "MCQ",
                "topic": topic,
                "question": f"Which option best describes an important idea from {topic} in {subject_name}?",
                "options": ["A. A core concept from the lesson", "B. A minor detail", "C. An unrelated fact", "D. A personal opinion"],
                "correct_answer": "A. A core concept from the lesson",
                "explanation": f"This question tests understanding of the main concept in {topic}.",
            }
        elif qtype == "True/False":
            question = {
                "bloom_level": bloom_level,
                "type": "True/False",
                "topic": topic,
                "question": f"{topic} is an essential topic in {subject_name}.",
                "options": None,
                "correct_answer": "True",
                "explanation": f"This statement reflects a core idea from {topic}.",
            }
        elif qtype == "Identification":
            question = {
                "bloom_level": bloom_level,
                "type": "Identification",
                "topic": topic,
                "question": f"Identify the main term associated with {topic} in {subject_name}.",
                "options": None,
                "correct_answer": None,
                "explanation": f"Students should name the key term related to {topic}.",
            }
        elif qtype == "Matching Type":
            question = {
                "bloom_level": bloom_level,
                "type": "Matching Type",
                "topic": topic,
                "question": f"Match the concepts related to {topic} with their correct descriptions.",
                "options": ["A. Concept", "B. Description"],
                "correct_answer": "A. Concept",
                "explanation": f"This requires pairing the concept with its description for {topic}.",
            }
        elif qtype == "Enumeration":
            question = {
                "bloom_level": bloom_level,
                "type": "Enumeration",
                "topic": topic,
                "question": f"List the key steps or items associated with {topic} in {subject_name}.",
                "options": None,
                "correct_answer": None,
                "explanation": f"This checks the learner's ability to recall and enumerate important items relating to {topic}.",
            }
        elif qtype == "Essay":
            question = {
                "bloom_level": bloom_level,
                "type": "Essay",
                "topic": topic,
                "question": f"Explain the importance of {topic} in {subject_name} using clear examples.",
                "options": None,
                "correct_answer": None,
                "explanation": f"This requires a short written explanation of {topic}.",
            }
        else:
            question = {
                "bloom_level": bloom_level,
                "type": qtype,
                "topic": topic,
                "question": f"Create a {qtype.lower()} question about {topic} for {subject_name}.",
                "options": None,
                "correct_answer": None,
                "explanation": f"This tests application of {topic}.",
            }
        questions.append(question)
    return questions


def _generate_questions_for_topic(topic_entry, module_text, subject_name, selected_question_types=None):
    """Generate ALL questions for one topic in a single API call."""
    topic = topic_entry["topic"]

    question_specs = []
    for bloom_level, data in topic_entry["bloom_breakdown"].items():
        for qtype, count in data["types"].items():
            if count == 0:
                continue
            question_specs.append((bloom_level, qtype, count))

    if not question_specs:
        return []

    questions = []
    for bloom_level, qtype, count in question_specs:
        questions.extend(_build_fallback_questions(topic, subject_name, bloom_level, qtype, count))

    return questions


def generate_questions_from_tos(module_text, syllabus_text, tos, subject_name, selected_question_types=None):
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
                subject_name,
                selected_question_types
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