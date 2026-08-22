-- Allow Super Admin / Institute Admin to view the login password set for users.
-- Login still verifies password_hash (SHA-256). password_plain is for admin display only.
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_plain VARCHAR(100);
NOTIFY pgrst, 'reload schema';
