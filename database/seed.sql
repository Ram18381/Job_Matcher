-- ============================================================================
-- Job Matcher — Realistic PostgreSQL Seed Data
-- ============================================================================

-- 1. Insert Master Skills
INSERT INTO skills (name, category) VALUES
('Python', 'Programming'),
('Java', 'Programming'),
('C++', 'Programming'),
('JavaScript', 'Web Development'),
('TypeScript', 'Web Development'),
('React', 'Frontend Framework'),
('Node.js', 'Backend Framework'),
('Flask', 'Backend Framework'),
('PostgreSQL', 'Databases'),
('MySQL', 'Databases'),
('MongoDB', 'Databases'),
('Docker', 'DevOps & Cloud'),
('Kubernetes', 'DevOps & Cloud'),
('AWS', 'DevOps & Cloud'),
('Git', 'Tools'),
('Machine Learning', 'AI & Data'),
('Data Analysis', 'AI & Data'),
('UI/UX Design', 'Design'),
('HTML/CSS', 'Frontend Development'),
('REST APIs', 'Backend Development');

-- 2. Insert Accounts (Hashed passwords only)
-- Developer: developer / dev@123
-- Recruiters: priya_google, alex_microsoft, mark_nextgen / password123
-- Candidates: asha_dev, rahul_web, sneha_data / password123
INSERT INTO accounts (id, username, password_hash, role) VALUES
(1, 'developer', 'pbkdf2:sha256:260000$SeTTgahhHo6ByAuL$757afe20c6f8eb311ed89f7e8f4f3f7fe834477fcaca331e6581d6ae6c321734', 'developer'),
(2, 'priya_google', 'pbkdf2:sha256:260000$ruewzrQGjOLkbnCu$d1323c1f33b5eb8c5526fabb99eaa28dd29f0d833385bcfcc9e6901da3736068', 'recruiter'),
(3, 'alex_microsoft', 'pbkdf2:sha256:260000$ruewzrQGjOLkbnCu$d1323c1f33b5eb8c5526fabb99eaa28dd29f0d833385bcfcc9e6901da3736068', 'recruiter'),
(4, 'mark_nextgen', 'pbkdf2:sha256:260000$ruewzrQGjOLkbnCu$d1323c1f33b5eb8c5526fabb99eaa28dd29f0d833385bcfcc9e6901da3736068', 'recruiter'),
(5, 'asha_dev', 'pbkdf2:sha256:260000$ruewzrQGjOLkbnCu$d1323c1f33b5eb8c5526fabb99eaa28dd29f0d833385bcfcc9e6901da3736068', 'user'),
(6, 'rahul_web', 'pbkdf2:sha256:260000$ruewzrQGjOLkbnCu$d1323c1f33b5eb8c5526fabb99eaa28dd29f0d833385bcfcc9e6901da3736068', 'user'),
(7, 'sneha_data', 'pbkdf2:sha256:260000$ruewzrQGjOLkbnCu$d1323c1f33b5eb8c5526fabb99eaa28dd29f0d833385bcfcc9e6901da3736068', 'user');

ALTER SEQUENCE accounts_id_seq RESTART WITH 8;

-- 3. Insert Companies
-- Google and Microsoft are approved; NextGen AI Labs is pending (to showcase review workflow)
INSERT INTO companies (id, name, description, website, industry, location, status, reviewed_by, reviewed_at) VALUES
(1, 'Google India', 'Global technology leader specializing in search, cloud, AI, and consumer electronics.', 'https://google.com', 'Technology / Software', 'Bengaluru, India', 'approved', 1, CURRENT_TIMESTAMP - INTERVAL '10 days'),
(2, 'Microsoft R&D', 'Empowering every person and organization on the planet to achieve more through software and cloud systems.', 'https://microsoft.com', 'Cloud Computing / Enterprise', 'Hyderabad, India', 'approved', 1, CURRENT_TIMESTAMP - INTERVAL '8 days'),
(3, 'SkillBridge Cloud Systems', 'Modern open-source educational software and cloud learning infrastructure.', 'https://skillbridge.io', 'EdTech & Cloud', 'Pune, India', 'approved', 1, CURRENT_TIMESTAMP - INTERVAL '5 days'),
(4, 'NextGen AI Labs', 'Early-stage artificial intelligence startup building multimodal reasoning agents.', 'https://nextgenailabs.com', 'Artificial Intelligence', 'Bengaluru, India', 'pending', NULL, NULL);

