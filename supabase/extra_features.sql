-- Extra columns & policies for new features
-- Run in Supabase SQL Editor

-- Trainer employment type
ALTER TABLE trainers ADD COLUMN IF NOT EXISTS employment_type varchar(30) DEFAULT 'Full-Time';

-- Student links to short term / training internship
ALTER TABLE students ADD COLUMN IF NOT EXISTS short_term_course_id bigint;
ALTER TABLE students ADD COLUMN IF NOT EXISTS training_internship_id bigint;

-- Placed candidates extras
ALTER TABLE placed_candidates ADD COLUMN IF NOT EXISTS student_name varchar(150);
ALTER TABLE placed_candidates ADD COLUMN IF NOT EXISTS student_photo text;
ALTER TABLE placed_candidates ADD COLUMN IF NOT EXISTS short_term_course_id bigint;
ALTER TABLE placed_candidates ADD COLUMN IF NOT EXISTS training_internship_id bigint;
-- Allow student_id nullable when only name is entered (optional)
ALTER TABLE placed_candidates ALTER COLUMN student_id DROP NOT NULL;

-- Public read placed for homepage
ALTER TABLE placed_candidates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public_read_placed" ON placed_candidates;
CREATE POLICY "public_read_placed" ON placed_candidates FOR SELECT USING (true);

ALTER TABLE training_internships ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "dev_ti" ON training_internships;
CREATE POLICY "dev_ti" ON training_internships FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE short_term_certificates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "dev_stc_cert" ON short_term_certificates;
CREATE POLICY "dev_stc_cert" ON short_term_certificates FOR ALL USING (true) WITH CHECK (true);

NOTIFY pgrst, 'reload schema';
