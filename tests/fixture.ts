import { parseDashboardCsv, DASHBOARD_CSV_TEMPLATE } from "../src/lib/dashboard-csv";
import { reportSchema } from "../src/lib/report.types";
export function fixture() {
  const values: Record<string, string> = {
    project_name: "Test bridge project",
    region: "Dhofar",
    report_month: "July 2026",
    data_as_of: "31st July 2026",
    contract_value: "100000",
    award_date: "01-01-2025",
    start_date: "02-03-2025",
    completion_date: "30-08-2027",
    expected_completion_date: "30-08-2027",
    mobilization_days: "60",
    construction_days: "30",
    elapsed_days: "15",
    remaining_days: "15",
    planned_progress: "20",
    actual_progress: "18",
    month_planned_progress: "10",
    month_actual_progress: "9",
    financial_progress: "15",
    paid_amount: "15000",
    planned_machinery: "40",
    actual_machinery: "35",
    planned_manpower: "70",
    actual_manpower: "65",
    brief: "Bridge and approach road works",
  };
  const row = (cells: string[]) =>
    [...cells, ...Array(Math.max(0, 11 - cells.length)).fill("")].join(",");
  const csv = [
    DASHBOARD_CSV_TEMPLATE.split("\n")[0]!,
    ...Object.entries({
      ...values,
      currency: "R.O.",
      client_name: "Test client",
      revision: "Rev-01",
    }).map(([key, value]) => row(["field", key, value])),
    row(["activity", "Activity name", "", "", "0", "0"]),
    row(["schedule", "Jun-26", "", "", "10", "9", "10", "9"]),
    row(["schedule", "Jul-26", "", "", "10", "9", "20", "18"]),
    ...Array.from({ length: 5 }, (_, i) => row(["scope", `Scope item ${i + 1}`, "Value", "Unit"])),
    row(["layer", "LAYER-CODE", "Layer name", "", "", "", "", "", "", "", "1"]),
    row(["trade", "Trade name", "", "", "", "", "", "", "active"]),
    ...Array.from({ length: 4 }, (_, i) =>
      row(["photo", `photo_${i + 1}`, "Caption", "", "", "", "", "", "", "Secondary description"]),
    ),
  ].join("\n");
  const report = reportSchema.parse(parseDashboardCsv(csv));
  report.schematic = {
    approved: true,
    segments: [
      {
        name: "Verified test section",
        startLabel: "Start",
        endLabel: "End",
        chainage: "0–100",
        status: "unknown",
        points: [
          { x: 10, y: 60 },
          { x: 90, y: 60 },
        ],
      },
    ],
    landmarks: [],
  };
  report.logoImageSource = "original";
  report.logoImageWidth = 200;
  report.logoImageHeight = 200;
  report.layoutImage = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=";
  report.layoutImageSource = "original";
  report.layoutImageWidth = 1200;
  report.layoutImageHeight = 800;
  report.photos = report.photos.map((p) => ({
    ...p,
    source: "original",
    width: 1200,
    height: 800,
  }));
  return { report, csv };
}
