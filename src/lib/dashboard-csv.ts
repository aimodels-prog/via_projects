import type { ExtractedReport } from "@/lib/report.types";
import { makeSlug, reportSchema } from "@/lib/report.types";

const HEADER = [
  "record_type",
  "key",
  "value",
  "unit",
  "planned",
  "actual",
  "planned_cumulative",
  "actual_cumulative",
  "status",
  "description",
  "thickness",
] as const;

const SUMMARY_FIELD_KEYS = [
  "project_name",
  "region",
  "report_month",
  "client_name",
  "client_department",
  "contract_value",
  "currency",
  "award_date",
  "mobilization_days",
  "construction_days",
  "start_date",
  "completion_date",
  "construction_days_with_vos",
  "completion_date_with_vos",
  "elapsed_days",
  "remaining_days",
  "expected_completion_date",
  "brief",
  "planned_progress",
  "actual_progress",
  "financial_planned_progress",
  "financial_progress",
  "financial_difference",
  "anticipated_payment",
  "planned_machinery",
  "actual_machinery",
  "planned_manpower",
  "actual_manpower",
] as const;

// Accept existing CSVs without making their optional sample-specific fields mandatory.
const RAYSUT_EXTRA_KEYS = [
  "project_number",
  "project_type",
  "report_number",
  "data_as_of",
  "footer_code",
  "revision",
  "month_planned_progress",
  "month_actual_progress",
  "paid_amount",
  "contractor_name",
  "contractor_representative",
  "contractor_role",
  "contractor_phone",
  "consultant_name",
  "consultant_representative",
  "consultant_role",
  "consultant_phone",
  "engineer_name",
  "engineer_phone",
] as const;
const FIELD_KEYS = [
  "project_name",
  "project_number",
  "project_type",
  "region",
  "report_month",
  "report_number",
  "data_as_of",
  "footer_code",
  "revision",
  "contract_value",
  "currency",
  "award_date",
  "start_date",
  "completion_date",
  "expected_completion_date",
  "mobilization_days",
  "construction_days",
  "elapsed_days",
  "remaining_days",
  "planned_progress",
  "actual_progress",
  "month_planned_progress",
  "month_actual_progress",
  "financial_progress",
  "paid_amount",
  "planned_machinery",
  "actual_machinery",
  "planned_manpower",
  "actual_manpower",
  "brief",
  "client_name",
  "client_department",
  "contractor_name",
  "contractor_representative",
  "contractor_role",
  "contractor_phone",
  "consultant_name",
  "consultant_representative",
  "consultant_role",
  "consultant_phone",
  "engineer_name",
  "engineer_phone",
] as const;
type FieldKey = (typeof SUMMARY_FIELD_KEYS)[number] | (typeof RAYSUT_EXTRA_KEYS)[number];
const ALL_FIELD_KEYS: readonly string[] = [...SUMMARY_FIELD_KEYS, ...RAYSUT_EXTRA_KEYS];
const REQUIRED_FIELD_KEYS = [
  "project_name",
  "region",
  "report_month",
  "contract_value",
  "currency",
  "award_date",
  "start_date",
  "completion_date",
  "mobilization_days",
  "construction_days",
  "elapsed_days",
  "remaining_days",
  "planned_progress",
  "actual_progress",
  "financial_progress",
  "planned_machinery",
  "actual_machinery",
  "planned_manpower",
  "actual_manpower",
  "brief",
  "client_name",
] as const;

function templateRow(values: string[]) {
  return [...values, ...Array(Math.max(0, HEADER.length - values.length)).fill("")]
    .slice(0, HEADER.length)
    .join(",");
}
export const DASHBOARD_CSV_TEMPLATE = [
  HEADER.join(","),
  ...FIELD_KEYS.map((key) => templateRow(["field", key])),
  templateRow(["activity", "Activity name"]),
  ...Array.from({ length: 4 }, (_, i) => templateRow(["photo", `photo_${i + 1}`, "Caption"])),
].join("\n");

