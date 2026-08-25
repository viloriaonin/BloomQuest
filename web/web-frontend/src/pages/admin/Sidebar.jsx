import React from "react";
import DashboardBtn from "./Dashboard";
import QuestionBankBtn from "./QuestionBank";
import AcademicMgmtBtn from "./AcademicMgmt";
import UserMgmtBtn from "./UserMgmt";
import ReportsBtn from "./Reports";
import LogoutBtn from "./Logout";

const Sidebar = ({ activeTab, setActiveTab }) => {
  return (
    <aside
      className="bq-admin-sidebar fixed left-0 top-0 z-40 flex h-screen w-64 flex-col"
      style={{
        background: "linear-gradient(180deg, #7B1113 0%, #8F1C2B 100%)",
        boxShadow: "8px 0 24px rgba(15,23,42,0.16)",
      }}
    >
      {/* Logo Section */}
      <div className="px-6 py-5" style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{
              background: "rgba(255,255,255,0.15)",
              backdropFilter: "blur(8px)",
              border: "1px solid rgba(255,255,255,0.2)",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.2)",
            }}
          >
            <span className="text-white font-bold text-sm tracking-wide">B</span>
          </div>
          <div>
            <h1 className="text-white font-bold text-base tracking-wide leading-none">BloomQuest</h1>
            <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.45)", letterSpacing: "0.05em" }}>
              Admin Portal
            </p>
          </div>
        </div>
      </div>

      {/* Nav Label */}
      <div className="px-6 pt-4 pb-1">
        <span
          className="text-xs font-semibold tracking-widest uppercase"
          style={{ color: "rgba(255,255,255,0.35)" }}
        >
          Navigation
        </span>
      </div>

      {/* Navigation Buttons */}
      <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto pb-4">
        <DashboardBtn activeTab={activeTab} setActiveTab={setActiveTab} />
        <QuestionBankBtn activeTab={activeTab} setActiveTab={setActiveTab} />
        <AcademicMgmtBtn activeTab={activeTab} setActiveTab={setActiveTab} />
        <UserMgmtBtn activeTab={activeTab} setActiveTab={setActiveTab} />
        <ReportsBtn activeTab={activeTab} setActiveTab={setActiveTab} />
      </nav>

      {/* Bottom Section */}
      <div
        className="px-3 py-4"
        style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}
      >
        <LogoutBtn />
      </div>
    </aside>
  );
};

export default Sidebar;