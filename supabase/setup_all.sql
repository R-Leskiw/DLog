-- =============================================================================
-- BuildTrack: one-shot database setup for a NEW Supabase project (free tier)
-- Run in: Supabase Dashboard → SQL Editor → New query → Run
-- After this: create Storage bucket `log-images` (see storage_policies.sql + SETUP.md)
-- =============================================================================

-- Base tables
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  full_name TEXT,
  role TEXT CHECK (role IN ('employee', 'client')),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.jobs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.daily_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_by UUID REFERENCES auth.users(id),
  job_id UUID REFERENCES public.jobs(id) ON DELETE SET NULL,
  title TEXT,
  date DATE DEFAULT CURRENT_DATE,
  weather TEXT,
  work_performed TEXT,
  crew_on_site TEXT,
  issues_delays TEXT,
  image_urls TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  log_id UUID REFERENCES public.daily_logs(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  parent_id UUID REFERENCES public.comments(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id UUID REFERENCES auth.users(id),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS comments_log_id_idx ON public.comments (log_id);
CREATE INDEX IF NOT EXISTS comments_parent_id_idx ON public.comments (parent_id);

-- RLS: jobs + daily_logs
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "jobs_select_authenticated" ON public.jobs;
CREATE POLICY "jobs_select_authenticated" ON public.jobs
  FOR SELECT TO authenticated
  USING (true);

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

-- RLS: profiles + comments
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_authenticated" ON public.profiles;
CREATE POLICY "profiles_select_authenticated" ON public.profiles
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "comments_select_authenticated" ON public.comments;
CREATE POLICY "comments_select_authenticated" ON public.comments
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "comments_insert_authenticated" ON public.comments;
CREATE POLICY "comments_insert_authenticated" ON public.comments
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "comments_update_own" ON public.comments;
CREATE POLICY "comments_update_own" ON public.comments
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "comments_delete_own" ON public.comments;
CREATE POLICY "comments_delete_own" ON public.comments
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- Profile stub on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'client')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Seed demo jobs
INSERT INTO public.jobs (name, is_active)
SELECT v.name, v.is_active
FROM (
  VALUES
    ('Northside Elementary — Phase 2', true),
    ('Riverside Plaza Renovation', true),
    ('HQ Parking Structure', true)
) AS v(name, is_active)
WHERE NOT EXISTS (SELECT 1 FROM public.jobs j WHERE j.name = v.name);