export const NOTEBOOKLM_PROMPT =
  "Extract this PDF into CSV only; no markdown. Never guess or copy sample project data.\nrecord_type,key,value,unit,planned,actual,planned_cumulative,actual_cumulative,status,description,thickness\nEvery row: 11 cells. Quote commas/newlines/quotes correctly. Numbers without %/currency/thousands separators; 95%=95. Preserve decimals/phone zeroes. Missing numbers blank, text Not provided. Dates DD-MM-YYYY; month Month YYYY.\nfield rows: key from list,value from PDF:\nproject_name,project_number,project_type,region,report_month,report_number,data_as_of,footer_code,revision,contract_value,currency,award_date,start_date,completion_date,expected_completion_date,mobilization_days,construction_days,elapsed_days,remaining_days,planned_progress,actual_progress,month_planned_progress,month_actual_progress,financial_progress,paid_amount,planned_machinery,actual_machinery,planned_manpower,actual_manpower,brief,client_name,client_department,contractor_name,contractor_representative,contractor_role,contractor_phone,consultant_name,consultant_representative,consultant_role,consultant_phone,engineer_name,engineer_phone\nProgress=cumulative physical%; month_=monthly%; financial_progress=actual financial%. paid_amount=paid, NOT anticipated. brief=full narrative. Assign parties only if explicit.\nactivity: key=name,planned/actual=percent; all rows.\nschedule: key=Mon-YY; planned/actual=monthly; *_cumulative=cumulative. Readable numeric table only; never estimate graphs. Future actuals blank. Omit if planned values unreadable.\nscope: key=label,value=quantity,unit=unit; max5, only reported.\nlayer: key=code,value=name,thickness=mm; only reported.\ntrade: key=name,status=complete/active/behind/notstarted/unknown; explicit status only.\nphoto: four rows,key=photo_1..photo_4,value=caption,description=printed subtitle; order top-left,top-right,bottom-left,bottom-right.\nUnused cells empty. Check against PDF. Missing schedule blocks publication.";

const PLACEHOLDER_IMAGE =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='1200' height='800' viewBox='0 0 1200 800'%3E%3Crect width='1200' height='800' fill='%23eef1f4'/%3E%3Ctext x='600' y='400' text-anchor='middle' font-family='Arial' font-size='36' fill='%236b7280'%3EUpload original image%3C/text%3E%3C/svg%3E";

