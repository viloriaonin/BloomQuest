import math
from collections import defaultdict
from pathlib import Path

import openpyxl
from openpyxl.styles import Font, Alignment, PatternFill, Border, Side
from openpyxl.utils import get_column_letter

BLOOM_LEVELS = [
    "Remember",
    "Understand",
    "Apply",
    "Analyze",
    "Evaluate",
    "Create"
]


DEFAULT_BLOOM_PERCENTAGES = {
    "Remember": 0.15,
    "Understand": 0.20,
    "Apply": 0.20,
    "Analyze": 0.20,
    "Evaluate": 0.15,
    "Create": 0.10,
}


SUPPORTED_QUESTION_TYPES = [
    "MCQ",
    "True or False",
    "Identification",
    "Essay",
    "Enumeration",
    "Matching Type",
    "Situational"
]


TEMPLATE_PATH = Path(__file__).resolve().parent.parent / "templates" / "tos_template.xlsx"


def check_totals_mismatch(selected_topics_data, whole_total_points):
    """Compare the actual sum of Bloom's item counts against the target total
    points. Used both to embed a warning cell in the generated Excel file and
    to surface the same warning in the API response, so it isn't only visible
    to someone who opens the file after the fact.

    Returns (actual_total, mismatch_message_or_None).
    """
    actual_total = sum(
        sum(t.get("bloom_counts", {}).get(level, 0) for level in BLOOM_LEVELS)
        for t in selected_topics_data
    )
    if whole_total_points and actual_total != whole_total_points:
        message = (
            f"Bloom's item counts sum to {actual_total}, but the target "
            f"Total No. of Points was {whole_total_points}. Re-check the "
            f"TOS matrix before distributing this file."
        )
        return actual_total, message
    return actual_total, None


def _normalize_header(value):
    if value is None:
        return ""
    return str(value).strip().lower()


def _load_tos_template_workbook():
    if TEMPLATE_PATH.exists():
        try:
            return openpyxl.load_workbook(TEMPLATE_PATH)
        except Exception:
            pass
    return openpyxl.Workbook()


def _find_header_row(ws):
    for row in ws.iter_rows(min_row=1, max_row=50, max_col=40):
        normalized = [_normalize_header(cell.value) for cell in row]
        if any("topics" in cell for cell in normalized) and any("ilo" in cell for cell in normalized):
            return row[0].row
    return None


def _find_total_row(ws, start_row, topic_col, max_search=200):
    """Locate the template's built-in 'Total' row by scanning down the topic
    name column. Used to figure out how many topic rows the template ships
    with (base_rows = total_row - start_row), so we know whether we need to
    add or remove rows for the actual number of topics being written."""
    for r in range(start_row, start_row + max_search):
        if _normalize_header(ws.cell(row=r, column=topic_col).value) == "total":
            return r
    return None


def _resize_topic_row_block(ws, boundary_row, delta):
    """Insert (delta > 0) or delete (delta < 0) rows at boundary_row so the
    topic-row block exactly matches the number of topics being written.

    openpyxl's insert_rows/delete_rows move cell values and styles but do
    NOT move merged-cell ranges -- that's what caused the crash/misalignment
    when topic counts didn't match the template's built-in 3 rows. So merges
    at or below boundary_row are unmerged first, the rows are inserted or
    deleted, and then those merges are re-created at their shifted position.
    """
    if delta == 0:
        return

    affected = [
        (mc.min_row, mc.max_row, mc.min_col, mc.max_col)
        for mc in list(ws.merged_cells.ranges)
        if mc.min_row >= boundary_row
    ]
    for (min_row, max_row, min_col, max_col) in affected:
        ws.unmerge_cells(start_row=min_row, start_column=min_col, end_row=max_row, end_column=max_col)

    if delta > 0:
        ws.insert_rows(boundary_row, delta)
    else:
        ws.delete_rows(boundary_row, -delta)

    for (min_row, max_row, min_col, max_col) in affected:
        new_min_row = min_row + delta
        new_max_row = max_row + delta
        if new_min_row < 1:
            continue
        ws.merge_cells(start_row=new_min_row, start_column=min_col, end_row=new_max_row, end_column=max_col)