ALTER SEQUENCE companies_id_seq RESTART WITH 5;

-- 4. Insert Recruiter Profiles
INSERT INTO recruiter_profiles (id, account_id, company_id, full_name, email, phone, designation) VALUES
(1, 2, 1, 'Priya Sharma', 'priya.recruiter@google.com', '+91 98765 43210', 'Senior Technical Recruiter'),
(2, 3, 2, 'Alex Henderson', 'alex.h@microsoft.com', '+91 98123 45678', 'Lead Engineering Recruiter'),
(3, 4, 4, 'Mark Zuckerberg Jr.', 'mark@nextgenailabs.com', '+91 97777 88888', 'Co-Founder & Talent Lead');

ALTER SEQUENCE recruiter_profiles_id_seq RESTART WITH 4;

-- 5. Insert Candidate Profiles
INSERT INTO candidate_profiles (id, account_id, full_name, email, phone, location, headline, bio, portfolio_url, github_url, linkedin_url) VALUES
(1, 5, 'Asha Kumar', 'asha.kumar@example.com', '+91 91234 56789', 'Bengaluru', 'Python & Backend Engineer | PostgreSQL Enthusiast', 'Passionate software developer focusing on scalable Python REST APIs, robust 3NF relational schemas, and microservice backends.', 'https://ashadev.io', 'https://github.com/ashakumar', 'https://linkedin.com/in/ashakumar'),
(2, 6, 'Rahul Sharma', 'rahul.dev@example.com', '+91 92345 67890', 'Hyderabad', 'React & Frontend Developer | UI/UX Enthusiast', 'Building accessible, fast, and responsive user interfaces with React, modern CSS, and state management.', 'https://rahuldev.dev', 'https://github.com/rahuldev', 'https://linkedin.com/in/rahuldev'),
(3, 7, 'Sneha Patel', 'sneha.patel@example.com', '+91 93456 78901', 'Pune', 'Data Analyst & SQL Specialist', 'Computer Science graduate specialized in relational data modeling, query optimization, and business analytics pipelines.', 'https://snehapatel.me', 'https://github.com/snehapatel', 'https://linkedin.com/in/snehapatel');

ALTER SEQUENCE candidate_profiles_id_seq RESTART WITH 4;

-- 6. Insert Candidate Skills
INSERT INTO candidate_skills (candidate_id, skill_id, proficiency, years_of_experience) VALUES
-- Asha: Strong in Python, Flask, PostgreSQL, Docker, REST APIs, Git
(1, 1, 'Advanced', 2.5),  -- Python
(1, 8, 'Advanced', 2.0),  -- Flask
(1, 9, 'Advanced', 2.5),  -- PostgreSQL
(1, 12, 'Intermediate', 1.5), -- Docker
(1, 15, 'Advanced', 3.0), -- Git
(1, 20, 'Advanced', 2.0), -- REST APIs

-- Rahul: Strong in JavaScript, React, HTML/CSS, TypeScript, UI/UX
(2, 4, 'Advanced', 2.5),  -- JavaScript
(2, 5, 'Intermediate', 1.5), -- TypeScript
(2, 6, 'Advanced', 2.0),  -- React
(2, 18, 'Intermediate', 1.5), -- UI/UX
(2, 19, 'Expert', 3.0),   -- HTML/CSS
(2, 15, 'Intermediate', 2.0), -- Git

-- Sneha: Strong in PostgreSQL, MySQL, Data Analysis, Python
(3, 9, 'Advanced', 2.0),  -- PostgreSQL
(3, 10, 'Intermediate', 2.0), -- MySQL
(3, 16, 'Beginner', 1.0), -- Machine Learning
(3, 17, 'Advanced', 2.5), -- Data Analysis
(3, 1, 'Intermediate', 2.0); -- Python

