-- Create storage bucket for task submissions (run in Supabase SQL or Storage UI)
INSERT INTO storage.buckets (id, name, public)
VALUES ('tasks', 'tasks', true)
ON CONFLICT (id) DO NOTHING;

-- Allow anon/authenticated upload/read (adjust for production)
CREATE POLICY IF NOT EXISTS "tasks_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'tasks');
CREATE POLICY IF NOT EXISTS "tasks_auth_upload" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'tasks');
CREATE POLICY IF NOT EXISTS "tasks_auth_update" ON storage.objects
  FOR UPDATE USING (bucket_id = 'tasks');
