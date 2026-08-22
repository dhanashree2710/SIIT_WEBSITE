-- Feedback forms (1st / 2nd) + columns columns
CREATE TABLE IF NOT EXISTS feedback_forms (
  id BIGSERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  form_type VARCHAR(20) NOT NULL CHECK (form_type IN ('first', 'second')),
  batch_id BIGINT REFERENCES batches(id) ON DELETE SET NULL,
  course_id BIGINT REFERENCES courses(id) ON DELETE SET NULL,
  college_id BIGINT REFERENCES colleges(id) ON DELETE SET NULL,
  description TEXT,
  form_url TEXT,
  fields_json JSONB DEFAULT '[]'::jsonb,
  status VARCHAR(20) NOT NULL DEFAULT 'Draft'
    CHECK (status IN ('Draft', 'Published', 'Closed')),
  sort_order INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_feedback_forms_batch ON feedback_forms(batch_id);
CREATE INDEX IF NOT EXISTS idx_feedback_forms_type ON feedback_forms(form_type);
CREATE INDEX IF NOT EXISTS idx_feedback_forms_status ON feedback_forms(status);

ALTER TABLE student_feedback ADD COLUMN IF NOT EXISTS form_id BIGINT REFERENCES feedback_forms(id) ON DELETE SET NULL;
ALTER TABLE student_feedback ADD COLUMN IF NOT EXISTS form_type VARCHAR(20);
ALTER TABLE student_feedback ADD COLUMN IF NOT EXISTS answers_json JSONB DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_student_feedback_form ON student_feedback(form_id);
CREATE INDEX IF NOT EXISTS idx_student_feedback_batch ON student_feedback(batch_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_feedback_student_form
  ON student_feedback (student_id, form_id)
  WHERE form_id IS NOT NULL;

-- Public read for published forms (student portal, no login)
-- Adjust if you use stricter RLS; anon needs SELECT on published forms + insert feedback
