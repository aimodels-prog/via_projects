import { mkdir, readFile, writeFile } from "node:fs/promises";
import { load } from "cheerio";
import { chromium } from "@playwright/test";
import { fixture } from "../tests/fixture";
import { buildExactDashboardHtml } from "../src/lib/dashboard-html.server";
import { reportSchema } from "../src/lib/report.types";

// Standalone visual demonstration. Never reads or writes a project's saved report.
const { report } = fixture();
Object.assign(report, {
  projectName: "Construction Works of Mughsayl Road and Bridge",
  projectNumber: "DEMO ONLY / 2026 / 01",
  projectType: "Illustrative data — not an approved report",
  region: "Governorate of Dhofar, Sultanate of Oman",
  reportMonth: "July 2026",
  reportNumber: "17",
  dataAsOf: "31 July 2026",
  contractValue: "34844451.558",
  constructionDays: 912,
  elapsedDays: 517,
  remainingDays: 395,
  plannedProgress: 47.95,
  actualProgress: 40.94,
  variance: -7.01,
  monthPlannedProgress: 3.72,
  monthActualProgress: 1.69,
  financialProgress: 33.38,
  paidAmount: 10969331.064,
  plannedMachinery: 126,
  actualMachinery: 110,
  plannedManpower: 310,
  actualManpower: 290,
  clientName: "Example Transport Authority",
  clientDepartment: "Roads & Land Transport",
  contractorName: "Example Road & Bridge Contractor",
  contractorRepresentative: "Demo Project Manager",
  contractorRole: "Project Manager",
  contractorPhone: "Demo contact",
  consultantName: "VIA International — Engineering Consultancy",
  consultantRepresentative: "Demo Resident Engineer",
  consultantRole: "Resident Engineer",
  consultantPhone: "Demo contact",
  engineerName: "Demo Client Representative",
  engineerPhone: "Demo contact",
  footerCode: "DUMMY DATA — NOT FOR REPORTING",
  useRaysutReferenceLayout: true,
  scope: [
    { label: "Asphalt road length", value: "28.090", unit: "km" },
    { label: "Salalah By-pass", value: "5.521", unit: "km" },
    { label: "Under-passes", value: "8", unit: "no." },
    { label: "Flyover", value: "1", unit: "no." },
    { label: "Box culverts", value: "82", unit: "no." },
  ],
  layers: [
    { code: "BWC", name: "Bituminous Wearing Course", thickness: 50 },
    { code: "BBC", name: "Bituminous Base Course", thickness: 60 },
    { code: "ABC", name: "Aggregate Base Course", thickness: 300 },
    { code: "GSB", name: "Granular Sub-Base", thickness: 200 },
  ],
});
const names = [
  "Mobilization",
  "Unclassified Excavation",
  "Unclassified Str. Excavation",
  "GSB (Class-B)",
  "ABC (Class-B)",
  "Bit. Base Course (Class-B)",
  "Bit. Wearing (Class-B)",
  "Concrete C-15",
  "Concrete C-35",
  "Steel (any dia.)",
];
const plans = [60, 62.72, 98.97, 43, 45.21, 43.94, 38.1, 78.38, 63.67, 65.59];
const actuals = [60, 71.79, 103.4, 30, 24.92, 19.72, 0, 78.68, 54.82, 52.2];
report.activities = names.map((name, i) => ({
  name,
  planned: plans[i]!,
  actual: actuals[i]!,
  diff: +(actuals[i]! - plans[i]!).toFixed(2),
}));
const monthly = [
  0.5, 0.6, 0.8, 1.1, 1.5, 1.8, 2.1, 2.5, 2.8, 3.1, 3.4, 3.6, 3.8, 3.9, 4, 4.2, 4.53, 3.72, 4, 4.2,
  4.4, 4.6, 4.8, 4.5, 4.2, 3.8, 3.5, 3, 2.5, 2, 6.55,
];
const achieved = [
  0.5, 0.6, 0.8, 1.1, 1.5, 1.8, 2.1, 2.5, 2.8, 3.1, 3.4, 3.6, 3.5, 3.2, 3, 2.5, 3.25, 1.69,
];
let plannedTotal = 0,
  actualTotal = 0;
report.schedule = monthly.map((value, i) => {
  plannedTotal += value;
  actualTotal += achieved[i] ?? 0;
  const date = new Date(Date.UTC(2025, 1 + i, 1));
  return {
    month: `${date.toLocaleString("en-US", { month: "short", timeZone: "UTC" })}-${String(date.getUTCFullYear()).slice(-2)}`,
    plannedMonthly: value,
    actualMonthly: achieved[i] ?? null,
    plannedCumulative: +plannedTotal.toFixed(2),
    actualCumulative: i < achieved.length ? +actualTotal.toFixed(2) : null,
  };
});
report.trades = [
  "Protection — cut slope",
  "Utilities",
  "Land acquisition",
  "Culverts / retaining walls",
  "Bridges / tunnels",
  "Pedestrian over/underpass",
  "Earthworks",
  "Subbase layer",
  "Aggregate base course",
  "Bit. base course",
  "Bit. wearing course",
  "Protection — embankment",
].map((name, i) => ({
  name,
  status: (
    [
      "active",
      "active",
      "complete",
      "complete",
      "active",
      "active",
      "complete",
      "behind",
      "behind",
      "behind",
      "notstarted",
      "active",
    ] as const
  )[i]!,
}));
report.logoImage = `data:image/png;base64,${(await readFile("Dashboard/via/logo-color.png")).toString("base64")}`;
const captions = [
  "Pier foundation backfill",
  "Bitumen base course layer",
  "Utilities future ducts",
  "I-girder work in progress",
];
for (let i = 0; i < 4; i++) {
  report.photos[i]!.caption = captions[i]!;
  report.photos[i]!.sub = "Reference photograph — demonstration only";
  report.photos[i]!.dataUrl =
    `data:image/jpeg;base64,${(await readFile(`Dashboard/Photo${i + 1}.jpg`)).toString("base64")}`;
}
const $ = load(await buildExactDashboardHtml(reportSchema.parse(report)));
$("title").text("DUMMY PREVIEW — Mughsayl dashboard");
$("head").append('<meta name="robots" content="noindex,nofollow">');
$(".col.b .panel").first().find(".panel-head .s").text("Raysut reference illustration — demo only");
$(".col.b .panel").eq(1).find(".panel-head .s").text("Reference photos — demo only");
$(".foot > div")
  .eq(1)
  .text("DUMMY PREVIEW — figures, contacts and route are illustrative, not an approved report");
await mkdir("public/demos", { recursive: true });
await writeFile("public/demos/mughsayl.html", $.html());
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await page.setContent($.html());
  await page.evaluate(() => document.fonts.ready);
  await page.getByRole("button", { name: "Mo.", exact: true }).click();
  if (!(await page.locator("#sc-mon").isVisible())) throw new Error("Monthly chart failed");
  await page.getByRole("button", { name: "Cum.", exact: true }).click();
  await page.screenshot({ path: "public/demos/mughsayl.png" });
} finally {
  await browser.close();
}
console.log("Demo: http://localhost:8080/demos/mughsayl.html (real project unchanged)");
