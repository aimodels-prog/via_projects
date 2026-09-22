# Contabo VPS deployment

The app is a Node server, PostgreSQL database, and private persistent report storage. PostgreSQL holds project identity, access hashes, reporting periods and immutable revision references. Reports, original CSV/PDF evidence, photographs and drafts live in the private reports volume, not a public web directory.

## Deploy

1. Install Docker Engine/Compose and an HTTPS reverse proxy on the VPS.
2. Copy the project, including `templates/`, `Dashboard/via/` (Raysut styles/fonts), `database/`, Dockerfile and compose.yaml. Do not copy Windows node_modules or a Windows .output build: sharp has platform-specific binaries.
3. Copy `.env.example` to `.env`. Set three unique secrets. Use a random hexadecimal PostgreSQL password so it is safe in a connection URL. The access secret must be at least 32 characters. Never use development passwords in production.
4. Run `docker compose up -d --build`. The migration service creates the PostgreSQL tables before the app starts. PostgreSQL is not exposed on the host network.
5. Configure your domain's HTTPS proxy to `http://127.0.0.1:8090`. Only HTTPS should be public. Keep SSH restricted and database ports closed.
6. Sign in at `/admin-login`, publish a test project and verify its client password in a separate browser before entering real reports.

Example Nginx location directives inside your HTTPS server block:

```nginx
client_max_body_size 256m;
location / {
    proxy_pass http://127.0.0.1:8090;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_read_timeout 180s;
}
```

Terminate TLS with a valid certificate and redirect HTTP to HTTPS. The proxy must overwrite X-Real-IP: login rate limiting must not trust a client-supplied header. Run a single application instance with the current in-memory attempt limiter; use a shared limiter before horizontal scaling.

## Backups and updates

Back up **both** PostgreSQL and the reports volume. A database-only backup cannot restore report images. For a consistent backup, stop the app (leave PostgreSQL running), take a pg_dump and archive the reports volume, then start the app. Encrypt backups, restrict access and test restoring them on a separate system. Never run `docker compose down -v` unless deliberately deleting all data.

Deploy updates with `docker compose up -d --build`. Schema SQL is idempotent. Do not rewrite published git history on the Lovable-connected branch.

## Existing Supabase/development data

The app can still read legacy Supabase reports and old local projects when DATABASE_URL is absent. New production publishing requires PostgreSQL and never silently falls back to local development storage. Existing Supabase/local data is **not automatically migrated**. Export, reconcile and import it deliberately; keep original backups. Configure DATABASE_URL only after the database migration is run.

If you continue using a legacy Supabase instance, apply `supabase/migrations/20260910090000_restrict_legacy_project_access.sql` there. Until that migration is applied, its original direct database grants remain unchanged; changing application code cannot revoke those remote grants.

## Accuracy and access boundaries

- Public visitors see the project registry, not report figures or private drafts.
- Internal access currently uses a shared admin password; named staff accounts, granular staff roles and individual audit attribution are not implemented.
- Every publication requires server validation and a signed preview of the exact submitted report. Editing data invalidates the preview. Previous monthly revisions remain accessible to authorised clients.
- OCR is a browser-side reading aid, not a verified extraction result. Review the source image and all fields. Tesseract may download its English language model; the document is processed in the browser. Low-resolution chart values must not be estimated; use the original chart image instead.
- Missing quantities remain unknown, not zero. Original source files and the approved structured snapshot are retained separately in each revision.
- Development storage is for a single process. PostgreSQL publication uses a transaction and a project lock; files are written immutably before the database reference is committed. A failed transaction may leave an unreferenced file, but must not replace the published report. No automatic orphan deletion is performed.

## Verification

Run `npm ci`, `npm run typecheck`, `npm test`, `npm run build`, and `npx playwright test` (after `npx playwright install chromium`). Browser tests use an isolated temporary data directory and port 8197; they do not publish to your production database.
