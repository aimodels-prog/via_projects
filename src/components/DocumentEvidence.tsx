import { useState } from "react";
import { readDocumentEvidence } from "@/lib/document-evidence";
import type { ExtractedReport } from "@/lib/report.types";

type Evidence = NonNullable<ExtractedReport["sourceDocument"]>;
export function DocumentEvidence({
  value,
  onChange,
}: {
  value: Evidence | undefined;
  onChange: (value: Evidence) => void;
}) {
  const [working, setWorking] = useState(false),
    [message, setMessage] = useState("");
  return (
    <section className="mb-6 border border-border bg-white p-5">
      <h2 className="font-bold">Source document and extraction evidence</h2>
      <p className="my-2 text-sm">
        Upload the source summary PDF. Image-based pages are read with OCR in this browser. OCR text
        is unverified; compare it with the page before using it in the CSV. No values are guessed or
        automatically published.
      </p>
      <input
        aria-label="Source summary PDF"
        type="file"
        accept="application/pdf,.pdf"
        disabled={working}
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          setWorking(true);
          try {
            const evidence = await readDocumentEvidence(file, setMessage);
            const dataUrl = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(String(reader.result));
              reader.onerror = () => reject(new Error("Cannot read PDF"));
              reader.readAsDataURL(file);
            });
            onChange({ ...evidence, name: file.name, dataUrl });
            setMessage(
              "Source loaded. Check the OCR against the image; confidence is not a guarantee of accuracy.",
            );
          } catch (error) {
            setMessage(error instanceof Error ? error.message : "Unable to read source.");
          } finally {
            setWorking(false);
          }
        }}
      />
      <p role="status" className="mt-2 text-sm">
        {message}
      </p>
      {value && (
        <details open>
          <summary>{value.name} — source evidence (internal only)</summary>
          <a href={value.pagePreview} target="_blank" rel="noreferrer">
            <img src={value.pagePreview} alt="Original report page" className="mt-3 w-full" />
          </a>
          {value.sections.map((section, i) => (
            <details key={i}>
              <summary>
                {section.label}
                {section.confidence > 0
                  ? ` — OCR confidence ${section.confidence.toFixed(0)}%`
                  : ""}
              </summary>
              <img src={section.image} alt={section.label} className="w-full" />
              <pre className="max-h-80 overflow-auto whitespace-pre-wrap text-xs">
                {section.text}
              </pre>
            </details>
          ))}
        </details>
      )}
    </section>
  );
}