def _guess_template_columns(ws, header_row):
    cols = {}
    normalized = [_normalize_header(ws.cell(row=header_row, column=c).value) for c in range(1, 41)]
    for idx, val in enumerate(normalized, start=1):
        if not val:
            continue
        if "topics" in val and "topic outcomes" not in val:
            cols["topic_name"] = idx
        elif "ilo" in val and "outcome" not in val:
            cols["ilo"] = idx
        elif "no. of hrs" in val or "hrs" in val or "hours" in val:
            cols["hours_a"] = idx
        elif "weight" in val:
            cols["weight"] = idx
        elif "total no. of points" in val or "total no. of point" in val:
            cols["total_points"] = idx
        elif "remember" in val:
            cols["remember"] = idx
        elif "understand" in val:
            cols["understand"] = idx
        elif val.startswith("apply"):
            cols["apply"] = idx
        elif "analyze" in val:
            cols["analyze"] = idx
        elif "evaluate" in val:
            cols["evaluate"] = idx
        elif "create" in val:
            cols["create"] = idx
    return cols


def _write_course_label(ws, label_key, value):
    label_key = label_key.lower()
    for row in ws.iter_rows(min_row=1, max_row=40, max_col=10):
        for cell in row:
            cell_value = _normalize_header(cell.value)
            if label_key in cell_value:
                if ":" in str(cell.value):
                    cell.value = f"{str(cell.value).split(':', 1)[0].strip()}: {value}"
                else:
                    right = ws.cell(row=cell.row, column=cell.column + 1)
                    if right.value is None or str(right.value).strip() == "":
                        right.value = value
                    else:
                        cell.value = f"{str(cell.value).strip()}: {value}"
                return


