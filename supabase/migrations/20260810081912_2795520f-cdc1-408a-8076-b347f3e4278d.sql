CREATE TABLE public.projects (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  domain text NOT NULL,
  region text,
  status text NOT NULL DEFAULT 'active',
  summary text,
  brief text,
  metric_1_label text,
  metric_1_value text,
  metric_2_label text,
  metric_2_value text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.projects TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.projects TO authenticated;
GRANT ALL ON public.projects TO service_role;

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Projects are publicly viewable"
  ON public.projects FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can insert projects"
  ON public.projects FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update projects"
  ON public.projects FOR UPDATE TO authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can delete projects"
  ON public.projects FOR DELETE TO authenticated
  USING (true);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_projects_updated_at
BEFORE UPDATE ON public.projects
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.projects (slug, name, domain, region, status, summary, brief, metric_1_label, metric_1_value, metric_2_label, metric_2_value, sort_order) VALUES
('helios-grid', 'Helios Grid', 'helios.viainternational.com', 'MEA', 'active',
 'Utility-scale solar generation and grid integration programme.',
 'Design, delivery and operational oversight of a utility-scale photovoltaic array with high-voltage transmission tie-in and remote monitoring across the regional grid.',
 'Capacity', '410 MW', 'Uptime', '99.4%', 1),
('pacific-backbone', 'Pacific Backbone', 'pacific.viainternational.com', 'APAC', 'active',
 'Long-haul fibre backbone linking regional data centre hubs.',
 'Multi-landing subsea and terrestrial fibre backbone connecting regional data centre campuses, with redundant routing and 24/7 network operations coverage.',
 'Latency', '12 ms', 'Load', '84%', 2),
('nordic-nexus', 'Nordic Nexus', 'nordic.viainternational.com', 'EMEA', 'maintenance',
 'Structural and thermal integration for a northern energy hub.',
 'Secondary containment and thermal exchange integration at a northern energy hub, currently in scheduled maintenance for exchanger recertification.',
 'Efficiency', '98.4%', 'Load', '65%', 3);