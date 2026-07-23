import os
import json
import logging
import re
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from google import genai
from google.genai import types
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)

# Initialize official SDK client using the fresh environment credential
client = genai.Client()
MODEL_NAME = "gemini-flash-lite-latest"

AI_DEV_MODE = False
MAX_MODULE_LENGTH = 6000
MAX_RETRIES = 3
MAX_WORKERS = 5
MIN_SECONDS_BETWEEN_JOBS = 3
# Raised from 1500 -> syllabi with many topics were getting truncated JSON,
# which silently tripped the except-branch fallback (empty topics).
SYLLABUS_MAX_OUTPUT_TOKENS = 3500
SYLLABUS_TEXT_CHAR_LIMIT = 30000


class GroqDailyQuotaExceeded(RuntimeError):
    """
    Retained explicitly so that external routers can import this exception
    signature without causing initialization failures inside your application.
    """
    def __init__(self, message: str, wait_seconds: float = None):
        super().__init__(message)
        self.wait_seconds = wait_seconds


# ============================================================
# BLOOM'S TAXONOMY DEFINITIONS
# ============================================================

BLOOM_DESCRIPTIONS = {
    "Remember": "Recall facts, definitions, lists, terms and basic concepts.",
    "Understand": "Explain ideas, summarize concepts, classify, interpret information.",
    "Apply": "Solve problems using learned concepts in new situations.",
    "Analyze": "Differentiate, compare, organize, investigate relationships.",
    "Evaluate": "Judge, critique, justify, defend decisions using evidence.",
    "Create": "Design, formulate, invent or construct something original."
}


# ============================================================
# QUESTION TYPE RULES
# ============================================================

QUESTION_TYPE_RULES = {
    "MCQ": (
        "Generate Multiple Choice Questions.\nRequirements\n"
        "• Exactly four options.\n• Exactly one correct answer.\n"
        "• Three plausible distractors.\n• Do not make the correct answer obvious."
    ),
    "True or False": "Generate True or False questions. Correct answer must be True or False.",
    "Identification": "Generate Identification questions. No options. Correct answer should be concise.",
    "Essay": "Generate Essay questions. No options. Require critical thinking. Should not be answerable by one word.",
    "Enumeration": "Generate Enumeration questions. State clearly how many answers are expected.",
    "Matching Type": "Generate Matching Type questions. Return left_items, right_items, correct_answer",
    "Situational": "Generate scenario-based questions. The scenario must come from the uploaded module. Require application or analysis."
}


# ============================================================
# JSON RESPONSE FORMAT
# ============================================================

QUESTION_SCHEMA = """
Return ONLY valid JSON.
{
    "questions":[
        {
            "bloom_level":"Remember",
            "question_type":"MCQ",
            "question":"",
            "options": ["A","B","C","D"],
            "correct_answer": "A",
            "explanation":"..."
        }
    ]
}
Never return markdown formatting codeblocks. Never use ```. Never explain. Return JSON only.
"""

# ============================================================
# HELPERS
# ============================================================

def truncate_module(module_text: str):
    if not module_text:
        return ""
    module_text = module_text.strip()
    if len(module_text) <= MAX_MODULE_LENGTH:
        return module_text
    return module_text[:MAX_MODULE_LENGTH]

_ILO_LABEL_RE = re.compile(
    r"ILO\s*[-#]?\s*\d+(?:\s*(?:,|&|and)\s*ILO\s*[-#]?\s*\d+)*",
    re.IGNORECASE,
)

_ILO_TOKEN_RE = re.compile(r"ILO\s*[-#]?\s*(\d+)", re.IGNORECASE)
_READING_LIST_LINE_RE = re.compile(r"reading\s*list.*", re.IGNORECASE)


