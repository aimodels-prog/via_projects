import "@tanstack/react-start/server-only";
import { getCookie } from "@tanstack/react-start/server";
import { credentialVersion, verifyToken } from "./session-token";

export const ADMIN_COOKIE = "via_admin_session";
export function adminPassword() {
  return (
    process.env["PROJECT_ADMIN_PASSWORD"] ||
    (process.env["NODE_ENV"] !== "production" ? "admin2026" : "")
  );
}
export function hasAdminAccess() {
  const password = adminPassword();
  return Boolean(
    password && verifyToken(getCookie(ADMIN_COOKIE), "internal:admin", credentialVersion(password)),
  );
}
export function requireAdmin() {
  if (!hasAdminAccess()) throw new Error("Administrator session required. Please sign in again.");
}
