-- Placed Candidates + Events
-- Run in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.placed_candidates (
    id BIGSERIAL PRIMARY KEY,
    student_id BIGINT NOT NULL,
    company_id BIGINT NOT NULL,
    course_id BIGINT,
    batch_id BIGINT,
    designation VARCHAR(150) NOT NULL,
    employment_type VARCHAR(50)
        CHECK (employment_type IN ('Internship','Full-Time','Part-Time','Contract')),
    package_lpa NUMERIC(8,2),
    stipend NUMERIC(10,2),
    joining_date DATE,
    joining_location VARCHAR(255),
    offer_letter_url TEXT,
    placement_status VARCHAR(30) DEFAULT 'Selected'
        CHECK (placement_status IN (
            'Selected','Offer Issued','Joined','Completed Internship','Rejected','Declined'
        )),
    remarks TEXT,
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- FKs only if parent tables exist
DO $$ BEGIN
  ALTER TABLE placed_candidates ADD CONSTRAINT fk_pc_student FOREIGN KEY(student_id) REFERENCES students(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE placed_candidates ADD CONSTRAINT fk_pc_company FOREIGN KEY(company_id) REFERENCES companies(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_table THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_pc_student ON placed_candidates(student_id);
CREATE INDEX IF NOT EXISTS idx_pc_company ON placed_candidates(company_id);

CREATE TABLE IF NOT EXISTS public.events (
    id BIGSERIAL PRIMARY KEY,
    event_title VARCHAR(255) NOT NULL,
    event_type VARCHAR(100)
        CHECK (event_type IN (
            'Workshop','Seminar','Guest Lecture','Industrial Visit','Placement Drive',
            'Hackathon','Bootcamp','Training','Competition','Certification','Other'
        )),
    college_id BIGINT,
    course_id BIGINT,
    trainer_id BIGINT,
    event_description TEXT,
    event_banner TEXT,
    venue VARCHAR(255),
    event_date DATE,
    start_time TIME,
    end_time TIME,
    max_participants INTEGER,
    registration_required BOOLEAN DEFAULT TRUE,
    certificate_enabled BOOLEAN DEFAULT FALSE,
    status VARCHAR(30) DEFAULT 'Upcoming'
        CHECK (status IN ('Upcoming','Open','Completed','Cancelled')),
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_event_date ON events(event_date);
CREATE INDEX IF NOT EXISTS idx_event_status ON events(status);

ALTER TABLE placed_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dev_placed" ON placed_candidates;
CREATE POLICY "dev_placed" ON placed_candidates FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "dev_events" ON events;
CREATE POLICY "dev_events" ON events FOR ALL USING (true) WITH CHECK (true);

NOTIFY pgrst, 'reload schema';