def _extract_ilo_label(raw_ilo: str) -> str:
    """
    Returns just the short ILO label(s) as stated in the CIS's own ILO
    column -- e.g. "ILO 1" or "ILO 1, ILO 2" -- normalized to a
    consistent "ILO N" format and deduped. If the input has no ILO
    token in it, there's nothing safe to shorten to, so the raw text is
    returned as-is rather than inventing a number.
    """
    if not raw_ilo:
        return raw_ilo
    numbers = _ILO_TOKEN_RE.findall(raw_ilo)
    if not numbers:
        return raw_ilo.strip()
    labels = []
    for n in numbers:
        label = f"ILO {n}"
        if label not in labels:
            labels.append(label)
    return ", ".join(labels)


def _clean_extracted_topic_name(name: str) -> str:
    """
    Keeps only the chapter/topic title. The "Topics / Reading List"
    column in this CIS format stacks the title, sub-bullets, and
    Reading List references together (separated by line breaks or
    " - "), so this is a defense-in-depth cut to the first line/segment
    in case the AI doesn't fully obey the prompt's "title only" rule.
    """
    if not name:
        return name
    first_line = re.split(r"\s*-\s*|\n", name.strip())[0]
    return first_line.strip()


def _clean_topic_outcome(outcome: str) -> str:
    """Strips any stray 'Reading List: ...' line that leaks into the
    Topic Outcomes text (e.g. from a merged PDF table cell)."""
    if not outcome:
        return outcome
    return _READING_LIST_LINE_RE.sub("", outcome).strip()

def cap_distribution_for_dev(bloom_distribution: dict) -> dict:
    if not AI_DEV_MODE:
        return bloom_distribution

    capped = {}
    remaining = DEV_MODE_MAX_QUESTIONS_PER_TOPIC

    for bloom, question_types in bloom_distribution.items():
        if remaining <= 0:
            break
        if not question_types:
            continue

        take = question_types[:remaining]
        capped[bloom] = take
        remaining -= len(take)

    if capped:
        logger.info(
            f"AI_DEV_MODE on — capped distribution to {DEV_MODE_MAX_QUESTIONS_PER_TOPIC} question(s)/topic."
        )
    return capped


def estimate_max_tokens(total_questions: int) -> int:
    if total_questions <= 0:
        total_questions = 1
    return min(8000, 800 + (total_questions * 400))


# ============================================================
# TOPIC-AWARE MODULE SLICING
# ============================================================

_STOPWORDS = {
    "chapter", "unit", "the", "and", "of", "to", "in", "for", "with",
    "introduction", "overview", "concepts", "basic", "advanced",
}


def _topic_keywords(topic_name: str):
    clean_name = re.sub(r"^Chapter\s*\d+(\.\d+)?\s*:\s*", "", topic_name, flags=re.IGNORECASE).strip()
    words = re.findall(r"[A-Za-z]{4,}", clean_name)
    return [w for w in words if w.lower() not in _STOPWORDS]


