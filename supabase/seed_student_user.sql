-- ============================================================
-- Create a Student role login linked to a students row by email
-- Run in Supabase SQL Editor after schema + roles are seeded.
-- ============================================================
-- 1) Password hash for "student123":
--    In browser console (any page with SIIT loaded):
--      SIIT.hashPassword('student123').then(console.log)
--    Paste the hex string below.

-- Example (replace HASH and emails as needed):
/*
INSERT INTO users (role_id, college_id, full_name, email, password_hash, status)
VALUES (
  (SELECT id FROM roles WHERE role_name = 'Student' LIMIT 1),
  (SELECT college_id FROM students WHERE email = 'student@example.com' LIMIT 1),
  (SELECT full_name FROM students WHERE email = 'student@example.com' LIMIT 1),
  'student@example.com',
  '<paste_sha256_hash_here>',
  true
)
ON CONFLICT (email) DO UPDATE SET
  role_id = EXCLUDED.role_id,
  password_hash = EXCLUDED.password_hash,
  status = true;
*/

-- Ensure the students row has the SAME email as the users login email.
-- StudentWorkspace resolves the profile with:
--   students.email ILIKE users.email
