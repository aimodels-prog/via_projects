import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";
import { hasAdminAccess } from "./admin-auth.server";
import { setResponseHeader } from "@tanstack/react-start/server";
import { reportSchema } from "./report.types";
import {
  isProjectDeleted,
  requireActiveProject,
  markProjectDeleted,
} from "./project-deletion.server";

export type ProjectRow = {
  id: string;
  slug: string;
  name: string;
  domain: string;
  region: string | null;
  status: string;
  summary: string | null;
  brief: string | null;
  metric_1_label: string | null;
  metric_1_value: string | null;
  metric_2_label: string | null;
  metric_2_value: string | null;
};

const COLUMNS =
  "id, slug, name, domain, region, status, summary, brief, metric_1_label, metric_1_value, metric_2_label, metric_2_value";
const PUBLIC_COLUMNS = "id, slug, name, domain, region, status";

function publicClient() {
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  return createClient<Database>(process.env["SUPABASE_URL"]!, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) {
          h.delete("Authorization");
        }
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

export const listProjects = createServerFn({ method: "GET" }).handler(async () => {
  setResponseHeader("Cache-Control", "private, no-store");
  setResponseHeader("Vary", "Cookie");
  const forViewer = async (projects: ProjectRow[]) => {
    const active = await Promise.all(
      projects.map(async (p) => ((await isProjectDeleted(p.slug)) ? null : p)),
    );
    projects = active.filter((p): p is ProjectRow => p !== null);
    return hasAdminAccess()
      ? projects
      : projects.map((project) => ({
          ...project,
          domain: `/${project.slug}`,
          brief: null,
          summary: null,
          metric_1_label: null,
          metric_1_value: null,
          metric_2_label: null,
          metric_2_value: null,
        }));
  };
  const { usesPostgres } = await import("./postgres.server");
  if (usesPostgres()) {
    const { listLocalProjects } = await import("./local-project-store");
    return forViewer(await listLocalProjects());
  }
  // Start with the built-in projects as the baseline
  const projectsBySlug = new Map<string, ProjectRow>();

  // Try to fetch from Supabase — gracefully fall back if unreachable or paused
  try {
    const { data, error } = await publicClient()
      .from("projects")
      .select(PUBLIC_COLUMNS)
      .order("sort_order", { ascending: true });
    if (!error && data) {
      for (const project of data as ProjectRow[]) projectsBySlug.set(project.slug, project);
    }
  } catch {
    // Supabase unreachable (paused project, no connectivity, etc.) — use built-ins only
  }

  // Merge any locally stored projects (uploaded via /upload without Supabase)
  try {
    const { listLocalProjects } = await import("@/lib/local-project-store");
    const localProjects = await listLocalProjects();
    for (const project of localProjects) projectsBySlug.set(project.slug, project);
  } catch {
    // Local store unavailable — skip
  }

  return forViewer([...projectsBySlug.values()]);
});

export const getProject = createServerFn({ method: "GET" })
  .validator((input: unknown) => z.object({ slug: z.string().min(1).max(120) }).parse(input))
  .handler(async ({ data }) => {
    if (await isProjectDeleted(data.slug)) return null;
    setResponseHeader("Cache-Control", "private, no-store");
    setResponseHeader("Vary", "Cookie");
    const visible = (project: ProjectRow) =>
      hasAdminAccess()
        ? project
        : {
            ...project,
            domain: `/${project.slug}`,
            brief: null,
            summary: null,
            metric_1_label: null,
            metric_1_value: null,
            metric_2_label: null,
            metric_2_value: null,
          };
    const { getLocalProject } = await import("./local-project-store");
    const local = await getLocalProject(data.slug);
    if (local) return visible(local);
    const { usesPostgres } = await import("./postgres.server");
    if (usesPostgres()) return null;
    // Try Supabase first
    let row: ProjectRow | null = null;
    try {
      const { data: result, error } = await publicClient()
        .from("projects")
        .select(PUBLIC_COLUMNS)
        .eq("slug", data.slug)
        .maybeSingle();
      if (!error && result) row = result as ProjectRow;
    } catch {
      // Supabase unreachable — fall through to local/built-in
    }

    if (!row) {
      // Try local store
      try {
        const { getLocalProject } = await import("@/lib/local-project-store");
        const localProject = await getLocalProject(data.slug);
        if (localProject) return visible(localProject);
      } catch {
        // Local store unavailable
      }
    }

    return row ? visible(row) : null;
  });

function adminClient() {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!url || !key)
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is required for admin operations. Add it to your .env file.",
    );
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