def extract_topic_section(
    module_text: str,
    topic_name: str,
    all_topic_names: list,
    window_chars: int = MAX_MODULE_LENGTH,
):
    if not module_text:
        return ""

    module_text = module_text.strip()

    # Only skip slicing when the whole doc already fits in the window
    # we're about to hand the AI. Previously this compared against a
    # fixed 35,000-char threshold unrelated to window_chars (6000), so
    # modules under 35k were returned whole here and then silently cut
    # to the same first 6000 chars for every topic inside
    # build_prompt()'s truncate_module() call -- meaning every topic in
    # a typical module was generated from the same first few pages
    # instead of its own section.
    if len(module_text) <= window_chars:
        return module_text

    keywords = _topic_keywords(topic_name)
    lower_text = module_text.lower()

    match_positions = []
    for kw in keywords:
        idx = lower_text.find(kw.lower())
        if idx != -1:
            match_positions.append(idx)

    if match_positions:
        anchor = min(match_positions)
        start = max(0, anchor - 400)
        end = min(len(module_text), start + window_chars)
        return module_text[start:end]

    try:
        idx = all_topic_names.index(topic_name)
    except ValueError:
        idx = 0

    topic_count = max(1, len(all_topic_names))
    chunk_size = max(1, len(module_text) // topic_count)
    start = idx * chunk_size
    end = min(len(module_text), start + max(chunk_size, window_chars))

    section = module_text[start:end]
    return section if section.strip() else truncate_module(module_text)


# ============================================================
# PROMPT BUILDER
# ============================================================

def build_prompt(subject, topic, ilo, module_text, bloom_distribution):
    module_text = truncate_module(module_text)
    instructions = []
    total_questions = 0

    for bloom, question_types in bloom_distribution.items():
        if not question_types:
            continue
        total_questions += len(question_types)
        instructions.append(f"- {bloom}: {len(question_types)} question(s) using {', '.join(question_types)}")

    distribution = "\n".join(instructions)

    prompt = f"""
You are an expert university professor, assessment specialist, and Bloom's Taxonomy expert.

==================================================
COURSE INFORMATION
==================================================
Subject: {subject}
Topic: {topic}
Intended Learning Outcome: {ilo}

==================================================
LEARNING MATERIAL
==================================================
{module_text}

==================================================
BLOOM'S TAXONOMY
==================================================
{json.dumps(BLOOM_DESCRIPTIONS, indent=2)}

==================================================
QUESTION REQUIREMENTS
==================================================
Generate EXACTLY {total_questions} questions. Follow this distribution EXACTLY:
{distribution}

==================================================
QUESTION TYPE RULES
==================================================
{json.dumps(QUESTION_TYPE_RULES, indent=2)}

==================================================
STRICT RULES
==================================================
1. Generate ONLY questions that are explicitly supported by the text provided in the LEARNING MATERIAL section.
2. Every question generated must specifically target and be guided by the assigned boundaries of the current Topic: {topic}.
3. Every question must match its assigned Bloom level.
4. Every question must match its assigned question type.
5. Difficulty should be appropriate for college students.
6. Avoid duplicate questions.
7. Avoid repeating the same wording.
8. Make distractors realistic.
9. Essay questions must require reasoning.
10. Situational questions must use realistic scenarios.
11. Return EXACTLY {total_questions} questions.
12. Return ONLY valid JSON.

OUTPUT FORMAT
{QUESTION_SCHEMA}
"""
    return prompt, total_questions


# ============================================================
# CORE AI ENGINE WRAPPER (Rerouted from Groq to Gemini)
# ============================================================

def ask_groq(prompt: str, max_tokens: int = 4096) -> str:
    """
    Maintains the interface name 'ask_groq' to prevent breaking dependencies,
    but routes all payloads directly through Google Gemini's native client.
    """
    logger.info("Sending request to Google Gemini Engine...")

    try:
        config = types.GenerateContentConfig(
            response_mime_type="application/json",
            temperature=0.3,
            max_output_tokens=max_tokens,
            system_instruction="You are an expert assessment generator. Return ONLY valid JSON strings. Never wrap outputs in markdown formatting block boundaries."
        )

        response = client.models.generate_content(
            model=MODEL_NAME,
            contents=prompt,
            config=config
        )

        if not response.text:
            raise RuntimeError("Gemini framework returned an empty layout payload.")

        return response.text.strip()

    except Exception as gemini_err:
        logger.error(f"Gemini generation failure event: {gemini_err}")
        raise RuntimeError(f"Gemini API execution error exception block: {str(gemini_err)}")


# ============================================================
# JSON PARSER
# ============================================================

def parse_ai_response(response_text: str):
    if not response_text:
        raise ValueError("Empty response from AI.")

    text = response_text.strip()
    if text.startswith("```json"): text = text[7:]
    if text.startswith("```"): text = text[3:]
    if text.endswith("```"): text = text[:-3]
    return json.loads(text.strip())


# ============================================================
# QUESTION VALIDATION
# ============================================================

def validate_question(question):
    required = ["bloom_level", "question_type", "question", "correct_answer", "explanation"]
    for field in required:
        if field not in question:
            logger.warning(f"Missing field: {field}")
            return False

    if question["question_type"] == "MCQ":
        options = question.get("options", [])
        if len(options) != 4:
            logger.warning("MCQ does not have four options.")
            return False
    return True


# ============================================================
# RESPONSE VALIDATION
# ============================================================

def validate_response(data):
    if "questions" not in data or not isinstance(data["questions"], list) or len(data["questions"]) == 0:
        return False
    return all(validate_question(q) for q in data["questions"])


# ============================================================
# RETRY ENGINE
# ============================================================

def generate_with_retry(prompt, max_tokens: int = 4096):
    last_error = None

    for attempt in range(1, MAX_RETRIES + 1):
        try:
            logger.info(f"AI generation attempt {attempt}")
            raw = ask_groq(prompt, max_tokens=max_tokens)
            parsed = parse_ai_response(raw)

            if validate_response(parsed):
                logger.info("AI generation successful.")
                return parsed

            raise RuntimeError("Generated JSON failed validation.")
        except Exception as e:
            last_error = e
            logger.warning(f"Retry {attempt} failed: {e}")
            time.sleep(1)

    raise RuntimeError(f"Generation engine failed after execution limit retries.\n{last_error}")


# ============================================================
# AI GENERATION FOR A SINGLE TOPIC
# ============================================================

def generate_questions_for_topic(subject, topic, ilo, module_text, question_distribution):
    question_distribution = cap_distribution_for_dev(question_distribution)
    prompt, total_questions = build_prompt(
        subject=subject,
        topic=topic,
        ilo=ilo,
        module_text=module_text,
        bloom_distribution=question_distribution,
    )

    max_tokens = estimate_max_tokens(total_questions)
    response = generate_with_retry(prompt, max_tokens=max_tokens)
    questions = response["questions"]

    for question in questions:
        question["topic_name"] = topic
    return questions


# ============================================================
# PARALLEL QUESTION GENERATION
# ============================================================

def generate_parallel_jobs(jobs):
    generated_questions = []
    logger.info(f"Generating questions for {len(jobs)} topic(s)...")

    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        future_map = {
            executor.submit(
                generate_questions_for_topic,
                subject=job["subject"],
                topic=job["topic"],
                ilo=job["ilo"],
                module_text=job["module"],
                question_distribution=job["distribution"],
            ): job["topic"] for job in jobs
        }

        for future in as_completed(future_map):
            topic_name = future_map[future]
            try:
                questions = future.result()
                generated_questions.extend(questions)
                logger.info(f"{len(questions)} questions generated for '{topic_name}'.")
            except Exception as e:
                logger.exception(f"Generation failed for {topic_name}: {e}")
                raise

    logger.info(f"Finished generating {len(generated_questions)} questions.")
    return generated_questions


# ============================================================
# TOS -> AI GENERATION
# ============================================================

def generate_questions_from_tos(subject, module_text, tos_data):
    all_topic_names = [t["topic_name"] for t in tos_data]
    jobs = []

    for topic in tos_data:
        topic_module_text = extract_topic_section(
            module_text=module_text,
            topic_name=topic["topic_name"],
            all_topic_names=all_topic_names,
        )
        # Question generation benefits from the full outcome description
        # (topic["ilo_description"]) rather than the short "ILO 1" label --
        # the label alone carries no content to guide the AI. Fall back to
        # the label only if no description was captured.
        ilo_context = topic.get("ilo_description") or topic.get("ilo", "")
        jobs.append({
            "subject": f"{subject['code']} - {subject['name']}",
            "topic": topic["topic_name"],
            "ilo": ilo_context,
            "module": topic_module_text,
            "distribution": topic["question_distribution"]
        })

    logger.info(f"Prepared {len(jobs)} AI generation jobs.")
    generated_questions = []

    for i, (topic, job) in enumerate(zip(tos_data, jobs)):
        questions = generate_questions_for_topic(
            job["subject"],
            job["topic"],
            job["ilo"],
            job["module"],
            job["distribution"]
        )
        for q in questions:
            q["topic_name"] = topic["topic_name"]
        generated_questions.extend(questions)

        if i < len(jobs) - 1:
            time.sleep(MIN_SECONDS_BETWEEN_JOBS)

    return generated_questions


# ============================================================
# PREVIEW & DATABASE ROW BUILDERS
# ============================================================

def build_preview(generated_questions):
    preview = []
    for q in generated_questions:
        preview.append({
            "question": q["question"],
            "correct_answer": q["correct_answer"],
            "bloom_level": q["bloom_level"],
            "type": q["question_type"],
            "topic_name": q.get("topic_name", ""),
            "options": q.get("options", []),
            "explanation": q.get("explanation", "")
        })
    return preview


def prepare_database_rows(generated_questions, subject_id):
    rows = []
    for q in generated_questions:
        rows.append({
            "subject_id": subject_id,
            "topic_name": q.get("topic_name", ""),
            "question": q["question"],
            "bloom_level": q["bloom_level"],
            "question_type": q["question_type"],
            "options": q.get("options", []),
            "correct_answer": q["correct_answer"],
            "explanation": q.get("explanation", "")
        })
    return rows


def statistics(generated_questions):
    bloom_stats, type_stats, topic_stats = {}, {}, {}
    for q in generated_questions:
        bloom = q["bloom_level"]
        qtype = q["question_type"]
        topic = q.get("topic_name", "Unknown")

        bloom_stats[bloom] = bloom_stats.get(bloom, 0) + 1
        type_stats[qtype] = type_stats.get(qtype, 0) + 1
        topic_stats[topic] = topic_stats.get(topic, 0) + 1

    return {
        "total_questions": len(generated_questions),
        "bloom_distribution": bloom_stats,
        "question_types": type_stats,
        "topics": topic_stats
    }


# ============================================================
# SYLLABUS PARSING (single source of truth — do not duplicate this
# function elsewhere in the file; a second definition further down
# would silently shadow this one and be very hard to notice).
# ============================================================

def _build_syllabus_prompt(text_segment: str) -> str:
    return f"""
You are a precise data extraction system analyzing raw text extracted from a
university syllabus/Course Information Sheet (CIS). You are NOT a writer or
summarizer. Your job is to copy information exactly as it appears in the
source text, not to rephrase, clean up, or improve it.

The CIS contains a "Teaching, Learning, and Assessment (TLA) Activities"
table with (at minimum) these columns, in this order:
  Ch. | Wks | Topics / Reading List | Topic Outcomes | ILO | SO | Delivery Method

Extract the Course Title, Course Code, and one entry per MAIN topic row from
this table, mapping each to THREE separate pieces of information pulled from
THREE separate columns of that SAME row:

  1. "name"          <- from the "Topics / Reading List" column
  2. "ilo_label"      <- from the "ILO" column
  3. "topic_outcome"  <- from the "Topic Outcomes" column

These three columns hold different things and must NOT be merged or
confused with each other.

STRICT EXTRACTION RULES — READ CAREFULLY:

1. "name" (Topics / Reading List column): copy ONLY the chapter/topic
   TITLE itself, exactly as written -- e.g. "Introduction to Predictive
   Analytics". This column typically also lists sub-bullets (e.g.
   "- Predictive Analytics", "- Supervised Learning and Unsupervised
   Learning") and "Reading List: ..." references stacked underneath the
   title in the same cell. Do NOT include any of those sub-bullets or
   Reading List lines in "name" -- take only the first line (the title).

2. "ilo_label" (ILO column): copy EXACTLY what appears in the ILO column
   for that row -- e.g. "ILO1", or "ILO1, ILO2" if more than one is
   listed for that row. This is a short code, NOT a sentence. Do not
   invent a number if the column is blank for that row -- in that case
   return an empty string for "ilo_label".

3. "topic_outcome" (Topic Outcomes column): copy the outcome
   description text VERBATIM, word-for-word, from the Topic Outcomes
   column of that SAME row. Do not paraphrase, do not summarize. If a
   row spans multiple outcome lines/bullets, include all of them,
   joined with a single space. Never pull this from the ILO column or
   from any other row.

4. Never borrow a value for one row from a different row -- these
   tables place topics on consecutive lines, and misalignment (e.g.
   using row 2's ILO for row 1's topic) is the single most common
   extraction error. Match strictly by row.

5. Only if the ILO column is genuinely empty/absent for a topic (not
   merely unclear) may "ilo_label" be an empty string. Do not guess.

6. Extract ONLY major syllabus modules/topics (e.g., "Chapter 1: ...",
   or unlabeled major topic titles like "Introduction to Predictive
   Analytics"). Exclude minor sub-bullets, tool lists, reading-list
   references, orientation/policy sections, grading tables, and
   standalone lab-activity rows that don't introduce a new topic --
   those belong to the topic above them, not their own entries.

7. Do not return any introductory remarks, explanations, or
   conversational filler — JSON only.

8. If the source text is cut off mid-topic (incomplete), still extract
   what's there rather than omitting it or inventing what would come
   next.

Return ONLY a valid JSON object matching this exact schema:
{{
  "course_title": "Full Name of the Course",
  "course_code": "SUBJECT-CODE",
  "topics": [
    {{
      "name": "Title copied verbatim from the Topics/Reading List column, title line only",
      "ilo_label": "Copied verbatim from the ILO column, e.g. ILO1 or ILO1, ILO2",
      "topic_outcome": "The outcome description copied verbatim from the Topic Outcomes column of the same row"
    }}
  ]
}}

RAW SYLLABUS TEXT SEGMENT:
{text_segment}
"""


def _call_syllabus_ai(text_segment: str, max_output_tokens: int):
    """
    Executes the syllabus data extraction call using the native Google GenAI SDK.
    """
    prompt = _build_syllabus_prompt(text_segment)

    response = client.models.generate_content(
        model=MODEL_NAME,
        contents=prompt,
        config=types.GenerateContentConfig(
            temperature=0.1,
            max_output_tokens=max_output_tokens,
            response_mime_type="application/json",  # Forces pure structured JSON output
            system_instruction="You are a precise data extraction system. Return valid JSON matching the schema precisely. No markdown block wraps."
        )
    )

    if not response or not response.text:
        raise RuntimeError("Gemini returned an empty response block.")

    content = response.text.strip()

    # Clean residual markdown blocks if they slip through
    if content.startswith("```json"): content = content[7:]
    if content.startswith("```"): content = content[3:]
    if content.endswith("```"): content = content[:-3]

    return json.loads(content.strip())


def _clean_markdown_noise(text: str) -> str:
    if not text:
        return text
    text = re.sub(r"<br\s*/?>", " ", text, flags=re.IGNORECASE)
    text = re.sub(r"\*\*(.*?)\*\*", r"\1", text)
    text = re.sub(r"~~(.*?)~~", r"\1", text)
    text = re.sub(r"(?<!\w)_(.+?)_(?!\w)", r"\1", text)
    return text


def parse_syllabus_text_with_ai(full_text: str):
    """
    Parses raw syllabus text (including markdown-rendered tables) with the
    Gemini extractor above, mapping each topic to its own row's ILO label
    and outcome description rather than relying on brittle line-by-line
    regex heuristics or conflating the two.
    """
    text_segment = _clean_markdown_noise(full_text[:SYLLABUS_TEXT_CHAR_LIMIT])

    try:
        data = _call_syllabus_ai(text_segment, SYLLABUS_MAX_OUTPUT_TOKENS)
        logger.info("[SYLLABUS DEBUG] AI extracted structural topic/ILO matrix successfully.")
    except Exception as e:
        logger.error(f"AI syllabus parsing exception: {str(e)}")
        return "Fundamentals of Analytics Modeling", "BAT402", []

    formatted_topics = []
    for t in data.get("topics", []):
        ilo_label = _extract_ilo_label(t.get("ilo_label", ""))
        formatted_topics.append({
            "name": _clean_extracted_topic_name(t.get("name", "Untitled Topic Module")),
            "weight": 1.0,
            # Short "ILO N" label -- what's shown in the UI.
            "ilo": ilo_label or "Not specified in CIS -- please review.",
            # Full outcome description -- kept for question-generation
            # context (see generate_questions_from_tos below), not shown
            # verbatim in the UI anymore.
            "ilo_description": _clean_topic_outcome(t.get("topic_outcome", "")),
        })

    return (
        data.get("course_title", "Fundamentals of Analytics Modeling"),
        data.get("course_code", "BAT402"),
        formatted_topics,
    )
