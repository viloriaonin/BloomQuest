# routers/assessment.py
from fastapi import APIRouter, HTTPException, Depends, Form
from fastapi.responses import FileResponse
from fastapi.background import BackgroundTasks
from sqlalchemy.orm import Session
from docx import Document
from docx.shared import Pt
from docx.enum.text import WD_ALIGN_PARAGRAPH
import os, uuid, tempfile, json
import pythoncom
from docx2pdf import convert
from database import get_db
import models

router = APIRouter(prefix="/api/assessment", tags=["Assessment"])

# Second router so the path matches exactly what the frontend calls:
# POST /api/questions/export
export_router = APIRouter(prefix="/api/questions", tags=["Questions"])

TEMP_DIR = tempfile.gettempdir()


def _normalize_question_type(question_type: str | None) -> str:
    return question_type or "Unspecified"


def _clean_letter_value(value):
    if value is None:
        return ""
    text = str(value).strip()
    if text.startswith("{") and text.endswith("}"):
        try:
            parsed = json.loads(text)
            if isinstance(parsed, dict):
                values = list(parsed.values())
                if values:
                    return _clean_letter_value(values[0])
            if isinstance(parsed, list) and parsed:
                return _clean_letter_value(parsed[0])
        except (TypeError, ValueError):
            pass
    text = text.replace("'", "").replace('"', "")
    text = text.replace("{", "").replace("}", "")
    text = text.replace("[", "").replace("]", "")
    return text.strip()


def _match_option_letter(options, target_text):
    if not isinstance(options, list):
        return ""
    target = _clean_letter_value(target_text).strip()
    for index, option in enumerate(options):
        option_label = _clean_letter_value(option).strip()
        if option_label == target or option_label.lower() == target.lower():
            return chr(65 + index)
    return ""


def _get_matching_mapping(question):
    for candidate in [
        getattr(question, "options", None),
        getattr(question, "matching_options", None),
        getattr(question, "choice_map", None),
    ]:
        if isinstance(candidate, str):
            try:
                candidate = json.loads(candidate)
            except (TypeError, ValueError):
                candidate = None

        if isinstance(candidate, dict):
            for left_key, right_key in (("left_items", "right_items"), ("column_a", "column_b"), ("left", "right")):
                left_items = candidate.get(left_key) or []
                right_items = candidate.get(right_key) or []
                if left_items and right_items:
                    return {str(left_items[i]): str(right_items[i]) for i in range(min(len(left_items), len(right_items)))}

    for left_key, right_key in (("left_items", "right_items"), ("column_a", "column_b")):
        left_items = getattr(question, left_key, None)
        right_items = getattr(question, right_key, None)
        if left_items and right_items:
            return {str(left_items[i]): str(right_items[i]) for i in range(min(len(left_items), len(right_items)))}

    answer = getattr(question, "correct_answer", None)
    if isinstance(answer, str):
        try:
            answer = json.loads(answer)
        except (TypeError, ValueError):
            answer = None
    if isinstance(answer, dict):
        return {str(key): str(value) for key, value in answer.items()}
    if isinstance(answer, list):
        mapping = {}
        for item in answer:
            if isinstance(item, dict):
                mapping.update({str(k): str(v) for k, v in item.items()})
            elif isinstance(item, str) and "->" in item:
                left, right = item.split("->", 1)
                mapping[str(left).strip()] = str(right).strip()
        if mapping:
            return mapping
    return {}


def _get_matching_items(question):
    mapping = _get_matching_mapping(question)
    if mapping:
        return list(mapping.keys()), list(mapping.values())

    for candidate in [
        getattr(question, "options", None),
        getattr(question, "matching_options", None),
        getattr(question, "choice_map", None),
    ]:
        if isinstance(candidate, str):
            try:
                candidate = json.loads(candidate)
            except (TypeError, ValueError):
                candidate = None
        if isinstance(candidate, dict):
            left_items = candidate.get("left_items") or candidate.get("column_a") or candidate.get("left") or []
            right_items = candidate.get("right_items") or candidate.get("column_b") or candidate.get("right") or []
            if left_items and right_items:
                return left_items, right_items

    for left_key, right_key in (("left_items", "right_items"), ("column_a", "column_b")):
        left_items = getattr(question, left_key, None)
        right_items = getattr(question, right_key, None)
        if left_items and right_items:
            return left_items, right_items

    answer = getattr(question, "correct_answer", None)
    if isinstance(answer, str):
        try:
            answer = json.loads(answer)
        except (TypeError, ValueError):
            answer = None
    if isinstance(answer, dict):
        return list(answer.keys()), list(answer.values())
    return [], []


