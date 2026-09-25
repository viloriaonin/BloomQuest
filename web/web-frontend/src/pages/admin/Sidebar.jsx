import React from "react";
import DashboardBtn from "./Dashboard";
import AcademicMgmtBtn from "./AcademicMgmt";
import UserMgmtBtn from "./UserMgmt";
import ReportsBtn from "./Reports";
import QuestionBankBtn from "./QuestionBank";
import LogoutBtn from "./Logout";
import bloomquestLogo from "../../assets/images/bloomquest-logo.png";
import { FolderArchive, Settings, Sun, Moon } from "lucide-react";

const Sidebar = ({ activeTab, setActiveTab, adminTheme, onThemeToggle }) => {
  return (
    <aside
      className="bq-admin-sidebar sticky left-0 top-0 z-40 flex h-screen w-56 self-start flex-col"
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
            <p className="text-xs mt-1" style={{ color: "#64748B" }}>Admin workspace</p>
          </div>
        </div>
      </div>

      <div className="px-3 pt-4 pb-2">
        <span className="px-2.5 text-[10px] font-bold tracking-[0.16em] uppercase text-slate-400">Administration</span>
      </div>

      <nav className="flex-1 px-2.5 space-y-1 overflow-y-auto pb-4">
        <DashboardBtn activeTab={activeTab} setActiveTab={setActiveTab} />
        <AcademicMgmtBtn activeTab={activeTab} setActiveTab={setActiveTab} />
        <QuestionBankBtn activeTab={activeTab} setActiveTab={setActiveTab} />
        <UserMgmtBtn activeTab={activeTab} setActiveTab={setActiveTab} />
        <ReportsBtn activeTab={activeTab} setActiveTab={setActiveTab} />
        <button
          type="button"
          onClick={() => setActiveTab("settings")}
          className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-left transition-all duration-150"
          style={activeTab === "settings" ? { background: "var(--bq-accent)", color: "#ffffff" } : { color: "var(--bq-muted)", background: "transparent" }}
        >
          <Settings size={20} className={activeTab === "settings" ? "text-white" : "text-[#C4485A]"} />
          <span className="text-sm font-medium tracking-wide">Settings</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("recycle")}
          className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-left transition-all duration-150"
          style={activeTab === "recycle" ? { background: "var(--bq-accent)", color: "#ffffff" } : { color: "var(--bq-muted)", background: "transparent" }}
        >
          <FolderArchive size={20} className={activeTab === "recycle" ? "text-white" : "text-[#C4485A]"} />
          <span className="text-sm font-medium tracking-wide">Recycle Bin</span>
        </button>
      </nav>

      <div className="px-3 py-4" style={{ borderTop: "1px solid rgba(15, 23, 42, 0.08)" }}>
        <button
          type="button"
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
        <LogoutBtn />
      </div>
    </aside>
  );
};

export default Sidebar;