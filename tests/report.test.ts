import test from "node:test";
import assert from "node:assert/strict";
import { parseDashboardCsv, DASHBOARD_CSV_TEMPLATE } from "../src/lib/dashboard-csv";
import {
  reportSchema,
  validateReport,
  makeSlug,
  dashboardCoverageWarnings,
} from "../src/lib/report.types";
import { monthKey, reportDate } from "../src/lib/report-dates";
import {
  issueToken,
  verifyToken,
  credentialVersion,
  SESSION_SECONDS,
} from "../src/lib/session-token";

import { fixture } from "./fixture";
test("valid reference data passes approval validation", () =>
  assert.deepEqual(validateReport(fixture().report), []));
test("small original Raysut photographs are accepted with a resolution warning", () => {
  const { report } = fixture();
  report.photos[0]!.width = 553;
  report.photos[0]!.height = 456;
  assert.deepEqual(validateReport(report), []);
  assert.match(dashboardCoverageWarnings(report).join(" "), /Photo 1 is 553 × 456 pixels/);
  report.photos[0]!.width = 0;
  assert.match(validateReport(report).join(" "), /valid dimensions/);
});
test("missing activity quantities remain null, not zero", () => {
  const { csv } = fixture();
  const parsed = parseDashboardCsv(
    csv.replace("activity,Activity name,,,0,0", "activity,Borrow Excavation,,,,"),
  );
  assert.equal(parsed.activities[0]?.planned, null);
  assert.equal(parsed.activities[0]?.diff, null);
});
test("scope accepts an omitted unit without inventing one", () => {
  const csv = fixture().csv.replace("scope,Scope item 1,Value,Unit", "scope,Bridge,1,");
  assert.deepEqual(parseDashboardCsv(csv).scope[0], { label: "Bridge", value: "1", unit: "" });
});

test("missing scope quantities are retained as review notes, never zero", () => {
  for (const value of ["", "Not provided", "NA", "N/A", "-", "—"]) {
    const csv = fixture().csv.replace("scope,Scope item 1,Value,Unit", `scope,Bridge,${value},No`);
    const report = parseDashboardCsv(csv);
    assert.equal(report.scope.length, 4);
    assert.ok(
      report.details.some(
        (item) => item.label === "Review required: scope quantity — Bridge" && item.unit === "No",
      ),
    );
  }
});

test("scope still requires a description and preserves explicit zero", () => {
  const csv = fixture().csv;
  assert.throws(
    () => parseDashboardCsv(csv.replace("scope,Scope item 1,Value,Unit", "scope,,1,No")),
    /needs a description in the key column/,
  );
  assert.equal(
    parseDashboardCsv(csv.replace("scope,Scope item 1,Value,Unit", "scope,Bridge,0,No")).scope[0]
      ?.value,
    "0",
  );
});

test("activity quantities above 100 are preserved", () => {
  const { csv } = fixture();
  assert.equal(
    parseDashboardCsv(csv.replace("activity,Activity name,,,0,0", "activity,Concrete,,,98,103.40"))
      .activities[0]?.actual,
    103.4,
  );
});
test("malformed CSV quote is rejected", () =>
  assert.throws(() =>
    parseDashboardCsv(fixture().csv.replace("Test bridge project", 'Bad"project"')),
  ));
