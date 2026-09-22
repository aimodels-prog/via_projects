import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ExcelJS from "exceljs";
import { excelReportToCsv } from "../src/lib/report-excel";
import { parsePdfReportCsv } from "../src/lib/pdf-report-csv";
import { buildExactDashboardHtml } from "../src/lib/dashboard-html.server";
import { buildSalalahPdf } from "../src/lib/salalah-pdf.server";
import { PDFDocument } from "pdf-lib";

test("main template downloads contain matching sample data while blank downloads remain empty", async () => {
  const bytes = await readFile("public/templates/pdf-report-template.xlsx");
  const excel = parsePdfReportCsv(
    await excelReportToCsv(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    ),
  );
  const csv = parsePdfReportCsv(await readFile("public/templates/pdf-report-template.csv", "utf8"));
  const { rawOcrText: ignoredExcel, ...a } = excel;
  const { rawOcrText: ignoredCsv, ...b } = csv;
  assert.ok(ignoredExcel && ignoredCsv);
  assert.deepEqual(a, b);
  assert.equal(excel.projectName, "SAMPLE — Mughsayl Road and Bridge");
  assert.equal(excel.schedule.length, 31);
  assert.equal(excel.contractorPhone, "00000000");
  assert.equal(excel.financialPlannedProgress, 36.5);
  const blank = parsePdfReportCsv(
    await readFile("public/templates/pdf-report-template-blank.csv", "utf8"),
  );
  assert.equal(blank.projectName, "");
  assert.equal(blank.schedule.length, 0);
});

test("exact demo Excel and CSV create the same schedule and automatic PDF/dashboard graphs", async () => {
  const bytes = await readFile("deliverables/pdf-report-template-Mughsayl-Demo.xlsx");
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(bytes);
  assert.equal(workbook.worksheets.length, 1);
  const sheet = workbook.worksheets[0]!;
  assert.equal(sheet.name, "Project report");
  const text = JSON.stringify(sheet.getSheetValues());
  assert.ok(text.includes("S-CURVE"));
  assert.ok(text.includes("NOT cumulative"));
  assert.ok(text.includes("Monthly planned %"));
  assert.equal(sheet.getRow(1).hidden, true);
  const excel = parsePdfReportCsv(
    await excelReportToCsv(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    ),
  );
  const csv = parsePdfReportCsv(
    await readFile("deliverables/pdf-report-template-Mughsayl-Demo.csv", "utf8"),
  );
  assert.deepEqual(excel.schedule, csv.schedule);
  assert.deepEqual(excel.activities, csv.activities);
  assert.deepEqual(excel.scope, csv.scope);
  assert.deepEqual(excel.layers, csv.layers);
  assert.deepEqual(excel.trades, csv.trades);
  assert.equal(excel.layoutTemplateId, csv.layoutTemplateId);
  assert.equal(excel.schedule.length, 31);
  assert.equal(excel.printChartMode, "generated");
  assert.equal(excel.printChartImage, "");
  assert.equal(excel.useRaysutReferenceLayout, true);
  assert.equal(excel.printLayoutMode, "schematic");
  const logo =
    "data:image/png;base64," + (await readFile("Dashboard/via/logo-color.png")).toString("base64");
  const photo =
    "data:image/jpeg;base64," + (await readFile("Dashboard/Photo1.jpg")).toString("base64");
  // Test-only stand-ins for required manual uploads, never published.
  Object.assign(excel, {
    logoImage: logo,
    logoImageSource: "original",
    logoImageWidth: 200,
    logoImageHeight: 200,
    printClientLogo: logo,
    layoutImage: photo,
    layoutImageSource: "original",
    layoutImageWidth: 1200,
    layoutImageHeight: 800,
    activityStatusImage: photo,
  });
  excel.photos = excel.photos.map((p) => ({
    ...p,
    dataUrl: photo,
    source: "original",
    width: 1200,
    height: 800,
  }));
  const html = await buildExactDashboardHtml(excel);
  assert.ok(html.includes('id="sc-cum"') && html.includes('id="sc-mon"'));
  const pdf = await buildSalalahPdf(excel);
  assert.equal((await PDFDocument.load(pdf)).getPageCount(), 1);
});

test("Excel rejects unsupported sheets and formulas, and handles dates and percentages", async () => {
  const wb = new ExcelJS.Workbook();
  const s = wb.addWorksheet("Report");
  s.addRow(["section", "field", "value", "planned", "actual", "instructions"]);
  s.addRow(["monthly", "Data as of", new Date("2026-07-31T00:00:00Z")]);
  s.addRow(["monthly", "Cumulative actual progress %", 0.4094]);
  s.getCell("C3").numFmt = "0.00%";
  const r = parsePdfReportCsv(await excelReportToCsv(await wb.xlsx.writeBuffer()));
  assert.equal(r.actualProgress, 40.94);
  assert.equal(r.dataAsOf, "2026-07-31");
  s.getCell("C3").value = { formula: "1+1", result: 2 };
  await assert.rejects(excelReportToCsv(await wb.xlsx.writeBuffer()), /plain value/);
  s.getCell("A1").value = "wrong";
  await assert.rejects(excelReportToCsv(await wb.xlsx.writeBuffer()), /PDF report Excel template/);
});

test("sectioned Excel rejects duplicate data across tabs", async () => {
  const wb = new ExcelJS.Workbook();
  for (const name of ["Project", "Duplicate"]) {
    const sheet = wb.addWorksheet(name);
    sheet.addRow(["section", "field", "value", "planned", "actual", "instructions"]);
    sheet.addRow(["project", "Project name", "Example road", "", "", ""]);
  }
  await assert.rejects(excelReportToCsv(await wb.xlsx.writeBuffer()), /duplicate Project name/);
});
