-- =============================================================================
-- Timeclock: unpaid breaks, edit/delete shifts, admin can add for others
-- Run in: Supabase SQL Editor after 0004
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.time_entry_breaks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  time_entry_id UUID NOT NULL REFERENCES public.time_entries(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  CONSTRAINT time_entry_breaks_end_after_start CHECK (
    ended_at IS NULL OR ended_at >= started_at
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS time_entry_breaks_one_open
  ON public.time_entry_breaks (time_entry_id)
  WHERE ended_at IS NULL;

CREATE INDEX IF NOT EXISTS time_entry_breaks_entry_idx
  ON public.time_entry_breaks (time_entry_id, started_at);

ALTER TABLE public.time_entry_breaks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "time_entry_breaks_select" ON public.time_entry_breaks;
CREATE POLICY "time_entry_breaks_select" ON public.time_entry_breaks
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.time_entries e
      WHERE e.id = time_entry_id
        AND (e.user_id = auth.uid() OR public.is_admin())
    )
  );

DROP POLICY IF EXISTS "time_entry_breaks_insert" ON public.time_entry_breaks;
CREATE POLICY "time_entry_breaks_insert" ON public.time_entry_breaks
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.time_entries e
      WHERE e.id = time_entry_id
        AND (e.user_id = auth.uid() OR public.is_admin())
        AND public.is_staff()
    )
  );

DROP POLICY IF EXISTS "time_entry_breaks_update" ON public.time_entry_breaks;
CREATE POLICY "time_entry_breaks_update" ON public.time_entry_breaks
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.time_entries e
      WHERE e.id = time_entry_id
        AND (e.user_id = auth.uid() OR public.is_admin())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.time_entries e
      WHERE e.id = time_entry_id
        AND (e.user_id = auth.uid() OR public.is_admin())
    )
  );

DROP POLICY IF EXISTS "time_entry_breaks_delete" ON public.time_entry_breaks;
CREATE POLICY "time_entry_breaks_delete" ON public.time_entry_breaks
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.time_entries e
      WHERE e.id = time_entry_id
        AND (e.user_id = auth.uid() OR public.is_admin())
    )
  );

DROP POLICY IF EXISTS "time_entries_insert_admin" ON public.time_entries;
CREATE POLICY "time_entries_insert_admin" ON public.time_entries
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "time_entries_delete_own_or_admin" ON public.time_entries;
CREATE POLICY "time_entries_delete_own_or_admin" ON public.time_entries
  FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());