def _roman_numeral(index: int) -> str:
    values = [1000, 900, 500, 400, 100, 90, 50, 40, 10, 9, 5, 4, 1]
    numerals = ["M", "CM", "D", "CD", "C", "XC", "L", "XL", "X", "IX", "V", "IV", "I"]
    result = ""
    while index > 0:
        for value, numeral in zip(values, numerals):
            if index >= value:
                result += numeral
                index -= value
                break
    return result or "I"


def _question_type_label(question_type: str) -> str:
    labels = {
        "MCQ": "Multiple Choice",
        "True or False": "True or False",
        "Identification": "Identification",
        "Matching Type": "Matching Type",
        "Enumeration": "Enumeration",
        "Essay": "Essay",
        "Situation": "Situational",
        "Situational": "Situational",
    }
    return labels.get(question_type, question_type)


def _format_answer_key_value(question):
    answer = getattr(question, "correct_answer", None)
    options = getattr(question, "options", None)
    if isinstance(options, str):
        try:
            options = json.loads(options)
        except (TypeError, ValueError):
            options = None

    if question.question_type == "MCQ":
        if isinstance(answer, list) and answer:
            return _match_option_letter(options, answer[0]) or _clean_letter_value(answer[0])
        if isinstance(answer, dict):
            values = list(answer.values())
            if values:
                return _match_option_letter(options, values[0]) or _clean_letter_value(values[0])
        if isinstance(answer, str):
            parsed = None
            try:
                parsed = json.loads(answer)
            except (TypeError, ValueError):
                parsed = None
            if isinstance(parsed, list) and parsed:
                return _match_option_letter(options, parsed[0]) or _clean_letter_value(parsed[0])
            if isinstance(parsed, dict):
                values = list(parsed.values())
                if values:
                    return _match_option_letter(options, values[0]) or _clean_letter_value(values[0])
            letter = _match_option_letter(options, answer)
            if letter:
                return letter
            return _clean_letter_value(answer)
        return "N/A"

    if question.question_type == "Matching Type":
        if isinstance(answer, str):
            try:
                parsed = json.loads(answer)
            except (TypeError, ValueError):
                parsed = None
            if isinstance(parsed, dict):
                answer = parsed
            elif isinstance(parsed, list):
                answer = parsed

        mapping = _get_matching_mapping(question)
        if mapping:
            parts = []
            right_items = []
            if isinstance(options, dict):
                right_items = options.get("right_items") or []
            if not right_items and isinstance(answer, dict):
                answer_items = list(answer.values())
                for left, right in mapping.items():
                    letter = _match_option_letter(right_items, right) or _match_option_letter(answer_items, right)
                    if letter:
                        parts.append(f"{left} -> {letter}")
                    else:
                        parts.append(f"{left} -> {_clean_letter_value(right)}")
            else:
                for left, right in mapping.items():
                    letter = _match_option_letter(right_items, right)
                    if letter:
                        parts.append(f"{left} -> {letter}")
                    else:
                        parts.append(f"{left} -> {_clean_letter_value(right)}")
            if parts:
                return "; ".join(parts)
        if isinstance(answer, list):
            formatted = []
            for item in answer:
                if isinstance(item, str):
                    parsed = None
                    try:
                        parsed = json.loads(item)
                    except (TypeError, ValueError):
                        parsed = None
                    if isinstance(parsed, dict):
                        for left, right in parsed.items():
                            letter = _match_option_letter(getattr(question, "options", None).get("right_items") if isinstance(getattr(question, "options", None), dict) else [], right)
                            if letter:
                                formatted.append(f"{left} -> {letter}")
                            else:
                                formatted.append(f"{left} -> {_clean_letter_value(right)}")
                    else:
                        formatted.append(_clean_letter_value(item))
                elif isinstance(item, dict):
                    for left, right in item.items():
                        formatted.append(f"{left} -> {_clean_letter_value(right)}")
            if formatted:
                return "; ".join(formatted)
        if isinstance(answer, str):
            cleaned = _clean_letter_value(answer)
            if "->" in cleaned:
                return cleaned.replace(" -> ", " -> ")
            return cleaned
        return "N/A"

    if isinstance(answer, list):
        return "; ".join(str(_clean_letter_value(item)) for item in answer if _clean_letter_value(item))
    if isinstance(answer, dict):
        return "; ".join(str(_clean_letter_value(value)) for value in answer.values() if _clean_letter_value(value))
    if isinstance(answer, str):
        return _clean_letter_value(answer)
    return "N/A"


