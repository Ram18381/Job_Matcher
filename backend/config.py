import os
from dotenv import load_dotenv

load_dotenv()

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))

class Config:
    BASE_DIR = BASE_DIR
    SECRET_KEY = os.getenv("SECRET_KEY", "job_matcher_super_secret_session_key_2026")
    DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/jobportal_db")
    UPLOAD_FOLDER = os.path.join(BASE_DIR, "uploads", "resumes")
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024  # 16 MB max resume size
    ALLOWED_EXTENSIONS = {"pdf", "doc", "docx", "txt"}
