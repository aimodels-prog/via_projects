import { Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  CalendarDays,
  Clock3,
  ExternalLink,
  HardHat,
  TrendingUp,
  Users,
} from "lucide-react";
import type { ProjectRow } from "@/lib/projects.functions";

function Panel({
  title,
  note,
  children,
  className = "",
}: {
  title: string;
  note?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`dashboard-panel ${className}`}>
      <header className="dashboard-panel-title">
        <h2>{title}</h2>
        {note && <span>{note}</span>}
      </header>
      {children}
    </section>
  );
}

function Kpi({
  label,
  value,
  suffix,
  detail,
  icon,
}: {
  label: string;
  value: string;
  suffix?: string;
  detail: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="dashboard-kpi">
      <div className="flex items-center justify-between gap-4">
        <span className="dashboard-eyebrow">{label}</span>
        <span className="text-brand/45">{icon}</span>
      </div>
      <div className="mt-3 font-mono text-3xl font-semibold tracking-tighter text-brand">
        {value}
        <small className="ml-1 text-sm">{suffix}</small>
      </div>
      <div className="mt-2 text-[11px] text-muted-foreground">{detail}</div>
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex min-h-24 items-center justify-center p-4 text-[10px] uppercase tracking-wider text-muted-foreground/50">
      {label}
    </div>
  );
}

function parsePercent(value: string | null | undefined): number | null {
  if (!value) return null;
  const num = parseFloat(value.replace("%", "").replace(",", ".").trim());
  return isNaN(num) ? null : num;
}

