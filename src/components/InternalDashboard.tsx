import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import * as Dialog from "@radix-ui/react-dialog";
import {
  ArrowDownToLine,
  ArrowRight,
  Building2,
  CalendarDays,
  CheckCircle2,
  FileSpreadsheet,
  LockKeyhole,
  Upload,
  Users,
  X,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import viaLogo from "@/assets/via-official-logo.png";
import {
  getInternalAccess,
  getInternalSnapshots,
  getInternalSnapshot,
  importInternalWorkbook,
  approveInternalImport,
  exportInternalOverview,
} from "@/lib/internal.functions";
import {
  elapsedPercent,
  formatMoney,
  internalSummary,
  sumKnownMoney,
  type InternalProject,
  type InternalReport,
} from "@/lib/internal.types";
import "./internal-dashboard.css";

const tabs = [
  "Overview",
  "Projects",
  "Invoicing",
  "People & resources",
  "Review & sources",
] as const;
type Tab = (typeof tabs)[number];
const sourceLabel = (s: { sheet: string; cell: string }) => `${s.sheet}!${s.cell}`;
function Header() {
  return (
    <header className="internal-header">
      <Link to="/admin-projects">
        <img src={viaLogo} alt="VIA International" width="2048" height="766" />
      </Link>
      <span>
        <LockKeyhole size={14} /> PRIVATE COMPANY WORKSPACE
      </span>
      <Link to="/admin-projects">
        Client reports <ArrowRight size={15} />
      </Link>
    </header>
  );
}
export function InternalDashboard() {
  const cache = useQueryClient();
  const access = useQuery({
    queryKey: ["internal-access"],
    queryFn: () => getInternalAccess(),
    gcTime: 0,
    staleTime: 0,
    retry: false,
    refetchOnMount: "always",
    refetchOnWindowFocus: "always",
    refetchInterval: 30_000,
  });
  useEffect(() => {
    if (access.isError || access.data?.authorized === false)
      cache.removeQueries({ queryKey: ["internal"] });
  }, [access.isError, access.data, cache]);
  return (
    <main className="internal-workspace">
      <Header />
      {access.data?.authorized && !access.isError ? (
        <Workspace />
      ) : (
        <section className="internal-restricted">
          <LockKeyhole size={32} />
          <h1>{access.isPending ? "Checking access…" : "Restricted internal workspace"}</h1>
          <p>
            {access.isPending
              ? "Verifying your VIA Portal role."
              : "Only administrators of the main VIA Portal can access company financial information. Projects access alone does not grant this permission."}
          </p>
          <Link to="/admin-projects">Back to project administration</Link>
        </section>
      )}
    </main>
  );
}
function Workspace() {
  const cache = useQueryClient();
  const history = useQuery({
    queryKey: ["internal", "history"],
    queryFn: () => getInternalSnapshots(),
    retry: false,
    gcTime: 0,
  });
  const [selected, setSelected] = useState("");
  const [tab, setTab] = useState<Tab>("Overview");
  const [showImport, setShowImport] = useState(false);
  const [asOf, setAsOf] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [reviewed, setReviewed] = useState(false);
  const [country, setCountry] = useState("");
  const [projectFilter, setProjectFilter] = useState("");
  const [search, setSearch] = useState("");
  const [detail, setDetail] = useState<InternalProject | null>(null);
  const id = selected || history.data?.find((s) => s.state === "approved")?.id || "";
  const snapshot = useQuery({
    queryKey: ["internal", "snapshot", id],
    queryFn: () => getInternalSnapshot({ data: { id } }),
    enabled: !!id,
    retry: false,
    gcTime: 0,
  });
  const s = snapshot.data;
  const report = s?.report;
  const previousId =
    history.data?.find(
      (h) =>
        h.state === "approved" &&
        h.id !== id &&
        s &&
        (h.asOf < s.asOf || (h.asOf === s.asOf && h.createdAt < s.createdAt)),
    )?.id || "";
  const previous = useQuery({
    queryKey: ["internal", "snapshot", previousId],
    queryFn: () => getInternalSnapshot({ data: { id: previousId } }),
    enabled: !!previousId && tab === "Review & sources",
    retry: false,
    gcTime: 0,
  });
  useEffect(() => {
    setReviewed(false);
    setCountry("");
    setProjectFilter("");
    setSearch("");
    setDetail(null);
  }, [id]);
  const summary = useMemo(() => (report ? internalSummary(report) : null), [report]);
  const projectName = (projectId: string) =>
    report?.projects.find((p) => p.id === projectId)?.name || projectId;
  const projects =
    report?.projects.filter(
      (p) =>
        (!country || p.country === country) &&
        (!projectFilter || p.id === projectFilter) &&
        `${p.name} ${p.code} ${p.client}`.toLowerCase().includes(search.toLowerCase()),
    ) || [];
  const projectIds = new Set(projects.map((p) => p.id));
  const invoices = report?.invoices.filter((i) => projectIds.has(i.projectId)) || [];
  const staff = report?.staff.filter((i) => projectIds.has(i.projectId)) || [];
  async function importFile() {
    if (!file || !asOf) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (file.size > 10 * 1024 * 1024)
        throw new Error("Choose an Excel workbook no larger than 10 MB.");
      const base64 = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result).split(",")[1] || "");
        r.onerror = () => reject(new Error("Cannot read this file."));
        r.readAsDataURL(file);
      });
      const result = await importInternalWorkbook({ data: { fileName: file.name, asOf, base64 } });
      await cache.invalidateQueries({ queryKey: ["internal", "history"] });
      setSelected(result.id);
      setTab("Review & sources");
      setShowImport(false);
      setMessage(
        result.state === "approved"
          ? "This exact workbook and reporting date are already approved. No duplicate was created."
          : "Workbook saved privately as a draft. Review the data and source warnings before approval.",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed.");
    } finally {
      setBusy(false);
    }
  }
  async function approve() {
    if (!s || !reviewed) return;
    setBusy(true);
    setError("");
    try {
      await approveInternalImport({ data: { id: s.id, sha256: s.sha256, reviewed: true } });
      await cache.invalidateQueries({ queryKey: ["internal"] });
      setTab("Overview");
      setMessage("Internal snapshot approved. No client report or public project was changed.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Approval failed.");
    } finally {
      setBusy(false);
    }
  }
  async function download() {
    if (!s) return;
    setBusy(true);
    setError("");
    try {
      const result = await exportInternalOverview({ data: { id: s.id } });
      const url = URL.createObjectURL(
        new Blob(["\uFEFF", result.csv], { type: "text/csv;charset=utf-8" }),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = result.fileName;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="internal-container">
      <section className="internal-title">
        <div>
          <p className="internal-eyebrow">VIA INTERNATIONAL / INTERNAL INTELLIGENCE</p>
          <h1>
            One company.
            <br />
            <span>A clear overview.</span>
          </h1>
          <p>Projects, people and invoicing — together, in one private workspace.</p>
        </div>
        <div className="internal-title-actions">
          <span className="internal-access-badge">
            <LockKeyhole size={13} /> Portal administrators only
          </span>
          <button className="internal-primary" onClick={() => setShowImport((v) => !v)}>
            <Upload size={16} /> Upload monthly Excel
          </button>
        </div>
      </section>
      {error && (
        <p role="alert" className="internal-alert">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="internal-message">
          {message}
        </p>
      )}
      {history.isError && (
        <p role="alert" className="internal-alert">
          {history.error.message}
        </p>
      )}
      {snapshot.isError && (
        <p role="alert" className="internal-alert">
          {snapshot.error.message}
        </p>
      )}
      {showImport && (
        <section className="internal-panel internal-import">
          <div>
            <p className="internal-eyebrow">01 UPLOAD · 02 REVIEW · 03 APPROVE</p>
            <h2>Update your internal dashboard</h2>
            <p>
              Use the supervision workbook with Dashboard, AFRICA, Summary Monthly and project IPC
              sheets. This import never updates client reports.
            </p>
          </div>
          <div className="internal-import-fields">
            <label>
              Reporting date
              <input type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} />
              <small>Calculations use this date, not today.</small>
            </label>
            <label className="internal-file">
              <FileSpreadsheet size={24} />
              <strong>{file?.name || "Choose your Excel workbook"}</strong>
              <span>.xlsx · up to 10 MB · private upload</span>
              <input
                type="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                aria-label="Internal Excel workbook"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
            </label>
            <button
              className="internal-primary"
              disabled={busy || !asOf || !file}
              onClick={() => void importFile()}
            >
              {busy ? "Reading workbook…" : "Review workbook"}
              <ArrowRight size={16} />
            </button>
          </div>
        </section>
      )}
      <div className="internal-snapshot-bar">
        <label>
          <CalendarDays size={16} /> Reporting snapshot
          <select
            aria-label="Reporting snapshot"
            value={id}
            onChange={(e) => setSelected(e.target.value)}
          >
            <option value="">Choose a snapshot</option>
            {history.data?.map((h) => (
              <option key={h.id} value={h.id}>
                {h.asOf} · {h.state} · {h.fileName}
              </option>
            ))}
          </select>
        </label>
        {s && (
          <>
            <span className={`internal-state ${s.state}`}>
              {s.state === "approved" ? "Approved internal snapshot" : "Draft · not approved"}
            </span>
            <button onClick={() => void download()} disabled={busy || s.state !== "approved"}>
              <ArrowDownToLine size={15} /> Export overview
            </button>
          </>
        )}
      </div>
      {!report && !snapshot.isFetching && (
        <section className="internal-empty internal-panel">
          <Building2 size={38} />
          <h2>Your company dashboard starts here.</h2>
          <p>
            Upload the supervision Excel workbook, review any differences and approve your first
            reporting snapshot. Nothing here is visible to clients.
          </p>
          <button className="internal-primary" onClick={() => setShowImport(true)}>
            Upload your first workbook <ArrowRight size={16} />
          </button>
        </section>
      )}
      {snapshot.isFetching && <p role="status">Loading private snapshot…</p>}
      {report && summary && s && (
        <>
          {s.state === "draft" && (
            <p className="internal-draft-note">
              You are previewing an unapproved import. Known totals may be partial. Review every
              warning before approving.
            </p>
          )}
          <nav className="internal-tabs" aria-label="Internal dashboard sections">
            {tabs.map((t) => (
              <button
                key={t}
                aria-current={tab === t ? "page" : undefined}
                onClick={() => setTab(t)}
              >
                {t}
                {t === "Review & sources" && <span>{report.issues.length}</span>}
              </button>
            ))}
          </nav>
          {tab === "Overview" && (
            <>
              <div className="internal-metrics">
                <Metric
                  label="Projects in workbook"
                  value={String(report.projects.length)}
                  sub={`${new Set(report.projects.map((p) => p.country)).size} countries · includes future starts`}
                  onClick={() => setTab("Projects")}
                />
                <Metric
                  label="VIA contract value · OMR"
                  value={formatMoney(summary.viaValue)}
                  sub="Known Oman values only"
                  onClick={() => setTab("Projects")}
                />
                <Metric
                  label="Invoiced · OMR"
                  value={formatMoney(summary.invoiced)}
                  sub="Detailed invoice rows through reporting month"
                  onClick={() => setTab("Invoicing")}
                />
                <Metric
                  label="Unpaid invoices · OMR"
                  value={formatMoney(summary.outstanding)}
                  sub="Known balances · not an overdue-age measure"
                  alert
                  onClick={() => setTab("Invoicing")}
                />
                <Metric
                  label="Unbilled amounts · OMR"
                  value={formatMoney(summary.unbilled)}
                  sub="Explicit unbilled entries only"
                  onClick={() => setTab("Invoicing")}
                />
                <Metric
                  label="Dated active assignments"
                  value={String(summary.activeStaff)}
                  sub={`Omanization: ${summary.omanization === null ? "unknown" : summary.omanization.toFixed(1) + "%"} of classified active assignments`}
                  onClick={() => setTab("People & resources")}
                />
              </div>
              <p className="internal-data-note">
                {summary.incompleteInvoices
                  ? `${summary.incompleteInvoices} invoice rows have unknown amounts. Totals are partial. `
                  : ""}
                Retention and unconfirmed international currencies are excluded. Figures are not
                profit, revenue recognition or a cash-flow statement.
              </p>
              <div className="internal-overview-grid">
                <section className="internal-panel">
                  <div className="internal-panel-heading">
                    <div>
                      <p className="internal-eyebrow">BILLING PERFORMANCE</p>
                      <h2>Monthly invoicing</h2>
                    </div>
                    <span>OMR</span>
                  </div>
                  <p className="internal-muted">
                    Invoiced and unpaid balances grouped by invoice period, not payment receipt
                    date.
                  </p>
                  {summary.series.length ? (
                    <div className="internal-chart">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={summary.series.map((m) => ({
                            ...m,
                            invoiced: m.invoiced === null ? null : Number(m.invoiced),
                            outstanding: m.outstanding === null ? null : Number(m.outstanding),
                          }))}
                        >
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="period" tick={{ fontSize: 10 }} />
                          <YAxis
                            tick={{ fontSize: 10 }}
                            tickFormatter={(v) => `${Number(v) / 1000}k`}
                          />
                          <Tooltip
                            formatter={(v) =>
                              Number(v).toLocaleString("en-OM", {
                                minimumFractionDigits: 3,
                                maximumFractionDigits: 3,
                              })
                            }
                          />
                          <Legend />
                          <Bar
                            isAnimationActive={false}
                            dataKey="invoiced"
                            name="Invoiced"
                            fill="#07558f"
                            radius={[3, 3, 0, 0]}
                          />
                          <Bar
                            isAnimationActive={false}
                            dataKey="outstanding"
                            name="Still unpaid"
                            fill="#dc574c"
                            radius={[3, 3, 0, 0]}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <p>No dated invoice rows are available.</p>
                  )}
                </section>
                <section className="internal-panel internal-attention">
                  <p className="internal-eyebrow">FOLLOW UP</p>
                  <h2>Needs your attention</h2>
                  <Attention
                    value={report.projects.filter((p) => /pending/i.test(p.eot)).length}
                    label="Pending contract extensions"
                    onClick={() => setTab("Projects")}
                  />
                  <Attention
                    value={
                      report.staff.filter(
                        (p) =>
                          p.end &&
                          p.end >= report.asOf &&
                          Date.parse(p.end) - Date.parse(report.asOf) <= 60 * 86400000,
                      ).length
                    }
                    label="Staff contracts ending within 60 days"
                    onClick={() => setTab("People & resources")}
                  />
                  <Attention
                    value={
                      report.projects.filter(
                        (p) => p.retentionOriginal && p.retentionOriginal !== "-",
                      ).length
                    }
                    label="Retention entries to classify"
                    onClick={() => setTab("Projects")}
                  />
                  <Attention
                    value={report.issues.length}
                    label="Source warnings preserved for review"
                    onClick={() => setTab("Review & sources")}
                  />
                  <small>Alerts are measured against {report.asOf}.</small>
                </section>
              </div>
              <section className="internal-panel">
                <p className="internal-eyebrow">YOUR PORTFOLIO</p>
                <div className="internal-country-grid">
                  {[...new Set(report.projects.map((p) => p.country))].map((c) => (
                    <button
                      key={c}
                      onClick={() => {
                        setCountry(c);
                        setTab("Projects");
                      }}
                    >
                      <Building2 size={18} />
                      <span>{c || "Country not provided"}</span>
                      <strong>{report.projects.filter((p) => p.country === c).length}</strong>
                      <ArrowRight size={15} />
                    </button>
                  ))}
                </div>
              </section>
            </>
          )}
          {["Projects", "Invoicing", "People & resources"].includes(tab) && (
            <div className="internal-filters">
              <input
                aria-label="Search internal projects"
                placeholder="Search project, code or client"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <select
                aria-label="Filter country"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
              >
                <option value="">All countries</option>
                {[...new Set(report.projects.map((p) => p.country))].map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
              <select
                aria-label="Filter internal project"
                value={projectFilter}
                onChange={(e) => setProjectFilter(e.target.value)}
              >
                <option value="">All projects</option>
                {report.projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          {tab === "Projects" && (
            <section className="internal-panel">
              <h2>Project portfolio</h2>
              <Table
                headers={[
                  "Project",
                  "Country / client",
                  "Physical progress",
                  "Time elapsed",
                  "VIA value",
                  "Extension",
                  "Details",
                ]}
              >
                {projects.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <strong>{p.name}</strong>
                      <small>{p.code}</small>
                    </td>
                    <td>
                      {p.country}
                      <small>{p.client || p.partner || "Not provided"}</small>
                    </td>
                    <td>{p.physical === null ? "Not provided" : `${p.physical.toFixed(2)}%`}</td>
                    <td>
                      {elapsedPercent(p.start, p.end, report.asOf)?.toFixed(1) ?? "—"}%
                      <small>
                        {p.start || "?"} → {p.end || "?"}
                      </small>
                    </td>
                    <td>
                      {formatMoney(p.viaValue)}
                      <small>{p.currency || "Currency unconfirmed"}</small>
                    </td>
                    <td>{p.eot || "Not provided"}</td>
                    <td>
                      <button onClick={() => setDetail(p)}>View details</button>
                    </td>
                  </tr>
                ))}
              </Table>
            </section>
          )}
          {tab === "Invoicing" && (
            <>
              <section className="internal-panel">
                <h2>Invoice register</h2>
                <p className="internal-muted">
                  Separate IPCs in the same month are retained (for example 06 and 06A). Blank
                  amounts remain unknown. Invoice dates and due dates are not supplied, so overdue
                  ageing is not calculated.
                </p>
                <Table
                  headers={[
                    "Project",
                    "IPC / period",
                    "Invoiced OMR",
                    "Outstanding OMR",
                    "Unbilled OMR",
                    "Payment status",
                    "Source",
                  ]}
                >
                  {invoices.map((i) => (
                    <tr key={sourceLabel(i.source)}>
                      <td>{projectName(i.projectId)}</td>
                      <td>
                        {i.number}
                        <small>
                          {i.period || "Missing period"}
                          {i.period && i.period > report.asOf.slice(0, 7)
                            ? " · excluded: future"
                            : ""}
                        </small>
                      </td>
                      <td>{formatMoney(i.amount)}</td>
                      <td>{formatMoney(i.outstanding)}</td>
                      <td>{formatMoney(i.unbilled)}</td>
                      <td>
                        <span className={`internal-payment ${i.status}`}>
                          {i.status === "unpaid"
                            ? "Not received"
                            : i.status === "received"
                              ? "Received"
                              : "Unknown"}
                        </span>
                      </td>
                      <td>
                        <small>{sourceLabel(i.source)}</small>
                      </td>
                    </tr>
                  ))}
                </Table>
              </section>
              <section className="internal-panel">
                <h2>Contract inputs & grouped reporting</h2>
                <p className="internal-muted">
                  These are source inputs, not additional amounts to add to the portfolio total.
                  Monthly targets and unbilled work are not interchangeable. Grouping never
                  duplicates invoice records.
                </p>
                <Table
                  headers={[
                    "Reporting group",
                    "Included projects",
                    "Monthly input OMR",
                    "Contract input OMR",
                    "Invoiced through reporting month OMR",
                  ]}
                >
                  {report.targets.map((t) => (
                    <tr key={sourceLabel(t.source)}>
                      <td>{t.name}</td>
                      <td>{t.projectIds.map(projectName).join(" + ")}</td>
                      <td>{formatMoney(t.monthly)}</td>
                      <td>{formatMoney(t.contract)}</td>
                      <td>
                        {formatMoney(
                          sumKnownMoney(
                            report.invoices
                              .filter(
                                (i) =>
                                  t.projectIds.includes(i.projectId) &&
                                  i.period &&
                                  i.period <= report.asOf.slice(0, 7),
                              )
                              .map((i) => i.amount),
                          ),
                        )}
                      </td>
                    </tr>
                  ))}
                </Table>
              </section>
            </>
          )}
          {tab === "People & resources" && (
            <section className="internal-panel">
              <div className="internal-panel-heading">
                <div>
                  <p className="internal-eyebrow">SUPERVISION TEAMS</p>
                  <h2>People & resource commitments</h2>
                </div>
                <Users size={22} />
              </div>
              <p className="internal-muted">
                Rows are project assignments, not necessarily unique employees. No HR records are
                modified. Counts with missing dates or classifications remain incomplete.
              </p>
              <Table
                headers={[
                  "Person / role",
                  "Project",
                  "Classification",
                  "Contract dates",
                  "Duration elapsed",
                  "Accommodation",
                  "Vehicles",
                  "Source",
                ]}
              >
                {staff.map((p) => (
                  <tr key={sourceLabel(p.source)}>
                    <td>
                      <strong>{p.name || "Unfilled / not provided"}</strong>
                      <small>{p.position}</small>
                    </td>
                    <td>{projectName(p.projectId)}</td>
                    <td>
                      {p.nationalityGroup || "Unknown"}
                      <small>{p.gender || "Not provided"}</small>
                    </td>
                    <td>
                      {p.start || "Unknown"}
                      <small>to {p.end || "Unknown"}</small>
                    </td>
                    <td>{elapsedPercent(p.start, p.end, report.asOf)?.toFixed(1) ?? "—"}%</td>
                    <td>{p.accommodation || "Unknown"}</td>
                    <td>{p.cars ?? "Unknown"}</td>
                    <td>
                      <small>{sourceLabel(p.source)}</small>
                    </td>
                  </tr>
                ))}
              </Table>
            </section>
          )}
          {tab === "Review & sources" && (
            <>
              <section className="internal-panel">
                <p className="internal-eyebrow">SOURCE & APPROVAL</p>
                <h2>{s.fileName}</h2>
                <p>
                  Reporting date: <strong>{s.asOf}</strong> · {report.projects.length} projects ·{" "}
                  {report.staff.length} team assignments · {report.invoices.length} IPC rows
                </p>
                <p className="internal-muted">
                  Imported by {s.createdBy} · {new Date(s.createdAt).toLocaleString()}
                  {s.approvedBy ? ` · Approved by ${s.approvedBy}` : ""}
                </p>
                <p className="internal-muted internal-hash">File fingerprint: {s.sha256}</p>
                <p>
                  Invoice detail rows are the proposed billing source. Cached Dashboard figures
                  remain comparison values. Retention stays unclassified and excluded. No client
                  project is created or overwritten.
                </p>
              </section>
              <section className="internal-panel">
                <h2>Changes since the previous approved snapshot</h2>
                {previous.isFetching ? (
                  <p>Loading comparison…</p>
                ) : previous.isError ? (
                  <p role="alert">
                    Could not load the previous snapshot. Try again before approving.
                  </p>
                ) : previous.data ? (
                  <ChangeTable before={previous.data.report} after={report} />
                ) : (
                  <p>No earlier approved snapshot. This will establish the baseline.</p>
                )}
              </section>
              <section className="internal-panel">
                <h2>
                  Review source warnings{" "}
                  <span className="internal-count">{report.issues.length}</span>
                </h2>
                <p className="internal-muted">
                  Fix incorrect source values in Excel and re-upload. Approval acknowledges the
                  listed exclusions and discrepancies; it does not silently correct or verify them.
                </p>
                <Table headers={["Source cell", "Review item", "What this means"]}>
                  {report.issues.map((i, n) => (
                    <tr key={n}>
                      <td>{sourceLabel(i)}</td>
                      <td>
                        <span className="internal-warning-label">
                          {i.code.replaceAll("_", " ")}
                        </span>
                      </td>
                      <td>{i.message}</td>
                    </tr>
                  ))}
                </Table>
              </section>
              {report.notes.length > 0 && (
                <section className="internal-panel">
                  <h2>Additional source notes</h2>
                  <p className="internal-muted">
                    Preserved from the invoice sheets, including unbilled-work notes. Not
                    automatically included in monetary totals.
                  </p>
                  <Table headers={["Project", "Source", "Original note"]}>
                    {report.notes.map((n, i) => (
                      <tr key={i}>
                        <td>{projectName(n.projectId)}</td>
                        <td>{sourceLabel(n.source)}</td>
                        <td>{n.text}</td>
                      </tr>
                    ))}
                  </Table>
                </section>
              )}
              {s.state === "draft" ? (
                <section className="internal-panel internal-approve">
                  <label>
                    <input
                      type="checkbox"
                      checked={reviewed}
                      onChange={(e) => setReviewed(e.target.checked)}
                    />{" "}
                    I have reviewed the reporting date, project mappings, changes and all source
                    warnings. I approve using the detailed invoice rows, with unknown amounts,
                    unconfirmed currencies and retention excluded as stated.
                  </label>
                  <button
                    className="internal-primary"
                    disabled={busy || !reviewed || previous.isFetching || previous.isError}
                    onClick={() => void approve()}
                  >
                    <CheckCircle2 size={17} />
                    {busy ? "Approving…" : "Approve internal snapshot"}
                  </button>
                </section>
              ) : (
                <p className="internal-message">
                  <CheckCircle2 size={17} /> Approved snapshot. Upload a revised workbook to make
                  changes; this version remains in history.
                </p>
              )}
            </>
          )}
          <footer className="internal-footer">
            CONFIDENTIAL · VIA INTERNATIONAL · INTERNAL MANAGEMENT INFORMATION · As of {report.asOf}
          </footer>
        </>
      )}
      {detail && (
        <Dialog.Root
          open
          onOpenChange={(open) => {
            if (!open) setDetail(null);
          }}
        >
          <Dialog.Portal>
            <Dialog.Overlay className="internal-detail-backdrop" />
            <Dialog.Content aria-describedby={undefined} className="internal-detail">
              <button
                autoFocus
                className="internal-detail-close"
                aria-label="Close project details"
                onClick={() => setDetail(null)}
              >
                <X size={20} />
              </button>
              <p className="internal-eyebrow">PRIVATE PROJECT RECORD</p>
              <Dialog.Title>{detail.name}</Dialog.Title>
              <dl>
                {[
                  ["Client", detail.client],
                  ["Client project manager", detail.clientPm],
                  ["Contractor", detail.contractor],
                  ["Contractor project manager", detail.contractorPm],
                  ["Partner", detail.partner],
                  ["Contractor value", formatMoney(detail.contractorValue)],
                  ["VIA value", formatMoney(detail.viaValue)],
                  ["Currency", detail.currency || "Unconfirmed"],
                  [
                    "Reported invoiced (unverified Dashboard cache)",
                    formatMoney(detail.reportedInvoiced),
                  ],
                  [
                    "Reported outstanding (unverified Dashboard cache)",
                    formatMoney(detail.reportedOutstanding),
                  ],
                  ["Retention — awaiting classification", detail.retentionOriginal],
                  ["Source", sourceLabel(detail.source)],
                ].map(([k, v]) => (
                  <div key={k}>
                    <dt>{k}</dt>
                    <dd>{v || "Not provided"}</dd>
                  </div>
                ))}
              </dl>
              <p className="internal-data-note">
                Retention is not included in VIA receivables. Confirm ownership and calculation
                basis with finance.
              </p>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      )}
    </div>
  );
}
function Metric({
  label,
  value,
  sub,
  onClick,
  alert = false,
}: {
  label: string;
  value: string;
  sub: string;
  onClick: () => void;
  alert?: boolean;
}) {
  return (
    <button className={`internal-metric ${alert ? "alert" : ""}`} onClick={onClick}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{sub}</small>
    </button>
  );
}
function Attention({
  value,
  label,
  onClick,
}: {
  value: number;
  label: string;
  onClick: () => void;
}) {
  return (
    <button onClick={onClick}>
      <strong>{value}</strong>
      <span>{label}</span>
      <ArrowRight size={15} />
    </button>
  );
}
function Table({ headers, children }: { headers: string[]; children: ReactNode }) {
  return (
    <div className="internal-table-wrap" tabIndex={0} role="region" aria-label={headers.join(", ")}>
      <table>
        <thead>
          <tr>
            {headers.map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
function ChangeTable({ before, after }: { before: InternalReport; after: InternalReport }) {
  const changes: Array<{ name: string; field: string; before: string; after: string }> = [];
  function compare(a: Record<string, string>, b: Record<string, string>) {
    for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
      if (a[key] !== b[key]) {
        const [name, field] = key.split("\u0001");
        changes.push({
          name: name || "",
          field: field || "Record",
          before: a[key] ?? "Not present",
          after: b[key] ?? "Not present",
        });
      }
    }
  }
  function records(r: InternalReport) {
    const out: Record<string, string> = {};
    for (const p of r.projects)
      for (const [k, v] of Object.entries(p))
        if (!["source", "id"].includes(k))
          out[`${p.code || p.name}\u0001${k}`] = v === null ? "Unknown" : String(v);
    for (const i of r.invoices)
      for (const [k, v] of Object.entries(i))
        if (!["source", "projectId"].includes(k))
          out[`${r.projects.find((p) => p.id === i.projectId)?.name} · ${i.number}\u0001${k}`] =
            v === null ? "Unknown" : String(v);
    for (const s of r.staff)
      out[`${s.projectId} · ${s.name || s.position}\u0001Staff assignment`] = JSON.stringify({
        ...s,
        source: undefined,
      });
    return out;
  }
  compare(records(before), records(after));
  return (
    <>
      <p>
        {changes.length} changed fields compared with {before.asOf}. Missing records are shown, not
        silently deleted from historical snapshots.
      </p>
      <Table headers={["Record", "Field", "Previous", "This import"]}>
        {changes.map((c, n) => (
          <tr key={n}>
            <td>{c.name}</td>
            <td>{c.field}</td>
            <td>{c.before}</td>
            <td>{c.after}</td>
          </tr>
        ))}
      </Table>
    </>
  );
}
