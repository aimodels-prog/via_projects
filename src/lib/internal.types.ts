export type Money = string; // Decimal OMR, six places; arithmetic uses integer millionths.
export type Source = { sheet: string; cell: string };
export type InternalIssue = Source & { code: string; message: string };
export type InternalProject = {
  id: string;
  name: string;
  code: string;
  country: string;
  currency: "OMR" | null;
  start: string | null;
  end: string | null;
  eot: string;
  client: string;
  clientPm: string;
  contractor: string;
  contractorPm: string;
  partner: string;
  contractorValue: Money | null;
  viaValue: Money | null;
  physical: number | null;
  reportedInvoiced: Money | null;
  reportedOutstanding: Money | null;
  retentionOriginal: string;
  retentionClassification: "unconfirmed";
  source: Source;
};
export type InternalStaff = {
  projectId: string;
  position: string;
  name: string;
  nationalityGroup: string;
  gender: string;
  start: string | null;
  end: string | null;
  accommodation: string;
  cars: number | null;
  source: Source;
};
export type InternalInvoice = {
  projectId: string;
  number: string;
  period: string | null;
  amount: Money | null;
  outstanding: Money | null;
  unbilled: Money | null;
  status: "received" | "unpaid" | "unknown";
  source: Source;
};
export type InternalTarget = {
  name: string;
  projectIds: string[];
  monthly: Money | null;
  contract: Money | null;
  source: Source;
};
export type InternalReport = {
  version: 1;
  asOf: string;
  projects: InternalProject[];
  staff: InternalStaff[];
  invoices: InternalInvoice[];
  targets: InternalTarget[];
  issues: InternalIssue[];
  notes: Array<{ projectId: string; text: string; source: Source }>;
};
export type InternalSnapshot = {
  id: string;
  asOf: string;
  fileName: string;
  sha256: string;
  state: "draft" | "approved";
  createdAt: string;
  createdBy: string;
  approvedAt: string | null;
  approvedBy: string | null;
  report: InternalReport;
};

export function moneyFromNumber(value: number): Money {
  if (!Number.isFinite(value) || Math.abs(value) > 1_000_000_000)
    throw new Error("Amount is outside the supported range.");
  return value.toFixed(6);
}
function micros(value: Money) {
  if (!/^-?\d+\.\d{6}$/.test(value)) throw new Error("Invalid stored monetary amount.");
  return BigInt(value.replace(".", ""));
}
function decimal(value: bigint): Money {
  const negative = value < 0n;
  const digits = (negative ? -value : value).toString().padStart(7, "0");
  return `${negative ? "-" : ""}${digits.slice(0, -6)}.${digits.slice(-6)}`;
}
export function sumMoney(values: Array<Money | null>): Money {
  return decimal(values.reduce<bigint>((sum, v) => sum + (v === null ? 0n : micros(v)), 0n));
}
export function sumKnownMoney(values: Array<Money | null>): Money | null {
  return values.some((value) => value !== null) ? sumMoney(values) : null;
}
export function subtractMoney(a: Money, b: Money): Money {
  return decimal(micros(a) - micros(b));
}
export function formatMoney(value: Money | null) {
  return value === null
    ? "Not provided"
    : Number(value).toLocaleString("en-OM", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
}
export function elapsedPercent(start: string | null, end: string | null, asOf: string) {
  if (!start || !end || end <= start) return null;
  return Math.max(
    0,
    Math.min(
      100,
      ((Date.parse(asOf) - Date.parse(start)) / (Date.parse(end) - Date.parse(start))) * 100,
    ),
  );
}
export function internalSummary(report: InternalReport) {
  const month = report.asOf.slice(0, 7);
  const invoices = report.invoices.filter((i) => i.period !== null && i.period <= month);
  const invoiced = sumKnownMoney(invoices.map((i) => i.amount));
  const outstanding = sumKnownMoney(invoices.map((i) => i.outstanding));
  // Received amounts remain unknown where the balance itself is unknown.
  const received = sumKnownMoney(
    invoices.map((i) =>
      i.amount !== null && i.outstanding !== null ? subtractMoney(i.amount, i.outstanding) : null,
    ),
  );
  const months = [...new Set(invoices.map((i) => i.period!))].sort();
  const series = months.map((period) => {
    const rows = invoices.filter((i) => i.period === period);
    return {
      period,
      invoiced: sumKnownMoney(rows.map((i) => i.amount)),
      outstanding: sumKnownMoney(rows.map((i) => i.outstanding)),
    };
  });
  const activeStaff = report.staff.filter(
    (s) => s.name && s.start && s.end && s.start <= report.asOf && s.end >= report.asOf,
  );
  const classified = activeStaff.filter((s) =>
    ["omani", "expat"].includes(s.nationalityGroup.toLowerCase()),
  );
  return {
    invoiced,
    outstanding,
    received,
    unbilled: sumKnownMoney(invoices.map((i) => i.unbilled)),
    viaValue: sumKnownMoney(
      report.projects.filter((p) => p.currency === "OMR").map((p) => p.viaValue),
    ),
    incompleteInvoices: invoices.filter(
      (i) => i.amount === null || i.outstanding === null || i.unbilled === null,
    ).length,
    series,
    activeStaff: activeStaff.length,
    omanization: classified.length
      ? (classified.filter((s) => s.nationalityGroup.toLowerCase() === "omani").length /
          classified.length) *
        100
      : null,
  };
}
