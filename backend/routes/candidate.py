import os
from flask import Blueprint, request, jsonify, session
from werkzeug.utils import secure_filename
import time
from backend.db import get_db
from backend.config import Config
from backend.utils import role_required, clean_record, allowed_file

candidate_bp = Blueprint("candidate", __name__, url_prefix="/api/candidate")

def _get_candidate_id(cur, account_id):
    """Helper to fetch candidate_id from candidate_profiles for current account."""
    cur.execute("SELECT id FROM candidate_profiles WHERE account_id = %s;", (account_id,))
    row = cur.fetchone()
    if not row:
        raise ValueError("Candidate profile not found for this account.")
    return row["id"]


# -----------------------------------------------------------------------------
# 1. Profile Management
# -----------------------------------------------------------------------------
@candidate_bp.route("/profile", methods=["GET"])
@role_required("user")
def get_profile():
    """Fetches candidate full profile, including sub-entities."""
    account_id = session["account_id"]
    try:
        with get_db() as (conn, cur):
            cand_id = _get_candidate_id(cur, account_id)

            cur.execute("SELECT * FROM candidate_profiles WHERE id = %s;", (cand_id,))
            profile = clean_record(cur.fetchone())

            cur.execute(
                """
                SELECT cs.id, cs.skill_id, s.name AS skill_name, s.category, cs.proficiency, cs.years_of_experience
                FROM candidate_skills cs
                JOIN skills s ON s.id = cs.skill_id
                WHERE cs.candidate_id = %s
                ORDER BY s.name ASC;
                """,
                (cand_id,)
            )
            skills = clean_record(cur.fetchall())

            cur.execute("SELECT * FROM education WHERE candidate_id = %s ORDER BY start_year DESC;", (cand_id,))
            education = clean_record(cur.fetchall())

            cur.execute("SELECT * FROM experience WHERE candidate_id = %s ORDER BY start_date DESC;", (cand_id,))
            experience = clean_record(cur.fetchall())

            cur.execute("SELECT * FROM achievements WHERE candidate_id = %s ORDER BY issue_date DESC;", (cand_id,))
            achievements = clean_record(cur.fetchall())

            cur.execute("SELECT * FROM resumes WHERE candidate_id = %s ORDER BY uploaded_at DESC;", (cand_id,))
            resumes = clean_record(cur.fetchall())

            cur.execute("SELECT * FROM job_preferences WHERE candidate_id = %s;", (cand_id,))
            preferences = clean_record(cur.fetchone())

        return jsonify({
            "profile": profile,
            "skills": skills,
            "education": education,
            "experience": experience,
            "achievements": achievements,
            "resumes": resumes,
            "preferences": preferences or {}
        }), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@candidate_bp.route("/profile", methods=["PUT"])
@role_required("user")
def update_profile():
    """Updates biographical and contact details for the candidate."""
    account_id = session["account_id"]
    data = request.get_json() or {}

    try:
        with get_db() as (conn, cur):
            cand_id = _get_candidate_id(cur, account_id)
            cur.execute(
                """
                UPDATE candidate_profiles
                SET full_name = COALESCE(%s, full_name),
                    email = %s,
                    phone = %s,
                    location = %s,
                    headline = %s,
                    bio = %s,
                    portfolio_url = %s,
                    github_url = %s,
                    linkedin_url = %s,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = %s
                RETURNING *;
                """,
                (
                    data.get("full_name"),
                    data.get("email"),
                    data.get("phone"),
                    data.get("location"),
                    data.get("headline"),
                    data.get("bio"),
                    data.get("portfolio_url"),
                    data.get("github_url"),
                    data.get("linkedin_url"),
                    cand_id
                )
            )
            updated = clean_record(cur.fetchone())
            session["name"] = updated["full_name"]

        return jsonify({"message": "Profile updated successfully!", "profile": updated}), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# -----------------------------------------------------------------------------
