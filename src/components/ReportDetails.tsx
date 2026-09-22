import type { ExtractedReport } from "@/lib/report.types";
export function ReportDetails({
  details,
  attachments,
}: {
  details: ExtractedReport["details"];
  attachments: ExtractedReport["attachments"];
}) {
  if (!details.length && !attachments.length) return null;
  return (
    <details className="border bg-white p-3">
      <summary className="cursor-pointer font-bold">
        Additional approved report details and drawings
      </summary>
      <dl className="my-3 grid gap-2">
        {details.map((d, i) => (
          <div key={i} className="flex flex-wrap justify-between gap-2 border-b py-2">
            <dt>{d.label}</dt>
            <dd>
              {d.value} {d.unit}
            </dd>
          </div>
        ))}
      </dl>
      <div className="grid gap-4 md:grid-cols-2">
        {attachments.map((a, i) => (
          <figure key={i}>
            <img src={a.dataUrl} alt={a.label} className="max-h-[600px] w-full object-contain" />
            <figcaption>{a.label}</figcaption>
          </figure>
        ))}
      </div>
    </details>
  );
}
