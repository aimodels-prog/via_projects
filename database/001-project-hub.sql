BEGIN;
CREATE TABLE IF NOT EXISTS hub_projects (
  id uuid PRIMARY KEY,
  slug text UNIQUE NOT NULL CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  payload jsonb NOT NULL,
  password_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS hub_reports (
  id uuid PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES hub_projects(id),
  period text NOT NULL CHECK (period ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  file_name text NOT NULL,
  approved_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS hub_reports_latest ON hub_reports(project_id,period DESC,approved_at DESC);
COMMIT;
