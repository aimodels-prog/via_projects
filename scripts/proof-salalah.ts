// Visual proof using the source report's chart picture, not inferred schedule data.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { buildSalalahPdf } from "../src/lib/salalah-pdf.server";
import { PDFDocument } from "pdf-lib";
import { fixture } from "../tests/fixture";
const r = fixture().report;
Object.assign(r, {
  projectName:
    "CONSTRUCTION OF DUALIZATION FOR RAYSUT - AL MUGHSAYL ASPHALT ROAD, GOVERNORATE OF DHOFAR",
  printTitle:
    "CONSTRUCTION OF DUALIZATION FOR\nRAYSUT - AL MUGHSAYL\nASPHALT ROAD, GOVERNORATE OF\nDHOFAR",
  clientName: "MINISTRY OF TRANSPORT & COMMUNICATIONS",
  clientDepartment: "DIRECTORATE GENERAL OF ROADS & LAND TRANSPORT",
  reportMonth: "July 2026",
  dataAsOf: "31-07-2026",
  revision: "Rev-01",
  contractValue: "34,844,451.558",
  awardDate: "01-01-2025",
  startDate: "02-03-2025",
  completionDate: "30-08-2027",
  expectedCompletionDate: "30-08-2027",
  mobilizationDays: 60,
  constructionDays: 912,
  elapsedDays: 517,
  remainingDays: 395,
  constructionDaysWithVos: "912 Days",
  completionDateWithVos: "30-08-2027",
  plannedProgress: 47.95,
  actualProgress: 40.94,
  variance: -7.01,
  monthPlannedProgress: 3.72,
  monthActualProgress: 1.69,
  financialPlannedProgress: 46.539,
  financialProgress: 33.38,
  financialDifference: -13.159,
  paidAmount: 10969331.064,
  plannedMachinery: 126,
  actualMachinery: 110,
  plannedManpower: 310,
  actualManpower: 290,
  brief:
    "asphalt road length 28.090 km and Salalah By-pass 5.521km\nUnder-pass-08 No\nFlyover - 01 No\nBox culverts – 82 No\nGSB Layer -200mm\nABC Layer -300mm\nBBC Layer -60mm\nBWC Layer – 50mm\nProtection works\nFixing of Road Signs\nLining Ditch\nCurb stone & Road Marking",
  consultantName: "VIA International- Engineering Consultancy",
  consultantRepresentative: "Habib Noor",
  consultantRole: "Resident Engineer",
  consultantPhone: "98165272",
  contractorName: "Oman Building & Contracting Co LLC.",
  contractorRepresentative: "Eng. Awadh Masan",
  contractorRole: "Vice Chairman",
  contractorPhone: "97778855",
  engineerName: "Eng. Abdullah Salim Al Ibrahim",
  engineerPhone: "92766650",
  schedule: [],
});
r.contractRows = [
  "Original contract (No Cont.)",
  "Contingency",
  "Original contract (with Cont.)",
  "Contract (with VO.1)",
  "Contract (with VO.2)",
  "Contract (with VO.3 & Cont.)",
  "Contract (with VO.4 & Cont.)",
].map((label, i) => ({
  label,
  value: i === 0 || i === 2 ? "34,844,451.558" : i === 1 ? "Nil" : "NA",
  unit: "R.O.",
}));
r.activities = (
  [
    ["Mobilization", 60, 60],
    ["Unclassified Excavation", 62.72, 71.79],
    ["Borrow Excavation", null, null],
    ["Unclassified Str. Excavation", 98.97, 103.4],
    ["GSB (Class-B)", 43, 30],
    ["ABC (Class-B)", 45.21, 24.92],
    ["Bit. Base Course (Class-B)", 43.94, 19.72],
    ["Bit. Wearing (Class-B)", 38.1, null],
    ["Concrete C-15", 78.38, 78.68],
    ["Concrete C-35", 63.67, 54.82],
    ["Concrete C-40", null, null],
    ["Concrete C-45", 0, 21.14],
    ["Steel any dia", 65.59, 52.2],
  ] as const
).map(([name, planned, actual]) => ({
  name,
  planned,
  actual,
  diff: planned == null || actual == null ? null : Number((actual - planned).toFixed(2)),
}));
const image = async (name: string) =>
  "data:image/png;base64," +
  (await readFile(`${process.argv[2] || ".data/salalah-proof-assets"}/${name}.png`)).toString(
    "base64",
  );
r.printClientLogo = await image("clientLogo");
r.printChartMode = "image";
r.printChartImage = await image("chart");
r.schedule = [];
r.layoutImage = await image("map");
r.activityStatusImage = await image("status");
const captions = [
  "Piers wall InProgress",
  "Bitumen Base Course layer",
  "UP-at km-10+143 RHS",
  "Retaining wall in progress",
];
for (let i = 0; i < 4; i++) {
  r.photos[i]!.dataUrl = await image(`photo${i + 1}`);
  r.photos[i]!.caption = captions[i]!;
}
await mkdir("deliverables", { recursive: true });
const proof = await PDFDocument.load(await buildSalalahPdf(r));
proof.setSubject(
  "Design proof using the original July chart image. Requires review before approval.",
);
await writeFile(
  process.argv[3] || "deliverables/salalah-design-proof-SOURCE-CHART.pdf",
  await proof.save(),
);
console.log("Saved design proof with original source chart image; no invented schedule values.");
