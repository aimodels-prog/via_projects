#!/bin/sh
# Consistent backup for this portal only; never stops another application.
set -eu
umask 077
cd /opt/via/apps/via-projects
backup_dir="/opt/via/backups/via-projects/$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$backup_dir"
docker compose -f compose.contabo.yaml stop app
trap 'docker compose -f compose.contabo.yaml start app' EXIT
docker compose -f compose.contabo.yaml exec -T db pg_dump -U project_hub -d project_hub -Fc > "$backup_dir/database.dump"
docker run --rm --network none -v via-projects_reports:/reports:ro postgres:17 tar -C /reports -czf - . > "$backup_dir/reports.tar.gz"
cp .env "$backup_dir/production.env"
git rev-parse HEAD > "$backup_dir/release.txt"
docker compose -f compose.contabo.yaml exec -T db pg_restore -l < "$backup_dir/database.dump" > /dev/null
tar -tzf "$backup_dir/reports.tar.gz" > /dev/null
printf 'Backup verified: %s\n' "$backup_dir"
