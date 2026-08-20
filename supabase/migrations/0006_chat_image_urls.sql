-- =============================================================================
-- Team chat: attach photos to messages
-- Run in: Supabase SQL Editor after 0004
-- Uploads reuse the existing public `log-images` bucket (same storage policies).
-- =============================================================================

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS image_urls TEXT[] NOT NULL DEFAULT '{}';
