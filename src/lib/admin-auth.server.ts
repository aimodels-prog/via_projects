import "@tanstack/react-start/server-only";
import { getCookie } from "@tanstack/react-start/server";
import { credentialVersion, verifyToken } from "./session-token";
import { hasPortalAccess, portalEnabled } from "./portal-sso.server";

export const ADMIN_COOKIE = "via_admin_session";
export function adminPassword() {
  if (portalEnabled()) return "";
  return (
    process.env["PROJECT_ADMIN_PASSWORD"] ||
    (process.env["NODE_ENV"] !== "production" ? "admin2026" : "")
  );
}
export async function hasAdminAccess() {
  if (portalEnabled()) return hasPortalAccess();
  const password = adminPassword();
  return Boolean(
    password && verifyToken(getCookie(ADMIN_COOKIE), "internal:admin", credentialVersion(password)),
  );
}
export async function requireAdmin() {
  if (!(await hasAdminAccess()))
    throw new Error("Administrator session required. Please sign in again.");
}
