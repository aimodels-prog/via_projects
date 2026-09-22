import type { ExtractedReport } from "@/lib/report.types";

type Props = {
  report: ExtractedReport;
  onChange: (patch: Partial<ExtractedReport>) => void;
  mode?: "setup" | "all";
};
const present = (value: unknown) =>
  value != null &&
  String(value).trim() !== "" &&
  !/^(not provided|n\/?a|unknown|[-—])$/i.test(String(value).trim());

/** Fixed Raysut fields. Source-only extras remain available for review, not alternate layouts. */
export function SourceReportFields({ report: r, onChange, mode = "all" }: Props) {
  function field(
    key: keyof ExtractedReport,
    label: string,
    kind: "text" | "number" | "nullable" = "text",
  ) {
    if (
      mode === "setup" &&
      [
        "reportMonth",
        "elapsedDays",
        "remainingDays",
        "expectedCompletionDate",
        "reportNumber",
        "dataAsOf",
        "revision",
      ].includes(key)
    )
      return null;
    const value = r[key] as string | number | null;
    return (
      <label key={key} className="block text-sm">
        <span className="dashboard-eyebrow block">{label}</span>
        <input
          className="mt-2 h-11 w-full border px-3"
          aria-label={label}
          type={kind === "text" ? "text" : "number"}
          step="any"
          value={
            value == null ||
            (typeof value === "number" && !Number.isFinite(value)) ||
            !present(value)
              ? ""
              : value
          }
          onChange={(e) => {
            const value =
              kind === "text"
                ? e.target.value
                : e.target.value.trim()
                  ? Number(e.target.value)
                  : kind === "nullable"
                    ? null
                    : Number.NaN;
            const patch = { [key]: value } as Partial<ExtractedReport>;
            if (key === "plannedProgress" || key === "actualProgress")
              patch.variance = Number(
                (
                  (key === "actualProgress" ? Number(value) : r.actualProgress) -
                  (key === "plannedProgress" ? Number(value) : r.plannedProgress)
                ).toFixed(2),
              );
            onChange(patch);
          }}
        />
      </label>
    );
  }
  const heading = (title: string) => (
    <h3 className="sm:col-span-2 mt-5 border-b pb-2 font-bold text-brand">{title}</h3>
  );
  return (
    <div className="mt-6 grid gap-5 sm:grid-cols-2">
      {heading("Project details — set up once")}
      {field("projectName", "Project name")}
      {field("region", "Region / governorate")}
      {field("reportMonth", "Report month")}
      {field("clientName", "Client")}
      {field("clientDepartment", "Client department")}

      {heading("Contract value")}
      {field("contractValue", "Approved contract total")}
      {field("currency", "Currency")}
      <details className="sm:col-span-2 space-y-2">
        <summary>PDF contract value table (seven fixed rows)</summary>
        <p className="text-xs text-muted-foreground">
          Keep original contract, contingency and each variation row exactly as printed. Nil/NA are
          not invented zeroes.
        </p>
        {!r.contractRows.length && (
          <button
            type="button"
            className="border p-2"
            onClick={() =>
              onChange({
                contractRows: [
                  "Original contract (No Cont.)",
                  "Contingency",
                  "Original contract (with Cont.)",
                  "Contract (with VO.1)",
                  "Contract (with VO.2)",
                  "Contract (with VO.3 & Cont.)",
                  "Contract (with VO.4 & Cont.)",
                ].map((label) => ({ label, value: "Not provided", unit: r.currency })),
              })
            }
          >
            Use standard PDF contract rows
          </button>
        )}
        {r.contractRows.map((row, i) => (
          <div key={i} className="grid grid-cols-[2fr_1fr_1fr_auto] gap-2">
            {(["label", "value", "unit"] as const).map((key) => (
              <input
                key={key}
                aria-label={`Contract row ${i + 1} ${key}`}
                value={row[key]}
                className="min-w-0 border p-2 text-sm"
                onChange={(e) =>
                  onChange({
                    contractRows: r.contractRows.map((item, j) =>
                      j === i ? { ...item, [key]: e.target.value } : item,
                    ),
                  })
                }
              />
            ))}
            <button
              type="button"
              onClick={() => onChange({ contractRows: r.contractRows.filter((_, j) => j !== i) })}
            >
              Remove
            </button>
          </div>
        ))}
        <button
          type="button"
          className="border p-2 text-sm"
          onClick={() =>
            onChange({
              contractRows: [...r.contractRows, { label: "", value: "", unit: r.currency }],
            })
          }
        >
          + Add contract row
        </button>
      </details>

      {heading("Project durations / key dates")}
      {field("awardDate", "Awarding date")}
      {field("mobilizationDays", "Mobilization (days)", "number")}
      {field("constructionDays", "Construction period (days)", "number")}
      {field("startDate", "Start of construction")}
      {field("completionDate", "Completion date")}
      <details className="sm:col-span-2">
        <summary>Supplementary variation dates (not dashboard fields)</summary>
        {field("constructionDaysWithVos", "Construction period (with VOs)")}
        {field("completionDateWithVos", "Completion date (with VOs)")}
      </details>
      {field("elapsedDays", "Elapsed time (days)", "number")}
      {field("remainingDays", "Remaining period (days)", "number")}
      {field("expectedCompletionDate", "Expected completion date")}

      {heading("Brief description")}
      <label className="sm:col-span-2 text-sm">
        Brief description and narrative progress
        <textarea
          aria-label="Brief description"
          className="mt-2 w-full border p-3"
          rows={6}
          value={r.brief}
          onChange={(e) => onChange({ brief: e.target.value })}
        />
      </label>
      {mode === "all" && (
        <>
          {heading("Project physical progress")}
          {field("plannedProgress", "Cumulative planned physical progress %", "number")}
          {field("actualProgress", "Cumulative actual physical progress %", "number")}
          <label className="text-sm">
            Physical difference % (actual minus planned — calculated)
            <input
              aria-label="Calculated physical difference"
              readOnly
              className="mt-2 h-11 w-full border bg-slate-50 px-3"
              value={Number.isFinite(r.variance) ? r.variance : ""}
            />
          </label>

          {heading("Project financial progress")}
          {field("paidAmount", "Actually paid amount", "nullable")}
          {field("monthPlannedProgress", "This month planned %", "nullable")}
          {field("monthActualProgress", "This month actual %", "nullable")}
          <details className="sm:col-span-2">
            <summary>Supplementary financial information (not dashboard KPIs)</summary>
            {field("financialPlannedProgress", "Planned financial progress %", "nullable")}
            {field("financialProgress", "Actual financial progress %", "number")}
            {field("financialDifference", "Financial difference % (as printed)", "nullable")}
            {field("anticipatedPayment", "Total payment anticipated", "nullable")}
            <p className="sm:col-span-2 text-xs text-muted-foreground">
              Anticipated payment is not paid amount. Preserve the printed financial difference and
              its sign; it may use a different subtraction convention.
            </p>
          </details>
          {heading("Contractor’s resources")}
          {field("plannedMachinery", "Planned machinery", "number")}
          {field("actualMachinery", "Actual machinery", "number")}
          {field("plannedManpower", "Planned manpower", "number")}
          {field("actualManpower", "Actual manpower", "number")}
          <p className="sm:col-span-2 text-sm">
            Calculated differences: machinery{" "}
            {Number.isFinite(r.actualMachinery - r.plannedMachinery)
              ? r.actualMachinery - r.plannedMachinery
              : "—"}
            ; manpower{" "}
            {Number.isFinite(r.actualManpower - r.plannedManpower)
              ? r.actualManpower - r.plannedManpower
              : "—"}
            .
          </p>
        </>
      )}
      {mode === "setup" && (
        <>
          {heading("Planned resources")}
          {field("plannedMachinery", "Planned machinery", "number")}
          {field("plannedManpower", "Planned manpower", "number")}
        </>
      )}
      <details className="sm:col-span-2">
        <summary>
          Additional source contacts — assign dashboard roles below only when verified
        </summary>
        <p className="sm:col-span-2 text-xs text-muted-foreground">
          Keep every printed contact. Leave role or organisation blank when its association is
          unclear.
        </p>
        {r.contacts.map((contact, i) => (
          <fieldset key={i} className="sm:col-span-2 grid gap-2 border p-3 sm:grid-cols-2">
            <legend>Contact {i + 1}</legend>
            {(["name", "phone", "role", "organisation"] as const).map((key) => (
              <label key={key} className="text-xs capitalize">
                {key}
                <input
                  aria-label={`Contact ${i + 1} ${key}`}
                  className="mt-1 w-full border p-2"
                  value={contact[key]}
                  onChange={(e) =>
                    onChange({
                      contacts: r.contacts.map((item, j) =>
                        j === i ? { ...item, [key]: e.target.value } : item,
                      ),
                    })
                  }
                />
              </label>
            ))}
            <button
              type="button"
              onClick={() => onChange({ contacts: r.contacts.filter((_, j) => j !== i) })}
            >
              Remove contact
            </button>
          </fieldset>
        ))}
        <button
          type="button"
          className="border p-2 text-sm"
          onClick={() =>
            onChange({
              contacts: [...r.contacts, { name: "", phone: "", role: "", organisation: "" }],
            })
          }
        >
          + Add contact
        </button>
      </details>
      {heading("Dashboard header and project parties")}
      <p className="sm:col-span-2 text-xs text-muted-foreground">
        Optional fields may be blank. The dashboard shows Not reported; do not invent missing
        information.
      </p>
      {(
        [
          ["projectNumber", "Project number"],
          ["projectType", "Project type"],
          ["reportNumber", "Report number"],
          ["dataAsOf", "Data as of"],
          ["footerCode", "Footer code"],
          ["revision", "Revision"],
          ["contractorName", "Contractor"],
          ["contractorRepresentative", "Contractor representative"],
          ["contractorRole", "Contractor role"],
          ["contractorPhone", "Contractor phone"],
          ["consultantName", "Consultant"],
          ["consultantRepresentative", "Consultant representative"],
          ["consultantRole", "Consultant role"],
          ["consultantPhone", "Consultant phone"],
          ["engineerName", "Engineer"],
          ["engineerPhone", "Engineer phone"],
        ] as const
      ).map(([key, label]) => field(key, label))}
    </div>
  );
}
