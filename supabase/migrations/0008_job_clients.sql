-- =============================================================================
-- BuildTrack: multiple clients per job (e.g. both spouses)
-- Run in: Supabase SQL Editor → New query → Run entire file
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.job_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  client_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS job_clients_job_id_idx ON public.job_clients (job_id);
CREATE INDEX IF NOT EXISTS job_clients_user_id_idx ON public.job_clients (client_user_id);

CREATE UNIQUE INDEX IF NOT EXISTS job_clients_job_email_uidx
  ON public.job_clients (job_id, lower(email));

CREATE OR REPLACE FUNCTION public.job_ids_for_client()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT job_id FROM public.job_clients WHERE client_user_id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.job_ids_for_client() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.job_ids_for_client() TO authenticated;

ALTER TABLE public.job_clients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "job_clients_select_staff_or_self" ON public.job_clients;
CREATE POLICY "job_clients_select_staff_or_self" ON public.job_clients
  FOR SELECT TO authenticated
  USING (
    public.is_staff()
    OR client_user_id = auth.uid()
    OR job_id IN (SELECT public.job_ids_for_client())
  );

DROP POLICY IF EXISTS "job_clients_write_admin" ON public.job_clients;
CREATE POLICY "job_clients_write_admin" ON public.job_clients
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Copy the previous single-client fields onto the new table
INSERT INTO public.job_clients (job_id, full_name, email, client_user_id, sort_order)
SELECT
  j.id,
  COALESCE(NULLIF(trim(j.client_name), ''), 'Client'),
  trim(j.client_email),
  j.client_user_id,
  0
FROM public.jobs j
WHERE j.client_email IS NOT NULL
  AND trim(j.client_email) <> ''
  AND NOT EXISTS (
    SELECT 1 FROM public.job_clients jc
    WHERE jc.job_id = j.id
      AND lower(jc.email) = lower(trim(j.client_email))
  );

-- Portal access: any linked job_clients row, not only jobs.client_user_id
DROP POLICY IF EXISTS "estimates_select_staff_or_client" ON public.estimates;
CREATE POLICY "estimates_select_staff_or_client" ON public.estimates
  FOR SELECT TO authenticated
  USING (
    public.is_staff()
    OR (
      status IN ('sent', 'accepted', 'declined')
      AND job_id IN (SELECT public.job_ids_for_client())
    )
  );

DROP POLICY IF EXISTS "estimate_lines_select_staff_or_client" ON public.estimate_line_items;
CREATE POLICY "estimate_lines_select_staff_or_client" ON public.estimate_line_items
  FOR SELECT TO authenticated
  USING (
    public.is_staff()
    OR EXISTS (
      SELECT 1 FROM public.estimates e
      JOIN public.job_clients jc ON jc.job_id = e.job_id
      WHERE e.id = estimate_id
        AND e.status IN ('sent', 'accepted', 'declined')
        AND jc.client_user_id = auth.uid()
    )
  );
