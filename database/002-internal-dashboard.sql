BEGIN;
CREATE TABLE IF NOT EXISTS hub_internal_snapshots (
  id uuid PRIMARY KEY,
  as_of date NOT NULL,
  file_name text NOT NULL,
  source_sha text NOT NULL CHECK (source_sha ~ '^[a-f0-9]{64}$'),
  source_file bytea NOT NULL,
  payload jsonb NOT NULL,
  state text NOT NULL DEFAULT 'draft' CHECK (state IN ('draft','approved')),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by text NOT NULL,
  approved_at timestamptz,
  approved_by text,
  UNIQUE(as_of, source_sha),
  CHECK ((state='draft' AND approved_at IS NULL AND approved_by IS NULL) OR
         (state='approved' AND approved_at IS NOT NULL AND approved_by IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS hub_internal_latest ON hub_internal_snapshots (as_of DESC, approved_at DESC) WHERE state='approved';
CREATE TABLE IF NOT EXISTS hub_internal_audit (
  id bigserial PRIMARY KEY, snapshot_id uuid NOT NULL REFERENCES hub_internal_snapshots(id),
  actor text NOT NULL, action text NOT NULL, occurred_at timestamptz NOT NULL DEFAULT now()
);
COMMIT;
