import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PDFDocument } from "pdf-lib";
import { buildSalalahPdf } from "../src/lib/salalah-pdf.server";
import { newManualReport, nextMonthlyReport } from "../src/lib/manual-report";
import { fixture } from "./fixture";
import { draftReportSchema } from "../src/lib/report-draft";
import { reportSchema } from "../src/lib/report.types";
import { headerLogoLayout } from "../src/lib/header-logos";

test("VIA Classic preserves the sanitized master's static labels and A4 geometry", async () => {
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  async function inspect(path: string) {
    const bytes = new Uint8Array(await readFile(path));
    const task = getDocument({ data: bytes, useSystemFonts: true });
    try {
      const doc = await task.promise;
      assert.equal(doc.numPages, 1);
      const page = await doc.getPage(1);
      const content = await page.getTextContent();
      return {
        view: page.view,
        words: content.items
          .map((item) => ("str" in item ? item.str : ""))
          .join(" ")
          .split(/\s+/)
          .filter(Boolean)
          .sort(),
      };
    } finally {
      await task.destroy();
    }
  }
  assert.deepEqual(
    await inspect("templates/salalah/master-classic.pdf"),
    await inspect("templates/salalah/master.pdf"),
  );
});

test("header logos use centred non-overlapping rows within the A4 bounds", () => {
  for (let count = 1; count <= 12; count++) {
    const { boxes, height } = headerLogoLayout(count);
    assert.equal(boxes.length, count);
    boxes.forEach((b) => {
      assert.ok(b.x >= 24 && b.x + b.width <= 595.321 - 24);
      assert.ok(b.top >= 16 && b.top + b.height < height);
    });
    for (const top of new Set(boxes.map((b) => b.top))) {
      const row = boxes.filter((b) => b.top === top);
      assert.ok(Math.abs(row[0]!.x - (595.32 - row.at(-1)!.x - row.at(-1)!.width)) < 0.001);
    }
  }
  assert.throws(() => headerLogoLayout(13), /12/);
});

test("multiple logos produce one A4 page and are retained for next month", async () => {
  const r = await pdfFixture();
  r.headerLogos = Array.from({ length: 12 }, (_, i) => ({
    name: `Logo ${i + 1}`,
    dataUrl: r.printClientLogo,
  }));
  const bytes = await buildSalalahPdf(r);
  const pdf = await PDFDocument.load(bytes);
  assert.equal(pdf.getPageCount(), 1);
  assert.ok(Math.abs(pdf.getPages()[0]!.getHeight() - 841.92) < 0.01);
  assert.deepEqual(nextMonthlyReport(r).headerLogos, r.headerLogos);
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const task = getDocument({ data: bytes, useSystemFonts: true });
  const rendered = await task.promise;
  const content = await (await rendered.getPage(1)).getTextContent();
  const text = content.items.map((item) => ("str" in item ? item.str : "")).join(" ");
  assert.ok(text.includes("Test Contractor"), "dynamic text/fonts survive header composition");
  assert.ok(text.includes("Contract Value Details"), "master content survives header composition");
  await task.destroy();
  r.headerLogos = [{ name: "External", dataUrl: "https://example.com/logo.png" }];
  await assert.rejects(buildSalalahPdf(r), /Header logo 1/);
});

test("incomplete setup drafts round-trip without turning missing numbers into zero", () => {
  const draft = newManualReport();
  const saved = draftReportSchema.parse(draft);
  const restored = draftReportSchema.parse(JSON.parse(JSON.stringify(saved)));
  assert.ok(Number.isNaN(restored.actualProgress));
  assert.equal(reportSchema.safeParse(restored).success, false);
});

export async function pdfFixture() {
  const r = fixture().report;
  r.printClientLogo =
    "data:image/png;base64," + (await readFile("Dashboard/via/logo-color.png")).toString("base64");
  const photo =
    "data:image/jpeg;base64," + (await readFile("Dashboard/Photo1.jpg")).toString("base64");
  r.layoutImage = photo;
  r.activityStatusImage = photo;
  r.photos = r.photos.map((p) => ({ ...p, dataUrl: photo }));
  r.contractorName = "Test Contractor";
  r.consultantName = "Test Consultant";
  r.consultantRepresentative = "Reviewer";
  r.consultantRole = "RE";
  r.contractorRepresentative = "Manager";
  r.contractorRole = "PM";
  return r;
}
test("native A4 PDF uses the fixed single-page master", async () => {
  const bytes = await buildSalalahPdf(await pdfFixture());
  const pdf = await PDFDocument.load(bytes);
  assert.equal(pdf.getPageCount(), 1);
  const { width, height } = pdf.getPages()[0]!.getSize();
  assert.ok(Math.abs(width - 595.32) < 0.01);
  assert.ok(Math.abs(height - 841.92) < 0.01);
});

test("PDF image chart does not require invented schedule rows; dashboard still does", async () => {
  const r = await pdfFixture();
  r.printChartMode = "image";
  r.printChartImage = r.layoutImage;
  r.schedule = [];
  const pdf = await PDFDocument.load(await buildSalalahPdf(r));
  assert.equal(pdf.getPageCount(), 1);
  const { validateReport } = await import("../src/lib/report.types");
  assert.ok(validateReport(r).some((issue) => /schedule rows/.test(issue)));
  r.printChartImage = "";
  await assert.rejects(buildSalalahPdf(r), /original S-curve image/);
  r.printChartImage = "https://example.com/chart.png";
  await assert.rejects(buildSalalahPdf(r), /chart/);
});

test("new month clears the previous chart picture while retaining the chosen mode", () => {
  const r = fixture().report;
  r.printChartMode = "image";
  r.printChartImage = "previous-month-image";
  const next = nextMonthlyReport(r);
  assert.equal(next.printChartMode, "image");
  assert.equal(next.printChartImage, "");
});

test("master has no original July values or named project parties in its text", async () => {
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const task = getDocument({
    data: new Uint8Array(await readFile("templates/salalah/master.pdf")),
    useSystemFonts: true,
  });
  const doc = await task.promise;
  const content = await (await doc.getPage(1)).getTextContent();
  const text = content.items.map((i) => ("str" in i ? i.str : "")).join(" ");
  for (const old of ["MUGHSAYL", "34,844,451.558", "Habib Noor", "97778855", "40.94", "July 2026"])
    assert.ok(!text.includes(old), old);
  assert.ok(text.includes("Contract Value Details"));
  await task.destroy();
});
test("PDF refuses silent text overflow and missing print graphics", async () => {
  const r = await pdfFixture();
  r.projectName = "LONG PROJECT TITLE ".repeat(50);
  await assert.rejects(buildSalalahPdf(r), /title:.*do not fit/);
  r.projectName = "Valid project";
  r.printClientLogo = "";
  await assert.rejects(buildSalalahPdf(r), /client\/ministry logo/);
});
test("manual setup has no fabricated quantities; next month keeps static setup", () => {
  assert.ok(Number.isNaN(newManualReport().actualProgress));
  const old = fixture().report,
    next = nextMonthlyReport(old);
  assert.equal(next.projectName, old.projectName);
  assert.equal(next.contractValue, old.contractValue);
  assert.equal(next.previousMonthReference?.actualProgress, old.actualProgress);
  assert.equal(next.previousMonthReference?.reportMonth, old.reportMonth);
  assert.deepEqual(next.schedule, old.schedule);
  assert.equal(next.reportMonth, "");
  assert.ok(Number.isNaN(next.actualProgress));
  assert.equal(next.schematic.approved, false);
  assert.ok(next.photos.every((p) => p.source === "pdf"));
});