# 2. Skills Management
# -----------------------------------------------------------------------------
@candidate_bp.route("/skills", methods=["POST"])
@role_required("user")
def add_skill():
    """Adds a skill to the candidate's profile."""
    account_id = session["account_id"]
    data = request.get_json() or {}
    skill_name = (data.get("skill_name") or "").strip()
    skill_id = data.get("skill_id")
    proficiency = data.get("proficiency", "Intermediate")
    years_exp = float(data.get("years_of_experience") or 0)

    try:
        with get_db() as (conn, cur):
            cand_id = _get_candidate_id(cur, account_id)

            if not skill_id and skill_name:
                cur.execute("SELECT id FROM skills WHERE LOWER(name) = LOWER(%s);", (skill_name,))
                existing_skill = cur.fetchone()
                if existing_skill:
                    skill_id = existing_skill["id"]
                else:
                    cur.execute(
                        "INSERT INTO skills (name, category) VALUES (%s, %s) RETURNING id;",
                        (skill_name, data.get("category", "General"))
                    )
                    skill_id = cur.fetchone()["id"]

            if not skill_id:
                return jsonify({"error": "Please specify a skill name or ID."}), 400

            # Insert or update candidate skill
            cur.execute(
                """
                INSERT INTO candidate_skills (candidate_id, skill_id, proficiency, years_of_experience)
                VALUES (%s, %s, %s, %s)
                ON CONFLICT (candidate_id, skill_id) DO UPDATE
                SET proficiency = EXCLUDED.proficiency,
                    years_of_experience = EXCLUDED.years_of_experience
                RETURNING id;
                """,
                (cand_id, skill_id, proficiency, years_exp)
            )

        return jsonify({"message": "Skill added to profile!"}), 201

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@candidate_bp.route("/skills/<int:candidate_skill_id>", methods=["DELETE"])
@role_required("user")
def delete_skill(candidate_skill_id):
    """Removes a skill from the candidate's profile."""
    account_id = session["account_id"]
    try:
        with get_db() as (conn, cur):
            cand_id = _get_candidate_id(cur, account_id)
            cur.execute(
                "DELETE FROM candidate_skills WHERE id = %s AND candidate_id = %s;",
                (candidate_skill_id, cand_id)
            )
        return jsonify({"message": "Skill removed from profile."}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# -----------------------------------------------------------------------------
# 3. Education, Experience, Achievements
# -----------------------------------------------------------------------------
@candidate_bp.route("/education", methods=["POST"])
@role_required("user")
def add_education():
    account_id = session["account_id"]
    data = request.get_json() or {}
    institution = (data.get("institution") or "").strip()
    degree = (data.get("degree") or "").strip()
    field_of_study = (data.get("field_of_study") or "").strip()
    start_year = data.get("start_year")
    end_year = data.get("end_year")
    grade = data.get("grade")

    if not institution or not degree:
        return jsonify({"error": "Institution and degree are required."}), 400

    try:
        with get_db() as (conn, cur):
            cand_id = _get_candidate_id(cur, account_id)
            cur.execute(
                """
                INSERT INTO education (candidate_id, institution, degree, field_of_study, start_year, end_year, grade)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                RETURNING *;
                """,
                (cand_id, institution, degree, field_of_study, start_year or None, end_year or None, grade or None)
            )
            item = clean_record(cur.fetchone())
        return jsonify({"message": "Education record added!", "education": item}), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@candidate_bp.route("/education/<int:edu_id>", methods=["DELETE"])
@role_required("user")
def delete_education(edu_id):
    account_id = session["account_id"]
    try:
        with get_db() as (conn, cur):
            cand_id = _get_candidate_id(cur, account_id)
            cur.execute("DELETE FROM education WHERE id = %s AND candidate_id = %s;", (edu_id, cand_id))
        return jsonify({"message": "Education record deleted."}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@candidate_bp.route("/experience", methods=["POST"])
@role_required("user")
def add_experience():
    account_id = session["account_id"]
    data = request.get_json() or {}
    company_name = (data.get("company_name") or "").strip()
    role_title = (data.get("role_title") or "").strip()
    location = data.get("location")
    start_date = data.get("start_date") or None
    end_date = data.get("end_date") or None
    is_current = bool(data.get("is_current", False))
    description = data.get("description")

    if not company_name or not role_title:
        return jsonify({"error": "Company name and role title are required."}), 400

    try:
        with get_db() as (conn, cur):
            cand_id = _get_candidate_id(cur, account_id)
            cur.execute(
                """
                INSERT INTO experience (candidate_id, company_name, role_title, location, start_date, end_date, is_current, description)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING *;
                """,
                (cand_id, company_name, role_title, location, start_date, end_date, is_current, description)
            )
            item = clean_record(cur.fetchone())
        return jsonify({"message": "Experience record added!", "experience": item}), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@candidate_bp.route("/experience/<int:exp_id>", methods=["DELETE"])
@role_required("user")
def delete_experience(exp_id):
    account_id = session["account_id"]
    try:
        with get_db() as (conn, cur):
            cand_id = _get_candidate_id(cur, account_id)
            cur.execute("DELETE FROM experience WHERE id = %s AND candidate_id = %s;", (exp_id, cand_id))
        return jsonify({"message": "Experience record deleted."}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@candidate_bp.route("/achievements", methods=["POST"])
@role_required("user")
def add_achievement():
    account_id = session["account_id"]
    data = request.get_json() or {}
    title = (data.get("title") or "").strip()
    issuer = data.get("issuer")
    issue_date = data.get("issue_date") or None
    description = data.get("description")

    if not title:
        return jsonify({"error": "Achievement title is required."}), 400

    try:
        with get_db() as (conn, cur):
            cand_id = _get_candidate_id(cur, account_id)
            cur.execute(
                """
                INSERT INTO achievements (candidate_id, title, issuer, issue_date, description)
                VALUES (%s, %s, %s, %s, %s)
                RETURNING *;
                """,
                (cand_id, title, issuer, issue_date, description)
            )
            item = clean_record(cur.fetchone())
        return jsonify({"message": "Achievement added!", "achievement": item}), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@candidate_bp.route("/achievements/<int:ach_id>", methods=["DELETE"])
@role_required("user")
def delete_achievement(ach_id):
    account_id = session["account_id"]
    try:
        with get_db() as (conn, cur):
            cand_id = _get_candidate_id(cur, account_id)
            cur.execute("DELETE FROM achievements WHERE id = %s AND candidate_id = %s;", (ach_id, cand_id))
        return jsonify({"message": "Achievement deleted."}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# -----------------------------------------------------------------------------
# 4. Job Preferences
# -----------------------------------------------------------------------------
@candidate_bp.route("/preferences", methods=["GET", "PUT"])
@role_required("user")
def manage_preferences():
    account_id = session["account_id"]
    try:
        with get_db() as (conn, cur):
            cand_id = _get_candidate_id(cur, account_id)

            if request.method == "GET":
                cur.execute("SELECT * FROM job_preferences WHERE candidate_id = %s;", (cand_id,))
                return jsonify(clean_record(cur.fetchone()) or {}), 200

            data = request.get_json() or {}
            preferred_role = data.get("preferred_role")
            preferred_location = data.get("preferred_location")
            preferred_work_mode = data.get("preferred_work_mode", "Any")
            min_salary = float(data.get("min_expected_salary") or 0)

            cur.execute(
                """
                INSERT INTO job_preferences (candidate_id, preferred_role, preferred_location, preferred_work_mode, min_expected_salary)
                VALUES (%s, %s, %s, %s, %s)
                ON CONFLICT (candidate_id) DO UPDATE
                SET preferred_role = EXCLUDED.preferred_role,
                    preferred_location = EXCLUDED.preferred_location,
                    preferred_work_mode = EXCLUDED.preferred_work_mode,
                    min_expected_salary = EXCLUDED.min_expected_salary
                RETURNING *;
                """,
                (cand_id, preferred_role, preferred_location, preferred_work_mode, min_salary)
            )
            item = clean_record(cur.fetchone())
        return jsonify({"message": "Job preferences saved!", "preferences": item}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# -----------------------------------------------------------------------------
# 5. Resume / CV Uploads
# -----------------------------------------------------------------------------
@candidate_bp.route("/resumes/upload", methods=["POST"])
@role_required("user")
def upload_resume():
    """Uploads a candidate resume file and stores DB reference."""
    account_id = session["account_id"]
    if "resume" not in request.files:
        return jsonify({"error": "No resume file attached to request."}), 400

    file = request.files["resume"]
    if file.filename == "":
        return jsonify({"error": "No file selected."}), 400

    if not allowed_file(file.filename):
        return jsonify({"error": f"Invalid file type. Allowed: {', '.join(Config.ALLOWED_EXTENSIONS)}"}), 400

    original_filename = secure_filename(file.filename)
    unique_filename = f"{int(time.time())}_{original_filename}"
    save_path = os.path.join(Config.UPLOAD_FOLDER, unique_filename)
    
    os.makedirs(Config.UPLOAD_FOLDER, exist_ok=True)
    file.save(save_path)
    file_size = os.path.getsize(save_path)

    relative_path = f"uploads/resumes/{unique_filename}"

    try:
        with get_db() as (conn, cur):
            cand_id = _get_candidate_id(cur, account_id)

            # Check if this is the first resume, if so make default
            cur.execute("SELECT COUNT(*) AS c FROM resumes WHERE candidate_id = %s;", (cand_id,))
            count = cur.fetchone()["c"]
            is_default = (count == 0)

            cur.execute(
                """
                INSERT INTO resumes (candidate_id, file_name, file_path, file_size, is_default)
                VALUES (%s, %s, %s, %s, %s)
                RETURNING *;
                """,
                (cand_id, original_filename, relative_path, file_size, is_default)
            )
            resume_item = clean_record(cur.fetchone())

        return jsonify({"message": "Resume uploaded successfully!", "resume": resume_item}), 201

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@candidate_bp.route("/resumes/<int:resume_id>/default", methods=["PUT"])
@role_required("user")
def set_default_resume(resume_id):
    account_id = session["account_id"]
    try:
        with get_db() as (conn, cur):
            cand_id = _get_candidate_id(cur, account_id)
            cur.execute("UPDATE resumes SET is_default = FALSE WHERE candidate_id = %s;", (cand_id,))
            cur.execute("UPDATE resumes SET is_default = TRUE WHERE id = %s AND candidate_id = %s;", (resume_id, cand_id))
        return jsonify({"message": "Default resume updated."}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@candidate_bp.route("/resumes/<int:resume_id>", methods=["DELETE"])
@role_required("user")
def delete_resume(resume_id):
    account_id = session["account_id"]
    try:
        with get_db() as (conn, cur):
            cand_id = _get_candidate_id(cur, account_id)
            cur.execute("SELECT file_path FROM resumes WHERE id = %s AND candidate_id = %s;", (resume_id, cand_id))
            r = cur.fetchone()
            if r:
                full_path = os.path.join(Config.BASE_DIR, r["file_path"].replace("/", os.sep))
                if os.path.exists(full_path):
                    try:
                        os.remove(full_path)
                    except Exception:
                        pass
                cur.execute("DELETE FROM resumes WHERE id = %s AND candidate_id = %s;", (resume_id, cand_id))
        return jsonify({"message": "Resume deleted."}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# -----------------------------------------------------------------------------
# 6. Applications Tracking with Audit Trail
# -----------------------------------------------------------------------------
@candidate_bp.route("/applications", methods=["GET"])
@role_required("user")
def my_applications():
    """Returns candidate's submitted applications and full status progression audit."""
    account_id = session["account_id"]
    try:
        with get_db() as (conn, cur):
            cand_id = _get_candidate_id(cur, account_id)
            cur.execute(
                """
                SELECT 
                    a.id AS application_id,
                    a.current_status,
                    a.applied_at,
                    a.cover_letter,
                    j.id AS job_id,
                    j.title AS job_title,
                    j.job_type,
                    j.work_mode,
                    j.location AS job_location,
                    j.salary_min,
                    j.salary_max,
                    c.name AS company_name,
                    c.location AS company_location,
                    r.file_name AS resume_file_name,
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
                LEFT JOIN resumes r ON r.id = a.resume_id
                WHERE a.candidate_id = %s
                ORDER BY a.applied_at DESC;
                """,
                (cand_id,)
            )
            apps = clean_record(cur.fetchall())

        return jsonify({"applications": apps}), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# -----------------------------------------------------------------------------
# 7. Transparent Skill-Overlap & Preference Recommendations
# -----------------------------------------------------------------------------
@candidate_bp.route("/recommendations", methods=["GET"])
@role_required("user")
def get_recommendations():
    """
    Computes transparent relational SQL skill overlap scores and preference alignments.
    Returns matching percentages, matched skills, and work mode/location matches.
    """
    account_id = session["account_id"]
    try:
        with get_db() as (conn, cur):
            cur.execute(
                """
                WITH candidate_info AS (
                    SELECT 
                        cp.id AS cand_id,
                        jp.preferred_location,
                        jp.preferred_work_mode,
                        jp.min_expected_salary
                    FROM candidate_profiles cp
                    LEFT JOIN job_preferences jp ON jp.candidate_id = cp.id
                    WHERE cp.account_id = %s
                ),
                job_skill_stats AS (
                    SELECT 
                        j.id AS job_id,
                        COUNT(js.skill_id) AS total_required_skills,
                        COUNT(cs.skill_id) AS matching_skills_count,
                        COALESCE(
                            JSON_AGG(
                                JSON_BUILD_OBJECT(
                                    'id', s.id, 
                                    'name', s.name, 
                                    'matched', (cs.skill_id IS NOT NULL),
                                    'proficiency', cs.proficiency
                                )
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
                    j.description,
                    j.salary_min,
                    j.salary_max,
                    j.deadline,
                    c.id AS company_id,
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
                    (ci.preferred_location IS NOT NULL AND LOWER(j.location) LIKE LOWER('%%' || ci.preferred_location || '%%')) AS location_match,
                    jss.skills_breakdown
                FROM jobs j
                JOIN companies c ON c.id = j.company_id
                JOIN job_skill_stats jss ON jss.job_id = j.id
                CROSS JOIN candidate_info ci
                WHERE j.status = 'published' AND j.deadline >= CURRENT_DATE
                ORDER BY match_percentage DESC, j.created_at DESC;
                """,
                (account_id,)
            )
            recommendations = clean_record(cur.fetchall())

        return jsonify({
            "disclaimer": "Skill recommendations are algorithmic guidance based on your profile skills and preferences.",
            "recommendations": recommendations
        }), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500
