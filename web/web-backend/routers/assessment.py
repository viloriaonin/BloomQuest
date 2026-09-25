# routers/assessment.py
from fastapi import APIRouter, HTTPException, Depends, Form
from fastapi.responses import FileResponse
from fastapi.background import BackgroundTasks
from sqlalchemy.orm import Session
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_CELL_VERTICAL_ALIGNMENT
import io, os, uuid, tempfile, json, re, random
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
import pythoncom
from docx2pdf import convert
from database import get_db
import models
from routers.tos_utils import TEMPLATE_PATH

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
    """
    Return the Matching Type answer mapping as:

        {
            "Column A item": "Column B answer"
        }

    Supports:
    - normal dictionaries
    - JSON dictionaries
    - lists of dictionaries
    - strings using "left -> right"
    - the current BloomQuest format where correct_answer
      is stored as:
      {"left -> right","left -> right"}
    """

    # ---------------------------------------------------------
    # First try the question's stored matching options
    # ---------------------------------------------------------
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

            for left_key, right_key in [
                ("left_items", "right_items"),
                ("column_a", "column_b"),
                ("left", "right"),
            ]:

                left_items = candidate.get(left_key) or []
                right_items = candidate.get(right_key) or []

                if left_items and right_items:

                    return {
                        str(left_items[i]).strip():
                        str(right_items[i]).strip()
                        for i in range(
                            min(len(left_items), len(right_items))
                        )
                    }

    # ---------------------------------------------------------
    # Try separate database fields
    # ---------------------------------------------------------
    for left_key, right_key in [
        ("left_items", "right_items"),
        ("column_a", "column_b"),
    ]:

        left_items = getattr(question, left_key, None) or []
        right_items = getattr(question, right_key, None) or []

        if left_items and right_items:

            return {
                str(left_items[i]).strip():
                str(right_items[i]).strip()
                for i in range(
                    min(len(left_items), len(right_items))
                )
            }

    # ---------------------------------------------------------
    # Read correct_answer
    # ---------------------------------------------------------
    answer = getattr(question, "correct_answer", None)

    if answer is None:
        return {}

    # ---------------------------------------------------------
    # Normal JSON
    # ---------------------------------------------------------
    if isinstance(answer, str):

        try:
            parsed = json.loads(answer)
            answer = parsed
        except (TypeError, ValueError):

            # -------------------------------------------------
            # IMPORTANT:
            #
            # Current BloomQuest records use this format:
            #
            # {"Left -> Right","Left -> Right"}
            #
            # This is NOT a valid JSON object because there
            # are no ":" separators.
            #
            # Convert the outer braces into brackets so it
            # becomes a JSON list.
            # -------------------------------------------------
            text = answer.strip()

            if (
                text.startswith("{")
                and text.endswith("}")
            ):
                try:
                    converted = "[" + text[1:-1] + "]"
                    parsed = json.loads(converted)

                    if isinstance(parsed, list):
                        answer = parsed

                except (TypeError, ValueError):
                    pass

    # ---------------------------------------------------------
    # Dictionary format
    # ---------------------------------------------------------
    if isinstance(answer, dict):

        return {
            str(key).strip(): str(value).strip()
            for key, value in answer.items()
        }

    # ---------------------------------------------------------
    # List format
    # ---------------------------------------------------------
    if isinstance(answer, list):

        mapping = {}

        for item in answer:

            if isinstance(item, dict):

                for left, right in item.items():

                    mapping[
                        str(left).strip()
                    ] = str(right).strip()

            elif isinstance(item, str):

                if "->" in item:

                    left, right = item.split(
                        "->",
                        1
                    )

                    mapping[
                        left.strip()
                    ] = right.strip()

        if mapping:
            return mapping

    # ---------------------------------------------------------
    # Single "left -> right" string
    # ---------------------------------------------------------
    if isinstance(answer, str) and "->" in answer:

        mapping = {}

        # Handle multiple mappings separated by commas
        # only when they use the arrow format.
        parts = re.split(
            r'"\s*,\s*"',
            answer.strip("{}")
        )

        for part in parts:

            part = part.strip().strip('"')

            if "->" not in part:
                continue

            left, right = part.split(
                "->",
                1
            )

            mapping[
                left.strip()
            ] = right.strip()

        if mapping:
            return mapping

    return {}


