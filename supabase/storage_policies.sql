-- =============================================================================
-- BuildTrack: Storage policies for bucket `log-images`
--
-- 1. Dashboard → Storage → New bucket → name: log-images
-- 2. Public bucket: ON (MVP — public image URLs in feed)
-- 3. Run this script in SQL Editor (after the bucket exists)
-- =============================================================================

DROP POLICY IF EXISTS "log_images_insert_authenticated" ON storage.objects;
CREATE POLICY "log_images_insert_authenticated"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'log-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Public bucket: object reads are allowed without a SELECT policy.
-- If you make the bucket private, uncomment:
-- DROP POLICY IF EXISTS "log_images_select_authenticated" ON storage.objects;
-- CREATE POLICY "log_images_select_authenticated"
--   ON storage.objects
--   FOR SELECT
--   TO authenticated
--   USING (bucket_id = 'log-images');
