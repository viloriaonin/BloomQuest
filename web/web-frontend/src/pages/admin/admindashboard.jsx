import React, { useState } from "react";
import Sidebar from "./Sidebar";

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
    description: "Configure courses, departments, and academic terms.",
  },
  users: {
    label: "User Management",
    description: "Manage student, faculty, and administrator accounts.",
  },
  reports: {
    label: "Reports",
    description: "View and export performance and activity reports.",
  },
};

const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState("dashboard");
  const meta = TAB_META[activeTab] || { label: activeTab, description: "" };

  const renderTabContent = () => {
    return null;
  };

  return (
    <div className="flex h-screen" style={{ backgroundColor: "#F7F3F3" }}>
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      <main className="flex-1 ml-64 flex flex-col overflow-auto">
        <header
          className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 flex-shrink-0"
          style={{
            backgroundColor: "rgba(247,243,243,0.9)",
            backdropFilter: "blur(12px)",
            borderBottom: "1px solid rgba(123,17,19,0.08)",
          }}
        >
          <div>
            <p
              className="text-xs font-semibold uppercase tracking-widest mb-0.5"
              style={{ color: "#B01C1C", opacity: 0.7 }}
            >
              BloomQuest Admin
            </p>
            <h1 className="text-xl font-bold leading-tight" style={{ color: "#1A0A0A" }}>
              {meta.label}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-xs font-semibold" style={{ color: "#1A0A0A" }}>Administrator</p>
              <p className="text-xs" style={{ color: "rgba(26,10,10,0.45)" }}>admin@bloomquest.edu</p>
            </div>
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm"
              style={{ background: "#7B1113", color: "#fff" }}
            >
              A
            </div>
          </div>
        </header>
        <div className="flex-1 px-8 py-6 flex flex-col">
          <div className="mb-4">
            <p className="text-sm" style={{ color: "rgba(26,10,10,0.5)" }}>
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
