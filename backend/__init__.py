import os
from flask import Flask, send_from_directory, jsonify, session
from flask_cors import CORS
from backend.config import Config
from backend.db import init_db_pool, close_db_pool

def create_app():
    frontend_dir = os.path.join(Config.BASE_DIR, "frontend")
    app = Flask(__name__, static_folder=frontend_dir, static_url_path="")
    app.secret_key = Config.SECRET_KEY

    # Configure CORS for local development ports
    CORS(
        app,
        supports_credentials=True,
        origins=[
            "http://localhost:5000",
            "http://127.0.0.1:5000",
            "http://localhost:5500",
            "http://127.0.0.1:5500"
        ]
    )

    # Register API Blueprints
    from backend.routes.auth import auth_bp
    from backend.routes.candidate import candidate_bp
    from backend.routes.recruiter import recruiter_bp
    from backend.routes.developer import developer_bp
    from backend.routes.jobs import jobs_bp
    from backend.routes.skills import skills_bp

    app.register_blueprint(auth_bp)
    app.register_blueprint(candidate_bp)
    app.register_blueprint(recruiter_bp)
    app.register_blueprint(developer_bp)
    app.register_blueprint(jobs_bp)
    app.register_blueprint(skills_bp)

    # Health check route
    @app.route("/api/health", methods=["GET"])
    def health_check():
        return jsonify({
            "status": "healthy",
            "project": "Job Matcher — PostgreSQL DBMS Platform",
            "database": "PostgreSQL (psycopg2)",
            "roles_supported": ["user", "recruiter", "developer"]
        }), 200

    # Serve uploaded resumes securely
    @app.route("/uploads/resumes/<path:filename>", methods=["GET"])
    def serve_uploaded_resume(filename):
        return send_from_directory(Config.UPLOAD_FOLDER, filename)

    # Serve Frontend SPA from frontend directory
    @app.route("/", methods=["GET"])
    def index():
        return send_from_directory(app.static_folder, "index.html")

    @app.route("/<path:path>", methods=["GET"])
    def static_proxy(path):
        full_path = os.path.join(app.static_folder, path)
        if os.path.exists(full_path) and os.path.isfile(full_path):
            return send_from_directory(app.static_folder, path)
        return send_from_directory(app.static_folder, "index.html")

    return app