test("months are canonical and impossible dates are rejected", () => {
  assert.equal(monthKey("July 2026"), "2026-07");
  assert.equal(monthKey("Jul-26"), "2026-07");
  assert.equal(reportDate("31-02-2026"), null);
  assert.notEqual(reportDate("29-02-2024"), null);
});
test("inconsistent monthly totals and report periods block publication", () => {
  const { report } = fixture();
  report.schedule[1]!.plannedMonthly = 99;
  assert.match(validateReport(report).join(" "), /reconcile/);
  report.reportMonth = "August 2026";
  assert.match(validateReport(report).join(" "), /report month/);
});
test("unknown is not treated as not-started", () => {
  const { report } = fixture();
  report.trades = [{ name: "Not provided", status: "notstarted" }];
  assert.match(validateReport(report).join(" "), /known status/);
  report.trades[0]!.status = "unknown";
  assert.deepEqual(validateReport(report), []);
});
test("invalid currency amounts and duplicate rows are blocked", () => {
  const { report } = fixture();
  report.contractValue = "Not provided";
  report.activities.push({ ...report.activities[0]! });
  assert.match(validateReport(report).join(" "), /Contract value/);
  assert.match(validateReport(report).join(" "), /Duplicate activity/);
});
test("role-specific sessions expire and are invalidated by password changes", () => {
  const now = 100000;
  const version = credentialVersion("first-password");
  const token = issueToken("client:alpha", version, now);
  assert.equal(verifyToken(token, "client:alpha", version, now), true);
  assert.equal(verifyToken(token, "internal:admin", version, now), false);
  assert.equal(verifyToken(token, "client:alpha", credentialVersion("changed"), now), false);
  assert.equal(verifyToken(token, "client:alpha", version, now + SESSION_SECONDS * 1000), false);
  assert.equal(verifyToken(token + "x", "client:alpha", version, now), false);
});
test("reserved URLs and traversal are rejected", () => {
  const { report } = fixture();
  assert.equal(reportSchema.safeParse({ ...report, slug: "../admin" }).success, false);
  assert.equal(reportSchema.safeParse({ ...report, slug: "upload" }).success, false);
  assert.ok(makeSlug("A bridge & road").length > 0);
});
test("Raysut dashboard uses imported data, embedded fonts and safe lightbox images", async () => {
  const { buildExactDashboardHtml } = await import("../src/lib/dashboard-html.server");
  const report = fixture().report;
  report.photos[0]!.caption = '</script><img src=x onerror="alert(1)">';
  report.photos[0]!.dataUrl = "data:image/png;base64,aGVsbG8=";
  const html = await buildExactDashboardHtml(report);
  assert.ok(html.includes('class="stage" id="stage"'));
  assert.ok(html.includes("grid-template-columns: 820px 1fr 440px"));
  assert.ok(html.includes("data:font/ttf;base64,"));
  assert.ok(html.includes("Test bridge project"));
  assert.ok(html.includes("July 2026"));
  assert.ok(html.includes(report.awardDate));
  assert.ok(html.includes("PHOTOS[lbIndex][2]"));
  assert.ok(!html.includes("Pier Foundation Backfill"));
  assert.ok(!html.includes("DGRLT/DHO/2024/47"));
  assert.ok(!html.includes("June 2026"));
  assert.ok(!html.includes("{{HEADER}}"));
  const { load } = await import("cheerio");
  assert.equal(load(html)("[onerror]").length, 0);
  const { parse } = await import("@babel/parser");
  for (const match of html.matchAll(/<script>([\s\S]*?)<\/script>/g))
    parse(match[1]!, { sourceType: "script" });
});

test("missing payment and unreadable chart numbers are not invented", () => {
  const { csv } = fixture();
  const source = csv
    .split("\n")
    .filter(
      (line) =>
        !line.startsWith("schedule,") &&
        !line.startsWith("scope,") &&
        !line.startsWith("layer,") &&
        !line.startsWith("trade,"),
    )
    .map((line) =>
      line.startsWith("field,paid_amount,") ||
      line.startsWith("field,month_planned_progress,") ||
      line.startsWith("field,month_actual_progress,")
        ? line
            .split(",")
            .map((cell, i) => (i === 2 ? "" : cell))
            .join(",")
        : line,
    )
    .join("\n");
  const report = parseDashboardCsv(source);
  assert.equal(report.paidAmount, null);
  assert.equal(report.monthActualProgress, null);
  assert.equal(report.chartSource, "table");
  assert.equal(report.schedule.length, 0);
  assert.equal(report.layers.length, 0);
  assert.equal(report.scope.length, 0);
  const warnings = dashboardCoverageWarnings(report).join(" ");
  assert.ok(warnings.includes("This-month progress is incomplete"));
  assert.ok(warnings.includes("Scope quantities are not reported"));
  assert.match(warnings, /Verified monthly schedule data/);
});

test("Legacy image preference cannot replace the interactive graph", async () => {
  const { buildExactDashboardHtml } = await import("../src/lib/dashboard-html.server");
  const report = fixture().report;
  report.chartSource = "image";
  report.progressChartImage = "data:image/png;base64,aGVsbG8=";
  report.scope = [];
  report.layers = [];
  report.trades = [];
  report.activities[0]!.planned = null;
  report.activities[0]!.actual = null;
  report.activities[0]!.diff = null;
  report.paidAmount = null;
  report.projectName = "<script>unsafe()</script>";
  const html = await buildExactDashboardHtml(report);
  assert.ok(!html.includes('class="toggle" style="display:none"'));
  assert.ok(!html.includes('alt="Original reported S-curve"'));
  assert.ok(html.includes('id="sc-cum"'));
  assert.ok(!html.includes("<script>unsafe()"));
  assert.ok(html.includes("&lt;script&gt;unsafe()"));
  assert.ok(!html.includes("NaN"));
  assert.ok(!html.includes("Box culverts"));
  assert.ok(html.includes("Not reported"));
});