export function ProjectDashboard({ project }: { project: ProjectRow }) {
  const physical = parsePercent(project.metric_1_value);
  const financial = parsePercent(project.metric_2_value);
  const projectCode = project.slug.replaceAll("-", " / ").toUpperCase();
  const physicalLabel = project.metric_1_label ?? "Physical progress";
  const financialLabel = project.metric_2_label ?? "Financial progress";
  const physicalDisplay = physical !== null ? physical.toFixed(2) : "—";
  const financialDisplay = financial !== null ? financial.toFixed(2) : "—";

  return (
    <main className="min-h-screen bg-[#eef1f4] text-[#15243a]">
      <div className="mx-auto max-w-[1680px] px-4 py-5 md:px-8 md:py-7">
        <Link
          to="/"
          className="mb-5 inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-brand hover:text-signal-alert"
        >
          <ArrowLeft size={13} /> All projects
        </Link>

        <header className="flex flex-col gap-5 border-b border-brand/55 pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="grid size-12 shrink-0 place-items-center rounded-full border border-brand/30 bg-white font-mono text-[9px] font-bold text-brand">
              VIA
            </div>
            <div>
              <div className="dashboard-eyebrow">{projectCode} · Monthly progress report</div>
              <h1 className="mt-1 text-xl font-bold leading-tight tracking-tight text-brand md:text-2xl">
                {project.name}
              </h1>
              <p className="mt-1 text-xs text-muted-foreground">
                {project.brief ?? project.summary ?? project.domain}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-stretch gap-3">
            {project.region && (
              <div className="border-l border-border px-4">
                <div className="dashboard-eyebrow">Region</div>
                <div className="mt-1 font-mono text-sm font-bold">{project.region}</div>
              </div>
            )}
            <div
              className={`border px-4 py-2 ${
                project.status.toLowerCase() === "active"
                  ? "border-signal-ok/50 bg-white text-signal-ok"
                  : "border-border bg-white text-muted-foreground"
              }`}
            >
              <div
                className={`dashboard-eyebrow ${
                  project.status.toLowerCase() === "active"
                    ? "text-signal-ok"
                    : "text-muted-foreground"
                }`}
              >
                ● {project.status.charAt(0).toUpperCase() + project.status.slice(1)}
              </div>
              <div className="mt-1 font-mono text-sm font-bold">Project status</div>
            </div>
          </div>
        </header>

        {/* KPI Row */}
        <div className="mt-3 grid border border-border bg-white sm:grid-cols-2 xl:grid-cols-4">
          <Kpi
            label={physicalLabel}
            value={physicalDisplay}
            suffix={physical !== null ? "%" : ""}
            detail={physical !== null ? "Recorded in latest report" : "Upload a report to populate"}
            icon={<TrendingUp size={18} />}
          />
          <Kpi
            label={financialLabel}
            value={financialDisplay}
            suffix={financial !== null ? "%" : ""}
            detail={financial !== null ? "Certified value to date" : "Upload a report to populate"}
            icon={<CalendarDays size={18} />}
          />
          <Kpi
            label="Region"
            value={project.region ?? "—"}
            detail="Project location"
            icon={<Clock3 size={18} />}
          />
          <Kpi
            label="Resources on site"
            value="—"
            detail="Upload a monthly report to populate"
            icon={<HardHat size={18} />}
          />
        </div>

        <div className="mt-3 grid gap-3 xl:grid-cols-[1.45fr_1fr_.78fr]">
          {/* Left column */}
          <div className="space-y-3">
            {/* Progress overview */}
            <Panel title="Progress overview" note="from project registry">
              <div className="grid grid-cols-2 gap-6 p-5 sm:grid-cols-3">
                <div>
                  <div className="dashboard-eyebrow">Physical progress</div>
                  <div className="mt-2 font-mono text-3xl font-bold text-brand">
                    {physicalDisplay}
                    {physical !== null && <span className="text-lg">%</span>}
                  </div>
                  <div className="mt-1 text-[10px] text-muted-foreground">{physicalLabel}</div>
                </div>
                <div>
                  <div className="dashboard-eyebrow">Financial progress</div>
                  <div className="mt-2 font-mono text-3xl font-bold text-brand">
                    {financialDisplay}
                    {financial !== null && <span className="text-lg">%</span>}
                  </div>
                  <div className="mt-1 text-[10px] text-muted-foreground">{financialLabel}</div>
                </div>
                <div className="sm:col-span-1">
                  <div className="dashboard-eyebrow">Status</div>
                  <div className="mt-2 text-lg font-bold capitalize text-brand">
                    {project.status}
                  </div>
                  <div className="mt-1 text-[10px] text-muted-foreground">Current status</div>
                </div>
              </div>

              {/* Progress bars */}
              <div className="border-t border-border px-5 pb-5">
                <div className="mt-4 space-y-4">
                  {physical !== null && (
                    <div>
                      <div className="mb-1 flex justify-between text-[10px]">
                        <span className="dashboard-eyebrow">Physical</span>
                        <span className="font-mono font-bold text-brand">
                          {physical.toFixed(2)}%
                        </span>
                      </div>
                      <div className="h-2 w-full bg-[#d5dbe3]">
                        <div
                          className="h-full bg-brand transition-all"
                          style={{ width: `${Math.min(100, physical)}%` }}
                        />
                      </div>
                    </div>
                  )}
                  {financial !== null && (
                    <div>
                      <div className="mb-1 flex justify-between text-[10px]">
                        <span className="dashboard-eyebrow">Financial</span>
                        <span className="font-mono font-bold text-brand">
                          {financial.toFixed(2)}%
                        </span>
                      </div>
                      <div className="h-2 w-full bg-[#d5dbe3]">
                        <div
                          className="h-full bg-signal-ok transition-all"
                          style={{ width: `${Math.min(100, financial)}%` }}
                        />
                      </div>
                    </div>
                  )}
                  {physical === null && financial === null && (
                    <EmptyState label="Upload a monthly report to see progress bars" />
                  )}
                </div>
              </div>
            </Panel>

            {/* Brief / Description */}
            <Panel title="Project brief" note="as registered">
              <div className="p-5 text-sm leading-relaxed text-foreground/80">
                {project.brief ?? project.summary ?? (
                  <span className="text-muted-foreground">
                    No brief recorded. Edit this project to add a description.
                  </span>
                )}
              </div>
            </Panel>
          </div>

          {/* Middle column */}
          <div className="space-y-3">
            <Panel title="Project overview" note={project.region ?? "Global"}>
              <div className="flex min-h-64 flex-col items-center justify-center gap-4 p-6 text-center">
                <div className="grid size-16 place-items-center rounded-full border-2 border-brand/20 bg-brand/5">
                  <TrendingUp size={28} className="text-brand/40" />
                </div>
                <div>
                  <div className="text-sm font-bold text-brand">{project.name}</div>
                  {project.region && (
                    <div className="mt-1 text-[11px] text-muted-foreground">{project.region}</div>
                  )}
                  {project.domain && (
                    <a
                      href={`https://${project.domain}`}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-flex items-center gap-1 font-mono text-[10px] text-brand underline hover:text-signal-alert"
                    >
                      {project.domain} <ExternalLink size={10} />
                    </a>
                  )}
                </div>
              </div>
            </Panel>

            <Panel title="Construction progress" note="upload a report for site photos">
              <div className="grid grid-cols-2 gap-px bg-border">
                {[1, 2, 3, 4].map((index) => (
                  <div
                    key={index}
                    className="relative flex aspect-[4/3] items-center justify-center overflow-hidden bg-[#eef1f4] p-3"
                  >
                    <span className="text-[9px] uppercase tracking-widest text-muted-foreground/50">
                      Photo {index}
                    </span>
                  </div>
                ))}
              </div>
              <p className="border-t border-border p-3 text-center text-[10px] text-muted-foreground">
                Site photographs appear after a monthly report is uploaded
              </p>
            </Panel>
          </div>

          {/* Right sidebar */}
          <aside className="space-y-3">
            <Panel title="Project details" note="registry data">
              <dl className="divide-y divide-border px-3 text-[10px]">
                <div className="py-2">
                  <dt className="dashboard-eyebrow">Project name</dt>
                  <dd className="mt-1 font-semibold">{project.name}</dd>
                </div>
                {project.domain && (
                  <div className="py-2">
                    <dt className="dashboard-eyebrow">Domain</dt>
                    <dd className="mt-1">
                      <a
                        href={`https://${project.domain}`}
                        target="_blank"
                        rel="noreferrer"
                        className="break-all font-mono text-brand underline hover:text-signal-alert"
                      >
                        {project.domain}
                      </a>
                    </dd>
                  </div>
                )}
                {project.region && (
                  <div className="py-2">
                    <dt className="dashboard-eyebrow">Region</dt>
                    <dd className="mt-1 font-semibold">{project.region}</dd>
                  </div>
                )}
                <div className="py-2">
                  <dt className="dashboard-eyebrow">Status</dt>
                  <dd className="mt-1 font-semibold capitalize">{project.status}</dd>
                </div>
              </dl>
            </Panel>

            <Panel title="Resources on site" note="planned vs actual">
              <div className="grid grid-cols-2 gap-4 p-3">
                <div>
                  <Users size={16} className="text-brand/40" />
                  <div className="mt-2 font-mono text-2xl font-bold text-muted-foreground">—</div>
                  <div className="dashboard-eyebrow">Manpower</div>
                </div>
                <div>
                  <HardHat size={16} className="text-brand/40" />
                  <div className="mt-2 font-mono text-2xl font-bold text-muted-foreground">—</div>
                  <div className="dashboard-eyebrow">Machinery</div>
                </div>
              </div>
              <p className="border-t border-border p-3 text-center text-[9px] text-muted-foreground">
                Resource data appears after a monthly report is uploaded
              </p>
            </Panel>

            <Panel title="Project parties">
              <dl className="divide-y divide-border px-3 text-[10px]">
                <div className="py-2">
                  <dt className="dashboard-eyebrow">Client</dt>
                  <dd className="mt-1 font-semibold">—</dd>
                </div>
                <div className="py-2">
                  <dt className="dashboard-eyebrow">Consultant</dt>
                  <dd className="mt-1 font-semibold">
                    VIA International · Engineering Consultancy
                  </dd>
                </div>
                <div className="py-2">
                  <dt className="dashboard-eyebrow">Status</dt>
                  <dd className="mt-1 font-semibold capitalize">{project.status}</dd>
                </div>
              </dl>
            </Panel>

            <div className="border border-dashed border-brand/30 bg-brand/5 p-4 text-center">
              <p className="text-[10px] leading-relaxed text-muted-foreground">
                Full dashboard with S-curve, activities, milestones, photos and resources is
                available after uploading a monthly report.
              </p>
              <Link
                to="/upload"
                className="mt-3 inline-flex items-center gap-1 font-mono text-[9px] font-bold uppercase tracking-widest text-brand hover:text-signal-alert"
              >
                Upload report →
              </Link>
            </div>
          </aside>
        </div>

        <footer className="mt-3 flex flex-col gap-2 border-t-2 border-signal-alert pt-3 font-mono text-[9px] uppercase tracking-widest text-muted-foreground sm:flex-row sm:justify-between">
          <span>{project.slug.toUpperCase()} · Project overview</span>
          <span className="font-bold text-brand">VIA International · Engineering Consultancy</span>
        </footer>
      </div>
    </main>
  );
}
