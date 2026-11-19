import os
from backend import create_app
from backend.db import init_db_pool

app = create_app()

if __name__ == "__main__":
    init_db_pool()
    port = int(os.getenv("PORT", 5000))
    debug = os.getenv("FLASK_DEBUG", "True").lower() in ("true", "1", "t")
    print(f">> [Job Matcher] Server starting at http://localhost:{port}")
    print(">> Available Portals: User (Candidate), Recruiter, and Website Developer")
    app.run(host="0.0.0.0", port=port, debug=debug)
