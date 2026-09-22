import { parsePdfReportCsv } from "./pdf-report-csv";

/** Only the six-column PDF workbook is accepted, never an arbitrary workbook. */
export async function excelReportToCsv(bytes: ArrayBuffer): Promise<string> {
  if (bytes.byteLength > 5_000_000) throw new Error("Excel file must be smaller than 5 MB.");
  const { default: ExcelJS } = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(bytes);
  const headerRow = (sheet: (typeof workbook.worksheets)[number]) =>
    [1, 6].find((row) =>
      ["section", "field", "value", "planned", "actual", "instructions"].every(
        (name, i) =>
          sheet
            .getCell(row, i + 1)
            .text.trim()
            .toLowerCase() === name,
      ),
    );
  const matches = workbook.worksheets.filter((sheet) => headerRow(sheet));
  if (!matches.length || matches.length !== workbook.worksheets.length)
    throw new Error(
      "Use the PDF report Excel template. Do not remove its internal column headers.",
    );
  if (
    matches.reduce((sum, sheet) => sum + sheet.rowCount, 0) > 2000 ||
    matches.some((sheet) => sheet.columnCount > 6)
  )
    throw new Error("Excel template must have six columns and at most 2,000 rows.");
  const rows: string[][] = [["section", "field", "value", "planned", "actual", "instructions"]];
  for (const sheet of matches)
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber <= headerRow(sheet)!) return;
      if (row.getCell(1).value === "__section__") return;
      const values = Array.from({ length: 6 }, (_, i) => {
        const cell = row.getCell(i + 1);
        const value = cell.value;
        if (value == null) return "";
        if (value instanceof Date)
          return i === 1 && row.getCell(1).text === "schedule"
            ? value.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" }) +
                "-" +
                String(value.getUTCFullYear()).slice(-2)
            : value.toISOString().slice(0, 10);
        if (typeof value === "object")
          throw new Error(
            `Excel cell ${sheet.name}!${cell.address}: use a plain value, not a formula, link or error.`,
          );
        // Percent formatting converts 47.95% to the 47.95 units used by the CSV contract.
        if (typeof value === "number" && /(^|[^\\])%/.test(cell.numFmt.replace(/"[^"]*"/g, "")))
          return String(+(value * 100).toFixed(8));
        return String(value);
      });
      if (values.some(Boolean)) rows.push(values);
    });
  const csv = rows
    .map((row) => row.map((v) => `"${v.replace(/"/g, '""')}"`).join(","))
    .join("\r\n");
  parsePdfReportCsv(csv); // Same validation for both import paths.
  return csv;
}
