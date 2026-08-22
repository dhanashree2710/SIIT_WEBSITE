-- Adds a URL-friendly `slug` to colleges, used to link
-- short-term.html (college grid) -> short-term-college.html?college=<slug>.
-- Safe to run multiple times.

ALTER TABLE public.colleges ADD COLUMN IF NOT EXISTS slug character varying;
CREATE UNIQUE INDEX IF NOT EXISTS colleges_slug_key ON public.colleges (slug) WHERE slug IS NOT NULL;

-- Backfill slugs for colleges that already have appreciation-letter reviews
-- in short_term_college_reviews, so existing review links keep working.
-- Adjust the ILIKE patterns if your college_name values differ.
UPDATE public.colleges SET slug = 'baburaoji-gholap'   WHERE slug IS NULL AND college_name ILIKE '%Baburaoji Gholap%';
UPDATE public.colleges SET slug = 'dpu-pimpri'          WHERE slug IS NULL AND college_name ILIKE '%D. Y. Patil%';
UPDATE public.colleges SET slug = 'atss-cbsca'          WHERE slug IS NULL AND college_name ILIKE '%ATSS%';
UPDATE public.colleges SET slug = 'indira-university'   WHERE slug IS NULL AND college_name ILIKE '%Indira University%';
UPDATE public.colleges SET slug = 'camp-ces-telang'     WHERE slug IS NULL AND college_name ILIKE '%Telang%';
UPDATE public.colleges SET slug = 'mamasaheb-mohol'     WHERE slug IS NULL AND college_name ILIKE '%Mamasaheb Mohol%';
UPDATE public.colleges SET slug = 'matrix-sms'          WHERE slug IS NULL AND college_name ILIKE '%Matrix School%';
UPDATE public.colleges SET slug = 'rayat-ambedkar'      WHERE slug IS NULL AND college_name ILIKE '%Babasaheb Ambedkar%';

-- Auto-generate a slug for every other college that still has none,
-- so the site never falls back to guessing at request time.
UPDATE public.colleges
SET slug = trim(both '-' from regexp_replace(lower(college_name), '[^a-z0-9]+', '-', 'g'))
WHERE slug IS NULL;
