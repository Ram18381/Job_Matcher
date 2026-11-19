# Job Matcher — Relational PostgreSQL & Flask Job Platform

**Job Matcher** is a beginner-friendly full-stack web and SQL platform designed to teach relational database design, Python Flask backend architecture, and frontend user workflows.

It implements a normalized 3NF PostgreSQL database connecting three core roles:
1. **Candidate (Job Seeker / Student)**: Multi-proficiency skills profile, education, CV uploads, transparent SQL recommendations, and application history.
2. **Recruiter (Employer)**: Company registration (subject to verification), posting jobs with required skills, reviewing applicants strictly for their company, and updating application status stages (`under_review`, `shortlisted`, `rejected`, `selected`).
3. **Website Developer (Admin)**: System metrics, pending company approval/rejection queue (with reviewer timestamping), and platform-wide data auditing.

---

## Architecture & Tech Stack

* **Database**: PostgreSQL (3NF normalized schema across 15 tables with foreign keys, constraints, and indexes).
* **Backend**: Python 3 (Flask REST API, `psycopg2` threaded connection pool, PBKDF2:SHA256 password hashing, role-based authorization `@role_required`).
* **Frontend**: Vanilla JavaScript (SPA), HTML5, Tailwind CSS design system, and Lucide Icons.
* **Storage**: Local server file storage for uploaded resumes/CVs in `uploads/resumes/`.

---

## Project Structure

```
DBMS_PRO/
│
├── database/
│   ├── schema.sql           # PostgreSQL 3NF DDL schema (15 tables, constraints, indexes)
│   ├── seed.sql             # Sample skills, demo accounts, approved/pending companies, jobs
│   └── queries.sql          # Educational SQL queries (matching algorithm, recruiter views)
│
├── backend/
│   ├── __init__.py          # Flask app factory, CORS, static routes, CV download proxy
│   ├── config.py            # Environment settings and upload paths
│   ├── db.py                # Thread-safe psycopg2 connection pool context manager
│   ├── utils.py             # Password hashing, role authorization decorators, clean records
│   └── routes/
│       ├── auth.py          # /api/auth (User/Recruiter registration, login, logout, me)
│       ├── candidate.py     # /api/candidate (Profile, skills, education, CV uploads, recommendations)
│       ├── recruiter.py     # /api/recruiter (Company jobs, applicant review, status progression)
│       ├── developer.py     # /api/developer (Stats, pending approvals, user/job audits)
│       ├── jobs.py          # /api/jobs (Public/Candidate job browsing, application submission)
│       └── skills.py        # /api/skills (Master skills list)
│
├── frontend/
│   ├── index.html           # Landing page with 3 clear entry points & authenticated app shell
│   ├── styles.css           # Responsive design system, cards, tables, badges, modals
│   └── app.js               # Frontend controller handling API requests and state
│
├── uploads/
│   └── resumes/             # Uploaded PDF and DOC candidate CV files
│
├── .env.example             # Template for database credentials
├── .env                     # Local environment settings
├── requirements.txt         # Python package dependencies
├── run.py                   # Main Flask server entry point (http://localhost:5000)
├── setup_db.py              # Automated 1-command database installer & verification
└── README.md                # Documentation and setup instructions
```

---

## Quick Start (3 Steps)

### Step 1: Install Python Dependencies
Open PowerShell or your terminal inside the project directory:
```powershell
cd C:\pro\DBMS_PRO
pip install -r requirements.txt
```

### Step 2: Initialize PostgreSQL Database
Make sure your local PostgreSQL service is running, then run the automatic installer:
```powershell
python setup_db.py
```
* The script will prompt you for your PostgreSQL password.
* It will create the database `jobportal_db` (if it does not exist), execute `database/schema.sql`, seed realistic initial data from `database/seed.sql`, and automatically update your `.env` file.

### Step 3: Start the Flask Backend Server
```powershell
python run.py
```
Open your browser and navigate to:
```
http://localhost:5000
```

---

## Default Demo Accounts (Pre-seeded)

All pre-seeded demo accounts use secure password hashes (PBKDF2/SHA-256):

| Role | Username | Password | Description |
| :--- | :--- | :--- | :--- |
| **Candidate / Seeker** | `asha_dev` | `password123` | Python & PostgreSQL Specialist (high match for Backend roles) |
| **Candidate / Seeker** | `rahul_web` | `password123` | React & Frontend Specialist (high match for Frontend roles) |
| **Recruiter (Approved)** | `priya_google` | `password123` | Senior Recruiter at Google India (Active & Approved) |
| **Recruiter (Pending)** | `mark_nextgen` | `password123` | Founder at NextGen AI Labs (*Demonstrates pending approval block!*) |
| **Website Developer** | `developer` | `dev@123` | System Administrator (*Full access to approve companies & audit data*) |

---

## Key SQL Features & Learning Concepts

1. **Third Normal Form (3NF) Relational Design**:
   * Master skills are isolated in `skills`.
   * Many-to-Many relationships are handled via junction tables (`candidate_skills`, `job_skills`).
   * Company approval state is modeled on `companies` (`pending`, `approved`, `rejected`) and audited with `reviewed_by` and `reviewed_at`.

2. **Transparent Relational Matching Query**:
   * Uses a PostgreSQL Common Table Expression (CTE) to calculate candidate skill overlap:
     $$\text{Match Percentage} = \text{ROUND}\left(100.0 \times \frac{\text{matching\_skills}}{\text{total\_required\_skills}}, 1\right)$$
   * Also flags candidate work mode and location alignments based on `job_preferences`.

3. **Database Integrity & Transactions**:
   * `UNIQUE(job_id, candidate_id)` prevents accidental duplicate applications to the same job.
   * `CHECK (salary_max >= salary_min)` guarantees valid compensation bounds.
   * Applications and job postings execute within atomic `BEGIN ... COMMIT` transactions to record both the primary record and the first entry in `application_status_history`.
