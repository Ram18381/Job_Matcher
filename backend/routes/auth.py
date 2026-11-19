from flask import Blueprint, request, jsonify, session
from backend.db import get_db
from backend.utils import hash_password, check_password, clean_record

auth_bp = Blueprint("auth", __name__, url_prefix="/api/auth")

@auth_bp.route("/register/user", methods=["POST"])
def register_user():
    """
    Registers a new Candidate/Student User account.
    Inserts into accounts and candidate_profiles within a database transaction.
    """
    data = request.get_json() or {}
    username = (data.get("username") or "").strip().lower()
    password = (data.get("password") or "").strip()
    name = (data.get("name") or "").strip()
    email = (data.get("email") or "").strip()
    phone = (data.get("phone") or "").strip()
    headline = (data.get("headline") or "Student / Aspiring Engineer").strip()

    if not username or not password or not name:
        return jsonify({"error": "Name, username, and password are required fields."}), 400

    if len(username) < 3:
        return jsonify({"error": "Username must be at least 3 characters."}), 400

    if len(password) < 6:
        return jsonify({"error": "Password must be at least 6 characters."}), 400

    pw_hash = hash_password(password)

    try:
        with get_db() as (conn, cur):
            # Check if username exists
            cur.execute("SELECT id FROM accounts WHERE LOWER(username) = %s;", (username,))
            if cur.fetchone():
                return jsonify({"error": f"Username '{username}' is already taken. Please choose another."}), 409

            # Insert account
            cur.execute(
                """
                INSERT INTO accounts (username, password_hash, role)
                VALUES (%s, %s, 'user')
                RETURNING id;
                """,
                (username, pw_hash)
            )
            account_id = cur.fetchone()["id"]

            # Insert candidate profile
            cur.execute(
                """
                INSERT INTO candidate_profiles (account_id, full_name, email, phone, headline)
                VALUES (%s, %s, %s, %s, %s)
                RETURNING id;
                """,
                (account_id, name, email or None, phone or None, headline)
            )
            cand_id = cur.fetchone()["id"]

            # Insert default job preferences row
            cur.execute(
                """
                INSERT INTO job_preferences (candidate_id, preferred_role, preferred_work_mode)
                VALUES (%s, %s, 'Any');
                """,
                (cand_id, headline)
            )

        # Set session immediately for convenient login
        session["account_id"] = account_id
        session["username"] = username
        session["role"] = "user"
        session["profile_id"] = cand_id
        session["name"] = name

        return jsonify({
            "message": "Candidate account created successfully!",
            "user": {
                "account_id": account_id,
                "profile_id": cand_id,
                "username": username,
                "name": name,
                "role": "user"
            }
        }), 201

    except Exception as e:
        return jsonify({"error": f"Registration failed: {str(e)}"}), 500


