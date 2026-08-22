-- Seed courses from Sujata Institute Course Brochure
-- Run in Supabase SQL Editor after schema

INSERT INTO courses (course_code, course_name, description, duration_days, certificate_enabled, status) VALUES
('TALLY-GST', 'Certificate Course in Tally with GST (Computerized Accounting)', 'Learn practical accounting, GST filing, and financial management using Tally to become job-ready in the finance domain. Job roles: Junior Accountant, Accounts Executive, GST Executive, Billing Executive, Accounts Assistant, Back Office Executive.', 90, true, true),
('EFILING', 'Certificate Course in E-Filing of Income Tax and GST', 'Develop practical skills in income tax return filing and GST compliance using digital tools. Hands-on experience with real-world tax processes, forms, regulations & client data management.', 60, true, true),
('ADV-EXCEL', 'Certificate Course in Advanced Excel', 'Master advanced Excel for data analysis, MIS reports, pivot tables, formulas and dashboards. Ideal for Data Analyst, MIS Executive, Reporting Analyst roles.', 45, true, true),
('PWR', 'Certificate Course in Professional Workplace Readiness', 'Develop communication, corporate behavior, email etiquette, teamwork and professional grooming. Build confidence for interviews and office environments.', 30, true, true),
('POWERBI', 'Certificate Course in Power BI', 'Create interactive dashboards and reports using Power BI. Data modeling, visualization and business insights with real datasets. Roles: Power BI Developer, Data Analyst, BI Analyst.', 60, true, true),
('ESE', 'Certificate Course in Employability Skill Enhancement', 'Enhance job readiness with communication, aptitude, interview skills, resume building and professional presentation.', 30, true, true),
('WEB-DEV', 'Certificate Course in Web Development', 'Learn HTML, CSS, JavaScript and modern web development practices. Build responsive websites. Roles: Web Developer, Front-End Developer, Web Designer.', 90, true, true),
('FULLSTACK', 'Certificate Course in Full Stack Development', 'Learn both frontend and backend technologies. Build complete web applications, databases, APIs and server-side logic. Roles: Full Stack Developer, Software Developer.', 150, true, true),
('FLUTTER', 'Certificate Course in Android / Flutter Development', 'Build mobile applications using Android or Flutter. UI design, app functionality and deployment with live projects. Roles: Mobile App Developer, Flutter Developer.', 120, true, true),
('ANIMATION', 'Certificate Course in Animation and Multimedia', 'Learn animation, video editing and multimedia tools. Create visual content for media and advertising. Roles: Animator, Multimedia Designer, Video Editor.', 90, true, true),
('AI-PYTHON', 'Certificate Course in AI using Python', 'Learn Artificial Intelligence concepts using Python. Machine learning basics, data handling and simple AI models. Roles: AI Developer, ML Intern, Data Analyst, Data Scientist.', 120, true, true),
('FRONTEND', 'Certificate Course in Front-End Developer', 'Master HTML, CSS, JavaScript and frameworks. Responsive design and interactive UI. Roles: Front-End Developer, UI Developer.', 90, true, true),
('SPOKEN-ENG', 'Certificate Course in Spoken English', 'Improve English communication for personal and professional growth. Speaking, listening and grammar. Roles: Customer Support, Sales Executive, Client Handling.', 45, true, true),
('ADV-COMP', 'Certificate Course in Advanced Computer', 'MS Office (Word, Excel, PowerPoint), file management and digital tools. Roles: Computer Operator, Office Assistant, Data Entry Operator.', 45, true, true),
('GRAPHIC', 'Certificate Course in Graphic Designing', 'Photoshop and design tools, color theory, typography and layouts. Roles: Graphic Designer, Creative Designer.', 90, true, true),
('TALLY-PRIME', 'Certificate Course in Tally Prime', 'Accounting with Tally, GST billing, ledger management and reports. Roles: Accountant, Billing Executive.', 60, true, true),
('C-PROG', 'Certificate Course in C Programming', 'Programming fundamentals with C language. Logic building, loops and functions. Roles: Programmer, Software Trainee.', 60, true, true),
('CPP-PROG', 'Certificate Course in C++ Programming', 'Object-oriented programming with C++. Classes, objects and inheritance. Roles: Software Developer, Programmer.', 60, true, true),
('DIGI-MKT', 'Certificate Course in Digital Marketing', 'SEO, social media marketing and online advertising. Live campaigns and tools. Roles: Digital Marketing Executive, SEO Executive.', 90, true, true),
('IT-ITES', 'IT & ITES Courses', 'Prepare for IT and IT-enabled service roles. Technical and communication skills, customer handling. Roles: IT Support, BPO Executive.', 60, true, true)
ON CONFLICT (course_code) DO UPDATE SET
  course_name = EXCLUDED.course_name,
  description = EXCLUDED.description,
  status = true;
