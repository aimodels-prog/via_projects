import { Link, useNavigate } from "@tanstack/react-router";
import {
  CheckCircle2,
  Download,
  FileUp,
  ShieldCheck,
  ArrowRight,
  ArrowUpRight,
  FolderOpen,
  PenLine,
  Save,
  LockKeyhole,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { parseReportCsv } from "@/lib/pdf-report-csv";
import { publishProjectReport, previewProjectReport } from "@/lib/reports.functions";
import type { ExtractedReport } from "@/lib/report.types";
import { newManualReport, nextMonthlyReport, manualSource } from "@/lib/manual-report";
import { makeSlug, validateReport, dashboardCoverageWarnings } from "@/lib/report.types";
import { UploadField } from "./UploadField";
import { HeaderLogosEditor } from "./HeaderLogosEditor";
import { ReportDetails } from "./ReportDetails";
import { ProgressScheduleEditor } from "./ProgressScheduleEditor";
import { SalalahPdfPanel } from "./SalalahPdfPanel";
import { PhotoFitControls } from "./PhotoFitControls";
import { photoPresentation, PDF_PHOTO_RATIOS } from "@/lib/image-fit";
import { SourceReportFields } from "./SourceReportFields";
import { MonthlyReportFields } from "./MonthlyReportFields";
import { saveReportDraft, listReportDrafts, loadReportDraft } from "@/lib/drafts.functions";

import viaLogo from "@/assets/via-official-logo.png";
import "./report-workspace.css";

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

async function readOriginalImage(file: File) {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
    throw new Error("Use a JPG, PNG, or WebP image.");
  }
  if (file.size > 15 * 1024 * 1024) {
    throw new Error(`${file.name} is larger than the 15 MB limit.`);
  }
  const dataUrl = await fileToDataUrl(file);
  const dimensions = await new Promise<{ width: number; height: number }>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = () => reject(new Error(`${file.name} is not a readable image.`));
    image.src = dataUrl;
  });
  return { dataUrl, ...dimensions };
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string | number | null;
  onChange: (value: string) => void;
  type?: "text" | "number" | "password";
}) {
  return (
    <label className="block">
      <span className="dashboard-eyebrow block">{label}</span>
      <input
        type={type}
        step={type === "number" ? "0.01" : undefined}
        value={
          value === null || (typeof value === "number" && !Number.isFinite(value)) ? "" : value
        }
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 h-11 w-full border border-input bg-white px-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/10"
      />
    </label>
  );
}

