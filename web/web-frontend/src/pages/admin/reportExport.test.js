import ExcelJS from "exceljs";
import { buildCsvReport, buildXlsxReport, escapeCsvCell } from "./reportExport";

test("CSV serialization quotes commas and newlines and neutralizes formulas", () => {
  expect(escapeCsvCell('=SUM("a,b")')).toBe('"\'=SUM(""a,b"")"');
  expect(escapeCsvCell("North, Campus\nMain")).toBe('"North, Campus\nMain"');
});

test("CSV report includes section headings, headers, and records", () => {
  const csv = buildCsvReport(
    [{ title: "Failed actions", rows: [{ action: "Export failed", status: "error" }] }],
    [{ key: "action", label: "Action" }, { key: "status", label: "Status" }],
  );

  expect(csv).toContain('"Failed actions"');
  expect(csv).toContain('"Action","Status"');
  expect(csv).toContain('"Export failed","error"');
});

test("XLSX report retains readable formatting and filters", async () => {
  const bytes = await buildXlsxReport([{
    title: "Department comparison",
    columns: [
      { key: "department", label: "Department" },
      { key: "quality", label: "Quality score (%)" },
    ],
    rows: [{ department: "College of Informatics and Computing Sciences", quality: 88 }],
  }]);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(bytes);
  const sheet = workbook.getWorksheet("Department comparison");

  expect(sheet.getCell("A1").value).toBe("Department comparison");
  expect(sheet.getCell("A1").font.bold).toBe(true);
  expect(sheet.getCell("A2").value).toBe("BloomQuest Admin Report");
  expect(sheet.getCell("A5").value).toBe("Department");
  expect(sheet.getCell("A5").fill.fgColor.argb).toBe("FFF1D9D6");
  expect(sheet.getColumn(1).width).toBeGreaterThan(14);
  expect(sheet.autoFilter).toBe("A5:B6");
  expect(sheet.views[0].state).toBe("frozen");
  expect(sheet.views[0].ySplit).toBe(5);
  expect(sheet.getCell("B6").value).toBe(88);
});

test("XLSX empty sheets explain that the selected scope has no data", async () => {
  const bytes = await buildXlsxReport([{
    title: "Activity details",
    subtitle: "Scope: College of Arts and Sciences",
    emptyMessage: "No activity events were recorded for College of Arts and Sciences.",
    columns: [{ key: "date", label: "Date" }, { key: "action", label: "Action" }],
    rows: [],
  }]);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(bytes);
  const sheet = workbook.getWorksheet("Activity details");

  expect(sheet.getCell("A2").value).toContain("College of Arts and Sciences");
  expect(sheet.getCell("A5").value).toBe("Date");
  expect(sheet.getCell("A6").value).toBe("No activity events were recorded for College of Arts and Sciences.");
  expect(sheet.getCell("A6").alignment.wrapText).toBe(true);
});