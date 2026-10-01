import os
import json
import logging
import random
import re
import time
from dataclasses import dataclass, field
from concurrent.futures import ThreadPoolExecutor, as_completed
from dotenv import load_dotenv
from file_extractor import clean_extracted_text

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "database.env"))
logger = logging.getLogger(__name__)

client = None
MODEL_NAME = "gemini-flash-lite-latest"


def _get_client():
    global client
    if client is None:
        from google import genai

        client = genai.Client()
    return client


def _get_genai_types():
    from google.genai import types

    return types

AI_DEV_MODE = False
DEV_MODE_MAX_QUESTIONS_PER_TOPIC = 3
MAX_MODULE_LENGTH = 6000
MAX_RETRIES = 3
MAX_WORKERS = 5
MIN_SECONDS_BETWEEN_JOBS = 3
# Raised from 1500 -> syllabi with many topics were getting truncated JSON,
# which silently tripped the except-branch fallback (empty topics).
SYLLABUS_MAX_OUTPUT_TOKENS = 3500
SYLLABUS_TEXT_CHAR_LIMIT = 30000


@dataclass
class GeminiUsageTracker:
    api_call_count: int = 0
    generated_question_count: int = 0
    failure_count: int = 0
    last_error_type: str | None = None
    _token_usage: list[tuple[int | None, int | None, int | None]] = field(default_factory=list)

    def begin_api_call(self) -> None:
        self.api_call_count += 1
        self._token_usage.append((None, None, None))

    def record_response(self, response) -> None:
        metadata = getattr(response, "usage_metadata", None) if response else None

        def token_count(field_name: str) -> int | None:
            if isinstance(metadata, dict):
                value = metadata.get(field_name)
            else:
                value = getattr(metadata, field_name, None)
            return value if isinstance(value, int) and not isinstance(value, bool) else None

        values = (
            token_count("prompt_token_count"),
            token_count("candidates_token_count"),
            token_count("total_token_count"),
        )
        if not self._token_usage:
            self.begin_api_call()
        self._token_usage[-1] = values

    def record_failure(self, error) -> None:
        self.failure_count += 1
        self.last_error_type = type(error).__name__

    def token_totals(self) -> tuple[int | None, int | None, int | None]:
        if not self._token_usage:
            return None, None, None

        totals = []
        for index in range(3):
            values = [usage[index] for usage in self._token_usage]
            totals.append(sum(values) if all(value is not None for value in values) else None)
        return tuple(totals)


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
    "Matching Type": (
        "Generate Matching Type questions with at least five pairs. "
        "Return left_items and right_items with the same length, plus a "
        "complete correct_answer object mapping every left item to its exact "
        "right-item text."
    ),
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
    module_text = clean_extracted_text(module_text).strip()
    if len(module_text) <= MAX_MODULE_LENGTH:
        return module_text
    return _limit_context(module_text, MAX_MODULE_LENGTH)

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


def _normalize_topic_heading(value: str) -> str:
    value = re.sub(r"^\s*#{1,6}\s*", "", value)
    value = re.sub(
        r"^\s*(?:(?:chapter|unit|module|section)\s+)?\d+(?:\.\d+)*(?:\s*[:.)-]\s*|\s+)",
        "",
        value,
        flags=re.IGNORECASE,
    )
    value = re.sub(r"^\s*(?:chapter|unit|module|section)\s+\d+(?:\.\d+)?\s*[:.)-]?\s*", "", value, flags=re.IGNORECASE)
    return " ".join(re.findall(r"[a-z0-9]+", value.casefold()))


