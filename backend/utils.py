from functools import wraps
from flask import session, jsonify, request
from werkzeug.security import generate_password_hash, check_password_hash
from decimal import Decimal
import datetime
from backend.config import Config

def hash_password(password: str) -> str:
    """Hashes passwords securely using PBKDF2:SHA256."""
    return generate_password_hash(password, method="pbkdf2:sha256")

def check_password(password_hash: str, password: str) -> bool:
    """Verifies a plain password against the stored PBKDF2 hash."""
    return check_password_hash(password_hash, password)

def allowed_file(filename: str) -> bool:
    """Checks if uploaded resume matches permitted file extensions."""
    if "." not in filename:
        return False
    ext = filename.rsplit(".", 1)[1].lower()
    return ext in Config.ALLOWED_EXTENSIONS

def clean_record(row):
    """
    Recursively converts psycopg2 RealDictRow, Decimal, date, and datetime
    objects to JSON-serializable Python primitives.
    """
    if row is None:
        return None
    if isinstance(row, list):
        return [clean_record(item) for item in row]
    if isinstance(row, dict):
        out = {}
        for k, v in row.items():
            if isinstance(v, Decimal):
                out[k] = float(v)
            elif isinstance(v, (datetime.date, datetime.datetime)):
                out[k] = v.isoformat()
            elif isinstance(v, (dict, list)):
                out[k] = clean_record(v)
            else:
                out[k] = v
        return out
    if isinstance(row, Decimal):
        return float(row)
    if isinstance(row, (datetime.date, datetime.datetime)):
        return row.isoformat()
    return row

def login_required(f):
    """Decorator requiring an active authenticated user session."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if "account_id" not in session:
            return jsonify({"error": "Authentication required. Please log in."}), 401
        return f(*args, **kwargs)
    return decorated_function

def role_required(*allowed_roles):
    """
    Decorator enforcing role-based access control (RBAC).
    Accepts roles like 'user', 'recruiter', 'developer'.
    """
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            if "account_id" not in session:
                return jsonify({"error": "Authentication required. Please log in."}), 401
            
            user_role = session.get("role")
            if user_role not in allowed_roles:
                return jsonify({
                    "error": f"Access denied. Requires one of roles: {', '.join(allowed_roles)}. Your role is '{user_role}'."
                }), 403
            return f(*args, **kwargs)
        return decorated_function
    return decorator