def _write_topics_to_template(ws, start_row, cols, selected_topics_data, whole_total_points):
    topic_col = cols.get("topic_name", 2)
    ilo_col = cols.get("ilo", 3)
    hours_col = cols.get("hours_a", 4)
    minutes_col = cols.get("minutes_b", 5)
    weight_col = cols.get("weight", 6)
    total_col = cols.get("total_points", 19)

    bloom_cols = {
        "Remember": cols.get("remember", 7),
        "Understand": cols.get("understand", 9),
        "Apply": cols.get("apply", 11),
        "Analyze": cols.get("analyze", 13),
        "Evaluate": cols.get("evaluate", 15),
        "Create": cols.get("create", 17),
    }

    num_topics = len(selected_topics_data)
    total_row_index = start_row + num_topics

    for i, topic in enumerate(selected_topics_data):
        current_row = start_row + i
        ws.cell(row=current_row, column=topic_col, value=topic["topic_name"])
        ws.cell(row=current_row, column=ilo_col, value=topic.get("ilo", f"ILO {topic.get('ilo_num', 1)}"))
        ws.cell(row=current_row, column=hours_col, value=float(topic["hours_a"]))
        if minutes_col:
            ws.cell(row=current_row, column=minutes_col, value=float(topic.get("minutes_b", 2.0)))
        if weight_col:
            weight_cell = ws.cell(row=current_row, column=weight_col,
                                    value=f"=IFERROR({get_column_letter(total_col)}{current_row}/$S${total_row_index}*100,0)")
            # Formula already multiplies by 100 (e.g. 10 means "10%"). Excel's
            # built-in '0%' number format would multiply by 100 AGAIN on
            # display (10 -> "1000%"), which is exactly the bug the template
            # shipped with on some of its percentage columns. Force a custom
            # format that just appends a literal "%" without re-scaling.
            weight_cell.number_format = '0.00"%"'

        for bloom_level, col in bloom_cols.items():
            ws.cell(row=current_row, column=col, value=topic.get("bloom_counts", {}).get(bloom_level, 0))
            pct_col = col + 1
            pct_cell = ws.cell(row=current_row, column=pct_col,
                                 value=f"=IFERROR(({get_column_letter(col)}{current_row}/$S${total_row_index})*100,0)")
            pct_cell.number_format = '0.00"%"'

        ws.cell(row=current_row, column=total_col, value=f"=SUM({','.join(get_column_letter(bc) + str(current_row) for bc in bloom_cols.values())})")

    # Total row: always (re)write every formula from scratch, rather than only
    # filling in blanks. "Only if None" let stale/leftover cell content (e.g.
    # from a template built for a different topic count) survive untouched,
    # which was the source of the mismatched-values bug. There is nothing to
    # preserve here -- every one of these cells is derived, so it's always
    # safe (and correct) to overwrite it on every generation.
    last_data_row = total_row_index - 1

    if ws.cell(row=total_row_index, column=2).value is None:
        ws.cell(row=total_row_index, column=2, value="Total")

    if hours_col:
        ws.cell(row=total_row_index, column=hours_col,
                 value=f"=SUM({get_column_letter(hours_col)}{start_row}:{get_column_letter(hours_col)}{last_data_row})")

    if total_col:
        ws.cell(row=total_row_index, column=total_col,
                 value=f"=SUM({get_column_letter(total_col)}{start_row}:{get_column_letter(total_col)}{last_data_row})")

    if weight_col:
        weight_total_cell = ws.cell(row=total_row_index, column=weight_col,
                 value=f"=SUM({get_column_letter(weight_col)}{start_row}:{get_column_letter(weight_col)}{last_data_row})")
        weight_total_cell.number_format = '0.00"%"'

    # Bloom raw-count columns and their adjacent %-columns: sum each one down
    # the actual data range (start_row..last_data_row), whatever that range
    # turns out to be for this generation -- never a range baked in ahead of
    # time.
    for col in bloom_cols.values():
        pct_col = col + 1
        ws.cell(row=total_row_index, column=col,
                 value=f"=SUM({get_column_letter(col)}{start_row}:{get_column_letter(col)}{last_data_row})")
        pct_total_cell = ws.cell(row=total_row_index, column=pct_col,
                 value=f"=SUM({get_column_letter(pct_col)}{start_row}:{get_column_letter(pct_col)}{last_data_row})")
        pct_total_cell.number_format = '0.00"%"'

    actual_total, mismatch_message = check_totals_mismatch(selected_topics_data, whole_total_points)
    if mismatch_message:
        warning_row = total_row_index + 2
        warning_cell = ws.cell(row=warning_row, column=2, value=f"⚠ WARNING: {mismatch_message}")
        warning_cell.font = Font(name="Calibri", size=11, bold=True, color="CC0000")


def normalize_question_types(question_types):
    """
    Removes duplicates while preserving order.
    """

    normalized = []

    for q in question_types:
        q = q.strip()

        if q not in normalized:
            normalized.append(q)

    if not normalized:
        normalized = ["MCQ"]

    return normalized


def compute_topic_weights(selected_topics, hours_dict):
    """
    Computes the percentage weight of every topic
    according to classroom hours.
    """

    total_hours = 0

    topic_hours = []

    for idx in selected_topics:

        hrs = float(hours_dict.get(str(idx), 1))

        topic_hours.append(hrs)

        total_hours += hrs

    if total_hours == 0:
        total_hours = len(topic_hours)

    weights = []

    for hrs in topic_hours:
        weights.append(hrs / total_hours)

    return weights


def distribute_items(total_items, weights):
    """
    Distributes question counts proportionally.
    """

    raw = [w * total_items for w in weights]

    rounded = [math.floor(x) for x in raw]

    remaining = total_items - sum(rounded)

    decimals = []

    for i, value in enumerate(raw):
        decimals.append((value - rounded[i], i))

    decimals.sort(reverse=True)

    for _, idx in decimals[:remaining]:
        rounded[idx] += 1

    return rounded


