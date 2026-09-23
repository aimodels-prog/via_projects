# VIA Portal staff access

Production mode: `PROJECT_AUTH_MODE=portal`. Local development retains password mode.
Clients keep the public project directory and per-project passwords. Public pages
do not expose staff sign-in or portal links to clients. A server-verified staff
session sees a "Back to administration" link; signed-out clients do not. Staff open the VIA Projects
tile at portal.via-int.com. Legacy admin URLs still require portal authentication. Only active
staff assigned Projects may enter; all assigned staff receive project administration
permissions, as requested. Portal administrators control assignments.

## Security and lifecycle

- `/auth/portal/start` creates a 5-minute HttpOnly, Secure, SameSite=Lax state cookie.
- The portal issues a random 60-second code bound to its current signed login session.
- Projects verifies browser state and exchanges that code server-to-server using
  a dedicated `PROJECTS_SSO_KEY`. Codes are atomically consumed once.
- Only hashes of codes and opaque staff session tokens are stored in the portal's
  separate `via_projects_sso` table. No Google passwords/signing keys are shared.
- Every privileged server function awaits current portal authorization. Portal
  outage fails closed. Client password access remains independent.
- Session lifetime never exceeds the originating portal session (8 hours).
- Portal signout revokes associated Projects sessions; Projects signout revokes
  the current Projects session. Reassignment after detected revocation requires
  a new login. Already displayed information cannot be removed from a screenshot
  or an open browser tab, but further requests are protected.
- Local admin passwords and their existing cookies grant no access in portal mode.
- Generic `portal_token` launch URLs are discarded, not trusted. They start the
  browser-bound code exchange instead. Callback URLs are fixed, not caller-supplied.
- Portal logs record successful logins, denial/revocation and logout without tokens.

## Portal integration deployment

`scripts/portal-integration/projects-sso.ts` belongs to the **portal**, not this
app. `install.py` backs up the exact active portal source and environment, adds
the routes and signout hook, and stages a separate integration key in both apps.
It does not itself restart services or enable Projects portal mode.

`register-app.mjs` creates a restricted VIA Projects tile if absent and assigns
existing active portal administrators. It never grants access to all staff or
changes access to other apps. Other assignments use the portal's existing UI.

Internal API: `http://via-portal:8080/sso/projects/{exchange,access,logout}` on the
existing Docker proxy network. Requires the dedicated bearer key. Browser entry
and callback use HTTPS. Do not log query strings or enable callback analytics.

Back up portal source/env and tag its current Docker image before replacement.
Rollback: restore backed-up portal source/env, retag the saved image to
`0d08990-portal`, recreate only the portal service with `--no-build`, and switch
Projects to its previous release and `PROJECT_AUTH_MODE=password`. Retain the new
SSO table for audit/recovery; no data deletion is required.

Tests: `E2E_SSO=1 E2E_PORT=8222 npx playwright test tests/browser/portal-sso.spec.ts`
uses an isolated fake portal. Production portal verification must additionally
exercise its database-backed grants, code replay rejection, staff removal and logout.
