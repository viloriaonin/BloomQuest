import React, { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { API_URL } from "../../config/api";
import Sidebar from "./Sidebar";
import { AcademicMgmtContent } from "./AcademicMgmt";
import { UserMgmtContent } from "./UserMgmt";
import { ReportsContent } from "./Reports";
import Governance from "./Governance";
import RecycleBin from "./RecycleBin";
import UserDetailPage from "./UserDetailPage";
import AdminSettings from "./AdminSettings";
import DataRefreshButton from "../../components/DataRefreshButton";
import CampusAdminOverview from "./CampusAdminOverview";
import CampusAdminAIUsage from "./CampusAdminAIUsage";
import { QuestionBankContent } from "./QuestionBank";
import { Radio, ShieldCheck, Menu } from "lucide-react";
import { SuperAdminDashboardContent } from "./SuperAdminDashboard";

const TAB_META = {
  dashboard: {
    label: "Dashboard",
    description: "Campus-wide overview, key metrics, and assessment analytics.",
  },
  "ai-usage": {
    label: "AI Usage",
    description: "Review Gemini activity and usage trends for your campus.",
  },
  academic: {
    label: "Academic Management",
    description: "Manage the department’s programs and subjects.",
  },
  "question-bank": {
    label: "Question Bank",
    description: "Browse faculty-created questions through your assigned academic structure.",
  },
  faculty: {
    label: "Faculty Management",
    description: "Add faculty members and manage active or archived department accounts.",
  },
  leadership: {
    label: "Leadership Management",
    description: "Manage your department dean and program chair assignments.",
  },
  reports: {
    label: "Reports",
    description: "View activity summaries and export performance reports.",
  },
  governance: {
    label: "Content Governance",
    description: "Review, recover, and restore question-bank content.",
  },
  recycle: {
    label: "Recycle Bin",
    description: "Restore deleted content or remove it permanently.",
  },
  settings: {
    label: "Settings",
    description: "Manage your profile and account preferences.",
  },
  campuses: {
    label: "Campus Management",
    description: "Create, update, and manage university campuses.",
  },
  admins: {
    label: "Admin Management",
    description: "Manage Campus Admin and Department Admin accounts.",
  },
  "global-users": {
    label: "Global Users",
    description: "Review users across all university campuses.",
  },
  "activity-logs": {
    label: "Activity Logs",
    description: "Review and export university-wide activity.",
  },
};

const SUPER_ADMIN_TAB_META = {
  dashboard: {
    label: "Dashboard",
    description: "University-wide overview and cross-campus analytics.",
  },
  campuses: {
    label: "Campus Management",
    description: "Create, update, and manage university campuses.",
  },
  admins: {
    label: "Admin Management",
    description: "Manage Campus Admin and Department Admin accounts.",
  },
  "global-users": {
    label: "Global Users",
    description: "Review users across all university campuses.",
  },
  academic: {
    label: "Academic Management",
    description: "Manage academic structures across the university.",
  },
  "question-bank": {
    label: "Question Bank",
    description: "Review questions across the university academic structure.",
  },
  "ai-usage": {
    label: "AI Usage",
    description: "Review university-wide Gemini activity and usage trends.",
  },
  "activity-logs": {
    label: "Activity Logs",
    description: "Review and export university-wide activity.",
  },
  settings: {
    label: "Settings",
    description: "Manage your profile and account preferences.",
  },
};

const DepartmentAdminOverview = ({ setActiveTab }) => {
  const [summary, setSummary] = useState({
    departmentName: "",
    departmentCode: "",
    deanName: "",
    programs: [],
    subjects: 0,
    faculty: 0,
    assignedFaculty: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const loadSummary = async () => {
      try {
        const headers = { Authorization: `Bearer ${localStorage.getItem("token") || ""}` };
        const [hierarchyResponse, subjectsResponse] = await Promise.all([
          fetch(`${API_URL}/academic-hierarchy`, { headers }),
          fetch(`${API_URL}/subjects`, { headers }),
        ]);
        const hierarchy = await hierarchyResponse.json().catch(() => ({}));
        const subjectRecords = await subjectsResponse.json().catch(() => []);
        if (!hierarchyResponse.ok || !subjectsResponse.ok) {
          throw new Error(hierarchy.detail || subjectsResponse.detail || "Could not load department summary.");
        }
        const departments = (hierarchy.campuses || []).flatMap((campus) =>
          (campus.departments || []).map((department) => ({ ...department, campus_id: campus.id })),
        );
        const department = departments.find((item) =>
          item.id === Number(localStorage.getItem("department_id")),
        ) || departments[0];
        if (!department) throw new Error("No department is assigned to this account.");
        const faculty = department.faculty || [];
        if (!cancelled) {
          setSummary({
            departmentName: department.name || "",
            departmentCode: department.code || "",
            deanName: department.dean_name || department.dean?.name || "",
            programs: department.programs || [],
            subjects: subjectRecords.filter((subject) =>
              !subject.archived && (
                subject.department_id === department.id ||
                (department.programs || []).some((program) => program.id === subject.program_id)
              ),
            ).length,
            faculty: faculty.length,
            assignedFaculty: faculty.filter((member) => member.program_id).length,
          });
        }
      } catch (loadError) {
        if (!cancelled) setError(loadError.message || "Could not load department summary.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    loadSummary();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="space-y-5">
      <section className="bq-admin-panel">
        <p className="bq-admin-eyebrow">DEPARTMENT OVERVIEW</p>
        <div className="mt-2 grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(220px,0.65fr)] md:items-end">
          <div>
            <h2 className="text-xl font-semibold">{loading ? "Your department at a glance" : summary.departmentName || "Department details unavailable"}</h2>
            <p className="bq-admin-muted mt-1">
              {summary.departmentCode ? `Department code: ${summary.departmentCode}` : "Your department and the academic units you manage."}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200/70 px-4 py-3">
            <p className="bq-admin-muted text-xs font-medium uppercase tracking-wide">Department Dean</p>
            <p className="mt-1 font-semibold">{loading ? "Loading…" : summary.deanName || "Not assigned"}</p>
          </div>
        </div>
        {error && <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Programs", summary.programs.length],
          ["Subjects", summary.subjects],
          ["Faculty", summary.faculty],
          ["Faculty assigned to programs", `${summary.assignedFaculty}/${summary.faculty}`],
        ].map(([label, value]) => (
          <div className="bq-admin-metric" key={label}>
            <p>{label}</p>
            <strong>{loading ? "—" : value}</strong>
          </div>
        ))}
      </section>

      <section className="bq-admin-panel">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="font-semibold">Programs you manage</h2>
            <p className="bq-admin-muted mt-1 text-sm">Programs assigned to your department.</p>
          </div>
          <span className="bq-admin-mono">{loading ? "—" : `${summary.programs.length} ${summary.programs.length === 1 ? "PROGRAM" : "PROGRAMS"}`}</span>
        </div>
        {loading ? (
          <p className="bq-admin-muted mt-4 text-sm">Loading department programs…</p>
        ) : summary.programs.length ? (
          <ul className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {summary.programs.map((program) => (
              <li key={program.id} className="rounded-xl border border-slate-200/70 px-4 py-3">
                <p className="font-medium">{program.name}</p>
                {program.code && <p className="bq-admin-muted mt-1 text-xs">{program.code}</p>}
              </li>
            ))}
          </ul>
        ) : (
          <p className="bq-admin-muted mt-4 text-sm">No programs are currently assigned to this department.</p>
        )}
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Leadership Management", "Manage your department dean and program chair assignments.", "leadership"],
          ["Faculty Management", "Add faculty members and manage active or archived accounts.", "faculty"],
          ["Academic Management", "Manage the department’s programs and subjects.", "academic"],
        ].map(([title, description, tab]) => (
          <button
            type="button"
            key={tab}
            onClick={() => setActiveTab(tab)}
            className="bq-admin-panel text-left transition hover:border-[#C4485A]"
          >
            <h3 className="font-semibold">{title}</h3>
            <p className="bq-admin-muted mt-2 text-sm">{description}</p>
            <span className="mt-4 inline-block text-sm font-semibold" style={{ color: "var(--bq-accent)" }}>Open workspace →</span>
          </button>
        ))}
      </section>
    </div>
  );
};

const AdminDashboard = () => {
  const location = useLocation();
  const storedRole = String(localStorage.getItem("role") || "").toLowerCase();
  const isDepartmentAdmin = storedRole === "department_admin";
  const isCampusAdmin = storedRole === "campus_admin";
  const isLegacyAdmin = storedRole === "admin";
  const isSuperAdmin = storedRole === "super_admin";
  const isCampusExperience = isCampusAdmin || isLegacyAdmin;
  const [activeTab, setActiveTab] = useState(() => isSuperAdmin
    ? location.pathname.startsWith("/super-admin/academic")
      ? "academic"
      : location.pathname.startsWith("/super-admin/questions")
        ? "question-bank"
        : "dashboard"
    : isDepartmentAdmin
      ? "dashboard"
      : location.pathname.startsWith("/admin/academic")
        ? "academic"
      : location.pathname.startsWith("/admin/questions")
        ? "question-bank"
      : location.pathname.startsWith("/admin/users")
        ? "users"
        : "dashboard");
  const [userEmail, setUserEmail] = useState(() => localStorage.getItem("email") || "admin@bloomquest.edu");
  const [userFullName, setUserFullName] = useState(() => localStorage.getItem("name") || "");
  const [campusName, setCampusName] = useState(() => localStorage.getItem("campus_name") || "");
  const [userRole, setUserRole] = useState("Administrator");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [adminTheme, setAdminTheme] = useState(() => localStorage.getItem("bloomquest-admin-theme") || "dark");
  const [departments, setDepartments] = useState([]);
  const [departmentsError, setDepartmentsError] = useState("");
  const [superAdminError, setSuperAdminError] = useState("");
  const [superAdminNotice, setSuperAdminNotice] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState("All Departments");
  const [selectedProgramId, setSelectedProgramId] = useState("All Programs");
  const selectedDepartmentRecord = departments.find((item) => item.name === selectedDepartment);
  const availablePrograms = selectedDepartmentRecord?.programs || [];

  const toggleAdminTheme = () => {
    const nextTheme = adminTheme === "dark" ? "light" : "dark";
    localStorage.setItem("bloomquest-admin-theme", nextTheme);
    localStorage.setItem("bloomquest-theme", nextTheme);
    window.dispatchEvent(new CustomEvent("theme-updated", { detail: { theme: nextTheme } }));
    setAdminTheme(nextTheme);
  };

  const toggleSidebar = () => {
    setSidebarCollapsed((previous) => !previous);
    setMobileSidebarOpen((previous) => !previous);
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    if (isSuperAdmin) {
      setSuperAdminError("");
      setSuperAdminNotice("");
    }
  };

  useEffect(() => {
    if (isSuperAdmin) {
      if (location.pathname.startsWith("/super-admin/academic")) {
        setActiveTab("academic");
      } else if (location.pathname.startsWith("/super-admin/questions")) {
        setActiveTab("question-bank");
      }
      return;
    }
    if (isDepartmentAdmin) {
      if (location.pathname.startsWith("/admin/questions")) {
        setActiveTab("question-bank");
      }
      return;
    }
    if (location.pathname.startsWith("/admin/academic")) {
      setActiveTab("academic");
    } else if (location.pathname.startsWith("/admin/questions")) {
      setActiveTab("question-bank");
    } else if (location.pathname.startsWith("/admin/users")) {
      setActiveTab("users");
    }
  }, [isDepartmentAdmin, isSuperAdmin, location.pathname]);

  useEffect(() => {
    const syncProfile = () => {
      setUserEmail(window.localStorage.getItem("email") || "admin@bloomquest.edu");
      setUserFullName(window.localStorage.getItem("name") || "");
      setCampusName(window.localStorage.getItem("campus_name") || "");
      setUserRole(window.localStorage.getItem("role") || "Administrator");
    };
    window.addEventListener("profile-updated", syncProfile);
    return () => window.removeEventListener("profile-updated", syncProfile);
  }, []);

  useEffect(() => {
    if (!isCampusExperience) {
      return undefined;
    }
    const loadDashboardData = async () => {
      try {
        const headers = { Authorization: `Bearer ${localStorage.getItem("token") || ""}` };
        const [departmentsResponse, hierarchyResponse] = await Promise.all([
          fetch(`${API_URL}/departments`, { headers }),
          fetch(`${API_URL}/academic-hierarchy`, { headers }),
        ]);
        if (!departmentsResponse.ok || !hierarchyResponse.ok) {
          const payload = await departmentsResponse.json().catch(() => ({}));
          throw new Error(payload.detail || "Could not load campus departments and programs.");
        }
        const [departmentData, hierarchy] = await Promise.all([
          departmentsResponse.json(),
          hierarchyResponse.json(),
        ]);
        const hierarchyDepartments = new Map(
          (hierarchy.campuses || [])
            .flatMap((campus) => campus.departments || [])
            .map((department) => [Number(department.id), department]),
        );
        setDepartments(departmentData.map((department) => ({
          ...department,
          programs: hierarchyDepartments.get(Number(department.id))?.programs || department.programs || [],
        })));
      } catch (err) {
        setDepartmentsError(err.message || "Could not load campus departments.");
      }
    };
    loadDashboardData();
  }, [isCampusExperience]);

  const meta = (isSuperAdmin ? SUPER_ADMIN_TAB_META : TAB_META)[activeTab] || { label: activeTab, description: "" };

  const renderTabContent = () => {
    if (isSuperAdmin) {
      if (activeTab === "settings") {
        return <AdminSettings theme={adminTheme} onThemeChange={setAdminTheme} superAdmin />;
      }
      const superAdminContentTab = {
        "global-users": "users",
        "activity-logs": "activity",
        "question-bank": "questions",
        "ai-usage": "ai_usage",
      }[activeTab] || activeTab;
      return (
        <SuperAdminDashboardContent
          activeTab={superAdminContentTab}
          setError={setSuperAdminError}
          setNotice={setSuperAdminNotice}
        />
      );
    }
    if (isDepartmentAdmin) {
      if (activeTab === "dashboard") {
        return <DepartmentAdminOverview setActiveTab={setActiveTab} />;
      }
      if (activeTab === "settings") {
        return <AdminSettings theme={adminTheme} onThemeChange={setAdminTheme} departmentAdmin />;
      }
      if (activeTab === "question-bank") {
        return <QuestionBankContent />;
      }
      return (
        <AcademicMgmtContent
          activeSection={activeTab === "faculty" ? "faculty" : activeTab === "leadership" ? "leadership" : null}
        />
      );
    }
    if (!isCampusExperience) return null;
    if (activeTab === "users" && location.pathname.startsWith("/admin/users/")) {
      return <UserDetailPage />;
    }
    switch (activeTab) {
      case "dashboard":
        return (
          <div className="space-y-6">
            <section className="bq-admin-panel grid gap-4 shadow-md lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
              <div>
                <h2>Dashboard filter</h2>
                <p className="bq-admin-muted mt-1 text-sm">Filter campus-wide and department dashboard insights.</p>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="min-w-0 text-sm font-medium">
                  Department
                  <select
                    aria-label="Filter dashboard by department"
                    value={selectedDepartment}
                    onChange={(event) => {
                      setSelectedDepartment(event.target.value);
                      setSelectedProgramId("All Programs");
                    }}
                    className="bq-field mt-1.5 block w-56 max-w-full px-3 py-2"
                  >
                    <option value="All Departments">All Departments</option>
                    {departments.map((item) => (
                      <option key={item.id} value={item.name}>{item.name}</option>
                    ))}
                  </select>
                </label>
                <label className="min-w-0 text-sm font-medium">
                  Program
                  <select
                    aria-label="Filter dashboard by program"
                    value={selectedProgramId}
                    onChange={(event) => setSelectedProgramId(event.target.value)}
                    disabled={!selectedDepartmentRecord}
                    className="bq-field mt-1.5 block w-56 max-w-full px-3 py-2 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="All Programs">All Programs</option>
                    {availablePrograms.map((program) => (
                      <option key={program.id} value={program.id}>{program.name}</option>
                    ))}
                  </select>
                </label>
              </div>
            </section>
            {departmentsError && <p role="alert" className="bq-admin-panel text-sm text-red-300">{departmentsError}</p>}
            <section className="space-y-3">
              <div>
                <h2 className="text-lg font-semibold">Campus-wide Overview &amp; Analytics</h2>
                <p className="bq-admin-muted mt-1 text-sm">Additional campus-level account, academic, and question insights.</p>
              </div>
              <CampusAdminOverview
                departments={departments}
                departmentId={selectedDepartmentRecord?.id}
                programId={selectedProgramId === "All Programs" ? undefined : Number(selectedProgramId)}
                selectedDepartment={selectedDepartment}
                selectedProgram={availablePrograms.find((program) => String(program.id) === selectedProgramId)?.name}
              />
            </section>
          </div>
        );
      case "ai-usage":
        return <CampusAdminAIUsage />;
      case "academic":
        return <AcademicMgmtContent />;
      case "question-bank":
        return <QuestionBankContent />;
      case "users":
        return <UserMgmtContent />;
      case "reports":
        return <ReportsContent />;
      case "governance":
        return <Governance />;
      case "recycle":
        return <RecycleBin />;
      case "settings":
        return <AdminSettings theme={adminTheme} onThemeChange={setAdminTheme} />;
      default:
        return null;
    }
  };

  return (
    <div className={`bq-shell bq-admin-shell ${isCampusExperience ? "bq-admin-shell-campus" : ""} ${activeTab === "academic" ? "bq-admin-shell-academic" : ""} ${adminTheme === "light" ? "bq-admin-light" : "bq-admin-dark"} h-screen w-full overflow-hidden`}>
      {mobileSidebarOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          className="fixed inset-0 z-30 bg-slate-950/30 md:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={handleTabChange}
        adminTheme={adminTheme}
        onThemeToggle={toggleAdminTheme}
        collapsed={sidebarCollapsed}
        mobileOpen={mobileSidebarOpen}
        onNavigate={() => setMobileSidebarOpen(false)}
        departmentAdmin={isDepartmentAdmin}
        campusAdmin={isCampusAdmin}
        campusExperience={isCampusExperience}
        superAdmin={isSuperAdmin}
      />
      <main className="bq-admin-main flex flex-1 flex-col overflow-auto">
        <header
          className="bq-admin-header sticky top-0 z-10 flex min-h-[76px] items-center justify-between border-b px-6 py-4 backdrop-blur flex-shrink-0"
        >
          <div className="flex items-start gap-3">
            <button type="button" onClick={toggleSidebar} className="mt-1 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-white/10 hover:text-white" aria-label="Toggle navigation">
              <Menu size={18} />
            </button>
            <div>
            <div className="flex items-center gap-2"><p className="bq-admin-eyebrow">{isDepartmentAdmin ? "DEPARTMENT WORKSPACE" : isSuperAdmin ? "UNIVERSITY WORKSPACE" : "ADMIN WORKSPACE"}</p><span className="bq-admin-live"><Radio size={10} /> LIVE</span></div>
            <h1 className="bq-admin-title">{meta.label}</h1>
            <p className="bq-admin-muted mt-1">{meta.description}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <DataRefreshButton className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-white/10 hover:text-white" />
            <div className="text-right">
              {isCampusAdmin ? (
                <>
                  <p className="text-sm font-medium">{userFullName || userEmail}</p>
                  <p className="text-xs">{`Campus Admin - (${campusName || "Campus"})`}</p>
                  <p className="bq-admin-mono">{userEmail}</p>
                </>
              ) : (
                <>
                  {isSuperAdmin && <p className="text-sm font-medium">{userFullName || userEmail}</p>}
                  <p className="text-xs">{isDepartmentAdmin ? "Department Admin" : isSuperAdmin ? "Super administrator" : userRole}</p>
                  <p className="bq-admin-mono">{userEmail}</p>
                </>
              )}
            </div>
            <div
              className="bq-admin-avatar flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold"
            >
              {(userFullName || userEmail).charAt(0).toUpperCase()}
              <span><ShieldCheck size={11} /></span>
            </div>
          </div>
        </header>
        <div className={`bq-page flex-1 ${activeTab === "academic" || (isDepartmentAdmin && activeTab !== "dashboard" && activeTab !== "settings") ? "bq-page-academic" : ""}`}>
          <div className="bq-page-inner">
            {isSuperAdmin && superAdminError && <div role="alert" className="mb-4 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">{superAdminError}</div>}
            {isSuperAdmin && superAdminNotice && <div role="status" className="mb-4 rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{superAdminNotice}</div>}
            {renderTabContent()}
          </div>
          {!isDepartmentAdmin && (
            <footer className="bq-admin-footer bq-admin-muted mt-8 border-t px-6 py-4 text-center text-xs">
              © {new Date().getFullYear()} BloomQuest. All rights reserved.
            </footer>
          )}
        </div>
      </main>
    </div>
  );
};

export const DepartmentAdminDashboard = () => <AdminDashboard />;

export default AdminDashboard;
