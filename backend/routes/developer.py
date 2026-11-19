from flask import Blueprint, request, jsonify, session
from backend.db import get_db
from backend.utils import role_required, clean_record

developer_bp = Blueprint("developer", __name__, url_prefix="/api/developer")

@developer_bp.route("/stats", methods=["GET"])
@role_required("developer")
def get_stats():
    """Returns platform overview counters and distribution metrics for developers."""
    try:
        with get_db() as (conn, cur):
            cur.execute("SELECT COUNT(*) AS c FROM accounts WHERE role = 'user';")
            total_users = cur.fetchone()["c"]

            cur.execute("SELECT COUNT(*) AS c FROM accounts WHERE role = 'recruiter';")
            total_recruiters = cur.fetchone()["c"]

            cur.execute("SELECT COUNT(*) AS c FROM companies;")
            total_companies = cur.fetchone()["c"]

            cur.execute("SELECT COUNT(*) AS c FROM companies WHERE status = 'pending';")
            pending_companies = cur.fetchone()["c"]

            cur.execute("SELECT COUNT(*) AS c FROM companies WHERE status = 'approved';")
            approved_companies = cur.fetchone()["c"]

            cur.execute("SELECT COUNT(*) AS c FROM jobs;")
            total_jobs = cur.fetchone()["c"]

            cur.execute("SELECT COUNT(*) AS c FROM jobs WHERE status = 'published' AND deadline >= CURRENT_DATE;")
            active_jobs = cur.fetchone()["c"]

            cur.execute("SELECT COUNT(*) AS c FROM applications;")
            total_applications = cur.fetchone()["c"]

            cur.execute(
                """
                SELECT current_status, COUNT(*) AS count
                FROM applications
                GROUP BY current_status;
                """
            )
            apps_by_status = clean_record(cur.fetchall())

        return jsonify({
            "metrics": {
                "total_users": total_users,
                "total_recruiters": total_recruiters,
                "total_companies": total_companies,
                "pending_companies": pending_companies,
                "approved_companies": approved_companies,
                "total_jobs": total_jobs,
                "active_jobs": active_jobs,
                "total_applications": total_applications
            },
            "applications_breakdown": apps_by_status
        }), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@developer_bp.route("/companies/pending", methods=["GET"])
