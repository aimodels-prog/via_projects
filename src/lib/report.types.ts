import { z } from "zod";
import { monthKey, reportDate } from "./report-dates";
import { schematicSchema } from "./project-schematic";

export const reportSchema = z.object({
  layoutTemplateId: z.string().max(80).optional(),
  layoutUpdates: z
    .array(
      z.object({
        id: z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/),
        status: z.enum(["complete", "construction", "existing", "unknown"]),
      }),
    )
    .max(50)
    .optional(),
  printLayoutMode: z.enum(["image", "schematic"]).optional(),
  printClientLogo: z.string().default(""),
  useRaysutReferenceLayout: z.boolean().optional(),
  headerLogos: z
    .array(z.object({ name: z.string().max(200), dataUrl: z.string().max(3_000_000) }))
    .max(12)
    .optional(),
  previousMonthReference: z
    .object({
      reportMonth: z.string(),
      actualProgress: z.number().nullable(),
      financialProgress: z.number().nullable(),
      paidAmount: z.number().nullable(),
    })
    .optional(),
  printChartMode: z.enum(["generated", "image"]).default("generated"),
  printChartImage: z.string().default(""),
  printMapFit: z.enum(["cover", "contain"]).optional(),
  printMapX: z.number().min(0).max(100).optional(),
  printMapY: z.number().min(0).max(100).optional(),
  printTitle: z.string().max(1000).default(""),
  schematic: schematicSchema,
  sourceFormat: z.enum(["summary-pdf", "legacy"]).default("legacy"),
  financialPlannedProgress: z.number().min(0).max(100).nullable().default(null),
  financialDifference: z.number().min(-100).max(100).nullable().default(null),
  anticipatedPayment: z.number().nonnegative().nullable().default(null),
  constructionDaysWithVos: z.string().default("Not provided"),
  completionDateWithVos: z.string().default("Not provided"),
  contractRows: z
    .array(
      z.object({
        label: z.string().min(1).max(200),
        value: z.string().min(1).max(200),
        unit: z.string().max(100).default(""),
      }),
    )
    .max(20)
    .default([]),
  contacts: z
    .array(
      z.object({
        name: z.string().min(1).max(200),
        phone: z.string().max(100).default(""),
        role: z.string().max(200).default(""),
        organisation: z.string().max(200).default(""),
      }),
    )
    .max(20)
    .default([]),
  activityStatusImage: z.string().default(""),
  sourceDocument: z
    .object({
      name: z.string().max(200),
      dataUrl: z.string().max(28_000_000).startsWith("data:application/pdf;base64,"),
      pagePreview: z.string().max(25_000_000).startsWith("data:image/png;base64,"),
      sections: z
        .array(
          z.object({
            label: z.string(),
            text: z.string(),
            confidence: z.number().min(0).max(100),
            image: z.string().max(25_000_000).startsWith("data:image/png;base64,"),
          }),
        )
        .max(4),
    })
    .optional(),
  details: z
    .array(
      z.object({
        label: z.string().min(1).max(200),
        value: z.string().min(1).max(2000),
        unit: z.string().max(100),
      }),
    )
    .max(50)
    .default([]),
  attachments: z
    .array(
      z.object({
        label: z.string().min(1).max(200),
        dataUrl: z.string(),
        width: z.number().int().positive(),
        height: z.number().int().positive(),
      }),
    )
    .max(10)
    .default([]),
  chartSource: z.enum(["table", "image"]).default("table"),
  projectName: z.string().min(5),
  projectNumber: z.string().min(1).default("Not provided"),
  projectType: z.string().min(1).default("Construction project"),
  slug: z
    .string()
    .max(100)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .refine(
      (value) =>
        !["admin", "admin-login", "admin-projects", "upload", "projects", "api"].includes(value),
      "This URL is reserved.",
    ),
  region: z.string().min(2),
  reportMonth: z.string().min(4),
  reportNumber: z.string().min(1).default("—"),
  dataAsOf: z.string().min(1).default("Not provided"),
  contractValue: z.string().min(1),
  currency: z.string().min(1).default("R.O."),
  awardDate: z.string().min(1),
  startDate: z.string().min(1),
  completionDate: z.string().min(1),
  expectedCompletionDate: z.string().min(1).default("Not provided"),
  mobilizationDays: z.number().int().nonnegative().default(0),
  constructionDays: z.number().int().positive().default(1),
  elapsedDays: z.number().int().nonnegative(),
  remainingDays: z.number().int().nonnegative(),
  plannedProgress: z.number().min(0).max(100),
  actualProgress: z.number().min(0).max(100),
  variance: z.number().min(-100).max(100),
  monthPlannedProgress: z.number().min(0).max(100).nullable().default(null),
  monthActualProgress: z.number().min(0).max(100).nullable().default(null),
  financialProgress: z.number().min(0).max(100),
  paidAmount: z.number().nonnegative().nullable().default(null),
  plannedMachinery: z.number().int().nonnegative(),
  actualMachinery: z.number().int().nonnegative(),
  plannedManpower: z.number().int().nonnegative(),
  actualManpower: z.number().int().nonnegative(),
  brief: z.string().min(10),
  activitiesText: z.string(),
  activities: z.array(
    z.object({
      name: z.string().min(2),
      planned: z.number().min(0).max(1000).nullable(),
      actual: z.number().min(0).max(1000).nullable(),
      diff: z.number().min(-1000).max(1000).nullable(),
    }),
  ),
  schedule: z
    .array(
      z.object({
        month: z.string().min(1),
        plannedMonthly: z.number().min(0).max(100),
        actualMonthly: z.number().min(0).max(100).nullable(),
        plannedCumulative: z.number().min(0).max(100),
        actualCumulative: z.number().min(0).max(100).nullable(),
      }),
    )
    .default([]),
  clientName: z.string().min(2),
  clientDepartment: z.string().default(""),
  contractorName: z.string().min(2),
  contractorRepresentative: z.string().default(""),
  contractorRole: z.string().default(""),
  contractorPhone: z.string().default(""),
  consultantName: z.string().min(2),
  consultantRepresentative: z.string().default(""),
  consultantRole: z.string().default(""),
  consultantPhone: z.string().default(""),
  engineerName: z.string().default(""),
  engineerPhone: z.string().default(""),
  footerCode: z.string().min(1).default("Not provided"),
  revision: z.string().min(1).default("Rev-01"),
  scope: z
    .array(
      z.object({
        label: z.string().min(1),
        value: z.string().min(1),
        unit: z.string().default(""),
      }),
    )
    .default([]),
  layers: z
    .array(
      z.object({
        code: z.string().min(1),
        name: z.string().min(1),
        thickness: z.number().positive(),
      }),
    )
    .default([]),
  trades: z
    .array(
      z.object({
        name: z.string().min(1),
        status: z.enum(["complete", "active", "behind", "notstarted", "unknown"]),
      }),
    )
    .default([]),
  rawOcrText: z.string(),
  logoImage: z
    .string()
    .refine((value) => !value || value.startsWith("data:image/") || value.startsWith("http"))
    .default(""),
  logoImageSource: z.enum(["pdf", "original"]).default("pdf"),
  logoImageWidth: z.number().int().nonnegative().default(0),
  logoImageHeight: z.number().int().nonnegative().default(0),
  layoutImage: z
    .string()
    .refine((value) => !value || value.startsWith("data:image/") || value.startsWith("http")),
  layoutImageSource: z.enum(["pdf", "original"]).default("pdf"),
  layoutImageWidth: z.number().int().nonnegative().default(0),
  layoutImageHeight: z.number().int().nonnegative().default(0),
  progressChartImage: z
    .string()
    .refine((value) => value.startsWith("data:image/") || value.startsWith("http")),
  photos: z.array(
    z.object({
      caption: z.string().min(2),
      fit: z.enum(["cover", "contain"]).optional(),
      focalX: z.number().min(0).max(100).optional(),
      focalY: z.number().min(0).max(100).optional(),
      sub: z.string().default(""),
      dataUrl: z
        .string()
        .refine((value) => value.startsWith("data:image/") || value.startsWith("http")),
      source: z.enum(["pdf", "original"]).default("pdf"),
      width: z.number().int().nonnegative().default(0),
      height: z.number().int().nonnegative().default(0),
    }),
  ),
});

