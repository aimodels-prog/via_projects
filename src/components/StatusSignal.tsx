const MAP: Record<string, { label: string; dot: string; text: string }> = {
  active: { label: "Active", dot: "bg-signal-ok", text: "text-signal-ok" },
  operational: { label: "Operational", dot: "bg-signal-ok", text: "text-signal-ok" },
  maintenance: { label: "Maintenance", dot: "bg-signal-idle", text: "text-signal-idle" },
  fault: { label: "Fault", dot: "bg-signal-alert", text: "text-signal-alert" },
  planned: { label: "Planned", dot: "bg-signal-idle", text: "text-signal-idle" },
  completed: { label: "Completed", dot: "bg-brand", text: "text-brand" },
  "on hold": { label: "On Hold", dot: "bg-signal-idle", text: "text-signal-idle" },
};

export function StatusSignal({ status }: { status: string }) {
  const key = status.toLowerCase();
  const cfg = MAP[key] ?? { label: status, dot: "bg-signal-idle", text: "text-signal-idle" };

  return (
    <div className="flex items-center gap-2">
      <div className={`size-1.5 shrink-0 rounded-full ${cfg.dot}`} />
      <span className={`label-technical font-bold ${cfg.text}`}>{cfg.label}</span>
    </div>
  );
}
