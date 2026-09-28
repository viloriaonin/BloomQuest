import openpyxl
from pathlib import Path
p = Path('templates/tos_template.xlsx')
print('exists', p.exists())
wb = openpyxl.load_workbook(p)
ws = wb.active
for r in range(1, 60):
    vals=[]
    for c in range(1, 30):
        v = ws.cell(r, c).value
        if v is not None and str(v).strip():
            vals.append((c, str(v)[:120]))
    if vals:
        print('ROW', r, vals[:20])