export function parseCsvRows(input: string) {
  const text = input
    .trim()
    .replace(/^```(?:csv)?\s*/i, "")
    .replace(/\s*```$/, "")
    .replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let value = "";
  let quoted = false;
  let closedQuote = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index]!;
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        value += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
        closedQuote = true;
      } else {
        value += character;
      }
    } else if (character === '"') {
      if (value.trim() || closedQuote)
        throw new Error(
          "CSV has a misplaced quote. Quote the entire cell and escape embedded quotes as double quotes.",
        );
      quoted = true;
    } else if (character === ",") {
      row.push(value.trim());
      value = "";
      closedQuote = false;
    } else if (character === "\n") {
      row.push(value.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      value = "";
      closedQuote = false;
    } else if (character !== "\r") {
      if (closedQuote && character.trim())
        throw new Error("Unexpected text after a quoted CSV cell.");
      value += character;
    }
  }
  if (quoted) throw new Error("CSV contains an unclosed quoted value.");
  row.push(value.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

function requiredNumber(fields: Map<string, string>, key: FieldKey, integer = false) {
  const raw = fields.get(key)?.replace(/[%\s]/g, "").replace(/,/g, "");
  if (!raw || !Number.isFinite(Number(raw)))
    throw new Error(
      `${key} must be a number. Review this required value against the PDF and correct the CSV; do not replace missing information with zero.`,
    );
  const value = Number(raw);
  if (integer && !Number.isInteger(value)) throw new Error(`${key} must be a whole number.`);
  return value;
}

function cellNumber(raw: string, label: string, nullable = false) {
  if (nullable && (!raw.trim() || /^(not provided|n\/?a|[-—])$/i.test(raw.trim()))) return null;
  const normalized = raw.replace(/[%\s,]/g, "");
  if (!normalized || !Number.isFinite(Number(normalized))) {
    throw new Error(`${label} must be a number${nullable ? " or empty" : ""}.`);
  }
  return Number(normalized);
}

export function parseDashboardCsv(input: string): ExtractedReport {
  const rows = parseCsvRows(input);
  if (!rows.length || rows[0]!.join("|").toLowerCase() !== HEADER.join("|")) {
    throw new Error(`The CSV header must be exactly: ${HEADER.join(",")}`);
  }
  const fields = new Map<string, string>();
  const photos = new Map<string, { caption: string; sub: string }>();
  const activities: ExtractedReport["activities"] = [];
  const schedule: ExtractedReport["schedule"] = [];
  const scope: ExtractedReport["scope"] = [];
  const layers: ExtractedReport["layers"] = [];
  const trades: ExtractedReport["trades"] = [];
  const details: ExtractedReport["details"] = [];
  const contractRows: ExtractedReport["contractRows"] = [];
  const contacts: ExtractedReport["contacts"] = [];

  for (let index = 1; index < rows.length; index += 1) {
    const cells = [...rows[index]!];
    while (cells.length < HEADER.length) cells.push("");
    if (cells.length !== HEADER.length) throw new Error(`CSV row ${index + 1} has extra columns.`);
    const [
      recordType,
      key,
      value,
      unit,
      planned,
      actual,
      plannedCumulative,
      actualCumulative,
      status,
      description,
      thickness,
    ] = cells as [
      string,
      string,
      string,
      string,
      string,
      string,
      string,
      string,
      string,
      string,
      string,
    ];

    const used: Record<string, number[]> = {
      contract: [0, 1, 2, 3],
      contact: [0, 1, 2, 3, 9],
      detail: [0, 1, 2, 3],
      field: [0, 1, 2],
      activity: [0, 1, 4, 5],
      schedule: [0, 1, 4, 5, 6, 7],
      scope: [0, 1, 2, 3],
      layer: [0, 1, 2, 10],
      trade: [0, 1, 8],
      photo: [0, 1, 2, 9],
    };
    if (used[recordType])
      for (let column = 0; column < cells.length; column++)
        if (cells[column] && !used[recordType]!.includes(column))
          throw new Error(
            `CSV row ${index + 1}: unexpected value in ${HEADER[column]}. Check column alignment.`,
          );

    if (recordType === "contract") {
      if (!key || !value)
        throw new Error(
          `Contract row ${index + 1} needs its printed label and value (or Not provided).`,
        );
      contractRows.push({ label: key, value, unit });
    } else if (recordType === "contact") {
      if (!key) throw new Error(`Contact row ${index + 1} needs a name.`);
      contacts.push({ name: key, phone: value, role: unit, organisation: description });
    } else if (recordType === "detail") {
      if (!key || !value) throw new Error(`Detail row ${index + 1} needs a label and value.`);
      details.push({ label: key, value, unit });
    } else if (recordType === "field") {
      if (!ALL_FIELD_KEYS.includes(key)) throw new Error(`Unknown field key: ${key}`);
      if (fields.has(key)) throw new Error(`Duplicate field row: ${key}`);
      fields.set(key, value);
    } else if (recordType === "activity") {
      if (!key) throw new Error(`Activity row ${index + 1} needs a name.`);
      const plan = cellNumber(planned, `${key} planned`, true);
      const achieved = cellNumber(actual, `${key} actual`, true);
      activities.push({
        name: key,
        planned: plan,
        actual: achieved,
        diff: plan === null || achieved === null ? null : Number((achieved - plan).toFixed(2)),
      });
    } else if (recordType === "schedule") {
      if (!key) throw new Error(`Schedule row ${index + 1} needs a month.`);
      schedule.push({
        month: key,
        plannedMonthly: cellNumber(planned, `${key} planned monthly`)!,
        actualMonthly: cellNumber(actual, `${key} actual monthly`, true),
        plannedCumulative: cellNumber(plannedCumulative, `${key} planned cumulative`)!,
        actualCumulative: cellNumber(actualCumulative, `${key} actual cumulative`, true),
      });
    } else if (recordType === "scope") {
      if (!key) throw new Error(`Scope row ${index + 1} needs a description in the key column.`);
      if (!value || /^(not provided|n\/?a|[-–—])$/i.test(value)) {
        details.push({
          label: `Review required: scope quantity — ${key}`,
          value: `CSV row ${index + 1}: quantity ${value ? `reported as "${value}"` : "not provided"}. Check the source before adding this item to scope.`,
          unit,
        });
        continue;
      }
      scope.push({ label: key, value, unit });
    } else if (recordType === "layer") {
      if (!key || !value) throw new Error(`Layer row ${index + 1} is incomplete.`);
      layers.push({
        code: key,
        name: value,
        thickness: cellNumber(thickness, `${key} thickness`)!,
      });
    } else if (recordType === "trade") {
      if (!key) throw new Error(`Trade row ${index + 1} needs a name.`);
      if (!["complete", "active", "behind", "notstarted", "unknown"].includes(status)) {
        throw new Error(`${key}: invalid trade status ${status}.`);
      }
      trades.push({ name: key, status: status as ExtractedReport["trades"][number]["status"] });
    } else if (recordType === "photo") {
      if (!/^photo_[1-4]$/.test(key)) throw new Error(`Invalid photo key: ${key}`);
      if (photos.has(key)) throw new Error(`Duplicate photo row: ${key}`);
      if (!value) throw new Error(`${key} needs a caption.`);
      photos.set(key, { caption: value, sub: description });
    } else {
      throw new Error(`Unknown record_type on row ${index + 1}: ${recordType}`);
    }
  }

  for (const key of REQUIRED_FIELD_KEYS) {
    if (!fields.get(key)?.trim())
      throw new Error(
        `Required field is missing: ${key}. Check the PDF and correct the CSV before importing.`,
      );
  }
  if (!activities.length) throw new Error("At least one activity row is required.");
  if (scope.length > 5) throw new Error("The approved dashboard supports up to five scope rows.");
  for (let index = 1; index <= 4; index += 1) {
    if (!photos.has(`photo_${index}`)) throw new Error(`A row is required for photo_${index}.`);
  }

  const field = (key: FieldKey) => (fields.get(key) ?? "").trim() || "Not provided";
  const plannedProgress = requiredNumber(fields, "planned_progress");
  const actualProgress = requiredNumber(fields, "actual_progress");
  return reportSchema.parse({
    sourceFormat:
      fields.has("anticipated_payment") ||
      fields.has("financial_planned_progress") ||
      contacts.length ||
      contractRows.length
        ? "summary-pdf"
        : "legacy",
    contractRows,
    contacts,
    financialPlannedProgress: cellNumber(
      field("financial_planned_progress"),
      "Financial planned progress",
      true,
    ),
    financialDifference: cellNumber(
      field("financial_difference"),
      "Printed financial difference",
      true,
    ),
    anticipatedPayment: cellNumber(field("anticipated_payment"), "Total payment anticipated", true),
    constructionDaysWithVos: field("construction_days_with_vos"),
    completionDateWithVos: field("completion_date_with_vos"),
    details,
    chartSource: "table",
    projectName: field("project_name"),
    projectNumber: field("project_number"),
    projectType: field("project_type"),
    slug: makeSlug(field("project_name")),
    region: field("region"),
    reportMonth: field("report_month"),
    reportNumber: field("report_number"),
    dataAsOf: field("data_as_of"),
    footerCode: field("footer_code"),
    revision: field("revision"),
    contractValue: field("contract_value"),
    currency: field("currency"),
    awardDate: field("award_date"),
    startDate: field("start_date"),
    completionDate: field("completion_date"),
    expectedCompletionDate: field("expected_completion_date"),
    mobilizationDays: requiredNumber(fields, "mobilization_days", true),
    constructionDays: requiredNumber(fields, "construction_days", true),
    elapsedDays: requiredNumber(fields, "elapsed_days", true),
    remainingDays: requiredNumber(fields, "remaining_days", true),
    plannedProgress,
    actualProgress,
    variance: Number((actualProgress - plannedProgress).toFixed(2)),
    monthPlannedProgress: cellNumber(
      field("month_planned_progress"),
      "Monthly planned progress",
      true,
    ),
    monthActualProgress: cellNumber(
      field("month_actual_progress"),
      "Monthly actual progress",
      true,
    ),
    financialProgress: requiredNumber(fields, "financial_progress"),
    paidAmount: cellNumber(field("paid_amount"), "Paid amount", true),
    plannedMachinery: requiredNumber(fields, "planned_machinery", true),
    actualMachinery: requiredNumber(fields, "actual_machinery", true),
    plannedManpower: requiredNumber(fields, "planned_manpower", true),
    actualManpower: requiredNumber(fields, "actual_manpower", true),
    brief: field("brief"),
    activitiesText: activities.map((item) => item.name).join("\n"),
    activities,
    schedule,
    clientName: field("client_name"),
    clientDepartment: field("client_department"),
    contractorName: field("contractor_name"),
    contractorRepresentative: field("contractor_representative"),
    contractorRole: field("contractor_role"),
    contractorPhone: field("contractor_phone"),
    consultantName: field("consultant_name"),
    consultantRepresentative: field("consultant_representative"),
    consultantRole: field("consultant_role"),
    consultantPhone: field("consultant_phone"),
    engineerName: field("engineer_name"),
    engineerPhone: field("engineer_phone"),
    scope,
    layers,
    trades,
    rawOcrText: input,
    logoImage: PLACEHOLDER_IMAGE,
    logoImageSource: "pdf",
    logoImageWidth: 0,
    logoImageHeight: 0,
    layoutImage: PLACEHOLDER_IMAGE,
    layoutImageSource: "pdf",
    layoutImageWidth: 0,
    layoutImageHeight: 0,
    progressChartImage: PLACEHOLDER_IMAGE,
    photos: Array.from({ length: 4 }, (_, index) => ({
      ...photos.get(`photo_${index + 1}`)!,
      dataUrl: PLACEHOLDER_IMAGE,
      source: "pdf" as const,
      width: 0,
      height: 0,
    })),
  });
}
