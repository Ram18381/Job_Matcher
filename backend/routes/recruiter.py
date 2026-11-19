from flask import Blueprint, request, jsonify, session
from backend.db import get_db
from backend.utils import role_required, clean_record

recruiter_bp = Blueprint("recruiter", __name__, url_prefix="/api/recruiter")

def _get_recruiter_and_company(cur, account_id):
    """Helper to verify recruiter profile and company approved status."""
    cur.execute(
        """
        SELECT rp.id AS recruiter_id, rp.company_id, rp.full_name,
               c.name AS company_name, c.status AS company_status
        FROM recruiter_profiles rp
        JOIN companies c ON c.id = rp.company_id
        WHERE rp.account_id = %s;
        """,
        (account_id,)
    )
    row = cur.fetchone()
    if not row:
        raise ValueError("Recruiter profile not found.")
    if row["company_status"] != "approved":
        raise PermissionError("Your company is not approved. Access is restricted to approved recruiters.")
    return row


@recruiter_bp.route("/company", methods=["GET"])
@role_required("recruiter")
def get_company_details():
    """Returns company info for the logged-in recruiter."""
    account_id = session["account_id"]
    try:
        with get_db() as (conn, cur):
            rec = _get_recruiter_and_company(cur, account_id)
            cur.execute("SELECT * FROM companies WHERE id = %s;", (rec["company_id"],))
            company = clean_record(cur.fetchone())
        return jsonify({"company": company, "recruiter": clean_record(rec)}), 200
    except (ValueError, PermissionError) as pe:
        return jsonify({"error": str(pe)}), 403
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@recruiter_bp.route("/jobs", methods=["GET"])
@role_required("recruiter")
def get_company_jobs():
    """Lists all jobs posted by the recruiter's company, including applicant counts."""
    account_id = session["account_id"]
    try:
        with get_db() as (conn, cur):
            rec = _get_recruiter_and_company(cur, account_id)
            cur.execute(
                """
                SELECT 
                    j.*,
                    COUNT(a.id) AS applicant_count,
                    COALESCE(
                        JSON_AGG(
                            JSON_BUILD_OBJECT('id', s.id, 'name', s.name, 'min_proficiency', js.min_proficiency)
                        ) FILTER (WHERE s.id IS NOT NULL), '[]'::json
                    ) AS skills
                FROM jobs j
                LEFT JOIN applications a ON a.job_id = j.id
                LEFT JOIN job_skills js ON js.job_id = j.id
                LEFT JOIN skills s ON s.id = js.skill_id
                WHERE j.company_id = %s
                GROUP BY j.id
                ORDER BY j.created_at DESC;
                """,
                (rec["company_id"],)
            )
            jobs = clean_record(cur.fetchall())
        return jsonify({"jobs": jobs}), 200
    except (ValueError, PermissionError) as pe:
        return jsonify({"error": str(pe)}), 403
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@recruiter_bp.route("/jobs", methods=["POST"])
@role_required("recruiter")
def create_job():
    """
    Creates a new job opening and attaches required skills within a database transaction.
    """
    account_id = session["account_id"]
    data = request.get_json() or {}

    title = (data.get("title") or "").strip()
    job_type = data.get("job_type", "Full-time")
    work_mode = data.get("work_mode", "On-site")
    location = (data.get("location") or "").strip()
    description = (data.get("description") or "").strip()
    requirements = data.get("requirements", "")
    salary_min = float(data.get("salary_min") or 0)
    salary_max = float(data.get("salary_max") or 0)
    deadline = data.get("deadline")
    skill_ids = data.get("skill_ids") or []  # List of skill IDs or objects

    if not title or not location or not description or not deadline:
        return jsonify({"error": "Title, location, description, and deadline are required."}), 400

    if salary_max > 0 and salary_max < salary_min:
        return jsonify({"error": "Maximum salary must be greater than or equal to minimum salary."}), 400

    try:
        with get_db() as (conn, cur):
            rec = _get_recruiter_and_company(cur, account_id)
            company_id = rec["company_id"]
            recruiter_id = rec["recruiter_id"]

            cur.execute(
                """
                INSERT INTO jobs (company_id, recruiter_id, title, job_type, work_mode, location,
                                 description, requirements, salary_min, salary_max, deadline, status)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'published')
                RETURNING id;
                """,
                (company_id, recruiter_id, title, job_type, work_mode, location,
                 description, requirements, salary_min, salary_max, deadline)
            )
            job_id = cur.fetchone()["id"]

            # Insert required skills
            for item in skill_ids:
                if isinstance(item, dict):
                    sid = item.get("skill_id")
                    prof = item.get("min_proficiency", "Intermediate")
                else:
                    sid = int(item)
                    prof = "Intermediate"

                if sid:
                    cur.execute(
                        """
                        INSERT INTO job_skills (job_id, skill_id, is_required, min_proficiency)
                        VALUES (%s, %s, TRUE, %s)
                        ON CONFLICT (job_id, skill_id) DO NOTHING;
                        """,
                        (job_id, sid, prof)
                    )

        return jsonify({"message": "Job published successfully!", "job_id": job_id}), 201

    except (ValueError, PermissionError) as pe:
        return jsonify({"error": str(pe)}), 403
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@recruiter_bp.route("/jobs/<int:job_id>", methods=["PUT"])
@role_required("recruiter")
def update_job(job_id):
    """Updates an existing job belonging to recruiter's company."""
    account_id = session["account_id"]
    data = request.get_json() or {}

    try:
        with get_db() as (conn, cur):
            rec = _get_recruiter_and_company(cur, account_id)

            cur.execute("SELECT id FROM jobs WHERE id = %s AND company_id = %s;", (job_id, rec["company_id"]))
            if not cur.fetchone():
                return jsonify({"error": "Job not found or does not belong to your company."}), 404

            cur.execute(
                """
                UPDATE jobs
                SET title = COALESCE(%s, title),
                    job_type = COALESCE(%s, job_type),
                    work_mode = COALESCE(%s, work_mode),
                    location = COALESCE(%s, location),
                    description = COALESCE(%s, description),
                    requirements = COALESCE(%s, requirements),
                    salary_min = COALESCE(%s, salary_min),
                    salary_max = COALESCE(%s, salary_max),
                    deadline = COALESCE(%s, deadline),
                    status = COALESCE(%s, status),
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = %s AND company_id = %s
                RETURNING *;
                """,
                (
                    data.get("title"),
                    data.get("job_type"),
                    data.get("work_mode"),
                    data.get("location"),
                    data.get("description"),
                    data.get("requirements"),
                    data.get("salary_min"),
                    data.get("salary_max"),
                    data.get("deadline"),
                    data.get("status"),
                    job_id,
                    rec["company_id"]
                )
            )
            updated = clean_record(cur.fetchone())

        return jsonify({"message": "Job updated successfully!", "job": updated}), 200

    except (ValueError, PermissionError) as pe:
        return jsonify({"error": str(pe)}), 403
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@recruiter_bp.route("/jobs/<int:job_id>/status", methods=["PATCH"])
@role_required("recruiter")
def toggle_job_status(job_id):
    """Toggles job status between 'published' and 'closed'."""
    account_id = session["account_id"]
    data = request.get_json() or {}
    new_status = data.get("status")

    if new_status not in ("published", "closed", "draft"):
        return jsonify({"error": "Status must be 'published', 'closed', or 'draft'."}), 400

    try:
        with get_db() as (conn, cur):
            rec = _get_recruiter_and_company(cur, account_id)
            cur.execute(
                "UPDATE jobs SET status = %s, updated_at = CURRENT_TIMESTAMP WHERE id = %s AND company_id = %s RETURNING id, status;",
                (new_status, job_id, rec["company_id"])
            )
            row = cur.fetchone()
            if not row:
                return jsonify({"error": "Job not found or unauthorized."}), 404

        return jsonify({"message": f"Job status changed to {new_status}."}), 200

    except (ValueError, PermissionError) as pe:
        return jsonify({"error": str(pe)}), 403
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@recruiter_bp.route("/applicants", methods=["GET"])
@role_required("recruiter")
def get_applicants():
    """
    Returns all applicants for jobs posted by recruiter's company only.
    Includes candidate details, skills, attached resume link, and application status history.
    """
    account_id = session["account_id"]
    job_id_filter = request.args.get("job_id")

    try:
        with get_db() as (conn, cur):
            rec = _get_recruiter_and_company(cur, account_id)
            company_id = rec["company_id"]

            query = """
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
                    cp.location AS candidate_location,
                    r.id AS resume_id,
                    r.file_name AS resume_file_name,
                    r.file_path AS resume_file_path,
                    COALESCE(
                        JSON_AGG(
                            JSON_BUILD_OBJECT('skill', s.name, 'proficiency', cs.proficiency)
                        ) FILTER (WHERE s.id IS NOT NULL), '[]'::json
                    ) AS candidate_skills,
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
                JOIN candidate_profiles cp ON cp.id = a.candidate_id
                LEFT JOIN resumes r ON r.id = a.resume_id
                LEFT JOIN candidate_skills cs ON cs.candidate_id = cp.id
                LEFT JOIN skills s ON s.id = cs.skill_id
                WHERE j.company_id = %s
            """
            params = [company_id]

            if job_id_filter:
                query += " AND j.id = %s"
                params.append(int(job_id_filter))

            query += " GROUP BY a.id, j.id, cp.id, r.id ORDER BY a.applied_at DESC;"

            cur.execute(query, tuple(params))
            applicants = clean_record(cur.fetchall())

        return jsonify({"applicants": applicants}), 200

    except (ValueError, PermissionError) as pe:
        return jsonify({"error": str(pe)}), 403
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@recruiter_bp.route("/applications/<int:app_id>/status", methods=["PUT"])
@role_required("recruiter")
def update_application_status(app_id):
    """
    Updates application status (under_review, shortlisted, rejected, selected)
    and records an audit entry in application_status_history.
    """
    account_id = session["account_id"]
    data = request.get_json() or {}
    new_status = data.get("status")
    notes = (data.get("notes") or "").strip()

    valid_statuses = ("under_review", "shortlisted", "rejected", "selected")
    if new_status not in valid_statuses:
        return jsonify({"error": f"Invalid status. Must be one of: {', '.join(valid_statuses)}"}), 400

    try:
        with get_db() as (conn, cur):
            rec = _get_recruiter_and_company(cur, account_id)

            # Ensure application belongs to recruiter's company
            cur.execute(
                """
                SELECT a.id, a.current_status
                FROM applications a
                JOIN jobs j ON j.id = a.job_id
                WHERE a.id = %s AND j.company_id = %s;
                """,
                (app_id, rec["company_id"])
            )
            app = cur.fetchone()
            if not app:
                return jsonify({"error": "Application not found or unauthorized."}), 404

            # Update application current_status
            cur.execute(
                """
                UPDATE applications
                SET current_status = %s, updated_at = CURRENT_TIMESTAMP
                WHERE id = %s;
                """,
                (new_status, app_id)
            )

            # Insert history audit record
            cur.execute(
                """
                INSERT INTO application_status_history (application_id, status, notes, changed_by)
                VALUES (%s, %s, %s, %s);
                """,
                (app_id, new_status, notes or f"Status changed to {new_status} by recruiter", account_id)
            )

        return jsonify({"message": f"Application status updated to '{new_status}'."}), 200

    except (ValueError, PermissionError) as pe:
        return jsonify({"error": str(pe)}), 403
    except Exception as e:
        return jsonify({"error": str(e)}), 500
