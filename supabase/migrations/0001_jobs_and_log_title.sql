-- =============================================================================
-- BuildTrack: jobs + daily log title + RLS
-- Apply in Supabase: SQL Editor > New query, or `supabase db push` if using CLI.
-- =============================================================================
--
-- STORAGE (Supabase Dashboard > Storage):
--   1. Create bucket named: log-images
--   2. For MVP public reads: Bucket > Public bucket = ON (or use signed URLs later).
--   3. Policies (Storage > Policies for log-images), example:
--
--      INSERT (upload): authenticated users only
--        bucket_id = 'log-images' AND auth.role() = 'authenticated'
--
--      SELECT: if bucket is public, reads are open; if private, add SELECT for
--        authenticated using (bucket_id = 'log-images').
--
--      Prefer path prefix per user: name LIKE (auth.uid()::text || '/%')
--
-- ENV: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local
-- =============================================================================

-- Jobs (sites / contracts the log applies to)
CREATE TABLE IF NOT EXISTS public.jobs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.daily_logs
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS job_id UUID REFERENCES public.jobs (id) ON DELETE SET NULL;

-- Backfill: existing rows without title (optional one-time); new inserts require title in app
COMMENT ON COLUMN public.daily_logs.title IS 'Short headline for the daily log';
COMMENT ON COLUMN public.daily_logs.job_id IS 'Which job/site this log applies to';
COMMENT ON COLUMN public.daily_logs.work_performed IS 'Main narrative / description (MVP form maps here)';

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_logs ENABLE ROW LEVEL SECURITY;

-- Jobs: any signed-in user can list active jobs (adjust for multi-tenant later)
DROP POLICY IF EXISTS "jobs_select_authenticated" ON public.jobs;
CREATE POLICY "jobs_select_authenticated" ON public.jobs
  FOR SELECT TO authenticated
  USING (true);

-- Daily logs: employees insert; clients read (all authenticated read for MVP simplicity)
DROP POLICY IF EXISTS "daily_logs_select_authenticated" ON public.daily_logs;
CREATE POLICY "daily_logs_select_authenticated" ON public.daily_logs
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "daily_logs_insert_employee" ON public.daily_logs;
CREATE POLICY "daily_logs_insert_employee" ON public.daily_logs
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'employee'
    )
  );

DROP POLICY IF EXISTS "daily_logs_update_own_employee" ON public.daily_logs;
CREATE POLICY "daily_logs_update_own_employee" ON public.daily_logs
  FOR UPDATE TO authenticated
  USING (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'employee'
    )
  )
  WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'employee'
    )
  );

-- ---------------------------------------------------------------------------
-- Seed jobs (dev / demo — remove or edit for production)
-- ---------------------------------------------------------------------------
INSERT INTO public.jobs (name, is_active)
SELECT v.name, v.is_active
FROM (
  VALUES
    ('Northside Elementary — Phase 2', true),
    ('Riverside Plaza Renovation', true),
    ('HQ Parking Structure', true)
) AS v(name, is_active)
WHERE NOT EXISTS (SELECT 1 FROM public.jobs j WHERE j.name = v.name);
