-- ============================================================================
-- Job Matcher — Relational PostgreSQL Schema (3NF Normalized)
-- Purpose: Beginner-friendly full-stack web and SQL platform connecting
--          Candidates, Recruiters, and Website Developers.
-- ============================================================================

-- Clean up existing tables in reverse dependency order
DROP TABLE IF EXISTS application_status_history CASCADE;
DROP TABLE IF EXISTS applications CASCADE;
DROP TABLE IF EXISTS job_skills CASCADE;
DROP TABLE IF EXISTS jobs CASCADE;
DROP TABLE IF EXISTS job_preferences CASCADE;
DROP TABLE IF EXISTS resumes CASCADE;
DROP TABLE IF EXISTS achievements CASCADE;
DROP TABLE IF EXISTS experience CASCADE;
DROP TABLE IF EXISTS education CASCADE;
DROP TABLE IF EXISTS candidate_skills CASCADE;
DROP TABLE IF EXISTS skills CASCADE;
DROP TABLE IF EXISTS recruiter_profiles CASCADE;
DROP TABLE IF EXISTS companies CASCADE;
DROP TABLE IF EXISTS candidate_profiles CASCADE;
DROP TABLE IF EXISTS accounts CASCADE;

-- 1. Accounts Table (Handles authentication and role assignment)
-- Supported roles: 'user' (Candidate/Student), 'recruiter', 'developer' (Admin)
CREATE TABLE accounts (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'recruiter', 'developer')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Candidate Profiles Table (User biographical & contact details)
CREATE TABLE candidate_profiles (
    id SERIAL PRIMARY KEY,
    account_id INT UNIQUE NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(120),
    phone VARCHAR(30),
    location VARCHAR(100),
    headline VARCHAR(200),
    bio TEXT,
    portfolio_url VARCHAR(255),
    github_url VARCHAR(255),
    linkedin_url VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Companies Table (Recruiter organization profiles)
-- Status starts as 'pending' until approved by a Website Developer.
CREATE TABLE companies (
    id SERIAL PRIMARY KEY,
    name VARCHAR(150) UNIQUE NOT NULL,
    description TEXT,
    website VARCHAR(255),
    industry VARCHAR(100),
    location VARCHAR(150),
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    reviewed_by INT REFERENCES accounts(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Recruiter Profiles Table (Tied to an account and a specific company)
CREATE TABLE recruiter_profiles (
    id SERIAL PRIMARY KEY,
    account_id INT UNIQUE NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    company_id INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    full_name VARCHAR(100) NOT NULL,
    email VARCHAR(120),
    phone VARCHAR(30),
    designation VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. Master Skills Table (Isolated master table for 3NF normalization)
CREATE TABLE skills (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    category VARCHAR(50) DEFAULT 'General'
);

-- 6. Candidate Skills Table (Junction: Candidate <-> Skill with proficiency)
CREATE TABLE candidate_skills (
    id SERIAL PRIMARY KEY,
    candidate_id INT NOT NULL REFERENCES candidate_profiles(id) ON DELETE CASCADE,
    skill_id INT NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
    proficiency VARCHAR(20) NOT NULL DEFAULT 'Intermediate' 
        CHECK (proficiency IN ('Beginner', 'Intermediate', 'Advanced', 'Expert')),
    years_of_experience NUMERIC(3, 1) DEFAULT 0 CHECK (years_of_experience >= 0),
    UNIQUE (candidate_id, skill_id)
);

-- 7. Education Table (Degrees and academic qualifications)
CREATE TABLE education (
    id SERIAL PRIMARY KEY,
    candidate_id INT NOT NULL REFERENCES candidate_profiles(id) ON DELETE CASCADE,
    institution VARCHAR(200) NOT NULL,
    degree VARCHAR(150) NOT NULL,
    field_of_study VARCHAR(150),
    start_year INT CHECK (start_year >= 1950 AND start_year <= 2100),
    end_year INT CHECK (end_year >= 1950 AND end_year <= 2100),
    grade VARCHAR(50),
    CONSTRAINT chk_edu_years CHECK (end_year IS NULL OR end_year >= start_year)
);

-- 8. Experience Table (Internships and employment history)
CREATE TABLE experience (
    id SERIAL PRIMARY KEY,
    candidate_id INT NOT NULL REFERENCES candidate_profiles(id) ON DELETE CASCADE,
    company_name VARCHAR(150) NOT NULL,
    role_title VARCHAR(150) NOT NULL,
    location VARCHAR(100),
    start_date DATE,
    end_date DATE,
    is_current BOOLEAN DEFAULT FALSE,
    description TEXT
);

-- 9. Achievements Table (Certifications, awards, hackathon wins)
CREATE TABLE achievements (
    id SERIAL PRIMARY KEY,
    candidate_id INT NOT NULL REFERENCES candidate_profiles(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    issuer VARCHAR(150),
    issue_date DATE,
    description TEXT
);

-- 10. Resumes Table (Stored references to candidate uploaded CV files)
CREATE TABLE resumes (
    id SERIAL PRIMARY KEY,
    candidate_id INT NOT NULL REFERENCES candidate_profiles(id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_size INT,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_default BOOLEAN DEFAULT FALSE
);

-- 11. Job Preferences Table (Candidate targeting preferences for matchmaking)
CREATE TABLE job_preferences (
    id SERIAL PRIMARY KEY,
    candidate_id INT UNIQUE NOT NULL REFERENCES candidate_profiles(id) ON DELETE CASCADE,
    preferred_role VARCHAR(150),
    preferred_location VARCHAR(150),
    preferred_work_mode VARCHAR(20) DEFAULT 'Any' 
        CHECK (preferred_work_mode IN ('Remote', 'Hybrid', 'On-site', 'Any')),
    min_expected_salary NUMERIC(12, 2) DEFAULT 0 CHECK (min_expected_salary >= 0)
);

-- 12. Jobs Table (Opportunities posted by approved recruiters)
CREATE TABLE jobs (
    id SERIAL PRIMARY KEY,
    company_id INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    recruiter_id INT NOT NULL REFERENCES recruiter_profiles(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    job_type VARCHAR(20) NOT NULL CHECK (job_type IN ('Full-time', 'Part-time', 'Internship', 'Contract')),
    work_mode VARCHAR(20) NOT NULL DEFAULT 'On-site' CHECK (work_mode IN ('Remote', 'Hybrid', 'On-site')),
    location VARCHAR(150) NOT NULL,
    description TEXT NOT NULL,
    requirements TEXT,
    salary_min NUMERIC(12, 2) DEFAULT 0 CHECK (salary_min >= 0),
    salary_max NUMERIC(12, 2) DEFAULT 0 CHECK (salary_max >= salary_min),
    deadline DATE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published', 'closed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 13. Job Skills Table (Junction: Job <-> Required Skills)
CREATE TABLE job_skills (
    id SERIAL PRIMARY KEY,
    job_id INT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    skill_id INT NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
    is_required BOOLEAN DEFAULT TRUE,
    min_proficiency VARCHAR(20) DEFAULT 'Intermediate' 
        CHECK (min_proficiency IN ('Beginner', 'Intermediate', 'Advanced', 'Expert')),
    UNIQUE (job_id, skill_id)
);

-- 14. Applications Table (Candidate applications to specific jobs)
CREATE TABLE applications (
    id SERIAL PRIMARY KEY,
    job_id INT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    candidate_id INT NOT NULL REFERENCES candidate_profiles(id) ON DELETE CASCADE,
    resume_id INT REFERENCES resumes(id) ON DELETE SET NULL,
    cover_letter TEXT,
    current_status VARCHAR(20) NOT NULL DEFAULT 'submitted' 
        CHECK (current_status IN ('submitted', 'under_review', 'shortlisted', 'rejected', 'selected')),
    applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (job_id, candidate_id) -- Prevents duplicate applications
);

-- 15. Application Status History Table (Audit trail for status progressions)
CREATE TABLE application_status_history (
    id SERIAL PRIMARY KEY,
    application_id INT NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL 
        CHECK (status IN ('submitted', 'under_review', 'shortlisted', 'rejected', 'selected')),
    notes TEXT,
    changed_by INT REFERENCES accounts(id) ON DELETE SET NULL,
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- Performance Indexes
-- ============================================================================
CREATE INDEX idx_accounts_username ON accounts(username);
CREATE INDEX idx_accounts_role ON accounts(role);
CREATE INDEX idx_companies_status ON companies(status);
CREATE INDEX idx_jobs_company ON jobs(company_id);
CREATE INDEX idx_jobs_status_deadline ON jobs(status, deadline);
CREATE INDEX idx_candidate_skills_candidate ON candidate_skills(candidate_id);
CREATE INDEX idx_job_skills_job ON job_skills(job_id);
CREATE INDEX idx_applications_candidate ON applications(candidate_id);
CREATE INDEX idx_applications_job ON applications(job_id);
CREATE INDEX idx_app_history_app ON application_status_history(application_id);
