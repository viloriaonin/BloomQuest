import React, { useState, useEffect } from "react";
import Sidebar from "./Sidebar";
import { QuestionBankContent } from "./QuestionBank";
import { AcademicMgmtContent } from "./AcademicMgmt";
import { UserMgmtContent } from "./UserMgmt";
import { ReportsContent } from "./Reports";

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

  useEffect(() => {
    const storedEmail = window.localStorage.getItem("email");
    const storedRole = window.localStorage.getItem("role");
    if (storedEmail) setUserEmail(storedEmail);
    if (storedRole) setUserRole(storedRole);
  }, []);

  const meta = TAB_META[activeTab] || { label: activeTab, description: "" };

  const renderDashboardContent = () => (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="rounded-3xl bg-white border border-gray-200 p-6 shadow-sm">
          <p className="text-sm font-medium text-gray-500">Total Questions</p>
          <div className="mt-4 flex items-end gap-3">
            <span className="text-4xl font-bold text-gray-900">520</span>
            <span className="rounded-full bg-green-100 px-3 py-1 text-sm font-semibold text-green-700">+12% from last month</span>
          </div>
        </div>

        <div className="rounded-3xl bg-white border border-gray-200 p-6 shadow-sm">
          <p className="text-sm font-medium text-gray-500">Total Assessments</p>
          <div className="mt-4 flex items-end gap-3">
            <span className="text-4xl font-bold text-gray-900">86</span>
            <span className="rounded-full bg-green-100 px-3 py-1 text-sm font-semibold text-green-700">+8% from last month</span>
          </div>
        </div>

        <div className="rounded-3xl bg-white border border-gray-200 p-6 shadow-sm">
          <p className="text-sm font-medium text-gray-500">Active Faculty</p>
          <div className="mt-4 flex items-end gap-3">
            <span className="text-4xl font-bold text-gray-900">24</span>
            <span className="rounded-full bg-green-100 px-3 py-1 text-sm font-semibold text-green-700">+3 this month</span>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="rounded-3xl bg-white border border-gray-200 p-6 shadow-sm">
          <h2 className="text-lg font-bold text-gray-900">Descriptive Analytics</h2>
          <p className="mt-3 text-sm text-gray-600">
            Avg Questions/Faculty: <span className="font-semibold">21.7</span>
          </p>
          <p className="mt-2 text-sm text-gray-600">Avg Assessments/Week: <span className="font-semibold">5.2</span></p>
          <p className="mt-2 text-sm text-gray-600">Most Active Department: <span className="font-semibold">CICS</span></p>
        </div>

        <div className="rounded-3xl bg-white border border-gray-200 p-6 shadow-sm">
          <h2 className="text-lg font-bold text-gray-900">Predictive Analytics</h2>
          <p className="mt-3 text-sm text-gray-600">Projected Questions (May): <span className="font-semibold">590</span></p>
          <p className="mt-2 text-sm text-green-600 font-semibold">+13.5%</p>
          <p className="mt-2 text-sm text-gray-600">Expected Assessments: <span className="font-semibold">95</span></p>
        </div>

        <div className="rounded-3xl bg-white border border-gray-200 p-6 shadow-sm">
          <h2 className="text-lg font-bold text-gray-900">Prescriptive Recommendations</h2>
          <ul className="mt-3 space-y-3 text-sm text-gray-600">
            <li>• Create level is underrepresented (<span className="font-semibold">4.8%</span>).</li>
            <li>• Encourage faculty to submit higher-order questions.</li>
            <li>• CBA department shows low activity; consider training.</li>
          </ul>
        </div>
      </div>

      <div className="rounded-3xl bg-white border border-gray-200 p-6 shadow-sm">
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
            <p className="text-sm text-gray-500">Support Vector Machine (SVM)</p>
            <p className="mt-4 text-3xl font-bold text-gray-900">92.5%</p>
          </div>
          <div className="rounded-3xl bg-gray-50 p-5 border border-gray-100">
            <p className="text-sm text-gray-500">Naïve Bayes</p>
            <p className="mt-4 text-3xl font-bold text-gray-900">88.7%</p>
          </div>
          <div className="rounded-3xl bg-gray-50 p-5 border border-gray-100">
            <p className="text-sm text-gray-500">Logistic Regression</p>
            <p className="mt-4 text-3xl font-bold text-gray-900">89.3%</p>
          </div>
        </div>
      </div>
    </div>
  );

  const renderPlaceholder = (title, description) => (
    <div className="rounded-3xl bg-white border border-gray-200 p-8 shadow-sm">
      <h2 className="text-2xl font-bold text-gray-900">{title}</h2>
      <p className="mt-3 text-sm text-gray-600">{description}</p>
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <div className="rounded-3xl bg-gray-50 p-5 border border-gray-100">
          <p className="text-sm font-semibold text-gray-700">Quick stats</p>
          <p className="mt-3 text-3xl font-bold text-gray-900">No data yet</p>
        </div>
        <div className="rounded-3xl bg-gray-50 p-5 border border-gray-100">
          <p className="text-sm font-semibold text-gray-700">Next action</p>
          <p className="mt-3 text-sm text-gray-600">Complete the section with your actual dataset for the demo.</p>
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
    <div className="flex h-screen" style={{ backgroundColor: "#F7F3F3" }}>
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      <main className="flex-1 ml-64 flex flex-col overflow-auto">
        <header
          className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 flex-shrink-0"
          style={{
            backgroundColor: "rgba(247,243,243,0.92)",
            backdropFilter: "blur(12px)",
            borderBottom: "1px solid rgba(123,17,19,0.08)",
          }}
        >
          <div>
            <p
              className="text-xs font-semibold uppercase tracking-widest mb-0.5"
              style={{ color: "#B01C1C", opacity: 0.8 }}
            >
              BloomQuest Admin
            </p>
            <h1 className="text-2xl font-bold leading-tight" style={{ color: "#1A0A0A" }}>
              {meta.label}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-xs font-semibold" style={{ color: "#1A0A0A" }}>{userRole}</p>
              <p className="text-xs" style={{ color: "rgba(26,10,10,0.45)" }}>{userEmail}</p>
            </div>
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm"
              style={{ background: "#B01C1C", color: "#fff" }}
            >
              {userEmail.charAt(0).toUpperCase()}
            </div>
          </div>
        </header>
        <div className="flex-1 px-8 py-6 flex flex-col">
          <div className="mb-4">
            <p className="text-sm" style={{ color: "rgba(26,10,10,0.55)" }}>
              {meta.description}
            </p>
          </div>
          <div className="flex-1">
            {renderTabContent()}
          </div>
        </div>
      </main>
    </div>
  );
};

export default AdminDashboard;
