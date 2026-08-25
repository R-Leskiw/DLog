-- =============================================================================
-- BuildTrack: estimates as signable proposals (versioning, e-sign, share links)
-- Run in: Supabase SQL Editor → New query → Run entire file
-- Also creates private Storage bucket `estimate-docs`
-- =============================================================================

-- Jobs: client contact for sending estimates
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS client_name TEXT,
  ADD COLUMN IF NOT EXISTS client_email TEXT,
  ADD COLUMN IF NOT EXISTS client_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS jobs_client_user_id_idx ON public.jobs (client_user_id);

-- Estimates: versioning, cover, share token, signature lock
ALTER TABLE public.estimates
  ADD COLUMN IF NOT EXISTS version INT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS parent_estimate_id UUID REFERENCES public.estimates(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cover_note TEXT,
  ADD COLUMN IF NOT EXISTS share_token TEXT,
  ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS signed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS signed_name TEXT,
  ADD COLUMN IF NOT EXISTS signature_image_path TEXT,
  ADD COLUMN IF NOT EXISTS declined_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pdf_path TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS estimates_share_token_uidx
  ON public.estimates (share_token)
  WHERE share_token IS NOT NULL;

CREATE INDEX IF NOT EXISTS estimates_parent_id_idx ON public.estimates (parent_estimate_id);

-- Company-wide contract PDF (single row)
CREATE TABLE IF NOT EXISTS public.company_settings (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  contract_pdf_path TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO public.company_settings (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "company_settings_select_staff" ON public.company_settings;
CREATE POLICY "company_settings_select_staff" ON public.company_settings
  FOR SELECT TO authenticated
  USING (public.is_staff());

DROP POLICY IF EXISTS "company_settings_write_admin" ON public.company_settings;
CREATE POLICY "company_settings_write_admin" ON public.company_settings
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Audit trail
CREATE TABLE IF NOT EXISTS public.estimate_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  estimate_id UUID NOT NULL REFERENCES public.estimates(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  from_status TEXT,
  to_status TEXT,
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_label TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS estimate_audit_estimate_id_idx
  ON public.estimate_audit (estimate_id, created_at DESC);

ALTER TABLE public.estimate_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "estimate_audit_select_staff" ON public.estimate_audit;
CREATE POLICY "estimate_audit_select_staff" ON public.estimate_audit
  FOR SELECT TO authenticated
  USING (public.is_staff());

DROP POLICY IF EXISTS "estimate_audit_insert_staff" ON public.estimate_audit;
CREATE POLICY "estimate_audit_insert_staff" ON public.estimate_audit
  FOR INSERT TO authenticated
  WITH CHECK (public.is_staff());

-- Lock signed / declined estimates (the signing/decline UPDATE itself is allowed)
CREATE OR REPLACE FUNCTION public.prevent_locked_estimate_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_TABLE_NAME = 'estimates' THEN
    IF TG_OP = 'DELETE' THEN
      IF OLD.signed_at IS NOT NULL OR OLD.status = 'declined' THEN
        RAISE EXCEPTION 'This estimate is locked after it was signed or declined.';
      END IF;
      RETURN OLD;
    END IF;

    IF OLD.signed_at IS NOT NULL THEN
      RAISE EXCEPTION 'This estimate is locked after client signature.';
    END IF;
    IF OLD.status = 'declined' THEN
      RAISE EXCEPTION 'This estimate is locked after it was declined. Duplicate it as a new version.';
    END IF;
    RETURN NEW;
  END IF;

  -- estimate_line_items
  IF TG_OP = 'DELETE' THEN
    IF EXISTS (
      SELECT 1 FROM public.estimates e
      WHERE e.id = OLD.estimate_id
        AND (e.signed_at IS NOT NULL OR e.status = 'declined')
    ) THEN
      RAISE EXCEPTION 'This estimate is locked after it was signed or declined.';
    END IF;
    RETURN OLD;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.estimates e
    WHERE e.id = NEW.estimate_id
      AND (e.signed_at IS NOT NULL OR e.status = 'declined')
  ) THEN
    RAISE EXCEPTION 'This estimate is locked after it was signed or declined.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS estimates_lock_mutation ON public.estimates;
CREATE TRIGGER estimates_lock_mutation
  BEFORE UPDATE OR DELETE ON public.estimates
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_locked_estimate_mutation();

DROP TRIGGER IF EXISTS estimate_lines_lock_mutation ON public.estimate_line_items;
CREATE TRIGGER estimate_lines_lock_mutation
  BEFORE INSERT OR UPDATE OR DELETE ON public.estimate_line_items
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_locked_estimate_mutation();

-- RLS: clients see sent+ estimates for jobs linked to them
DROP POLICY IF EXISTS "estimates_select_staff" ON public.estimates;
DROP POLICY IF EXISTS "estimates_select_staff_or_client" ON public.estimates;
CREATE POLICY "estimates_select_staff_or_client" ON public.estimates
  FOR SELECT TO authenticated
  USING (
    public.is_staff()
    OR (
      status IN ('sent', 'accepted', 'declined')
      AND job_id IN (
        SELECT j.id FROM public.jobs j
        WHERE j.client_user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "estimate_lines_select_staff" ON public.estimate_line_items;
DROP POLICY IF EXISTS "estimate_lines_select_staff_or_client" ON public.estimate_line_items;
CREATE POLICY "estimate_lines_select_staff_or_client" ON public.estimate_line_items
  FOR SELECT TO authenticated
  USING (
    public.is_staff()
    OR EXISTS (
      SELECT 1 FROM public.estimates e
      JOIN public.jobs j ON j.id = e.job_id
      WHERE e.id = estimate_id
        AND e.status IN ('sent', 'accepted', 'declined')
        AND j.client_user_id = auth.uid()
    )
  );

-- Private storage for contract PDFs, generated PDFs, signature images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'estimate-docs',
  'estimate-docs',
  false,
  20971520,
  ARRAY['application/pdf', 'image/png', 'image/jpeg']
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "estimate_docs_admin_insert" ON storage.objects;
CREATE POLICY "estimate_docs_admin_insert"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'estimate-docs'
    AND public.is_admin()
  );

DROP POLICY IF EXISTS "estimate_docs_admin_update" ON storage.objects;
CREATE POLICY "estimate_docs_admin_update"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'estimate-docs' AND public.is_admin())
  WITH CHECK (bucket_id = 'estimate-docs' AND public.is_admin());

DROP POLICY IF EXISTS "estimate_docs_admin_delete" ON storage.objects;
CREATE POLICY "estimate_docs_admin_delete"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'estimate-docs' AND public.is_admin());

DROP POLICY IF EXISTS "estimate_docs_staff_select" ON storage.objects;
CREATE POLICY "estimate_docs_staff_select"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'estimate-docs' AND public.is_staff());