-- 7. Insert Education
INSERT INTO education (candidate_id, institution, degree, field_of_study, start_year, end_year, grade) VALUES
(1, 'National Institute of Technology', 'B.Tech', 'Computer Science and Engineering', 2021, 2025, '8.9 CGPA'),
(2, 'International Institute of Information Technology', 'B.Tech', 'Information Technology', 2022, 2026, '8.5 CGPA'),
(3, 'College of Engineering Pune', 'B.E.', 'Computer Engineering', 2020, 2024, '8.8 CGPA');

-- 8. Insert Experience
INSERT INTO experience (candidate_id, company_name, role_title, location, start_date, end_date, is_current, description) VALUES
(1, 'TechSpark Labs', 'Backend Development Intern', 'Bengaluru', '2024-05-01', '2024-08-31', FALSE, 'Implemented RESTful APIs using Flask and optimized PostgreSQL query latencies by 35%.'),
(2, 'PixelCraft Digital', 'Frontend Development Intern', 'Hyderabad', '2024-06-01', '2024-09-30', FALSE, 'Built modular React components and responsive dashboards with Tailwind CSS.');

-- 9. Insert Achievements
INSERT INTO achievements (candidate_id, title, issuer, issue_date, description) VALUES
(1, 'First Place — Smart City Hackathon 2024', 'IEEE Student Branch', '2024-03-15', 'Built an automated water management sensor dashboard with Python and PostgreSQL.'),
(2, 'Google Developer Student Clubs Lead', 'Google Developers', '2024-08-01', 'Led 200+ student developers in technical workshops on React and web engineering.');

-- 10. Insert Resumes
INSERT INTO resumes (id, candidate_id, file_name, file_path, file_size, is_default) VALUES
(1, 1, 'Asha_Kumar_Software_Engineer_CV.pdf', 'uploads/resumes/asha_kumar_cv.pdf', 1048576, TRUE),
(2, 2, 'Rahul_Sharma_Frontend_Dev_Resume.pdf', 'uploads/resumes/rahul_sharma_resume.pdf', 819200, TRUE),
(3, 3, 'Sneha_Patel_Data_Analyst_Resume.pdf', 'uploads/resumes/sneha_patel_resume.pdf', 921600, TRUE);

ALTER SEQUENCE resumes_id_seq RESTART WITH 4;

-- 11. Insert Candidate Job Preferences
INSERT INTO job_preferences (candidate_id, preferred_role, preferred_location, preferred_work_mode, min_expected_salary) VALUES
(1, 'Backend Software Engineer', 'Bengaluru', 'Hybrid', 600000.00),
(2, 'Frontend React Developer', 'Hyderabad', 'Remote', 550000.00),
(3, 'Data Analyst / SQL Engineer', 'Pune', 'On-site', 500000.00);

-- 12. Insert Jobs (Posted by approved recruiters)
INSERT INTO jobs (id, company_id, recruiter_id, title, job_type, work_mode, location, description, requirements, salary_min, salary_max, deadline, status) VALUES
(1, 1, 1, 'Software Engineer — Backend & Cloud Systems', 'Full-time', 'Hybrid', 'Bengaluru', 
 'Design, scale, and maintain high-throughput backend services and cloud infrastructure at Google India.', 
 'Hands-on experience in Python or Java, relational databases (PostgreSQL preferred), and REST APIs.', 
 1200000.00, 1800000.00, CURRENT_DATE + INTERVAL '45 days', 'published'),

(2, 1, 1, 'Backend Development Summer Intern', 'Internship', 'On-site', 'Bengaluru', 
 'Three-month rigorous software engineering internship working on Google Cloud backend tools.', 
 'Proficiency in Python/Flask or Go, database modeling, and foundational data structures.', 
 400000.00, 600000.00, CURRENT_DATE + INTERVAL '30 days', 'published'),

