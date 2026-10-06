import React from "react";
import DashboardBtn from "./Dashboard";
import AcademicMgmtBtn from "./AcademicMgmt";
import UserMgmtBtn from "./UserMgmt";
import ReportsBtn from "./Reports";
import QuestionBankBtn from "./QuestionBank";
import LogoutBtn from "./Logout";
import bloomquestLogo from "../../assets/images/bloomquest-logo.png";
import { ClipboardList, FolderArchive, Settings, Sun, Moon, Sparkles, Users } from "lucide-react";

const Sidebar = ({ activeTab, setActiveTab, adminTheme, onThemeToggle, collapsed, mobileOpen, onNavigate, departmentAdmin = false }) => {
  return (
    <aside
      className={`bq-admin-sidebar fixed inset-y-0 left-0 z-40 flex h-screen shrink-0 flex-col transition-all duration-300 md:static md:z-auto ${collapsed ? "is-collapsed w-20" : "w-56"} ${mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}`}
      style={{
        backgroundColor: "#FCFCFD",
        borderRight: "1px solid rgba(15, 23, 42, 0.08)",
      }}
    >
      <div className="flex items-center gap-3 px-3 py-4 border-b" style={{ borderColor: "rgba(15, 23, 42, 0.08)" }}>
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: "rgba(180, 69, 74, 0.12)" }}
          >
            <img src={bloomquestLogo} alt="BloomQuest" className="w-5 h-5 object-contain" />
          </div>
          <div>
            <h1 className="font-bold text-[1.05rem] tracking-wide leading-none" style={{ color: "#0F172A" }}>BloomQuest</h1>
            <p className="text-xs mt-1" style={{ color: "#64748B" }}>{departmentAdmin ? "Department workspace" : "Admin workspace"}</p>
          </div>
        </div>
      </div>

      <div className="px-3 pt-4 pb-2">
        <span className="px-2.5 text-[10px] font-bold tracking-[0.16em] uppercase text-slate-400">{departmentAdmin ? "Department tools" : "Administration"}</span>
      </div>

      <nav onClick={onNavigate} className="flex-1 px-2.5 space-y-1 overflow-y-auto pb-4">
        {departmentAdmin && <DashboardBtn activeTab={activeTab} setActiveTab={setActiveTab} collapsed={collapsed} />}
        <AcademicMgmtBtn activeTab={activeTab} setActiveTab={setActiveTab} collapsed={collapsed} />
        {departmentAdmin ? (
          <>
            <button
              type="button"
              title={collapsed ? "Faculty Management" : undefined}
              aria-label={collapsed ? "Faculty Management" : undefined}
              onClick={() => setActiveTab("faculty")}
              className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-left transition-all duration-150"
              style={activeTab === "faculty" ? { background: "var(--bq-accent)", color: "#ffffff" } : { color: "var(--bq-muted)", background: "transparent" }}
            >
              <Users size={20} className={activeTab === "faculty" ? "text-white" : "text-[#C4485A]"} />
              <span className="text-sm font-medium tracking-wide">Faculty Management</span>
            </button>
            <button
              type="button"
              title={collapsed ? "Academic Requests" : undefined}
              aria-label={collapsed ? "Academic Requests" : undefined}
              onClick={() => setActiveTab("requests")}
              className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-left transition-all duration-150"
              style={activeTab === "requests" ? { background: "var(--bq-accent)", color: "#ffffff" } : { color: "var(--bq-muted)", background: "transparent" }}
            >
              <ClipboardList size={20} className={activeTab === "requests" ? "text-white" : "text-[#C4485A]"} />
              <span className="text-sm font-medium tracking-wide">Academic Requests</span>
            </button>
          </>
        ) : (
          <>
            <QuestionBankBtn activeTab={activeTab} setActiveTab={setActiveTab} collapsed={collapsed} />
            <UserMgmtBtn activeTab={activeTab} setActiveTab={setActiveTab} collapsed={collapsed} />
            <ReportsBtn activeTab={activeTab} setActiveTab={setActiveTab} collapsed={collapsed} />
          </>
        )}
        {!departmentAdmin && <button
          type="button"
          title={collapsed ? "AI Usage" : undefined}
          aria-label={collapsed ? "AI Usage" : undefined}
          onClick={() => setActiveTab("ai-usage")}
          className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-left transition-all duration-150"
          style={activeTab === "ai-usage" ? { background: "var(--bq-accent)", color: "#ffffff" } : { color: "var(--bq-muted)", background: "transparent" }}
        >
          <Sparkles size={20} className={activeTab === "ai-usage" ? "text-white" : "text-[#C4485A]"} />
          <span className="text-sm font-medium tracking-wide">AI Usage</span>
        </button>}
        <button
          type="button"
          title={collapsed ? "Settings" : undefined}
          aria-label={collapsed ? "Settings" : undefined}
          onClick={() => setActiveTab("settings")}
          className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-left transition-all duration-150"
          style={activeTab === "settings" ? { background: "var(--bq-accent)", color: "#ffffff" } : { color: "var(--bq-muted)", background: "transparent" }}
        >
          <Settings size={20} className={activeTab === "settings" ? "text-white" : "text-[#C4485A]"} />
          <span className="text-sm font-medium tracking-wide">Settings</span>
        </button>
        {!departmentAdmin && <button
          type="button"
          title={collapsed ? "Recycle Bin" : undefined}
          aria-label={collapsed ? "Recycle Bin" : undefined}
          onClick={() => setActiveTab("recycle")}
          className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-left transition-all duration-150"
          style={activeTab === "recycle" ? { background: "var(--bq-accent)", color: "#ffffff" } : { color: "var(--bq-muted)", background: "transparent" }}
        >
          <FolderArchive size={20} className={activeTab === "recycle" ? "text-white" : "text-[#C4485A]"} />
          <span className="text-sm font-medium tracking-wide">Recycle Bin</span>
        </button>}
      </nav>

      <div className="px-3 py-4" style={{ borderTop: "1px solid rgba(15, 23, 42, 0.08)" }}>
        <button
          type="button"
          title={collapsed ? "Appearance" : undefined}
          onClick={onThemeToggle}
          className="bq-admin-theme-toggle mb-2 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors"
          aria-label={`Switch to ${adminTheme === "dark" ? "light" : "dark"} mode`}
          aria-checked={adminTheme === "light"}
          role="switch"
        >
          <span className="bq-admin-theme-icon flex h-8 w-8 shrink-0 items-center justify-center rounded-lg">
            {adminTheme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
          </span>
          <span className="bq-admin-theme-copy min-w-0 flex-1">
            <span className="bq-admin-theme-label block text-xs font-semibold">Appearance</span>
          </span>
          <span className={`bq-admin-theme-switch ${adminTheme === "light" ? "is-light" : "is-dark"}`} aria-hidden="true">
            <span className="bq-admin-theme-switch-thumb" />
          </span>
        </button>
        <LogoutBtn collapsed={collapsed} />
      </div>
    </aside>
  );
};

export default Sidebar;