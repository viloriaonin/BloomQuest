from pathlib import Path

path = Path('routers/tos_utils.py')
text = path.read_text(encoding='utf-8')
start = text.index('def generate_tos_from_institutional_template(selected_topics_data, course_code, course_title, whole_total_points):')
end = text.index('    return wb\n', start) + len('    return wb\n')
new_body = '''def generate_tos_from_institutional_template(selected_topics_data, course_code, course_title, whole_total_points):
    wb = _load_tos_template_workbook()
    ws = wb.active
    ws.views.sheetView[0].showGridLines = True

    _write_course_label(ws, "course code", course_code or "IT 332")
    _write_course_label(ws, "course title", course_title or "Integrative Programming and Technologies")

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

    _write_topics_to_template(ws, start_row, cols, selected_topics_data, whole_total_points)

    return wb
'''
path.write_text(text[:start] + new_body + text[end:], encoding='utf-8')
print('patched')
