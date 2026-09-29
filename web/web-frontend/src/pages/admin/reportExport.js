export const escapeCsvCell = (value) => {
  const text = String(value ?? "");
  const safeText = /^[=+@\-\t\r]/.test(text) ? `'${text}` : text;
  return `"${safeText.replace(/"/g, '""')}"`;
};

export const buildCsvReport = (sections, columns) => sections
  .flatMap(({ title, rows, columns: sectionColumns = columns }) => [
    [title],
    sectionColumns.map((column) => column.label),
    ...rows.map((row) => sectionColumns.map((column) => row[column.key])),
    [],
  ])
  .map((row) => row.map(escapeCsvCell).join(","))
  .join("\r\n");

export const downloadCsvReport = (content, filename) => {
  const blob = new Blob([`\uFEFF${content}`], { type: "text/csv;charset=utf-8" });
  downloadBlob(blob, filename);
};

const excelColumnName = (columnNumber) => {
  let name = "";
  let index = columnNumber;
  while (index > 0) {
    const remainder = (index - 1) % 26;
    name = String.fromCharCode(65 + remainder) + name;
    index = Math.floor((index - 1) / 26);
  }
  return name;
};

const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};

export const buildXlsxReport = async (sections) => {
  const excelModule = await import("exceljs");
  const ExcelJS = excelModule.default || excelModule;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "BloomQuest Admin";
  workbook.created = new Date();
  workbook.subject = "Admin dashboard report";
  const generatedAt = new Date();

  sections.forEach(({ title, subtitle = "BloomQuest Admin Report", emptyMessage, columns, rows }) => {
    const worksheet = workbook.addWorksheet(title.slice(0, 31));
    worksheet.columns = columns.map(({ key, label }) => {
      const contentWidth = rows.reduce((width, row) => Math.max(width, String(row[key] ?? "").length), label.length);
      return { key, width: Math.min(52, Math.max(16, contentWidth + 3)) };
    });
    worksheet.properties.tabColor = { argb: "FFB4454A" };
    worksheet.views = [{ state: "frozen", ySplit: 5, showGridLines: false }];
    worksheet.pageSetup = { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
    worksheet.headerFooter.oddFooter = "BloomQuest Admin Report  |  Page &P of &N";

    worksheet.addRow([title]);
    worksheet.mergeCells(1, 1, 1, columns.length);
    worksheet.getRow(1).height = 32;
    worksheet.getCell(1, 1).font = { bold: true, size: 17, color: { argb: "FFFFFFFF" } };
    worksheet.getCell(1, 1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF8F2938" } };
    worksheet.getCell(1, 1).alignment = { vertical: "middle", indent: 1 };

    worksheet.addRow([subtitle]);
    worksheet.mergeCells(2, 1, 2, columns.length);
    worksheet.getRow(2).height = 23;
    worksheet.getCell(2, 1).font = { size: 10, color: { argb: "FF475569" }, italic: true };
    worksheet.getCell(2, 1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } };
    worksheet.getCell(2, 1).alignment = { vertical: "middle", indent: 1, wrapText: true };

    worksheet.addRow([`Generated ${generatedAt.toLocaleString()}`]);
    worksheet.mergeCells(3, 1, 3, columns.length);
    worksheet.getRow(3).height = 20;
    worksheet.getCell(3, 1).font = { size: 9, color: { argb: "FF64748B" } };
    worksheet.getCell(3, 1).alignment = { vertical: "middle", indent: 1 };
    worksheet.addRow([]);

    const header = worksheet.addRow(columns.map(({ label }) => label));
    header.height = 28;
    header.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: "FF263238" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1D9D6" } };
      cell.alignment = { vertical: "middle", wrapText: true };
      cell.border = { bottom: { style: "thin", color: { argb: "FFB4454A" } } };
    });

    if (!rows.length) {
      const emptyRow = worksheet.addRow([emptyMessage || "No records are available for this report scope."]);
      worksheet.mergeCells(emptyRow.number, 1, emptyRow.number, columns.length);
      emptyRow.height = 34;
      emptyRow.getCell(1).font = { italic: true, color: { argb: "FF64748B" } };
      emptyRow.getCell(1).alignment = { vertical: "middle", wrapText: true, indent: 1 };
    } else {
      rows.forEach((row, index) => {
        const worksheetRow = worksheet.addRow(columns.map(({ key }) => row[key] ?? ""));
        worksheetRow.alignment = { vertical: "top", wrapText: true };
        if (index % 2 === 1) {
          worksheetRow.eachCell((cell) => {
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } };
          });
        }
        columns.forEach(({ key }, columnIndex) => {
          if (key === "quality_score" && typeof row[key] === "number") {
            worksheetRow.getCell(columnIndex + 1).numFmt = '0"%"';
          }
        });
      });
      worksheet.autoFilter = {
        from: "A5",
        to: `${excelColumnName(columns.length)}${worksheet.rowCount}`,
      };
    }

    worksheet.eachRow((row) => {
      row.eachCell((cell) => {
        cell.alignment = { vertical: cell.alignment?.vertical || "middle", wrapText: true, ...cell.alignment };
      });
    });

    if (!rows.length && emptyMessage) {
      worksheet.getCell("A6").note = "A zero count in the summary means no matching records were returned for the selected department.";
    }
  });

  return workbook.xlsx.writeBuffer();
};

export const downloadXlsxReport = async (sections, filename) => {
  const buffer = await buildXlsxReport(sections);
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  downloadBlob(blob, filename);
};