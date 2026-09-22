import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { parseDashboardCsv, DASHBOARD_CSV_TEMPLATE } from "../src/lib/dashboard-csv";
import { validateReport, dashboardCoverageWarnings } from "../src/lib/report.types";
import { buildExactDashboardHtml } from "../src/lib/dashboard-html.server";
import { fixture } from "./fixture";

test("CSV provenance cannot select a different dashboard design", async () => {
  const { report } = fixture();
  const legacy = await buildExactDashboardHtml({ ...report, sourceFormat: "legacy" });
  const summary = await buildExactDashboardHtml({
    ...report,
    sourceFormat: "summary-pdf",
    anticipatedPayment: 400000,
  });
  assert.equal(summary, legacy);
});

test("source-summary CSV imports without dashboard-only metadata, paid amounts or photo subtitles", async () => {
  const csv = await readFile("tests/fixtures/mughsayl-summary.csv", "utf8");
  const r = parseDashboardCsv(csv);
  assert.equal(r.sourceFormat, "summary-pdf");
  assert.equal(r.dataAsOf, "Not provided");
  assert.equal(r.monthActualProgress, null);
  assert.equal(r.paidAmount, null);
  assert.equal(r.anticipatedPayment, 400000);
  assert.equal(r.financialPlannedProgress, 85.91);
  assert.equal(r.financialProgress, 81.52);
  assert.equal(r.financialDifference, 4.39); // Printed convention, not silently reversed.
  assert.equal(r.variance, 3.45);
  assert.equal(r.contractRows.length, 7);
  assert.equal(r.contacts.length, 4);
  assert.equal(r.contacts[1]!.role, "");
  assert.ok(r.photos.every((p) => p.sub === ""));
  assert.deepEqual([r.scope.length, r.layers.length, r.trades.length], [0, 0, 0]);
  const valid = fixture().report;
  Object.assign(r, {
    logoImageSource: "original",
    logoImageWidth: 200,
    logoImageHeight: 200,
    layoutImageSource: "original",
    layoutImageWidth: 1200,
    layoutImageHeight: 800,
    photos: r.photos.map((p, i) => ({
      ...p,
      source: "original",
      width: 1200,
      height: 800,
      dataUrl: valid.photos[i]!.dataUrl,
    })),
    progressChartImage: "data:image/png;base64,aGVsbG8=",
  });
  assert.ok(validateReport(r).some((issue) => issue.includes("schedule rows")));
  assert.ok(validateReport(r).some((issue) => issue.includes("project layout image")));
  const warnings = dashboardCoverageWarnings(r).join(" ");
  for (const missing of [
    "Report number",
    "This-month",
    "Scope quantities",
    "Pavement layers",
    "Trade statuses",
  ])
    assert.ok(warnings.includes(missing), missing);
  const html = await buildExactDashboardHtml(r);
  for (const label of [
    "This month",
    "Schedule variance",
    "Scope &amp; build-up",
    "Trade status",
    "Project parties",
    "Not reported",
  ])
    assert.ok(html.includes(label), label);
  for (const alternate of [
    "Total payment anticipated",
    "400,000",
    "Contract value details",
    "Project contacts",
    "Project layout &amp; brief",
  ])
    assert.ok(!html.includes(alternate), alternate);
  assert.ok(!html.includes('background:var(--via-red)"></div><div class="node"'));
});

test("CSV guide includes all fixed Raysut fields without invented table rows", () => {
  for (const type of ["scope,", "layer,", "trade,", "schedule,"])
    assert.ok(!DASHBOARD_CSV_TEMPLATE.split("\n").some((row) => row.startsWith(type)));
  for (const key of ["paid_amount", "data_as_of", "report_number", "revision", "footer_code"])
    assert.ok(DASHBOARD_CSV_TEMPLATE.includes(`field,${key},`));
});

test("readable schedule needs no separately reported monthly KPI fields", () => {
  const { report } = fixture();
  report.monthActualProgress = null;
  report.monthPlannedProgress = null;
  assert.deepEqual(validateReport(report), []);
  report.dataAsOf = "31-02-2026";
  assert.match(validateReport(report).join(" "), /Data as of must be a valid date/);
});
