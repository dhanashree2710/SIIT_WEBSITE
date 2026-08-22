-- Batch program duration: 2 months or 6 months (for attendance planning)
ALTER TABLE public.batches
  ADD COLUMN IF NOT EXISTS duration_months integer null
    CHECK (duration_months IS NULL OR duration_months IN (2, 6));

COMMENT ON COLUMN public.batches.duration_months IS 'Program length: 2 or 6 months';

-- Helpful index for batch-wise session lookup
CREATE INDEX IF NOT EXISTS idx_attendance_sessions_batch_date
  ON public.attendance_sessions (batch_id, session_date);

NOTIFY pgrst, 'reload schema';
