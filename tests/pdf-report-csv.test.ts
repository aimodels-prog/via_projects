import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  PDF_REPORT_CSV_TEMPLATE,
  parsePdfReportCsv,
  parseReportCsv,
} from "../src/lib/pdf-report-csv";
import { parseCsvRows } from "../src/lib/dashboard-csv";
import { fixture } from "./fixture";

test("extended PDF template imports dashboard tables and calculates schedule totals", () => {
  const source =
    PDF_REPORT_CSV_TEMPLATE +
    "\r\nschedule,Jun-26,,10,8,\r\nschedule,Jul-26,,12,9,\r\nscope,Bridge,540,m,,\r\nlayer,BWC,Wearing course,50,,\r\ntrade,Earthworks,active,,,";
  const report = parsePdfReportCsv(source);
  assert.equal(report.schedule[1]!.plannedCumulative, 22);
  assert.equal(report.schedule[1]!.actualCumulative, 17);
  assert.deepEqual(report.scope[0], { label: "Bridge", value: "540", unit: "m" });
  assert.equal(report.layers[0]!.thickness, 50);
  assert.equal(report.trades[0]!.status, "active");
  assert.throws(() => parsePdfReportCsv(source.replace("Jul-26", "Aug-26")), /missing month/);
  assert.throws(
    () => parsePdfReportCsv(source.replace("Earthworks,active", "Earthworks,finished")),
    /trade name and status/,
  );
  assert.throws(() => parsePdfReportCsv(source.replace("10,8,", "10,, ")), /gap/);
});

function filled(values: Record<string, string>) {
  return parseCsvRows(PDF_REPORT_CSV_TEMPLATE)
    .map((row) => {
      if (Object.hasOwn(values, row[1]!)) row[2] = values[row[1]!]!;
      return row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(",");
    })
    .join("\r\n");
}
test("PDF CSV template accepts blanks as an editable draft without invented numbers or images", () => {
  const r = parsePdfReportCsv("\uFEFF" + PDF_REPORT_CSV_TEMPLATE);
  assert.ok(Number.isNaN(r.actualProgress));
  assert.equal(r.paidAmount, null);
  assert.equal(r.activities.length, 0);
  assert.equal(r.schedule.length, 0);
  assert.equal(r.printChartMode, "image");
  assert.equal(r.photos.length, 4);
  assert.ok(r.photos.every((p) => p.source !== "original"));
  assert.equal(r.contractRows.length, 7);
});
test("PDF CSV preserves quoted narrative and phone zeros, calculates month and differences", () => {
  const r = parseReportCsv(
    filled({
      "Project name": 'Road, "East"',
      "Brief description": "Line one, description\nLine two",
      "Consultant phone": "0096812345678",
      "Data as of": "2026-07-31",
      "Construction days": "912",
      "Elapsed days": "517",
      "Cumulative planned progress %": "47.95",
      "Cumulative actual progress %": "40.94",
      "Planned financial progress %": "46.539",
      "Actual financial progress %": "33.380",
      "Actually paid amount": "10,969,331.064",
      photo_1: "Pier wall",
    }),
  );
  assert.equal(r.reportMonth, "July 2026");
  assert.equal(r.remainingDays, 395);
  assert.equal(r.variance, -7.01);
  assert.equal(r.financialDifference, -13.159);
  assert.equal(r.paidAmount, 10969331.064);
  assert.equal(r.consultantPhone, "0096812345678");
  assert.equal(r.brief, "Line one, description\nLine two");
  assert.equal(r.photos[0]!.caption, "Pier wall");
  assert.equal(parseReportCsv(fixture().csv).projectName, fixture().report.projectName);
});
test("PDF CSV reports bad alignment, duplicates, dates and activity values without silently repairing", () => {
  assert.throws(() => parsePdfReportCsv(filled({ "Data as of": "2026-02-30" })), /valid.*date/);
  assert.throws(() => parsePdfReportCsv(filled({ "Actual manpower": "290%" })), /CSV row.*number/);
  assert.throws(
    () => parsePdfReportCsv(PDF_REPORT_CSV_TEMPLATE + "\nmonthly,Actual manpower,10,20,,"),
    /planned and actual/,
  );
  assert.throws(
    () => parsePdfReportCsv(PDF_REPORT_CSV_TEMPLATE + "\nmonthly,Actual manpower,10,,,"),
    /duplicate/,
  );
  assert.throws(
    () => parsePdfReportCsv(PDF_REPORT_CSV_TEMPLATE + "\nphoto,photo_5,caption,,,"),
    /photo_1 to photo_4/,
  );
  assert.throws(
    () => parsePdfReportCsv(PDF_REPORT_CSV_TEMPLATE + "\nactivity,Excavation,,10,5,,extra"),
    /six columns/,
  );
  const r = parsePdfReportCsv(PDF_REPORT_CSV_TEMPLATE + "\nactivity,Excavation,,10,5,");
  assert.deepEqual(r.activities[0], { name: "Excavation", planned: 10, actual: 5, diff: -5 });
});
test("downloadable PDF CSV stays in sync with the in-app template", async () => {
  const file = await readFile("public/templates/pdf-report-template-blank.csv", "utf8");
  assert.equal(
    file
      .replace(/^\uFEFF/, "")
      .replace(/\r\n/g, "\n")
      .trim(),
    PDF_REPORT_CSV_TEMPLATE.replace(/\r\n/g, "\n").trim(),
  );
});