@auth_bp.route("/register/recruiter", methods=["POST"])
def register_recruiter():
    """
    Registers a new Recruiter and Company profile.
    Initializes the Company status as 'pending'.
    Recruiter cannot log in or manage jobs until a Website Developer approves the company.
    """
    data = request.get_json() or {}
    company_name = (data.get("company_name") or "").strip()
    recruiter_name = (data.get("recruiter_name") or "").strip()
    username = (data.get("username") or "").strip().lower()
    password = (data.get("password") or "").strip()
    
    # Optional / details
    industry = (data.get("industry") or "Technology").strip()
    website = (data.get("website") or "").strip()
    description = (data.get("company_description") or "").strip()
    location = (data.get("location") or "").strip()
    email = (data.get("email") or "").strip()
    phone = (data.get("phone") or "").strip()
    designation = (data.get("designation") or "Technical Recruiter").strip()

    if not company_name or not recruiter_name or not username or not password:
        return jsonify({
            "error": "Company name, recruiter name, username, and password are required."
        }), 400

    if len(username) < 3:
        return jsonify({"error": "Username must be at least 3 characters."}), 400

    if len(password) < 6:
        return jsonify({"error": "Password must be at least 6 characters."}), 400

    pw_hash = hash_password(password)

    try:
        with get_db() as (conn, cur):
            # Check unique username
            cur.execute("SELECT id FROM accounts WHERE LOWER(username) = %s;", (username,))
            if cur.fetchone():
                return jsonify({"error": f"Username '{username}' is already taken."}), 409

            # Check if company already registered or create new
            cur.execute("SELECT id, status FROM companies WHERE LOWER(name) = LOWER(%s);", (company_name,))
            existing_company = cur.fetchone()

            if existing_company:
                company_id = existing_company["id"]
            else:
                cur.execute(
                    """
                    INSERT INTO companies (name, description, website, industry, location, status)
                    VALUES (%s, %s, %s, %s, %s, 'pending')
                    RETURNING id;
                    """,
                    (company_name, description, website, industry, location)
                )
                company_id = cur.fetchone()["id"]

            # Insert account with 'recruiter' role
            cur.execute(
                """
                INSERT INTO accounts (username, password_hash, role)
                VALUES (%s, %s, 'recruiter')
                RETURNING id;
                """,
                (username, pw_hash)
            )
            account_id = cur.fetchone()["id"]

            # Insert recruiter profile
            cur.execute(
                """
                INSERT INTO recruiter_profiles (account_id, company_id, full_name, email, phone, designation)
                VALUES (%s, %s, %s, %s, %s, %s);
                """,
                (account_id, company_id, recruiter_name, email or None, phone or None, designation)
            )

        return jsonify({
            "message": (
                f"Recruiter account registered for '{company_name}'. "
                "Your company is currently 'pending' approval from a Website Developer. "
                "You will be able to log in once approved."
            ),
            "company_status": "pending",
            "username": username
        }), 201

    except Exception as e:
        return jsonify({"error": f"Recruiter registration failed: {str(e)}"}), 500