def compute_bloom_distribution(item_count):
    """
    Returns

    {
        Remember:2,
        Understand:2,
        ...
    }
    """

    raw = {}

    for bloom in BLOOM_LEVELS:

        raw[bloom] = DEFAULT_BLOOM_PERCENTAGES[bloom] * item_count

    bloom_counts = {}

    for b in BLOOM_LEVELS:

        bloom_counts[b] = math.floor(raw[b])

    remaining = item_count - sum(bloom_counts.values())

    decimals = []

    for b in BLOOM_LEVELS:
        decimals.append(
            (
                raw[b] - bloom_counts[b],
                b
            )
        )

    decimals.sort(reverse=True)

    for _, bloom in decimals[:remaining]:
        bloom_counts[bloom] += 1

    return bloom_counts


def allocate_question_types(bloom_counts, selected_types, start_pointer=0):
    """
    Assigns a question type to every generated question.

    IMPORTANT: `start_pointer` lets the caller carry the round-robin
    position across MULTIPLE calls (i.e. across topics). Previously this
    function always restarted its internal pointer at 0, which meant every
    topic's type-assignment began back at the front of `selected_types`.
    Since each topic usually only has a handful of items (Bloom counts
    split ~6-10 items six ways), the pointer rarely advanced far enough to
    reach types near the end of the list -- so on EVERY topic, the same
    later-listed types (e.g. Matching Type, Situational, Identification,
    depending on click order) were silently skipped every single time.
    Threading a running pointer through `compute_tos` fixes that: the
    round-robin now advances across the whole exam instead of restarting
    per topic, so every selected type gets a fair chance to appear.

    Returns (allocation_dict, next_pointer) so the caller can pass
    next_pointer into the next topic's call.
    """

    selected_types = normalize_question_types(selected_types)

    allocation = defaultdict(list)

    pointer = start_pointer

    for bloom in BLOOM_LEVELS:

        count = bloom_counts[bloom]

        for _ in range(count):

            allocation[bloom].append(

                selected_types[
                    pointer % len(selected_types)
                ]

            )

            pointer += 1

    return dict(allocation), pointer


def compute_tos(
    topics,
    selected_topic_indices,
    hours_dict,
    total_items,
    question_types,
):
    """
    Main TOS computation used by both

    • Excel generation

    • AI generation
    """

    selected_topics = [
        topics[i]
        for i in selected_topic_indices
    ]

    weights = compute_topic_weights(
        selected_topic_indices,
        hours_dict
    )

    items_per_topic = distribute_items(
        total_items,
        weights
    )

    results = []

    # Carried across every topic in this loop (see allocate_question_types
    # docstring above) instead of resetting to 0 per topic.
    type_pointer = 0

    for topic, hrs, items in zip(
        selected_topics,
        [
            float(hours_dict.get(str(i), 1))
            for i in selected_topic_indices
        ],
        items_per_topic
    ):

        bloom_counts = compute_bloom_distribution(items)

        q_distribution, type_pointer = allocate_question_types(
            bloom_counts,
            question_types,
            start_pointer=type_pointer,
        )

        results.append({

            "topic_name": topic["name"],

            "ilo": topic.get("ilo", ""),

            "ilo_description": topic.get("ilo_description", ""),

            "ilo_num": "",

            "hours_a": hrs,

            "minutes_b": 2,

            "weight": round(
                hrs /
                sum(
                    float(hours_dict.get(str(i), 1))
                    for i in selected_topic_indices
                ) * 100,
                2
            ),

            "items": items,

            "bloom_counts": bloom_counts,

            "question_distribution": q_distribution

        })
        
    return results

