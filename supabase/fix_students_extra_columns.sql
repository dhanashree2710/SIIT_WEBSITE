-- Fix: students form sends short_term_course_id / training_internship_id
-- but the live students table does not have those columns yet.

ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS short_term_course_id bigint null,
  ADD COLUMN IF NOT EXISTS training_internship_id bigint null,
  ADD COLUMN IF NOT EXISTS university_enrollment_no character varying(80) null,
  ADD COLUMN IF NOT EXISTS section character varying(20) null;

-- Optional FKs (ignore if referenced tables do not exist)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='short_term_courses') THEN
    BEGIN
      ALTER TABLE public.students
        ADD CONSTRAINT fk_student_stc
        FOREIGN KEY (short_term_course_id) REFERENCES public.short_term_courses(id) ON DELETE SET NULL;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='training_internships') THEN
    BEGIN
      ALTER TABLE public.students
        ADD CONSTRAINT fk_student_ti
        FOREIGN KEY (training_internship_id) REFERENCES public.training_internships(id) ON DELETE SET NULL;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
