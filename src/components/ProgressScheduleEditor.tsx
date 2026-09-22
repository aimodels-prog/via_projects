import type { ExtractedReport } from "@/lib/report.types";

export function ProgressScheduleEditor({
  rows,
  onChange,
}: {
  rows: ExtractedReport["schedule"];
  onChange: (rows: ExtractedReport["schedule"]) => void;
}) {
  const fields = [
    ["month", "Month (Mon-YY)"],
    ["plannedMonthly", "Monthly plan"],
    ["actualMonthly", "Monthly actual"],
    ["plannedCumulative", "Cumulative plan"],
    ["actualCumulative", "Cumulative actual"],
  ] as const;
  return (
    <section className="mt-8 space-y-3">
      <h3 className="font-bold">S-curve — verified monthly figures</h3>
      <p className="text-sm">
        These numbers draw the interactive Cum. / Mo. graph. Enter every month in order from your
        approved programme. Do not estimate from a graph image. Future actual values stay blank;
        missing required figures block publication.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr>
              {fields.map(([key, label]) => (
                <th key={key}>{label}</th>
              ))}
              <th>Remove</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i}>
                {fields.map(([key, label]) => (
                  <td key={key}>
                    <input
                      className="w-full min-w-24 border p-2"
                      aria-label={`Schedule ${i + 1} ${label}`}
                      type={key === "month" ? "text" : "number"}
                      min={key === "month" ? undefined : 0}
                      max={key === "month" ? undefined : 100}
                      step="any"
                      value={
                        typeof row[key] === "number" && !Number.isFinite(row[key])
                          ? ""
                          : (row[key] ?? "")
                      }
                      onChange={(e) =>
                        onChange(
                          rows.map((r, j) =>
                            j === i
                              ? {
                                  ...r,
                                  [key]:
                                    key === "month"
                                      ? e.target.value
                                      : e.target.value.trim()
                                        ? Number(e.target.value)
                                        : key.startsWith("actual")
                                          ? null
                                          : Number.NaN,
                                }
                              : r,
                          ),
                        )
                      }
                    />
                  </td>
                ))}
                <td>
                  <button
                    type="button"
                    aria-label={`Remove schedule ${i + 1}`}
                    onClick={() => onChange(rows.filter((_, j) => j !== i))}
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button
        type="button"
        className="border p-2"
        onClick={() =>
          onChange([
            ...rows,
            {
              month: "",
              plannedMonthly: Number.NaN,
              actualMonthly: null,
              plannedCumulative: Number.NaN,
              actualCumulative: null,
            },
          ])
        }
      >
        Add schedule month
      </button>
    </section>
  );
}
