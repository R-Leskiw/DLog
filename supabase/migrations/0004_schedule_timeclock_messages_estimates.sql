-- =============================================================================
-- BuildTrack: schedule, timeclock, messaging RLS, estimates
-- Run in: Supabase SQL Editor → New query → Run entire file
-- =============================================================================

CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role IN ('employee', 'admin')
      AND p.approval_status = 'approved'
  );
$$;

REVOKE ALL ON FUNCTION public.is_staff() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_staff() TO authenticated;

-- Messaging: RLS on existing table + read receipts
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "messages_select_staff" ON public.messages;
CREATE POLICY "messages_select_staff" ON public.messages
  FOR SELECT TO authenticated
  USING (public.is_staff());

DROP POLICY IF EXISTS "messages_insert_staff" ON public.messages;
CREATE POLICY "messages_insert_staff" ON public.messages
  FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid() AND public.is_staff());

CREATE TABLE IF NOT EXISTS public.message_reads (
  message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (message_id, user_id)
);

ALTER TABLE public.message_reads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "message_reads_select_own" ON public.message_reads;
CREATE POLICY "message_reads_select_own" ON public.message_reads
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() AND public.is_staff());

DROP POLICY IF EXISTS "message_reads_insert_own" ON public.message_reads;
CREATE POLICY "message_reads_insert_own" ON public.message_reads
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.is_staff());

-- Scheduling
CREATE TABLE IF NOT EXISTS public.schedule_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES public.jobs(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  notes TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'planned'
    CHECK (status IN ('planned', 'in_progress', 'done', 'blocked')),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT schedule_tasks_dates CHECK (end_date >= start_date)
);

CREATE TABLE IF NOT EXISTS public.schedule_assignments (
  task_id UUID NOT NULL REFERENCES public.schedule_tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  PRIMARY KEY (task_id, user_id)
);

ALTER TABLE public.schedule_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "schedule_tasks_select_staff" ON public.schedule_tasks;
CREATE POLICY "schedule_tasks_select_staff" ON public.schedule_tasks
  FOR SELECT TO authenticated
  USING (public.is_staff());

DROP POLICY IF EXISTS "schedule_tasks_write_admin" ON public.schedule_tasks;
CREATE POLICY "schedule_tasks_write_admin" ON public.schedule_tasks
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "schedule_assignments_select_staff" ON public.schedule_assignments;
CREATE POLICY "schedule_assignments_select_staff" ON public.schedule_assignments
  FOR SELECT TO authenticated
  USING (public.is_staff());

DROP POLICY IF EXISTS "schedule_assignments_write_admin" ON public.schedule_assignments;
CREATE POLICY "schedule_assignments_write_admin" ON public.schedule_assignments
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE INDEX IF NOT EXISTS schedule_tasks_dates_idx
  ON public.schedule_tasks (start_date, end_date);

-- Timeclock
CREATE TABLE IF NOT EXISTS public.time_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE RESTRICT,
  clock_in TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  clock_out TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT time_entries_out_after_in CHECK (
    clock_out IS NULL OR clock_out >= clock_in
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS time_entries_one_open_per_user
  ON public.time_entries (user_id)
  WHERE clock_out IS NULL;

CREATE INDEX IF NOT EXISTS time_entries_user_clock_in_idx
  ON public.time_entries (user_id, clock_in DESC);

ALTER TABLE public.time_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "time_entries_select_own_or_admin" ON public.time_entries;
CREATE POLICY "time_entries_select_own_or_admin" ON public.time_entries
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "time_entries_insert_own_staff" ON public.time_entries;
CREATE POLICY "time_entries_insert_own_staff" ON public.time_entries
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.is_staff());

DROP POLICY IF EXISTS "time_entries_update_own_or_admin" ON public.time_entries;
CREATE POLICY "time_entries_update_own_or_admin" ON public.time_entries
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.is_admin())
  WITH CHECK (user_id = auth.uid() OR public.is_admin());

-- Estimates
CREATE TABLE IF NOT EXISTS public.estimates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES public.jobs(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'sent', 'accepted', 'declined')),
  markup_percent NUMERIC(6, 3) NOT NULL DEFAULT 0,
  tax_percent NUMERIC(6, 3) NOT NULL DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.estimate_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  estimate_id UUID NOT NULL REFERENCES public.estimates(id) ON DELETE CASCADE,
  sort_order INT NOT NULL DEFAULT 0,
  category TEXT NOT NULL DEFAULT 'other'
    CHECK (category IN ('material', 'labor', 'subcontractor', 'other')),
  description TEXT NOT NULL,
  quantity NUMERIC(12, 3) NOT NULL DEFAULT 1,
  unit TEXT,
  unit_cost NUMERIC(12, 2) NOT NULL DEFAULT 0
);

ALTER TABLE public.estimates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estimate_line_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "estimates_select_staff" ON public.estimates;
CREATE POLICY "estimates_select_staff" ON public.estimates
  FOR SELECT TO authenticated
  USING (public.is_staff());

DROP POLICY IF EXISTS "estimates_write_admin" ON public.estimates;
CREATE POLICY "estimates_write_admin" ON public.estimates
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "estimate_lines_select_staff" ON public.estimate_line_items;
CREATE POLICY "estimate_lines_select_staff" ON public.estimate_line_items
  FOR SELECT TO authenticated
  USING (public.is_staff());

DROP POLICY IF EXISTS "estimate_lines_write_admin" ON public.estimate_line_items;
CREATE POLICY "estimate_lines_write_admin" ON public.estimate_line_items
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Realtime (ignore if already a member)
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
