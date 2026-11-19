/* ============================================================================
   Job Matcher — Comprehensive Frontend SPA Controller
   Connected to Python Flask REST API & PostgreSQL 3NF Backend
   ============================================================================ */
(() => {
  "use strict";

  // DOM Helpers
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];

  // App State
  let currentUser = null;
  let currentView = "dashboard";
  let masterSkills = [];

  // --------------------------------------------------------------------------
  // Utility & UI Helpers
  // --------------------------------------------------------------------------
  function esc(v = "") {
    return String(v == null ? "" : v).replace(/[&<>"']/g, c => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[c]));
  }

  function initials(name = "User") {
    return name.split(/\s+/).slice(0, 2).map(x => x[0] || "").join("").toUpperCase() || "U";
  }

  function refreshIcons() {
    if (window.lucide) {
      lucide.createIcons();
    }
  }

  function toast(message, isError = false) {
    const el = document.createElement("div");
    el.className = "toast" + (isError ? " error" : "");
    el.innerHTML = `
      <i data-lucide="${isError ? 'alert-circle' : 'check-circle'}"></i>
      <span>${esc(message)}</span>
    `;
    $("#toast-region").append(el);
    refreshIcons();
    setTimeout(() => {
      el.style.opacity = "0";
      setTimeout(() => el.remove(), 250);
    }, 3800);
  }

  function formatCurrency(val) {
    if (!val || Number(val) === 0) return "Not specified";
    return "₹" + Number(val).toLocaleString("en-IN");
  }

  function formatDate(dStr) {
    if (!dStr) return "N/A";
    const d = new Date(dStr);
    return isNaN(d.getTime()) ? dStr : d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  }

  // --------------------------------------------------------------------------
  // API Client Wrapper (with credentials)
  // --------------------------------------------------------------------------
  async function api(endpoint, options = {}) {
    const headers = {
      ...(options.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...(options.headers || {})
    };

    const config = {
      credentials: "include",
      ...options,
      headers
    };

    try {
      const res = await fetch(`/api${endpoint}`, config);
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const errorMsg = data.error || `HTTP error ${res.status}`;
        throw new Error(errorMsg);
      }
      return data;
    } catch (err) {
      console.warn(`API Error [${endpoint}]:`, err.message);
      throw err;
    }
  }

  // --------------------------------------------------------------------------
  // Authentication & Session
  // --------------------------------------------------------------------------
  async function checkSession() {
    try {
      const data = await api("/auth/me");
      if (data.authenticated && data.user) {
        setSession(data.user);
      } else {
        showLandingScreen();
      }
    } catch {
      showLandingScreen();
    }
  }

  function setSession(user) {
    currentUser = user;
    $("#landing-screen").classList.add("hidden");
    $("#app-shell").classList.remove("hidden");

    // Update User Profile Details in Topbar & Sidebar
    const roleLabels = { user: "Candidate", recruiter: "Recruiter", developer: "Website Developer" };
    const displayName = user.name || user.username;
    const roleTitle = roleLabels[user.role] || user.role;

    $("#sidebar-user-name").textContent = displayName;
    $("#sidebar-user-role").textContent = roleTitle;
    $("#sidebar-avatar").textContent = initials(displayName);
    $("#sidebar-avatar").className = `avatar ${user.role}`;

    $("#top-name").textContent = displayName;
    $("#top-role").textContent = roleTitle;
    $("#top-avatar").textContent = initials(displayName);
    $("#top-avatar").className = `avatar ${user.role}`;

    // Render Role Navigation
    renderSidebarNav();

    // Default view per role
    currentView = "dashboard";
    loadView(currentView);
  }

  function showLandingScreen() {
    currentUser = null;
    $("#app-shell").classList.add("hidden");
    $("#landing-screen").classList.remove("hidden");
    refreshIcons();
  }

  async function handleLogout() {
    try {
      await api("/auth/logout", { method: "POST" });
      toast("Successfully logged out.");
    } catch (e) {
      console.warn(e);
    }
    showLandingScreen();
  }

  // --------------------------------------------------------------------------
  // Navigation & View Router
  // --------------------------------------------------------------------------
  function renderSidebarNav() {
    const nav = $("#sidebar-nav");
    let links = [];

    if (currentUser.role === "user") {
      links = [
        { view: "dashboard", icon: "layout-dashboard", label: "Dashboard" },
        { view: "recommendations", icon: "sparkles", label: "SQL Recommendations" },
        { view: "jobs", icon: "briefcase", label: "Browse Jobs" },
        { view: "applications", icon: "clipboard-check", label: "My Applications" },
        { view: "profile", icon: "user", label: "My Profile & CV" }
      ];
    } else if (currentUser.role === "recruiter") {
      links = [
        { view: "dashboard", icon: "layout-dashboard", label: "Dashboard" },
        { view: "post-job", icon: "plus-circle", label: "Post New Opening" },
        { view: "recruiter-jobs", icon: "layers", label: "Company Openings" },
        { view: "recruiter-applicants", icon: "users", label: "Candidate Applicants" },
        { view: "company-profile", icon: "building", label: "Company Profile" }
      ];
    } else if (currentUser.role === "developer") {
      links = [
        { view: "dashboard", icon: "shield-check", label: "Developer Overview" },
        { view: "dev-pending", icon: "clock", label: "Pending Approvals" },
        { view: "dev-companies", icon: "building-2", label: "All Companies" },
        { view: "dev-users", icon: "users-round", label: "User Accounts Audit" },
        { view: "dev-jobs", icon: "briefcase", label: "Job Openings Audit" },
        { view: "dev-applications", icon: "file-text", label: "Applications Audit" }
      ];
    }

    nav.innerHTML = links.map(link => `
      <button class="nav-link ${currentView === link.view ? 'active' : ''}" data-view="${link.view}">
        <i data-lucide="${link.icon}"></i>
        <span>${link.label}</span>
      </button>
    `).join("");

    nav.querySelectorAll("[data-view]").forEach(btn => {
      btn.addEventListener("click", () => {
        const v = btn.dataset.view;
        loadView(v);
      });
    });

    refreshIcons();
  }

  function loadView(viewName) {
    currentView = viewName;
    renderSidebarNav();
    const content = $("#main-content");
    content.innerHTML = `<div style="text-align:center;padding:50px;color:#7e8b9f;"><i data-lucide="loader" class="animate-spin" style="width:28px;height:28px;margin-bottom:10px;"></i><p>Loading data from PostgreSQL...</p></div>`;
    refreshIcons();

    if (currentUser.role === "user") {
      if (viewName === "dashboard") renderCandidateDashboard();
      else if (viewName === "recommendations") renderCandidateRecommendations();
      else if (viewName === "jobs") renderBrowseJobs();
      else if (viewName === "applications") renderCandidateApplications();
      else if (viewName === "profile") renderCandidateProfile();
    } else if (currentUser.role === "recruiter") {
      if (viewName === "dashboard") renderRecruiterDashboard();
      else if (viewName === "post-job") renderPostJobForm();
      else if (viewName === "recruiter-jobs") renderRecruiterJobsList();
      else if (viewName === "recruiter-applicants") renderRecruiterApplicants();
      else if (viewName === "company-profile") renderRecruiterCompanyProfile();
    } else if (currentUser.role === "developer") {
      if (viewName === "dashboard") renderDeveloperDashboard();
      else if (viewName === "dev-pending") renderDeveloperPendingCompanies();
      else if (viewName === "dev-companies") renderDeveloperAllCompanies();
      else if (viewName === "dev-users") renderDeveloperUsersAudit();
      else if (viewName === "dev-jobs") renderDeveloperJobsAudit();
      else if (viewName === "dev-applications") renderDeveloperApplicationsAudit();
    }
  }

  // --------------------------------------------------------------------------
  // CANDIDATE VIEWS
  // --------------------------------------------------------------------------
  async function renderCandidateDashboard() {
    try {
      const [profileData, jobsData, appsData, recData] = await Promise.all([
        api("/candidate/profile"),
        api("/jobs"),
        api("/candidate/applications"),
        api("/candidate/recommendations")
      ]);

      const skillsCount = (profileData.skills || []).length;
      const appsCount = (appsData.applications || []).length;
      const totalJobs = (jobsData.jobs || []).length;
      const topRec = (recData.recommendations || []).slice(0, 3);

      $("#main-content").innerHTML = `
        <div class="page-heading">
          <div>
            <h1>Candidate Workspace</h1>
            <p>Welcome back, <b>${esc(currentUser.name)}</b>! Here is your technical profile and matching overview.</p>
          </div>
          <div class="heading-actions">
            <button class="btn btn-primary" onclick="window.jobMatcher.loadView('recommendations')">
              <i data-lucide="sparkles"></i> View SQL Matches
            </button>
            <button class="btn btn-outline" onclick="window.jobMatcher.loadView('profile')">
              <i data-lucide="user"></i> Edit Profile & CV
            </button>
          </div>
        </div>

        <div class="metrics-grid">
          <div class="metric-card">
            <div class="metric-icon blue"><i data-lucide="cpu"></i></div>
            <div>
              <span class="metric-label">PROFILE SKILLS</span>
              <div class="metric-value">${skillsCount}</div>
              <span class="metric-foot">In your technical profile</span>
            </div>
          </div>
          <div class="metric-card">
            <div class="metric-icon green"><i data-lucide="clipboard-check"></i></div>
            <div>
              <span class="metric-label">APPLICATIONS</span>
              <div class="metric-value">${appsCount}</div>
              <span class="metric-foot">Submitted to recruiters</span>
            </div>
          </div>
          <div class="metric-card">
            <div class="metric-icon gold"><i data-lucide="briefcase"></i></div>
            <div>
              <span class="metric-label">ACTIVE OPENINGS</span>
              <div class="metric-value">${totalJobs}</div>
              <span class="metric-foot">Accepting applications</span>
            </div>
          </div>
          <div class="metric-card">
            <div class="metric-icon purple"><i data-lucide="file-text"></i></div>
            <div>
              <span class="metric-label">SAVED RESUMES</span>
              <div class="metric-value">${(profileData.resumes || []).length}</div>
              <span class="metric-foot">Uploaded CV files</span>
            </div>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:1.4fr 1fr;gap:20px;">
          <!-- Recommendations Preview -->
          <div class="panel">
            <div class="panel-head">
              <div>
                <h3>Recommended Opportunities</h3>
                <p>Top algorithmic matches based on your skills and preferences</p>
              </div>
              <button class="btn btn-soft btn-sm" onclick="window.jobMatcher.loadView('recommendations')">
                View All Matches <i data-lucide="arrow-right"></i>
              </button>
            </div>
            ${topRec.length === 0 ? `
              <p class="muted" style="text-align:center;padding:25px;">No published job recommendations available yet. Try adding more skills to your profile!</p>
            ` : `
              <div style="display:grid;gap:12px;">
                ${topRec.map(j => `
                  <div style="border:1px solid #edf0f5;border-radius:12px;padding:14px;display:flex;align-items:center;justify-content:space-between;gap:14px;">
                    <div>
                      <b style="font-size:13px;display:block;margin-bottom:3px;">${esc(j.title)}</b>
                      <span style="font-size:11px;color:#78869c;">${esc(j.company_name)} · ${esc(j.work_mode)} · ${esc(j.location)}</span>
                    </div>
                    <div style="display:flex;align-items:center;gap:10px;">
                      <span class="match-score-pill ${j.match_percentage >= 70 ? 'high' : 'medium'}">
                        ${j.match_percentage}% Match
                      </span>
                      <button class="btn btn-primary btn-sm" onclick="window.jobMatcher.openApplyModal(${j.id}, '${esc(j.title)}')">
                        Apply
                      </button>
                    </div>
                  </div>
                `).join("")}
              </div>
            `}
          </div>

          <!-- Recent Applications -->
          <div class="panel">
            <div class="panel-head">
              <div>
                <h3>Recent Applications</h3>
                <p>Status progression from recruiters</p>
              </div>
              <button class="btn btn-soft btn-sm" onclick="window.jobMatcher.loadView('applications')">
                View All
              </button>
            </div>
            ${appsCount === 0 ? `
              <p class="muted" style="text-align:center;padding:25px;">You have not applied for any jobs yet. Browse openings to start!</p>
            ` : `
              <div style="display:grid;gap:10px;">
                ${(appsData.applications || []).slice(0, 4).map(a => `
                  <div style="padding:10px 0;border-bottom:1px solid #f0f3f7;display:flex;align-items:center;justify-content:space-between;">
                    <div>
                      <b style="font-size:12px;display:block;">${esc(a.job_title)}</b>
                      <small style="color:#8a96a9;">${esc(a.company_name)} · Applied ${formatDate(a.applied_at)}</small>
                    </div>
                    <span class="status-pill ${a.current_status}">${a.current_status.replace('_', ' ')}</span>
                  </div>
                `).join("")}
              </div>
            `}
          </div>
        </div>
      `;
      refreshIcons();
    } catch (e) {
      $("#main-content").innerHTML = `<div class="panel"><p class="muted" style="color:#c64c54;">Failed to load dashboard: ${esc(e.message)}</p></div>`;
    }
  }

  async function renderCandidateRecommendations() {
    try {
      const data = await api("/candidate/recommendations");
      const recs = data.recommendations || [];

      $("#main-content").innerHTML = `
        <div class="page-heading">
          <div>
            <h1>Smart Relational Job Recommendations</h1>
            <p>Calculated dynamically via PostgreSQL 3NF skill overlap and candidate preferences.</p>
          </div>
        </div>

        <div style="background:#eef4ff;border:1px solid #c9dafa;border-radius:12px;padding:12px 18px;margin-bottom:20px;display:flex;align-items:center;gap:10px;font-size:12px;color:#28488a;">
          <i data-lucide="info" style="width:18px;flex-shrink:0;"></i>
          <span><b>Transparent SQL Matching:</b> Overlap score is computed as <code>(matching_skills / total_required_skills) * 100</code>. Recommendations are guidance based on your profile skills and preferences.</span>
        </div>

        ${recs.length === 0 ? `
          <div class="panel" style="text-align:center;padding:50px;">
            <i data-lucide="compass" style="width:40px;height:40px;color:#9aa7bc;margin-bottom:12px;"></i>
            <h3>No Recommended Openings Found</h3>
            <p class="muted">Ensure you have added technical skills to your profile and that recruiters have published active jobs.</p>
            <button class="btn btn-primary" onclick="window.jobMatcher.loadView('profile')">Manage Profile Skills</button>
          </div>
        ` : `
          <div class="job-grid">
            ${recs.map(job => {
              const skillsList = job.skills_breakdown || [];
              const matchClass = job.match_percentage >= 75 ? "high" : job.match_percentage >= 50 ? "medium" : "low";

              return `
                <div class="job-card">
                  <div class="job-card-head">
                    <div class="company-badge">${esc(job.company_name.substring(0, 2).toUpperCase())}</div>
                    <div class="job-card-title" style="flex:1;">
                      <h3>${esc(job.title)}</h3>
                      <p>${esc(job.company_name)} · ${esc(job.industry || 'Tech')}</p>
                    </div>
                    <span class="match-score-pill ${matchClass}">
                      <i data-lucide="sparkles" style="width:12px;"></i> ${job.match_percentage}% Match
                    </span>
                  </div>

                  <div class="job-meta-row">
                    <span><i data-lucide="map-pin"></i> ${esc(job.location)}</span>
                    <span><i data-lucide="briefcase"></i> ${esc(job.job_type)}</span>
                    <span><i data-lucide="home"></i> ${esc(job.work_mode)}</span>
                    <span><i data-lucide="calendar"></i> Deadline: ${formatDate(job.deadline)}</span>
                  </div>

                  <p style="font-size:11px;color:#55637a;line-height:1.6;margin:0;">
                    ${esc(job.description.length > 150 ? job.description.slice(0, 150) + '...' : job.description)}
                  </p>

                  <!-- Skills match breakdown -->
                  <div>
                    <span style="font-size:10px;font-weight:700;color:#6b7c97;display:block;margin-bottom:6px;">
                      SKILLS OVERLAP (${job.matching_skills_count} OF ${job.total_required_skills} MATCHED):
                    </span>
                    <div class="skill-chips">
                      ${skillsList.map(s => `
                        <span class="skill-chip ${s.matched ? 'match' : 'missing'}">
                          <i data-lucide="${s.matched ? 'check' : 'x'}" style="width:11px;"></i>
                          ${esc(s.name)}
                        </span>
                      `).join("")}
                    </div>
                  </div>

                  <!-- Preferences Alignment -->
                  <div style="font-size:10px;color:#637591;display:flex;gap:12px;flex-wrap:wrap;border-top:1px solid #f0f3f7;padding-top:10px;">
                    ${job.work_mode_match ? `<span style="color:#137351;"><i data-lucide="check-circle" style="width:12px;"></i> Matches your Work Mode preference</span>` : ''}
                    ${job.location_match ? `<span style="color:#137351;"><i data-lucide="check-circle" style="width:12px;"></i> Matches your Location preference</span>` : ''}
                    <span><i data-lucide="credit-card"></i> ${formatCurrency(job.salary_min)} - ${formatCurrency(job.salary_max)}</span>
                  </div>

                  <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:auto;padding-top:8px;">
                    <button class="btn btn-primary" onclick="window.jobMatcher.openApplyModal(${job.id}, '${esc(job.title)}')">
                      <i data-lucide="send"></i> Apply Now
                    </button>
                  </div>
                </div>
              `;
            }).join("")}
          </div>
        `}
      `;
      refreshIcons();
    } catch (e) {
      $("#main-content").innerHTML = `<div class="panel"><p class="muted" style="color:#c64c54;">Failed to load recommendations: ${esc(e.message)}</p></div>`;
    }
  }

  async function renderBrowseJobs() {
    try {
      const data = await api("/jobs");
      const jobs = data.jobs || [];

      $("#main-content").innerHTML = `
        <div class="page-heading">
          <div>
            <h1>Explore Jobs & Internships</h1>
            <p>Browse active verified openings published by approved partner companies.</p>
          </div>
        </div>

        <div class="panel" style="margin-bottom:20px;padding:14px 18px;">
          <div style="display:flex;gap:10px;flex-wrap:wrap;">
            <input id="job-search-input" class="form-input" style="flex:1;min-width:220px;" placeholder="Search by title, skills, or company..." />
            <select id="job-type-filter" class="form-select" style="min-width:140px;">
              <option value="All">All Types</option>
              <option value="Full-time">Full-time</option>
              <option value="Internship">Internship</option>
              <option value="Part-time">Part-time</option>
              <option value="Contract">Contract</option>
            </select>
            <select id="job-mode-filter" class="form-select" style="min-width:140px;">
              <option value="All">All Work Modes</option>
              <option value="Remote">Remote</option>
              <option value="Hybrid">Hybrid</option>
              <option value="On-site">On-site</option>
            </select>
            <button class="btn btn-primary" id="apply-job-filters-btn">
              <i data-lucide="filter"></i> Filter
            </button>
          </div>
        </div>

        <div id="jobs-cards-container" class="job-grid">
          ${renderJobCardsHTML(jobs)}
        </div>
      `;

      $("#apply-job-filters-btn").addEventListener("click", async () => {
        const s = $("#job-search-input").value;
        const t = $("#job-type-filter").value;
        const m = $("#job-mode-filter").value;
        const filtered = await api(`/jobs?search=${encodeURIComponent(s)}&job_type=${encodeURIComponent(t)}&work_mode=${encodeURIComponent(m)}`);
        $("#jobs-cards-container").innerHTML = renderJobCardsHTML(filtered.jobs || []);
        refreshIcons();
      });

      refreshIcons();
    } catch (e) {
      $("#main-content").innerHTML = `<div class="panel"><p class="muted" style="color:#c64c54;">Failed to load jobs: ${esc(e.message)}</p></div>`;
    }
  }

  function renderJobCardsHTML(jobs) {
    if (!jobs.length) {
      return `<div class="panel" style="grid-column:1/-1;text-align:center;padding:40px;"><p class="muted">No matching jobs found matching criteria.</p></div>`;
    }

    return jobs.map(j => `
      <div class="job-card">
        <div class="job-card-head">
          <div class="company-badge">${esc((j.company_name || 'C').substring(0, 2).toUpperCase())}</div>
          <div class="job-card-title" style="flex:1;">
            <h3>${esc(j.title)}</h3>
            <p>${esc(j.company_name)} · ${esc(j.industry || 'Technology')}</p>
          </div>
          <span class="status-pill published">${esc(j.job_type)}</span>
        </div>

        <div class="job-meta-row">
          <span><i data-lucide="map-pin"></i> ${esc(j.location)}</span>
          <span><i data-lucide="home"></i> ${esc(j.work_mode)}</span>
          <span><i data-lucide="credit-card"></i> ${formatCurrency(j.salary_min)} - ${formatCurrency(j.salary_max)}</span>
          <span><i data-lucide="calendar"></i> Apply by ${formatDate(j.deadline)}</span>
        </div>

        <p style="font-size:11px;color:#55637a;line-height:1.6;margin:0;">
          ${esc(j.description)}
        </p>

        <div>
          <span style="font-size:10px;font-weight:700;color:#6b7c97;display:block;margin-bottom:6px;">REQUIRED SKILLS:</span>
          <div class="skill-chips">
            ${(j.required_skills || []).map(s => `
              <span class="skill-chip">
                ${esc(s.name)} <small style="color:#78869c;">(${esc(s.min_proficiency || 'Intermediate')})</small>
              </span>
            `).join("")}
          </div>
        </div>

        <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:auto;border-top:1px solid #f0f3f7;padding-top:12px;">
          <button class="btn btn-primary" onclick="window.jobMatcher.openApplyModal(${j.id}, '${esc(j.title)}')">
            <i data-lucide="send"></i> Apply for Job
          </button>
        </div>
      </div>
    `).join("");
  }

  async function renderCandidateApplications() {
    try {
      const data = await api("/candidate/applications");
      const apps = data.applications || [];

      $("#main-content").innerHTML = `
        <div class="page-heading">
          <div>
            <h1>My Applications</h1>
            <p>Track your submitted applications, reviewer notes, and status progression audit trail.</p>
          </div>
        </div>

        ${apps.length === 0 ? `
          <div class="panel" style="text-align:center;padding:50px;">
            <i data-lucide="clipboard-list" style="width:40px;height:40px;color:#9aa7bc;margin-bottom:12px;"></i>
            <h3>No Applications Submitted Yet</h3>
            <p class="muted">Browse available openings to find positions that match your skills.</p>
            <button class="btn btn-primary" onclick="window.jobMatcher.loadView('jobs')">Browse Jobs</button>
          </div>
        ` : `
          <div style="display:grid;gap:16px;">
            ${apps.map(a => `
              <div class="panel">
                <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:12px;">
                  <div>
                    <h3 style="font-size:15px;margin:0 0 4px;">${esc(a.job_title)}</h3>
                    <p style="font-size:11px;color:#707f96;margin:0;">
                      <b>${esc(a.company_name)}</b> · ${esc(a.job_type)} · ${esc(a.work_mode)} · Applied on ${formatDate(a.applied_at)}
                    </p>
                  </div>
                  <span class="status-pill ${a.current_status}">
                    ${a.current_status.replace('_', ' ')}
                  </span>
                </div>

                ${a.cover_letter ? `
                  <div style="background:#f8fafd;border:1px solid #edf1f7;border-radius:9px;padding:10px 14px;font-size:11px;color:#495870;margin-bottom:14px;">
                    <b>Cover Note:</b> ${esc(a.cover_letter)}
                  </div>
                ` : ''}

                <!-- Status Progression History Audit -->
                <div style="border-top:1px solid #edf0f5;padding-top:12px;">
                  <span style="font-size:10px;font-weight:700;color:#6b7c97;text-transform:uppercase;letter-spacing:.6px;display:block;margin-bottom:8px;">
                    STATUS PROGRESSION AUDIT TRAIL:
                  </span>
                  <div style="display:grid;gap:8px;">
                    ${(a.status_history || []).map(h => `
                      <div style="display:flex;align-items:center;gap:12px;font-size:11px;background:#fcfdfe;border:1px solid #f0f3f8;padding:8px 12px;border-radius:8px;">
                        <span class="status-pill ${h.status}" style="font-size:8px;padding:3px 7px;">${h.status.replace('_', ' ')}</span>
                        <span style="color:#3e4c62;flex:1;">${esc(h.notes || 'Status updated')}</span>
                        <small style="color:#9aa7bb;">${formatDate(h.changed_at)}</small>
                      </div>
                    `).join("")}
                  </div>
                </div>
              </div>
            `).join("")}
          </div>
        `}
      `;
      refreshIcons();
    } catch (e) {
      $("#main-content").innerHTML = `<div class="panel"><p class="muted" style="color:#c64c54;">Failed to load applications: ${esc(e.message)}</p></div>`;
    }
  }

  async function renderCandidateProfile() {
    try {
      const data = await api("/candidate/profile");
      const p = data.profile || {};
      const skills = data.skills || [];
      const edu = data.education || [];
      const exp = data.experience || [];
      const ach = data.achievements || [];
      const resumes = data.resumes || [];
      const pref = data.preferences || {};

      $("#main-content").innerHTML = `
        <div class="page-heading">
          <div>
            <h1>Candidate Profile & Technical Portfolio</h1>
            <p>Maintain your contact info, technical skills, academic history, CV uploads, and job preferences.</p>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:20px;">
          <!-- 1. Bio & Contact Details Form -->
          <div class="panel">
            <div class="panel-head">
              <h3>Biographical & Contact Info</h3>
            </div>
            <form id="profile-bio-form" class="form-grid">
              <div class="form-field full">
                <label>Full Name</label>
                <input class="form-input" name="full_name" value="${esc(p.full_name || '')}" required />
              </div>
              <div class="form-field">
                <label>Email Address</label>
                <input class="form-input" name="email" type="email" value="${esc(p.email || '')}" />
              </div>
              <div class="form-field">
                <label>Phone Number</label>
                <input class="form-input" name="phone" value="${esc(p.phone || '')}" />
              </div>
              <div class="form-field full">
                <label>Location (City, Country)</label>
                <input class="form-input" name="location" value="${esc(p.location || '')}" />
              </div>
              <div class="form-field full">
                <label>Professional Headline</label>
                <input class="form-input" name="headline" value="${esc(p.headline || '')}" placeholder="e.g. Python & PostgreSQL Backend Developer" />
              </div>
              <div class="form-field full">
                <label>Bio / Summary</label>
                <textarea class="form-textarea" name="bio">${esc(p.bio || '')}</textarea>
              </div>
              <div class="form-field">
                <label>GitHub URL</label>
                <input class="form-input" name="github_url" value="${esc(p.github_url || '')}" />
              </div>
              <div class="form-field">
                <label>LinkedIn URL</label>
                <input class="form-input" name="linkedin_url" value="${esc(p.linkedin_url || '')}" />
              </div>
              <div class="form-field full" style="margin-top:10px;">
                <button type="submit" class="btn btn-primary"><i data-lucide="save"></i> Save Profile Details</button>
              </div>
            </form>
          </div>

          <!-- 2. Job Preferences Form -->
          <div class="panel">
            <div class="panel-head">
              <h3>Job Preferences (Matchmaking Input)</h3>
            </div>
            <form id="profile-pref-form" class="form-grid">
              <div class="form-field full">
                <label>Desired Target Role</label>
                <input class="form-input" name="preferred_role" value="${esc(pref.preferred_role || '')}" placeholder="e.g. Backend Software Engineer" />
              </div>
              <div class="form-field">
                <label>Preferred Location</label>
                <input class="form-input" name="preferred_location" value="${esc(pref.preferred_location || '')}" placeholder="e.g. Bengaluru, Remote" />
              </div>
              <div class="form-field">
                <label>Preferred Work Mode</label>
                <select class="form-select" name="preferred_work_mode">
                  <option value="Any" ${pref.preferred_work_mode === 'Any' ? 'selected' : ''}>Any</option>
                  <option value="Remote" ${pref.preferred_work_mode === 'Remote' ? 'selected' : ''}>Remote</option>
                  <option value="Hybrid" ${pref.preferred_work_mode === 'Hybrid' ? 'selected' : ''}>Hybrid</option>
                  <option value="On-site" ${pref.preferred_work_mode === 'On-site' ? 'selected' : ''}>On-site</option>
                </select>
              </div>
              <div class="form-field full">
                <label>Minimum Expected Annual Salary (₹ INR)</label>
                <input class="form-input" type="number" step="10000" name="min_expected_salary" value="${pref.min_expected_salary || 0}" />
              </div>
              <div class="form-field full" style="margin-top:10px;">
                <button type="submit" class="btn btn-primary"><i data-lucide="save"></i> Save Job Preferences</button>
              </div>
            </form>

            <!-- Resume / CV Upload Section -->
            <div style="margin-top:24px;border-top:1px solid #edf0f5;padding-top:18px;">
              <div class="panel-head">
                <h3>Uploaded Resumes / CVs</h3>
              </div>
              <form id="resume-upload-form" style="display:flex;gap:8px;margin-bottom:14px;">
                <input type="file" id="resume-file-input" name="resume" accept=".pdf,.doc,.docx,.txt" class="form-input" style="flex:1;" required />
                <button type="submit" class="btn btn-mint"><i data-lucide="upload"></i> Upload CV</button>
              </form>

              <div style="display:grid;gap:8px;">
                ${resumes.length === 0 ? `<p class="muted" style="font-size:11px;">No resumes uploaded yet. Upload a PDF/DOC CV above.</p>` : resumes.map(r => `
                  <div style="display:flex;align-items:center;justify-content:space-between;padding:9px 12px;background:#f8fafd;border:1px solid #e5edf7;border-radius:9px;font-size:11px;">
                    <div style="display:flex;align-items:center;gap:8px;">
                      <i data-lucide="file-text" style="width:16px;color:#4169e1;"></i>
                      <span><b>${esc(r.file_name)}</b> ${r.is_default ? '<span style="color:#159b73;font-weight:700;">(Default)</span>' : ''}</span>
                    </div>
                    <div style="display:flex;gap:6px;">
                      <a href="/${esc(r.file_path)}" target="_blank" class="btn btn-outline btn-sm"><i data-lucide="eye"></i> View</a>
                      ${!r.is_default ? `<button class="btn btn-soft btn-sm" onclick="window.jobMatcher.setDefaultResume(${r.id})">Set Default</button>` : ''}
                      <button class="btn btn-danger btn-sm" onclick="window.jobMatcher.deleteResume(${r.id})"><i data-lucide="trash"></i></button>
                    </div>
                  </div>
                `).join("")}
              </div>
            </div>
          </div>
        </div>

        <!-- 3. Skills Section -->
        <div class="panel" style="margin-bottom:20px;">
          <div class="panel-head">
            <div>
              <h3>Technical Skills & Proficiencies</h3>
              <p>Skills directly feed the transparent SQL matching engine</p>
            </div>
          </div>

          <form id="add-skill-form" style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:16px;">
            <input id="skill-name-input" class="form-input" style="flex:1;min-width:180px;" placeholder="Skill name (e.g. Python, React, PostgreSQL)..." required />
            <select id="skill-prof-select" class="form-select" style="min-width:140px;">
              <option value="Beginner">Beginner</option>
              <option value="Intermediate" selected>Intermediate</option>
              <option value="Advanced">Advanced</option>
              <option value="Expert">Expert</option>
            </select>
            <input id="skill-exp-input" type="number" step="0.5" min="0" value="1.0" class="form-input" style="width:110px;" placeholder="Years Exp" />
            <button type="submit" class="btn btn-primary"><i data-lucide="plus"></i> Add Skill</button>
          </form>

          <div class="skill-chips">
            ${skills.length === 0 ? `<p class="muted">No skills added yet.</p>` : skills.map(s => `
              <span class="skill-chip match" style="display:inline-flex;align-items:center;gap:8px;padding:6px 12px;font-size:11px;">
                <b>${esc(s.skill_name)}</b>
                <small style="color:#117252;">${esc(s.proficiency)} · ${s.years_of_experience} yrs</small>
                <button type="button" onclick="window.jobMatcher.deleteSkill(${s.id})" style="border:0;background:none;color:#9aa7bb;cursor:pointer;padding:0 2px;"><i data-lucide="x" style="width:12px;"></i></button>
              </span>
            `).join("")}
          </div>
        </div>

        <!-- 4. Academic Education & Experience Lists -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;">
          <div class="panel">
            <div class="panel-head">
              <h3>Academic Education</h3>
              <button class="btn btn-soft btn-sm" onclick="window.jobMatcher.openAddEducationModal()"><i data-lucide="plus"></i> Add Degree</button>
            </div>
            <div style="display:grid;gap:10px;">
              ${edu.length === 0 ? `<p class="muted">No education records added.</p>` : edu.map(e => `
                <div style="padding:10px 12px;border:1px solid #edf0f5;border-radius:10px;display:flex;justify-content:space-between;align-items:center;">
                  <div>
                    <b style="font-size:12px;display:block;">${esc(e.degree)} in ${esc(e.field_of_study || 'Engineering')}</b>
                    <span style="font-size:11px;color:#78869c;">${esc(e.institution)} · ${e.start_year || ''} - ${e.end_year || 'Present'} (${esc(e.grade || '')})</span>
                  </div>
                  <button class="btn btn-danger btn-sm" onclick="window.jobMatcher.deleteEducation(${e.id})"><i data-lucide="trash"></i></button>
                </div>
              `).join("")}
            </div>
          </div>

          <div class="panel">
            <div class="panel-head">
              <h3>Work & Internship Experience</h3>
              <button class="btn btn-soft btn-sm" onclick="window.jobMatcher.openAddExperienceModal()"><i data-lucide="plus"></i> Add Experience</button>
            </div>
            <div style="display:grid;gap:10px;">
              ${exp.length === 0 ? `<p class="muted">No experience entries added (optional).</p>` : exp.map(x => `
                <div style="padding:10px 12px;border:1px solid #edf0f5;border-radius:10px;display:flex;justify-content:space-between;align-items:center;">
                  <div>
                    <b style="font-size:12px;display:block;">${esc(x.role_title)} at ${esc(x.company_name)}</b>
                    <span style="font-size:11px;color:#78869c;">${formatDate(x.start_date)} to ${x.is_current ? 'Present' : formatDate(x.end_date)}</span>
                  </div>
                  <button class="btn btn-danger btn-sm" onclick="window.jobMatcher.deleteExperience(${x.id})"><i data-lucide="trash"></i></button>
                </div>
              `).join("")}
            </div>
          </div>
        </div>
      `;

      // Attach handlers
      $("#profile-bio-form").addEventListener("submit", async e => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const body = Object.fromEntries(fd.entries());
        try {
          await api("/candidate/profile", { method: "PUT", body: JSON.stringify(body) });
          toast("Profile biographical info saved!");
          renderCandidateProfile();
        } catch (err) {
          toast(err.message, true);
        }
      });

      $("#profile-pref-form").addEventListener("submit", async e => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const body = Object.fromEntries(fd.entries());
        try {
          await api("/candidate/preferences", { method: "PUT", body: JSON.stringify(body) });
          toast("Job preferences updated!");
        } catch (err) {
          toast(err.message, true);
        }
      });

      $("#resume-upload-form").addEventListener("submit", async e => {
        e.preventDefault();
        const fileInput = $("#resume-file-input");
        if (!fileInput.files.length) return;
        const fd = new FormData();
        fd.append("resume", fileInput.files[0]);

        try {
          await api("/candidate/resumes/upload", { method: "POST", body: fd });
          toast("CV uploaded successfully!");
          renderCandidateProfile();
        } catch (err) {
          toast(err.message, true);
        }
      });

      $("#add-skill-form").addEventListener("submit", async e => {
        e.preventDefault();
        const skillName = $("#skill-name-input").value;
        const prof = $("#skill-prof-select").value;
        const expYears = $("#skill-exp-input").value;

        try {
          await api("/candidate/skills", {
            method: "POST",
            body: JSON.stringify({
              skill_name: skillName,
              proficiency: prof,
              years_of_experience: expYears
            })
          });
          toast(`Skill '${skillName}' added!`);
          renderCandidateProfile();
        } catch (err) {
          toast(err.message, true);
        }
      });

      refreshIcons();
    } catch (e) {
      $("#main-content").innerHTML = `<div class="panel"><p class="muted" style="color:#c64c54;">Failed to load profile: ${esc(e.message)}</p></div>`;
    }
  }

  // --------------------------------------------------------------------------
  // RECRUITER VIEWS
  // --------------------------------------------------------------------------
  async function renderRecruiterDashboard() {
    try {
      const [compData, jobsData, appsData] = await Promise.all([
        api("/recruiter/company"),
        api("/recruiter/jobs"),
        api("/recruiter/applicants")
      ]);

      const jobs = jobsData.jobs || [];
      const apps = appsData.applicants || [];
      const shortlistedCount = apps.filter(a => a.current_status === "shortlisted").length;
      const pendingReviewCount = apps.filter(a => a.current_status === "submitted" || a.current_status === "under_review").length;

      $("#main-content").innerHTML = `
        <div class="page-heading">
          <div>
            <h1>Recruiter Workspace — ${esc(compData.company.name)}</h1>
            <p>Manage job requisitions, evaluate candidate profiles & CVs, and track applicants.</p>
          </div>
          <div class="heading-actions">
            <button class="btn btn-primary" onclick="window.jobMatcher.loadView('post-job')">
              <i data-lucide="plus-circle"></i> Post New Job Opening
            </button>
          </div>
        </div>

        <div class="metrics-grid">
          <div class="metric-card">
            <div class="metric-icon blue"><i data-lucide="briefcase"></i></div>
            <div>
              <span class="metric-label">COMPANY OPENINGS</span>
              <div class="metric-value">${jobs.length}</div>
              <span class="metric-foot">Posted for ${esc(compData.company.name)}</span>
            </div>
          </div>
          <div class="metric-card">
            <div class="metric-icon green"><i data-lucide="users"></i></div>
            <div>
              <span class="metric-label">TOTAL APPLICANTS</span>
              <div class="metric-value">${apps.length}</div>
              <span class="metric-foot">Candidates applied</span>
            </div>
          </div>
          <div class="metric-card">
            <div class="metric-icon gold"><i data-lucide="clock"></i></div>
            <div>
              <span class="metric-label">PENDING REVIEWS</span>
              <div class="metric-value">${pendingReviewCount}</div>
              <span class="metric-foot">Requires attention</span>
            </div>
          </div>
          <div class="metric-card">
            <div class="metric-icon purple"><i data-lucide="award"></i></div>
            <div>
              <span class="metric-label">SHORTLISTED</span>
              <div class="metric-value">${shortlistedCount}</div>
              <span class="metric-foot">Moved to next interview stage</span>
            </div>
          </div>
        </div>

        <div class="panel">
          <div class="panel-head">
            <div>
              <h3>Recent Candidates for Your Company</h3>
              <p>Applicants who applied to your open postings</p>
            </div>
            <button class="btn btn-soft btn-sm" onclick="window.jobMatcher.loadView('recruiter-applicants')">
              View All Applicants <i data-lucide="arrow-right"></i>
            </button>
          </div>
          ${apps.length === 0 ? `
            <p class="muted" style="text-align:center;padding:30px;">No candidates have applied to your postings yet.</p>
          ` : `
            <div class="table-wrap">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Candidate</th>
                    <th>Job Position</th>
                    <th>Applied Date</th>
                    <th>Skills Profile</th>
                    <th>Current Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  ${apps.slice(0, 5).map(a => `
                    <tr>
                      <td>
                        <b>${esc(a.candidate_name)}</b>
                        <small style="color:#78869c;display:block;">${esc(a.candidate_email || '')}</small>
                      </td>
                      <td><b>${esc(a.job_title)}</b></td>
                      <td>${formatDate(a.applied_at)}</td>
                      <td>
                        <div class="skill-chips">
                          ${(a.candidate_skills || []).slice(0, 3).map(s => `
                            <span class="skill-chip">${esc(s.skill)}</span>
                          `).join("")}
                        </div>
                      </td>
                      <td>
                        <span class="status-pill ${a.current_status}">${a.current_status.replace('_', ' ')}</span>
                      </td>
                      <td>
                        <button class="btn btn-outline btn-sm" onclick="window.jobMatcher.openStatusModal(${a.application_id}, '${a.current_status}')">
                          Update Status
                        </button>
                      </td>
                    </tr>
                  `).join("")}
                </tbody>
              </table>
            </div>
          `}
        </div>
      `;
      refreshIcons();
    } catch (e) {
      $("#main-content").innerHTML = `<div class="panel"><p class="muted" style="color:#c64c54;">Failed to load recruiter workspace: ${esc(e.message)}</p></div>`;
    }
  }

  async function renderPostJobForm() {
    try {
      const skillsData = await api("/skills");
      masterSkills = skillsData.skills || [];

      $("#main-content").innerHTML = `
        <div class="page-heading">
          <div>
            <h1>Post New Job Opening</h1>
            <p>Publish an internship or full-time position with 3NF relational required skills.</p>
          </div>
        </div>

        <div class="panel" style="max-width:850px;">
          <form id="create-job-form" class="form-grid">
            <div class="form-field full">
              <label>Job Title</label>
              <input class="form-input" name="title" placeholder="e.g. Senior Backend Engineer — Python & Cloud" required />
            </div>

            <div class="form-field">
              <label>Job Type</label>
              <select class="form-select" name="job_type">
                <option value="Full-time">Full-time</option>
                <option value="Internship">Internship</option>
                <option value="Part-time">Part-time</option>
                <option value="Contract">Contract</option>
              </select>
            </div>

            <div class="form-field">
              <label>Work Mode</label>
              <select class="form-select" name="work_mode">
                <option value="Remote">Remote</option>
                <option value="Hybrid" selected>Hybrid</option>
                <option value="On-site">On-site</option>
              </select>
            </div>

            <div class="form-field">
              <label>Location (City, Country)</label>
              <input class="form-input" name="location" placeholder="e.g. Bengaluru, India" required />
            </div>

            <div class="form-field">
              <label>Application Deadline</label>
              <input class="form-input" type="date" name="deadline" required />
            </div>

            <div class="form-field">
              <label>Minimum Compensation (₹ INR)</label>
              <input class="form-input" type="number" step="10000" name="salary_min" placeholder="0" />
            </div>

            <div class="form-field">
              <label>Maximum Compensation (₹ INR)</label>
              <input class="form-input" type="number" step="10000" name="salary_max" placeholder="0" />
            </div>

            <div class="form-field full">
              <label>Job Description & Responsibilities</label>
              <textarea class="form-textarea" name="description" placeholder="Describe the day-to-day role and team focus..." required></textarea>
            </div>

            <div class="form-field full">
              <label>Additional Requirements</label>
              <textarea class="form-textarea" name="requirements" placeholder="Qualifications, years of experience, or degree prerequisites..."></textarea>
            </div>

            <!-- Skills Multi-Select -->
            <div class="form-field full" style="border-top:1px solid #edf0f5;padding-top:14px;">
              <label>Select Required Skills (Used for Overlap Matching):</label>
              <div style="display:grid;grid-template-columns:repeat(4, 1fr);gap:8px;max-height:180px;overflow:auto;padding:10px;border:1px solid #e1e7f0;border-radius:10px;background:#fcfdfe;">
                ${masterSkills.map(s => `
                  <label style="display:flex;align-items:center;gap:6px;font-size:11px;cursor:pointer;">
                    <input type="checkbox" name="skill_ids" value="${s.id}" />
                    <span>${esc(s.name)}</span>
                  </label>
                `).join("")}
              </div>
            </div>

            <div class="form-field full" style="margin-top:14px;display:flex;justify-content:flex-end;gap:10px;">
              <button type="button" class="btn btn-outline" onclick="window.jobMatcher.loadView('recruiter-jobs')">Cancel</button>
              <button type="submit" class="btn btn-primary"><i data-lucide="check-circle"></i> Publish Opening</button>
            </div>
          </form>
        </div>
      `;

      // Set default deadline to 30 days in future
      const d = new Date();
      d.setDate(d.getDate() + 30);
      $('input[name="deadline"]').value = d.toISOString().split("T")[0];

      $("#create-job-form").addEventListener("submit", async e => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const selectedSkills = [...$$('input[name="skill_ids"]:checked')].map(cb => Number(cb.value));

        const body = {
          title: fd.get("title"),
          job_type: fd.get("job_type"),
          work_mode: fd.get("work_mode"),
          location: fd.get("location"),
          deadline: fd.get("deadline"),
          salary_min: Number(fd.get("salary_min")) || 0,
          salary_max: Number(fd.get("salary_max")) || 0,
          description: fd.get("description"),
          requirements: fd.get("requirements"),
          skill_ids: selectedSkills
        };

        try {
          await api("/recruiter/jobs", { method: "POST", body: JSON.stringify(body) });
          toast("Job opening created and published successfully!");
          loadView("recruiter-jobs");
        } catch (err) {
          toast(err.message, true);
        }
      });

      refreshIcons();
    } catch (e) {
      $("#main-content").innerHTML = `<div class="panel"><p class="muted" style="color:#c64c54;">Failed to load job creation form: ${esc(e.message)}</p></div>`;
    }
  }

  async function renderRecruiterJobsList() {
    try {
      const data = await api("/recruiter/jobs");
      const jobs = data.jobs || [];

      $("#main-content").innerHTML = `
        <div class="page-heading">
          <div>
            <h1>Company Job Postings</h1>
            <p>Active and closed opportunities belonging to your company.</p>
          </div>
          <div class="heading-actions">
            <button class="btn btn-primary" onclick="window.jobMatcher.loadView('post-job')">
              <i data-lucide="plus-circle"></i> Post New Job
            </button>
          </div>
        </div>

        ${jobs.length === 0 ? `
          <div class="panel" style="text-align:center;padding:40px;">
            <p class="muted">No job postings created yet.</p>
            <button class="btn btn-primary" onclick="window.jobMatcher.loadView('post-job')">Post Opening</button>
          </div>
        ` : `
          <div class="panel">
            <div class="table-wrap">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Type / Mode</th>
                    <th>Location</th>
                    <th>Applicants</th>
                    <th>Deadline</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  ${jobs.map(j => `
                    <tr>
                      <td><b>${esc(j.title)}</b></td>
                      <td>${esc(j.job_type)} · ${esc(j.work_mode)}</td>
                      <td>${esc(j.location)}</td>
                      <td>
                        <span class="match-score-pill medium">${j.applicant_count} Applicants</span>
                      </td>
                      <td>${formatDate(j.deadline)}</td>
                      <td>
                        <span class="status-pill ${j.status}">${esc(j.status)}</span>
                      </td>
                      <td>
                        <div style="display:flex;gap:6px;">
                          ${j.status === 'published' ? `
                            <button class="btn btn-outline btn-sm" onclick="window.jobMatcher.toggleJobStatus(${j.id}, 'closed')">Close</button>
                          ` : `
                            <button class="btn btn-soft btn-sm" onclick="window.jobMatcher.toggleJobStatus(${j.id}, 'published')">Reopen</button>
                          `}
                        </div>
                      </td>
                    </tr>
                  `).join("")}
                </tbody>
              </table>
            </div>
          </div>
        `}
      `;
      refreshIcons();
    } catch (e) {
      $("#main-content").innerHTML = `<div class="panel"><p class="muted" style="color:#c64c54;">Failed to load jobs: ${esc(e.message)}</p></div>`;
    }
  }

  async function renderRecruiterApplicants() {
    try {
      const data = await api("/recruiter/applicants");
      const applicants = data.applicants || [];

      $("#main-content").innerHTML = `
        <div class="page-heading">
          <div>
            <h1>Candidate Applicants</h1>
            <p>Review candidate profiles, technical competencies, uploaded CVs, and advance hiring stages.</p>
          </div>
        </div>

        ${applicants.length === 0 ? `
          <div class="panel" style="text-align:center;padding:50px;">
            <i data-lucide="users" style="width:40px;height:40px;color:#9aa7bc;margin-bottom:12px;"></i>
            <h3>No Applicants Yet</h3>
            <p class="muted">As candidates apply to your company's jobs, their full profiles will appear here.</p>
          </div>
        ` : `
          <div style="display:grid;gap:16px;">
            ${applicants.map(a => `
              <div class="panel">
                <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:14px;margin-bottom:12px;">
                  <div>
                    <h3 style="font-size:15px;margin:0 0 4px;">${esc(a.candidate_name)}</h3>
                    <p style="font-size:11px;color:#707f96;margin:0;">
                      Applied for: <b>${esc(a.job_title)}</b> · Location: ${esc(a.candidate_location || 'Not specified')} · Applied: ${formatDate(a.applied_at)}
                    </p>
                  </div>
                  <div style="display:flex;align-items:center;gap:10px;">
                    <span class="status-pill ${a.current_status}">${a.current_status.replace('_', ' ')}</span>
                    <button class="btn btn-primary btn-sm" onclick="window.jobMatcher.openStatusModal(${a.application_id}, '${a.current_status}')">
                      Update Status
                    </button>
                  </div>
                </div>

                <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;background:#f8fafd;border:1px solid #edf1f7;border-radius:10px;padding:12px 14px;margin-bottom:12px;font-size:11px;">
                  <div>
                    <span style="font-weight:700;color:#6b7c97;display:block;margin-bottom:4px;">CONTACT DETAILS:</span>
                    <span>Email: <a href="mailto:${esc(a.candidate_email)}" style="color:#3158ce;">${esc(a.candidate_email || 'N/A')}</a></span><br/>
                    <span>Phone: ${esc(a.candidate_phone || 'N/A')}</span>
                  </div>
                  <div>
                    <span style="font-weight:700;color:#6b7c97;display:block;margin-bottom:4px;">ATTACHED RESUME / CV:</span>
                    ${a.resume_file_path ? `
                      <a href="/${esc(a.resume_file_path)}" target="_blank" class="btn btn-outline btn-sm" style="display:inline-flex;align-items:center;gap:6px;">
                        <i data-lucide="download"></i> Download ${esc(a.resume_file_name || 'Resume')}
                      </a>
                    ` : `<span class="muted">No CV attached</span>`}
                  </div>
                </div>

                ${a.cover_letter ? `
                  <div style="font-size:11px;color:#505e74;margin-bottom:12px;">
                    <b>Candidate Note:</b> "${esc(a.cover_letter)}"
                  </div>
                ` : ''}

                <div>
                  <span style="font-size:10px;font-weight:700;color:#6b7c97;display:block;margin-bottom:6px;">DECLARED TECHNICAL SKILLS:</span>
                  <div class="skill-chips">
                    ${(a.candidate_skills || []).map(s => `
                      <span class="skill-chip match">${esc(s.skill)} (${esc(s.proficiency || 'Intermediate')})</span>
                    `).join("")}
                  </div>
                </div>
              </div>
            `).join("")}
          </div>
        `}
      `;
      refreshIcons();
    } catch (e) {
      $("#main-content").innerHTML = `<div class="panel"><p class="muted" style="color:#c64c54;">Failed to load applicants: ${esc(e.message)}</p></div>`;
    }
  }

  async function renderRecruiterCompanyProfile() {
    try {
      const data = await api("/recruiter/company");
      const c = data.company || {};
      const r = data.recruiter || {};

      $("#main-content").innerHTML = `
        <div class="page-heading">
          <div>
            <h1>Company Profile</h1>
            <p>Your organization's registered credentials and verification status.</p>
          </div>
        </div>

        <div class="panel" style="max-width:700px;">
          <div style="display:flex;align-items:center;gap:14px;margin-bottom:20px;">
            <div class="company-badge" style="width:54px;height:54px;font-size:20px;">${esc(c.name.substring(0, 2).toUpperCase())}</div>
            <div>
              <h2 style="font-size:18px;margin:0 0 4px;">${esc(c.name)}</h2>
              <span class="status-pill ${c.status}">${esc(c.status)}</span>
            </div>
          </div>

          <div style="display:grid;gap:12px;font-size:12px;">
            <div style="display:flex;justify-content:space-between;border-bottom:1px solid #f0f3f7;padding-bottom:8px;">
              <span class="muted">Industry Sector:</span>
              <b>${esc(c.industry || 'Not specified')}</b>
            </div>
            <div style="display:flex;justify-content:space-between;border-bottom:1px solid #f0f3f7;padding-bottom:8px;">
              <span class="muted">Headquarters / Location:</span>
              <b>${esc(c.location || 'Not specified')}</b>
            </div>
            <div style="display:flex;justify-content:space-between;border-bottom:1px solid #f0f3f7;padding-bottom:8px;">
              <span class="muted">Website:</span>
              <a href="${esc(c.website)}" target="_blank" style="color:#3158ce;">${esc(c.website || 'N/A')}</a>
            </div>
            <div style="display:flex;justify-content:space-between;border-bottom:1px solid #f0f3f7;padding-bottom:8px;">
              <span class="muted">Recruiter Lead:</span>
              <b>${esc(r.full_name)} (${esc(r.designation || 'Recruiter')})</b>
            </div>
          </div>

          <div style="margin-top:20px;">
            <span class="muted" style="font-size:11px;font-weight:700;">COMPANY OVERVIEW:</span>
            <p style="font-size:12px;color:#526075;line-height:1.7;margin-top:6px;">
              ${esc(c.description || 'No description provided.')}
            </p>
          </div>
        </div>
      `;
      refreshIcons();
    } catch (e) {
      $("#main-content").innerHTML = `<div class="panel"><p class="muted" style="color:#c64c54;">Failed to load company profile: ${esc(e.message)}</p></div>`;
    }
  }

  // --------------------------------------------------------------------------
  // WEBSITE DEVELOPER (ADMIN) VIEWS
  // --------------------------------------------------------------------------
  async function renderDeveloperDashboard() {
    try {
      const data = await api("/developer/stats");
      const m = data.metrics || {};

      $("#main-content").innerHTML = `
        <div class="page-heading">
          <div>
            <h1>Developer Oversight & Administration</h1>
            <p>Database governance, recruiter company approvals, and platform metrics.</p>
          </div>
          <div class="heading-actions">
            <button class="btn btn-primary" onclick="window.jobMatcher.loadView('dev-pending')">
              <i data-lucide="clock"></i> Review Pending Companies (${m.pending_companies || 0})
            </button>
          </div>
        </div>

        <div class="metrics-grid">
          <div class="metric-card">
            <div class="metric-icon blue"><i data-lucide="users"></i></div>
            <div>
              <span class="metric-label">CANDIDATES</span>
              <div class="metric-value">${m.total_users || 0}</div>
              <span class="metric-foot">Student accounts</span>
            </div>
          </div>
          <div class="metric-card">
            <div class="metric-icon green"><i data-lucide="briefcase"></i></div>
            <div>
              <span class="metric-label">RECRUITERS</span>
              <div class="metric-value">${m.total_recruiters || 0}</div>
              <span class="metric-foot">Employer accounts</span>
            </div>
          </div>
          <div class="metric-card">
            <div class="metric-icon gold"><i data-lucide="clock"></i></div>
            <div>
              <span class="metric-label">PENDING APPROVALS</span>
              <div class="metric-value">${m.pending_companies || 0}</div>
              <span class="metric-foot">Awaiting developer review</span>
            </div>
          </div>
          <div class="metric-card">
            <div class="metric-icon purple"><i data-lucide="database"></i></div>
            <div>
              <span class="metric-label">TOTAL APPLICATIONS</span>
              <div class="metric-value">${m.total_applications || 0}</div>
              <span class="metric-foot">Platform wide</span>
            </div>
          </div>
        </div>

        <!-- Quick Developer Actions Grid -->
        <div style="display:grid;grid-template-columns:repeat(3, 1fr);gap:16px;">
          <div class="panel" style="display:flex;flex-direction:column;justify-content:space-between;">
            <div>
              <h3>Pending Company Verifications</h3>
              <p class="muted" style="margin:8px 0 16px;">Approve or reject companies that registered recently. Recruiters cannot log in until approved.</p>
            </div>
            <button class="btn btn-mint" onclick="window.jobMatcher.loadView('dev-pending')">
              Open Review Queue <i data-lucide="arrow-right"></i>
            </button>
          </div>

          <div class="panel" style="display:flex;flex-direction:column;justify-content:space-between;">
            <div>
              <h3>User Accounts Audit</h3>
              <p class="muted" style="margin:8px 0 16px;">Inspect all Candidate and Recruiter database records, emails, and creation timestamps.</p>
            </div>
            <button class="btn btn-outline" onclick="window.jobMatcher.loadView('dev-users')">
              Audit Accounts <i data-lucide="arrow-right"></i>
            </button>
          </div>

          <div class="panel" style="display:flex;flex-direction:column;justify-content:space-between;">
            <div>
              <h3>Jobs & Applications Audit</h3>
              <p class="muted" style="margin:8px 0 16px;">Audit all published jobs, applicant counts, and cross-company hiring workflows.</p>
            </div>
            <button class="btn btn-outline" onclick="window.jobMatcher.loadView('dev-jobs')">
              Audit Jobs <i data-lucide="arrow-right"></i>
            </button>
          </div>
        </div>
      `;
      refreshIcons();
    } catch (e) {
      $("#main-content").innerHTML = `<div class="panel"><p class="muted" style="color:#c64c54;">Failed to load developer stats: ${esc(e.message)}</p></div>`;
    }
  }

  async function renderDeveloperPendingCompanies() {
    try {
      const data = await api("/developer/companies/pending");
      const pending = data.pending_companies || [];

      $("#main-content").innerHTML = `
        <div class="page-heading">
          <div>
            <h1>Pending Recruiter Company Approvals</h1>
            <p>New recruiter registrations remain locked until a Website Developer verifies the company.</p>
          </div>
        </div>

        ${pending.length === 0 ? `
          <div class="panel" style="text-align:center;padding:50px;">
            <i data-lucide="check-circle" style="width:40px;height:40px;color:#159b73;margin-bottom:12px;"></i>
            <h3>All Companies Reviewed</h3>
            <p class="muted">There are no pending recruiter company registrations awaiting verification.</p>
          </div>
        ` : `
          <div style="display:grid;gap:16px;">
            ${pending.map(c => `
              <div class="panel">
                <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:14px;margin-bottom:14px;">
                  <div>
                    <h3 style="font-size:16px;margin:0 0 4px;">${esc(c.company_name)}</h3>
                    <p style="font-size:11px;color:#78869c;margin:0;">
                      ${esc(c.industry || 'Technology')} · Location: ${esc(c.location || 'N/A')} · Registered: ${formatDate(c.created_at)}
                    </p>
                  </div>
                  <span class="status-pill pending">PENDING APPROVAL</span>
                </div>

                <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;background:#fffaf0;border:1px solid #fae6c2;border-radius:10px;padding:12px 14px;margin-bottom:14px;font-size:11px;">
                  <div>
                    <span style="font-weight:700;color:#9c6314;display:block;margin-bottom:4px;">RECRUITER APPLICANT:</span>
                    <span>Name: <b>${esc(c.recruiter_name)}</b> (${esc(c.recruiter_designation || 'Recruiter')})</span><br/>
                    <span>Username: <code>${esc(c.recruiter_username)}</code></span><br/>
                    <span>Email: ${esc(c.recruiter_email || 'N/A')} · Phone: ${esc(c.recruiter_phone || 'N/A')}</span>
                  </div>
                  <div>
                    <span style="font-weight:700;color:#9c6314;display:block;margin-bottom:4px;">ORGANIZATION DETAILS:</span>
                    <span>Website: <a href="${esc(c.website)}" target="_blank" style="color:#3158ce;">${esc(c.website || 'N/A')}</a></span><br/>
                    <p style="margin:4px 0 0;color:#6d5322;line-height:1.5;">${esc(c.description || 'No description provided.')}</p>
                  </div>
                </div>

                <div style="display:flex;justify-content:flex-end;gap:10px;">
                  <button class="btn btn-danger" onclick="window.jobMatcher.reviewCompany(${c.company_id}, 'rejected')">
                    <i data-lucide="x-circle"></i> Reject Registration
                  </button>
                  <button class="btn btn-mint" onclick="window.jobMatcher.reviewCompany(${c.company_id}, 'approved')">
                    <i data-lucide="check-circle"></i> Approve Company & Activate Recruiter
                  </button>
                </div>
              </div>
            `).join("")}
          </div>
        `}
      `;
      refreshIcons();
    } catch (e) {
      $("#main-content").innerHTML = `<div class="panel"><p class="muted" style="color:#c64c54;">Failed to load pending queue: ${esc(e.message)}</p></div>`;
    }
  }

  async function renderDeveloperAllCompanies() {
    try {
      const data = await api("/developer/companies");
      const list = data.companies || [];

      $("#main-content").innerHTML = `
        <div class="page-heading">
          <div>
            <h1>Registered Companies Audit</h1>
            <p>Complete directory of approved, pending, and rejected recruiter organizations.</p>
          </div>
        </div>

        <div class="panel">
          <div class="table-wrap">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Company</th>
                  <th>Industry</th>
                  <th>Location</th>
                  <th>Jobs Posted</th>
                  <th>Status</th>
                  <th>Reviewed By</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                ${list.map(c => `
                  <tr>
                    <td><b>${esc(c.name)}</b></td>
                    <td>${esc(c.industry || 'N/A')}</td>
                    <td>${esc(c.location || 'N/A')}</td>
                    <td>${c.jobs_count} Jobs</td>
                    <td><span class="status-pill ${c.status}">${esc(c.status)}</span></td>
                    <td>${c.reviewer_username ? `@${esc(c.reviewer_username)} (${formatDate(c.reviewed_at)})` : 'None'}</td>
                    <td>
                      ${c.status === 'pending' ? `
                        <button class="btn btn-mint btn-sm" onclick="window.jobMatcher.reviewCompany(${c.id}, 'approved')">Approve</button>
                      ` : ''}
                    </td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        </div>
      `;
      refreshIcons();
    } catch (e) {
      $("#main-content").innerHTML = `<div class="panel"><p class="muted" style="color:#c64c54;">Failed to load companies: ${esc(e.message)}</p></div>`;
    }
  }

  async function renderDeveloperUsersAudit() {
    try {
      const data = await api("/developer/users");
      const users = data.users || [];

      $("#main-content").innerHTML = `
        <div class="page-heading">
          <div>
            <h1>User Accounts Audit</h1>
            <p>Database inspection for candidate and recruiter accounts.</p>
          </div>
        </div>

        <div class="panel">
          <div class="table-wrap">
            <table class="data-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Username</th>
                  <th>Role</th>
                  <th>Full Name</th>
                  <th>Email</th>
                  <th>Company</th>
                  <th>Registered At</th>
                </tr>
              </thead>
              <tbody>
                ${users.map(u => `
                  <tr>
                    <td>#${u.account_id}</td>
                    <td><code>@${esc(u.username)}</code></td>
                    <td><span class="portal-card-badge ${u.role}">${esc(u.role)}</span></td>
                    <td><b>${esc(u.full_name || 'N/A')}</b></td>
                    <td>${esc(u.email || 'N/A')}</td>
                    <td>${esc(u.company_name || '—')}</td>
                    <td>${formatDate(u.created_at)}</td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        </div>
      `;
      refreshIcons();
    } catch (e) {
      $("#main-content").innerHTML = `<div class="panel"><p class="muted" style="color:#c64c54;">Failed to load users: ${esc(e.message)}</p></div>`;
    }
  }

  async function renderDeveloperJobsAudit() {
    try {
      const data = await api("/developer/jobs");
      const jobs = data.jobs || [];

      $("#main-content").innerHTML = `
        <div class="page-heading">
          <div>
            <h1>Job Openings Audit</h1>
            <p>Platform-wide job requisition listings and application activity.</p>
          </div>
        </div>

        <div class="panel">
          <div class="table-wrap">
            <table class="data-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Title</th>
                  <th>Company</th>
                  <th>Type / Mode</th>
                  <th>Applicants</th>
                  <th>Deadline</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                ${jobs.map(j => `
                  <tr>
                    <td>#${j.id}</td>
                    <td><b>${esc(j.title)}</b></td>
                    <td>${esc(j.company_name)}</td>
                    <td>${esc(j.job_type)} · ${esc(j.work_mode)}</td>
                    <td><b>${j.applicant_count}</b></td>
                    <td>${formatDate(j.deadline)}</td>
                    <td><span class="status-pill ${j.status}">${esc(j.status)}</span></td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        </div>
      `;
      refreshIcons();
    } catch (e) {
      $("#main-content").innerHTML = `<div class="panel"><p class="muted" style="color:#c64c54;">Failed to load jobs audit: ${esc(e.message)}</p></div>`;
    }
  }

  async function renderDeveloperApplicationsAudit() {
    try {
      const data = await api("/developer/applications");
      const apps = data.applications || [];

      $("#main-content").innerHTML = `
        <div class="page-heading">
          <div>
            <h1>Applications Audit Trail</h1>
            <p>Cross-company candidate applications audit log.</p>
          </div>
        </div>

        <div class="panel">
          <div class="table-wrap">
            <table class="data-table">
              <thead>
                <tr>
                  <th>App ID</th>
                  <th>Candidate</th>
                  <th>Position</th>
                  <th>Company</th>
                  <th>Current Status</th>
                  <th>Applied At</th>
                </tr>
              </thead>
              <tbody>
                ${apps.map(a => `
                  <tr>
                    <td>#${a.application_id}</td>
                    <td><b>${esc(a.candidate_name)}</b><br/><small class="muted">${esc(a.candidate_email || '')}</small></td>
                    <td>${esc(a.job_title)}</td>
                    <td>${esc(a.company_name)}</td>
                    <td><span class="status-pill ${a.current_status}">${a.current_status.replace('_', ' ')}</span></td>
                    <td>${formatDate(a.applied_at)}</td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        </div>
      `;
      refreshIcons();
    } catch (e) {
      $("#main-content").innerHTML = `<div class="panel"><p class="muted" style="color:#c64c54;">Failed to load applications: ${esc(e.message)}</p></div>`;
    }
  }

  // --------------------------------------------------------------------------
  // Modals & Interactive Actions
  // --------------------------------------------------------------------------
  function openAuthModal(role = "user", mode = "login") {
    const modalRoot = $("#modal-root");

    const roleTitles = {
      user: "Candidate / Job Seeker",
      recruiter: "Recruiter & Employer",
      developer: "Website Developer"
    };

    modalRoot.innerHTML = `
      <div class="modal-backdrop" id="auth-modal-backdrop">
        <div class="modal">
          <div class="modal-head">
            <div>
              <h3>${roleTitles[role]} Portal</h3>
              <p class="muted" style="font-size:11px;margin:2px 0 0;">
                ${role === 'developer' ? 'Secure login for administrative oversight' : 'Sign in or register to access features'}
              </p>
            </div>
            <button class="icon-btn" onclick="window.jobMatcher.closeModal()"><i data-lucide="x"></i></button>
          </div>

          <!-- Auth Mode Tabs (User & Recruiter have Sign In / Register; Developer has Sign In only) -->
          <div style="padding:16px 22px 0;">
            <div style="display:flex;gap:6px;background:#f0f3f8;padding:4px;border-radius:10px;">
              <button id="auth-tab-login" class="btn ${mode === 'login' ? 'btn-outline' : ''}" style="flex:1;font-size:11px;${mode === 'login' ? 'background:#fff;box-shadow:0 2px 6px rgba(0,0,0,.06);' : 'background:transparent;border:0;color:#6b7c97;'}">
                Sign In
              </button>
              ${role !== 'developer' ? `
                <button id="auth-tab-register" class="btn ${mode === 'register' ? 'btn-outline' : ''}" style="flex:1;font-size:11px;${mode === 'register' ? 'background:#fff;box-shadow:0 2px 6px rgba(0,0,0,.06);' : 'background:transparent;border:0;color:#6b7c97;'}">
                  ${role === 'recruiter' ? 'Register Company & Recruiter' : 'Create Candidate Account'}
                </button>
              ` : `
                <span style="font-size:10px;color:#9aa7bc;display:flex;align-items:center;padding:0 10px;">
                  <i data-lucide="lock" style="width:12px;margin-right:4px;"></i> Pre-provisioned Only
                </span>
              `}
            </div>
          </div>

          <div class="modal-body">
            <!-- 1. LOGIN FORM -->
            <form id="auth-login-form" class="${mode === 'login' ? '' : 'hidden'} form-grid">
              <input type="hidden" name="expected_role" value="${role}" />
              <div class="form-field full">
                <label>Username</label>
                <input class="form-input" name="username" placeholder="e.g. ${role === 'developer' ? 'developer' : role === 'recruiter' ? 'priya_google' : 'asha_dev'}" required />
              </div>
              <div class="form-field full">
                <label>Password</label>
                <input class="form-input" type="password" name="password" placeholder="Enter your password" required />
              </div>
              <p id="auth-login-error" style="color:#c64c54;font-size:11px;grid-column:1/-1;margin:0;"></p>
              <div class="form-field full" style="margin-top:10px;">
                <button type="submit" class="btn btn-primary" style="width:100%;height:44px;">
                  Sign In <i data-lucide="arrow-right"></i>
                </button>
              </div>
            </form>

            <!-- 2. REGISTER CANDIDATE FORM -->
            ${role === 'user' ? `
              <form id="auth-reg-user-form" class="${mode === 'register' ? '' : 'hidden'} form-grid">
                <div class="form-field full">
                  <label>Full Name</label>
                  <input class="form-input" name="name" placeholder="e.g. John Doe" required />
                </div>
                <div class="form-field">
                  <label>Choose Username</label>
                  <input class="form-input" name="username" placeholder="e.g. john_dev" required />
                </div>
                <div class="form-field">
                  <label>Password</label>
                  <input class="form-input" type="password" name="password" placeholder="At least 6 characters" required />
                </div>
                <div class="form-field">
                  <label>Email Address (Optional)</label>
                  <input class="form-input" type="email" name="email" placeholder="john@example.com" />
                </div>
                <div class="form-field">
                  <label>Phone Number (Optional)</label>
                  <input class="form-input" name="phone" placeholder="+91 ..." />
                </div>
                <div class="form-field full">
                  <label>Professional Headline</label>
                  <input class="form-input" name="headline" placeholder="e.g. React & Python Developer" />
                </div>
                <p id="auth-reg-error" style="color:#c64c54;font-size:11px;grid-column:1/-1;margin:0;"></p>
                <div class="form-field full" style="margin-top:10px;">
                  <button type="submit" class="btn btn-primary" style="width:100%;height:44px;">
                    Create Candidate Account <i data-lucide="check"></i>
                  </button>
                </div>
              </form>
            ` : ''}

            <!-- 3. REGISTER RECRUITER FORM -->
            ${role === 'recruiter' ? `
              <form id="auth-reg-rec-form" class="${mode === 'register' ? '' : 'hidden'} form-grid">
                <div class="form-field full">
                  <label>Company / Organization Name</label>
                  <input class="form-input" name="company_name" placeholder="e.g. TechCorp Solutions" required />
                </div>
                <div class="form-field">
                  <label>Recruiter Full Name</label>
                  <input class="form-input" name="recruiter_name" placeholder="e.g. Sarah Connor" required />
                </div>
                <div class="form-field">
                  <label>Designation</label>
                  <input class="form-input" name="designation" placeholder="e.g. Talent Acquisition Lead" />
                </div>
                <div class="form-field">
                  <label>Choose Username</label>
                  <input class="form-input" name="username" placeholder="e.g. sarah_techcorp" required />
                </div>
                <div class="form-field">
                  <label>Password</label>
                  <input class="form-input" type="password" name="password" placeholder="At least 6 characters" required />
                </div>
                <div class="form-field">
                  <label>Company Website</label>
                  <input class="form-input" name="website" placeholder="https://techcorp.com" />
                </div>
                <div class="form-field">
                  <label>Industry</label>
                  <input class="form-input" name="industry" placeholder="e.g. Software & Cloud" />
                </div>
                <div class="form-field full">
                  <label>Company Headquarters / Location</label>
                  <input class="form-input" name="location" placeholder="e.g. Bengaluru, India" />
                </div>
                <div class="form-field full">
                  <label>Company Description</label>
                  <textarea class="form-textarea" name="company_description" placeholder="Brief overview of company mission and products..."></textarea>
                </div>
                <div style="background:#fff9eb;border:1px solid #fae2af;border-radius:9px;padding:10px;font-size:11px;color:#8f6016;grid-column:1/-1;">
                  <i data-lucide="info" style="width:14px;display:inline;"></i> <b>Note on Verification:</b> Your company registration will start with a <code>pending</code> status. You will receive access once a Website Developer approves the company.
                </div>
                <p id="auth-reg-error" style="color:#c64c54;font-size:11px;grid-column:1/-1;margin:0;"></p>
                <div class="form-field full" style="margin-top:10px;">
                  <button type="submit" class="btn btn-mint" style="width:100%;height:44px;">
                    Register Recruiter & Company <i data-lucide="arrow-right"></i>
                  </button>
                </div>
              </form>
            ` : ''}
          </div>
        </div>
      </div>
    `;

    refreshIcons();

    // Setup tab listeners
    const tabLogin = $("#auth-tab-login");
    const tabReg = $("#auth-tab-register");
    if (tabReg) {
      tabLogin.onclick = () => {
        $("#auth-login-form").classList.remove("hidden");
        if ($("#auth-reg-user-form")) $("#auth-reg-user-form").classList.add("hidden");
        if ($("#auth-reg-rec-form")) $("#auth-reg-rec-form").classList.add("hidden");
        tabLogin.style.background = "#fff";
        tabReg.style.background = "transparent";
      };
      tabReg.onclick = () => {
        $("#auth-login-form").classList.add("hidden");
        if ($("#auth-reg-user-form")) $("#auth-reg-user-form").classList.remove("hidden");
        if ($("#auth-reg-rec-form")) $("#auth-reg-rec-form").classList.remove("hidden");
        tabReg.style.background = "#fff";
        tabLogin.style.background = "transparent";
      };
    }

    // Login Form Submit
    $("#auth-login-form").onsubmit = async e => {
      e.preventDefault();
      const errBox = $("#auth-login-error");
      errBox.textContent = "";
      const fd = new FormData(e.target);
      const body = Object.fromEntries(fd.entries());

      try {
        const res = await api("/auth/login", { method: "POST", body: JSON.stringify(body) });
        closeModal();
        toast(res.message);
        setSession(res.user);
      } catch (err) {
        errBox.textContent = err.message;
      }
    };

    // Candidate Register Form Submit
    if ($("#auth-reg-user-form")) {
      $("#auth-reg-user-form").onsubmit = async e => {
        e.preventDefault();
        const errBox = $("#auth-reg-error");
        errBox.textContent = "";
        const fd = new FormData(e.target);
        const body = Object.fromEntries(fd.entries());

        try {
          const res = await api("/auth/register/user", { method: "POST", body: JSON.stringify(body) });
          closeModal();
          toast(res.message);
          setSession(res.user);
        } catch (err) {
          errBox.textContent = err.message;
        }
      };
    }

    // Recruiter Register Form Submit
    if ($("#auth-reg-rec-form")) {
      $("#auth-reg-rec-form").onsubmit = async e => {
        e.preventDefault();
        const errBox = $("#auth-reg-error");
        errBox.textContent = "";
        const fd = new FormData(e.target);
        const body = Object.fromEntries(fd.entries());

        try {
          const res = await api("/auth/register/recruiter", { method: "POST", body: JSON.stringify(body) });
          closeModal();
          toast(res.message);
          // Show message alerting about pending review
          alert(res.message);
        } catch (err) {
          errBox.textContent = err.message;
        }
      };
    }
  }

  function closeModal() {
    $("#modal-root").innerHTML = "";
  }

  // --------------------------------------------------------------------------
  // Candidate Application Modal
  // --------------------------------------------------------------------------
  async function openApplyModal(jobId, jobTitle) {
    try {
      const data = await api("/candidate/profile");
      const resumes = data.resumes || [];

      $("#modal-root").innerHTML = `
        <div class="modal-backdrop">
          <div class="modal">
            <div class="modal-head">
              <div>
                <h3>Apply for Job Opening</h3>
                <p class="muted" style="font-size:11px;">Submitting application for <b>${esc(jobTitle)}</b></p>
              </div>
              <button class="icon-btn" onclick="window.jobMatcher.closeModal()"><i data-lucide="x"></i></button>
            </div>
            <form id="submit-application-form" class="modal-body form-grid">
              <div class="form-field full">
                <label>Select CV / Resume to Submit</label>
                ${resumes.length === 0 ? `
                  <div style="background:#fff2f2;border:1px solid #ffd6d6;border-radius:9px;padding:10px;font-size:11px;color:#c04d55;">
                    <i data-lucide="alert-circle" style="width:14px;display:inline;"></i> You don't have any uploaded CVs yet. Please upload one in your Profile before applying, or submit without CV.
                  </div>
                ` : `
                  <select class="form-select" name="resume_id">
                    ${resumes.map(r => `
                      <option value="${r.id}" ${r.is_default ? 'selected' : ''}>
                        ${esc(r.file_name)} ${r.is_default ? '(Default)' : ''}
                      </option>
                    `).join("")}
                  </select>
                `}
              </div>

              <div class="form-field full">
                <label>Cover Letter / Note for Recruiter (Optional)</label>
                <textarea class="form-textarea" name="cover_letter" placeholder="Why are you a good fit for this role? Mention your matching skills..."></textarea>
              </div>

              <p id="apply-error" style="color:#c64c54;font-size:11px;grid-column:1/-1;margin:0;"></p>

              <div class="form-field full" style="display:flex;justify-content:flex-end;gap:8px;margin-top:14px;">
                <button type="button" class="btn btn-outline" onclick="window.jobMatcher.closeModal()">Cancel</button>
                <button type="submit" class="btn btn-primary"><i data-lucide="send"></i> Confirm & Submit</button>
              </div>
            </form>
          </div>
        </div>
      `;

      refreshIcons();

      $("#submit-application-form").onsubmit = async e => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const resumeId = fd.get("resume_id");
        const coverLetter = fd.get("cover_letter");
        const errBox = $("#apply-error");
        errBox.textContent = "";

        try {
          const res = await api(`/jobs/${jobId}/apply`, {
            method: "POST",
            body: JSON.stringify({
              resume_id: resumeId ? Number(resumeId) : null,
              cover_letter: coverLetter
            })
          });
          closeModal();
          toast(res.message);
          loadView("applications");
        } catch (err) {
          errBox.textContent = err.message;
        }
      };
    } catch (err) {
      toast(err.message, true);
    }
  }

  // --------------------------------------------------------------------------
  // Recruiter Status Modal
  // --------------------------------------------------------------------------
  function openStatusModal(appId, currentStatus) {
    $("#modal-root").innerHTML = `
      <div class="modal-backdrop">
        <div class="modal" style="max-width:480px;">
          <div class="modal-head">
            <h3>Update Application Status</h3>
            <button class="icon-btn" onclick="window.jobMatcher.closeModal()"><i data-lucide="x"></i></button>
          </div>
          <form id="update-status-form" class="modal-body form-grid">
            <div class="form-field full">
              <label>Select New Stage</label>
              <select class="form-select" name="status">
                <option value="under_review" ${currentStatus === 'under_review' ? 'selected' : ''}>Under Review</option>
                <option value="shortlisted" ${currentStatus === 'shortlisted' ? 'selected' : ''}>Shortlisted</option>
                <option value="selected" ${currentStatus === 'selected' ? 'selected' : ''}>Selected / Hired</option>
                <option value="rejected" ${currentStatus === 'rejected' ? 'selected' : ''}>Rejected</option>
              </select>
            </div>
            <div class="form-field full">
              <label>Recruiter Feedback Note (Recorded in Audit History)</label>
              <textarea class="form-textarea" name="notes" placeholder="e.g. Strong relational database skills. Shortlisted for technical round."></textarea>
            </div>
            <div class="form-field full" style="display:flex;justify-content:flex-end;gap:8px;margin-top:10px;">
              <button type="button" class="btn btn-outline" onclick="window.jobMatcher.closeModal()">Cancel</button>
              <button type="submit" class="btn btn-primary">Save Status</button>
            </div>
          </form>
        </div>
      </div>
    `;

    refreshIcons();

    $("#update-status-form").onsubmit = async e => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const status = fd.get("status");
      const notes = fd.get("notes");

      try {
        const res = await api(`/recruiter/applications/${appId}/status`, {
          method: "PUT",
          body: JSON.stringify({ status, notes })
        });
        closeModal();
        toast(res.message);
        loadView("recruiter-applicants");
      } catch (err) {
        toast(err.message, true);
      }
    };
  }

  // --------------------------------------------------------------------------
  // Developer Actions
  // --------------------------------------------------------------------------
  async function reviewCompany(companyId, status) {
    const action = status === "approved" ? "approve" : "reject";
    if (!confirm(`Are you sure you want to ${action} this company registration?`)) return;

    try {
      const res = await api(`/developer/companies/${companyId}/review`, {
        method: "POST",
        body: JSON.stringify({ status })
      });
      toast(res.message);
      loadView("dev-pending");
    } catch (err) {
      toast(err.message, true);
    }
  }

  async function toggleJobStatus(jobId, newStatus) {
    try {
      const res = await api(`/recruiter/jobs/${jobId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: newStatus })
      });
      toast(res.message);
      loadView("recruiter-jobs");
    } catch (err) {
      toast(err.message, true);
    }
  }

  async function deleteSkill(skillId) {
    if (!confirm("Remove this skill from your profile?")) return;
    try {
      await api(`/candidate/skills/${skillId}`, { method: "DELETE" });
      toast("Skill removed.");
      renderCandidateProfile();
    } catch (err) {
      toast(err.message, true);
    }
  }

  async function deleteResume(resumeId) {
    if (!confirm("Delete this resume file?")) return;
    try {
      await api(`/candidate/resumes/${resumeId}`, { method: "DELETE" });
      toast("Resume removed.");
      renderCandidateProfile();
    } catch (err) {
      toast(err.message, true);
    }
  }

  async function setDefaultResume(resumeId) {
    try {
      await api(`/candidate/resumes/${resumeId}/default`, { method: "PUT" });
      toast("Default resume updated.");
      renderCandidateProfile();
    } catch (err) {
      toast(err.message, true);
    }
  }

  async function deleteEducation(eduId) {
    if (!confirm("Delete education record?")) return;
    try {
      await api(`/candidate/education/${eduId}`, { method: "DELETE" });
      toast("Education record deleted.");
      renderCandidateProfile();
    } catch (err) {
      toast(err.message, true);
    }
  }

  async function deleteExperience(expId) {
    if (!confirm("Delete experience record?")) return;
    try {
      await api(`/candidate/experience/${expId}`, { method: "DELETE" });
      toast("Experience record deleted.");
      renderCandidateProfile();
    } catch (err) {
      toast(err.message, true);
    }
  }

  function openAddEducationModal() {
    $("#modal-root").innerHTML = `
      <div class="modal-backdrop">
        <div class="modal" style="max-width:500px;">
          <div class="modal-head">
            <h3>Add Academic Qualification</h3>
            <button class="icon-btn" onclick="window.jobMatcher.closeModal()"><i data-lucide="x"></i></button>
          </div>
          <form id="add-edu-form" class="modal-body form-grid">
            <div class="form-field full">
              <label>Institution / College / University</label>
              <input class="form-input" name="institution" placeholder="e.g. National Institute of Technology" required />
            </div>
            <div class="form-field">
              <label>Degree</label>
              <input class="form-input" name="degree" placeholder="e.g. B.Tech / B.E. / B.Sc" required />
            </div>
            <div class="form-field">
              <label>Field of Study</label>
              <input class="form-input" name="field_of_study" placeholder="e.g. Computer Science" />
            </div>
            <div class="form-field">
              <label>Start Year</label>
              <input class="form-input" type="number" name="start_year" value="2022" />
            </div>
            <div class="form-field">
              <label>End Year (or Expected)</label>
              <input class="form-input" type="number" name="end_year" value="2026" />
            </div>
            <div class="form-field full">
              <label>Grade / CGPA</label>
              <input class="form-input" name="grade" placeholder="e.g. 8.8 CGPA or 85%" />
            </div>
            <div class="form-field full" style="display:flex;justify-content:flex-end;gap:8px;margin-top:10px;">
              <button type="button" class="btn btn-outline" onclick="window.jobMatcher.closeModal()">Cancel</button>
              <button type="submit" class="btn btn-primary">Save Education</button>
            </div>
          </form>
        </div>
      </div>
    `;
    refreshIcons();

    $("#add-edu-form").onsubmit = async e => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const body = {
        institution: fd.get("institution"),
        degree: fd.get("degree"),
        field_of_study: fd.get("field_of_study"),
        start_year: Number(fd.get("start_year")) || null,
        end_year: Number(fd.get("end_year")) || null,
        grade: fd.get("grade")
      };

      try {
        await api("/candidate/education", { method: "POST", body: JSON.stringify(body) });
        closeModal();
        toast("Education record added!");
        renderCandidateProfile();
      } catch (err) {
        toast(err.message, true);
      }
    };
  }

  function openAddExperienceModal() {
    $("#modal-root").innerHTML = `
      <div class="modal-backdrop">
        <div class="modal" style="max-width:520px;">
          <div class="modal-head">
            <h3>Add Internship / Work Experience</h3>
            <button class="icon-btn" onclick="window.jobMatcher.closeModal()"><i data-lucide="x"></i></button>
          </div>
          <form id="add-exp-form" class="modal-body form-grid">
            <div class="form-field full">
              <label>Company / Organization Name</label>
              <input class="form-input" name="company_name" placeholder="e.g. Google India" required />
            </div>
            <div class="form-field full">
              <label>Job Title / Role</label>
              <input class="form-input" name="role_title" placeholder="e.g. Backend Development Intern" required />
            </div>
            <div class="form-field">
              <label>Location</label>
              <input class="form-input" name="location" placeholder="e.g. Bengaluru" />
            </div>
            <div class="form-field">
              <label>Start Date</label>
              <input class="form-input" type="date" name="start_date" />
            </div>
            <div class="form-field">
              <label>End Date</label>
              <input class="form-input" type="date" name="end_date" />
            </div>
            <div class="form-field" style="display:flex;justify-content:center;align-items:center;">
              <label style="display:flex;align-items:center;gap:6px;cursor:pointer;margin-top:16px;">
                <input type="checkbox" name="is_current" />
                <span>Currently working here</span>
              </label>
            </div>
            <div class="form-field full">
              <label>Key Responsibilities & Achievements</label>
              <textarea class="form-textarea" name="description" placeholder="Highlights of tech stack used and impact..."></textarea>
            </div>
            <div class="form-field full" style="display:flex;justify-content:flex-end;gap:8px;margin-top:10px;">
              <button type="button" class="btn btn-outline" onclick="window.jobMatcher.closeModal()">Cancel</button>
              <button type="submit" class="btn btn-primary">Save Experience</button>
            </div>
          </form>
        </div>
      </div>
    `;
    refreshIcons();

    $("#add-exp-form").onsubmit = async e => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const body = {
        company_name: fd.get("company_name"),
        role_title: fd.get("role_title"),
        location: fd.get("location"),
        start_date: fd.get("start_date") || null,
        end_date: fd.get("end_date") || null,
        is_current: fd.get("is_current") === "on",
        description: fd.get("description")
      };

      try {
        await api("/candidate/experience", { method: "POST", body: JSON.stringify(body) });
        closeModal();
        toast("Experience record added!");
        renderCandidateProfile();
      } catch (err) {
        toast(err.message, true);
      }
    };
  }

  // --------------------------------------------------------------------------
  // Global Event Listeners & Quick Demo Fill
  // --------------------------------------------------------------------------
  document.addEventListener("DOMContentLoaded", () => {
    // Check active session on load
    checkSession();

    // Quick demo login button on hero
    if ($("#hero-quick-login-btn")) {
      $("#hero-quick-login-btn").onclick = () => openAuthModal("user", "login");
    }

    // Demo pills click handler
    $$(".demo-pill").forEach(pill => {
      pill.addEventListener("click", () => {
        const role = pill.dataset.role;
        const user = pill.dataset.user;
        const pass = pill.dataset.pass;
        openAuthModal(role, "login");
        setTimeout(() => {
          const uInput = $('input[name="username"]', $("#auth-login-form"));
          const pInput = $('input[name="password"]', $("#auth-login-form"));
          if (uInput && pInput) {
            uInput.value = user;
            pInput.value = pass;
          }
        }, 100);
      });
    });

    // Logout button
    if ($("#logout-btn")) {
      $("#logout-btn").addEventListener("click", handleLogout);
    }

    // Mobile sidebar toggler
    const mobileBtn = $("#mobile-menu-btn");
    const sidebar = $("#sidebar");
    const sidebarClose = $("#sidebar-close");
    if (mobileBtn && sidebar) {
      mobileBtn.onclick = () => sidebar.classList.add("open");
    }
    if (sidebarClose && sidebar) {
      sidebarClose.onclick = () => sidebar.classList.remove("open");
    }
  });

  // Expose global controller for inline onclick helpers
  window.jobMatcher = {
    loadView,
    openAuthModal,
    closeModal,
    openApplyModal,
    openStatusModal,
    reviewCompany,
    toggleJobStatus,
    deleteSkill,
    deleteResume,
    setDefaultResume,
    deleteEducation,
    deleteExperience,
    openAddEducationModal,
    openAddExperienceModal
  };

  window.openAuthModal = openAuthModal;

})();
