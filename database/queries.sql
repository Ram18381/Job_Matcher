-- ============================================================================
-- Job Matcher — Core SQL Queries for Learning & Educational Reference
-- This file contains the exact parameterized SQL queries used across the
-- platform for Job Matching, Role Access Control, and Relational Auditing.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Skill-Based Recommendation & Matching Query
-- Purpose: Dynamically computes percentage match of candidate skills against
--          job required skills, and matches location & work mode preferences.
-- Parameters: $1 = candidate account_id (e.g. 5 for Asha Kumar)
-- ----------------------------------------------------------------------------
WITH candidate_info AS (
    SELECT 
        cp.id AS cand_id,
        jp.preferred_location,
        jp.preferred_work_mode,
        jp.min_expected_salary
    FROM candidate_profiles cp
    LEFT JOIN job_preferences jp ON jp.candidate_id = cp.id
    WHERE cp.account_id = 5 -- Replace with $1 in parameterized backend query
),
job_skill_stats AS (
    SELECT 
        j.id AS job_id,
        COUNT(js.skill_id) AS total_required_skills,
        COUNT(cs.skill_id) AS matching_skills_count,
        COALESCE(
            JSON_AGG(
                JSON_BUILD_OBJECT('id', s.id, 'name', s.name, 'matched', (cs.skill_id IS NOT NULL))
            ) FILTER (WHERE s.id IS NOT NULL), '[]'::json
        ) AS skills_breakdown
    FROM jobs j
    CROSS JOIN candidate_info ci
    LEFT JOIN job_skills js ON js.job_id = j.id
    LEFT JOIN skills s ON s.id = js.skill_id
    LEFT JOIN candidate_skills cs ON cs.skill_id = js.skill_id AND cs.candidate_id = ci.cand_id
    WHERE j.status = 'published' AND j.deadline >= CURRENT_DATE
    GROUP BY j.id
)
SELECT 
    j.id,
    j.title,
    j.job_type,
    j.work_mode,
    j.location,
    j.salary_min,
    j.salary_max,
    j.deadline,
    c.name AS company_name,
    c.industry,
    c.location AS company_location,
    jss.total_required_skills,
    jss.matching_skills_count,
    ROUND(
        CASE 
            WHEN jss.total_required_skills = 0 THEN 100.0
            ELSE (100.0 * jss.matching_skills_count / jss.total_required_skills)
        END, 1
    ) AS match_percentage,
    (ci.preferred_work_mode IS NOT NULL AND (ci.preferred_work_mode = 'Any' OR ci.preferred_work_mode = j.work_mode)) AS work_mode_match,
    (ci.preferred_location IS NOT NULL AND LOWER(j.location) LIKE LOWER('%' || ci.preferred_location || '%')) AS location_match,
    jss.skills_breakdown
FROM jobs j
JOIN companies c ON c.id = j.company_id
JOIN job_skill_stats jss ON jss.job_id = j.id
CROSS JOIN candidate_info ci
WHERE j.status = 'published' AND j.deadline >= CURRENT_DATE
ORDER BY match_percentage DESC, j.created_at DESC;


-- ----------------------------------------------------------------------------
-- 2. Browse Jobs with Filters (Candidate & Guest View)
-- Purpose: Returns all published, active jobs that have not passed their deadline.
-- ----------------------------------------------------------------------------
SELECT 
    j.id,
    j.title,
    j.job_type,
    j.work_mode,
    j.location,
    j.description,
    j.requirements,
    j.salary_min,
    j.salary_max,
    j.deadline,
    j.created_at,
    c.id AS company_id,
    c.name AS company_name,
    c.industry,
    c.website,
    COALESCE(
        JSON_AGG(
            JSON_BUILD_OBJECT('id', s.id, 'name', s.name, 'is_required', js.is_required, 'min_proficiency', js.min_proficiency)
        ) FILTER (WHERE s.id IS NOT NULL), '[]'::json
    ) AS required_skills
