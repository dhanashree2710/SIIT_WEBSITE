-- ============================================================
-- Supabase Storage Buckets + optional file_url columns
-- Run in SQL Editor / create buckets in Storage UI
-- ============================================================

-- 1) Create these buckets in Supabase Dashboard → Storage → New bucket
--    (or use API). Recommended:

-- Bucket name        | Public | Purpose
-- -------------------|--------|---------------------------
-- company            | Yes    | Company logos
-- profiles           | Yes    | Student / trainer / user photos
-- certificates       | Yes    | Certificate PDFs
-- students           | No     | Student documents
-- quiz               | No     | Quiz files with answers
-- assessment         | No     | Assessment files with answers
-- tasks              | No     | Task attachments
-- gallery            | Yes    | Website gallery
-- blogs              | Yes    | Blog cover images

-- 2) Optional columns for file uploads (if not present):

ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS file_url TEXT;
ALTER TABLE assessments ADD COLUMN IF NOT EXISTS file_url TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS logo_url TEXT; -- usually already exists
ALTER TABLE trainers ADD COLUMN IF NOT EXISTS profile_photo TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS profile_photo TEXT;

-- 3) Storage policies example (public read for company logos):
-- In Storage → company → Policies:
--   Allow public SELECT (read)
--   Allow authenticated INSERT/UPDATE (or anon for dev)

-- Dev-friendly: allow anon upload (restrict in production!)
-- CREATE POLICY "anon upload company" ON storage.objects
--   FOR INSERT TO anon WITH CHECK (bucket_id = 'company');
-- CREATE POLICY "public read company" ON storage.objects
--   FOR SELECT TO public USING (bucket_id = 'company');
