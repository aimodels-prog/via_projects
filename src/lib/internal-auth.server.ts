import "@tanstack/react-start/server-only";
import { getCookie, setResponseHeader } from "@tanstack/react-start/server";
import { hasAdminAccess } from "./admin-auth.server";
import { portalCall, portalEnabled, PORTAL_COOKIE } from "./portal-sso.server";

export async function internalIdentity(): Promise<string | null> {
  setResponseHeader("Cache-Control", "private, no-store");
  setResponseHeader("Vary", "Cookie");
  if (portalEnabled()) {
    const session = getCookie(PORTAL_COOKIE);
    if (!session || !/^[a-f0-9]{64}$/.test(session)) return null;
    try {
      const result = await portalCall("access", { session });
      return result.authorized === true &&
        result.portalAdmin === true &&
        typeof result.email === "string" &&
        result.email.includes("@")
        ? result.email.toLowerCase()
        : null;
    } catch {
      return null;
    }
  }
  // Explicit development-only switch. Never lets the production shared password into finance.
  if (
    process.env["NODE_ENV"] !== "production" &&
    process.env["PROJECT_INTERNAL_DEV_ACCESS"] === "true" &&
    (await hasAdminAccess())
  )
    return "local-test-admin";
  return null;
}
export async function requireInternal() {
  const email = await internalIdentity();
  if (!email)
    throw new Error("Internal dashboard access is restricted to VIA Portal administrators.");
  return email;
}