export function ReportUploadWorkflow() {
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [report, setReport] = useState<ExtractedReport | null>(null);
  const [step, setStep] = useState(0);
  const [importOpen, setImportOpen] = useState(false);
  const importPanel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (importOpen && !report) importPanel.current?.focus({ preventScroll: true });
  }, [importOpen, report]);
  const [draftsLoaded, setDraftsLoaded] = useState(false);
  const [draftsLoading, setDraftsLoading] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [focusCsvStep, setFocusCsvStep] = useState(false);
  useEffect(() => {
    if (!focusCsvStep || !report) return;
    const navigation = document.getElementById("report-steps");
    navigation?.focus({ preventScroll: true });
    navigation?.scrollIntoView({ behavior: "auto", block: "start" });
    setFocusCsvStep(false);
  }, [focusCsvStep, report]);
  const steps = ["Project details", "Monthly figures", "Photos & layout", "Review & publish"];
  const goToStep = (next: number) => {
    setStep(next);
    document.getElementById("report-steps")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const [editorReady, setEditorReady] = useState(false);
  useEffect(() => setEditorReady(true), []);
  const [drafts, setDrafts] = useState<Array<{ id: string; name: string; savedAt: string }>>([]);
  const [csvText, setCsvText] = useState("");
  const [progress, setProgress] = useState({ message: "", percent: 0 });
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [approved, setApproved] = useState(false);
  const [preview, setPreview] = useState<{
    html: string;
    token: string;
    report: ExtractedReport;
  } | null>(null);
  const [replaceExisting, setReplaceExisting] = useState(false);
  const [clientPassword, setClientPassword] = useState("");
  const previewFrame = useRef<HTMLIFrameElement>(null);
  const issues = useMemo(() => (report ? validateReport(report) : []), [report]);
  const previewCurrent = Boolean(preview && preview.report === report);
  useEffect(() => {
    setApproved(false);
  }, [report]);

  async function showPreview() {
    if (!report || issues.length) return;
    const snapshot = report;
    setWorking(true);
    setError("");
    try {
      const result = await previewProjectReport({ data: snapshot });
      setPreview({ ...result, report: snapshot });
    } catch (error) {
      setError(error instanceof Error ? error.message : "Preview failed.");
    } finally {
      setWorking(false);
    }
  }

  function update<K extends keyof ExtractedReport>(key: K, value: ExtractedReport[K]) {
    setReport((current) => (current ? { ...current, [key]: value } : current));
    setApproved(false);
  }

  async function processCsv(text: string, selectedFile?: File) {
    setError("");
    setApproved(false);
    setCsvText(text);
    setPreview(null);
    try {
      const parsed = parseReportCsv(text);
      parsed.printLayoutMode = "image";
      parsed.useRaysutReferenceLayout = false;
      setCsvText(text);
      setFile(selectedFile ?? new File([text], "pdf-report-data.csv", { type: "text/csv" }));
      setReport(parsed);
      setShowAll(false);
      setStep(2);
      setFocusCsvStep(true);
    } catch (caught) {
      setReport(null);
      setError(caught instanceof Error ? caught.message : "The CSV could not be processed.");
    }
  }

  async function selectFile(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0] ?? null;
    event.target.value = "";
    if (!selected) return;
    if (!/\.(csv|xlsx)$/i.test(selected.name)) {
      setError("Please upload a CSV or XLSX file.");
      return;
    }
    try {
      if (selected.size > 5_000_000) throw new Error("Data file must be smaller than 5 MB.");
      if (selected.name.toLowerCase().endsWith(".xlsx")) {
        const { excelReportToCsv } = await import("@/lib/report-excel");
        const csv = await excelReportToCsv(await selected.arrayBuffer());
        processCsv(
          csv,
          new File([csv], selected.name.replace(/\.xlsx$/i, ".csv"), { type: "text/csv" }),
        );
      } else processCsv(await selected.text(), selected);
    } catch (error) {
      setReport(null);
      setPreview(null);
      setApproved(false);
      setError(error instanceof Error ? error.message : "The data file could not be read.");
    }
  }

  async function publish() {
    if (!report || !approved || issues.length || !previewCurrent || !preview) return;
    setWorking(true);
    setError("");
    setProgress({ message: "Publishing the approved project", percent: 95 });
    try {
      const result = await publishProjectReport({
        data: {
          approved: true,
          previewToken: preview.token,
          replaceExisting,
          clientPassword,
          report,
          sourceBase64: await fileToDataUrl(
            file ??
              new File([manualSource(report)], "manual-report.json", { type: "application/json" }),
          ),
          sourceFileName: file?.name ?? "manual-report.json",
          sourceContentType: file ? "text/csv" : "application/json",
        },
      });
      await navigate({ to: "/$slug", params: { slug: result.slug } });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The project could not be published.");
    } finally {
      setWorking(false);
    }
  }

  async function selectLayoutImage(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0];
    event.target.value = "";
    if (!selected) return;
    setError("");
    try {
      const image = await readOriginalImage(selected);

      setReport((current) =>
        current
          ? {
              ...current,
              layoutImage: image.dataUrl,
              layoutImageSource: "original",
              layoutImageWidth: image.width,
              layoutImageHeight: image.height,
              printLayoutMode: "image",
              printMapFit: "contain",
              useRaysutReferenceLayout: false,
            }
          : current,
      );
      setApproved(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The image could not be read.");
    }
  }

  async function selectLogoImage(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0];
    event.target.value = "";
    if (!selected) return;
    setError("");
    try {
      const image = await readOriginalImage(selected);
      if (image.width < 128 || image.height < 128) {
        throw new Error("The dashboard logo must be at least 128 × 128 pixels.");
      }
      setReport((current) =>
        current
          ? {
              ...current,
              logoImage: image.dataUrl,
              logoImageSource: "original",
              logoImageWidth: image.width,
              logoImageHeight: image.height,
            }
          : current,
      );
      setApproved(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The logo could not be read.");
    }
  }

  async function selectPhoto(index: number, event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0];
    event.target.value = "";
    if (!selected || !report) return;
    setError("");
    try {
      const image = await readOriginalImage(selected);
      setReport((current) =>
        current
          ? {
              ...current,
              photos: current.photos.map((photo, itemIndex) =>
                itemIndex === index
                  ? {
                      ...photo,
                      focalX: 50,
                      focalY: 50,
                      dataUrl: image.dataUrl,
                      source: "original" as const,
                      width: image.width,
                      height: image.height,
                    }
                  : photo,
              ),
            }
          : current,
      );
      setApproved(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The image could not be read.");
    }
  }

  return (
    <main className="report-workspace">
      <header className="report-topbar">
        <div className="report-container report-topbar-inner">
          <Link to="/" aria-label="VIA project portal">
            <img src={viaLogo} width={2048} height={766} alt="VIA International" />
          </Link>
          <nav aria-label="Staff navigation">
            <Link to="/admin-projects">Manage projects</Link>
            <Link to="/projects">
              View portal <ArrowUpRight size={15} aria-hidden="true" />
            </Link>
          </nav>
        </div>
      </header>
      <div className="report-container report-page-heading">
        <p className="report-eyebrow">
          <LockKeyhole size={13} aria-hidden="true" /> VIA / STAFF WORKSPACE
        </p>
        <h1>{report ? "Build your project report." : "Create a project report."}</h1>
        <p>
          {report
            ? "Work through each step, then review before sharing with your client."
            : "From project figures to a clear, client-ready report. Choose how you want to begin."}
        </p>
      </div>

      <div
        className="report-container report-content"
        inert={!editorReady}
        aria-busy={!editorReady}
      >
        {!report && (
          <section className="report-start" aria-labelledby="start-heading">
            <div className="report-section-heading">
              <span className="report-eyebrow">LET’S GET STARTED</span>
              <h2 id="start-heading">How would you like to begin?</h2>
            </div>
            <div className="report-choice-grid">
              <button
                type="button"
                className="report-choice report-choice-featured"
                aria-label="Upload Excel / CSV"
                aria-expanded={importOpen}
                aria-controls="report-import-panel"
                onClick={() => setImportOpen((v) => !v)}
              >
                <span className="report-choice-top">
                  <span className="report-choice-icon">
                    <FileUp size={24} aria-hidden="true" />
                  </span>
                  <span className="report-choice-tag">HAVE YOUR FIGURES READY?</span>
                </span>
                <span className="report-choice-title">Upload Excel / CSV</span>
                <span className="report-choice-description">
                  Use our ready-to-fill template. Import your figures, then add your photographs and
                  layout.
                </span>
                <span className="report-choice-bottom">
                  {importOpen ? "Close import options" : "Choose a file or get the template"}
                  <ArrowRight size={19} aria-hidden="true" />
                </span>
              </button>
              <button
                type="button"
                className="report-choice"
                aria-label="Enter details manually"
                onClick={() => {
                  setReport(newManualReport());
                  setStep(0);
                  setShowAll(false);
                  setFile(null);
                  setCsvText("");
                  setError("");
                }}
              >
                <span className="report-choice-top">
                  <span className="report-choice-icon">
                    <PenLine size={24} aria-hidden="true" />
                  </span>
                  <span className="report-choice-tag">START FROM SCRATCH</span>
                </span>
                <span className="report-choice-title">Enter details manually</span>
                <span className="report-choice-description">
                  Add your project details step by step. No spreadsheet needed, and you can save at
                  any time.
                </span>
                <span className="report-choice-bottom">
                  Start a new report
                  <ArrowRight size={19} aria-hidden="true" />
                </span>
              </button>
            </div>
            <ol className="report-journey" aria-label="Your report journey">
              {steps.map((label, i) => (
                <li key={label}>
                  <span>{String(i + 1).padStart(2, "0")}</span>
                  {label}
                </li>
              ))}
            </ol>
          </section>
        )}
        <section
          className={report ? "report-drafts report-drafts-editing" : "report-drafts"}
          aria-label="Saved drafts"
        >
          <div className="report-drafts-intro">
            <FolderOpen size={22} aria-hidden="true" />
            <div>
              <h2>{report ? "Save your progress" : "Continue a saved draft"}</h2>
              <p>
                {report
                  ? "Save before leaving. Drafts are visible only to staff."
                  : "Pick up where you left off. Nothing is shared with clients until you publish."}
              </p>
            </div>
          </div>
          <div className="report-draft-actions">
            <button
              type="button"
              className="report-secondary-button"
              disabled={draftsLoading}
              onClick={async () => {
                try {
                  setDraftsLoading(true);
                  setDrafts(await listReportDrafts());
                  setDraftsLoaded(true);
                } catch (e) {
                  setError(e instanceof Error ? e.message : "Cannot load drafts");
                } finally {
                  setDraftsLoading(false);
                }
              }}
            >
              Load saved internal drafts
            </button>
            {report && (
              <button
                type="button"
                className="report-primary-button"
                onClick={async () => {
                  try {
                    await saveReportDraft({
                      data: { report, csv: csvText, fileName: file?.name || "manual-report.json" },
                    });
                    setError(
                      "Draft saved securely on the server. Client passwords are not saved in drafts.",
                    );
                  } catch (e) {
                    setError(e instanceof Error ? e.message : "Cannot save draft");
                  }
                }}
              >
                <Save size={15} aria-hidden="true" /> Save draft
              </button>
            )}
            {drafts.length > 0 && (
              <select
                aria-label="Saved draft"
                defaultValue=""
                onChange={async (e) => {
                  if (!e.target.value) return;
                  try {
                    const saved = await loadReportDraft({ data: { id: e.target.value } });
                    setReport(saved.report);
                    setStep(0);
                    setShowAll(false);
                    setCsvText(saved.csv);
                    setFile(
                      saved.fileName.endsWith(".json")
                        ? null
                        : new File([saved.csv], saved.fileName, { type: "text/csv" }),
                    );
                    setPreview(null);
                    setApproved(false);
                  } catch (e) {
                    setError(e instanceof Error ? e.message : "Cannot restore draft");
                  }
                }}
              >
                <option value="">Select saved draft</option>
                {drafts.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} — {d.savedAt}
                  </option>
                ))}
              </select>
            )}
          </div>
          {draftsLoaded && !drafts.length && (
            <p role="status" className="report-drafts-empty">
              No saved drafts yet. Start a report and use Save draft whenever you need a break.
            </p>
          )}
        </section>
        {report && (
          <button
            type="button"
            className="report-next-month"
            onClick={() => {
              if (
                window.confirm(
                  "Start a new month using this project setup? Save the current draft first. Monthly figures and photos will be cleared.",
                )
              ) {
                setReport(nextMonthlyReport(report));
                setStep(1);
                setShowAll(false);
                setFile(null);
                setCsvText("");
                setPreview(null);
                setError("");
              }
            }}
          >
            Start next month from this project setup
          </button>
        )}
        {error && (
          <p role="alert" className="mb-4 rounded border bg-white p-3 text-sm">
            {error}
          </p>
        )}

        {!report && importOpen && (
          <div id="report-import-panel" ref={importPanel} tabIndex={-1} className="report-import">
            <div className="report-section-heading">
              <span className="report-eyebrow">IMPORT YOUR FIGURES</span>
              <h2>Start with your spreadsheet.</h2>
              <p>
                Download a sample template, replace the figures, then upload your completed file.
              </p>
            </div>
            <div className="report-import-grid">
              <section className="report-template-card" aria-labelledby="template-step-title">
                <span className="report-import-step">STEP 01 · PREPARE</span>
                <h3 id="template-step-title">Download your template</h3>
                <p className="report-import-description">
                  Choose Excel or CSV. Both include sample figures to guide you.
                </p>
                <a
                  href="/templates/pdf-report-template.csv"
                  download="pdf-report-template.csv"
                  className="mt-4 flex min-h-11 items-center justify-center gap-2 rounded bg-brand px-4 py-3 text-sm text-white"
                >
                  <Download size={16} /> Download PDF CSV template
                </a>
                <a
                  href="/templates/pdf-report-template.xlsx"
                  download
                  className="mt-2 flex min-h-11 items-center justify-center gap-2 rounded border border-brand px-4 py-3 text-sm text-brand"
                >
                  <Download size={16} /> Download Excel template
                </a>
                <p className="report-template-note">
                  <strong>Replace the sample data before uploading.</strong> Leave unknown values
                  blank, not zero. You’ll add logos, your layout and photographs in the next step.
                </p>
                <div className="mt-2 flex gap-4 text-xs underline">
                  <a href="/templates/pdf-report-template-blank.xlsx" download>
                    Blank Excel template
                  </a>
                  <a href="/templates/pdf-report-template-blank.csv" download>
                    Blank CSV template
                  </a>
                </div>
                <details className="report-import-help">
                  <summary>How to fill in the template</summary>
                  <ul className="mt-4 list-disc space-y-2 pl-5 text-sm">
                    <li>
                      Fill <strong>value</strong> for project details, monthly figures, contract
                      amounts and photo captions.
                    </li>
                    <li>
                      For activities, enter the name in <strong>field</strong> and percentages in{" "}
                      <strong>planned</strong> and <strong>actual</strong>.
                    </li>
                    <li>
                      Keep section names, field names and the header unchanged. Leave unknown values
                      blank, not zero.
                    </li>
                    <li>
                      Dates: YYYY-MM-DD. Numbers: no % sign or currency. Format phone cells as Text
                      to preserve leading zeros.
                    </li>
                    <li>
                      Upload the logo, map, status drawing and four photographs after importing. No
                      S-curve image is needed when monthly schedule figures are supplied.
                    </li>
                  </ul>
                  <p className="mt-4 text-xs text-muted-foreground">
                    Instructions in the last column explain each row. Empty activity rows are
                    ignored. Older dashboard CSV files are still accepted.
                  </p>
                </details>
              </section>
              <section className="report-file-card" aria-labelledby="upload-step-title">
                <span className="report-import-step">STEP 02 · UPLOAD</span>
                <h3 id="upload-step-title">Add your completed spreadsheet</h3>
                <p className="report-import-description">
                  Choose one file. We’ll check your figures, then take you to Photos &amp; layout.
                </p>
                <div className="report-file-options">
                  <div className="report-file-option">
                    <FileUp aria-hidden="true" size={24} />
                    <div>
                      <label htmlFor="report-excel-file">Upload Excel file</label>
                      <p id="report-excel-help">.xlsx · your completed Excel template</p>
                      <input
                        id="report-excel-file"
                        aria-label="Upload Excel file"
                        aria-describedby="report-excel-help"
                        type="file"
                        accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                        onChange={selectFile}
                        disabled={working}
                      />
                    </div>
                  </div>
                  <div className="report-file-option">
                    <FileUp aria-hidden="true" size={24} />
                    <div>
                      <label htmlFor="report-csv-file">Upload CSV file</label>
                      <p id="report-csv-help">.csv · your completed CSV template</p>
                      <input
                        id="report-csv-file"
                        aria-label="Upload CSV file"
                        aria-describedby="report-csv-help"
                        type="file"
                        accept="text/csv,.csv"
                        onChange={selectFile}
                        disabled={working}
                      />
                    </div>
                  </div>
                </div>
                <details className="report-paste-option">
                  <summary>Or paste CSV text instead</summary>
                  <label htmlFor="report-csv-text" className="sr-only">
                    Completed report CSV
                  </label>
                  <textarea
                    id="report-csv-text"
                    value={csvText}
                    onChange={(event) => setCsvText(event.target.value)}
                    placeholder="Paste your completed PDF report CSV here"
                    rows={6}
                    className="mt-3 w-full border border-input p-3 font-mono text-[10px] leading-relaxed outline-none focus:border-brand"
                  />
                  <button
                    type="button"
                    onClick={() => processCsv(csvText)}
                    disabled={!csvText.trim() || working}
                    className="report-validate-button"
                  >
                    Validate pasted CSV
                  </button>
                </details>
                <p className="report-import-footnote">
                  Monthly schedule figures generate your graphs automatically. Images are added
                  separately.
                </p>
              </section>
            </div>
            {working && (
              <div className="mt-4 h-1 bg-border">
                <div
                  className="h-full bg-brand transition-all"
                  style={{ width: `${progress.percent}%` }}
                />
              </div>
            )}
          </div>
        )}

        {report && (
          <div className="report-editor space-y-5">
            <nav
              id="report-steps"
              tabIndex={-1}
              aria-label="Report steps"
              className="report-stepper scroll-mt-24"
            >
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold">
                  {showAll ? "All report fields" : `Step ${step + 1} of 4`}
                </p>
                <button
                  type="button"
                  className="text-sm text-brand underline"
                  onClick={() => setShowAll(!showAll)}
                >
                  {showAll ? "Use simple steps" : "Show all fields"}
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {steps.map((label, i) => (
                  <button
                    key={label}
                    type="button"
                    aria-current={!showAll && step === i ? "step" : undefined}
                    className={`rounded-lg border px-3 py-3 text-left text-sm ${step === i && !showAll ? "border-brand bg-brand text-white" : "bg-slate-50 text-brand"}`}
                    onClick={() => {
                      setShowAll(false);
                      goToStep(i);
                    }}
                  >
                    {i + 1}. {label}
                  </button>
                ))}
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                Move between steps anytime. Your entries stay here. Use Save draft before leaving
                the page.
              </p>
            </nav>

            <section className="report-editor-panel">
              <div className="flex items-start justify-between gap-4 border-b border-border pb-5">
                <div>
                  <div className="dashboard-eyebrow text-signal-ok">
                    {file
                      ? "CSV imported — complete any blank fields and upload images"
                      : "Manual report — complete and verify the project fields"}
                  </div>
                  <h2 className="mt-2 text-2xl font-bold text-brand">
                    {showAll ? "Your report" : steps[step]}
                  </h2>
                </div>
                <CheckCircle2 className="text-signal-ok" />
              </div>

              <div hidden={!showAll && step !== 0}>
                <p className="mt-4 text-sm text-muted-foreground">
                  Enter what is shown in your report. Leave unknown values blank; never guess.
                  Project details can be reused next month.
                </p>
                <SourceReportFields
                  report={report}
                  mode={showAll ? "all" : "setup"}
                  onChange={(patch) => {
                    setReport((current) =>
                      current
                        ? {
                            ...current,
                            ...patch,
                            ...(patch.projectName !== undefined &&
                            (current.slug === "new-project" ||
                              current.slug === makeSlug(current.projectName))
                              ? { slug: makeSlug(patch.projectName) }
                              : {}),
                          }
                        : current,
                    );
                    setApproved(false);
                  }}
                />
                <details open={showAll} className="mt-5 rounded border p-3">
                  <summary className="cursor-pointer text-sm font-semibold">
                    Optional: dashboard scope, pavement layers and trade statuses
                  </summary>

                  {
                    <>
                      <div className="mt-8">
                        <div className="dashboard-eyebrow">Scope quantities</div>
                        <div className="mt-3 overflow-x-auto border border-border">
                          <table className="w-full min-w-[560px] text-left text-xs">
                            <thead className="bg-[#eef1f4] font-mono uppercase tracking-wider text-muted-foreground">
                              <tr>
                                <th className="p-2">Label</th>
                                <th className="p-2">Value</th>
                                <th className="p-2">Unit</th>
                                <th className="p-2">Action</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                              {report.scope.map((entry, index) => (
                                <tr key={index}>
                                  {(["label", "value", "unit"] as const).map((key) => (
                                    <td key={key} className="p-2">
                                      <input
                                        value={entry[key]}
                                        onChange={(event) =>
                                          update(
                                            "scope",
                                            report.scope.map((item, itemIndex) =>
                                              itemIndex === index
                                                ? { ...item, [key]: event.target.value }
                                                : item,
                                            ),
                                          )
                                        }
                                        className="h-9 w-full border border-input px-2"
                                      />
                                    </td>
                                  ))}
                                  <td className="p-2">
                                    <button
                                      type="button"
                                      className="border px-2 py-1"
                                      onClick={() =>
                                        update(
                                          "scope",
                                          report.scope.filter((_, i) => i !== index),
                                        )
                                      }
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
                          className="mt-2 border p-2 text-sm"
                          disabled={report.scope.length >= 5}
                          onClick={() =>
                            update("scope", [...report.scope, { label: "", value: "", unit: "" }])
                          }
                        >
                          + Add scope item
                        </button>
                      </div>
                    </>
                  }

                  <div className="mt-8 grid gap-6 lg:grid-cols-2">
                    {
                      <>
                        <div>
                          <div className="dashboard-eyebrow">Pavement layers</div>
                          <div className="mt-3 space-y-2">
                            {report.layers.map((layer, index) => (
                              <div
                                key={index}
                                className="grid grid-cols-[.7fr_1.5fr_.7fr_auto] gap-2"
                              >
                                <input
                                  value={layer.code}
                                  aria-label={`Layer ${index + 1} code`}
                                  onChange={(event) =>
                                    update(
                                      "layers",
                                      report.layers.map((item, itemIndex) =>
                                        itemIndex === index
                                          ? { ...item, code: event.target.value }
                                          : item,
                                      ),
                                    )
                                  }
                                  className="h-9 min-w-0 border border-input px-2 text-xs"
                                />
                                <input
                                  value={layer.name}
                                  aria-label={`Layer ${index + 1} name`}
                                  onChange={(event) =>
                                    update(
                                      "layers",
                                      report.layers.map((item, itemIndex) =>
                                        itemIndex === index
                                          ? { ...item, name: event.target.value }
                                          : item,
                                      ),
                                    )
                                  }
                                  className="h-9 min-w-0 border border-input px-2 text-xs"
                                />
                                <input
                                  type="number"
                                  value={layer.thickness}
                                  aria-label={`Layer ${index + 1} thickness in millimetres`}
                                  onChange={(event) =>
                                    update(
                                      "layers",
                                      report.layers.map((item, itemIndex) =>
                                        itemIndex === index
                                          ? { ...item, thickness: Number(event.target.value) }
                                          : item,
                                      ),
                                    )
                                  }
                                  className="h-9 min-w-0 border border-input px-2 text-xs"
                                />
                                <button
                                  type="button"
                                  onClick={() =>
                                    update(
                                      "layers",
                                      report.layers.filter((_, itemIndex) => itemIndex !== index),
                                    )
                                  }
                                  className="px-2 font-mono text-[8px] uppercase text-signal-alert"
                                >
                                  Remove
                                </button>
                              </div>
                            ))}
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              update("layers", [
                                ...report.layers,
                                { code: "CODE", name: "Layer name", thickness: 1 },
                              ])
                            }
                            className="mt-2 font-mono text-[9px] font-bold uppercase tracking-widest text-brand"
                          >
                            + Add layer
                          </button>
                        </div>
                      </>
                    }

                    {
                      <>
                        <div>
                          <div className="dashboard-eyebrow">Independent trade statuses</div>
                          <div className="mt-3 space-y-2">
                            {report.trades.map((trade, index) => (
                              <div key={index} className="grid grid-cols-[1.5fr_1fr_auto] gap-2">
                                <input
                                  value={trade.name}
                                  aria-label={`Trade ${index + 1} name`}
                                  onChange={(event) =>
                                    update(
                                      "trades",
                                      report.trades.map((item, itemIndex) =>
                                        itemIndex === index
                                          ? { ...item, name: event.target.value }
                                          : item,
                                      ),
                                    )
                                  }
                                  className="h-9 min-w-0 border border-input px-2 text-xs"
                                />
                                <select
                                  value={trade.status}
                                  aria-label={`Trade ${index + 1} status`}
                                  onChange={(event) =>
                                    update(
                                      "trades",
                                      report.trades.map((item, itemIndex) =>
                                        itemIndex === index
                                          ? {
                                              ...item,
                                              status: event.target
                                                .value as ExtractedReport["trades"][number]["status"],
                                            }
                                          : item,
                                      ),
                                    )
                                  }
                                  className="h-9 min-w-0 border border-input bg-white px-2 text-xs"
                                >
                                  <option value="complete">Complete</option>
                                  <option value="active">Active</option>
                                  <option value="behind">Behind</option>
                                  <option value="notstarted">Not started</option>
                                  <option value="unknown">Not reported / unknown</option>
                                </select>
                                <button
                                  type="button"
                                  onClick={() =>
                                    update(
                                      "trades",
                                      report.trades.filter((_, itemIndex) => itemIndex !== index),
                                    )
                                  }
                                  className="px-2 font-mono text-[8px] uppercase text-signal-alert"
                                >
                                  Remove
                                </button>
                              </div>
                            ))}
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              update("trades", [
                                ...report.trades,
                                { name: "Trade name", status: "active" },
                              ])
                            }
                            className="mt-2 font-mono text-[9px] font-bold uppercase tracking-widest text-brand"
                          >
                            + Add trade
                          </button>
                        </div>
                      </>
                    }
                  </div>
                </details>
              </div>
              <div hidden={!showAll && step !== 1}>
                {!showAll && (
                  <MonthlyReportFields
                    report={report}
                    onChange={(patch) => {
                      setReport((current) => (current ? { ...current, ...patch } : current));
                      setApproved(false);
                    }}
                  />
                )}
                <p className="mt-4 text-sm text-muted-foreground">
                  Enter activity progress below. Monthly schedule figures are needed for the
                  interactive dashboard; the PDF can use an uploaded chart picture instead.
                </p>
                <details open={showAll} className="mt-5 rounded border p-3">
                  <summary className="cursor-pointer text-sm font-semibold">
                    Optional for PDF: monthly schedule for the interactive dashboard
                  </summary>
                  <ProgressScheduleEditor
                    rows={report.schedule}
                    onChange={(rows) =>
                      setReport({ ...report, schedule: rows, chartSource: "table" })
                    }
                  />
                </details>

                <div className="mt-8">
                  <div className="dashboard-eyebrow">Major activities</div>
                  <div className="mt-3 overflow-x-auto border border-border">
                    <table className="w-full min-w-[560px] text-left text-xs">
                      <thead className="bg-[#eef1f4] font-mono uppercase tracking-wider text-muted-foreground">
                        <tr>
                          <th className="p-2">Activity</th>
                          <th className="p-2">Plan %</th>
                          <th className="p-2">Actual %</th>
                          <th className="p-2">Variance</th>
                          <th className="p-2"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {report.activities.map((activity, index) => (
                          <tr key={index}>
                            <td className="p-2">
                              <input
                                value={activity.name}
                                onChange={(event) =>
                                  update(
                                    "activities",
                                    report.activities.map((item, itemIndex) =>
                                      itemIndex === index
                                        ? { ...item, name: event.target.value }
                                        : item,
                                    ),
                                  )
                                }
                                className="h-9 w-full border border-input px-2"
                              />
                            </td>
                            <td className="p-2">
                              <input
                                type="number"
                                step="0.01"
                                value={activity.planned ?? ""}
                                onChange={(event) => {
                                  const planned =
                                    event.target.value === "" ? null : Number(event.target.value);
                                  update(
                                    "activities",
                                    report.activities.map((item, itemIndex) =>
                                      itemIndex === index
                                        ? {
                                            ...item,
                                            planned,
                                            diff:
                                              item.actual === null || planned === null
                                                ? null
                                                : Number((item.actual - planned).toFixed(2)),
                                          }
                                        : item,
                                    ),
                                  );
                                }}
                                className="h-9 w-20 border border-input px-2"
                              />
                            </td>
                            <td className="p-2">
                              <input
                                type="number"
                                step="0.01"
                                value={activity.actual ?? ""}
                                onChange={(event) => {
                                  const actual =
                                    event.target.value === "" ? null : Number(event.target.value);
                                  update(
                                    "activities",
                                    report.activities.map((item, itemIndex) =>
                                      itemIndex === index
                                        ? {
                                            ...item,
                                            actual,
                                            diff:
                                              actual === null || item.planned === null
                                                ? null
                                                : Number((actual - item.planned).toFixed(2)),
                                          }
                                        : item,
                                    ),
                                  );
                                }}
                                className="h-9 w-20 border border-input px-2"
                              />
                            </td>
                            <td className="p-2 font-mono">
                              {activity.diff === null ? "—" : activity.diff.toFixed(2)}
                            </td>
                            <td className="p-2">
                              <button
                                type="button"
                                onClick={() =>
                                  update(
                                    "activities",
                                    report.activities.filter((_, itemIndex) => itemIndex !== index),
                                  )
                                }
                                className="font-mono text-[9px] uppercase text-signal-alert"
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
                    onClick={() =>
                      update("activities", [
                        ...report.activities,
                        { name: "New activity", planned: 0, actual: 0, diff: 0 },
                      ])
                    }
                    className="mt-2 font-mono text-[9px] font-bold uppercase tracking-widest text-brand"
                  >
                    + Add activity
                  </button>
                </div>
              </div>
              <div hidden={!showAll && step !== 2}>
                <div className="mt-8">
                  <div className="dashboard-eyebrow">Dashboard logo</div>
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                    Upload the original logo. It will be contained inside the existing header logo
                    area without stretching or cropping. A transparent PNG is recommended.
                  </p>
                  <div className="mt-3 flex items-center gap-4 border border-border p-3">
                    <div className="relative grid size-28 shrink-0 place-items-center bg-[#eef1f4] p-2">
                      {report.logoImageSource === "original" ? (
                        <img
                          src={report.logoImage}
                          alt="Dashboard logo preview"
                          className="size-full object-contain"
                        />
                      ) : (
                        <p className="p-4 text-sm text-slate-500">
                          Your logo preview will appear here.
                        </p>
                      )}
                      <span
                        className={`absolute bottom-1 left-1 px-2 py-1 font-mono text-[8px] font-bold uppercase tracking-wider text-white ${
                          report.logoImageSource === "original" ? "bg-signal-ok" : "bg-signal-alert"
                        }`}
                      >
                        {report.logoImageSource === "original"
                          ? "Original uploaded"
                          : "Awaiting original"}
                      </span>
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col items-start gap-3">
                      <span className="text-xs text-muted-foreground">
                        {report.logoImageWidth} × {report.logoImageHeight} px · displayed
                        proportionally
                      </span>
                      <div className="w-full min-w-0">
                        Upload logo
                        <UploadField
                          aria-label="Dashboard logo file"
                          accept="image/jpeg,image/png,image/webp"
                          onChange={selectLogoImage}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-8">
                  <div className="dashboard-eyebrow">Project layout</div>
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                    Upload a map, site plan or building layout. The same image appears in your
                    dashboard and PDF, without stretching. It is kept for next month; replace it
                    whenever needed. JPG, PNG or WebP, up to 15 MB.
                  </p>

                  <div className="mt-3 border border-border p-3">
                    <div className="relative overflow-hidden bg-[#eef1f4]">
                      {report.layoutImageSource === "original" ? (
                        <img
                          src={report.layoutImage}
                          alt="Project layout"
                          className="aspect-[2/1] w-full object-contain"
                        />
                      ) : (
                        <p className="rounded bg-slate-50 px-5 py-12 text-center text-sm text-slate-500">
                          Your project map preview will appear here.
                        </p>
                      )}
                      <span
                        className={`absolute left-2 top-2 px-2 py-1 font-mono text-[9px] font-bold uppercase tracking-wider text-white ${
                          report.layoutImageSource === "original"
                            ? "bg-signal-ok"
                            : "bg-signal-alert"
                        }`}
                      >
                        {report.layoutImageSource === "original"
                          ? "Original uploaded"
                          : "Awaiting original"}
                      </span>
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-3">
                      <span className="text-xs text-muted-foreground">
                        {report.layoutImageWidth} × {report.layoutImageHeight} px
                      </span>
                      <div className="w-full min-w-0">
                        Upload project layout image
                        <UploadField
                          aria-label="Project map image"
                          accept="image/jpeg,image/png,image/webp"
                          onChange={selectLayoutImage}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-8">
                  <div className="dashboard-eyebrow">Four construction photographs</div>
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                    Upload each original photograph into its numbered position and confirm its
                    caption. JPG, PNG, or WebP; maximum 15 MB. At least 800 × 600 pixels is
                    recommended, but smaller original photographs are accepted.
                  </p>
                  <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {report.photos.map((photo, index) => (
                      <div key={index} className="border border-border p-2">
                        <div className="relative">
                          {photo.source === "original" ? (
                            <img
                              src={photo.dataUrl}
                              alt={photo.caption}
                              className="aspect-[4/3] w-full bg-[#eef1f4] object-cover"
                              style={{
                                aspectRatio: PDF_PHOTO_RATIOS[index] ?? 4 / 3,
                                objectFit: photoPresentation(photo).fit,
                                objectPosition: `${photoPresentation(photo).x}% ${photoPresentation(photo).y}%`,
                              }}
                            />
                          ) : (
                            <div className="grid aspect-[4/3] w-full place-items-center rounded bg-slate-50 px-6 text-center text-sm text-slate-500">
                              No photograph yet.
                              <br />
                              Choose your image below.
                            </div>
                          )}
                          <span className="absolute left-2 top-2 bg-brand px-2 py-1 font-mono text-[9px] font-bold uppercase tracking-wider text-white">
                            Photo {index + 1}
                          </span>
                          <span
                            className={`absolute bottom-2 left-2 px-2 py-1 font-mono text-[8px] font-bold uppercase tracking-wider text-white ${
                              photo.source === "original" ? "bg-signal-ok" : "bg-signal-alert"
                            }`}
                          >
                            {photo.source === "original"
                              ? "Original uploaded"
                              : "Awaiting original"}
                          </span>
                        </div>
                        <p className="mt-1 text-[10px] text-muted-foreground">
                          PDF frame preview. Check the dashboard preview for its separate frame
                          shape.
                        </p>
                        <PhotoFitControls
                          photo={photo}
                          index={index}
                          onChange={(next) =>
                            update(
                              "photos",
                              report.photos.map((item, i) => (i === index ? next : item)),
                            )
                          }
                        />
                        <input
                          value={photo.caption}
                          onChange={(event) =>
                            update(
                              "photos",
                              report.photos.map((item, itemIndex) =>
                                itemIndex === index
                                  ? { ...item, caption: event.target.value }
                                  : item,
                              ),
                            )
                          }
                          aria-label={`Caption for photo ${index + 1}`}
                          placeholder={`Caption for photo ${index + 1}`}
                          className="mt-2 h-9 w-full border border-input px-2 text-xs"
                        />
                        {photo.sub && !/^not provided$/i.test(photo.sub) && (
                          <input
                            value={photo.sub}
                            onChange={(event) =>
                              update(
                                "photos",
                                report.photos.map((item, itemIndex) =>
                                  itemIndex === index ? { ...item, sub: event.target.value } : item,
                                ),
                              )
                            }
                            aria-label={`Secondary description for photo ${index + 1}`}
                            placeholder={`Secondary description for photo ${index + 1}`}
                            className="mt-2 h-9 w-full border border-input px-2 text-xs"
                          />
                        )}
                        <div className="mt-2 flex items-center justify-between gap-2">
                          <span className="text-[10px] text-muted-foreground">
                            {photo.width} × {photo.height} px
                          </span>
                          <div className="w-full min-w-0">
                            Upload original
                            <UploadField
                              aria-label={`Upload photograph ${index + 1}`}
                              accept="image/jpeg,image/png,image/webp"
                              onChange={(event) => selectPhoto(index, event)}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <section className="mt-6 rounded border p-4">
                  {" "}
                  <h3 className="mt-4 font-bold">
                    Status of key project activities — source drawing
                  </h3>
                  <p className="text-xs">
                    Required for the lower drawing panel in your PDF. Upload the drawing as a
                    picture; it does not replace the web dashboard’s trade statuses.
                  </p>
                  <UploadField
                    aria-label="Activity-status drawing"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      e.target.value = "";
                      if (!file) return;
                      try {
                        const image = await readOriginalImage(file);
                        update("activityStatusImage", image.dataUrl);
                      } catch (error) {
                        setError(error instanceof Error ? error.message : "Drawing upload failed");
                      }
                    }}
                  />
                  {report.activityStatusImage && (
                    <img
                      src={report.activityStatusImage}
                      alt="Activity-status drawing preview"
                      className="max-h-48 w-full object-contain"
                    />
                  )}
                </section>
                <HeaderLogosEditor
                  logos={report.headerLogos ?? []}
                  onChange={(logos) => update("headerLogos", logos)}
                />
              </div>
              <div hidden={!showAll && step !== 3}>
                <SalalahPdfPanel
                  report={report}
                  onLogo={(url) => update("printClientLogo", url)}
                  onChartMode={(mode) => update("printChartMode", mode)}
                  onChartImage={(url) => update("printChartImage", url)}
                  onMapFraming={(changes) =>
                    setReport((current) => (current ? { ...current, ...changes } : current))
                  }
                  onTitle={(title) => update("printTitle", title)}
                />
                <details open={showAll} className="mt-5 rounded-lg border p-4">
                  <summary className="cursor-pointer font-semibold">
                    Optional: share a password-protected client dashboard
                  </summary>
                  {issues.length > 0 && (
                    <div className="mt-7 border border-signal-alert/30 bg-signal-alert/5 p-4">
                      <div className="dashboard-eyebrow text-signal-alert">
                        Before sharing the client dashboard
                      </div>
                      <p className="mt-2 text-xs">
                        These checks apply to the web dashboard. You can generate the PDF separately
                        below.
                      </p>
                      <ul className="mt-2 space-y-1 text-xs text-signal-alert">
                        {issues.map((issue) => (
                          <li key={issue}>· {issue}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="mt-7 border-t border-border pt-7">
                    <section className="mb-5 space-y-3 border p-4">
                      <h3 className="font-bold">Supporting source information</h3>
                      <h3 className="mt-4 font-bold">
                        Additional source information / review notes
                      </h3>
                      {report.details.map((detail, index) => (
                        <div key={index} className="grid grid-cols-3 gap-2">
                          {(["label", "value", "unit"] as const).map((key) => (
                            <Field
                              key={key}
                              label={key}
                              value={detail[key]}
                              onChange={(value) =>
                                update(
                                  "details",
                                  report.details.map((d, i) =>
                                    i === index ? { ...d, [key]: value } : d,
                                  ),
                                )
                              }
                            />
                          ))}
                        </div>
                      ))}
                      <button
                        type="button"
                        className="border p-2 text-sm"
                        onClick={() =>
                          update("details", [
                            ...report.details,
                            { label: "Additional source field", value: "Not provided", unit: "" },
                          ])
                        }
                      >
                        Add another source field
                      </button>
                      <div className="w-full min-w-0">
                        Additional source attachments
                        <UploadField
                          aria-label="Additional source attachments"
                          accept="image/png,image/jpeg,image/webp"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            e.target.value = "";
                            if (file)
                              try {
                                const image = await readOriginalImage(file);
                                setReport((current) =>
                                  current
                                    ? {
                                        ...current,
                                        attachments: [
                                          ...current.attachments,
                                          { label: file.name, ...image },
                                        ],
                                      }
                                    : current,
                                );
                              } catch (error) {
                                setError(
                                  error instanceof Error ? error.message : "Attachment failed",
                                );
                              }
                          }}
                        />
                      </div>
                      {report.attachments.map((attachment, index) => (
                        <Field
                          key={index}
                          label={`Attachment ${index + 1} caption`}
                          value={attachment.label}
                          onChange={(value) =>
                            update(
                              "attachments",
                              report.attachments.map((a, i) =>
                                i === index ? { ...a, label: value } : a,
                              ),
                            )
                          }
                        />
                      ))}
                      <ReportDetails details={report.details} attachments={report.attachments} />
                    </section>
                    <h3 className="mt-6 font-bold">
                      Project access settings — not extracted from the PDF
                    </h3>
                    <div className="mt-3 grid gap-4 sm:grid-cols-2">
                      <Field
                        label="Project URL"
                        value={report.slug}
                        onChange={(value) => update("slug", makeSlug(value))}
                      />
                      <label className="text-sm">
                        <input
                          type="checkbox"
                          checked={replaceExisting}
                          onChange={(e) => setReplaceExisting(e.target.checked)}
                        />{" "}
                        Add a report to this existing project URL. Previous reports are retained;
                        this password replaces client access.
                      </label>
                      <Field
                        label="Client dashboard password"
                        type="password"
                        value={clientPassword}
                        onChange={setClientPassword}
                      />
                    </div>
                    {dashboardCoverageWarnings(report).length > 0 && (
                      <section className="mt-4 border border-amber-400 bg-amber-50 p-4 text-sm">
                        <h3 className="font-semibold">Dashboard completeness review</h3>
                        <p className="mt-2">
                          These items will show as not reported or remain incomplete. Check the PDF
                          and correct them above, or confirm they are genuinely absent. A successful
                          CSV import does not verify the source figures.
                        </p>
                        <ul className="mt-2 list-disc pl-5">
                          {dashboardCoverageWarnings(report).map((warning) => (
                            <li key={warning}>{warning}</li>
                          ))}
                        </ul>
                      </section>
                    )}
                    <button
                      type="button"
                      onClick={showPreview}
                      disabled={working || issues.length > 0}
                      className="mt-5 border border-brand px-5 py-3 disabled:opacity-40"
                    >
                      {working ? "Processing…" : "Generate exact dashboard preview"}
                    </button>
                    {previewCurrent && preview && (
                      <div className="mt-4">
                        <button
                          type="button"
                          className="mb-2 border border-brand px-3 py-2 text-sm"
                          onClick={() => {
                            void previewFrame.current
                              ?.requestFullscreen()
                              .catch(() =>
                                setError(
                                  "Fullscreen is unavailable in this browser. Review the embedded preview.",
                                ),
                              );
                          }}
                        >
                          View dashboard full screen
                        </button>
                        <iframe
                          ref={previewFrame}
                          srcDoc={preview.html}
                          title="Exact dashboard approval preview"
                          sandbox="allow-scripts"
                          allowFullScreen
                          className="mt-4 w-full border"
                          style={{ aspectRatio: "16 / 9", height: "auto" }}
                        />
                      </div>
                    )}

                    {!previewCurrent && (
                      <p className="mt-3 text-sm">
                        Resolve validation issues, then generate and review the dashboard preview
                        before approving.
                      </p>
                    )}
                    <label className="mt-5 flex cursor-pointer items-start gap-3 border border-border p-4 text-sm leading-relaxed">
                      <input
                        type="checkbox"
                        checked={approved}
                        disabled={!previewCurrent || working}
                        onChange={(event) => setApproved(event.target.checked)}
                        className="mt-1"
                      />
                      <span>
                        I compared the CSV fields with the source report, uploaded the original
                        logo, project layout and four correctly labelled photographs, reviewed the
                        exact dashboard preview, and approve this report for client publication.
                      </span>
                    </label>
                    <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                      <button
                        type="button"
                        onClick={() => {
                          setReport(null);
                          setFile(null);
                          setCsvText("");
                        }}
                        className="h-12 border border-brand px-5 font-mono text-[10px] font-bold uppercase tracking-widest text-brand"
                      >
                        Import another CSV
                      </button>
                      <button
                        type="button"
                        onClick={publish}
                        disabled={
                          working ||
                          !approved ||
                          issues.length > 0 ||
                          clientPassword.length < 8 ||
                          !previewCurrent
                        }
                        className="flex h-12 flex-1 items-center justify-center gap-3 bg-brand px-5 font-mono text-[10px] font-bold uppercase tracking-widest text-white disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <ShieldCheck size={16} />
                        {working ? progress.message : "Approve and create project"}
                      </button>
                    </div>
                  </div>
                </details>
              </div>
              {!showAll && (
                <div className="report-step-actions">
                  <button
                    type="button"
                    disabled={step === 0}
                    onClick={() => goToStep(step - 1)}
                    className="rounded border px-5 py-3 text-sm disabled:opacity-30"
                  >
                    Back
                  </button>
                  <span className="text-xs text-muted-foreground">{step + 1} / 4</span>
                  {step < 3 ? (
                    <button
                      type="button"
                      onClick={() => goToStep(step + 1)}
                      className="rounded bg-brand px-5 py-3 text-sm text-white"
                    >
                      Continue: {steps[step + 1]}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => goToStep(0)}
                      className="rounded border px-5 py-3 text-sm"
                    >
                      Edit project details
                    </button>
                  )}
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