def group_questions_by_type(questions: list):
    ordered_types = []
    grouped = {}

    for question in questions:
        question_type = _normalize_question_type(getattr(question, "question_type", None))
        if question_type not in grouped:
            grouped[question_type] = []
            ordered_types.append(question_type)
        grouped[question_type].append(question)

    return [{"type": question_type, "questions": grouped[question_type]} for question_type in ordered_types]


def convert_docx_to_pdf(docx_path: str, pdf_path: str):
    pythoncom.CoInitialize()
    try:
        convert(docx_path, pdf_path)
    finally:
        pythoncom.CoUninitialize()


def build_assessment_docx(subject: models.Subject, questions: list, include_answer_key: bool = True, answer_mode: str = "with_key") -> str:
    doc = Document()
    grouped_questions = group_questions_by_type(questions)

    if answer_mode != "key_only":
        title = doc.add_heading(f"{subject.name} — Assessment", level=1)
        title.alignment = WD_ALIGN_PARAGRAPH.CENTER

        sub = doc.add_paragraph(f"Total Items: {len(questions)}")
        sub.alignment = WD_ALIGN_PARAGRAPH.CENTER
        doc.add_paragraph("Name: ____________________    Score: _______")
        doc.add_paragraph()

        letters = ['A', 'B', 'C', 'D', 'E', 'F']
        for section_index, group in enumerate(grouped_questions, start=1):
            question_type = _normalize_question_type(group["type"])
            doc.add_heading(f"{_roman_numeral(section_index)}. {_question_type_label(question_type)}", level=2)

            for i, q in enumerate(group["questions"], start=1):
                p = doc.add_paragraph()
                p.add_run(f"{i}. {q.question}").bold = True

                if q.question_type == "MCQ" and isinstance(q.options, list) and q.options:
                    for j, opt in enumerate(q.options):
                        doc.add_paragraph(f"   {letters[j]}. {opt}")
                elif q.question_type == "Matching Type":
                    left_items, right_items = _get_matching_items(q)
                    if left_items or right_items:
                        table = doc.add_table(rows=max(len(left_items), len(right_items)) + 1, cols=2)
                        table.style = "Table Grid"
                        table.rows[0].cells[0].text = "Column A"
                        table.rows[0].cells[1].text = "Column B"
                        for row_index in range(max(len(left_items), len(right_items))):
                            table.rows[row_index + 1].cells[0].text = f"{row_index + 1}. {left_items[row_index]}" if row_index < len(left_items) else ""
                            table.rows[row_index + 1].cells[1].text = f"{chr(65 + row_index)}. {right_items[row_index]}" if row_index < len(right_items) else ""
                    else:
                        doc.add_paragraph("   Answer: ____________________________________")
                else:
                    doc.add_paragraph("   Answer: ____________________________________")
                doc.add_paragraph()

    if answer_mode in {"with_key", "key_only"}:
        if answer_mode == "with_key":
            doc.add_page_break()
        doc.add_heading("Answer Key", level=1)

        for section_index, group in enumerate(grouped_questions, start=1):
            question_type = _normalize_question_type(group["type"])
            doc.add_heading(f"{_roman_numeral(section_index)}. {_question_type_label(question_type)}", level=2)

            for i, q in enumerate(group["questions"], start=1):
                answer = _format_answer_key_value(q)
                doc.add_paragraph(f"{i}. {answer}")

    file_path = os.path.join(TEMP_DIR, f"assessment_{uuid.uuid4().hex}.docx")
    doc.save(file_path)
    return file_path


