import React from "react";
import DashboardBtn from "./Dashboard";
import QuestionBankBtn from "./QuestionBank";
import AcademicMgmtBtn from "./AcademicMgmt";
import UserMgmtBtn from "./UserMgmt";
import ReportsBtn from "./Reports";
import LogoutBtn from "./Logout";
import bloomquestLogo from "../../assets/images/bloomquest-logo.png";
import { ShieldCheck } from "lucide-react";

const Sidebar = ({ activeTab, setActiveTab }) => {
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
        <QuestionBankBtn activeTab={activeTab} setActiveTab={setActiveTab} />
        <AcademicMgmtBtn activeTab={activeTab} setActiveTab={setActiveTab} />
        <UserMgmtBtn activeTab={activeTab} setActiveTab={setActiveTab} />
        <ReportsBtn activeTab={activeTab} setActiveTab={setActiveTab} />
        <button
          onClick={() => setActiveTab("governance")}
          className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-left transition-all duration-150 relative"
          style={activeTab === "governance" ? { background: "var(--bq-accent)", color: "#ffffff" } : { color: "var(--bq-muted)", background: "transparent" }}
        >
          {activeTab === "governance" && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full" style={{ background: "#fff" }} />}
          <ShieldCheck size={18} style={{ color: activeTab === "governance" ? "#ffffff" : "var(--bq-accent)" }} />
          <span className="text-sm font-medium tracking-wide">Content Governance</span>
        </button>
      </nav>

      <div className="px-3 py-4" style={{ borderTop: "1px solid rgba(15, 23, 42, 0.08)" }}>
        <LogoutBtn />
      </div>
    </aside>
  );
};

export default Sidebar;