export type ExtractedReport = z.infer<typeof reportSchema>;

export function makeSlug(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100)
    .replace(/-+$/g, "");
}

/** Visible review warnings, not guesses or requirements to invent optional source data. */
export function dashboardCoverageWarnings(report: ExtractedReport): string[] {
  const warnings: string[] = [];
  const missing = (value: string) =>
    !value.trim() || /^(not provided|unknown|n\/?a|[-—])$/i.test(value.trim());
  for (const [label, value] of [
    ["Client", report.clientName],
    ["Client department", report.clientDepartment],
  ])
    if (missing(value!)) warnings.push(`${label} is not reported.`);
  for (const [label, value] of [
    ["Project number", report.projectNumber],
    ["Report number", report.reportNumber],
    ["Revision", report.revision],
    ["Data as of", report.dataAsOf],
    ["Contractor", report.contractorName],
    ["Consultant", report.consultantName],
    ["Client representative", report.engineerName],
  ])
    if (missing(value!))
      warnings.push(`${label} is not reported; its dashboard slot will remain unfilled.`);
  if (report.monthActualProgress == null || report.monthPlannedProgress == null)
    warnings.push("This-month progress is incomplete; missing values display Not reported.");
  if (report.paidAmount == null)
    warnings.push(
      "Paid amount is not reported. Anticipated payment cannot substitute for paid amount.",
    );
  if (!report.scope.length) warnings.push("Scope quantities are not reported.");
  if (!report.layers.length) warnings.push("Pavement layers are not reported.");
  if (!report.trades.length) warnings.push("Trade statuses are not reported.");
  if (report.contacts.length)
    warnings.push(
      "Additional source contacts are retained for review. Assign verified client, contractor and consultant roles in Project parties; roles are never guessed.",
    );
  if (report.activities.some((a) => a.planned == null || a.actual == null))
    warnings.push("Some activities have missing planned or actual figures; blanks are not zero.");
  if (report.photos.some((p) => missing(p.caption)))
    warnings.push("Some photograph captions are not reported.");
  report.photos.forEach((photo, i) => {
    if (photo.source === "original" && (photo.width < 800 || photo.height < 600))
      warnings.push(
        `Photo ${i + 1} is ${photo.width} × ${photo.height} pixels. It is accepted, but may look soft when enlarged; use a higher-resolution original if available.`,
      );
  });
  if (report.schedule.length < 2)
    warnings.push(
      "Verified monthly schedule data is required. The S-curve is a graph, not an image.",
    );
  for (const detail of report.details)
    if (/^Review required:/i.test(detail.label)) warnings.push(`${detail.label}: ${detail.value}`);
  return warnings;
}

