from pathlib import Path

path = Path('routers/tos_utils.py')
text = path.read_text(encoding='utf-8')
start = text.index('def generate_tos_from_institutional_template(selected_topics_data, course_code, course_title, whole_total_points):')
end = text.index('    return wb\n', start) + len('    return wb\n')
new_func = '''def generate_tos_from_institutional_template(selected_topics_data, course_code, course_title, whole_total_points):
    wb = _load_tos_template_workbook()
    ws = wb.active
    ws.views.sheetView[0].showGridLines = True

    header_row = _find_header_row(ws)
    if header_row is None:
        header_row = 21

    cols = _guess_template_columns(ws, header_row)
    start_row = header_row + 2

    _write_course_label(ws, "course code", course_code or "IT 332")
    _write_course_label(ws, "course title", course_title or "Integrative Programming and Technologies")

    if not cols:
        ws = wb.active
        ws.title = "TOS"
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
        start_row = 23

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

    _write_topics_to_template(ws, start_row, cols, selected_topics_data, whole_total_points)

    return wb
'''
path.write_text(text[:start] + new_func + text[end:], encoding='utf-8')
print('patched')
