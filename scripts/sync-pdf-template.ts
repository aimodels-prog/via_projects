import { writeFile, readFile, copyFile } from "node:fs/promises";
import { PDF_REPORT_CSV_TEMPLATE } from "../src/lib/pdf-report-csv";
import { writeReportWorkbook } from "./report-workbook";
import { parseCsvRows } from "../src/lib/dashboard-csv";
import { parsePdfReportCsv } from "../src/lib/pdf-report-csv";
await writeFile("public/templates/pdf-report-template-blank.csv", PDF_REPORT_CSV_TEMPLATE);
await writeReportWorkbook(
  PDF_REPORT_CSV_TEMPLATE,
  "public/templates/pdf-report-template-blank.xlsx",
);
const demoPath = "deliverables/pdf-report-template-Mughsayl-Demo";
try {
  const csv = await readFile(`${demoPath}.csv`, "utf8");
  await writeReportWorkbook(csv, `${demoPath}.xlsx`, true);
  await copyFile(`${demoPath}.xlsx`, "public/demos/pdf-report-template-Mughsayl-Demo.xlsx");
  const rows = parseCsvRows(csv).filter((row) => !["layout", "layout_section"].includes(row[0]!));
  for (const row of rows.slice(1)) {
    if (row[1] === "Project name") row[2] = "SAMPLE — Mughsayl Road and Bridge";
    if (row[1] === "Project URL slug") row[2] = "sample-mughsayl-road-and-bridge";
    if (row[1] === "Planned financial progress %") row[2] = "36.50";
    if (row[1]!.endsWith("phone")) row[2] = "00000000";
    if (row[0] === "contract") {
      row[2] = row[1]!.startsWith("Original contract")
        ? "34844451.558"
        : row[1] === "Contingency"
          ? "0"
          : "NA";
      row[5] =
        "SAMPLE ONLY — replace with approved project values. Original contract excludes/includes contingency as labelled; variation totals are NA in this example.";
    }
  }
  const sample = rows
    .map((row) => row.map((v) => `"${v.replace(/"/g, '""')}"`).join(","))
    .join("\r\n");
  parsePdfReportCsv(sample);
  await writeFile("public/templates/pdf-report-template.csv", "\uFEFF" + sample);
  await writeReportWorkbook(sample, "public/templates/pdf-report-template.xlsx", true);
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
}
