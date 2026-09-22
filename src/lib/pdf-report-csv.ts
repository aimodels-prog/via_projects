import { parseCsvRows, parseDashboardCsv } from "./dashboard-csv";
import { newManualReport } from "./manual-report";
import { draftReportSchema } from "./report-draft";
import { makeSlug, type ExtractedReport } from "./report.types";
import { reportDate, monthKey } from "./report-dates";

const HEADER = "section,field,value,planned,actual,instructions";
// The template is data entry for a new PDF, not extraction instructions.
const FIELDS = [
  [
    "project",
    "Project URL slug",
    "slug",
    "text",
    "Existing project URL; use the same URL for monthly updates",
  ],
  ["project", "Project number", "projectNumber", "text", "Project or contract reference"],
  ["project", "Project type", "projectType", "text", "Dashboard project classification"],
  ["monthly", "Report number", "reportNumber", "text", "Monthly report number"],
  ["monthly", "Footer code", "footerCode", "text", "Dashboard footer reference"],
  ["project", "Project name", "projectName", "text", "Full project title"],
  ["project", "Region", "region", "text", "Governorate or location"],
  ["project", "Client", "clientName", "text", "Client or ministry name"],
  ["project", "Client department", "clientDepartment", "text", "Department name"],
  [
    "project",
    "Approved contract total",
    "contractValue",
    "text",
    "Number without currency; keep all decimals",
  ],
  ["project", "Currency", "currency", "text", "R.O. or OMR for this PDF design"],
  ["project", "Award date", "awardDate", "date", "YYYY-MM-DD"],
  ["project", "Start date", "startDate", "date", "YYYY-MM-DD"],
  ["project", "Completion date", "completionDate", "date", "YYYY-MM-DD"],
  ["project", "Mobilization days", "mobilizationDays", "number", "Whole days"],
  ["project", "Construction days", "constructionDays", "number", "Whole days"],
  [
    "project",
    "Construction days with VOs",
    "constructionDaysWithVos",
    "text",
    "As agreed including variations; leave blank if unknown",
  ],
  [
    "project",
    "Completion date with VOs",
    "completionDateWithVos",
    "date",
    "YYYY-MM-DD; leave blank if unknown",
  ],
  [
    "project",
    "Brief description",
    "brief",
    "text",
    "Scope and description; Excel will quote commas and line breaks",
  ],
  ["project", "Planned manpower", "plannedManpower", "number", "Number of people"],
  ["project", "Planned machinery", "plannedMachinery", "number", "Number of machines"],
  ["project", "Consultant", "consultantName", "text", "Organisation name"],
  ["project", "Consultant representative", "consultantRepresentative", "text", "Name"],
  ["project", "Consultant role", "consultantRole", "text", "Job title"],
  [
    "project",
    "Consultant phone",
    "consultantPhone",
    "text",
    "Set Excel cell format to Text to preserve leading zeros",
  ],
  ["project", "Contractor", "contractorName", "text", "Organisation name"],
  ["project", "Contractor representative", "contractorRepresentative", "text", "Name"],
  ["project", "Contractor role", "contractorRole", "text", "Job title"],
  [
    "project",
    "Contractor phone",
    "contractorPhone",
    "text",
    "Set Excel cell format to Text to preserve leading zeros",
  ],
  ["project", "Client engineer", "engineerName", "text", "Name"],
  [
    "project",
    "Client engineer phone",
    "engineerPhone",
    "text",
    "Set Excel cell format to Text to preserve leading zeros",
  ],
  [
    "monthly",
    "Data as of",
    "dataAsOf",
    "date",
    "YYYY-MM-DD; report month is calculated from this date",
  ],
  ["monthly", "Revision", "revision", "text", "For example Rev-01"],
  [
    "monthly",
    "Elapsed days",
    "elapsedDays",
    "number",
    "Whole days; remaining days are calculated if left blank",
  ],
  [
    "monthly",
    "Remaining days",
    "remainingDays",
    "number",
    "Optional override of construction days minus elapsed days",
  ],
  [
    "monthly",
    "Expected completion date",
    "expectedCompletionDate",
    "date",
    "YYYY-MM-DD; leave blank if unknown",
  ],
  [
    "monthly",
    "Cumulative planned progress %",
    "plannedProgress",
    "number",
    "Enter 47.95 for 47.95 percent",
  ],
  [
    "monthly",
    "Cumulative actual progress %",
    "actualProgress",
    "number",
    "Enter 40.94 for 40.94 percent",
  ],
  [
    "monthly",
    "This month planned %",
    "monthPlannedProgress",
    "nullable",
    "This month only; no percent sign",
  ],
  [
    "monthly",
    "This month actual %",
    "monthActualProgress",
    "nullable",
    "This month only; no percent sign",
  ],
  [
    "monthly",
    "Planned financial progress %",
    "financialPlannedProgress",
    "nullable",
    "Percentage; preserve source precision",
  ],
  [
    "monthly",
    "Actual financial progress %",
    "financialProgress",
    "number",
    "Percentage; not calculated from paid amount",
  ],
  [
    "monthly",
    "Actually paid amount",
    "paidAmount",
    "nullable",
    "Paid amount in the project currency; not anticipated payment",
  ],
  ["monthly", "Actual manpower", "actualManpower", "number", "Number of people this month"],
  ["monthly", "Actual machinery", "actualMachinery", "number", "Number of machines this month"],
] as const;
export const PDF_CONTRACT_LABELS = [
  "Original contract (No Cont.)",
  "Contingency",
  "Original contract (with Cont.)",
  "Contract (with VO.1)",
  "Contract (with VO.2)",
  "Contract (with VO.3 & Cont.)",
  "Contract (with VO.4 & Cont.)",
];
const csv = (cells: string[]) =>
  cells.map((v) => (/[,"\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)).join(",");
export const PDF_REPORT_CSV_TEMPLATE = [
  HEADER,
  ...FIELDS.map(([section, label, , , help]) => csv([section, label, "", "", "", help])),
  ...PDF_CONTRACT_LABELS.map((label) =>
    csv(["contract", label, "", "", "", "Amount or Nil/NA as appropriate; do not guess"]),
  ),
  ...Array.from({ length: 13 }, () =>
    csv([
      "activity",
      "",
      "",
      "",
      "",
      "Enter activity name in field; percentages in planned and actual; unused rows stay blank",
    ]),
  ),
  ...Array.from({ length: 4 }, (_, i) =>
    csv([
      "photo",
      `photo_${i + 1}`,
      "",
      "",
      "",
      `Caption only. Upload picture ${i + 1} manually in the app; order top-left then top-right then bottom-left then bottom-right`,
    ]),
  ),
  ...Array.from({ length: 36 }, () =>
    csv([
      "schedule",
      "",
      "",
      "",
      "",
      "field=Mon-YY; planned/actual=this month percentages; value blank. Start at programme beginning; cumulative totals calculated. Future actual blank.",
    ]),
  ),
  ...Array.from({ length: 5 }, () =>
    csv([
      "scope",
      "",
      "",
      "",
      "",
      "field=description; value=quantity; planned=unit (km/m/no.); actual blank",
    ]),
  ),
  ...Array.from({ length: 4 }, () =>
    csv([
      "layer",
      "",
      "",
      "",
      "",
      "field=layer code; value=description; planned=thickness in mm; actual blank",
    ]),
  ),
  ...Array.from({ length: 12 }, () =>
    csv([
      "trade",
      "",
      "",
      "",
      "",
      "field=trade name; value=complete/active/behind/notstarted/unknown; planned and actual blank",
    ]),
  ),
].join("\r\n");

export function parsePdfReportCsv(input: string): ExtractedReport {
  const rows = parseCsvRows(input);
  if (rows[0]?.join(",").toLowerCase() !== HEADER)
    throw new Error(`CSV header must be exactly: ${HEADER}`);
  const r = newManualReport();
  r.rawOcrText = input;
  const seen = new Set<string>();
  const contracts = new Map<string, string>();
  const numeric = (raw: string, row: number) => {
    if (!raw) return null;
    if (!/^[+-]?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?$/.test(raw))
      throw new Error(`CSV row ${row}: enter a number without a percent sign or currency.`);
    const n = Number(raw.replace(/,/g, ""));
    if (!Number.isFinite(n)) throw new Error(`CSV row ${row}: number is too large.`);
    return n;
  };
  rows.slice(1).forEach((cells, index) => {
    const row = index + 2;
    if (cells.length !== 6)
      throw new Error(
        `CSV row ${row}: expected six columns. Save as CSV UTF-8; commas inside text must be quoted.`,
      );
    const [section, label, value, planned, actual] = cells as [
      string,
      string,
      string,
      string,
      string,
      string,
    ];
    if (
      ["activity", "schedule", "scope", "layer", "trade", "layout_section"].includes(section) &&
      !label &&
      !value &&
      !planned &&
      !actual
    )
      return;
    if (!["activity", "schedule", "scope", "layer"].includes(section) && (planned || actual))
      throw new Error(`CSV row ${row}: use value; planned and actual are only for activities.`);
    const id = `${section}:${label}`;
    if (seen.has(id)) throw new Error(`CSV row ${row}: duplicate ${label}.`);
    seen.add(id);
    if (section === "project" || section === "monthly") {
      const spec = FIELDS.find((f) => f[0] === section && f[1] === label);
      if (!spec)
        throw new Error(
          `CSV row ${row}: unknown field ${label}. Keep the template field names unchanged.`,
        );
      if (!value) return;
      const [, , key, kind] = spec;
      if (kind === "date" && reportDate(value) == null)
        throw new Error(`CSV row ${row}: use a valid YYYY-MM-DD date.`);
      Object.assign(r, {
        [key]: kind === "number" || kind === "nullable" ? numeric(value, row) : value,
      });
    } else if (section === "contract") {
      if (!PDF_CONTRACT_LABELS.includes(label))
        throw new Error(`CSV row ${row}: unknown contract row.`);
      contracts.set(label, value || "Not provided");
    } else if (section === "activity") {
      if (!label || value)
        throw new Error(
          `CSV row ${row}: activity name goes in field; use planned and actual, not value.`,
        );
      const p = numeric(planned, row),
        a = numeric(actual, row);
      r.activities.push({
        name: label,
        planned: p,
        actual: a,
        diff: p == null || a == null ? null : +(a - p).toFixed(2),
      });
    } else if (section === "schedule") {
      const month = monthKey(label);
      if (!month || value || !planned)
        throw new Error(
          `CSV row ${row}: schedule needs month and monthly planned percentage; value stays blank.`,
        );
      if (r.schedule.some((s) => monthKey(s.month) === month))
        throw new Error(`CSV row ${row}: duplicate schedule month.`);
      r.schedule.push({
        month: label,
        plannedMonthly: numeric(planned, row)!,
        actualMonthly: numeric(actual, row),
        plannedCumulative: 0,
        actualCumulative: null,
      });
    } else if (section === "scope") {
      if (!label || !value || actual)
        throw new Error(
          `CSV row ${row}: scope needs description and quantity; unit goes in planned; actual stays blank.`,
        );
      r.scope.push({ label, value, unit: planned });
    } else if (section === "layer") {
      if (!label || !value || !planned || actual)
        throw new Error(
          `CSV row ${row}: layer needs code, description and thickness in planned; actual stays blank.`,
        );
      r.layers.push({ code: label, name: value, thickness: numeric(planned, row)! });
    } else if (section === "trade") {
      if (!label || !["complete", "active", "behind", "notstarted", "unknown"].includes(value))
        throw new Error(
          `CSV row ${row}: enter trade name and status complete/active/behind/notstarted/unknown.`,
        );
      r.trades.push({ name: label, status: value as ExtractedReport["trades"][number]["status"] });
    } else if (section === "layout") {
      if (label !== "template") throw new Error(`CSV row ${row}: layout field must be template.`);
      if (value && value !== "raysut-reference" && !/^[a-f0-9-]{36}$/.test(value))
        throw new Error("Invalid saved layout ID.");
      r.layoutTemplateId = value || undefined;
      r.useRaysutReferenceLayout = value === "raysut-reference";
      if (value) r.printLayoutMode = "schematic";
    } else if (section === "layout_section") {
      if (!label || !["complete", "construction", "existing", "unknown"].includes(value))
        throw new Error(
          `CSV row ${row}: layout section needs ID and status complete/construction/existing/unknown.`,
        );
      (r.layoutUpdates ??= []).push({
        id: label,
        status: value as "complete" | "construction" | "existing" | "unknown",
      });
    } else if (section === "photo") {
      if (!/^photo_[1-4]$/.test(label)) throw new Error(`CSV row ${row}: use photo_1 to photo_4.`);
      r.photos[Number(label.slice(-1)) - 1]!.caption = value;
    } else throw new Error(`CSV row ${row}: unknown section ${section}.`);
  });
  if (r.activities.length > 13)
    throw new Error("This PDF has room for 13 activities. Remove unused rows.");
  r.schedule.sort((a, b) => monthKey(a.month)!.localeCompare(monthKey(b.month)!));
  let cumulativePlan = 0,
    cumulativeActual = 0,
    missingActual = false;
  for (let i = 0; i < r.schedule.length; i++) {
    const item = r.schedule[i]!;
    if (i > 0) {
      const previous = monthKey(r.schedule[i - 1]!.month)!;
      const next = new Date(`${previous}-01T00:00:00Z`);
      next.setUTCMonth(next.getUTCMonth() + 1);
      if (next.toISOString().slice(0, 7) !== monthKey(item.month))
        throw new Error(
          "Schedule contains a missing month; enter every month from the programme beginning.",
        );
    }
    cumulativePlan = +(cumulativePlan + item.plannedMonthly).toFixed(4);
    item.plannedCumulative = cumulativePlan;
    if (item.actualMonthly == null) missingActual = true;
    else {
      if (missingActual)
        throw new Error(
          "Schedule actuals contain a gap. Enter earlier actuals before later months.",
        );
      cumulativeActual = +(cumulativeActual + item.actualMonthly).toFixed(4);
      item.actualCumulative = cumulativeActual;
    }
  }
  r.contractRows = PDF_CONTRACT_LABELS.map((label) => ({
    label,
    value: contracts.get(label) || "Not provided",
    unit: r.currency,
  }));
  if (r.schedule.length >= 2) {
    r.printChartMode = "generated";
    r.chartSource = "table";
    r.printChartImage = "";
  }
  if (
    !seen.has("project:Project URL slug") ||
    !rows.some((row) => row[1] === "Project URL slug" && row[2])
  )
    r.slug = makeSlug(r.projectName) || "new-project";
  if (r.layoutUpdates?.length && (!r.layoutTemplateId || r.layoutTemplateId === "raysut-reference"))
    throw new Error(
      "Section updates require a saved project layout, not the fixed Raysut illustration.",
    );
  const date = reportDate(r.dataAsOf);
  if (date != null)
    r.reportMonth = new Date(date).toLocaleDateString("en-GB", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    });
  r.variance = +(r.actualProgress - r.plannedProgress).toFixed(2);
  if (!Number.isFinite(r.remainingDays)) r.remainingDays = r.constructionDays - r.elapsedDays;
  if (r.financialPlannedProgress != null && Number.isFinite(r.financialProgress))
    r.financialDifference = +(r.financialProgress - r.financialPlannedProgress).toFixed(3);
  return draftReportSchema.parse(r);
}

/** Keep older imports readable, but new downloads use the human-entry PDF format. */
export function parseReportCsv(input: string) {
  return parseCsvRows(input)[0]?.[0]?.toLowerCase() === "section"
    ? parsePdfReportCsv(input)
    : parseDashboardCsv(input);
}
