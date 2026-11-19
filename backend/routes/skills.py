from flask import Blueprint, jsonify
from backend.db import get_db
from backend.utils import clean_record

skills_bp = Blueprint("skills", __name__, url_prefix="/api/skills")

@skills_bp.route("", methods=["GET"])
def get_all_skills():
    """Returns all master skills grouped by category for selection in forms."""
    try:
        with get_db() as (conn, cur):
            cur.execute("SELECT id, name, category FROM skills ORDER BY category ASC, name ASC;")
            skills = clean_record(cur.fetchall())
        return jsonify({"skills": skills}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500