def _get_matching_items(question):
    """
    Return Column A and Column B choices for Matching Type.

    Priority:
    1. Stored matching options
    2. Separate left/right database fields
    3. Reconstruct choices from correct_answer

    The current BloomQuest database has empty options for many
    Matching Type questions, so the third method is important.
    """

    # ---------------------------------------------------------
    # Try stored options first
    # ---------------------------------------------------------
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

            left_items = (
                candidate.get("left_items")
                or candidate.get("column_a")
                or candidate.get("left")
                or []
            )

            right_items = (
                candidate.get("right_items")
                or candidate.get("column_b")
                or candidate.get("right")
                or []
            )

            if left_items or right_items:

                return (
                    list(left_items),
                    list(right_items)
                )

    # ---------------------------------------------------------
    # Try separate database fields
    # ---------------------------------------------------------
    left_items = (
        getattr(question, "left_items", None)
        or []
    )

    right_items = (
        getattr(question, "right_items", None)
        or []
    )

    if left_items or right_items:

        return (
            list(left_items),
            list(right_items)
        )

    # ---------------------------------------------------------
    # Reconstruct from correct_answer
    # ---------------------------------------------------------
    mapping = _get_matching_mapping(question)

    if not mapping:
        return [], []

    left_items = list(mapping.keys())
    right_items = list(mapping.values())

    # ---------------------------------------------------------
    # Shuffle Column B.
    #
    # This prevents the answer from automatically being
    # A, B, C, D...
    # ---------------------------------------------------------

    return left_items, right_items


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

    # Parse options if stored as JSON text
    if isinstance(options, str):
        try:
            options = json.loads(options)
        except (TypeError, ValueError):
            options = None

    # -----------------------------
    # MATCHING TYPE
    # -----------------------------
    if question.question_type == "Matching Type":

        # Get Column A and Column B
        left_items, right_items = _get_matching_items(question)

        # Get the answer mapping using the same parser
        # that reconstructs the current database format.
        mapping = _get_matching_mapping(question)

        if not mapping:
            return "N/A"

        if not left_items or not right_items:
            return "N/A"

        letters = []

        # Follow the order of Column A.
        for left in left_items:

            left_text = str(left).strip()

            # Find the corresponding answer
            right = None

            # First try exact match
            if left_text in mapping:
                right = mapping[left_text]

            else:
                # Try case-insensitive match
                for map_left, map_right in mapping.items():

                    if (
                        str(map_left).strip().lower()
                        == left_text.lower()
                    ):
                        right = map_right
                        break

            if right is None:
                continue

            right_text = str(right).strip()

            # -------------------------------------------------
            # If the stored answer is already a letter
            # -------------------------------------------------
            if re.fullmatch(r"[A-Za-z]", right_text):
                letters.append(f"{left_text} -> {right_text.upper()}")
                continue

            # -------------------------------------------------
            # Otherwise find which Column B choice contains
            # the correct answer.
            # -------------------------------------------------
            match_index = -1

            for index, choice in enumerate(right_items):

                choice_text = _clean_letter_value(choice).strip()

                if choice_text.lower() == right_text.lower():
                    match_index = index
                    break

            if match_index >= 0:
                letters.append(f"{left_text} -> {chr(65 + match_index)}")

        if letters:
            return "; ".join(letters)

        return "N/A"

    # =========================================================
    # OTHER QUESTION TYPES
    # =========================================================

    if isinstance(answer, list):

        return "; ".join(
            str(_clean_letter_value(item))
            for item in answer
            if _clean_letter_value(item)
        )

    if isinstance(answer, dict):

        return "; ".join(
            str(_clean_letter_value(value))
            for value in answer.values()
            if _clean_letter_value(value)
        )

    if isinstance(answer, str):
        if isinstance(options, list):
            option_letter = _match_option_letter(options, answer)
            if option_letter:
                return option_letter
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
    import win32com.client

    pythoncom.CoInitialize()
    word = None
    document = None
    try:
        word = win32com.client.DispatchEx("Word.Application")
        word.Visible = False
        word.DisplayAlerts = 0
        document = word.Documents.Open(
            os.path.abspath(docx_path),
            ReadOnly=True,
            AddToRecentFiles=False,
            ConfirmConversions=False,
        )
        document.SaveAs2(os.path.abspath(pdf_path), FileFormat=17)
    finally:
        if document is not None:
            document.Close(False)
        if word is not None:
            word.Quit(False)
        pythoncom.CoUninitialize()


