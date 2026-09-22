import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { chromium } from "@playwright/test";
import { load } from "cheerio";
import { fixture } from "../tests/fixture";
import { buildExactDashboardHtml } from "../src/lib/dashboard-html.server";

// Read the existing workbook, not the project's temporarily populated dummy report.
const sheets = JSON.parse(
  execFileSync(
    "python",
    [
      "-c",
      `
import json
from openpyxl import load_workbook
w=load_workbook('deliverables/VIA_Mughsayl_July_2026_Example.xlsx',read_only=True,data_only=True)
print(json.dumps({s.title:list(s.values)[3:] for s in w},default=str))
`,
    ],
    { encoding: "utf8" },
  ),
);
type Row = Array<string | number | null>;
const rows = (name: string): Row[] => sheets[name];
const fields = Object.fromEntries(
  ["Project", "Contract_Dates", "Progress_Finance"].flatMap((name) =>
    rows(name).map((r) => [r[0], r[2]]),
  ),
);
const text = (key: string) => String(fields[key] ?? "Not reported");
const date = (key: string) => (fields[key] ? String(fields[key]).slice(0, 10) : "Not reported");
const { report } = fixture();
Object.assign(report, {
  projectName: text("project_name"),
  projectNumber: text("project_reference"),
  projectType: text("project_type"),
  region: text("region"),
  reportMonth: "July 2026",
  reportNumber: text("report_number"),
  revision: text("revision"),
  dataAsOf: date("data_as_of"),
  brief: text("brief"),
  footerCode: "EXCEL PREVIEW — NEEDS REVIEW",
  contractValue: text("dashboard_contract_value"),
  currency: text("currency"),
  awardDate: date("award_date"),
  startDate: date("start_date"),
  completionDate: date("completion_date"),
  expectedCompletionDate: date("expected_completion"),
  constructionDays: fields.construction_days,
  mobilizationDays: fields.mobilization_days,
  elapsedDays: fields.elapsed_days,
  remainingDays: fields.remaining_days,
  plannedProgress: fields.physical_planned,
  actualProgress: fields.physical_actual,
  monthPlannedProgress: fields.monthly_planned,
  monthActualProgress: fields.monthly_actual,
  financialProgress: fields.financial_actual,
  paidAmount: fields.paid_amount,
  schedule: [],
  layers: [],
  trades: [],
  schematic: undefined,
  logoImage: "",
  layoutImage: "",
  engineerName: "Not reported",
  engineerPhone: "Not reported",
});
for (const [role, prefix] of [
  ["Client", "client"],
  ["Contractor", "contractor"],
  ["Consultant", "consultant"],
]) {
  const r = rows("Contacts").find((r) => r[0] === role)!;
  Object.assign(report, {
    [`${prefix}Name`]: r[1] ?? "Not reported",
    [`${prefix}Department`]: r[2] ?? "",
    [`${prefix}Representative`]: r[3] ?? "Not reported",
    [`${prefix}Role`]: r[4] ?? "",
    [`${prefix}Phone`]: r[5] ?? "Not reported",
  });
}
for (const name of ["Machinery", "Manpower"]) {
  const r = rows("Resources").find((r) => r[0] === name)!;
  Object.assign(report, { [`planned${name}`]: r[1], [`actual${name}`]: r[2] });
}
report.activities = rows("Activities")
  .filter((r) => r[1])
  .map((r) => ({
    name: String(r[1]),
    planned: r[2] as number | null,
    actual: r[3] as number | null,
    diff: r[2] === null || r[3] === null ? null : +(Number(r[3]) - Number(r[2])).toFixed(2),
  }));
report.scope = rows("Scope_Layers")
  .filter((r) => r[0] === "Scope")
  .map((r) => ({
    label: String(r[2]) + (r[6] ? ` (${r[6]})` : ""),
    value: String(r[3]),
    unit: String(r[4] ?? ""),
  }));
for (let i = 0; i < 4; i++) {
  const asset = rows("Assets").find((r) => r[0] === `photo_${i + 1}`)!;
  report.photos[i]!.caption = String(asset[4] ?? "Not reported");
  report.photos[i]!.sub = "Existing project photograph; captions from Excel";
  report.photos[i]!.dataUrl =
    `data:image/jpeg;base64,${(await readFile(`.data/projects/construction-works-of-mughsayl-road-and-bridge/photo-${i + 1}.jpg`)).toString("base64")}`;
}
const $ = load(await buildExactDashboardHtml(report));
$("title").text("Current Excel workbook — Mughsayl dashboard preview");
$(".kpi").eq(3).find(".ref").text("Paid amount / approved contract: Not reported");
$(".sc-wrap").html(
  '<div style="height:100%;display:grid;place-content:center;text-align:center;color:var(--ink-500)">Monthly schedule is blank in Excel<br><small>Enter monthly planned and actual progress to draw the S-curve</small></div>',
);
$(".map").html(
  '<div style="height:100%;display:grid;place-content:center;text-align:center;color:var(--ink-500)">Project layout requires manual upload<br><small>No route geometry is supplied in this workbook</small></div>',
);
$(".col.c .panel")
  .eq(3)
  .find(".panel-body")
  .html(
    '<span class="muted">Trade statuses are Unknown in Excel.<br>Verify statuses before publishing.</span>',
  );
$(".col.b .panel")
  .eq(1)
  .find(".panel-head .s")
  .text("existing project photos · captions from Excel");
$(".tl .done").remove();
$(".tl .node").eq(2).remove();
$(".foot > div")
  .eq(1)
  .text(
    "Existing Excel example only — missing entries are not estimated. Photos supplied separately.",
  );
await writeFile("deliverables/Mughsayl-Excel-Dashboard-Preview.html", $.html());
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await page.setContent($.html());
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: "deliverables/Mughsayl-Excel-Dashboard-Preview.png" });
} finally {
  await browser.close();
}
console.log("Excel dashboard preview rendered; project data unchanged.");
