import { scryptSync, timingSafeEqual } from "node:crypto";
import { createServerFn } from "@tanstack/react-start";
import {
  getCookie,
  setCookie,
  setResponseHeader,
  getRequestHeader,
} from "@tanstack/react-start/server";
import { z } from "zod";
import { credentialVersion, issueToken, verifyToken } from "./session-token";
import { ADMIN_COOKIE, adminPassword, hasAdminAccess } from "./admin-auth.server";
import { isProjectDeleted } from "./project-deletion.server";
import { logoutPortal, portalEnabled } from "./portal-sso.server";

const MAX_AGE = 60 * 60 * 12;
const failures = new Map<string, { count: number; reset: number }>();
function throttle(audience: string) {
  const key = `${audience}:${getRequestHeader("x-real-ip") || "local"}`;
  const now = Date.now();
  for (const [id, value] of failures) if (value.reset <= now) failures.delete(id);
  const value = failures.get(key) || { count: 0, reset: now + 15 * 60 * 1000 };
  if (value.count >= 10) throw new Error("Too many sign-in attempts. Try again in 15 minutes.");
  value.count++;
  failures.set(key, value);
  return () => failures.delete(key);
}

function configuredAccessPassword(slug: string) {
  const passwordMap = process.env["PROJECT_DASHBOARD_PASSWORDS"];
  if (passwordMap) {
    try {
      const passwords = JSON.parse(passwordMap) as Record<string, string>;
      if (passwords[slug]) return passwords[slug];
    } catch {
      throw new Error("PROJECT_DASHBOARD_PASSWORDS must be a valid JSON object.");
    }
  }
  const configured = process.env["PROJECT_DASHBOARD_PASSWORD"];
  if (configured) return configured;
  if (process.env["NODE_ENV"] !== "production") return "via2026";
  return null;
}

