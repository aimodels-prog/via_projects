import { UploadField } from "./UploadField";
import { useEffect, useState } from "react";
import type { ExtractedReport } from "@/lib/report.types";
import { generateSalalahPdf } from "@/lib/reports.functions";

export function SalalahPdfPanel({
  report,
  onLogo,
  onTitle,
  onChartMode,
  onChartImage,
  onMapFraming,
}: {
  report: ExtractedReport;
  onLogo: (url: string) => void;
  onTitle: (title: string) => void;
  onChartMode: (mode: "image" | "generated") => void;
  onChartImage: (url: string) => void;
  onMapFraming: (
    changes: Partial<Pick<ExtractedReport, "printMapFit" | "printMapX" | "printMapY">>,
  ) => void;
}) {
  const [pdf, setPdf] = useState<{ url: string; report: ExtractedReport } | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [reviewed, setReviewed] = useState(false);
  useEffect(() => {
    setReviewed(false);
  }, [report]);
  useEffect(
    () => () => {
      if (pdf) URL.revokeObjectURL(pdf.url);
    },
    [pdf],
  );
  const current = pdf?.report === report;
  return (
    <section className="my-6 space-y-3 border border-brand p-4">
      <h3 className="font-bold">PDF preview — VIA Classic</h3>
      <p className="text-sm">
        Check your figures, photos and layout before downloading. The PDF includes your chosen
        project layout and a separate activity-status drawing. The progress chart uses your monthly
        figures or an uploaded chart image. This page fits up to 13 activities and 36 chart months.
        Check that the activity drawing colours match the report legend.
      </p>
      <fieldset className="space-y-3 rounded border bg-slate-50 p-3 text-sm">
        <legend className="px-1 font-semibold">Fit your layout image</legend>
        <label className="block">
          Map image fit
          <select
            aria-label="PDF map image fit"
            className="ml-2 rounded border p-2"
            value={report.printMapFit ?? "contain"}
            onChange={(e) => onMapFraming({ printMapFit: e.target.value as "cover" | "contain" })}
          >
            <option value="cover">Fill map frame (crop edges)</option>
            <option value="contain">Show complete map (may leave space)</option>
          </select>
        </label>
        <p className="text-xs text-muted-foreground">
          The frame excludes the heading and brief-description column. Fill mode removes empty
          margins without stretching. Check that route endpoints, labels and the legend remain
          visible; use Show complete map if needed.
        </p>
        <div
          className="max-w-2xl overflow-hidden border bg-white"
          style={{ aspectRatio: 296.16 / 186.84 }}
        >
          <img
            src={report.layoutImage}
            alt="PDF project map framing preview"
            className="h-full w-full"
            style={{
              objectFit: report.printMapFit ?? "contain",
              objectPosition:
                report.printMapFit === "contain"
                  ? "50% 50%"
                  : `${report.printMapX ?? 50}% ${report.printMapY ?? 50}%`,
            }}
          />
        </div>
        {report.printMapFit === "cover" && (
          <div className="max-w-2xl space-y-2">
            {(
              [
                ["Horizontal", "printMapX"],
                ["Vertical", "printMapY"],
              ] as const
            ).map(([label, key]) => (
              <label key={key} className="flex items-center gap-3">
                <span className="w-20">{label}</span>
                <input
                  aria-label={`${label} PDF map position`}
                  className="min-w-0 flex-1"
                  type="range"
                  min="0"
                  max="100"
                  value={report[key] ?? 50}
                  onChange={(e) => onMapFraming({ [key]: Number(e.target.value) })}
                />
                <output>{report[key] ?? 50}%</output>
              </label>
            ))}
            <button
              type="button"
              className="rounded border bg-white px-2 py-1"
              onClick={() => onMapFraming({ printMapX: 50, printMapY: 50 })}
            >
              Centre map
            </button>
          </div>
        )}
      </fieldset>
      <label className="block text-sm">
        PDF S-curve source
        <select
          aria-label="PDF S-curve source"
          className="block border p-2"
          value={report.printChartMode}
          onChange={(e) => onChartMode(e.target.value as "image" | "generated")}
        >
          <option value="image">Original chart picture (closest design match)</option>
          <option value="generated">Generate from verified monthly figures</option>
        </select>
      </label>
      {report.printChartMode === "image" && (
        <div className="space-y-2 text-sm">
          <p>
            Upload only the chart and its numeric table, without the yellow heading. It fits inside
            the original chart panel without cropping or stretching. The web dashboard still needs
            monthly figures for its interactive graph.
          </p>
          <div className="w-full min-w-0">
            Original S-curve picture
            <UploadField
              aria-label="Original S-curve picture"

              accept="image/png,image/jpeg,image/webp"

              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (!file) return;
                if (file.size > 15 * 1024 * 1024) {
                  setError("Chart image must be under 15 MB.");
                  return;
                }
                const reader = new FileReader();
                reader.onload = () => {
                  onChartImage(String(reader.result));
                  setError("");
                };
                reader.onerror = () => setError("Could not read chart image.");
                reader.readAsDataURL(file);
              }}
            />
          </div>
          {report.printChartImage && (
            <>
              <img
                src={report.printChartImage}
                alt="Original PDF S-curve"
                className="max-h-64 max-w-full object-contain"
              />
              <button type="button" className="border px-2 py-1" onClick={() => onChartImage("")}>
                Remove chart picture
              </button>
            </>
          )}
        </div>
      )}
      <label className="block text-sm">
        PDF title line breaks (optional; same wording as project name)
        <textarea
          aria-label="PDF title line breaks"
          className="block w-full border p-2"
          rows={4}
          value={report.printTitle}
          onChange={(e) => onTitle(e.target.value)}
        />
      </label>
      <div className="w-full min-w-0">
        Client / ministry logo for PDF header
        <UploadField
          aria-label="Client / ministry logo for PDF header"

          accept="image/png,image/jpeg,image/webp"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (!f) return;
            if (f.size > 15 * 1024 * 1024) {
              setError("Client logo must be under 15 MB.");
              return;
            }
            const reader = new FileReader();
            reader.onload = () => {
              onLogo(String(reader.result));
              setError("");
            };
            reader.onerror = () => setError("Could not read logo.");
            reader.readAsDataURL(f);
          }}
        />
      </div>
      {report.printClientLogo && (
        <img
          src={report.printClientLogo}
          alt="PDF client logo"
          className="max-h-16 max-w-40 object-contain"
        />
      )}
      <button
        type="button"
        className="border border-brand px-4 py-2 disabled:opacity-40"
        disabled={busy}
        onClick={async () => {
          const snapshot = report;
          setBusy(true);
          setError("");
          setReviewed(false);
          try {
            const result = await generateSalalahPdf({ data: snapshot });
            const bytes = Uint8Array.from(atob(result.base64), (c) => c.charCodeAt(0));
            setPdf({
              url: URL.createObjectURL(new Blob([bytes], { type: "application/pdf" })),
              report: snapshot,
            });
          } catch (e) {
            setError(e instanceof Error ? e.message : "PDF generation failed.");
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "Checking PDF layout…" : "Generate A4 PDF preview"}
      </button>
      {error && (
        <p role="alert" className="whitespace-pre-wrap text-sm text-red-700">
          {error}
        </p>
      )}
      {current && pdf && (
        <>
          <iframe
            src={pdf.url}
            title="Salalah A4 PDF preview"
            className="h-[750px] w-full border"
          />
          <label className="flex gap-2 text-sm">
            <input
              type="checkbox"
              checked={reviewed}
              onChange={(e) => setReviewed(e.target.checked)}
            />
            I checked the PDF figures, images, source-drawing legend and page fit against the
            approved report.
          </label>
          {reviewed && (
            <a
              className="inline-block bg-brand px-4 py-2 text-white"
              href={pdf.url}
              download={`${report.slug}-${report.reportMonth.replace(/[^a-z0-9-]/gi, "-")}.pdf`}
            >
              Download reviewed PDF
            </a>
          )}
        </>
      )}
      {!current && pdf && (
        <p className="text-sm">Report changed. Generate a fresh PDF before downloading.</p>
      )}
    </section>
  );
}