(3, 2, 2, 'Frontend React & Cloud UI Developer', 'Full-time', 'Remote', 'Hyderabad', 
 'Build modern web applications for Microsoft Azure cloud management portals.', 
 'Strong grasp of modern JavaScript/TypeScript, React 18, HTML5/CSS, and RESTful API consumption.', 
 1100000.00, 1600000.00, CURRENT_DATE + INTERVAL '60 days', 'published'),

(4, 2, 2, 'Data Analytics & SQL Intern', 'Internship', 'Hybrid', 'Hyderabad', 
 'Collaborate with enterprise data teams to build analytical dashboards and optimize SQL reporting pipelines.', 
 'Proficiency in SQL (PostgreSQL/MySQL), basic Python scripting, and data visualization.', 
 350000.00, 500000.00, CURRENT_DATE + INTERVAL '25 days', 'published');

ALTER SEQUENCE jobs_id_seq RESTART WITH 5;

-- 13. Insert Job Skills Requirements
INSERT INTO job_skills (job_id, skill_id, is_required, min_proficiency) VALUES
-- Job 1 (Google Backend Full-time): Python, PostgreSQL, REST APIs, Docker
(1, 1, TRUE, 'Advanced'),     -- Python
(1, 9, TRUE, 'Advanced'),     -- PostgreSQL
(1, 20, TRUE, 'Intermediate'), -- REST APIs
(1, 12, FALSE, 'Intermediate'), -- Docker

-- Job 2 (Google Backend Intern): Python, Flask, PostgreSQL
(2, 1, TRUE, 'Intermediate'), -- Python
(2, 8, TRUE, 'Intermediate'), -- Flask
(2, 9, TRUE, 'Intermediate'), -- PostgreSQL

-- Job 3 (Microsoft Frontend Full-time): React, JavaScript, TypeScript, HTML/CSS
(3, 6, TRUE, 'Advanced'),     -- React
(3, 4, TRUE, 'Advanced'),     -- JavaScript
(3, 5, TRUE, 'Intermediate'), -- TypeScript
(3, 19, TRUE, 'Advanced'),    -- HTML/CSS

-- Job 4 (Microsoft Data Intern): PostgreSQL, Data Analysis, Python
(4, 9, TRUE, 'Intermediate'), -- PostgreSQL
(4, 17, TRUE, 'Intermediate'), -- Data Analysis
(4, 1, FALSE, 'Beginner');    -- Python

-- 14. Insert Applications
INSERT INTO applications (id, job_id, candidate_id, resume_id, cover_letter, current_status, applied_at) VALUES
(1, 1, 1, 1, 'Excited to apply for Google Backend Engineer role. I bring strong skills in Python and PostgreSQL database modeling.', 'under_review', CURRENT_TIMESTAMP - INTERVAL '3 days'),
(2, 3, 2, 2, 'Passionate frontend engineer eager to contribute to Microsoft Azure portal UI.', 'shortlisted', CURRENT_TIMESTAMP - INTERVAL '2 days'),
(3, 4, 3, 3, 'My coursework in advanced database normalization and SQL query optimization aligns directly with this internship.', 'submitted', CURRENT_TIMESTAMP - INTERVAL '1 day');

ALTER SEQUENCE applications_id_seq RESTART WITH 4;

-- 15. Insert Application Status History
INSERT INTO application_status_history (application_id, status, notes, changed_by, changed_at) VALUES
(1, 'submitted', 'Application received from candidate.', 5, CURRENT_TIMESTAMP - INTERVAL '3 days'),
(1, 'under_review', 'Recruiter Priya reviewed candidate resume and technical skills.', 2, CURRENT_TIMESTAMP - INTERVAL '2 days'),
(2, 'submitted', 'Application received from candidate.', 6, CURRENT_TIMESTAMP - INTERVAL '2 days'),
(2, 'shortlisted', 'Candidate shortlisted for technical screening round.', 3, CURRENT_TIMESTAMP - INTERVAL '1 day'),
(3, 'submitted', 'Application received from candidate.', 7, CURRENT_TIMESTAMP - INTERVAL '1 day');
