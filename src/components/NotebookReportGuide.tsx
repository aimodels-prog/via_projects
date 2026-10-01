import { useRef, useState } from "react";
import { Copy, Download } from "lucide-react";
import { NOTEBOOK_REPORT_PROMPT } from "@/lib/notebook-report-prompt";

export function NotebookReportGuide() {
  const [expanded, setExpanded] = useState(false);
  const [status, setStatus] = useState("");
  const prompt = useRef<HTMLTextAreaElement>(null);
  return (
    <section className="report-notebook-guide" aria-labelledby="notebook-guide-title">
      <div>
        <span className="report-import-step">OPTIONAL · FILL FROM A PDF</span>
        <h3 id="notebook-guide-title">Use NotebookLM to prepare your figures</h3>
        <p>
          Start a new notebook. Upload your project PDF and the blank CSV below, then paste our
          prompt. Return here to upload or paste the result and review missing values. Photos and
          logos stay manual.
        </p>
      </div>
      <div className="report-notebook-actions">
        <a href="/templates/pdf-report-template-blank.csv" download="pdf-report-template-blank.csv">
          <Download size={16} aria-hidden="true" /> Download blank CSV for NotebookLM
        </a>
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(NOTEBOOK_REPORT_PROMPT);
              setStatus(
                "Prompt copied. Paste it into NotebookLM after adding your PDF and blank CSV.",
              );
            } catch {
              setExpanded(true);
              setStatus("Automatic copying is unavailable. Select and copy the prompt below.");
              requestAnimationFrame(() => {
                prompt.current?.focus();
                prompt.current?.select();
              });
            }
          }}
        >
          <Copy size={16} aria-hidden="true" /> Copy NotebookLM prompt
        </button>
      </div>
      <button
        type="button"
        className="report-notebook-toggle"
        aria-expanded={expanded}
        aria-controls="notebook-prompt-text"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? "Hide prompt" : "Read the prompt"}
      </button>
      {expanded && (
        <textarea
          id="notebook-prompt-text"
          aria-label="NotebookLM extraction prompt"
          ref={prompt}
          readOnly
          value={NOTEBOOK_REPORT_PROMPT}
          rows={12}
        />
      )}
      {status && <p role="status">{status}</p>}
      <small>
        Use the blank download, not the sample-filled template. Missing information must stay blank;
        AI output still needs review.
      </small>
    </section>
  );
}
