-- ============================================================
-- SIIT ERP — Feature additions (Aug 2026)
-- 1) Modules for Training+Internship programs & Short Term courses
--    (course_modules already exists for the main `courses` table)
-- 2) Helper indexes for the public no-login flows (QR attendance,
--    roll-no quiz/feedback attempts)
-- Run this once in the Supabase SQL Editor.
-- ============================================================

-- ---- Training + Internship modules -------------------------
CREATE TABLE IF NOT EXISTS public.training_internship_modules (
  id BIGSERIAL PRIMARY KEY,
  training_internship_id BIGINT NOT NULL REFERENCES training_internships(id) ON DELETE CASCADE,
  module_name VARCHAR(200) NOT NULL,
  module_order INTEGER,
  duration_hours NUMERIC(5,2),
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ---- Short Term course modules -------------------------------
CREATE TABLE IF NOT EXISTS public.short_term_course_modules (
  id BIGSERIAL PRIMARY KEY,
  short_term_course_id BIGINT NOT NULL REFERENCES short_term_courses(id) ON DELETE CASCADE,
  module_name VARCHAR(200) NOT NULL,
  module_order INTEGER,
  duration_hours NUMERIC(5,2),
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Public listing pages need to read `training_internships` — make sure it's
-- reachable the same way `short_term_courses` already is (no RLS = open,
-- matching the rest of this project's tables). If RLS was turned on for it
-- in the dashboard, this policy keeps both admin (anon key) and the public
-- website working.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='training_internships') THEN
    EXECUTE 'ALTER TABLE training_internships ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "open_ti" ON training_internships';
    EXECUTE 'CREATE POLICY "open_ti" ON training_internships FOR ALL USING (true) WITH CHECK (true)';
  END IF;
END $$;

ALTER TABLE training_internship_modules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "open_ti_modules" ON training_internship_modules;
CREATE POLICY "open_ti_modules" ON training_internship_modules FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE short_term_course_modules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "open_stc_modules" ON short_term_course_modules;
CREATE POLICY "open_stc_modules" ON short_term_course_modules FOR ALL USING (true) WITH CHECK (true);

-- The shared admin panel helper (AdminCRUD.update) always stamps
-- `updated_at` on every update — make sure every editable table has it.
ALTER TABLE course_modules ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE training_internship_modules ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE short_term_course_modules ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- ---- Helpful indexes for the roll-no / QR public flows --------
CREATE INDEX IF NOT EXISTS idx_students_roll_ci ON students (lower(college_roll_no));
CREATE INDEX IF NOT EXISTS idx_attendance_qr_token ON attendance_qr (qr_token);
CREATE INDEX IF NOT EXISTS idx_quizzes_status ON quizzes (status);
CREATE INDEX IF NOT EXISTS idx_quiz_questions_quiz ON quiz_questions (quiz_id);
CREATE INDEX IF NOT EXISTS idx_quiz_options_question ON quiz_options (question_id);

NOTIFY pgrst, 'reload schema';
