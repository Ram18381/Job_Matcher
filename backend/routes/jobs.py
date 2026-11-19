from flask import Blueprint, request, jsonify, session
from backend.db import get_db
from backend.utils import role_required, clean_record

jobs_bp = Blueprint("jobs", __name__, url_prefix="/api/jobs")

@jobs_bp.route("", methods=["GET"])
def list_jobs():
    """
    Public and Candidate job browsing endpoint.
    Filters: search query, job type, work mode, and location.
    Only returns published jobs whose deadline is >= CURRENT_DATE.
    """
    search = request.args.get("search", "").strip()
    job_type = request.args.get("job_type", "").strip()
    work_mode = request.args.get("work_mode", "").strip()
    location = request.args.get("location", "").strip()

    try:
        with get_db() as (conn, cur):
            query = """
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
                    c.location AS company_location,
                    COALESCE(
                        JSON_AGG(
                            JSON_BUILD_OBJECT(
                                'id', s.id, 
                                'name', s.name, 
                                'is_required', js.is_required, 
                                'min_proficiency', js.min_proficiency
                            )
                        ) FILTER (WHERE s.id IS NOT NULL), '[]'::json
                    ) AS required_skills
                FROM jobs j
                JOIN companies c ON c.id = j.company_id
                LEFT JOIN job_skills js ON js.job_id = j.id
                LEFT JOIN skills s ON s.id = js.skill_id
                WHERE j.status = 'published' AND j.deadline >= CURRENT_DATE
            """
            params = []

            if search:
                query += " AND (LOWER(j.title) LIKE LOWER(%s) OR LOWER(c.name) LIKE LOWER(%s) OR LOWER(j.description) LIKE LOWER(%s))"
                p = f"%{search}%"
                params.extend([p, p, p])

            if job_type and job_type != "All":
                query += " AND j.job_type = %s"
                params.append(job_type)

            if work_mode and work_mode != "All":
                query += " AND j.work_mode = %s"
                params.append(work_mode)

            if location:
                query += " AND LOWER(j.location) LIKE LOWER(%s)"
                params.append(f"%{location}%")

            query += " GROUP BY j.id, c.id ORDER BY j.created_at DESC;"

            cur.execute(query, tuple(params))
            jobs = clean_record(cur.fetchall())

        return jsonify({"jobs": jobs, "total": len(jobs)}), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@jobs_bp.route("/<int:job_id>", methods=["GET"])
def get_job(job_id):
    """Fetches single job details with required skills and company overview."""
    try:
        with get_db() as (conn, cur):
            cur.execute(
                """
                SELECT 
                    j.*,
                    c.name AS company_name,
                    c.description AS company_description,
                    c.industry,
                    c.website,
                    c.location AS company_location,
                    COALESCE(
                        JSON_AGG(
                            JSON_BUILD_OBJECT(
                                'id', s.id, 
                                'name', s.name, 
                                'is_required', js.is_required, 
                                'min_proficiency', js.min_proficiency
                            )
                        ) FILTER (WHERE s.id IS NOT NULL), '[]'::json
                    ) AS required_skills
                FROM jobs j
                JOIN companies c ON c.id = j.company_id
                LEFT JOIN job_skills js ON js.job_id = j.id
                LEFT JOIN skills s ON s.id = js.skill_id
                WHERE j.id = %s
                GROUP BY j.id, c.id;
                """,
                (job_id,)
            )
            job = clean_record(cur.fetchone())
            if not job:
                return jsonify({"error": "Job opening not found."}), 404

        return jsonify({"job": job}), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@jobs_bp.route("/<int:job_id>/apply", methods=["POST"])
@role_required("user")
def apply_for_job(job_id):
    """
    Submits a candidate application for an active job.
    Enforces uniqueness, unexpired status, and audit history creation in a transaction.
    """
    account_id = session["account_id"]
    data = request.get_json() or {}
    resume_id = data.get("resume_id")
    cover_letter = (data.get("cover_letter") or "").strip()

    try:
        with get_db() as (conn, cur):
            # 1. Fetch candidate_id
            cur.execute("SELECT id FROM candidate_profiles WHERE account_id = %s;", (account_id,))
            cand = cur.fetchone()
            if not cand:
                return jsonify({"error": "Candidate profile not found."}), 404
            cand_id = cand["id"]

            # 2. Check job status and expiration
            cur.execute(
                "SELECT id, title, status, deadline FROM jobs WHERE id = %s;",
                (job_id,)
            )
            job = cur.fetchone()
            if not job:
                return jsonify({"error": "Job opening does not exist."}), 404

            if job["status"] != "published":
                return jsonify({"error": "This job is not accepting applications at this time."}), 400

            cur.execute("SELECT (CURRENT_DATE > %s) AS expired;", (job["deadline"],))
            if cur.fetchone()["expired"]:
                return jsonify({"error": "The deadline for this job posting has expired."}), 400

            # 3. Check duplicate application
            cur.execute(
                "SELECT id, current_status FROM applications WHERE job_id = %s AND candidate_id = %s;",
                (job_id, cand_id)
            )
            if cur.fetchone():
                return jsonify({"error": "You have already submitted an application for this position."}), 409

            # 4. Resolve resume
            if not resume_id:
                cur.execute("SELECT id FROM resumes WHERE candidate_id = %s AND is_default = TRUE LIMIT 1;", (cand_id,))
                default_res = cur.fetchone()
                if default_res:
                    resume_id = default_res["id"]
                else:
                    cur.execute("SELECT id FROM resumes WHERE candidate_id = %s ORDER BY uploaded_at DESC LIMIT 1;", (cand_id,))
                    latest_res = cur.fetchone()
                    if latest_res:
                        resume_id = latest_res["id"]

            # 5. Insert application
            cur.execute(
                """
                INSERT INTO applications (job_id, candidate_id, resume_id, cover_letter, current_status)
                VALUES (%s, %s, %s, %s, 'submitted')
                RETURNING id, applied_at;
                """,
                (job_id, cand_id, resume_id, cover_letter or None)
            )
            app_result = cur.fetchone()
            app_id = app_result["id"]

            # 6. Insert audit trail in application_status_history
            cur.execute(
                """
                INSERT INTO application_status_history (application_id, status, notes, changed_by)
                VALUES (%s, 'submitted', 'Candidate submitted initial application.', %s);
                """,
                (app_id, account_id)
            )

        return jsonify({
            "message": f"Successfully applied for '{job['title']}'!",
            "application_id": app_id
        }), 201

    except Exception as e:
        return jsonify({"error": str(e)}), 500
