import os
import sys
import urllib.parse as urlparse
import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT
from dotenv import load_dotenv

load_dotenv()

def get_connection_details():
    db_url = os.getenv("DATABASE_URL")
    if db_url and "YOUR_PASSWORD" not in db_url and "postgres:postgres" not in db_url:
        parsed = urlparse.urlparse(db_url)
        return {
            "host": parsed.hostname or "localhost",
            "port": parsed.port or 5432,
            "user": parsed.username or "postgres",
            "password": parsed.password or "",
            "dbname": parsed.path.lstrip("/") or "jobportal_db"
        }

    print("=================================================================")
    print("  Job Matcher — Interactive PostgreSQL Database Initializer      ")
    print("=================================================================")
    host = input("PostgreSQL Host [localhost]: ").strip() or "localhost"
    port = input("PostgreSQL Port [5432]: ").strip() or "5432"
    user = input("PostgreSQL User [postgres]: ").strip() or "postgres"
    password = input("PostgreSQL Password: ").strip()
    dbname = input("Database Name [jobportal_db]: ").strip() or "jobportal_db"

    return {
        "host": host,
        "port": int(port),
        "user": user,
        "password": password,
        "dbname": dbname
    }

def main():
    creds = get_connection_details()
    target_db = creds["dbname"]

    print(f"\n[1/3] Connecting to PostgreSQL server at {creds['host']}:{creds['port']} as '{creds['user']}'...")
    try:
        conn = psycopg2.connect(
            dbname="postgres",
            user=creds["user"],
            password=creds["password"],
            host=creds["host"],
            port=creds["port"]
        )
        conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
        cur = conn.cursor()
    except Exception as e:
        print(f"\n[ERROR] Connection failed: {e}")
        print("Please check your PostgreSQL password and ensure the service is running.")
        sys.exit(1)

    # Check if target database exists
    cur.execute("SELECT 1 FROM pg_database WHERE datname = %s;", (target_db,))
    if not cur.fetchone():
        print(f"Creating database '{target_db}'...")
        cur.execute(f'CREATE DATABASE "{target_db}";')
        print(f"Database '{target_db}' created.")
    else:
        print(f"Database '{target_db}' exists.")

    cur.close()
    conn.close()

    # Connect to target database
    print(f"\n[2/3] Connecting to '{target_db}' to apply schema and seed data...")
    try:
        conn = psycopg2.connect(
            dbname=target_db,
            user=creds["user"],
            password=creds["password"],
            host=creds["host"],
            port=creds["port"]
        )
        cur = conn.cursor()

        # Run schema.sql
        schema_path = os.path.join(os.path.dirname(__file__), "database", "schema.sql")
        with open(schema_path, "r", encoding="utf-8") as f:
            cur.execute(f.read())
        conn.commit()
        print(">> Schema created (15 tables, constraints, indexes).")

        # Run seed.sql
        seed_path = os.path.join(os.path.dirname(__file__), "database", "seed.sql")
        with open(seed_path, "r", encoding="utf-8") as f:
            cur.execute(f.read())
        conn.commit()
        print(">> Seed data populated (master skills, accounts, companies, jobs, applications).")

        # Quick verification counts
        cur.execute("SELECT COUNT(*) FROM accounts;")
        acc_count = cur.fetchone()[0]
        cur.execute("SELECT COUNT(*) FROM skills;")
        skill_count = cur.fetchone()[0]
        cur.execute("SELECT COUNT(*) FROM jobs;")
        job_count = cur.fetchone()[0]

        print(f">> Verification: {acc_count} accounts, {skill_count} skills, {job_count} jobs seeded.")
        cur.close()
        conn.close()

    except Exception as e:
        print(f"\n[ERROR] Failed during schema/seed execution: {e}")
        sys.exit(1)

    # Update .env file
    print(f"\n[3/3] Updating .env configuration...")
    env_content = f"""# PostgreSQL Connection URL
DATABASE_URL=postgresql://{creds['user']}:{creds['password']}@{creds['host']}:{creds['port']}/{target_db}

# Flask Application Settings
FLASK_APP=run.py
FLASK_DEBUG=1
SECRET_KEY=job_matcher_secure_session_key_2026
"""
    env_path = os.path.join(os.path.dirname(__file__), ".env")
    with open(env_path, "w", encoding="utf-8") as f:
        f.write(env_content)
    print(">> .env file updated with active credentials.")

    print("\n=================================================================")
    print("  SUCCESS! Job Matcher database setup is complete.               ")
    print("=================================================================")
    print("Default Demo Credentials:")
    print("  1. Candidate:           username: asha_dev       | password: password123")
    print("  2. Recruiter (Approved): username: priya_google  | password: password123")
    print("  3. Recruiter (Pending):  username: mark_nextgen  | password: password123")
    print("  4. Website Developer:    username: developer     | password: dev@123")
    print("-----------------------------------------------------------------")
    print("To start the app:")
    print("  python run.py")
    print("=================================================================")

if __name__ == "__main__":
    main()
