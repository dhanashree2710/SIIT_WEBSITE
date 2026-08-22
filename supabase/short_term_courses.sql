-- Short term courses + college appreciation reviews
CREATE TABLE IF NOT EXISTS public.short_term_courses (
  id bigserial PRIMARY KEY,
  sr_no integer NOT NULL UNIQUE,
  course_name character varying(255) NOT NULL,
  course_duration character varying(100) NOT NULL,
  no_of_credits integer NOT NULL,
  stream character varying(100) NOT NULL,
  status boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.short_term_college_reviews (
  id bigserial PRIMARY KEY,
  college_slug varchar(100) NOT NULL,
  title varchar(255),
  coordinator_name varchar(150),
  program_date date,
  students_count integer,
  review_text text,
  letter_image_url text,
  logo_url text,
  is_published boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE short_term_courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE short_term_college_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_stc" ON short_term_courses;
CREATE POLICY "public_read_stc" ON short_term_courses FOR SELECT USING (status = true);

DROP POLICY IF EXISTS "public_read_stc_reviews" ON short_term_college_reviews;
CREATE POLICY "public_read_stc_reviews" ON short_term_college_reviews FOR SELECT USING (is_published = true);

-- Example seed (edit as needed)
INSERT INTO short_term_courses (sr_no, course_name, course_duration, no_of_credits, stream) VALUES
(1, 'Advanced Excel', '30 Days', 2, 'IT / Office'),
(2, 'Power BI', '45 Days', 3, 'Data'),
(3, 'Tally with GST', '45 Days', 3, 'Finance'),
(4, 'Digital Marketing', '60 Days', 4, 'Marketing'),
(5, 'Spoken English', '30 Days', 2, 'Soft Skills'),
(6, 'Graphic Designing', '45 Days', 3, 'Design')
ON CONFLICT (sr_no) DO NOTHING;

NOTIFY pgrst, 'reload schema';