def generate_tos_from_institutional_template(selected_topics_data, course_code, course_title, whole_total_points):
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "TOS"
    ws.views.sheetView[0].showGridLines = True

    # Institutional Brand Visual Formats
    font_header_title = Font(name="Calibri", size=11, bold=True)
    font_main_label = Font(name="Calibri", size=11, bold=True)
    font_body_data = Font(name="Calibri", size=11)
    
    thin_border_side = Side(style='thin', color='000000')
    grid_border = Border(left=thin_border_side, right=thin_border_side, top=thin_border_side, bottom=thin_border_side)
    
    # Establish Institutional Identity Header Section
    ws['B7'] = "Republic of the Philippines"
    ws['B8'] = "BATANGAS STATE UNIVERSITY"
    ws['B9'] = "The National Engineering University"
    ws['B10'] = "Lipa Campus"
    ws['B11'] = "A. Tanco Drive, Marawoy, Lipa City, Batangas , Philippines 4217"
    ws['B12'] = "Tel Nos. : (+63 43) 980-0385; 980-0392 to local 3130"
    ws['B13'] = "E-mail Address: cics.lipa@g.batstate-u.edu.ph | Website Address: http://www.batstate-u.edu.ph"
    ws['B14'] = "                         College of Informatics and Computing Sciences"
    ws['B15'] = "TABLE OF SPECIFICATIONS\nFinal Examination\nFirst Semester, AY 2026 – 2027"
    ws['B15'].alignment = Alignment(wrap_text=True)

    ws['B18'] = f"COURSE CODE : {course_code or 'IT 332'}"
    ws['B19'] = f"COURSE TITLE: {course_title or 'Integrative Programming and Technologies'}"
    
    # Layout the Double-Row Split Column Headers (Rows 20 to 22)
    ws.merge_cells("G20:R20")
    ws['G20'] = " Indicate the test items that correspond to the following levels of Intended Learning Outcomes"
    ws['G20'].alignment = Alignment(horizontal="center")
    
    ws['B21'] = "TOPICS"
    ws['C21'] = "*ILOs"
    ws['D21'] = "NO. OF HRS "
    ws['F21'] = "WEIGHT (%) **"
    ws['S21'] = "TOTAL NO. OF POINTS"
    
    bloom_headers = ["REMEMBER", "UNDERSTAND", "APPLY ", "ANALYZE", "EVALUATE", "CREATE"]
    for idx, b_lvl in enumerate(bloom_headers):
        col_start = 7 + (idx * 2)
        ws.cell(row=21, column=col_start, value=b_lvl)
        ws.cell(row=21, column=col_start + 1, value="%")
        
    ws['D22'] = "A*"
    ws['E22'] = "B*"

    # Internal keys must match what tos_service.py actually produces
    # (BLOOMS_LEVELS = Remember/Understand/Apply/Analyze/Evaluate/Create).
    # Display labels are separate -- the template wants uppercase headers,
    # but the lookup key into topic["bloom_counts"] must match the caller.
    BLOOMS_LEVELS = ["Remember", "Understand", "Apply", "Analyze", "Evaluate", "Create"]
    
    for r in [20, 21, 22]:
        for c in range(2, 20):
            cell = ws.cell(row=r, column=c)
            cell.font = font_header_title
            cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
            cell.border = grid_border

    start_row = 23
    num_topics = len(selected_topics_data)
    total_row_index = start_row + num_topics
    
    for i, topic in enumerate(selected_topics_data):
        current_row = start_row + i
        
        ws.cell(row=current_row, column=2, value=topic["topic_name"]).alignment = Alignment(horizontal="left")
        ws.cell(row=current_row, column=3, value=topic.get("ilo", f"ILO {topic.get('ilo_num', 1)}"))
        ws.cell(row=current_row, column=3).alignment = Alignment(horizontal="left", wrap_text=True)
        ws.cell(row=current_row, column=4, value=float(topic["hours_a"]))

        # Column B* = "minutes allotted to answer the test item/s" per the
        # template's own footnote -- this is a literal per-topic value, NOT
        # a formula derived from hours share (that was the original bug).
        ws.cell(row=current_row, column=5, value=float(topic.get("minutes_b", 2.0)))
        ws.cell(row=current_row, column=6, value=f"=IFERROR(S{current_row}/$S${total_row_index}*100,0)")

        for idx in range(6):
            item_col = 7 + (idx * 2)
            pct_col = item_col + 1
            ws.cell(row=current_row, column=item_col, value=topic.get("bloom_counts", {}).get(BLOOMS_LEVELS[idx], 0))
            ws.cell(row=current_row, column=pct_col, value=f"=IFERROR(({get_column_letter(item_col)}{current_row}/$S${total_row_index})*100,0)")

        ws.cell(row=current_row, column=19, value=f"=SUM(G{current_row},I{current_row},K{current_row},M{current_row},O{current_row},Q{current_row})")
        
        for c in range(2, 20):
            cell = ws.cell(row=current_row, column=c)
            cell.font = font_body_data
            cell.border = grid_border
            if c >= 4:
                cell.alignment = Alignment(horizontal="right")

    # Bottom Aggregate row configurations
    ws.cell(row=total_row_index, column=2, value="Total").font = font_main_label
    ws.cell(row=total_row_index, column=4, value=f"=SUM(D23:D{total_row_index-1})")
    ws.cell(row=total_row_index, column=5, value=f"=SUM(E23:E{total_row_index-1})")
    ws.cell(row=total_row_index, column=6, value=f"=SUM(F23:F{total_row_index-1})")
    
    for idx in range(6):
        item_col = 7 + (idx * 2)
        pct_col = item_col + 1
        ws.cell(row=total_row_index, column=item_col, value=f"=SUM({get_column_letter(item_col)}23:{get_column_letter(item_col)}{total_row_index-1})")
        ws.cell(row=total_row_index, column=pct_col, value=f"=SUM({get_column_letter(pct_col)}23:{get_column_letter(pct_col)}{total_row_index-1})")
        
    ws.cell(row=total_row_index, column=19, value=f"=SUM(S23:S{total_row_index-1})")
    
    for c in range(2, 20):
        cell = ws.cell(row=total_row_index, column=c)
        cell.font = font_main_label
        cell.border = grid_border
        if c >= 4:
            cell.alignment = Alignment(horizontal="right")

    # Bottom Signature Deck Content
    sign_row = total_row_index + 2
    ws.cell(row=sign_row, column=2, value="Prepared by:")
    ws.cell(row=sign_row, column=9, value="Checked and Verified by:")
    ws.cell(row=sign_row, column=15, value="Approved by:")
    
    name_row = sign_row + 2
    ws.cell(row=name_row, column=2, value="Faculty Instructor").font = font_main_label
    ws.cell(row=name_row, column=9, value="Mr. DIONECES O. ALIMOREN").font = font_main_label
    ws.cell(row=name_row, column=15, value="Dr. RYNDEL V. AMORADO").font = font_main_label

    # Legend footnotes, matching the original template
    legend_row = name_row + 3
    ws.cell(row=legend_row, column=2, value="*ILO - Intended Learning Outcomes")
    ws.cell(row=legend_row + 1, column=2, value="*A - No. of hours the topic was covered in class")
    ws.cell(row=legend_row + 2, column=2, value="*B - No. of minutes alloted to answer the test item/s")
    ws.cell(row=legend_row + 3, column=2, value="**Weight (%) = (no. of  points for a given topic /total no. of points)* 100")

    # whole_total_points is the target the caller confirmed in the Step 3 TOS
    # preview. The sheet's own formulas compute the actual total independently
    # (S{total_row_index}) -- if they disagree, something upstream (e.g. a
    # manual edit that wasn't re-validated) let a mismatched matrix through.
    # Flag it loudly rather than shipping a TOS that quietly doesn't add up.
    actual_total, mismatch_message = check_totals_mismatch(selected_topics_data, whole_total_points)
    if mismatch_message:
        warning_cell = ws.cell(row=legend_row + 5, column=2, value=f"⚠ WARNING: {mismatch_message}")
        warning_cell.font = Font(name="Calibri", size=11, bold=True, color="CC0000")

    ws.column_dimensions['B'].width = 40
    ws.column_dimensions['S'].width = 24
    
    return wb


