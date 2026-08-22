-- ============================================================
-- Fix batches: duration_months + optional Short Term / TI links
-- + multi-trainer support via batch_trainers
-- Run once in Supabase SQL Editor
-- ============================================================

-- 1) Extra columns on batches
ALTER TABLE public.batches
  ADD COLUMN IF NOT EXISTS duration_months integer null
    CHECK (duration_months IS NULL OR duration_months IN (2, 6));

ALTER TABLE public.batches
  ADD COLUMN IF NOT EXISTS short_term_course_id bigint null;

ALTER TABLE public.batches
  ADD COLUMN IF NOT EXISTS training_internship_id uuid null;
  -- if your training_internships.id is bigint instead of uuid, use:
  -- ADD COLUMN IF NOT EXISTS training_internship_id bigint null;

COMMENT ON COLUMN public.batches.duration_months IS 'Program length: 2 or 6 months (attendance planning)';
COMMENT ON COLUMN public.batches.short_term_course_id IS 'Optional link to short_term_courses catalog';
COMMENT ON COLUMN public.batches.training_internship_id IS 'Optional link to training_internships program';

-- Optional FKs (ignore if already exist / parent missing)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='short_term_courses') THEN
    BEGIN
      ALTER TABLE public.batches
        ADD CONSTRAINT fk_batch_stc
        FOREIGN KEY (short_term_course_id) REFERENCES public.short_term_courses(id) ON DELETE SET NULL;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='training_internships') THEN
    BEGIN
      -- Adjust type if training_internships.id is bigint
      ALTER TABLE public.batches
        ADD CONSTRAINT fk_batch_ti
        FOREIGN KEY (training_internship_id) REFERENCES public.training_internships(id) ON DELETE SET NULL;
    EXCEPTION WHEN duplicate_object THEN NULL; WHEN datatype_mismatch THEN NULL;
    END;
  END IF;
END $$;

-- 2) Multi-trainer junction table
CREATE TABLE IF NOT EXISTS public.batch_trainers (
  id bigserial PRIMARY KEY,
  batch_id bigint NOT NULL REFERENCES public.batches(id) ON DELETE CASCADE,
  trainer_id bigint NOT NULL REFERENCES public.trainers(id) ON DELETE CASCADE,
  is_primary boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT uq_batch_trainer UNIQUE (batch_id, trainer_id)
);

CREATE INDEX IF NOT EXISTS idx_batch_trainers_batch ON public.batch_trainers(batch_id);
CREATE INDEX IF NOT EXISTS idx_batch_trainers_trainer ON public.batch_trainers(trainer_id);

-- Keep existing single trainer_id as optional "primary" for backward compatibility
-- (attendance / other pages still read batches.trainer_id)

ALTER TABLE public.batch_trainers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "open_batch_trainers" ON public.batch_trainers;
CREATE POLICY "open_batch_trainers" ON public.batch_trainers FOR ALL USING (true) WITH CHECK (true);

NOTIFY pgrst, 'reload schema';
