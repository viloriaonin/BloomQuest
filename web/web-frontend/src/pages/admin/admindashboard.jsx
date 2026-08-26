import React, { useState, useEffect } from "react";
import Sidebar from "./Sidebar";
import { QuestionBankContent } from "./QuestionBank";
import { AcademicMgmtContent } from "./AcademicMgmt";
import { UserMgmtContent } from "./UserMgmt";
import { ReportsContent } from "./Reports";
import { Bar, Doughnut } from "react-chartjs-2";
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
};

const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [userEmail, setUserEmail] = useState("admin@bloomquest.edu");
  const [userRole, setUserRole] = useState("Administrator");
  const [dashboardData, setDashboardData] = useState({ questions: 0, assessments: 0, faculty: 0, activity: [] });
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
        const [questionsRes, logsRes, usersRes] = await Promise.all([fetch("/api/questions"), fetch("/api/activity-logs"), fetch("/api/contact-admin/users")]);
        const questions = questionsRes.ok ? await questionsRes.json() : [];
        const logs = logsRes.ok ? await logsRes.json() : [];
        const usersPayload = usersRes.ok ? await usersRes.json() : [];
        const users = Array.isArray(usersPayload) ? usersPayload : usersPayload.users || [];
        setDashboardData({
          questions: questions.length,
          assessments: logs.filter((item) => /export|assessment|question_set/i.test(`${item.type} ${item.action}`)).length,
          faculty: users.filter((item) => String(item.role || "").toLowerCase() === "faculty" && item.is_active !== false && !item.archived).length,
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

  const renderDashboardContent = () => (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="bq-panel p-6">
          <p className="text-sm font-medium text-gray-500">Total Questions</p>
          <div className="mt-4 flex items-end gap-3">
            <span className="text-4xl font-bold text-gray-900">{dashboardLoading ? "..." : dashboardData.questions}</span>
            <span className="rounded-full bg-rose-50 px-3 py-1 text-sm font-semibold text-[#B4454A]">Question bank</span>
          </div>
        </div>

        <div className="bq-panel p-6">
          <p className="text-sm font-medium text-gray-500">Total Assessments</p>
          <div className="mt-4 flex items-end gap-3">
            <span className="text-4xl font-bold text-gray-900">{dashboardLoading ? "..." : dashboardData.assessments}</span>
            <span className="rounded-full bg-rose-50 px-3 py-1 text-sm font-semibold text-[#B4454A]">Generated or exported</span>
          </div>
        </div>

        <div className="bq-panel p-6">
          <p className="text-sm font-medium text-gray-500">Active Faculty</p>
          <div className="mt-4 flex items-end gap-3">
            <span className="text-4xl font-bold text-gray-900">{dashboardLoading ? "..." : dashboardData.faculty}</span>
            <span className="rounded-full bg-rose-50 px-3 py-1 text-sm font-semibold text-[#B4454A]">Active accounts</span>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="bq-panel p-6 xl:col-span-2">
          <h2 className="text-lg font-bold text-gray-900">Descriptive Analytics</h2>
          <div className="mt-5 h-56"><Bar data={{ labels: ["Questions", "Assessments", "Faculty"], datasets: [{ data: [dashboardData.questions, dashboardData.assessments, dashboardData.faculty], backgroundColor: ["#B4454A", "#D4777B", "#E9B8BA"], borderRadius: 8 }] }} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } }} /></div>
        </div>

        <div className="bq-panel p-6">
          <h2 className="text-lg font-bold text-gray-900">Predictive Analytics</h2>
          <div className="mt-5 h-40"><Doughnut data={{ labels: ["Questions", "Assessments", "Faculty"], datasets: [{ data: [dashboardData.questions || 1, dashboardData.assessments || 1, dashboardData.faculty || 1], backgroundColor: ["#B4454A", "#D4777B", "#E9B8BA"], borderWidth: 0 }] }} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "bottom", labels: { boxWidth: 10 } } } }} /></div>
        </div>

        <div className="bq-panel p-6">
          <h2 className="text-lg font-bold text-gray-900">Prescriptive Recommendations</h2>
          <ul className="mt-3 space-y-3 text-sm text-gray-600">
            <li>• Keep the question bank growing beyond <span className="font-semibold">{dashboardData.questions}</span> items.</li>
            <li>• Review activity logs for unanswered or failed actions.</li>
            <li>• Encourage active faculty to create and export balanced assessments.</li>
          </ul>
        </div>
      </div>

      <div className="bq-panel p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Classification Models Performance</h2>
            <p className="mt-2 text-sm text-gray-600">Model accuracy for question and faculty predictions.</p>
          </div>
          <button
            className="inline-flex items-center gap-2 rounded-full bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800 transition"
          >
            Export Report
          </button>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-3xl bg-gray-50 p-5 border border-gray-100">
            <p className="text-sm text-gray-500">Successful activity</p>
            <p className="mt-4 text-3xl font-bold text-gray-900">{dashboardData.activity.filter((item) => item.status !== "error").length}</p>
          </div>
          <div className="rounded-3xl bg-gray-50 p-5 border border-gray-100">
            <p className="text-sm text-gray-500">Generated questions</p>
            <p className="mt-4 text-3xl font-bold text-gray-900">{dashboardData.activity.filter((item) => /generate|question/i.test(`${item.type} ${item.action}`)).length}</p>
          </div>
          <div className="rounded-3xl bg-gray-50 p-5 border border-gray-100">
            <p className="text-sm text-gray-500">Errors to review</p>
            <p className="mt-4 text-3xl font-bold text-gray-900">{dashboardData.activity.filter((item) => item.status === "error").length}</p>
          </div>
        </div>
      </div>
    </div>
  );

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
      default:
        return renderDashboardContent();
    }
  };

  return (
    <div className="bq-shell bq-admin-shell h-screen w-full overflow-hidden" style={{ backgroundColor: "var(--bq-bg)" }}>
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      <main className="bq-admin-main flex flex-1 flex-col overflow-auto">
        <header
          className="sticky top-0 z-10 flex min-h-[76px] items-center justify-between border-b bg-white/90 px-6 py-4 backdrop-blur flex-shrink-0"
          style={{
            borderColor: "rgba(15, 23, 42, 0.08)",
          }}
        >
          <div>
            <p className="bq-eyebrow" style={{ display: "block" }}>Admin workspace</p>
            <h1 className="bq-page-title" style={{ display: "block", fontSize: "1.5rem" }}>{meta.label}</h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-xs font-semibold" style={{ color: "var(--bq-ink)" }}>{userRole}</p>
              <p className="text-xs" style={{ color: "var(--bq-muted)" }}>{userEmail}</p>
            </div>
            <div
              className="flex h-10 w-10 items-center justify-center rounded-xl text-sm font-bold"
              style={{ background: "var(--bq-accent-soft)", color: "var(--bq-accent)" }}
            >
              {userEmail.charAt(0).toUpperCase()}
            </div>
          </div>
        </header>
        <div className="bq-page flex-1">
          <div className="bq-page-inner">
            <p className="bq-page-description" style={{ display: "block" }}>
              {meta.description}
            </p>
            {renderTabContent()}
          </div>
        </div>
      </main>
    </div>
  );
};

export default AdminDashboard;
