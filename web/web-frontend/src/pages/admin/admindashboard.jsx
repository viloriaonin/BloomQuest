import React, { useState, useEffect } from "react";
import Sidebar from "./Sidebar";
import { QuestionBankContent } from "./QuestionBank";
import { AcademicMgmtContent } from "./AcademicMgmt";
import { UserMgmtContent } from "./UserMgmt";
import { ReportsContent } from "./Reports";
import Governance from "./Governance";
import { Bar, Doughnut } from "react-chartjs-2";
import { Radio, ShieldCheck, ChevronRight, Bell } from "lucide-react";
import { ArcElement, BarElement, CategoryScale, Chart as ChartJS, Legend, LinearScale, Tooltip } from "chart.js";

ChartJS.register(ArcElement, BarElement, CategoryScale, Legend, LinearScale, Tooltip);

const TAB_META = {
  dashboard: {
    label: "Dashboard",
    description: "Overview of system activity and key metrics.",
  },
  "question-bank": {
    label: "Question Bank",
    description: "Browse, create, and manage exam questions by subject and level.",
  },
  academic: {
    label: "Academic Management",
    description: "Configure departments, courses, and academic assignments.",
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
};

const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [userEmail, setUserEmail] = useState("admin@bloomquest.edu");
  const [userRole, setUserRole] = useState("Administrator");
  const [dashboardData, setDashboardData] = useState({ questions: 0, assessments: 0, faculty: 0, successRate: 0, avgQuestionsPerFaculty: 0, mostActiveDepartment: "N/A", departments: [], notifications: [], activity: [] });
  const [dashboardLoading, setDashboardLoading] = useState(true);

  useEffect(() => {
    const storedEmail = window.localStorage.getItem("email");
    const storedRole = window.localStorage.getItem("role");
    if (storedEmail) setUserEmail(storedEmail);
    if (storedRole) setUserRole(storedRole);
  }, []);

  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        const [questionsRes, logsRes, usersRes, insightsRes] = await Promise.all([fetch("/api/questions"), fetch("/api/activity-logs"), fetch("/api/contact-admin/users"), fetch("/api/admin/insights")]);
        const questions = questionsRes.ok ? await questionsRes.json() : [];
        const logs = logsRes.ok ? await logsRes.json() : [];
        const usersPayload = usersRes.ok ? await usersRes.json() : [];
        const users = Array.isArray(usersPayload) ? usersPayload : usersPayload.users || [];
        const insights = insightsRes.ok ? await insightsRes.json() : {};
        const visibleLogs = logs.filter((item) => String(item.role || '').toLowerCase() !== 'admin' && String(item.name || '').toLowerCase() !== 'system');
        const generatedQuestions = visibleLogs.filter((item) => String(item.type || '').toLowerCase() === 'generate').length;
        const facultyNames = new Set(visibleLogs.map((item) => item.name).filter(Boolean));
        const departmentCounts = visibleLogs.reduce((counts, item) => {
          const department = item.department || item.dept || 'Unknown';
          counts[department] = (counts[department] || 0) + 1;
          return counts;
        }, {});
        const mostActiveDepartment = Object.entries(departmentCounts).sort(([, first], [, second]) => second - first)[0]?.[0] || 'N/A';
        const successfulLogs = visibleLogs.filter((item) => String(item.status || '').toLowerCase() === 'success').length;
        setDashboardData({
          questions: questions.length || generatedQuestions,
          assessments: visibleLogs.filter((item) => /export|download|assessment|question_set/i.test(`${item.type} ${item.action}`)).length,
          faculty: users.filter((item) => String(item.role || "").toLowerCase() === "faculty" && item.is_active !== false && !item.archived).length,
          successRate: visibleLogs.length ? Math.round((successfulLogs / visibleLogs.length) * 100) : 0,
          avgQuestionsPerFaculty: facultyNames.size ? Math.round(generatedQuestions / facultyNames.size) : 0,
          mostActiveDepartment,
          departments: insights.departments || [],
          notifications: (insights.notifications || []).filter(Boolean),
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

  const renderDashboardContent = () => {
    const stats = [
      ["01", "Total Questions", dashboardData.questions, "Question bank", "accent"],
      ["02", "Success Rate", `${dashboardData.successRate}%`, "Activity", "good"],
      ["03", "Most Active Dept.", dashboardData.mostActiveDepartment, `${dashboardData.avgQuestionsPerFaculty} questions / faculty`, "warn"],
      ["04", "Total Assessments", dashboardData.assessments, "Generated / exported", "accent"],
      ["05", "Active Faculty", dashboardData.faculty, "Active accounts", "muted"],
    ];
    return (
      <div className="bq-admin-overview space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {stats.map(([id, label, value, tag, tone]) => <div key={id} className={`bq-admin-stat bq-admin-stat-${tone}`}><div className="flex items-center justify-between"><span className="bq-admin-mono">{id}</span><span className="bq-admin-tag">{tag}</span></div><div className="bq-admin-stat-value">{dashboardLoading ? "..." : value}</div><div className="bq-admin-stat-label">{label}</div></div>)}
        </div>

        <div className="grid gap-4 xl:grid-cols-3">
          <section className="bq-admin-panel xl:col-span-2"><div className="flex items-center justify-between"><h2>Descriptive Analytics</h2><span className="bq-admin-mono">RAW COUNTS</span></div><div className="mt-4 h-64"><Bar data={{ labels: ["Questions", "Assessments", "Faculty"], datasets: [{ data: [dashboardData.questions, dashboardData.assessments, dashboardData.faculty], backgroundColor: ["#C4485A", "#E0A458", "#3A3E48"], borderRadius: 3, barThickness: 54 }] }} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { backgroundColor: "#14161C", borderColor: "#262A34", borderWidth: 1 } }, scales: { x: { ticks: { color: "#8B8F99" }, grid: { display: false } }, y: { beginAtZero: true, ticks: { color: "#8B8F99", precision: 0 }, grid: { color: "#1E2027" } } } }} /></div></section>
          <section className="bq-admin-panel"><h2>Predictive Analytics</h2><div className="mt-4 h-48"><Doughnut data={{ labels: ["Questions", "Assessments", "Faculty"], datasets: [{ data: [dashboardData.questions || 1, dashboardData.assessments || 1, dashboardData.faculty || 1], backgroundColor: ["#C4485A", "#E0A458", "#3A3E48"], borderColor: "#14161C", borderWidth: 2 }] }} options={{ responsive: true, maintainAspectRatio: false, cutout: "62%", plugins: { legend: { position: "bottom", labels: { color: "#8B8F99", boxWidth: 10, padding: 14 } } } }} /></div></section>
        </div>

        <section className="bq-admin-panel"><div className="flex items-center justify-between"><h2>Prescriptive Recommendations</h2><span className="bq-admin-mono">SYSTEM-GENERATED</span></div><div className="bq-admin-advisory mt-4"><span className="bq-admin-tag bq-admin-tag-warn">ADVISORY</span><p>Faculty activity is low across departments. Consider prompting inactive faculty accounts to populate the question bank.</p></div></section>
        <div className="grid gap-4 xl:grid-cols-2">
          <section className="bq-admin-panel"><div className="flex items-center justify-between"><h2>Notification Center</h2><Bell size={16} className="text-[#C4485A]" /></div><div className="mt-4 space-y-2">{dashboardData.notifications.length ? dashboardData.notifications.map((item) => <div key={item.type} className="bq-admin-metric flex items-center justify-between"><span>{item.title}</span><strong>{item.count}</strong></div>) : <p className="bq-admin-muted">No admin notifications.</p>}</div></section>
          <section className="bq-admin-panel"><div className="flex items-center justify-between"><h2>Department Comparison</h2><span className="bq-admin-mono">QUALITY / ACTIVITY</span></div><div className="mt-4 overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b border-slate-700"><th className="py-2 pr-3">Department</th><th className="py-2 pr-3">Faculty</th><th className="py-2 pr-3">Questions</th><th className="py-2">Quality</th></tr></thead><tbody>{dashboardData.departments.map((department) => <tr key={department.department} className="border-b border-slate-800"><td className="py-2 pr-3">{department.department}</td><td className="py-2 pr-3">{department.faculty}</td><td className="py-2 pr-3">{department.questions_contributed}</td><td className="py-2"><span className="bq-admin-tag">{department.quality_score}%</span></td></tr>)}</tbody></table>{!dashboardData.departments.length && <p className="bq-admin-muted py-4">No department data yet.</p>}</div></section>
        </div>
        <section className="bq-admin-panel"><div className="flex items-center justify-between"><div><h2>Classification Models Performance</h2><p className="bq-admin-muted mt-1">Model accuracy for question and faculty predictions.</p></div><button type="button" className="bq-admin-action"><ChevronRight size={14} /> Export Report</button></div><div className="mt-4 grid gap-3 md:grid-cols-3">{[["Successful activity", dashboardData.activity.filter((item) => item.status !== "error").length], ["Generated questions", dashboardData.activity.filter((item) => /generate|question/i.test(`${item.type} ${item.action}`)).length], ["Errors to review", dashboardData.activity.filter((item) => item.status === "error").length]].map(([label, value]) => <div key={label} className="bq-admin-metric"><p>{label}</p><strong>{value}</strong></div>)}</div></section>
      </div>
    );
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case "dashboard":
        return renderDashboardContent();
      case "question-bank":
        return <QuestionBankContent />;
      case "academic":
        return <AcademicMgmtContent />;
      case "users":
        return <UserMgmtContent />;
      case "reports":
        return <ReportsContent />;
      case "governance":
        return <Governance />;
      default:
        return renderDashboardContent();
    }
  };

  return (
    <div className="bq-shell bq-admin-shell bq-admin-dark h-screen w-full overflow-hidden">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      <main className="bq-admin-main flex flex-1 flex-col overflow-auto">
        <header
          className="bq-admin-header sticky top-0 z-10 flex min-h-[76px] items-center justify-between border-b px-6 py-4 backdrop-blur flex-shrink-0"
        >
          <div>
            <div className="flex items-center gap-2"><p className="bq-admin-eyebrow">ADMIN WORKSPACE</p><span className="bq-admin-live"><Radio size={10} /> LIVE</span></div>
            <h1 className="bq-admin-title">{meta.label}</h1>
            <p className="bq-admin-muted mt-1">{meta.description}</p>
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
