-- Trainer presenty + batch attendance QR for assigned trainers
-- Run in Supabase SQL Editor after core schema.

-- 1) Batch-level QR token (students scan SIIT_BATCH:<token>)
ALTER TABLE public.batches
  ADD COLUMN IF NOT EXISTS attendance_qr_token UUID DEFAULT gen_random_uuid();

CREATE UNIQUE INDEX IF NOT EXISTS idx_batches_attendance_qr_token
  ON public.batches (attendance_qr_token)
  WHERE attendance_qr_token IS NOT NULL;

-- Backfill tokens for existing batches
UPDATE public.batches
SET attendance_qr_token = gen_random_uuid()
WHERE attendance_qr_token IS NULL;

-- 2) Trainer employment type (if missing)
ALTER TABLE public.trainers
  ADD COLUMN IF NOT EXISTS employment_type VARCHAR(30) DEFAULT 'Full-Time';

-- 3) Ensure trainer_attendance exists (from schema) + helpful index
CREATE TABLE IF NOT EXISTS public.trainer_attendance (
    id BIGSERIAL PRIMARY KEY,
    trainer_id BIGINT NOT NULL REFERENCES public.trainers(id) ON DELETE CASCADE,
    attendance_date DATE NOT NULL,
    check_in TIMESTAMPTZ,
    check_out TIMESTAMPTZ,
    status VARCHAR(20) DEFAULT 'Present',
    remarks TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_trainer_attendance UNIQUE (trainer_id, attendance_date)
);

CREATE INDEX IF NOT EXISTS idx_trainer_attendance_date
  ON public.trainer_attendance (attendance_date DESC);

CREATE INDEX IF NOT EXISTS idx_trainer_attendance_trainer
  ON public.trainer_attendance (trainer_id, attendance_date DESC);

-- Open RLS for app (matches rest of project style)
ALTER TABLE public.trainer_attendance ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "open_trainer_attendance" ON public.trainer_attendance;
CREATE POLICY "open_trainer_attendance" ON public.trainer_attendance
  FOR ALL USING (true) WITH CHECK (true);

NOTIFY pgrst, 'reload schema';