def _limit_context(text: str, limit: int) -> str:
    text = (text or "").strip()
    if len(text) <= limit:
        return text

    excerpt = text[:limit]
    boundary = max(excerpt.rfind("\n\n"), excerpt.rfind("\n"))
    if boundary >= limit * 0.75:
        excerpt = excerpt[:boundary]
    return excerpt.strip()


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

    module_text = clean_extracted_text(module_text).strip()
    if not module_text:
        return ""

    normalized_topics = {
        _normalize_topic_heading(name): name
        for name in all_topic_names
        if _normalize_topic_heading(name)
    }
    target_heading = _normalize_topic_heading(topic_name)
    heading_positions = []
    offset = 0
    for line in module_text.splitlines(keepends=True):
        normalized_line = _normalize_topic_heading(line)
        if normalized_line in normalized_topics:
            heading_positions.append((offset, normalized_line))
        offset += len(line)

    target_positions = [
        position for position, heading in heading_positions
        if heading == target_heading
    ]
    if target_positions:
        sections = []
        for position in target_positions:
            next_headings = [
                next_position for next_position, _ in heading_positions
                if next_position > position
            ]
            end = min(next_headings) if next_headings else len(module_text)
            section = module_text[position:end].strip()
            if section:
                sections.append(section)
        if sections:
            return _limit_context(max(sections, key=len), window_chars)

    keywords = _topic_keywords(topic_name)
    matches = []
    for keyword in keywords:
        pattern = re.compile(rf"(?<!\w){re.escape(keyword)}(?!\w)", re.IGNORECASE)
        matches.extend((match.start(), keyword.casefold()) for match in pattern.finditer(module_text))

    if matches:
        paragraphs = [
            paragraph.strip()
            for paragraph in re.split(r"\n\s*\n+", module_text)
            if paragraph.strip()
        ]
        if len(paragraphs) == 1:
            paragraphs = [line.strip() for line in module_text.splitlines() if line.strip()]

        ranked_paragraphs = []
        for index, paragraph in enumerate(paragraphs):
            matched_keywords = {
                keyword.casefold() for keyword in keywords
                if re.search(rf"(?<!\w){re.escape(keyword)}(?!\w)", paragraph, re.IGNORECASE)
            }
            occurrences = sum(
                len(re.findall(rf"(?<!\w){re.escape(keyword)}(?!\w)", paragraph, re.IGNORECASE))
                for keyword in keywords
            )
            if matched_keywords:
                ranked_paragraphs.append((index, (len(matched_keywords), occurrences), paragraph))

        ranked_paragraphs.sort(key=lambda item: (item[1], -len(item[2])), reverse=True)
        selected_paragraphs = []
        selected_length = 0
        for _, _, paragraph in ranked_paragraphs:
            separator_length = 2 if selected_paragraphs else 0
            remaining = window_chars - selected_length - separator_length
            if remaining <= 0:
                break
            if len(paragraph) > remaining:
                if selected_paragraphs:
                    continue
                paragraph = _limit_context(paragraph, remaining)
            excerpt = paragraph.strip()
            if excerpt:
                selected_paragraphs.append(excerpt)
                selected_length += len(excerpt) + separator_length

        return "\n\n".join(selected_paragraphs)

    try:
        idx = all_topic_names.index(topic_name)
    except ValueError:
        idx = 0

    topic_count = max(1, len(all_topic_names))
    chunk_size = max(1, (len(module_text) + topic_count - 1) // topic_count)
    start = idx * chunk_size
    end = min(len(module_text), start + chunk_size)
    return _limit_context(module_text[start:end], window_chars)


# ============================================================
# PROMPT BUILDER
# ============================================================

def build_prompt(subject, topic, ilo, module_text, bloom_distribution):
    module_text = truncate_module(module_text)
    distribution_lines = []
    total_questions = 0
    requested_types = set()
    for bloom, question_types in bloom_distribution.items():
        if not question_types:
            continue
        total_questions += len(question_types)
        requested_types.update(question_types)
        distribution_lines.append(f"- {bloom}: {', '.join(question_types)}")

    bloom_guidance = {
        bloom: BLOOM_DESCRIPTIONS[bloom]
        for bloom in bloom_distribution
        if bloom in BLOOM_DESCRIPTIONS and bloom_distribution[bloom]
    }
    type_guidance = {
        question_type: QUESTION_TYPE_RULES[question_type]
        for question_type in requested_types
        if question_type in QUESTION_TYPE_RULES
    }

    prompt = (
        "Create assessment questions using only the relevant material below.\n"
        f"Subject: {subject}\nTopic: {topic}\nLearning outcome: {ilo}\n\n"
        f"Material:\n{module_text}\n\n"
        f"Bloom targets:\n{json.dumps(bloom_guidance, separators=(',', ':'))}\n"
        f"Generate exactly {total_questions} questions, one for each listed type:\n"
        f"{chr(10).join(distribution_lines)}\n"
        f"Type requirements:\n{json.dumps(type_guidance, separators=(',', ':'))}\n"
        "Keep every question within the topic and supported by the material. Match its Bloom level and type; "
        "use college-level difficulty, distinct wording, plausible distractors, and reasoning for essays. "
        "Situational scenarios must be grounded in the material. Return exactly the requested count as valid JSON only.\n"
        f"{QUESTION_SCHEMA}"
    )
    return prompt, total_questions


# ============================================================
# CORE AI ENGINE WRAPPER (Rerouted from Groq to Gemini)
# ============================================================

def ask_groq(prompt: str, max_tokens: int = 4096, usage_tracker: GeminiUsageTracker | None = None) -> str:
    """
    Maintains the interface name 'ask_groq' to prevent breaking dependencies,
    but routes all payloads directly through Google Gemini's native client.
    """
    logger.info("Sending request to Google Gemini Engine...")

    if usage_tracker:
        usage_tracker.begin_api_call()

    usage_recorded = False
    try:
        config = _get_genai_types().GenerateContentConfig(
            response_mime_type="application/json",
            temperature=0.3,
            max_output_tokens=max_tokens,
            system_instruction="You are an expert assessment generator. Return ONLY valid JSON strings. Never wrap outputs in markdown formatting block boundaries."
        )

        response = _get_client().models.generate_content(
            model=MODEL_NAME,
            contents=prompt,
            config=config
        )
        if usage_tracker:
            usage_tracker.record_response(response)
            usage_recorded = True

        if not response.text:
            raise RuntimeError("Gemini framework returned an empty layout payload.")

        return response.text.strip()

    except Exception as gemini_err:
        if usage_tracker and not usage_recorded:
            usage_tracker.record_response(None)
        if usage_tracker:
            usage_tracker.record_failure(gemini_err)
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

    if question["question_type"] == "Matching Type":
        left_items = question.get("left_items")
        right_items = question.get("right_items")
        correct_answer = question.get("correct_answer")
        if (
            not isinstance(left_items, list)
            or not isinstance(right_items, list)
            or len(left_items) < 5
            or len(left_items) != len(right_items)
            or len(set(left_items)) != len(left_items)
            or len(set(right_items)) != len(right_items)
            or not isinstance(correct_answer, dict)
            or set(correct_answer) != set(left_items)
            or set(correct_answer.values()) != set(right_items)
        ):
            logger.warning("Matching Type must contain at least five unique, complete pairs.")
            return False
    return True


# ============================================================
# RESPONSE VALIDATION
# ============================================================

def validate_response(data, expected_question_count=None):
    if "questions" not in data or not isinstance(data["questions"], list) or len(data["questions"]) == 0:
        return False
    if expected_question_count is not None and len(data["questions"]) != expected_question_count:
        logger.warning(
            "AI returned %s question(s), expected %s.",
            len(data["questions"]),
            expected_question_count,
        )
        return False
    return all(validate_question(q) for q in data["questions"])


# ============================================================
# RETRY ENGINE
# ============================================================

def generate_with_retry(
    prompt,
    max_tokens: int = 4096,
    expected_question_count=None,
    usage_tracker: GeminiUsageTracker | None = None,
):
    last_error = None

    for attempt in range(1, MAX_RETRIES + 1):
        try:
            logger.info(f"AI generation attempt {attempt}")
            raw = ask_groq(prompt, max_tokens=max_tokens, usage_tracker=usage_tracker)
            parsed = parse_ai_response(raw)

            if validate_response(parsed, expected_question_count):
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

def generate_questions_for_topic(
    subject,
    topic,
    ilo,
    module_text,
    question_distribution,
    usage_tracker: GeminiUsageTracker | None = None,
):
    question_distribution = cap_distribution_for_dev(question_distribution)
    prompt, total_questions = build_prompt(
        subject=subject,
        topic=topic,
        ilo=ilo,
        module_text=module_text,
        bloom_distribution=question_distribution,
    )

    max_tokens = estimate_max_tokens(total_questions)
    response = generate_with_retry(
        prompt,
        max_tokens=max_tokens,
        expected_question_count=total_questions,
        usage_tracker=usage_tracker,
    )
    questions = response["questions"]
    if usage_tracker:
        usage_tracker.generated_question_count += len(questions)

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

def generate_questions_from_tos(subject, module_text, tos_data, usage_tracker: GeminiUsageTracker | None = None):
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
            job["distribution"],
            usage_tracker=usage_tracker,
        )
        for q in questions:
            q["topic_name"] = topic["topic_name"]
            if q.get("question_type") == "Matching Type":
                random.shuffle(q["right_items"])
        generated_questions.extend(questions)

        if i < len(jobs) - 1:
            time.sleep(MIN_SECONDS_BETWEEN_JOBS)

    return generated_questions