def _tos_header_data():
    """Read the institutional identity and logo from the existing TOS template."""
    import openpyxl

    workbook = openpyxl.load_workbook(TEMPLATE_PATH)
    sheet = workbook.active
    values = {
        "republic": sheet["B7"].value or "",
        "university": sheet["B8"].value or "",
        "tagline": sheet["B9"].value or "",
        "campus": sheet["B10"].value or "",
        "address": sheet["B11"].value or "",
        "telephone": sheet["B12"].value or "",
        "contact": sheet["B13"].value or "",
        "college": sheet["B14"].value or "",
        "logo": None,
    }
    if getattr(sheet, "_images", None):
        values["logo"] = sheet._images[0]._data()
    return values


def _add_centered_line(doc, text, size=10, bold=False):
    paragraph = doc.add_paragraph()
    paragraph.alignment = WD_ALIGN_PARAGRAPH.CENTER
    paragraph.paragraph_format.space_after = Pt(0)
    run = paragraph.add_run(str(text).strip())
    run.bold = bold
    run.font.size = Pt(size)
    run.font.name = "Times New Roman"
    run.font.color.rgb = RGBColor(0, 0, 0)


def _add_left_line(doc, text, size=10, bold=False):
    paragraph = doc.add_paragraph()
    paragraph.alignment = WD_ALIGN_PARAGRAPH.LEFT
    paragraph.paragraph_format.space_after = Pt(0)
    run = paragraph.add_run(str(text).strip())
    run.bold = bold
    run.font.size = Pt(size)
    run.font.name = "Times New Roman"
    run.font.color.rgb = RGBColor(0, 0, 0)
    return paragraph


def _set_paragraph_border(paragraph, color="000000", size="10", space="4", edges=("top", "left", "bottom", "right")):
    properties = paragraph._p.get_or_add_pPr()
    borders = properties.find(qn("w:pBdr"))
    if borders is None:
        borders = OxmlElement("w:pBdr")
        properties.append(borders)
    for edge in edges:
        border = OxmlElement(f"w:{edge}")
        border.set(qn("w:val"), "single")
        border.set(qn("w:sz"), size)
        border.set(qn("w:space"), space)
        border.set(qn("w:color"), color)
        borders.append(border)


def _add_values_box(doc):
    paragraph = doc.add_paragraph()
    paragraph.paragraph_format.space_before = Pt(5)
    paragraph.paragraph_format.space_after = Pt(8)
    paragraph.paragraph_format.left_indent = Inches(0.05)
    paragraph.paragraph_format.right_indent = Inches(0.05)
    _set_paragraph_border(paragraph)

    paragraph.alignment = WD_ALIGN_PARAGRAPH.CENTER
    lines = [
        ("VISION", "A premier national university that develops leaders in the global knowledge economy."),
        ("MISSION", "A University is committed to producing leaders by providing a 21st century learning environment through innovation in education, multidisciplinary research, and community and industry partnership in order to nurture the spirit of nationhood, propel the national economy and engage the world for sustainable development."),
        ("CORE VALUES", "Patriotism     Integrity     Service     Resilience     Excellence     Faith"),
    ]
    for index, (label, value) in enumerate(lines):
        if index:
            paragraph.add_run().add_break()
        label_run = paragraph.add_run(label)
        label_run.bold = True
        label_run.font.name = "Times New Roman"
        label_run.font.size = Pt(9)
        label_run.font.color.rgb = RGBColor(0, 0, 0)
        paragraph.add_run().add_break()
        value_run = paragraph.add_run(value)
        value_run.font.name = "Times New Roman"
        value_run.font.size = Pt(8)
        value_run.font.color.rgb = RGBColor(0, 0, 0)


