import React from "react";

const DashboardBtn = ({ activeTab, setActiveTab }) => {
  const isActive = activeTab === "dashboard";

  return (
    <button
      onClick={() => setActiveTab("dashboard")}
      className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-left transition-all duration-150 relative"
      style={
        isActive
          ? {
              background: "rgba(255,255,255,0.15)",
              color: "#ffffff",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.1)",
            }
          : { color: "rgba(255,255,255,0.65)", background: "transparent" }
      }
    >
      {isActive && (
        <span
          className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full"
          style={{ background: "#fff" }}
        />
      )}
      <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"
        style={{ color: isActive ? "#ffffff" : "rgba(255,255,255,0.5)" }}>
        <path d="M3 3a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V3zM3 9a1 1 0 011-1h6a1 1 0 011 1v7a1 1 0 01-1 1H4a1 1 0 01-1-1V9zM14 8a1 1 0 00-1 1v7a1 1 0 001 1h2a1 1 0 001-1V9a1 1 0 00-1-1h-2z" />
      </svg>
      <span className="text-sm font-medium tracking-wide">Dashboard</span>
    </button>
  );
};

export default DashboardBtn;