@role_required("developer")
def get_pending_companies():
    """Lists all companies pending developer review with recruiter profile info."""
    try:
        with get_db() as (conn, cur):
            cur.execute(
                """
                SELECT 
                    c.id AS company_id,
                    c.name AS company_name,
                    c.industry,
                    c.website,
                    c.location,
                    c.description,
                    c.status,
                    c.created_at,
                    rp.id AS recruiter_id,
                    rp.full_name AS recruiter_name,
                    rp.email AS recruiter_email,
                    rp.phone AS recruiter_phone,
                    rp.designation AS recruiter_designation,
                    acc.id AS account_id,
                    acc.username AS recruiter_username
                FROM companies c
                LEFT JOIN recruiter_profiles rp ON rp.company_id = c.id
                LEFT JOIN accounts acc ON acc.id = rp.account_id
                WHERE c.status = 'pending'
                ORDER BY c.created_at ASC;
                """
            )
            pending = clean_record(cur.fetchall())
        return jsonify({"pending_companies": pending}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@developer_bp.route("/companies", methods=["GET"])
@role_required("developer")
def get_all_companies():
    """Lists all registered companies with their review details."""
    try:
        with get_db() as (conn, cur):
            cur.execute(
                """
                SELECT 
                    c.*,
                    COUNT(j.id) AS jobs_count,
                    reviewer.username AS reviewer_username
                FROM companies c
                LEFT JOIN jobs j ON j.company_id = c.id
                LEFT JOIN accounts reviewer ON reviewer.id = c.reviewed_by
                GROUP BY c.id, reviewer.username
                ORDER BY c.created_at DESC;
                """
            )
            companies = clean_record(cur.fetchall())
        return jsonify({"companies": companies}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@developer_bp.route("/companies/<int:company_id>/review", methods=["POST"])
@role_required("developer")
def review_company(company_id):
    """
    Approves or rejects a company registration.
    Records reviewer account ID and review timestamp.
    """
    developer_account_id = session["account_id"]
    data = request.get_json() or {}
    new_status = data.get("status")

    if new_status not in ("approved", "rejected"):
        return jsonify({"error": "Status must be 'approved' or 'rejected'."}), 400

    try:
        with get_db() as (conn, cur):
            cur.execute(
                """
                UPDATE companies
                SET status = %s,
                    reviewed_by = %s,
                    reviewed_at = CURRENT_TIMESTAMP
                WHERE id = %s
                RETURNING id, name, status, reviewed_at;
                """,
                (new_status, developer_account_id, company_id)
            )
            updated = clean_record(cur.fetchone())
            if not updated:
                return jsonify({"error": "Company not found."}), 404

        action_word = "approved" if new_status == "approved" else "rejected"
        return jsonify({
            "message": f"Company '{updated['name']}' has been {action_word}!",
            "company": updated
        }), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@developer_bp.route("/users", methods=["GET"])
@role_required("developer")
def get_users_list():
    """Lists all candidate and recruiter accounts for platform administration."""
    search = request.args.get("search", "").strip()
    role_filter = request.args.get("role", "").strip()

    try:
        with get_db() as (conn, cur):
            query = """
                SELECT 
                    acc.id AS account_id,
                    acc.username,
                    acc.role,
                    acc.created_at,
                    COALESCE(cp.full_name, rp.full_name) AS full_name,
                    COALESCE(cp.email, rp.email) AS email,
                    c.name AS company_name,
                    c.status AS company_status
                FROM accounts acc
                LEFT JOIN candidate_profiles cp ON cp.account_id = acc.id
                LEFT JOIN recruiter_profiles rp ON rp.account_id = acc.id
                LEFT JOIN companies c ON c.id = rp.company_id
                WHERE 1=1
            """
            params = []
            if search:
                query += " AND (LOWER(acc.username) LIKE LOWER(%s) OR LOWER(COALESCE(cp.full_name, rp.full_name, '')) LIKE LOWER(%s))"
                params.extend([f"%{search}%", f"%{search}%"])

            if role_filter:
                query += " AND acc.role = %s"
                params.append(role_filter)

            query += " ORDER BY acc.created_at DESC;"
            cur.execute(query, tuple(params))
            users = clean_record(cur.fetchall())

        return jsonify({"users": users}), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@developer_bp.route("/jobs", methods=["GET"])
@role_required("developer")
def get_all_jobs():
    """Lists all jobs across all companies with applicant counts."""
    try:
        with get_db() as (conn, cur):
            cur.execute(
                """
                SELECT 
                    j.*,
                    c.name AS company_name,
                    c.status AS company_status,
                    COUNT(a.id) AS applicant_count
                FROM jobs j
                JOIN companies c ON c.id = j.company_id
                LEFT JOIN applications a ON a.job_id = j.id
                GROUP BY j.id, c.name, c.status
                ORDER BY j.created_at DESC;
                """
            )
            jobs = clean_record(cur.fetchall())
        return jsonify({"jobs": jobs}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@developer_bp.route("/applications", methods=["GET"])
@role_required("developer")
def get_all_applications():
    """Audit view of all applications submitted across the platform."""
    try:
        with get_db() as (conn, cur):
            cur.execute(
                """
                SELECT 
                    a.id AS application_id,
                    a.current_status,
                    a.applied_at,
                    cp.full_name AS candidate_name,
                    cp.email AS candidate_email,
                    j.title AS job_title,
                    c.name AS company_name
                FROM applications a
                JOIN candidate_profiles cp ON cp.id = a.candidate_id
                JOIN jobs j ON j.id = a.job_id
                JOIN companies c ON c.id = j.company_id
                ORDER BY a.applied_at DESC;
                """
            )
            apps = clean_record(cur.fetchall())
        return jsonify({"applications": apps}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
