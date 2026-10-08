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
    description: "Configure departments, courses, and academic assignments.",
  },
  "question-bank": {
    label: "Question Bank",
    description: "Browse faculty-created questions by campus, department, program, and subject.",
  },
  faculty: {
    label: "Faculty Management",
    description: "Review department faculty and maintain program assignments.",
  },
  requests: {
    label: "Academic Requests",
    description: "Submit faculty account requests and coordinate academic changes.",
  },
  users: {
    label: "User Management",
    description: "Manage faculty and student accounts with approvals and status control.",
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
};

const DepartmentAdminOverview = ({ setActiveTab }) => {
  const [summary, setSummary] = useState({ programs: 0, subjects: 0, faculty: 0, assignedFaculty: 0 });
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
            programs: (department.programs || []).length,
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
        <h2 className="mt-2 text-xl font-semibold">Your department at a glance</h2>
        <p className="bq-admin-muted mt-1">Review academic structure, faculty coverage, and pending coordination needs.</p>
        {error && <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Programs", summary.programs],
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

      <section className="grid gap-4 lg:grid-cols-3">
        {[
          ["Academic Management", "Update dean, department details, programs, and subjects.", "academic"],
          ["Faculty Management", "Review department faculty and manage program assignments.", "faculty"],
          ["Academic Requests", "Invite faculty for approval or coordinate cross-department changes.", "requests"],
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
  const isDepartmentAdmin = String(localStorage.getItem("role") || "").toLowerCase() === "department_admin";
  const [activeTab, setActiveTab] = useState(() => isDepartmentAdmin
    ? "dashboard"
    : location.pathname.startsWith("/admin/academic")
        ? "academic"
      : location.pathname.startsWith("/admin/questions")
        ? "question-bank"
      : location.pathname.startsWith("/admin/users")
        ? "users"
        : "dashboard");
  const [userEmail, setUserEmail] = useState("admin@bloomquest.edu");
  const [userRole, setUserRole] = useState("Administrator");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [adminTheme, setAdminTheme] = useState(() => localStorage.getItem("bloomquest-admin-theme") || "dark");
  const [departments, setDepartments] = useState([]);
  const [departmentsError, setDepartmentsError] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState("All Departments");

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

  useEffect(() => {
    if (isDepartmentAdmin) return;
    if (location.pathname.startsWith("/admin/academic")) {
      setActiveTab("academic");
    } else if (location.pathname.startsWith("/admin/questions")) {
      setActiveTab("question-bank");
    } else if (location.pathname.startsWith("/admin/users")) {
      setActiveTab("users");
    }
  }, [isDepartmentAdmin, location.pathname]);

  useEffect(() => {
    const storedEmail = window.localStorage.getItem("email");
    const storedRole = window.localStorage.getItem("role");
    if (storedEmail) setUserEmail(storedEmail);
    if (storedRole) setUserRole(storedRole);
  }, []);

  useEffect(() => {
    if (isDepartmentAdmin) {
      return undefined;
    }
    const loadDashboardData = async () => {
      try {
        const headers = { Authorization: `Bearer ${localStorage.getItem("token") || ""}` };
        const response = await fetch(`${API_URL}/departments`, { headers });
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload.detail || "Could not load campus departments.");
        }
        setDepartments(await response.json());
      } catch (err) {
        setDepartmentsError(err.message || "Could not load campus departments.");
      }
    };
    loadDashboardData();
  }, [isDepartmentAdmin]);

  const meta = TAB_META[activeTab] || { label: activeTab, description: "" };

  const renderTabContent = () => {
    if (isDepartmentAdmin) {
      if (activeTab === "dashboard") {
        return <DepartmentAdminOverview setActiveTab={setActiveTab} />;
      }
      if (activeTab === "settings") {
        return <AdminSettings theme={adminTheme} onThemeChange={setAdminTheme} departmentAdmin />;
      }
      return (
        <AcademicMgmtContent
          activeSection={activeTab === "faculty" ? "faculty" : activeTab === "requests" ? "requests" : null}
        />
      );
    }
    if (activeTab === "users" && location.pathname.startsWith("/admin/users/")) {
      return <UserDetailPage />;
    }
    switch (activeTab) {
      case "dashboard":
        return (
          <div className="space-y-6">
            <section className="bq-admin-panel flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2>Dashboard filter</h2>
                <p className="bq-admin-muted mt-1 text-sm">Filter campus-wide and department dashboard insights.</p>
              </div>
              <label className="flex items-center gap-3 text-sm font-medium">
                <span>Department</span>
                <select
                  aria-label="Filter dashboard by department"
                  value={selectedDepartment}
                  onChange={(event) => setSelectedDepartment(event.target.value)}
                  className="bq-field min-w-56 px-3 py-2"
                >
                  <option value="All Departments">All Departments</option>
                  {departments.map((item) => (
                    <option key={item.id} value={item.name}>{item.name}</option>
                  ))}
                </select>
              </label>
            </section>
            {departmentsError && <p role="alert" className="bq-admin-panel text-sm text-red-300">{departmentsError}</p>}
            <section className="space-y-3">
              <div>
                <h2 className="text-lg font-semibold">Campus-wide Overview &amp; Analytics</h2>
                <p className="bq-admin-muted mt-1 text-sm">Additional campus-level account, academic, and question insights.</p>
              </div>
              <CampusAdminOverview
                departmentId={departments.find((item) => item.name === selectedDepartment)?.id}
                selectedDepartment={selectedDepartment}
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
    <div className={`bq-shell bq-admin-shell ${activeTab === "academic" ? "bq-admin-shell-academic" : ""} ${adminTheme === "light" ? "bq-admin-light" : "bq-admin-dark"} h-screen w-full overflow-hidden`}>
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
        setActiveTab={setActiveTab}
        adminTheme={adminTheme}
        onThemeToggle={toggleAdminTheme}
        collapsed={sidebarCollapsed}
        mobileOpen={mobileSidebarOpen}
        onNavigate={() => setMobileSidebarOpen(false)}
        departmentAdmin={isDepartmentAdmin}
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
            <div className="flex items-center gap-2"><p className="bq-admin-eyebrow">{isDepartmentAdmin ? "DEPARTMENT WORKSPACE" : "ADMIN WORKSPACE"}</p><span className="bq-admin-live"><Radio size={10} /> LIVE</span></div>
            <h1 className="bq-admin-title">{meta.label}</h1>
            <p className="bq-admin-muted mt-1">{meta.description}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <DataRefreshButton className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-white/10 hover:text-white" />
            <div className="text-right">
              <p className="text-sm font-medium">{isDepartmentAdmin ? "Department Admin" : userRole}</p>
              <p className="bq-admin-mono">{userEmail}</p>
            </div>
            <div
              className="bq-admin-avatar flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold"
            >
              {userEmail.charAt(0).toUpperCase()}
              <span><ShieldCheck size={11} /></span>
            </div>
          </div>
        </header>
        <div className={`bq-page flex-1 ${activeTab === "academic" || (isDepartmentAdmin && activeTab !== "dashboard" && activeTab !== "settings") ? "bq-page-academic" : ""}`}>
          <div className="bq-page-inner">
            {renderTabContent()}
          </div>
        </div>
      </main>
    </div>
  );
};

export const DepartmentAdminDashboard = () => <AdminDashboard />;

export default AdminDashboard;