# ============================================================
# PREVIEW & DATABASE ROW BUILDERS
# ============================================================

def build_preview(generated_questions):
    from classifier import classify_question_ml  # local import to avoid any circular-import issues
    import os
    from datetime import datetime

    log_path = os.path.join(os.path.dirname(__file__), "bloom_comparison_log.txt")

    preview = []
    with open(log_path, "a", encoding="utf-8") as log_file:
        run_stamp = f"--- Run at {datetime.now().isoformat(timespec='seconds')} ---"
        log_file.write(f"\n{run_stamp}\n")
        logger.info(run_stamp)

        for q in generated_questions:
            gemini_guess = q["bloom_level"]
            ml_guess = classify_question_ml(q["question"])
            line = (
                f"AI said: {gemini_guess:<12} | ML model said: {ml_guess:<12} "
                f"| agree: {gemini_guess == ml_guess} | Q: {q['question'][:80]}"
            )
            log_file.write(line + "\n")
            logger.info(line)

            # The trained ML model is authoritative for the Bloom level.
            # Gemini only writes the question text.
            q["bloom_level"] = ml_guess

            preview.append({
                "preview_id": q.get("preview_id"),
                "duplicate_existing_id": q.get("duplicate_existing_id"),
                "question": q["question"],
                "correct_answer": q["correct_answer"],
                "bloom_level": q["bloom_level"],
                "type": q["question_type"],
                "topic_name": q.get("topic_name", ""),
                "options": q.get("options", []),
                "left_items": q.get("left_items", []),
                "right_items": q.get("right_items", []),
                "explanation": q.get("explanation", "")
            })

    return preview


