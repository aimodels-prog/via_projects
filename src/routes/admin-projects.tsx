import { createFileRoute, Link, redirect, useRouter } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, type FormEvent } from "react";
import { getAdminAccess, logoutAdmin } from "@/lib/project-access.functions";
import {
  listProjects,
  createProject,
  updateProject,
  deleteProject,
} from "@/lib/projects.functions";
import { makeSlug } from "@/lib/report.types";
import { StatusSignal } from "@/components/StatusSignal";
import { PlusCircle, Pencil, LogOut, X, Check, ArrowLeft } from "lucide-react";
import type { ProjectRow } from "@/lib/projects.functions";

const projectsQuery = queryOptions({
  queryKey: ["projects"],
  queryFn: () => listProjects(),
});

export const Route = createFileRoute("/admin-projects")({
  loader: async ({ context }) => {
    const access = await getAdminAccess();
    if (!access.authorized) throw redirect({ to: "/admin-login" });
    await context.queryClient.ensureQueryData(projectsQuery);
    return {};
  },
  head: () => ({
    meta: [
      { title: "Manage Projects · VIA International" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AdminProjectsPage,
});

const STATUS_OPTIONS = ["active", "planned", "maintenance", "completed", "on hold"] as const;

type StatusOption = (typeof STATUS_OPTIONS)[number];

interface ProjectForm {
  name: string;
  slug: string;
  domain: string;
  region: string;
  status: StatusOption;
  brief: string;
}

function emptyForm(): ProjectForm {
  return { name: "", slug: "", domain: "", region: "", status: "active", brief: "" };
}

function projectToForm(project: ProjectRow): ProjectForm {
  return {
    name: project.name,
    slug: project.slug,
    domain: project.domain,
    region: project.region ?? "",
    status: (project.status.toLowerCase() as StatusOption) ?? "active",
    brief: project.brief ?? project.summary ?? "",
  };
}

function FormField({
  label,
  value,
  onChange,
  required = false,
  placeholder = "",
  as = "input",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  placeholder?: string;
  as?: "input" | "textarea";
}) {
  const cls =
    "mt-2 w-full border border-input bg-white px-3 py-2 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/10";
  return (
    <label className="block">
      <span className="dashboard-eyebrow block">
        {label}
        {required && <span className="ml-1 text-signal-alert">*</span>}
      </span>
      {as === "textarea" ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          placeholder={placeholder}
          className={cls}
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          className={`h-10 ${cls}`}
        />
      )}
    </label>
  );
}

function ProjectFormPanel({
  title,
  initial,
  projectId,
  onClose,
  onSaved,
}: {
  title: string;
  initial: ProjectForm;
  projectId?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<ProjectForm>(initial);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function set<K extends keyof ProjectForm>(key: K, value: ProjectForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setSaving(true);
    try {
      if (projectId) {
        await updateProject({ data: { id: projectId, ...form } });
      } else {
        await createProject({ data: form });
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save project.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="border-2 border-brand bg-white p-6">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-lg font-black uppercase tracking-tight text-brand">{title}</h2>
        <button
          type="button"
          onClick={onClose}
          className="text-muted-foreground hover:text-signal-alert"
        >
          <X size={18} />
        </button>
      </div>
      <form onSubmit={submit} className="space-y-4">
        <FormField
          label="Project name"
          value={form.name}
          required
          placeholder="Construction of..."
          onChange={(v) => {
            set("name", v);
            if (!projectId) set("slug", makeSlug(v));
          }}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            label="URL slug"
            value={form.slug}
            required
            placeholder="my-project-slug"
            onChange={(v) => set("slug", makeSlug(v))}
          />
          <FormField
            label="Project path (generated from URL slug)"
            value={`/${form.slug}`}
            onChange={() => {}}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            label="Region"
            value={form.region}
            placeholder="Dhofar, Oman"
            onChange={(v) => set("region", v)}
          />
          <label className="block">
            <span className="dashboard-eyebrow block">Status</span>
            <select
              value={form.status}
              onChange={(e) => set("status", e.target.value as StatusOption)}
              className="mt-2 h-10 w-full border border-input bg-white px-3 text-sm outline-none focus:border-brand"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <FormField
          label="Brief description"
          value={form.brief}
          placeholder="Brief summary of the project scope..."
          as="textarea"
          onChange={(v) => set("brief", v)}
        />
        {error && (
          <p role="alert" className="text-sm text-signal-alert">
            {error}
          </p>
        )}
        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="flex h-10 items-center gap-2 bg-brand px-5 font-mono text-[9px] font-bold uppercase tracking-widest text-white disabled:opacity-60 hover:bg-brand/90"
          >
            <Check size={13} />
            {saving ? "Saving…" : "Save project"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 items-center gap-2 border border-border px-4 font-mono text-[9px] uppercase tracking-widest text-muted-foreground hover:border-brand/40"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

function AdminProjectsPage() {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  const { data: projects } = useSuspenseQuery(projectsQuery);
  const queryClient = useQueryClient();
  const router = useRouter();
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<ProjectRow | null>(null);
  const [confirmation, setConfirmation] = useState("");
  const [deletingBusy, setDeletingBusy] = useState(false);
  const [deleteMessage, setDeleteMessage] = useState("");

  async function handleLogout() {
    await logoutAdmin();
    queryClient.clear();
    await router.navigate({ to: "/" });
  }

  function handleSaved() {
    void queryClient.invalidateQueries({ queryKey: ["projects"] });
    setShowCreate(false);
    setEditingId(null);
  }

  const editingProject = editingId ? projects.find((p) => p.id === editingId) : null;

  return (
    <main className="min-h-screen bg-[#eef1f4]">
      <header className="border-b border-brand/30 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
          <div>
            <div className="dashboard-eyebrow text-signal-alert">Admin panel</div>
            <h1 className="mt-1 text-2xl font-black uppercase tracking-tight text-brand">
              Manage projects
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/upload" className="dashboard-eyebrow text-brand">
              Upload monthly report
            </Link>
            <Link
              to="/projects"
              className="dashboard-eyebrow flex items-center gap-1 text-muted-foreground hover:text-brand"
            >
              <ArrowLeft size={12} /> View dashboard
            </Link>
            <Link to="/upload" className="dashboard-eyebrow text-brand hover:text-signal-alert">
              Upload report
            </Link>
            <button
              type="button"
              onClick={handleLogout}
              className="flex items-center gap-2 dashboard-eyebrow text-muted-foreground hover:text-signal-alert"
            >
              <LogOut size={13} /> Sign out
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-6 py-8">
        {deleteMessage && (
          <p role="status" className="mb-4 rounded border bg-white p-3">
            {deleteMessage}
          </p>
        )}
        {deleting && (
          <section
            role="dialog"
            aria-modal="false"
            aria-label="Delete project confirmation"
            className="mb-5 rounded border-2 border-red-600 bg-white p-5"
          >
            <h2 className="font-bold">Delete {deleting.name}?</h2>
            <p className="my-3 text-sm">
              This removes the project from the app and disables its client link, including report
              history. Files are retained privately for recovery by a server administrator. This is
              not permanent data erasure.
            </p>
            <label className="block text-sm">
              Type {deleting.slug} to confirm
              <input
                aria-label="Confirm project URL slug"
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
                disabled={deletingBusy}
                className="my-2 block w-full border p-2"
              />
            </label>
            <div className="flex gap-3">
              <button
                className="rounded bg-red-700 p-3 text-white disabled:opacity-40"
                disabled={deletingBusy || confirmation !== deleting.slug}
                onClick={async () => {
                  setDeletingBusy(true);
                  setDeleteMessage("");
                  try {
                    await deleteProject({
                      data: { id: deleting.id, slug: deleting.slug, confirmation },
                    });
                    setDeleting(null);
                    setEditingId(null);
                    setShowCreate(false);
                    await queryClient.invalidateQueries({ queryKey: ["projects"] });
                    await router.invalidate();
                    setDeleteMessage(
                      "Project deleted from the app. Its files are retained for administrator recovery.",
                    );
                  } catch (e) {
                    setDeleteMessage(e instanceof Error ? e.message : "Unable to delete project.");
                  } finally {
                    setDeletingBusy(false);
                  }
                }}
              >
                {deletingBusy ? "Deleting…" : "Confirm deletion"}
              </button>
              <button
                className="rounded border p-3"
                disabled={deletingBusy}
                onClick={() => setDeleting(null)}
              >
                Cancel
              </button>
            </div>
          </section>
        )}
        {/* Create form */}
        {showCreate && (
          <div className="mb-6">
            <ProjectFormPanel
              title="New project"
              initial={emptyForm()}
              onClose={() => setShowCreate(false)}
              onSaved={handleSaved}
            />
          </div>
        )}

        {/* Edit form */}
        {editingProject && (
          <div className="mb-6">
            <ProjectFormPanel
              title={`Editing: ${editingProject.name}`}
              initial={projectToForm(editingProject)}
              projectId={editingProject.id}
              onClose={() => setEditingId(null)}
              onSaved={handleSaved}
            />
          </div>
        )}

        {/* Header row */}
        <div className="mb-4 flex items-center justify-between border-b-2 border-brand pb-4">
          <h2 className="text-xl font-black uppercase tracking-tight text-brand">
            {projects.length} registered project{projects.length !== 1 ? "s" : ""}
          </h2>
          {!showCreate && !editingId && (
            <button
              type="button"
              disabled={!ready}
              onClick={() => setShowCreate(true)}
              className="flex h-9 items-center gap-2 bg-brand px-4 font-mono text-[9px] font-bold uppercase tracking-widest text-white hover:bg-brand/90"
            >
              <PlusCircle size={13} /> Add project
            </button>
          )}
        </div>

        {/* Project list */}
        <div className="space-y-3">
          {projects.length === 0 && (
            <p className="border border-border bg-white p-6 text-sm text-muted-foreground">
              No projects yet. Click "Add project" to create one.
            </p>
          )}
          {projects.map((project) => (
            <div
              key={project.id}
              className={`flex items-center gap-4 border bg-white p-4 transition-colors ${
                editingId === project.id ? "border-brand" : "border-border"
              }`}
            >
              <div className="min-w-0 flex-1">
                <div className="label-technical truncate text-muted-foreground">
                  {project.domain}
                </div>
                <div className="truncate font-bold tracking-tight text-brand">{project.name}</div>
                {project.region && (
                  <div className="label-technical mt-0.5 text-muted-foreground/70">
                    {project.region}
                  </div>
                )}
              </div>
              <div className="hidden md:block">
                <StatusSignal status={project.status} />
              </div>
              <div className="flex items-center gap-2">
                <Link
                  to="/$slug"
                  params={{ slug: project.slug }}
                  target="_blank"
                  className="label-technical text-muted-foreground hover:text-brand"
                >
                  View →
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreate(false);
                    setEditingId(editingId === project.id ? null : project.id);
                  }}
                  className="flex h-8 items-center gap-1.5 border border-border px-3 font-mono text-[9px] uppercase tracking-widest text-brand hover:border-brand/40"
                >
                  <Pencil size={11} /> Edit
                </button>
                <button
                  type="button"
                  aria-label={`Delete ${project.name}`}
                  className="h-8 rounded border border-red-300 px-3 text-xs text-red-700"
                  disabled={!ready || deletingBusy}
                  onClick={() => {
                    setDeleting(project);
                    setConfirmation("");
                    setDeleteMessage("");
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