export function validateReport(report: ExtractedReport, options: { skipSchedule?: boolean } = {}) {
  const issues: string[] = [];
  const structural = reportSchema.safeParse(report);
  if (!structural.success) {
    for (const issue of structural.error.issues) {
      issues.push(`${issue.path.join(".")}: ${issue.message}`);
    }
    return issues;
  }
  const calculatedVariance = Number((report.actualProgress - report.plannedProgress).toFixed(2));
  const period = monthKey(report.reportMonth);
  if (!period) issues.push("Report month must be a valid month and year, e.g. July 2026.");
  if (
    !/^\d+(?:,\d{3})*(?:\.\d+)?$/.test(report.contractValue.trim()) ||
    Number(report.contractValue.replace(/,/g, "")) <= 0
  )
    issues.push("Contract value must be a positive decimal amount.");
  const dates = [
    ["Award date", report.awardDate],
    ["Start date", report.startDate],
    ["Completion date", report.completionDate],
    ["Expected completion date", report.expectedCompletionDate],
    ["Data as of", report.dataAsOf],
  ] as const;
  for (const [label, value] of dates) {
    if (
      ["Data as of", "Expected completion date"].includes(label) &&
      (!value.trim() || /^(not provided|n\/?a|[-—])$/i.test(value.trim()))
    )
      continue;
    if (reportDate(value) === null) issues.push(`${label} must be a valid date (DD-MM-YYYY).`);
  }
  const award = reportDate(report.awardDate),
    start = reportDate(report.startDate),
    end = reportDate(report.completionDate),
    asOf = reportDate(report.dataAsOf);
  if (award !== null && start !== null && award > start)
    issues.push("Award date cannot follow construction start.");
  if (start !== null && end !== null && start > end)
    issues.push("Completion date cannot precede construction start.");
  if (asOf !== null && period && new Date(asOf).toISOString().slice(0, 7) !== period)
    issues.push("Data-as-of date must belong to the report month.");
  for (const [label, entries] of [
    ["activity", report.activities.map((x) => x.name)],
    ["scope", report.scope.map((x) => x.label)],
    ["layer", report.layers.map((x) => x.code)],
    ["trade", report.trades.map((x) => x.name)],
  ] as const) {
    const seen = new Set<string>();
    for (const name of entries) {
      const key = name.trim().toLowerCase();
      if (seen.has(key)) issues.push(`Duplicate ${label}: ${name}.`);
      seen.add(key);
    }
  }
  for (const trade of report.trades)
    if (/^(not provided|unknown|n\/?a)$/i.test(trade.name.trim()) && trade.status !== "unknown")
      issues.push("An unreported trade cannot be assigned a known status.");
  if (Math.abs(calculatedVariance - report.variance) > 0.02) {
    issues.push(`Variance must equal actual minus planned (${calculatedVariance.toFixed(2)}%).`);
  }
  if (!/20\d{2}/.test(report.reportMonth)) issues.push("Report month must include a year.");
  if (report.elapsedDays + report.remainingDays !== report.constructionDays) {
    issues.push("Construction days must equal elapsed plus remaining days.");
  }
  if (report.photos.length !== 4)
    issues.push("Exactly four construction photographs are required.");
  if (report.logoImageSource !== "original") {
    issues.push("Upload the original dashboard logo.");
  } else if (report.logoImageWidth < 128 || report.logoImageHeight < 128) {
    issues.push("The dashboard logo must be at least 128 × 128 pixels.");
  }
  if (report.scope.length > 5)
    issues.push("The approved dashboard supports up to five scope rows.");
  if (report.layers.length > 6)
    issues.push("The dashboard supports up to six pavement layers; split or review the report.");
  if (report.trades.length > 12) issues.push("The dashboard supports up to twelve trade statuses.");
  if (report.activities.length > 16)
    issues.push(
      "The fixed dashboard supports up to sixteen major activities. Review the source grouping.",
    );
  if (
    report.layoutImageSource !== "original" ||
    !/^data:image\/(png|jpeg|webp);base64,/.test(report.layoutImage) ||
    report.layoutImageWidth < 1 ||
    report.layoutImageHeight < 1
  )
    issues.push("Upload a project layout image for the dashboard and PDF.");
  for (let index = 0; index < report.photos.length; index += 1) {
    const photo = report.photos[index]!;
    if (photo.source !== "original") {
      issues.push(`Photo ${index + 1}: upload the original image.`);
    } else if (photo.width < 1 || photo.height < 1) {
      issues.push(`Photo ${index + 1}: upload a readable image with valid dimensions.`);
    }
    if (!photo.caption.trim()) issues.push(`Photo ${index + 1}: a caption is required.`);
  }
  if (report.activities.length === 0) issues.push("At least one major activity is required.");
  for (const activity of report.activities) {
    if (activity.planned === null || activity.actual === null) {
      if (activity.diff !== null) {
        issues.push(`${activity.name}: variance must be blank when progress is not reported.`);
      }
      continue;
    }
    const difference = Number((activity.actual - activity.planned).toFixed(2));
    if (activity.diff === null || Math.abs(difference - activity.diff) > 0.02) {
      issues.push(`${activity.name}: activity variance must be ${difference.toFixed(2)}%.`);
    }
  }
  if (!options.skipSchedule && report.schedule.length < 2) {
    issues.push("At least two progress schedule rows are required for the S-curve.");
  } else if (!options.skipSchedule) {
    const months = new Set<string>();
    let previousMonth = "";
    let previousRow: ExtractedReport["schedule"][number] | undefined;
    let previousPlanned = -1;
    let previousActual = -1;
    for (const entry of report.schedule) {
      const normalizedMonth = monthKey(entry.month) ?? entry.month.trim().toLowerCase();
      if (!monthKey(entry.month)) issues.push(`${entry.month}: invalid schedule month.`);
      if (previousMonth && monthKey(entry.month)) {
        const next = new Date(previousMonth + "-01T00:00:00Z");
        next.setUTCMonth(next.getUTCMonth() + 1);
        if (Number.isFinite(next.getTime()) && next.toISOString().slice(0, 7) !== normalizedMonth)
          issues.push(
            `${entry.month}: provide consecutive monthly schedule rows; do not skip months.`,
          );
      }
      if (previousMonth && normalizedMonth <= previousMonth)
        issues.push(`${entry.month}: schedule months must be chronological.`);
      if (previousRow) {
        if (
          Math.abs(entry.plannedCumulative - previousRow.plannedCumulative - entry.plannedMonthly) >
          0.03
        )
          issues.push(
            `${entry.month}: planned monthly progress does not reconcile with cumulative progress.`,
          );
        if (
          entry.actualCumulative !== null &&
          previousRow.actualCumulative !== null &&
          entry.actualMonthly !== null &&
          Math.abs(entry.actualCumulative - previousRow.actualCumulative - entry.actualMonthly) >
            0.03
        )
          issues.push(
            `${entry.month}: actual monthly progress does not reconcile with cumulative progress.`,
          );
      }
      if (
        period &&
        normalizedMonth > period &&
        (entry.actualCumulative !== null || entry.actualMonthly !== null)
      )
        issues.push(`${entry.month}: future actual progress must be blank.`);
      if (
        period &&
        normalizedMonth <= period &&
        (entry.actualCumulative === null || entry.actualMonthly === null)
      )
        issues.push(`${entry.month}: historical actual progress is missing; verify the source.`);
      previousMonth = normalizedMonth;
      previousRow = entry;
      if (months.has(normalizedMonth)) issues.push(`Duplicate schedule month: ${entry.month}.`);
      months.add(normalizedMonth);
      if (entry.plannedCumulative + 0.02 < previousPlanned) {
        issues.push(`${entry.month}: planned cumulative progress cannot decrease.`);
      }
      previousPlanned = entry.plannedCumulative;
      if (entry.actualCumulative !== null) {
        if (entry.actualCumulative + 0.02 < previousActual) {
          issues.push(`${entry.month}: actual cumulative progress cannot decrease.`);
        }
        previousActual = entry.actualCumulative;
      }
    }
    const current = report.schedule.find((entry) => monthKey(entry.month) === period);
    if (!current || current.actualCumulative === null)
      issues.push("The schedule must include actual progress for the report month.");
    if (current) {
      if (Math.abs(current.plannedCumulative - report.plannedProgress) > 0.02) {
        issues.push("Current schedule planned cumulative must match planned progress.");
      }
      if (Math.abs(current.actualCumulative! - report.actualProgress) > 0.02) {
        issues.push("Current schedule actual cumulative must match actual progress.");
      }
      if (
        report.monthPlannedProgress !== null &&
        Math.abs(current.plannedMonthly - report.monthPlannedProgress) > 0.02
      ) {
        issues.push("Current schedule monthly plan must match this-month planned progress.");
      }
      if (
        report.monthActualProgress !== null &&
        (current.actualMonthly === null ||
          Math.abs(current.actualMonthly - report.monthActualProgress) > 0.02)
      ) {
        issues.push("Current schedule monthly actual must match this-month actual progress.");
      }
    }
  }
  if (report.actualMachinery > report.plannedMachinery + 500) {
    issues.push("Actual machinery is outside the expected range.");
  }
  if (report.actualManpower > report.plannedManpower + 5000) {
    issues.push("Actual manpower is outside the expected range.");
  }
  return issues;
}
