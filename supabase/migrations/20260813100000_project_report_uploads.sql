CREATE TABLE public.project_reports (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  report_month text NOT NULL,
  source_pdf_path text NOT NULL,
  dashboard_data jsonb NOT NULL,
  approved_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, report_month)
);

CREATE TABLE public.project_secrets (
  project_id uuid NOT NULL PRIMARY KEY REFERENCES public.projects(id) ON DELETE CASCADE,
  password_hash text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.project_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_secrets ENABLE ROW LEVEL SECURITY;

GRANT ALL ON public.project_reports TO service_role;
GRANT ALL ON public.project_secrets TO service_role;

INSERT INTO storage.buckets (id, name, public)
VALUES ('project-reports', 'project-reports', false)
ON CONFLICT (id) DO UPDATE SET public = false;