def prepare_database_rows(generated_questions, subject_id):
    rows = []

    for q in generated_questions:
        question_type = q.get("question_type")

        options = q.get("options", [])

        # Matching Type questions use left_items and right_items
        # instead of the normal MCQ options array.
        if question_type == "Matching Type":
            options = {
                "left_items": q.get("left_items", []),
                "right_items": q.get("right_items", []),
            }

        rows.append({
            "subject_id": subject_id,
            "topic_name": q.get("topic_name", ""),
            "question": q["question"],
            "bloom_level": q["bloom_level"],
            "question_type": question_type,
            "points": q.get("points"),
            "options": options,
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


def _call_syllabus_ai(
    text_segment: str,
    max_output_tokens: int,
    usage_tracker: GeminiUsageTracker | None = None,
):
    """
    Executes the syllabus data extraction call using the native Google GenAI SDK.
    """
    prompt = _build_syllabus_prompt(text_segment)

    if usage_tracker:
        usage_tracker.begin_api_call()
    try:
        response = _get_client().models.generate_content(
            model=MODEL_NAME,
            contents=prompt,
            config=_get_genai_types().GenerateContentConfig(
                temperature=0.1,
                max_output_tokens=max_output_tokens,
                response_mime_type="application/json",  # Forces pure structured JSON output
                system_instruction="You are a precise data extraction system. Return valid JSON matching the schema precisely. No markdown block wraps."
            )
        )
    except Exception as error:
        if usage_tracker:
            usage_tracker.record_response(None)
            usage_tracker.record_failure(error)
        raise

    if usage_tracker:
        usage_tracker.record_response(response)

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


def _normalize_ai_value(value, default=""):
    if value is None:
        return default
    if isinstance(value, str):
        return value.strip() or default
    if isinstance(value, dict):
        normalized = " / ".join(
            str(v).strip() for v in value.values() if v is not None and str(v).strip()
        )
        return normalized or default
    if isinstance(value, list):
        normalized = " / ".join(
            str(item).strip() for item in value if item is not None and str(item).strip()
        )
        return normalized or default
    return str(value).strip() or default


def parse_syllabus_text_with_ai(
    full_text: str,
    usage_tracker: GeminiUsageTracker | None = None,
):
    """
    Parses raw syllabus text (including markdown-rendered tables) with the
    Gemini extractor above, mapping each topic to its own row's ILO label
    and outcome description rather than relying on brittle line-by-line
    regex heuristics or conflating the two.
    """
    text_segment = _clean_markdown_noise(full_text[:SYLLABUS_TEXT_CHAR_LIMIT])

    try:
        data = _call_syllabus_ai(text_segment, SYLLABUS_MAX_OUTPUT_TOKENS, usage_tracker)
        logger.info("[SYLLABUS DEBUG] AI extracted structural topic/ILO matrix successfully.")
    except Exception as e:
        if usage_tracker:
            usage_tracker.record_failure(e)
        logger.error(f"AI syllabus parsing exception: {str(e)}")
        return "Fundamentals of Analytics Modeling", "BAT402", []

    formatted_topics = []
    for t in data.get("topics", []):
        ilo_label = _extract_ilo_label(_normalize_ai_value(t.get("ilo_label", "")))
        formatted_topics.append({
            "name": _clean_extracted_topic_name(_normalize_ai_value(t.get("name", "Untitled Topic Module"))),
            "weight": 1.0,
            # Short "ILO N" label -- what's shown in the UI.
            "ilo": ilo_label or "Not specified in CIS -- please review.",
            # Full outcome description -- kept for question-generation
            # context (see generate_questions_from_tos below), not shown
            # verbatim in the UI anymore.
            "ilo_description": _clean_topic_outcome(_normalize_ai_value(t.get("topic_outcome", ""))),
        })

    return (
        data.get("course_title", "Fundamentals of Analytics Modeling"),
        data.get("course_code", "BAT402"),
        formatted_topics,
    )