def _add_exam_header(doc, subject, exam_type="Final Examination", semester="", academic_year="", class_info=""):
    header = _tos_header_data()
    identity_lines = [
        (header["republic"], 12, "Times New Roman", True, "000000"),
        (header["university"], 20, "Times New Roman", True, "000000"),
        (header["tagline"], 12, "Arial", True, "FF0000"),
        (header["campus"], 12, "Times New Roman", True, "000000"),
        (header["address"], 10, "Times New Roman", True, "363435"),
        (header["telephone"], 10, "Times New Roman", False, "363435"),
        (header["contact"], 10, "Times New Roman", False, "000000"),
    ]
    section = doc.sections[0]
    section.different_first_page_header_footer = True
    header_section = section.first_page_header
    header_table = header_section.add_table(rows=1, cols=2, width=Inches(7.2))
    header_table.autofit = False
    header_table.columns[0].width = Inches(1.35)
    header_table.columns[1].width = Inches(5.85)
    logo_cell, identity_cell = header_table.rows[0].cells
    for cell in (logo_cell, identity_cell):
        cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
        cell.width = Inches(1.35 if cell is logo_cell else 5.85)
        cell_properties = cell._tc.get_or_add_tcPr()
        borders = OxmlElement("w:tcBorders")
        for edge in ("top", "left", "bottom", "right", "insideH", "insideV"):
            border = OxmlElement(f"w:{edge}")
            border.set(qn("w:val"), "nil")
            borders.append(border)
        cell_properties.append(borders)

    if header["logo"]:
        logo_paragraph = logo_cell.paragraphs[0]
        logo_paragraph.alignment = WD_ALIGN_PARAGRAPH.LEFT
        logo_paragraph.paragraph_format.space_after = Pt(0)
        logo_paragraph.add_run().add_picture(io.BytesIO(header["logo"]), width=Inches(1.05))

    for index, (text, size, font_name, bold, color) in enumerate(identity_lines):
        paragraph = identity_cell.paragraphs[0] if index == 0 else identity_cell.add_paragraph()
        paragraph.alignment = WD_ALIGN_PARAGRAPH.CENTER
        paragraph.paragraph_format.space_after = Pt(0)
        paragraph.paragraph_format.line_spacing = 1.0
        run = paragraph.add_run(str(text).strip())
        run.font.name = font_name
        run.font.size = Pt(size)
        run.bold = bold
        run.font.color.rgb = RGBColor.from_string(color)

    separator = doc.add_paragraph()
    separator.paragraph_format.space_before = Pt(2)
    separator.paragraph_format.space_after = Pt(4)
    separator_run = separator.add_run(" " * 105)
    separator_run.bold = True
    _set_paragraph_border(separator, size="16", space="0", edges=("bottom",))

    _add_left_line(doc, header["college"].strip(), 12, True)
    _add_centered_line(doc, exam_type or "Examination", 12, True)

    subject_code = getattr(subject, "code", "") or ""
    subject_name = getattr(subject, "name", "") or ""
    subject_label = " - ".join(value for value in (subject_code, subject_name) if value)
    if subject_label:
        _add_centered_line(doc, subject_label, 11, True)

    period = ", ".join(value for value in (semester, class_info) if value)
    if academic_year:
        period = f"{period}, Academic Year {academic_year}" if period else f"Academic Year {academic_year}"
    if period:
        _add_centered_line(doc, period, 9)

    fields = [
        "Name: ____________________________________\tScore: _______________",
        "Course/Section: ___________________________\tDate: _______________",
    ]
    for field_line in fields:
        paragraph = doc.add_paragraph(field_line)
        paragraph.paragraph_format.space_after = Pt(2)
        for run in paragraph.runs:
            run.font.size = Pt(9)
            run.font.name = "Times New Roman"
            run.font.color.rgb = RGBColor(0, 0, 0)
    _add_values_box(doc)


def _add_general_directions(doc, directions=None):
    doc.add_heading("GENERAL DIRECTIONS", level=2)
    items = directions or [
        "Read, understand, analyze, and follow the instructions for each section.",
        "Cheating or any form of academic dishonesty is not allowed.",
        "Do not use pencils, friction pens, or erasable pens in answering.",
        "No extra sheets of paper are allowed. Use the back page of your test paper if needed.",
    ]
    for direction in items:
        doc.add_paragraph(str(direction), style="List Number")


def _section_directions(question_type):
    directions = {
        "MCQ": "READ and ANALYZE each question carefully. Shade the letter corresponding to your answer on the Answer Sheet provided.",
        "True or False": "Read each statement carefully. Write TRUE if the statement is correct and FALSE if it is not.",
        "Identification": "Identify the word, term, or phrase being described. Write your answer clearly on the space provided.",
        "Matching Type": "Match each item in Column A with the most appropriate answer in Column B. Write the letter of your answer.",
        "Enumeration": "Enumerate the items requested in each question. Write your answers in the spaces provided.",
        "Essay": "Answer each question clearly and completely. Support your response with relevant details where appropriate.",
        "Situation": "Read each situation carefully and provide the best answer based on the information given.",
        "Situational": "Read each situation carefully and provide the best answer based on the information given.",
    }
    return directions.get(question_type, "Answer each item carefully and write your answer in the space provided.")


