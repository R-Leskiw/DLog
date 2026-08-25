-- =============================================================================
-- BuildTrack: schedule Gantt enhancements — dependencies + templates
-- Run in: Supabase SQL Editor → New query → Run entire file
-- After: 0004_schedule_timeclock_messages_estimates.sql
-- =============================================================================

ALTER TABLE public.schedule_tasks
  ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.schedule_dependencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  predecessor_id UUID NOT NULL REFERENCES public.schedule_tasks(id) ON DELETE CASCADE,
  successor_id UUID NOT NULL REFERENCES public.schedule_tasks(id) ON DELETE CASCADE,
  lag_days INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT schedule_dependencies_no_self CHECK (predecessor_id <> successor_id),
  CONSTRAINT schedule_dependencies_unique UNIQUE (predecessor_id, successor_id)
);

CREATE INDEX IF NOT EXISTS schedule_dependencies_pred_idx
  ON public.schedule_dependencies (predecessor_id);
CREATE INDEX IF NOT EXISTS schedule_dependencies_succ_idx
  ON public.schedule_dependencies (successor_id);

ALTER TABLE public.schedule_dependencies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "schedule_dependencies_select_staff" ON public.schedule_dependencies;
CREATE POLICY "schedule_dependencies_select_staff" ON public.schedule_dependencies
  FOR SELECT TO authenticated
  USING (public.is_staff());

DROP POLICY IF EXISTS "schedule_dependencies_write_admin" ON public.schedule_dependencies;
CREATE POLICY "schedule_dependencies_write_admin" ON public.schedule_dependencies
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE TABLE IF NOT EXISTS public.schedule_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.schedule_template_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES public.schedule_templates(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  duration_days INTEGER NOT NULL DEFAULT 1
    CHECK (duration_days >= 1),
  lag_days INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  notes TEXT
);

CREATE INDEX IF NOT EXISTS schedule_template_items_template_idx
  ON public.schedule_template_items (template_id, sort_order);

ALTER TABLE public.schedule_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule_template_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "schedule_templates_select_staff" ON public.schedule_templates;
CREATE POLICY "schedule_templates_select_staff" ON public.schedule_templates
  FOR SELECT TO authenticated
  USING (public.is_staff());

DROP POLICY IF EXISTS "schedule_templates_write_admin" ON public.schedule_templates;
CREATE POLICY "schedule_templates_write_admin" ON public.schedule_templates
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "schedule_template_items_select_staff" ON public.schedule_template_items;
CREATE POLICY "schedule_template_items_select_staff" ON public.schedule_template_items
  FOR SELECT TO authenticated
  USING (public.is_staff());

DROP POLICY IF EXISTS "schedule_template_items_write_admin" ON public.schedule_template_items;
CREATE POLICY "schedule_template_items_write_admin" ON public.schedule_template_items
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
