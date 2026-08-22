-- Allow 1,2,3,4,6,12 months (form options for short-term / college batches)
ALTER TABLE public.batches DROP CONSTRAINT IF EXISTS batches_duration_months_check;

ALTER TABLE public.batches
  ADD CONSTRAINT batches_duration_months_check
  CHECK (
    duration_months IS NULL
    OR duration_months = ANY (ARRAY[1, 2, 3, 4, 6, 12])
  );

UPDATE public.batches
SET duration_months = NULL
WHERE duration_months IS NOT NULL
  AND duration_months NOT IN (1, 2, 3, 4, 6, 12);

NOTIFY pgrst, 'reload schema';
