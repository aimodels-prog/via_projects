import "@tanstack/react-start/server-only";
import { randomBytes } from "node:crypto";
import { getCookie, setCookie } from "@tanstack/react-start/server";

export const PORTAL_COOKIE = "via_projects_staff";
const STATE_COOKIE = "via_projects_login_state";
export const portalEnabled = () => process.env["PROJECT_AUTH_MODE"] === "portal";
const portalOrigin =
  process.env["NODE_ENV"] !== "production" && process.env["PROJECTS_TEST_PORTAL_URL"]
    ? process.env["PROJECTS_TEST_PORTAL_URL"]
    : "https://portal.via-int.com";
const cookieOptions = {
  path: "/",
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env["NODE_ENV"] === "production",
};

export async function portalCall(action: string, input: Record<string, string>) {
  const key = process.env["PROJECTS_SSO_KEY"];
  if (!key || key.length < 32) throw new Error("Portal authentication is not configured.");
  const endpoint = process.env["PROJECTS_PORTAL_INTERNAL_URL"] || portalOrigin;
  const response = await fetch(`${endpoint}/sso/projects/${action}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(input),
    signal: AbortSignal.timeout(5000),
    redirect: "error",
  });
  if (!response.ok) return { authorized: false };
  return (await response.json()) as {
    authorized?: boolean;
    session?: string;
    expires?: number;
    email?: string;
    portalAdmin?: boolean;
  };
}
export async function hasPortalAccess() {
  const session = getCookie(PORTAL_COOKIE);
  if (!session || !/^[a-f0-9]{64}$/.test(session)) return false;
  try {
    return (await portalCall("access", { session })).authorized === true;
  } catch {
    return false;
  } // Fail closed when the portal cannot verify access.
}
export async function logoutPortal() {
  const session = getCookie(PORTAL_COOKIE);
  if (session) await portalCall("logout", { session });
  setCookie(PORTAL_COOKIE, "", { ...cookieOptions, maxAge: 0 });
}
function redirect(location: string) {
  return new Response(null, {
    status: 302,
    headers: { Location: location, "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" },
  });
}
export async function handlePortalRequest(request: Request): Promise<Response | undefined> {
  if (!portalEnabled()) return;
  const url = new URL(request.url);
  // Existing portal tiles may send their generic JWT. Never accept it as Projects authority.
  // Start our browser-bound, single-use code exchange instead and strip it immediately.
  if (url.searchParams.has("portal_token")) return redirect("/auth/portal/start");
  if (url.pathname === "/auth/portal/start") {
    if (request.method !== "GET") return new Response(null, { status: 405 });
    const state = randomBytes(32).toString("hex");
    setCookie(STATE_COOKIE, state, { ...cookieOptions, maxAge: 300 });
    return redirect(`${portalOrigin}/sso/projects?state=${state}`);
  }
  if (url.pathname !== "/auth/portal/callback") return;
  const state = getCookie(STATE_COOKIE);
  setCookie(STATE_COOKIE, "", { ...cookieOptions, maxAge: 0 });
  const code = url.searchParams.get("code") || "";
  if (
    request.method !== "GET" ||
    !state ||
    state !== url.searchParams.get("state") ||
    !/^[a-f0-9]{64}$/.test(code)
  )
    return new Response("Sign-in could not be verified. Return to Staff sign in and try again.", {
      status: 403,
      headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" },
    });
  try {
    const result = await portalCall("exchange", { code });
    if (
      result.authorized !== true ||
      !result.session ||
      !/^[a-f0-9]{64}$/.test(result.session) ||
      !result.expires ||
      result.expires <= Date.now()
    )
      throw new Error("Invalid handoff");
    setCookie(PORTAL_COOKIE, result.session, {
      ...cookieOptions,
      maxAge: Math.min(28800, Math.floor((result.expires - Date.now()) / 1000)),
    });
    return redirect("/admin-projects");
  } catch {
    return new Response("Portal sign-in could not be completed. Please try Staff sign in again.", {
      status: 403,
      headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" },
    });
  }
}
