-- ============================================================
-- SUJATA INSTITUTE OF INFORMATION AND TECHNOLOGY
-- Complete ERP + LMS + Placement + Website CMS Schema
-- PostgreSQL / Supabase Compatible
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- 1. CORE AUTH & RBAC
-- ============================================================

CREATE TABLE roles (
    id BIGSERIAL PRIMARY KEY,
    role_name VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    status BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE permissions (
    id BIGSERIAL PRIMARY KEY,
    permission_name VARCHAR(100) NOT NULL,
    module VARCHAR(100),
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_permission UNIQUE(permission_name, module)
);

CREATE TABLE role_permissions (
    id BIGSERIAL PRIMARY KEY,
    role_id BIGINT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id BIGINT NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_role_permission UNIQUE(role_id, permission_id)
);

CREATE TABLE colleges (
    id BIGSERIAL PRIMARY KEY,
    college_code VARCHAR(30) UNIQUE NOT NULL,
    college_name VARCHAR(250) NOT NULL,
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    pincode VARCHAR(20),
    principal_name VARCHAR(150),
    contact_number VARCHAR(20),
    email VARCHAR(150),
    website TEXT,
    logo_url TEXT,
    status BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role_id BIGINT NOT NULL REFERENCES roles(id),
    college_id BIGINT REFERENCES colleges(id) ON DELETE SET NULL,
    full_name VARCHAR(150) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    phone VARCHAR(20),
    password_hash TEXT NOT NULL,
    profile_image TEXT,
    status BOOLEAN DEFAULT TRUE,
    last_login TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 2. ACADEMIC STRUCTURE
-- ============================================================

CREATE TABLE departments (
    id BIGSERIAL PRIMARY KEY,
    college_id BIGINT NOT NULL REFERENCES colleges(id) ON DELETE CASCADE,
    department_name VARCHAR(150) NOT NULL,
    hod_name VARCHAR(150),
    status BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_department UNIQUE(college_id, department_name)
);

CREATE TABLE courses (
    id BIGSERIAL PRIMARY KEY,
    course_code VARCHAR(30) UNIQUE,
    course_name VARCHAR(200) NOT NULL,
    description TEXT,
    duration_days INTEGER,
    total_modules INTEGER,
    certificate_enabled BOOLEAN DEFAULT TRUE,
    passing_percentage NUMERIC(5,2) DEFAULT 40,
    category VARCHAR(50), -- Short Term, College Program, Corporate, Internship
    fee_amount NUMERIC(12,2),
    thumbnail TEXT,
    status BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE course_modules (
    id BIGSERIAL PRIMARY KEY,
    course_id BIGINT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    module_name VARCHAR(200) NOT NULL,
    module_order INTEGER,
    duration_hours NUMERIC(5,2),
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE trainers (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    college_id BIGINT REFERENCES colleges(id) ON DELETE SET NULL,
    trainer_code VARCHAR(50) UNIQUE,
    full_name VARCHAR(150) NOT NULL,
    email VARCHAR(150),
    mobile VARCHAR(20),
    qualification VARCHAR(150),
    specialization TEXT,
    experience_years INTEGER,
    joining_date DATE,
    profile_photo TEXT,
    status BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE trainer_courses (
    id BIGSERIAL PRIMARY KEY,
    trainer_id BIGINT NOT NULL REFERENCES trainers(id) ON DELETE CASCADE,
    course_id BIGINT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    assigned_on DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_trainer_course UNIQUE(trainer_id, course_id)
);

CREATE TABLE batches (
    id BIGSERIAL PRIMARY KEY,
    batch_code VARCHAR(30) UNIQUE,
    batch_name VARCHAR(150) NOT NULL,
    course_id BIGINT NOT NULL REFERENCES courses(id),
    trainer_id BIGINT REFERENCES trainers(id) ON DELETE SET NULL,
    college_id BIGINT REFERENCES colleges(id) ON DELETE SET NULL,
    start_date DATE,
    end_date DATE,
    max_students INTEGER,
    status VARCHAR(20) DEFAULT 'Active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE students (
    id BIGSERIAL PRIMARY KEY,
    college_roll_no VARCHAR(50) UNIQUE NOT NULL,
    university_enrollment_no VARCHAR(80),
    full_name VARCHAR(150) NOT NULL,
    gender VARCHAR(20),
    date_of_birth DATE,
    mobile VARCHAR(20),
    email VARCHAR(150),
    college_id BIGINT NOT NULL REFERENCES colleges(id),
    department_id BIGINT REFERENCES departments(id),
    batch_id BIGINT REFERENCES batches(id) ON DELETE SET NULL,
    course_id BIGINT REFERENCES courses(id) ON DELETE SET NULL,
    academic_year VARCHAR(20),
    semester INTEGER,
    section VARCHAR(20),
    address TEXT,
    guardian_name VARCHAR(150),
    guardian_mobile VARCHAR(20),
    profile_photo TEXT,
    status VARCHAR(20) DEFAULT 'Active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE student_documents (
    id BIGSERIAL PRIMARY KEY,
    student_id BIGINT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    document_name VARCHAR(150),
    document_type VARCHAR(100),
    document_url TEXT,
    uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE student_courses (
    id BIGSERIAL PRIMARY KEY,
    student_id BIGINT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    course_id BIGINT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    batch_id BIGINT REFERENCES batches(id) ON DELETE SET NULL,
    enrolled_on DATE DEFAULT CURRENT_DATE,
    completed_on DATE,
    completion_status VARCHAR(30) DEFAULT 'Enrolled',
    final_percentage NUMERIC(5,2),
    certificate_issued BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_student_course UNIQUE(student_id, course_id)
);

-- ============================================================
-- 3. ATTENDANCE
-- ============================================================

CREATE TABLE attendance_sessions (
    id BIGSERIAL PRIMARY KEY,
    session_code VARCHAR(50) UNIQUE NOT NULL,
    batch_id BIGINT NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
    course_id BIGINT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    trainer_id BIGINT NOT NULL REFERENCES trainers(id) ON DELETE CASCADE,
    college_id BIGINT REFERENCES colleges(id),
    topic VARCHAR(255),
    session_date DATE NOT NULL,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    attendance_mode VARCHAR(20) CHECK(attendance_mode IN ('QR','Manual','Hybrid')) DEFAULT 'QR',
    status VARCHAR(20) CHECK(status IN ('Scheduled','Running','Completed','Cancelled')) DEFAULT 'Scheduled',
    remarks TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE attendance_qr (
    id BIGSERIAL PRIMARY KEY,
    session_id BIGINT NOT NULL REFERENCES attendance_sessions(id) ON DELETE CASCADE,
    qr_token UUID DEFAULT gen_random_uuid(),
    expires_at TIMESTAMPTZ NOT NULL,
    generated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE attendance_logs (
    id BIGSERIAL PRIMARY KEY,
    session_id BIGINT NOT NULL REFERENCES attendance_sessions(id) ON DELETE CASCADE,
    student_id BIGINT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    attendance_time TIMESTAMPTZ DEFAULT NOW(),
    attendance_type VARCHAR(20) CHECK(attendance_type IN ('QR','Manual')),
    status VARCHAR(20) CHECK(status IN ('Present','Absent','Late')) DEFAULT 'Present',
    latitude NUMERIC(10,7),
    longitude NUMERIC(10,7),
    ip_address VARCHAR(100),
    device_info TEXT,
    remarks TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_attendance UNIQUE(session_id, student_id)
);

CREATE TABLE attendance_settings (
    id BIGSERIAL PRIMARY KEY,
    qr_expiry_minutes INTEGER DEFAULT 10,
    allow_manual_attendance BOOLEAN DEFAULT TRUE,
    allow_late_attendance BOOLEAN DEFAULT TRUE,
    late_after_minutes INTEGER DEFAULT 15,
    gps_required BOOLEAN DEFAULT FALSE,
    max_distance_meters INTEGER DEFAULT 100,
    selfie_required BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE holiday_calendar (
    id BIGSERIAL PRIMARY KEY,
    holiday_name VARCHAR(200) NOT NULL,
    holiday_date DATE NOT NULL,
    holiday_type VARCHAR(30) CHECK(holiday_type IN ('National','Festival','College','Other')) DEFAULT 'College',
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE student_attendance_summary (
    id BIGSERIAL PRIMARY KEY,
    student_id BIGINT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    batch_id BIGINT NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
    course_id BIGINT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    total_sessions INTEGER DEFAULT 0,
    present_count INTEGER DEFAULT 0,
    absent_count INTEGER DEFAULT 0,
    late_count INTEGER DEFAULT 0,
    attendance_percentage NUMERIC(5,2) DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE trainer_attendance (
    id BIGSERIAL PRIMARY KEY,
    trainer_id BIGINT NOT NULL REFERENCES trainers(id) ON DELETE CASCADE,
    attendance_date DATE NOT NULL,
    check_in TIMESTAMPTZ,
    check_out TIMESTAMPTZ,
    status VARCHAR(20) DEFAULT 'Present',
    remarks TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_trainer_attendance UNIQUE(trainer_id, attendance_date)
);

-- ============================================================
-- 4. QUIZ & ASSESSMENTS
-- ============================================================

CREATE TABLE quizzes (
    id BIGSERIAL PRIMARY KEY,
    course_id BIGINT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    module_id BIGINT REFERENCES course_modules(id) ON DELETE SET NULL,
    trainer_id BIGINT REFERENCES trainers(id) ON DELETE SET NULL,
    college_id BIGINT REFERENCES colleges(id),
    quiz_code VARCHAR(50) UNIQUE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    total_marks NUMERIC(6,2) DEFAULT 0,
    passing_marks NUMERIC(6,2) DEFAULT 0,
    duration_minutes INTEGER NOT NULL,
    total_questions INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 1,
    random_questions BOOLEAN DEFAULT FALSE,
    show_result_immediately BOOLEAN DEFAULT TRUE,
    start_datetime TIMESTAMPTZ,
    end_datetime TIMESTAMPTZ,
    status VARCHAR(20) CHECK(status IN ('Draft','Published','Closed')) DEFAULT 'Draft',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE quiz_questions (
    id BIGSERIAL PRIMARY KEY,
    quiz_id BIGINT NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
    question TEXT NOT NULL,
    question_type VARCHAR(20) CHECK(question_type IN ('MCQ','TrueFalse')) DEFAULT 'MCQ',
    marks NUMERIC(5,2) DEFAULT 1,
    explanation TEXT,
    question_order INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE quiz_options (
    id BIGSERIAL PRIMARY KEY,
    question_id BIGINT NOT NULL REFERENCES quiz_questions(id) ON DELETE CASCADE,
    option_text TEXT NOT NULL,
    is_correct BOOLEAN DEFAULT FALSE,
    option_order INTEGER
);

CREATE TABLE quiz_attempts (
    id BIGSERIAL PRIMARY KEY,
    quiz_id BIGINT NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
    student_id BIGINT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    attempt_number INTEGER DEFAULT 1,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    submitted_at TIMESTAMPTZ,
    score NUMERIC(6,2),
    percentage NUMERIC(5,2),
    result VARCHAR(20) CHECK(result IN ('Pass','Fail','Pending')) DEFAULT 'Pending',
    duration_seconds INTEGER,
    status VARCHAR(20) CHECK(status IN ('Started','Submitted','Expired')) DEFAULT 'Started',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE quiz_answers (
    id BIGSERIAL PRIMARY KEY,
    attempt_id BIGINT NOT NULL REFERENCES quiz_attempts(id) ON DELETE CASCADE,
    question_id BIGINT NOT NULL REFERENCES quiz_questions(id) ON DELETE CASCADE,
    selected_option_id BIGINT REFERENCES quiz_options(id) ON DELETE SET NULL,
    is_correct BOOLEAN,
    marks_awarded NUMERIC(5,2),
    answered_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_answer UNIQUE(attempt_id, question_id)
);

CREATE TABLE quiz_results (
    id BIGSERIAL PRIMARY KEY,
    quiz_id BIGINT NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
    student_id BIGINT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    best_attempt_id BIGINT REFERENCES quiz_attempts(id) ON DELETE SET NULL,
    attempts INTEGER DEFAULT 1,
    total_marks NUMERIC(6,2),
    obtained_marks NUMERIC(6,2),
    percentage NUMERIC(5,2),
    grade VARCHAR(10),
    result VARCHAR(20) CHECK(result IN ('Pass','Fail')),
    completed_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_quiz_student UNIQUE(quiz_id, student_id)
);

CREATE TABLE assessments (
    id BIGSERIAL PRIMARY KEY,
    course_id BIGINT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    trainer_id BIGINT REFERENCES trainers(id) ON DELETE SET NULL,
    college_id BIGINT REFERENCES colleges(id),
    title VARCHAR(255),
    description TEXT,
    assessment_type VARCHAR(30) CHECK(assessment_type IN ('Theory','Practical','Viva','Assignment')) DEFAULT 'Theory',
    total_marks NUMERIC(6,2),
    passing_marks NUMERIC(6,2),
    assessment_date DATE,
    status VARCHAR(20) CHECK(status IN ('Draft','Published','Completed')) DEFAULT 'Draft',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE assessment_questions (
    id BIGSERIAL PRIMARY KEY,
    assessment_id BIGINT NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
    question TEXT,
    marks NUMERIC(6,2),
    question_order INTEGER
);

CREATE TABLE assessment_results (
    id BIGSERIAL PRIMARY KEY,
    assessment_id BIGINT NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
    student_id BIGINT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    trainer_id BIGINT REFERENCES trainers(id) ON DELETE SET NULL,
    total_marks NUMERIC(6,2),
    obtained_marks NUMERIC(6,2),
    percentage NUMERIC(5,2),
    grade VARCHAR(10),
    remarks TEXT,
    result VARCHAR(20) CHECK(result IN ('Pass','Fail','Pending')) DEFAULT 'Pending',
    evaluated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_assessment_student UNIQUE(assessment_id, student_id)
);

CREATE TABLE assessment_reviews (
    id BIGSERIAL PRIMARY KEY,
    assessment_result_id BIGINT NOT NULL REFERENCES assessment_results(id) ON DELETE CASCADE,
    reviewer_id UUID REFERENCES users(id) ON DELETE SET NULL,
    comments TEXT,
    reviewed_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 5. TASKS / ASSIGNMENTS
-- ============================================================

CREATE TABLE tasks (
    id BIGSERIAL PRIMARY KEY,
    course_id BIGINT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    module_id BIGINT REFERENCES course_modules(id) ON DELETE SET NULL,
    trainer_id BIGINT NOT NULL REFERENCES trainers(id) ON DELETE CASCADE,
    batch_id BIGINT REFERENCES batches(id) ON DELETE SET NULL,
    college_id BIGINT REFERENCES colleges(id),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    instructions TEXT,
    total_marks NUMERIC(6,2) DEFAULT 100,
    start_date TIMESTAMPTZ,
    due_date TIMESTAMPTZ,
    allow_late_submission BOOLEAN DEFAULT FALSE,
    max_file_size_mb INTEGER DEFAULT 20,
    status VARCHAR(20) CHECK(status IN ('Draft','Published','Closed')) DEFAULT 'Draft',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE task_files (
    id BIGSERIAL PRIMARY KEY,
    task_id BIGINT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    file_name VARCHAR(255),
    file_url TEXT NOT NULL,
    file_type VARCHAR(50),
    uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE task_submissions (
    id BIGSERIAL PRIMARY KEY,
    task_id BIGINT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    student_id BIGINT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    submission_file TEXT,
    remarks TEXT,
    submitted_at TIMESTAMPTZ DEFAULT NOW(),
    submission_status VARCHAR(20) CHECK(submission_status IN ('Submitted','Late','Draft')) DEFAULT 'Submitted',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_task_submission UNIQUE(task_id, student_id)
);

CREATE TABLE task_reviews (
    id BIGSERIAL PRIMARY KEY,
    submission_id BIGINT NOT NULL REFERENCES task_submissions(id) ON DELETE CASCADE,
    trainer_id BIGINT NOT NULL REFERENCES trainers(id) ON DELETE CASCADE,
    marks_obtained NUMERIC(6,2),
    feedback TEXT,
    review_status VARCHAR(20) CHECK(review_status IN ('Pending','Reviewed')) DEFAULT 'Pending',
    reviewed_at TIMESTAMPTZ
);

-- ============================================================
-- 6. CERTIFICATES
-- ============================================================

CREATE TABLE certificate_templates (
    id BIGSERIAL PRIMARY KEY,
    template_name VARCHAR(255) NOT NULL,
    course_id BIGINT REFERENCES courses(id) ON DELETE SET NULL,
    template_file TEXT NOT NULL,
    background_image TEXT,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE certificates (
    id BIGSERIAL PRIMARY KEY,
    certificate_number VARCHAR(100) UNIQUE NOT NULL,
    student_id BIGINT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    course_id BIGINT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    batch_id BIGINT REFERENCES batches(id) ON DELETE SET NULL,
    template_id BIGINT REFERENCES certificate_templates(id) ON DELETE SET NULL,
    college_id BIGINT REFERENCES colleges(id),
    issue_date DATE NOT NULL,
    completion_percentage NUMERIC(5,2),
    grade VARCHAR(20),
    certificate_url TEXT,
    verification_code UUID DEFAULT gen_random_uuid(),
    status VARCHAR(20) CHECK(status IN ('Issued','Revoked')) DEFAULT 'Issued',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE certificate_logs (
    id BIGSERIAL PRIMARY KEY,
    certificate_id BIGINT NOT NULL REFERENCES certificates(id) ON DELETE CASCADE,
    action VARCHAR(30) CHECK(action IN ('Generated','Downloaded','Verified','Revoked')),
    ip_address VARCHAR(100),
    device_info TEXT,
    action_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 7. FEES & FINANCE
-- ============================================================

CREATE TABLE fees (
    id BIGSERIAL PRIMARY KEY,
    student_id BIGINT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    course_id BIGINT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    batch_id BIGINT REFERENCES batches(id) ON DELETE SET NULL,
    college_id BIGINT REFERENCES colleges(id),
    total_fee NUMERIC(12,2) NOT NULL,
    discount NUMERIC(12,2) DEFAULT 0,
    scholarship NUMERIC(12,2) DEFAULT 0,
    tax NUMERIC(12,2) DEFAULT 0,
    payable_fee NUMERIC(12,2) NOT NULL,
    paid_amount NUMERIC(12,2) DEFAULT 0,
    balance_amount NUMERIC(12,2) NOT NULL,
    payment_status VARCHAR(20) CHECK (payment_status IN ('Pending','Partial','Paid','Cancelled')) DEFAULT 'Pending',
    remarks TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_fee UNIQUE(student_id, course_id)
);

CREATE TABLE fee_installments (
    id BIGSERIAL PRIMARY KEY,
    fee_id BIGINT NOT NULL REFERENCES fees(id) ON DELETE CASCADE,
    installment_no INTEGER NOT NULL,
    due_date DATE,
    installment_amount NUMERIC(12,2) NOT NULL,
    paid_amount NUMERIC(12,2) DEFAULT 0,
    balance_amount NUMERIC(12,2) NOT NULL,
    status VARCHAR(20) CHECK(status IN ('Pending','Partial','Paid','Overdue')) DEFAULT 'Pending',
    remarks TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_installment UNIQUE(fee_id, installment_no)
);

CREATE TABLE payments (
    id BIGSERIAL PRIMARY KEY,
    fee_id BIGINT NOT NULL REFERENCES fees(id) ON DELETE CASCADE,
    installment_id BIGINT REFERENCES fee_installments(id) ON DELETE SET NULL,
    student_id BIGINT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    payment_reference VARCHAR(100) UNIQUE,
    payment_mode VARCHAR(30) CHECK(payment_mode IN ('Cash','UPI','Card','NetBanking','Cheque','BankTransfer')),
    amount NUMERIC(12,2) NOT NULL,
    transaction_id VARCHAR(255),
    bank_name VARCHAR(150),
    payment_date TIMESTAMPTZ DEFAULT NOW(),
    received_by UUID REFERENCES users(id) ON DELETE SET NULL,
    payment_status VARCHAR(20) CHECK(payment_status IN ('Success','Pending','Failed','Refunded')) DEFAULT 'Success',
    remarks TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE payment_receipts (
    id BIGSERIAL PRIMARY KEY,
    payment_id BIGINT NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
    receipt_number VARCHAR(100) UNIQUE NOT NULL,
    receipt_date DATE DEFAULT CURRENT_DATE,
    receipt_file TEXT,
    generated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE income (
    id BIGSERIAL PRIMARY KEY,
    income_type VARCHAR(100),
    source VARCHAR(255),
    payment_id BIGINT REFERENCES payments(id) ON DELETE SET NULL,
    amount NUMERIC(12,2) NOT NULL,
    income_date DATE NOT NULL,
    description TEXT,
    received_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE expenses (
    id BIGSERIAL PRIMARY KEY,
    expense_type VARCHAR(100),
    vendor_name VARCHAR(255),
    invoice_number VARCHAR(100),
    amount NUMERIC(12,2) NOT NULL,
    payment_mode VARCHAR(30) CHECK(payment_mode IN ('Cash','UPI','Card','BankTransfer','Cheque')),
    expense_date DATE,
    description TEXT,
    approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 8. PLACEMENT
-- ============================================================

CREATE TABLE companies (
    id BIGSERIAL PRIMARY KEY,
    company_code VARCHAR(30) UNIQUE,
    company_name VARCHAR(255) NOT NULL,
    industry VARCHAR(150),
    company_type VARCHAR(100),
    website TEXT,
    email VARCHAR(150),
    phone VARCHAR(30),
    hr_name VARCHAR(150),
    hr_email VARCHAR(150),
    hr_phone VARCHAR(30),
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    country VARCHAR(100) DEFAULT 'India',
    logo_url TEXT,
    description TEXT,
    status BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE placement_drives (
    id BIGSERIAL PRIMARY KEY,
    company_id BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    course_id BIGINT REFERENCES courses(id) ON DELETE SET NULL,
    batch_id BIGINT REFERENCES batches(id) ON DELETE SET NULL,
    college_id BIGINT REFERENCES colleges(id),
    drive_title VARCHAR(255) NOT NULL,
    job_role VARCHAR(150),
    employment_type VARCHAR(50) CHECK(employment_type IN ('Full-Time','Internship','Contract','Part-Time')),
    package_lpa NUMERIC(8,2),
    vacancies INTEGER,
    minimum_percentage NUMERIC(5,2),
    minimum_cgpa NUMERIC(4,2),
    eligibility_notes TEXT,
    drive_date DATE,
    application_deadline DATE,
    interview_location TEXT,
    status VARCHAR(30) CHECK(status IN ('Upcoming','Open','Closed','Completed','Cancelled')) DEFAULT 'Upcoming',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE placement_applications (
    id BIGSERIAL PRIMARY KEY,
    drive_id BIGINT NOT NULL REFERENCES placement_drives(id) ON DELETE CASCADE,
    student_id BIGINT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    application_no VARCHAR(50) UNIQUE,
    resume_url TEXT,
    applied_at TIMESTAMPTZ DEFAULT NOW(),
    application_status VARCHAR(30) CHECK(application_status IN ('Applied','Shortlisted','Interview','Selected','Rejected','Withdrawn')) DEFAULT 'Applied',
    remarks TEXT,
    CONSTRAINT uq_drive_student UNIQUE(drive_id, student_id)
);

CREATE TABLE placed_students (
    id BIGSERIAL PRIMARY KEY,
    application_id BIGINT NOT NULL REFERENCES placement_applications(id) ON DELETE CASCADE,
    student_id BIGINT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    company_id BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    drive_id BIGINT NOT NULL REFERENCES placement_drives(id) ON DELETE CASCADE,
    designation VARCHAR(150),
    department VARCHAR(100),
    employment_type VARCHAR(50),
    annual_package NUMERIC(10,2),
    monthly_salary NUMERIC(10,2),
    joining_date DATE,
    joining_location VARCHAR(255),
    offer_letter_url TEXT,
    offer_acceptance BOOLEAN DEFAULT TRUE,
    placement_status VARCHAR(30) CHECK(placement_status IN ('Offer Issued','Accepted','Joined','Declined')) DEFAULT 'Offer Issued',
    remarks TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_student_placement UNIQUE(student_id, drive_id)
);

-- ============================================================
-- 9. INTERNSHIP MODULE
-- ============================================================

CREATE TABLE internships (
    id BIGSERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    company_id BIGINT REFERENCES companies(id) ON DELETE SET NULL,
    course_id BIGINT REFERENCES courses(id) ON DELETE SET NULL,
    description TEXT,
    duration_weeks INTEGER,
    stipend NUMERIC(10,2),
    start_date DATE,
    end_date DATE,
    location VARCHAR(255),
    mode VARCHAR(30) CHECK(mode IN ('Onsite','Remote','Hybrid')) DEFAULT 'Onsite',
    status VARCHAR(20) DEFAULT 'Active',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE internship_batches (
    id BIGSERIAL PRIMARY KEY,
    internship_id BIGINT NOT NULL REFERENCES internships(id) ON DELETE CASCADE,
    batch_name VARCHAR(150),
    trainer_id BIGINT REFERENCES trainers(id),
    start_date DATE,
    end_date DATE,
    max_students INTEGER,
    status VARCHAR(20) DEFAULT 'Active',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE internship_projects (
    id BIGSERIAL PRIMARY KEY,
    internship_batch_id BIGINT NOT NULL REFERENCES internship_batches(id) ON DELETE CASCADE,
    project_title VARCHAR(255) NOT NULL,
    description TEXT,
    technologies TEXT,
    start_date DATE,
    end_date DATE,
    status VARCHAR(20) DEFAULT 'Active'
);

CREATE TABLE internship_tasks (
    id BIGSERIAL PRIMARY KEY,
    project_id BIGINT NOT NULL REFERENCES internship_projects(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    due_date DATE,
    status VARCHAR(20) DEFAULT 'Pending'
);

CREATE TABLE internship_reviews (
    id BIGSERIAL PRIMARY KEY,
    internship_batch_id BIGINT NOT NULL REFERENCES internship_batches(id) ON DELETE CASCADE,
    student_id BIGINT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    reviewer_id BIGINT REFERENCES trainers(id),
    rating SMALLINT CHECK(rating BETWEEN 1 AND 5),
    feedback TEXT,
    reviewed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE internship_certificates (
    id BIGSERIAL PRIMARY KEY,
    student_id BIGINT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    internship_id BIGINT NOT NULL REFERENCES internships(id) ON DELETE CASCADE,
    certificate_number VARCHAR(100) UNIQUE,
    issue_date DATE,
    certificate_url TEXT,
    verification_code UUID DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 10. STUDENT PERFORMANCE
-- ============================================================

CREATE TABLE student_performance (
    id BIGSERIAL PRIMARY KEY,
    student_id BIGINT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    course_id BIGINT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    batch_id BIGINT REFERENCES batches(id),
    attendance_percentage NUMERIC(5,2) DEFAULT 0,
    quiz_average NUMERIC(5,2) DEFAULT 0,
    assessment_average NUMERIC(5,2) DEFAULT 0,
    task_average NUMERIC(5,2) DEFAULT 0,
    overall_percentage NUMERIC(5,2) DEFAULT 0,
    overall_grade VARCHAR(10),
    rank_in_batch INTEGER,
    certificate_status VARCHAR(30) DEFAULT 'Pending',
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_student_perf UNIQUE(student_id, course_id)
);

-- ============================================================
-- 11. FEEDBACK
-- ============================================================

CREATE TABLE student_feedback (
    id BIGSERIAL PRIMARY KEY,
    student_id BIGINT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    trainer_id BIGINT REFERENCES trainers(id) ON DELETE SET NULL,
    course_id BIGINT REFERENCES courses(id) ON DELETE SET NULL,
    batch_id BIGINT REFERENCES batches(id) ON DELETE SET NULL,
    rating SMALLINT CHECK(rating BETWEEN 1 AND 5),
    teaching_quality SMALLINT,
    communication SMALLINT,
    practical_knowledge SMALLINT,
    overall_experience SMALLINT,
    comments TEXT,
    submitted_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 12. WEBSITE CMS
-- ============================================================

CREATE TABLE website_settings (
    id BIGSERIAL PRIMARY KEY,
    setting_key VARCHAR(100) UNIQUE NOT NULL,
    setting_value TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE website_pages (
    id BIGSERIAL PRIMARY KEY,
    page_slug VARCHAR(100) UNIQUE NOT NULL,
    page_title VARCHAR(255) NOT NULL,
    meta_title VARCHAR(255),
    meta_description TEXT,
    content TEXT,
    is_published BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE website_banners (
    id BIGSERIAL PRIMARY KEY,
    title VARCHAR(255),
    subtitle TEXT,
    image_url TEXT NOT NULL,
    link_url TEXT,
    button_text VARCHAR(100),
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE website_menu (
    id BIGSERIAL PRIMARY KEY,
    parent_id BIGINT REFERENCES website_menu(id) ON DELETE CASCADE,
    title VARCHAR(100) NOT NULL,
    url VARCHAR(255),
    icon VARCHAR(50),
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    target VARCHAR(20) DEFAULT '_self'
);

CREATE TABLE website_gallery (
    id BIGSERIAL PRIMARY KEY,
    title VARCHAR(255),
    description TEXT,
    image_url TEXT NOT NULL,
    category VARCHAR(100),
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE website_videos (
    id BIGSERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    video_url TEXT NOT NULL,
    thumbnail_url TEXT,
    category VARCHAR(100),
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE website_faq (
    id BIGSERIAL PRIMARY KEY,
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    category VARCHAR(100),
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE website_notices (
    id BIGSERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    content TEXT,
    notice_type VARCHAR(50) DEFAULT 'General',
    start_date DATE,
    end_date DATE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE website_news (
    id BIGSERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE,
    content TEXT,
    image_url TEXT,
    published_at TIMESTAMPTZ,
    is_published BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE website_events (
    id BIGSERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    event_date DATE,
    event_time TIME,
    location VARCHAR(255),
    image_url TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE statistics (
    id BIGSERIAL PRIMARY KEY,
    students_count INTEGER DEFAULT 0,
    courses_count INTEGER DEFAULT 0,
    placements_count INTEGER DEFAULT 0,
    companies_count INTEGER DEFAULT 0,
    trainers_count INTEGER DEFAULT 0,
    years_experience INTEGER DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 13. BLOGS
-- ============================================================

CREATE TABLE blog_categories (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    slug VARCHAR(100) UNIQUE,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE blogs (
    id BIGSERIAL PRIMARY KEY,
    category_id BIGINT REFERENCES blog_categories(id) ON DELETE SET NULL,
    author_id UUID REFERENCES users(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    excerpt TEXT,
    content TEXT,
    featured_image TEXT,
    is_published BOOLEAN DEFAULT FALSE,
    published_at TIMESTAMPTZ,
    views INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE blog_tags (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    slug VARCHAR(50) UNIQUE
);

CREATE TABLE blog_tag_map (
    blog_id BIGINT NOT NULL REFERENCES blogs(id) ON DELETE CASCADE,
    tag_id BIGINT NOT NULL REFERENCES blog_tags(id) ON DELETE CASCADE,
    PRIMARY KEY (blog_id, tag_id)
);

CREATE TABLE blog_comments (
    id BIGSERIAL PRIMARY KEY,
    blog_id BIGINT NOT NULL REFERENCES blogs(id) ON DELETE CASCADE,
    name VARCHAR(150),
    email VARCHAR(150),
    comment TEXT NOT NULL,
    is_approved BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 14. TESTIMONIALS
-- ============================================================

CREATE TABLE testimonials (
    id BIGSERIAL PRIMARY KEY,
    student_id BIGINT REFERENCES students(id) ON DELETE SET NULL,
    trainer_id BIGINT REFERENCES trainers(id) ON DELETE SET NULL,
    name VARCHAR(150) NOT NULL,
    designation VARCHAR(150),
    company VARCHAR(150),
    photo TEXT,
    rating SMALLINT CHECK(rating BETWEEN 1 AND 5) DEFAULT 5,
    review TEXT NOT NULL,
    is_approved BOOLEAN DEFAULT FALSE,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 15. ENQUIRIES
-- ============================================================

CREATE TABLE enquiries (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    email VARCHAR(150),
    college VARCHAR(255),
    course_interest VARCHAR(255),
    city VARCHAR(100),
    message TEXT,
    source VARCHAR(50) DEFAULT 'Website',
    status VARCHAR(30) DEFAULT 'New' CHECK(status IN ('New','Contacted','Follow-up','Converted','Closed')),
    assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
    followup_date DATE,
    remarks TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 16. NOTIFICATIONS & LOGS
-- ============================================================

CREATE TABLE notifications (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    message TEXT,
    type VARCHAR(50) DEFAULT 'General',
    related_id BIGINT,
    related_type VARCHAR(50),
    priority VARCHAR(20) DEFAULT 'Normal',
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE activity_logs (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    table_name VARCHAR(100),
    record_id VARCHAR(100),
    old_data JSONB,
    new_data JSONB,
    ip_address VARCHAR(100),
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE whatsapp_logs (
    id BIGSERIAL PRIMARY KEY,
    mobile VARCHAR(20) NOT NULL,
    message TEXT,
    status VARCHAR(30),
    response TEXT,
    related_type VARCHAR(50),
    related_id BIGINT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE email_templates (
    id BIGSERIAL PRIMARY KEY,
    template_key VARCHAR(100) UNIQUE NOT NULL,
    subject VARCHAR(255),
    body TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE whatsapp_templates (
    id BIGSERIAL PRIMARY KEY,
    template_key VARCHAR(100) UNIQUE NOT NULL,
    message_body TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 17. DOWNLOADS / STUDY MATERIAL
-- ============================================================

CREATE TABLE downloads (
    id BIGSERIAL PRIMARY KEY,
    course_id BIGINT REFERENCES courses(id) ON DELETE CASCADE,
    module_id BIGINT REFERENCES course_modules(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    file_type VARCHAR(50) CHECK(file_type IN ('Notes','PPT','PDF','Assignment','Solution','Video','Other')),
    file_url TEXT NOT NULL,
    file_size_kb INTEGER,
    is_public BOOLEAN DEFAULT FALSE,
    download_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 18. SUPPORT & HR (Basic)
-- ============================================================

CREATE TABLE support_tickets (
    id BIGSERIAL PRIMARY KEY,
    ticket_no VARCHAR(30) UNIQUE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    student_id BIGINT REFERENCES students(id) ON DELETE SET NULL,
    subject VARCHAR(255) NOT NULL,
    description TEXT,
    priority VARCHAR(20) DEFAULT 'Medium',
    status VARCHAR(30) DEFAULT 'Open' CHECK(status IN ('Open','In Progress','Resolved','Closed')),
    assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE employee_leave (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    leave_type VARCHAR(50),
    from_date DATE NOT NULL,
    to_date DATE NOT NULL,
    reason TEXT,
    status VARCHAR(20) DEFAULT 'Pending' CHECK(status IN ('Pending','Approved','Rejected')),
    approved_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX idx_students_roll_no ON students(college_roll_no);
CREATE INDEX idx_students_college ON students(college_id);
CREATE INDEX idx_students_department ON students(department_id);
CREATE INDEX idx_batches_course ON batches(course_id);
CREATE INDEX idx_batches_trainer ON batches(trainer_id);
CREATE INDEX idx_departments_college ON departments(college_id);
CREATE INDEX idx_modules_course ON course_modules(course_id);
CREATE INDEX idx_trainer_courses ON trainer_courses(trainer_id);
CREATE INDEX idx_student_courses ON student_courses(student_id);
CREATE INDEX idx_attendance_session ON attendance_logs(session_id);
CREATE INDEX idx_attendance_student ON attendance_logs(student_id);
CREATE INDEX idx_attendance_date ON attendance_sessions(session_date);
CREATE INDEX idx_attendance_batch ON attendance_sessions(batch_id);
CREATE INDEX idx_quiz_course ON quizzes(course_id);
CREATE INDEX idx_attempt_student ON quiz_attempts(student_id);
CREATE INDEX idx_task_course ON tasks(course_id);
CREATE INDEX idx_submission_student ON task_submissions(student_id);
CREATE INDEX idx_certificate_student ON certificates(student_id);
CREATE INDEX idx_certificate_number ON certificates(certificate_number);
CREATE INDEX idx_certificate_verify ON certificates(verification_code);
CREATE INDEX idx_fee_student ON fees(student_id);
CREATE INDEX idx_payment_student ON payments(student_id);
CREATE INDEX idx_payment_date ON payments(payment_date);
CREATE INDEX idx_drive_company ON placement_drives(company_id);
CREATE INDEX idx_application_student ON placement_applications(student_id);
CREATE INDEX idx_placed_student ON placed_students(student_id);
CREATE INDEX idx_enquiries_status ON enquiries(status);
CREATE INDEX idx_enquiries_created ON enquiries(created_at);
CREATE INDEX idx_blogs_slug ON blogs(slug);
CREATE INDEX idx_notifications_user ON notifications(user_id);

-- ============================================================
-- SEED DATA (Roles)
-- ============================================================

INSERT INTO roles (role_name, description) VALUES
('Super Admin', 'Full system access across all colleges'),
('Institute Admin', 'Institute level administration'),
('College Admin', 'College specific administration'),
('Trainer', 'Faculty / Trainer access'),
('Student', 'Student portal access'),
('Reception', 'Enquiry and front desk'),
('Accountant', 'Fees and finance management'),
('Placement Officer', 'Placement drives and companies'),
('Coordinator', 'College coordinator');

INSERT INTO statistics (students_count, courses_count, placements_count, companies_count, trainers_count, years_experience)
VALUES (2500, 45, 1200, 85, 35, 10);

INSERT INTO website_settings (setting_key, setting_value) VALUES
('institute_name', 'Sujata Institute of Information and Technology'),
('email', 'sujatainstitute2016@gmail.com'),
('phone_primary', '+91-9096883042'),
('phone_secondary', '+91-9370387303'),
('phone_tertiary', '+91-9699544383'),
('address', 'Office No.03, First Floor, Sagar Apartment, Parihar Chowk, Sanghvi Nagar, Ward No. 8, Sadhu Vasvani Nagar, Aundh, Pune, Maharashtra 411067'),
('website', 'https://www.smmm.org'),
('facebook', ''),
('instagram', ''),
('linkedin', ''),
('youtube', ''),
('whatsapp_numbers', '9096883042,9370387303');

-- ============================================================
-- END OF SCHEMA
-- ============================================================
