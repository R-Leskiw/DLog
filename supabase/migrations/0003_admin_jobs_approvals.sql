-- =============================================================================
-- BuildTrack: admin role, signup approval, and jobs admin RLS
-- Run in: Supabase Dashboard → SQL Editor → New query → Run
-- After this: promote your first admin (see SETUP.md)
-- =============================================================================

-- Allow admin on profiles.role
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IS NULL OR role IN ('employee', 'client', 'admin'));

-- Approval workflow
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS approval_status TEXT;

UPDATE public.profiles
SET approval_status = 'approved'
WHERE approval_status IS NULL;

ALTER TABLE public.profiles
  ALTER COLUMN approval_status SET DEFAULT 'pending';

ALTER TABLE public.profiles
  ALTER COLUMN approval_status SET NOT NULL;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_approval_status_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_approval_status_check
  CHECK (approval_status IN ('pending', 'approved', 'rejected'));

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Helper: current user is an approved admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'admin'
      AND p.approval_status = 'approved'
  );
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- Prevent non-admins from self-approving or self-assigning admin
CREATE OR REPLACE FUNCTION public.protect_profile_privileged_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- SQL Editor / service role has no JWT — allow bootstrap (first admin promote).
  IF auth.uid() IS NULL OR public.is_admin() THEN
    RETURN NEW;
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role AND NEW.role = 'admin' THEN
    NEW.role := OLD.role;
  END IF;

  IF NEW.approval_status IS DISTINCT FROM OLD.approval_status
     AND NEW.approval_status = 'approved' THEN
    NEW.approval_status := OLD.approval_status;
  END IF;

  NEW.reviewed_at := OLD.reviewed_at;
  NEW.reviewed_by := OLD.reviewed_by;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_protect_privileged ON public.profiles;
CREATE TRIGGER profiles_protect_privileged
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profile_privileged_columns();

-- New signups start pending
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  requested TEXT;
BEGIN
  requested := COALESCE(NEW.raw_user_meta_data->>'role', 'client');
  IF requested NOT IN ('employee', 'client') THEN
    requested := 'client';
  END IF;

  INSERT INTO public.profiles (id, full_name, role, approval_status)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    requested,
    'pending'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Jobs: admins can insert/update
DROP POLICY IF EXISTS "jobs_insert_admin" ON public.jobs;
CREATE POLICY "jobs_insert_admin" ON public.jobs
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "jobs_update_admin" ON public.jobs;
CREATE POLICY "jobs_update_admin" ON public.jobs
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Daily logs: admins can create/update like employees
DROP POLICY IF EXISTS "daily_logs_insert_employee" ON public.daily_logs;
CREATE POLICY "daily_logs_insert_employee" ON public.daily_logs
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('employee', 'admin')
        AND p.approval_status = 'approved'
    )
  );

DROP POLICY IF EXISTS "daily_logs_update_own_employee" ON public.daily_logs;
CREATE POLICY "daily_logs_update_own_employee" ON public.daily_logs
  FOR UPDATE TO authenticated
  USING (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('employee', 'admin')
        AND p.approval_status = 'approved'
    )
  )
  WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('employee', 'admin')
        AND p.approval_status = 'approved'
    )
  );

-- Admins can update any profile (approve / change role)
DROP POLICY IF EXISTS "profiles_update_admin" ON public.profiles;
CREATE POLICY "profiles_update_admin" ON public.profiles
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