def cleanup_file(path: str):
    if os.path.exists(path):
        os.remove(path)


def _get_questions_by_ids(db: Session, subject_id: int, question_ids: list[int]):
    subject = db.query(models.Subject).filter(models.Subject.id == subject_id).first()
    if not subject:
        raise HTTPException(404, "Subject not found")

    questions = (
        db.query(models.GeneratedQuestion)
        .filter(
            models.GeneratedQuestion.subject_id == subject_id,
            models.GeneratedQuestion.id.in_(question_ids),
        )
        .all()
    )
    if not questions:
        raise HTTPException(404, "No matching questions found for this subject")

    return subject, questions


# ──────────────────────────────────────────────────────────────
# Original endpoint (GET, generates from the WHOLE subject).
# Left in place in case anything else relies on it.
# ──────────────────────────────────────────────────────────────
@router.get("/generate")
def generate_assessment(
    subject_id: int,
    file_type: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    if file_type not in ("docx", "pdf"):
        raise HTTPException(400, "file_type must be 'docx' or 'pdf'")

    subject = db.query(models.Subject).filter(models.Subject.id == subject_id).first()
    if not subject:
        raise HTTPException(404, "Subject not found")

    questions = (
        db.query(models.GeneratedQuestion)
        .filter(models.GeneratedQuestion.subject_id == subject_id)
        .all()
    )
    if not questions:
        raise HTTPException(404, "No questions found for this subject")

    docx_path = build_assessment_docx(subject, questions)
    safe_name = subject.name.replace(' ', '_')

    if file_type == "docx":
        background_tasks.add_task(cleanup_file, docx_path)
        return FileResponse(
            docx_path,
            filename=f"{safe_name}_Assessment.docx",
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        )

    # pdf
    pdf_path = docx_path.replace(".docx", ".pdf")
    convert_docx_to_pdf(docx_path, pdf_path)

    background_tasks.add_task(cleanup_file, docx_path)
    background_tasks.add_task(cleanup_file, pdf_path)
    return FileResponse(
        pdf_path,
        filename=f"{safe_name}_Assessment.pdf",
        media_type="application/pdf",
    )


# ──────────────────────────────────────────────────────────────
# New endpoint matching questionbank.jsx exactly:
# POST /api/questions/export
# FormData: subject_id, question_ids ("1,4,7"), export_format ("pdf" | "docx")
# ──────────────────────────────────────────────────────────────
@export_router.post("/export")
def export_selected_questions(
    background_tasks: BackgroundTasks,
    subject_id: int = Form(...),
    question_ids: str = Form(...),
    export_format: str = Form("pdf"),
    db: Session = Depends(get_db),
):
    if export_format not in ("docx", "pdf"):
        raise HTTPException(400, "export_format must be 'docx' or 'pdf'")

    try:
        id_list = [int(qid) for qid in question_ids.split(",") if qid.strip() != ""]
    except ValueError:
        raise HTTPException(400, "question_ids must be a comma-separated list of integers")

    if not id_list:
        raise HTTPException(400, "No question_ids provided")

    subject, questions = _get_questions_by_ids(db, subject_id, id_list)

    docx_path = build_assessment_docx(subject, questions)
    safe_name = subject.name.replace(' ', '_')

    if export_format == "docx":
        background_tasks.add_task(cleanup_file, docx_path)
        return FileResponse(
            docx_path,
            filename=f"{safe_name}_Assessment.docx",
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        )

    # pdf
    pdf_path = docx_path.replace(".docx", ".pdf")
    convert_docx_to_pdf(docx_path, pdf_path)

    background_tasks.add_task(cleanup_file, docx_path)
    background_tasks.add_task(cleanup_file, pdf_path)
    return FileResponse(
        pdf_path,
        filename=f"{safe_name}_Assessment.pdf",
        media_type="application/pdf",
    )