const projectInputSchema = z.object({
  name: z.string().min(3).max(200),
  slug: reportSchema.shape.slug,
  domain: z.string().max(200).default(""),
  region: z.string().max(100).default(""),
  status: z.enum(["active", "planned", "maintenance", "completed", "on hold"]).default("active"),
  brief: z.string().max(1000).default(""),
});

export const deleteProject = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({ id: z.string().uuid(), slug: reportSchema.shape.slug, confirmation: z.string() })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("./admin-auth.server");
    requireAdmin();
    if (data.confirmation !== data.slug)
      throw new Error("Type the exact project URL slug to confirm deletion.");
    const project = await getProject({ data: { slug: data.slug } });
    if (!project || project.id !== data.id)
      throw new Error("Project not found or changed. Refresh the project list.");
    await markProjectDeleted({ id: project.id, slug: project.slug, name: project.name });
    return { deleted: true };
  });

export const createProject = createServerFn({ method: "POST" })
  .validator((input: unknown) => projectInputSchema.parse(input))
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("./admin-auth.server");
    requireAdmin();
    await requireActiveProject(data.slug);
    const { database, usesPostgres } = await import("./postgres.server");
    if (usesPostgres() || !process.env["SUPABASE_SERVICE_ROLE_KEY"]) {
      const row: ProjectRow = {
        id: crypto.randomUUID(),
        slug: data.slug,
        name: data.name,
        domain: `/${data.slug}`,
        region: data.region,
        status: data.status,
        summary: data.brief,
        brief: data.brief,
        metric_1_label: null,
        metric_1_value: null,
        metric_2_label: null,
        metric_2_value: null,
      };
      if (!usesPostgres()) {
        const { saveProjectMetadata } = await import("./local-project-store");
        await saveProjectMetadata(row, true);
        return { slug: row.slug };
      }
      await database().query(
        "INSERT INTO hub_projects(id,slug,payload,password_hash) VALUES($1,$2,$3,$4)",
        [row.id, row.slug, row, "unpublished"],
      );
      return { slug: row.slug };
    }
    const supabase = adminClient();
    const { data: created, error } = await supabase
      .from("projects")
      .insert({
        slug: data.slug,
        name: data.name,
        domain: data.domain,
        region: data.region || null,
        status: data.status,
        brief: data.brief || null,
        summary: data.brief || null,
      })
      .select("id, slug")
      .single();
    if (error) throw new Error(error.message);
    return { slug: created.slug };
  });

export const updateProject = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z.object({ id: z.string().uuid(), ...projectInputSchema.shape }).parse(input),
  )
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("./admin-auth.server");
    requireAdmin();
    await requireActiveProject(data.slug);
    const { database, usesPostgres } = await import("./postgres.server");
    if (!usesPostgres() && !process.env["SUPABASE_SERVICE_ROLE_KEY"]) {
      const { getLocalProject, saveProjectMetadata } = await import("./local-project-store");
      const existing = await getLocalProject(data.slug);
      if (!existing || existing.id !== data.id)
        throw new Error("Project not found. Published URLs cannot be renamed.");
      await saveProjectMetadata(
        {
          ...existing,
          name: data.name,
          status: data.status,
          region: data.region,
          brief: data.brief,
          summary: data.brief,
          domain: `/${data.slug}`,
        },
        false,
      );
      return { ok: true };
    }
    if (usesPostgres()) {
      const result = await database().query(
        "UPDATE hub_projects SET payload = payload || $3::jsonb WHERE id=$1 AND slug=$2 RETURNING id",
        [
          data.id,
          data.slug,
          JSON.stringify({
            name: data.name,
            domain: `/${data.slug}`,
            region: data.region,
            status: data.status,
            brief: data.brief,
            summary: data.brief,
          }),
        ],
      );
      if (!result.rowCount)
        throw new Error("Project not found. Published project URLs cannot be renamed.");
      return { ok: true };
    }
    const supabase = adminClient();
    const { error } = await supabase
      .from("projects")
      .update({
        name: data.name,
        slug: data.slug,
        domain: data.domain,
        region: data.region || null,
        status: data.status,
        brief: data.brief || null,
        summary: data.brief || null,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
