-- Fix Institute Admin login (password was stored as plain text "admin@123")
-- Hash of admin@123 with salt siit_salt_2024:
UPDATE users SET
  password_hash = '3c69b112f19a8d017ce83ca47ae4ff895c305bce99d7e95bd0226b2c3b753502',
  password_plain = 'admin@123',
  status = true,
  updated_at = NOW()
WHERE email = 'instituteadmin@sujatainstitute.com';

-- Optional: fix common demo admin too
UPDATE users SET
  password_hash = '6aad1715484dea9b15e182c2eaf77cfe2c653b6e9b25ce295998747ad0f32e8b',
  password_plain = 'admin123',
  status = true,
  updated_at = NOW()
WHERE email = 'admin@sujatainstitute.com'
  AND (password_hash IS NULL OR password_hash = 'admin123' OR length(password_hash) < 40);

-- Ensure password_plain column exists
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_plain VARCHAR(100);
NOTIFY pgrst, 'reload schema';
