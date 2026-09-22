-- Only needed when continuing to use the legacy Supabase backend.
-- All project mutations must go through the server's administrator checks.
REVOKE ALL ON public.projects FROM anon, authenticated;
GRANT SELECT (id, slug, name, domain, region, status, sort_order) ON public.projects TO anon, authenticated;
DROP POLICY IF EXISTS "Authenticated users can insert projects" ON public.projects;
DROP POLICY IF EXISTS "Authenticated users can update projects" ON public.projects;
DROP POLICY IF EXISTS "Authenticated users can delete projects" ON public.projects;
GRANT ALL ON public.projects TO service_role;
