import test from "node:test";
import assert from "node:assert/strict";
import { schematicSchema, schematicSvg } from "../src/lib/project-schematic";
import { validateReport } from "../src/lib/report.types";
import { buildExactDashboardHtml } from "../src/lib/dashboard-html.server";
import { fixture } from "./fixture";
import { load } from "cheerio";

test("uploaded layout needs no schematic approval; legacy geometry still validates", () => {
  const { report } = fixture();
  report.schematic.approved = false;
  assert.deepEqual(validateReport(report), []);
  report.schematic.approved = true;
  report.schematic.segments[0]!.points = [
    { x: 10, y: 20 },
    { x: 10, y: 20 },
  ];
  assert.equal(schematicSchema.safeParse(report.schematic).success, false);
  report.schematic.segments[0]!.points = [
    { x: -1, y: 20 },
    { x: 50, y: 20 },
  ];
  assert.equal(schematicSchema.safeParse(report.schematic).success, false);
});

test("schematic labels are escaped and overall progress cannot colour the route", async () => {
  const { report } = fixture();
  report.schematic.segments[0]!.startLabel = '<script>alert("x")</script>';
  const svg = schematicSvg(report.schematic);
  assert.ok(!svg.includes("<script>"));
  assert.ok(svg.includes("&lt;script&gt;"));
  assert.ok(svg.includes('stroke="#8795a3"'));
  const first = await buildExactDashboardHtml(report);
  report.actualProgress = 99;
  const second = await buildExactDashboardHtml(report);
  assert.equal(load(first)(".map img").first().attr("src"), report.layoutImage);
  assert.equal(load(first)(".map svg").length, 0);
  assert.equal(
    load(first)(".map img").first().attr("src"),
    load(second)(".map img").first().attr("src"),
  );
  assert.ok(second.includes('id="layout-dialog"'));
});

test("chart image cannot bypass missing monthly data or skipped months", () => {
  const { report } = fixture();
  report.chartSource = "image";
  report.progressChartImage = "data:image/png;base64,aGVsbG8=";
  report.schedule = [];
  assert.match(validateReport(report).join(" "), /schedule rows/);
  report.schedule = fixture().report.schedule;
  report.schedule[1]!.month = "Sep-26";
  assert.match(validateReport(report).join(" "), /consecutive monthly/);
});