def _write_exam_type_label(ws, exam_type):
    """The template's header cell bakes in 'TABLE OF SPECIFICATIONS\\n<exam
    type>\\n<semester/year>' as one multi-line string. Replace just the exam
    type line so the file actually reflects Midterm/Final/Quiz/etc. instead
    of always showing whatever the template shipped with."""
    for row in ws.iter_rows(min_row=1, max_row=20, max_col=10):
        for cell in row:
            if isinstance(cell.value, str) and "TABLE OF SPECIFICATIONS" in cell.value:
                lines = cell.value.split("\n")
                if len(lines) >= 2:
                    lines[1] = exam_type
                else:
                    lines.append(exam_type)
                cell.value = "\n".join(lines)
                return


def generate_tos_from_excel_template(selected_topics_data, course_code, course_title, whole_total_points, exam_type="Final Exam"):
    wb = _load_tos_template_workbook()
    ws = wb.active
    ws.views.sheetView[0].showGridLines = True

    _write_course_label(ws, "course code", course_code or "IT 332")
    _write_course_label(ws, "course title", course_title or "Integrative Programming and Technologies")
    _write_exam_type_label(ws, exam_type)

    header_row = _find_header_row(ws)
    if header_row is None:
        header_row = 21

    cols = _guess_template_columns(ws, header_row)
    start_row = header_row + 2

    if not cols:
        cols = {
            "topic_name": 2,
            "ilo": 3,
            "hours_a": 4,
            "minutes_b": 5,
            "weight": 6,
            "remember": 7,
            "understand": 9,
            "apply": 11,
            "analyze": 13,
            "evaluate": 15,
            "create": 17,
            "total_points": 19,
        }
        start_row = 23

    # The template ships with a fixed number of built-in topic rows (e.g. 3),
    # with the Total row, signature block, and legend positioned right after
    # them. If the actual number of topics differs, grow or shrink that block
    # first so nothing gets overwritten (too few rows) or collides with the
    # merged signature cells below it (too many rows) -- this was the cause
    # of both the mismatched totals and the crash on larger topic counts.
    topic_col = cols.get("topic_name", 2)
    num_topics = len(selected_topics_data)
    template_total_row = _find_total_row(ws, start_row, topic_col)
    if template_total_row is not None:
        base_rows = template_total_row - start_row
        delta = num_topics - base_rows
        if delta > 0:
            _resize_topic_row_block(ws, start_row + base_rows, delta)
        elif delta < 0:
            _resize_topic_row_block(ws, start_row + num_topics, delta)

    _write_topics_to_template(ws, start_row, cols, selected_topics_data, whole_total_points)

    # The template's column widths are inconsistent -- some %-columns (e.g.
    # Understand, Apply) are a hair too narrow for a formatted value like
    # "100.00%", which makes Excel show "####" instead of the number. Force
    # every %-column (plus Weight) to a uniform, sufficiently wide column so
    # this can't happen regardless of what the template shipped with.
    from openpyxl.utils import get_column_letter as _gcl
    pct_columns = [cols.get("weight", 6)] + [c + 1 for c in [
        cols.get("remember", 7), cols.get("understand", 9), cols.get("apply", 11),
        cols.get("analyze", 13), cols.get("evaluate", 15), cols.get("create", 17),
    ]]
    for col in pct_columns:
        if col:
            ws.column_dimensions[_gcl(col)].width = max(ws.column_dimensions[_gcl(col)].width or 0, 10)

    return wb