@auth_bp.route("/login", methods=["POST"])
def login():
    """
    Authenticates Candidate, Recruiter, or Developer accounts.
    Strictly prevents pending or rejected recruiters from logging in.
    """
    data = request.get_json() or {}
    username = (data.get("username") or "").strip().lower()
    password = (data.get("password") or "").strip()
    expected_role = data.get("expected_role")  # optional constraint from UI tab

    if not username or not password:
        return jsonify({"error": "Please provide both username and password."}), 400

    try:
        with get_db() as (conn, cur):
            cur.execute(
                """
                SELECT id, username, password_hash, role
                FROM accounts
                WHERE LOWER(username) = %s;
                """,
                (username,)
            )
            account = cur.fetchone()

            if not account or not check_password(account["password_hash"], password):
                return jsonify({"error": "Invalid username or password. Please try again."}), 401

            role = account["role"]

            # Optional check if user attempted to sign in via wrong portal tab
            if expected_role and expected_role != role:
                # Provide a friendly message guiding the user
                role_names = {"user": "User/Candidate", "recruiter": "Recruiter", "developer": "Website Developer"}
                return jsonify({
                    "error": f"Account '{username}' is registered as a {role_names.get(role, role)}, not {role_names.get(expected_role, expected_role)}."
                }), 403

            # If recruiter, check company approval status
            profile_info = {}
            if role == "recruiter":
                cur.execute(
                    """
                    SELECT rp.id AS recruiter_id, rp.full_name, rp.designation,
                           c.id AS company_id, c.name AS company_name, c.status AS company_status
                    FROM recruiter_profiles rp
                    JOIN companies c ON c.id = rp.company_id
                    WHERE rp.account_id = %s;
                    """,
                    (account["id"],)
                )
                rec = cur.fetchone()
                if not rec:
                    return jsonify({"error": "Recruiter profile could not be found."}), 404

                if rec["company_status"] == "pending":
                    return jsonify({
                        "error": (
                            f"Access Denied: Company '{rec['company_name']}' is still pending approval "
                            "by a Website Developer. Please wait for developer approval before logging in."
                        ),
                        "status": "pending_approval"
                    }), 403

                if rec["company_status"] == "rejected":
                    return jsonify({
                        "error": (
                            f"Access Denied: Company '{rec['company_name']}' was rejected by the administration."
                        ),
                        "status": "rejected"
                    }), 403

                profile_info = {
                    "recruiter_id": rec["recruiter_id"],
                    "company_id": rec["company_id"],
                    "company_name": rec["company_name"],
                    "name": rec["full_name"],
                    "designation": rec["designation"]
                }

            elif role == "user":
                cur.execute(
                    """
                    SELECT id AS candidate_id, full_name, email, headline, location
                    FROM candidate_profiles
                    WHERE account_id = %s;
                    """,
                    (account["id"],)
                )
                cand = cur.fetchone()
                if cand:
                    profile_info = {
                        "candidate_id": cand["candidate_id"],
                        "name": cand["full_name"],
                        "email": cand["email"],
                        "headline": cand["headline"],
                        "location": cand["location"]
                    }
                else:
                    profile_info = {"name": account["username"]}

            elif role == "developer":
                profile_info = {
                    "name": "Website Developer",
                    "badge": "System Administrator"
                }

            # Set session
            session.clear()
            session["account_id"] = account["id"]
            session["username"] = account["username"]
            session["role"] = role
            session["name"] = profile_info.get("name", account["username"])
            if "candidate_id" in profile_info:
                session["candidate_id"] = profile_info["candidate_id"]
            if "company_id" in profile_info:
                session["company_id"] = profile_info["company_id"]
                session["recruiter_id"] = profile_info["recruiter_id"]

            return jsonify({
                "message": f"Welcome back, {session['name']}!",
                "user": {
                    "account_id": account["id"],
                    "username": account["username"],
                    "role": role,
                    **profile_info
                }
            }), 200

    except Exception as e:
        return jsonify({"error": f"Login failed: {str(e)}"}), 500


@auth_bp.route("/logout", methods=["POST"])
def logout():
    """Clears the active session."""
    session.clear()
    return jsonify({"message": "Successfully logged out."}), 200


@auth_bp.route("/me", methods=["GET"])
def me():
    """Returns active session state and user identity."""
    if "account_id" not in session:
        return jsonify({"authenticated": False}), 200

    account_id = session["account_id"]
    role = session.get("role")

    try:
        with get_db() as (conn, cur):
            cur.execute("SELECT id, username, role FROM accounts WHERE id = %s;", (account_id,))
            acc = cur.fetchone()
            if not acc:
                session.clear()
                return jsonify({"authenticated": False}), 200

            user_data = {
                "account_id": acc["id"],
                "username": acc["username"],
                "role": acc["role"]
            }

            if role == "user":
                cur.execute(
                    "SELECT id AS candidate_id, full_name, email, headline, location FROM candidate_profiles WHERE account_id = %s;",
                    (account_id,)
                )
                cp = cur.fetchone()
                if cp:
                    user_data.update(clean_record(cp))

            elif role == "recruiter":
                cur.execute(
                    """
                    SELECT rp.id AS recruiter_id, rp.full_name, c.id AS company_id, c.name AS company_name, c.status
                    FROM recruiter_profiles rp
                    JOIN companies c ON c.id = rp.company_id
                    WHERE rp.account_id = %s;
                    """,
                    (account_id,)
                )
                rp = cur.fetchone()
                if rp:
                    user_data.update(clean_record(rp))

            elif role == "developer":
                user_data["name"] = "Website Developer"

            return jsonify({"authenticated": True, "user": user_data}), 200

    except Exception as e:
        return jsonify({"authenticated": False, "error": str(e)}), 500
