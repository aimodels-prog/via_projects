import type { ExtractedReport } from "@/lib/report.types";
import { reportDate } from "@/lib/report-dates";

export function MonthlyReportFields({
  report: r,
  onChange,
}: {
  report: ExtractedReport;
  onChange: (patch: Partial<ExtractedReport>) => void;
}) {
  function number(key: keyof ExtractedReport, label: string, nullable = false) {
    const value = r[key];
    return (
      <label className="block text-sm" key={key}>
        {label}
        <input
          aria-label={label}
          type="number"
          step="any"
          className="mt-1 block h-11 w-full rounded border px-3"
          value={typeof value === "number" && Number.isFinite(value) ? value : ""}
          onChange={(e) => {
            const n = e.target.value === "" ? (nullable ? null : NaN) : Number(e.target.value);
            const next = { ...r, [key]: n };
            const patch: Partial<ExtractedReport> = { [key]: n };
            if (key === "plannedProgress" || key === "actualProgress")
              patch.variance = +(next.actualProgress - next.plannedProgress).toFixed(2);
            if (key === "financialPlannedProgress" || key === "financialProgress")
              patch.financialDifference =
                next.financialPlannedProgress == null || !Number.isFinite(next.financialProgress)
                  ? null
                  : +(next.financialProgress - next.financialPlannedProgress).toFixed(3);
            if (key === "elapsedDays")
              patch.remainingDays =
                Number.isFinite(next.elapsedDays) && Number.isFinite(next.constructionDays)
                  ? next.constructionDays - next.elapsedDays
                  : NaN;
            onChange(patch);
          }}
        />
      </label>
    );
  }
  const date = reportDate(r.dataAsOf);
  const heading = (label: string) => (
    <h3 className="col-span-full mt-3 border-b pb-2 font-semibold text-brand">{label}</h3>
  );
  return (
    <section className="space-y-4">
      <p className="mt-4 text-sm text-muted-foreground">
        Only update this month’s figures. Project details, contract, contacts, logo and map are kept
        in Project setup.
      </p>
      {r.previousMonthReference && (
        <aside className="rounded border border-blue-200 bg-blue-50 p-3 text-sm">
          <strong>Previous report: {r.previousMonthReference.reportMonth || "Undated"}</strong>
          <p>Reference only — not copied into this month’s figures.</p>
          <p>
            Physical progress: {r.previousMonthReference.actualProgress ?? "Not reported"}% ·
            Financial progress: {r.previousMonthReference.financialProgress ?? "Not reported"}% ·
            Paid: {r.previousMonthReference.paidAmount ?? "Not reported"} {r.currency}
          </p>
        </aside>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        {heading("1. Reporting date")}
        <label className="text-sm">
          Data as of
          <input
            aria-label="Data as of"
            type="date"
            className="mt-1 block h-11 w-full rounded border px-3"
            value={date == null ? "" : new Date(date).toISOString().slice(0, 10)}
            onChange={(e) => {
              const iso = e.target.value;
              const timestamp = reportDate(iso);
              onChange({
                dataAsOf: iso,
                reportMonth:
                  timestamp == null
                    ? ""
                    : new Date(timestamp).toLocaleDateString("en-GB", {
                        month: "long",
                        year: "numeric",
                        timeZone: "UTC",
                      }),
              });
            }}
          />
        </label>
        <p className="self-center text-sm">
          Report month: <strong>{r.reportMonth || "Choose a date"}</strong>
        </p>
        {heading("2. Physical progress (%)")}
        {number("plannedProgress", "Cumulative planned physical progress %")}
        {number("actualProgress", "Cumulative actual physical progress %")}
        {number("monthPlannedProgress", "This month planned %", true)}
        {number("monthActualProgress", "This month actual %", true)}
        <p className="col-span-full text-sm">
          Difference (calculated): {Number.isFinite(r.variance) ? `${r.variance}%` : "—"}
        </p>
        {heading("3. Financial progress")}
        {number("financialPlannedProgress", "Planned financial progress %", true)}
        {number("financialProgress", "Actual financial progress %")}
        {number("paidAmount", "Actually paid amount", true)}
        <p className="self-center text-sm">
          Difference (calculated): {r.financialDifference ?? "—"}
        </p>
        {heading("4. Time and resources")}
        {number("elapsedDays", "Elapsed time (days)")}
        <p className="self-center text-sm">
          Remaining days (calculated): {Number.isFinite(r.remainingDays) ? r.remainingDays : "—"}
        </p>
        {number("actualManpower", "Actual manpower")}
        {number("actualMachinery", "Actual machinery")}
        <details className="col-span-full rounded border p-3">
          <summary className="cursor-pointer font-medium">
            More monthly details / correct calculated values
          </summary>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            {number("remainingDays", "Remaining period (days)")}
            {number("financialDifference", "Financial difference % (as printed)", true)}
            {number("plannedManpower", "Planned manpower")}
            {number("plannedMachinery", "Planned machinery")}
            {number("anticipatedPayment", "Total payment anticipated", true)}
            {(
              [
                ["expectedCompletionDate", "Expected completion date"],
                ["reportNumber", "Report number"],
                ["revision", "Revision"],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="text-sm">
                {label}
                <input
                  aria-label={label}
                  className="mt-1 block h-11 w-full rounded border px-3"
                  value={r[key] === "Not provided" ? "" : r[key]}
                  onChange={(e) => onChange({ [key]: e.target.value })}
                />
              </label>
            ))}
          </div>
        </details>
      </div>
    </section>
  );
}
