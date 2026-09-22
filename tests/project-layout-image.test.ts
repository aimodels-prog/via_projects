import test from "node:test";
import assert from "node:assert/strict";
import { load } from "cheerio";
import { fixture } from "./fixture";
import { nextMonthlyReport } from "../src/lib/manual-report";
import { validateReport } from "../src/lib/report.types";
import { buildExactDashboardHtml } from "../src/lib/dashboard-html.server";
import { PDF_REPORT_CSV_TEMPLATE } from "../src/lib/pdf-report-csv";

test("layout upload takes priority over old Raysut flags and survives the next month", async () => {
  const { report } = fixture();
  report.useRaysutReferenceLayout = true;
  report.printLayoutMode = "schematic";
  report.schematic = { approved: false, segments: [], landmarks: [] };
  assert.deepEqual(validateReport(report), []);
  const $ = load(await buildExactDashboardHtml(report));
  assert.equal($(".map img").first().attr("src"), report.layoutImage);
  assert.equal($(".map svg").length, 0);
  assert.ok($(".map img").first().attr("style")?.includes("object-fit:contain"));
  const next = nextMonthlyReport(report);
  assert.equal(next.layoutImage, report.layoutImage);
  assert.equal(next.layoutImageSource, "original");
  report.layoutImage = "";
  assert.ok(
    validateReport(report).some((issue) => issue.includes("Upload a project layout image")),
  );
  assert.ok(!PDF_REPORT_CSV_TEMPLATE.includes("raysut-reference"));
  assert.ok(!PDF_REPORT_CSV_TEMPLATE.includes("layout_section"));
});
