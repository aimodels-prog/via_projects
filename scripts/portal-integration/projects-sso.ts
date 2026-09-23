// Installed in the VIA Portal as src/lib/projects-sso.ts.
// Dedicated opaque-code integration: no Google or portal signing secrets are shared.
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { Pool } from "pg";
import { getPortalSession } from "./google-auth";
import { getVisibleApps } from "./portal-store";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL?.trim().toLowerCase() === "false" ? false : { rejectUnauthorized: false },
  max: 3,
});
const origin = "https://projects.via-int.com";
const digest = (value: string) => createHash("sha256").update(value).digest("hex");
let ready: Promise<unknown> | undefined;
function schema() {
  return ready ??= pool.query(`CREATE TABLE IF NOT EXISTS via_projects_sso (
    code_hash text PRIMARY KEY, session_hash text UNIQUE, portal_hash text NOT NULL,
    email text NOT NULL, expires_at timestamptz NOT NULL, code_expires_at timestamptz NOT NULL,
    revoked boolean NOT NULL DEFAULT false
  )`).catch((error) => { ready = undefined; throw error; });
}
function portalCookie(request: Request) {
  const value = request.headers.get("cookie")?.split(/;\s*/).find((v) => v.startsWith("via_portal_session="));
  return value ? decodeURIComponent(value.slice("via_portal_session=".length)) : "";
}
function audit(event: string, email?: string) {
  console.info(JSON.stringify({ event: `projects_sso_${event}`, email, app: "projects", time: new Date().toISOString() }));
}
function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" } });
}
async function allowed(email: string) {
  return (await getVisibleApps(email)).some((app) => {
    try { return new URL(app.url).origin === origin; } catch { return false; }
  });
}
export async function revokeProjectsSessions(request: Request) {
  if (!process.env.PROJECTS_SSO_KEY) return;
  const cookie = portalCookie(request);
  if (!cookie) return;
  await schema();
  await pool.query("UPDATE via_projects_sso SET revoked = true WHERE portal_hash = $1", [digest(cookie)]);
  audit("portal_logout");
}
export async function handleProjectsSso(request: Request) {
  const url = new URL(request.url);
  if (!process.env.PROJECTS_SSO_KEY) return json({ authorized: false }, 503);
  if (url.pathname === "/sso/projects") {
    if (request.method !== "GET") return json({}, 405);
    const state = url.searchParams.get("state") || "";
    if (!/^[a-f0-9]{64}$/.test(state)) return json({ error: "Invalid login request" }, 400);
    const session = getPortalSession(request);
    if (!session) {
      return new Response(null, { status: 302, headers: {
        Location: `/auth/signin?returnTo=${encodeURIComponent(`${origin}/auth/portal/start`)}`,
        "Cache-Control": "no-store",
      } });
    }
    if (!await allowed(session.email)) {
      audit("denied", session.email);
      return new Response("Your portal account does not have Projects access. Ask your portal administrator to assign Projects to you.", {
        status: 403, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
      });
    }
    await schema();
    const code = randomBytes(32).toString("hex");
    await pool.query("DELETE FROM via_projects_sso WHERE expires_at < now()");
    await pool.query(`INSERT INTO via_projects_sso (code_hash, portal_hash, email, expires_at, code_expires_at)
      VALUES ($1,$2,$3,to_timestamp($4),now() + interval '60 seconds')`,
      [digest(code), digest(portalCookie(request)), session.email, session.exp]);
    return new Response(null, { status: 302, headers: {
      Location: `${origin}/auth/portal/callback?code=${code}&state=${state}`,
      "Cache-Control": "no-store", "Referrer-Policy": "no-referrer",
    } });
  }
  const expected = Buffer.from(`Bearer ${process.env.PROJECTS_SSO_KEY}`);
  const received = Buffer.from(request.headers.get("authorization") || "");
  if (request.method !== "POST" || received.length !== expected.length || !timingSafeEqual(received, expected))
    return json({ authorized: false }, 401);
  const text = await request.text();
  if (text.length > 1024) return json({}, 400);
  let input: { code?: string; session?: string };
  try { input = JSON.parse(text); } catch { return json({}, 400); }
  await schema();
  if (url.pathname === "/sso/projects/exchange") {
    if (typeof input.code !== "string" || !/^[a-f0-9]{64}$/.test(input.code)) return json({}, 400);
    const token = randomBytes(32).toString("hex");
    const result = await pool.query(`UPDATE via_projects_sso SET session_hash=$2
      WHERE code_hash=$1 AND session_hash IS NULL AND NOT revoked
      AND code_expires_at > now() AND expires_at > now() RETURNING email, expires_at`, [digest(input.code), digest(token)]);
    const row = result.rows[0];
    if (!row || !await allowed(row.email)) return json({ authorized: false }, 403);
    audit("login", row.email);
    return json({ authorized: true, session: token, expires: new Date(row.expires_at).getTime(), email: row.email });
  }
  if (typeof input.session !== "string" || !/^[a-f0-9]{64}$/.test(input.session)) return json({ authorized: false }, 403);
  if (url.pathname === "/sso/projects/logout") {
    await pool.query("UPDATE via_projects_sso SET revoked=true WHERE session_hash=$1", [digest(input.session)]);
    audit("app_logout");
    return json({ ok: true });
  }
  if (url.pathname !== "/sso/projects/access") return json({}, 404);
  const result = await pool.query("SELECT email FROM via_projects_sso WHERE session_hash=$1 AND NOT revoked AND expires_at > now()", [digest(input.session)]);
  const email = result.rows[0]?.email;
  const authorized = Boolean(email && await allowed(email));
  if (!authorized && email) {
    await pool.query("UPDATE via_projects_sso SET revoked=true WHERE session_hash=$1", [digest(input.session)]);
    audit("access_revoked", email);
  }
  return json({ authorized, ...(authorized ? { email, role: "projects-admin" } : {}) });
}