FROM jobs j
JOIN companies c ON c.id = j.company_id
LEFT JOIN job_skills js ON js.job_id = j.id
LEFT JOIN skills s ON s.id = js.skill_id
WHERE j.status = 'published' 
  AND j.deadline >= CURRENT_DATE
  -- Optional search: AND (LOWER(j.title) LIKE LOWER('%python%') OR LOWER(c.name) LIKE LOWER('%python%'))
GROUP BY j.id, c.id
ORDER BY j.created_at DESC;


-- ----------------------------------------------------------------------------
-- 3. Recruiter Applicants Review Query (Scoped strictly to Recruiter's Company)
-- Purpose: Enables approved recruiters to view candidates who applied to their jobs,
--          including candidate skills, contact info, and attached resume.
-- Parameters: $1 = company_id
-- ----------------------------------------------------------------------------
SELECT 
    a.id AS application_id,
    a.current_status,
    a.applied_at,
    a.cover_letter,
    j.id AS job_id,
    j.title AS job_title,
    cp.id AS candidate_id,
    cp.full_name AS candidate_name,
    cp.email AS candidate_email,
    cp.phone AS candidate_phone,
    cp.headline AS candidate_headline,
    r.id AS resume_id,
    r.file_name AS resume_file_name,
    r.file_path AS resume_file_path,
    COALESCE(
        JSON_AGG(
            JSON_BUILD_OBJECT('skill', s.name, 'proficiency', cs.proficiency)
        ) FILTER (WHERE s.id IS NOT NULL), '[]'::json
    ) AS candidate_skills
FROM applications a
JOIN jobs j ON j.id = a.job_id
JOIN candidate_profiles cp ON cp.id = a.candidate_id
LEFT JOIN resumes r ON r.id = a.resume_id
LEFT JOIN candidate_skills cs ON cs.candidate_id = cp.id
LEFT JOIN skills s ON s.id = cs.skill_id
WHERE j.company_id = 1 -- Scoped strictly to recruiter's approved company
GROUP BY a.id, j.id, cp.id, r.id
ORDER BY a.applied_at DESC;


-- ----------------------------------------------------------------------------
-- 4. Candidate Application History with Audit Trail
-- Purpose: Candidate views their applications, status progression, and reviewer notes.
-- Parameters: $1 = candidate_id
-- ----------------------------------------------------------------------------
SELECT 
    a.id AS application_id,
    a.current_status,
    a.applied_at,
    j.id AS job_id,
    j.title AS job_title,
    j.job_type,
    j.work_mode,
    j.location AS job_location,
    c.name AS company_name,
    COALESCE(
        (
            SELECT JSON_AGG(
                JSON_BUILD_OBJECT(
                    'status', ash.status,
                    'notes', ash.notes,
                    'changed_at', ash.changed_at
                ) ORDER BY ash.changed_at ASC
            )
            FROM application_status_history ash
            WHERE ash.application_id = a.id
        ), '[]'::json
    ) AS status_history
FROM applications a
JOIN jobs j ON j.id = a.job_id
JOIN companies c ON c.id = j.company_id
WHERE a.candidate_id = 1
ORDER BY a.applied_at DESC;


-- ----------------------------------------------------------------------------
-- 5. Developer Oversight: Pending Company Approvals
-- Purpose: Platform developers review unverified companies and attached recruiters.
-- ----------------------------------------------------------------------------
SELECT 
    c.id AS company_id,
    c.name AS company_name,
    c.industry,
    c.website,
    c.location,
    c.created_at AS registered_at,
    c.status,
    rp.full_name AS recruiter_name,
    rp.email AS recruiter_email,
    rp.phone AS recruiter_phone,
    rp.designation AS recruiter_designation,
    acc.username AS recruiter_username
FROM companies c
JOIN recruiter_profiles rp ON rp.company_id = c.id
JOIN accounts acc ON acc.id = rp.account_id
WHERE c.status = 'pending'
ORDER BY c.created_at ASC;
