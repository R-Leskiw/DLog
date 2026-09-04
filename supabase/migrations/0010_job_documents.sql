-- =============================================================================
-- BuildTrack: job document library (folders + versioned files)
-- Run in: Supabase SQL Editor → New query → Run entire file
-- After: 0003 (is_staff / is_admin) and jobs table
-- Creates private Storage bucket `job-docs`
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.job_folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT job_folders_name_not_blank CHECK (length(trim(name)) > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS job_folders_job_name_uidx
  ON public.job_folders (job_id, lower(trim(name)));

CREATE INDEX IF NOT EXISTS job_folders_job_id_idx
  ON public.job_folders (job_id, sort_order);

CREATE TABLE IF NOT EXISTS public.job_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  folder_id UUID NOT NULL REFERENCES public.job_folders(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  current_version INTEGER NOT NULL DEFAULT 1,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT job_documents_name_not_blank CHECK (length(trim(display_name)) > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS job_documents_folder_name_uidx
  ON public.job_documents (folder_id, lower(trim(display_name)));

CREATE INDEX IF NOT EXISTS job_documents_folder_id_idx
  ON public.job_documents (folder_id);

CREATE TABLE IF NOT EXISTS public.job_document_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.job_documents(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  storage_path TEXT NOT NULL,
  mime_type TEXT,
  file_size BIGINT,
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT job_document_versions_unique UNIQUE (document_id, version)
);

CREATE INDEX IF NOT EXISTS job_document_versions_doc_idx
  ON public.job_document_versions (document_id, version DESC);

ALTER TABLE public.job_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_document_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "job_folders_select_staff" ON public.job_folders;
CREATE POLICY "job_folders_select_staff" ON public.job_folders
  FOR SELECT TO authenticated
  USING (public.is_staff());

DROP POLICY IF EXISTS "job_folders_write_admin" ON public.job_folders;
CREATE POLICY "job_folders_write_admin" ON public.job_folders
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "job_documents_select_staff" ON public.job_documents;
CREATE POLICY "job_documents_select_staff" ON public.job_documents
  FOR SELECT TO authenticated
  USING (public.is_staff());

DROP POLICY IF EXISTS "job_documents_write_staff" ON public.job_documents;
CREATE POLICY "job_documents_write_staff" ON public.job_documents
  FOR ALL TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

DROP POLICY IF EXISTS "job_document_versions_select_staff" ON public.job_document_versions;
CREATE POLICY "job_document_versions_select_staff" ON public.job_document_versions
  FOR SELECT TO authenticated
  USING (public.is_staff());

DROP POLICY IF EXISTS "job_document_versions_write_staff" ON public.job_document_versions;
CREATE POLICY "job_document_versions_write_staff" ON public.job_document_versions
  FOR ALL TO authenticated
  USING (public.is_staff())
  WITH CHECK (public.is_staff());

-- Seed default folders for a job
CREATE OR REPLACE FUNCTION public.seed_job_default_folders(p_job_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.job_folders (job_id, name, sort_order, is_default)
  SELECT p_job_id, v.name, v.sort_order, true
  FROM (
    VALUES
      ('Plans', 10),
      ('Permits', 20),
      ('Photos', 30),
      ('Internal', 40)
  ) AS v(name, sort_order)
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.job_folders f
    WHERE f.job_id = p_job_id
      AND lower(trim(f.name)) = lower(trim(v.name))
  );
END;
$$;

REVOKE ALL ON FUNCTION public.seed_job_default_folders(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.seed_job_default_folders(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.trg_jobs_seed_folders()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.seed_job_default_folders(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS jobs_seed_folders ON public.jobs;
CREATE TRIGGER jobs_seed_folders
  AFTER INSERT ON public.jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_jobs_seed_folders();

-- Backfill existing jobs
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.jobs LOOP
    PERFORM public.seed_job_default_folders(r.id);
  END LOOP;
END $$;

-- Private storage for job documents
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'job-docs',
  'job-docs',
  false,
  52428800,
  ARRAY[
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/gif',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "job_docs_staff_select" ON storage.objects;
CREATE POLICY "job_docs_staff_select"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'job-docs' AND public.is_staff());

DROP POLICY IF EXISTS "job_docs_staff_insert" ON storage.objects;
CREATE POLICY "job_docs_staff_insert"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'job-docs' AND public.is_staff());

DROP POLICY IF EXISTS "job_docs_staff_update" ON storage.objects;
CREATE POLICY "job_docs_staff_update"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'job-docs' AND public.is_staff())
  WITH CHECK (bucket_id = 'job-docs' AND public.is_staff());

DROP POLICY IF EXISTS "job_docs_staff_delete" ON storage.objects;
CREATE POLICY "job_docs_staff_delete"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'job-docs' AND public.is_staff());
