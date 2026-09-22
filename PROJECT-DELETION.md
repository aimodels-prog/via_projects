# Recoverable project deletion

Admins can select Delete in `/admin-projects`, then type the exact project slug to confirm.
This is soft deletion: it removes the project from app listings and blocks its client page,
dashboard, password unlock and history endpoints. It does not revoke content already downloaded.
Reports, images, drafts and saved layouts are retained privately; this is not a data-erasure tool.

Deletion markers are stored in `PROJECT_DATA_DIR/_deleted/<slug>.json` for local,
PostgreSQL and Supabase-backed projects. Keep this directory on the same persistent
volume as report storage and include it in backups. All app instances must share that
volume. A deleted slug remains reserved, preventing accidental recreation or republication.

Recovery currently requires server administration: verify the intended project and its
marker, back up that marker and remove only that specific marker. The project data is
unchanged. There is no permanent-delete or restore button yet. Direct database/storage
access is not controlled by these app-level markers; existing database permissions remain
important. No existing project is deleted by deploying this feature.