function cookieName(slug: string) {
  return `via_project_${slug.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
}

function safeEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function verifyPassword(slug: string, password: string) {
  if (await isProjectDeleted(slug)) return false;
  const { getLocalSecret } = await import("@/lib/local-project-store");
  const localHash = await getLocalSecret(slug);
  if (localHash) {
    const [salt, expected] = localHash.split(":");
    return Boolean(
      salt && expected && safeEqual(scryptSync(password, salt, 64).toString("hex"), expected),
    );
  }
  if (process.env["DATABASE_URL"]) return false;
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!url || !key) {
    const configured = configuredAccessPassword(slug);
    return Boolean(configured && safeEqual(password, configured));
  }
  const { createClient } = await import("@supabase/supabase-js");
  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (!project) return false;
  const { data: secret } = await supabase
    .from("project_secrets")
    .select("password_hash")
    .eq("project_id", project.id)
    .maybeSingle();
  if (!secret?.password_hash) {
    const configured = configuredAccessPassword(slug);
    return Boolean(configured && safeEqual(password, configured));
  }
  const [salt, expected] = secret.password_hash.split(":");
  if (!salt || !expected) return false;
  return safeEqual(scryptSync(password, salt, 64).toString("hex"), expected);
}

async function accessVersion(slug: string) {
  const { getLocalSecret } = await import("./local-project-store");
  const local = await getLocalSecret(slug);
  if (local) return credentialVersion(local);
  const url = process.env["SUPABASE_URL"],
    key = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (url && key) {
    const { createClient } = await import("@supabase/supabase-js");
    const db = createClient(url, key);
    const { data: project, error } = await db
      .from("projects")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    if (error) throw new Error("Unable to verify project access.");
    if (project) {
      const { data: secret, error } = await db
        .from("project_secrets")
        .select("password_hash")
        .eq("project_id", project.id)
        .maybeSingle();
      if (error) throw new Error("Unable to verify project access.");
      if (secret) return credentialVersion(secret.password_hash);
    }
  }
  return credentialVersion(configuredAccessPassword(slug) || "disabled");
}

async function hasAccess(slug: string) {
  if (await isProjectDeleted(slug)) return false;
  if (await hasAdminAccess()) return true;
  return verifyToken(getCookie(cookieName(slug)), `client:${slug}`, await accessVersion(slug));
}

function privateResponseHeaders() {
  setResponseHeader("Cache-Control", "private, no-store");
  setResponseHeader("Vary", "Cookie");
}

export const getProjectAccess = createServerFn({ method: "GET" })
  .validator((input: unknown) => z.object({ slug: z.string().min(1).max(120) }).parse(input))
  .handler(async ({ data }) => {
    privateResponseHeaders();
    return { authorized: await hasAccess(data.slug) };
  });

export const unlockProject = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    z
      .object({
        slug: z.string().min(1).max(120),
        password: z.string().min(1).max(200),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const resetAttempts = throttle(`client:${data.slug}`);
    const valid = await verifyPassword(data.slug, data.password);
    if (!valid) {
      privateResponseHeaders();
      return { authorized: false };
    }
    resetAttempts();
    const value = issueToken(`client:${data.slug}`, await accessVersion(data.slug));
    privateResponseHeaders();
    setCookie(cookieName(data.slug), value, {
      path: "/",
      maxAge: MAX_AGE,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env["NODE_ENV"] === "production",
    });
    return { authorized: true };
  });

export const getProtectedDashboardHtml = createServerFn({ method: "GET" })
  .validator((input: unknown) =>
    z
      .object({
        slug: z
          .string()
          .max(100)
          .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
        revision: z.string().uuid().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    privateResponseHeaders();
    if (!(await hasAccess(data.slug))) return null;
    if (data.revision) {
      const { revisionReport } = await import("./revision-store.server");
      const report = await revisionReport(data.slug, data.revision);
      if (!report) throw new Error("Report revision not found.");
      const { buildExactDashboardHtml } = await import("./dashboard-html.server");
      return buildExactDashboardHtml(report);
    }
    const { getLocalReport } = await import("@/lib/local-project-store");
    const localReport = await getLocalReport(data.slug);
    if (localReport) {
      const { buildExactDashboardHtml } = await import("@/lib/dashboard-html.server");
      return buildExactDashboardHtml(localReport);
    }
    const url = process.env["SUPABASE_URL"];
    const key = process.env["SUPABASE_SERVICE_ROLE_KEY"];
    if (url && key) {
      const { createClient } = await import("@supabase/supabase-js");
      const supabase = createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data: project } = await supabase
        .from("projects")
        .select("id")
        .eq("slug", data.slug)
        .maybeSingle();
      if (project) {
        const { data: savedReport } = await supabase
          .from("project_reports")
          .select("dashboard_data")
          .eq("project_id", project.id)
          .order("approved_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (savedReport?.dashboard_data) {
          const raw = savedReport.dashboard_data as Record<string, unknown> & {
            logoImagePath?: string;
            layoutImagePath?: string;
            photos?: Array<{
              caption: string;
              sub?: string;
              path: string;
              source?: "pdf" | "original";
              width?: number;
              height?: number;
            }>;
          };
          const paths = [
            ...(raw.logoImagePath ? [raw.logoImagePath] : []),
            ...(raw.layoutImagePath ? [raw.layoutImagePath] : []),
            ...(raw.photos?.map((photo) => photo.path) ?? []),
          ];
          const { data: signed } = await supabase.storage
            .from("project-reports")
            .createSignedUrls(paths, MAX_AGE);
          const logoUrlIndex = raw.logoImagePath ? 0 : -1;
          const layoutUrlIndex = raw.layoutImagePath ? (raw.logoImagePath ? 1 : 0) : -1;
          const photoUrlOffset =
            Number(Boolean(raw.logoImagePath)) + Number(Boolean(raw.layoutImagePath));
          const candidate = {
            ...raw,
            logoImage:
              logoUrlIndex >= 0 ? (signed?.[logoUrlIndex]?.signedUrl ?? "") : raw["logoImage"],
            layoutImage:
              layoutUrlIndex >= 0
                ? (signed?.[layoutUrlIndex]?.signedUrl ?? "")
                : raw["layoutImage"],
            photos: (raw.photos ?? []).map((photo, index) => ({
              caption: photo.caption,
              sub: photo.sub,
              source: photo.source,
              width: photo.width,
              height: photo.height,
              dataUrl: signed?.[index + photoUrlOffset]?.signedUrl ?? "",
            })),
          };
          const { reportSchema } = await import("@/lib/report.types");
          const parsed = reportSchema.parse(candidate);
          const { buildExactDashboardHtml } = await import("@/lib/dashboard-html.server");
          return buildExactDashboardHtml(parsed);
        }
      }
    }
    return null;
  });

// ─── Admin authentication ──────────────────────────────────────────────────

export const getAdminAccess = createServerFn({ method: "GET" }).handler(async () => {
  privateResponseHeaders();
  return { authorized: await hasAdminAccess(), portal: portalEnabled() };
});

export const loginAdmin = createServerFn({ method: "POST" })
  .validator((input: unknown) => z.object({ password: z.string().min(1).max(200) }).parse(input))
  .handler(async ({ data }) => {
    privateResponseHeaders();
    const resetAttempts = throttle("internal:admin");
    const expected = adminPassword();
    if (!expected || !safeEqual(data.password, expected)) {
      return { authorized: false };
    }
    resetAttempts();
    const value = issueToken("internal:admin", credentialVersion(expected));
    setCookie(ADMIN_COOKIE, value, {
      path: "/",
      maxAge: MAX_AGE,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env["NODE_ENV"] === "production",
    });
    return { authorized: true };
  });

export const logoutAdmin = createServerFn({ method: "POST" }).handler(async () => {
  privateResponseHeaders();
  if (portalEnabled()) await logoutPortal();
  setCookie(ADMIN_COOKIE, "", { path: "/", maxAge: 0 });
  return { ok: true };
});

export const getProjectReportHistory = createServerFn({ method: "GET" })
  .validator((input: unknown) =>
    z
      .object({
        slug: z
          .string()
          .max(100)
          .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    privateResponseHeaders();
    if (!(await hasAccess(data.slug))) throw new Error("Project access required.");
    const { listReportHistory } = await import("./revision-store.server");
    return listReportHistory(data.slug);
  });

export const getProtectedReportDetails = createServerFn({ method: "GET" })
  .validator((input: unknown) =>
    z
      .object({
        slug: z
          .string()
          .max(100)
          .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
        revision: z.string().uuid().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    privateResponseHeaders();
    if (!(await hasAccess(data.slug))) throw new Error("Project access required.");
    const { revisionReport } = await import("./revision-store.server");
    const report = await revisionReport(data.slug, data.revision);
    return { details: report?.details ?? [], attachments: report?.attachments ?? [] };
  });
