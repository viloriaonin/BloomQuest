import io
import re
from collections import Counter


_PAGE_NUMBER_RE = re.compile(r"^(?:page\s*)?\d+(?:\s*(?:of|/)\s*\d+)?$", re.IGNORECASE)
_WHITESPACE_RE = re.compile(r"\s+")


def clean_extracted_text(text):
    lines = []
    seen_lines = set()
    for raw_line in (text or "").splitlines():
        line = _WHITESPACE_RE.sub(" ", raw_line).strip()
        if not line or _PAGE_NUMBER_RE.fullmatch(line):
            if lines and lines[-1]:
                lines.append("")
            continue
        normalized_line = line.casefold()
        if normalized_line in seen_lines:
            continue
        seen_lines.add(normalized_line)
        lines.append(line)

    while lines and not lines[-1]:
        lines.pop()
    return "\n".join(lines)


def _remove_repeated_page_furniture(pages):
    if len(pages) < 2:
        return pages

    edge_counts = Counter()
    for lines in pages:
        edge_lines = set(lines[:2] + lines[-2:])
        for line in edge_lines:
            if len(line) >= 4 and not _PAGE_NUMBER_RE.fullmatch(line):
                edge_counts[line.casefold()] += 1

    repeat_threshold = max(2, (len(pages) + 1) // 2)
    repeated_edges = {
        line for line, count in edge_counts.items()
        if count >= repeat_threshold
    }

    cleaned_pages = []
    for lines in pages:
        last_index = len(lines) - 1
        cleaned_pages.append([
            line for index, line in enumerate(lines)
            if not (
                (index < 2 or index >= last_index - 1)
                and line.casefold() in repeated_edges
            )
        ])
    return cleaned_pages

def extract_text_from_pdf(file_bytes):
    import fitz

    pdf = fitz.open(stream=file_bytes, filetype="pdf")
    pages = [
        [
            _WHITESPACE_RE.sub(" ", line).strip()
            for line in page.get_text().splitlines()
            if _WHITESPACE_RE.sub(" ", line).strip()
        ]
        for page in pdf
    ]
    pages = _remove_repeated_page_furniture(pages)
    return clean_extracted_text("\n\n".join("\n".join(page) for page in pages))

def extract_text_from_docx(file_bytes):
    from docx import Document
    from docx.oxml.table import CT_Tbl
    from docx.oxml.text.paragraph import CT_P
    from docx.table import Table
    from docx.text.paragraph import Paragraph

    doc = Document(io.BytesIO(file_bytes))
    blocks = []
    for element in doc.element.body.iterchildren():
        if isinstance(element, CT_P):
            text = Paragraph(element, doc).text.strip()
            if text:
                blocks.append(text)
        elif isinstance(element, CT_Tbl):
            table = Table(element, doc)
            for row in table.rows:
                cells = [_WHITESPACE_RE.sub(" ", cell.text).strip() for cell in row.cells]
                if any(cells):
                    blocks.append(" | ".join(cell for cell in cells if cell))
    return clean_extracted_text("\n".join(blocks))

def extract_text_from_pptx(file_bytes):
    from pptx import Presentation

    prs = Presentation(io.BytesIO(file_bytes))
    blocks = []
    for slide in prs.slides:
        for shape in slide.shapes:
            if hasattr(shape, "text"):
                if shape.text.strip():
                    blocks.append(shape.text)
    return clean_extracted_text("\n".join(blocks))

def extract_text_from_excel(file_bytes):
    import openpyxl

    wb = openpyxl.load_workbook(io.BytesIO(file_bytes))
    rows = []
    for sheet in wb.worksheets:
        for row in sheet.iter_rows(values_only=True):
            values = [str(cell) for cell in row if cell is not None and str(cell).strip()]
            if values:
                rows.append(" ".join(values))
    return clean_extracted_text("\n".join(rows))

def extract_text(file_bytes, filename):
    filename = filename.lower()
    if filename.endswith(".pdf"):
        return extract_text_from_pdf(file_bytes)
    elif filename.endswith(".docx"):
        return extract_text_from_docx(file_bytes)
    elif filename.endswith(".pptx") or filename.endswith(".ppt"):
        return extract_text_from_pptx(file_bytes)
    elif filename.endswith(".xlsx") or filename.endswith(".xls"):
        return extract_text_from_excel(file_bytes)
    else:
        raise ValueError(f"Unsupported file type: {filename}")