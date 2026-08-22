-- ============================================================
-- Create missing Website CMS tables (fixes "schema cache" error)
-- Run this in Supabase SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS website_settings (
    id BIGSERIAL PRIMARY KEY,
    setting_key VARCHAR(100) UNIQUE NOT NULL,
    setting_value TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS website_gallery (
    id BIGSERIAL PRIMARY KEY,
    title VARCHAR(255),
    description TEXT,
    image_url TEXT NOT NULL,
    category VARCHAR(100),
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS blogs (
    id BIGSERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE,
    excerpt TEXT,
    content TEXT,
    cover_image TEXT,
    author_id UUID,
    views INTEGER DEFAULT 0,
    is_published BOOLEAN DEFAULT FALSE,
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS enquiries (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    email VARCHAR(150),
    college VARCHAR(255),
    course_interest VARCHAR(255),
    city VARCHAR(100),
    message TEXT,
    source VARCHAR(50) DEFAULT 'Website',
    status VARCHAR(30) DEFAULT 'New',
    assigned_to UUID,
    followup_date DATE,
    remarks TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Optional: quizzes/assessments file columns
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS file_url TEXT;
ALTER TABLE assessments ADD COLUMN IF NOT EXISTS file_url TEXT;

-- Seed default settings
INSERT INTO website_settings (setting_key, setting_value) VALUES
('institute_name', 'Sujata Institute of Information and Technology'),
('email', 'sujatainstitute2016@gmail.com'),
('phone_primary', '+91-9096883042'),
('phone_secondary', '+91-9370387303'),
('phone_tertiary', '+91-9699544383'),
('address', 'Office No.03, First Floor, Sagar Apartment, Parihar Chowk, Sanghvi Nagar, Ward No. 8, Sadhu Vasvani Nagar, Aundh, Pune, Maharashtra 411067')
ON CONFLICT (setting_key) DO NOTHING;

-- RLS policies for development (open access – tighten in production)
ALTER TABLE enquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE website_gallery ENABLE ROW LEVEL SECURITY;
ALTER TABLE blogs ENABLE ROW LEVEL SECURITY;
ALTER TABLE website_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dev_enquiries" ON enquiries;
CREATE POLICY "dev_enquiries" ON enquiries FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "dev_gallery" ON website_gallery;
CREATE POLICY "dev_gallery" ON website_gallery FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "dev_blogs" ON blogs;
CREATE POLICY "dev_blogs" ON blogs FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "dev_settings" ON website_settings;
CREATE POLICY "dev_settings" ON website_settings FOR ALL USING (true) WITH CHECK (true);

-- Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';
