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
import { QuestionBankContent } from "./QuestionBank";
import { downloadXlsxReport } from "./reportExport";
import { getDepartmentScopedDashboardData } from "./dashboardReportUtils";
import { Bar, Doughnut } from "react-chartjs-2";
import { Radio, ShieldCheck, ChevronRight, Menu } from "lucide-react";
import { ArcElement, BarElement, CategoryScale, Chart as ChartJS, Legend, LinearScale, Tooltip } from "chart.js";

ChartJS.register(ArcElement, BarElement, CategoryScale, Legend, LinearScale, Tooltip);

const TAB_META = {
  dashboard: {
    label: "Dashboard",
    description: "Overview of system activity and key metrics.",
  },
  academic: {
    label: "Academic Management",
    description: "Configure departments, courses, and academic assignments.",
  },
  "question-bank": {
    label: "Question Bank",
    description: "Browse faculty-created questions by campus, department, program, and subject.",
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

const AdminDashboard = () => {
  const location = useLocation();
  const [activeTab, setActiveTab] = useState(
    location.pathname.startsWith("/admin/academic")
        ? "academic"
      : location.pathname.startsWith("/admin/questions")
        ? "question-bank"
      : location.pathname.startsWith("/admin/users")
        ? "users"
        : "dashboard",
  );
  const [userEmail, setUserEmail] = useState("admin@bloomquest.edu");
  const [userRole, setUserRole] = useState("Administrator");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [adminTheme, setAdminTheme] = useState(() => localStorage.getItem("bloomquest-admin-theme") || "dark");
  const [dashboardData, setDashboardData] = useState({ questions: 0, activeAccounts: 0, users: [], departments: [], faculty: [], activity: [] });
  const [selectedDepartment, setSelectedDepartment] = useState("All Departments");
  const [dashboardExportError, setDashboardExportError] = useState("");
  const [dashboardLoading, setDashboardLoading] = useState(true);

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
    if (location.pathname.startsWith("/admin/academic")) {
      setActiveTab("academic");
    } else if (location.pathname.startsWith("/admin/questions")) {
      setActiveTab("question-bank");
    } else if (location.pathname.startsWith("/admin/users")) {
      setActiveTab("users");
    }
  }, [location.pathname]);

  useEffect(() => {
    const storedEmail = window.localStorage.getItem("email");
    const storedRole = window.localStorage.getItem("role");
    if (storedEmail) setUserEmail(storedEmail);
    if (storedRole) setUserRole(storedRole);
  }, []);

  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        const headers = { Authorization: `Bearer ${localStorage.getItem("token") || ""}` };
        const [questionsRes, logsRes, usersRes, insightsRes, departmentsRes] = await Promise.all([
          fetch(`${API_URL}/questions`, { headers }),
          fetch(`${API_URL}/activity-logs`, { headers }),
          fetch(`${API_URL}/contact-admin/users`, { headers }),
          fetch(`${API_URL}/admin/insights`, { headers }),
          fetch(`${API_URL}/departments`, { headers }),
        ]);
        const questions = questionsRes.ok ? await questionsRes.json() : [];
        const logs = logsRes.ok ? await logsRes.json() : [];
        const usersPayload = usersRes.ok ? await usersRes.json() : [];
        const users = Array.isArray(usersPayload) ? usersPayload : usersPayload.users || [];
        const isManagedUser = (item) => {
          if (!item || typeof item.role !== "string") return true;
          const role = item.role.toLowerCase();
          return role === "faculty" || role === "student";
        };
        const activeUsers = Array.isArray(usersPayload)
          ? users.filter((item) => isManagedUser(item) && !item.archived && item.is_active !== false)
          : (usersPayload.active || []).filter(isManagedUser);
        const insights = insightsRes.ok ? await insightsRes.json() : {};
        const departmentRecords = departmentsRes.ok ? await departmentsRes.json() : [];
        const metricsByDepartment = new Map((insights.departments || []).map((item) => [
          String(item.department || "").trim().toLowerCase(),
          item,
        ]));
        const departments = departmentRecords.map((department) => {
          const metrics = metricsByDepartment.get(String(department.name || "").trim().toLowerCase()) || {};
          return {
            ...metrics,
            department: department.name,
            faculty: department.faculty_count ?? metrics.faculty ?? 0,
            active_questions: Number(metrics.active_questions ?? metrics.questions_contributed ?? 0),
            questions_contributed: Number(metrics.questions_contributed || 0),
            quality_score: Number(metrics.quality_score || 0),
            activity: Number(metrics.activity || 0),
          };
        });
        (insights.departments || []).forEach((metrics) => {
          if (!departments.some((department) => String(department.department).trim().toLowerCase() === String(metrics.department).trim().toLowerCase())) {
            departments.push(metrics);
          }
        });
        setDashboardData({
          questions: questions.length,
          activeAccounts: activeUsers.length,
          users: activeUsers,
          departments,
          faculty: insights.faculty || [],
          activity: logs,
        });
      } catch (err) {
        console.error("Failed to load admin dashboard data:", err);
      } finally {
        setDashboardLoading(false);
      }
    };
    loadDashboardData();
  }, []);

  const meta = TAB_META[activeTab] || { label: activeTab, description: "" };

  const exportDashboardReport = async () => {
    try {
      const scoped = getDepartmentScopedDashboardData(dashboardData, selectedDepartment);
      const sections = [
        {
          title: "Executive summary",
          subtitle: `Scope: ${selectedDepartment}. Totals use active questions, active faculty/student accounts, and filtered export/download events.`,
          columns: [{ key: "metric", label: "Measure" }, { key: "value", label: "Count / selection" }, { key: "definition", label: "Definition" }],
          rows: [
            { metric: "Active questions", value: scoped.questions, definition: "Non-archived questions in this department." },
            { metric: "Department scope", value: selectedDepartment, definition: "Applied to account, quality, department, and activity rows." },
            { metric: "Assessment export events", value: scoped.assessments, definition: "Export/download events, not distinct assessment files." },
            { metric: "Active accounts", value: scoped.activeAccounts, definition: "Non-archived faculty and student accounts." },
          ],
        },
        {
          title: "Department comparison",
          subtitle: `Quality is a content completeness/governance score, not learner performance. Scope: ${selectedDepartment}.`,
          columns: [{ key: "department", label: "Department" }, { key: "faculty", label: "Faculty" }, { key: "active_questions", label: "Active questions" }, { key: "questions_contributed", label: "Questions contributed" }, { key: "quality_score", label: "Quality score (%)" }, { key: "activity", label: "Activity events" }],
          rows: scoped.departments,
          emptyMessage: `No department metrics are available for ${selectedDepartment}.`,
        },
        {
          title: "Activity summary",
          subtitle: `Administrator/system events are excluded. Scope: ${selectedDepartment}.`,
          columns: [{ key: "status", label: "Status" }, { key: "count", label: "Events" }],
          rows: ["success", "error", "info"].map((status) => ({
            status,
            count: scoped.activity.filter((item) => String(item.status || "").toLowerCase() === status).length,
          })),
        },
        {
          title: "Activity details",
          subtitle: `Source events matching ${selectedDepartment}.`,
          columns: [{ key: "date", label: "Date" }, { key: "time", label: "Time" }, { key: "name", label: "User" }, { key: "dept", label: "Department" }, { key: "action", label: "Action" }, { key: "detail", label: "Details" }, { key: "type", label: "Event type" }, { key: "status", label: "Status" }],
          rows: scoped.activity,
          emptyMessage: `No activity events are recorded for ${selectedDepartment} in the available activity log.`,
        },
      ];
      await downloadXlsxReport(sections, "bloomquest-admin-dashboard.xlsx");
      setDashboardExportError("");
    } catch (error) {
      setDashboardExportError(error.message || "Could not export the dashboard report.");
    }
  };

  const renderDashboardContent = () => {
    const reportData = getDepartmentScopedDashboardData(dashboardData, selectedDepartment);
    const stats = [
      ["01", "Active Questions", reportData.questions, "Question bank", "accent"],
      ["02", "Assessment Exports", reportData.assessments, "Export / download events", "warn"],
      ["03", "Active Accounts", reportData.activeAccounts, "Faculty and students", "muted"],
    ];
    const inactiveFaculty = reportData.faculty.filter((member) => Number(member.questions_contributed) === 0).length;
    const lowestQuality = [...reportData.departments].sort((left, right) => Number(left.quality_score) - Number(right.quality_score))[0];
    const recommendation = inactiveFaculty
      ? `${inactiveFaculty} faculty members in ${selectedDepartment} have not contributed questions yet.`
      : lowestQuality
        ? `${lowestQuality.department} has a ${lowestQuality.quality_score}% content quality score. Check its question completeness.`
        : `No contribution gaps are currently available for ${selectedDepartment}.`;
    const departmentOptions = ["All Departments", ...dashboardData.departments.map((item) => item.department)];
    const activityMix = [reportData.questions, reportData.assessments, reportData.activeAccounts];
    return (
      <div className="bq-admin-overview space-y-4">
        <div className="bq-admin-panel flex flex-wrap items-center justify-between gap-3"><div><h2>Department report filter</h2><p className="bq-admin-muted mt-1">Scope dashboard metrics, department rows, activity and export.</p></div><label className="flex items-center gap-3 text-sm font-medium"><span>Department</span><select value={selectedDepartment} onChange={(event) => setSelectedDepartment(event.target.value)} className="bq-field min-w-56 px-3 py-2"><option value="All Departments">All Departments</option>{departmentOptions.slice(1).map((department) => <option key={department} value={department}>{department}</option>)}</select></label></div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {stats.map(([id, label, value, tag, tone]) => <div key={id} className={`bq-admin-stat bq-admin-stat-${tone}`}><div className="flex items-center justify-between"><span className="bq-admin-mono">{id}</span><span className="bq-admin-tag">{tag}</span></div><div className="bq-admin-stat-value">{dashboardLoading ? "..." : value}</div><div className="bq-admin-stat-label">{label}</div></div>)}
        </div>

        <div className="grid gap-4 xl:grid-cols-3">
          <section className="bq-admin-panel xl:col-span-2"><div className="flex items-center justify-between"><h2>Descriptive Analytics</h2><span className="bq-admin-mono">{selectedDepartment}</span></div><div className="mt-4 h-64"><Bar data={{ labels: ["Questions", "Assessment exports", "Accounts"], datasets: [{ data: [reportData.questions, reportData.assessments, reportData.activeAccounts], backgroundColor: ["#C4485A", "#E0A458", "#3A3E48"], borderRadius: 3, barThickness: 54 }] }} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { backgroundColor: "#14161C", borderColor: "#262A34", borderWidth: 1 } }, scales: { x: { ticks: { color: "#8B8F99" }, grid: { display: false } }, y: { beginAtZero: true, ticks: { color: "#8B8F99", precision: 0 }, grid: { color: "#1E2027" } } } }} /></div></section>
          <section className="bq-admin-panel"><h2>Platform Activity Mix</h2><div className="mt-4 h-48">{activityMix.some((value) => value > 0) ? <Doughnut data={{ labels: ["Questions", "Assessment exports", "Accounts"], datasets: [{ data: activityMix, backgroundColor: ["#C4485A", "#E0A458", "#3A3E48"], borderColor: "#14161C", borderWidth: 2 }] }} options={{ responsive: true, maintainAspectRatio: false, cutout: "62%", plugins: { legend: { position: "bottom", labels: { color: "#8B8F99", boxWidth: 10, padding: 14 } } } }} /> : <p className="bq-admin-muted py-16 text-center">No activity data for {selectedDepartment}.</p>}</div></section>
        </div>

        <section className="bq-admin-panel"><div className="flex items-center justify-between"><h2>Prescriptive Recommendations</h2><span className="bq-admin-mono">BASED ON FILTERED DATA</span></div><div className="bq-admin-advisory mt-4"><span className="bq-admin-tag bq-admin-tag-warn">REVIEW</span><p>{recommendation}</p></div></section>
        <section className="bq-admin-panel"><div className="flex items-center justify-between"><h2>Department Comparison</h2><span className="bq-admin-mono">{selectedDepartment}</span></div><div className="mt-4 overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b border-slate-700"><th className="py-2 pr-3">Department</th><th className="py-2 pr-3">Faculty</th><th className="py-2 pr-3">Active Questions</th><th className="py-2">Quality</th></tr></thead><tbody>{reportData.departments.map((department) => <tr key={department.department} className="border-b border-slate-800"><td className="py-2 pr-3">{department.department}</td><td className="py-2 pr-3">{department.faculty}</td><td className="py-2 pr-3">{department.active_questions || 0}</td><td className="py-2"><span className="bq-admin-tag">{department.quality_score || 0}%</span></td></tr>)}</tbody></table>{!reportData.departments.length && <p className="bq-admin-muted py-4">No department data for {selectedDepartment}.</p>}</div></section>
        <section className="bq-admin-panel"><div className="flex items-center justify-between"><div><h2>System Activity Report</h2><p className="bq-admin-muted mt-1">Activity details for {selectedDepartment}.</p></div><button type="button" onClick={exportDashboardReport} className="bq-admin-action"><ChevronRight size={14} /> Export Report</button></div>{dashboardExportError && <p role="alert" className="mt-3 text-sm text-red-700">{dashboardExportError}</p>}<div className="mt-4 grid gap-3 md:grid-cols-3">{[["Successful activity", reportData.activity.filter((item) => String(item.status || "").toLowerCase() === "success").length], ["Generated questions", reportData.activity.filter((item) => /generate|question/i.test(`${item.type} ${item.action}`)).length], ["Errors to review", reportData.activity.filter((item) => String(item.status || "").toLowerCase() === "error").length]].map(([label, value]) => <div key={label} className="bq-admin-metric"><p>{label}</p><strong>{value}</strong></div>)}</div></section>
      </div>
    );
  };

  const renderTabContent = () => {
    if (activeTab === "users" && location.pathname.startsWith("/admin/users/")) {
      return <UserDetailPage />;
    }
    switch (activeTab) {
      case "dashboard":
        return renderDashboardContent();
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
        return renderDashboardContent();
    }
  };

  return (
    <div className={`bq-shell bq-admin-shell ${adminTheme === "light" ? "bq-admin-light" : "bq-admin-dark"} h-screen w-full overflow-hidden`}>
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
            <div className="flex items-center gap-2"><p className="bq-admin-eyebrow">ADMIN WORKSPACE</p><span className="bq-admin-live"><Radio size={10} /> LIVE</span></div>
            <h1 className="bq-admin-title">{meta.label}</h1>
            <p className="bq-admin-muted mt-1">{meta.description}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-sm font-medium">{userRole}</p>
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
        <div className="bq-page flex-1">
          <div className="bq-page-inner">
            {renderTabContent()}
          </div>
        </div>
      </main>
    </div>
  );
};

export default AdminDashboard;