def _add_section_directions(doc, question_type):
    paragraph = doc.add_paragraph()
    paragraph.paragraph_format.space_after = Pt(4)
    label = paragraph.add_run("Directions: ")
    label.bold = True
    label.font.size = Pt(9)
    text = paragraph.add_run(_section_directions(question_type))
    text.font.size = Pt(9)


def _set_compact_paragraph(paragraph):
    paragraph.paragraph_format.line_spacing = 1.0
    paragraph.paragraph_format.space_before = Pt(0)
    paragraph.paragraph_format.space_after = Pt(0)


def _apply_document_font(doc):
    for paragraph in doc.paragraphs:
        for run in paragraph.runs:
            run.font.name = "Times New Roman"
    for table in doc.tables:
        for row in table.rows:
            for cell in row.cells:
                for paragraph in cell.paragraphs:
                    for run in paragraph.runs:
                        run.font.name = "Times New Roman"


def build_assessment_docx(
    subject: models.Subject,
    questions: list,
    include_answer_key: bool = True,
    answer_mode: str = "with_key",
    exam_type: str = "Final Examination",
    semester: str = "",
    academic_year: str = "",
    class_info: str = "",
    directions: list | None = None,
) -> str:
    doc = Document()
    for style_name in ("Normal", "Title", "Heading 1", "Heading 2", "Heading 3"):
        style = doc.styles[style_name]
        style.font.name = "Times New Roman"
        style.font.color.rgb = RGBColor(0, 0, 0)
    doc.styles["Normal"].font.size = Pt(10)
    doc.styles["Heading 1"].font.size = Pt(13)
    doc.styles["Heading 2"].font.size = Pt(10)
    doc.styles["Heading 2"].font.bold = True
    section = doc.sections[0]
    section.top_margin = Inches(0.55)
    section.bottom_margin = Inches(0.55)
    section.left_margin = Inches(0.7)
    section.right_margin = Inches(0.7)
    grouped_questions = group_questions_by_type(questions)

    if answer_mode != "key_only":
        _add_exam_header(doc, subject, exam_type, semester, academic_year, class_info)
        _add_general_directions(doc, directions)

        letters = ['A', 'B', 'C', 'D', 'E', 'F']
        item_number = 1
        for section_index, group in enumerate(grouped_questions, start=1):
            question_type = _normalize_question_type(group["type"])
            points = getattr(group["questions"][0], "points", None) if group["questions"] else None
            points_label = f" ({points:g} point{'s' if points != 1 else ''} each)" if isinstance(points, (int, float)) and points > 0 else ""
            doc.add_heading(f"{_roman_numeral(section_index)}. {_question_type_label(question_type)}{points_label}", level=2)
            _add_section_directions(doc, question_type)

            for q in group["questions"]:
                p = doc.add_paragraph()
                p.add_run(f"{item_number}. {q.question}").bold = True

                if q.question_type == "MCQ" and isinstance(q.options, list) and q.options:
                    for j, opt in enumerate(q.options):
                        option_paragraph = doc.add_paragraph(f"   {letters[j]}. {opt}")
                        _set_compact_paragraph(option_paragraph)
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
                        for row in table.rows:
                            for cell in row.cells:
                                for paragraph in cell.paragraphs:
                                    _set_compact_paragraph(paragraph)
                    else:
                        doc.add_paragraph("   Answer: ____________________________________")
                else:
                    doc.add_paragraph("   Answer: ____________________________________")
                doc.add_paragraph()
                item_number += 1

    if answer_mode in {"with_key", "key_only"}:
        if answer_mode == "with_key":
            doc.add_page_break()
        doc.add_heading("Answer Key", level=1)

        for section_index, group in enumerate(grouped_questions, start=1):
            question_type = _normalize_question_type(group["type"])
            doc.add_heading(f"{_roman_numeral(section_index)}. {_question_type_label(question_type)}", level=2)

            item_number = 1
            for q in questions:
                answer = _format_answer_key_value(q)
                doc.add_paragraph(f"{item_number}. {answer}")
                item_number += 1

    _apply_document_font(doc)
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