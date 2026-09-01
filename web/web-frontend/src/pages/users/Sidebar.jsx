import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  BookOpen,
  FileClock,
  FolderArchive,
  Download,
  LayoutDashboard,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Sparkles,
} from "lucide-react";

const icons = {
  dashboard: LayoutDashboard,
  input: Sparkles,
  history: FileClock,
  bank: BookOpen,
  settings: Settings,
  favorites: Download,
  recycle: FolderArchive,
  logout: LogOut,
  collapse: PanelLeftClose,
  expand: PanelLeftOpen,
};

const Sidebar = ({ collapsed, mobileOpen, onToggleCollapsed, onNavigate }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const role = localStorage.getItem("role")?.toLowerCase();

  const menuItems = role === "admin"
    ? [{ label: "Admin Dashboard", path: "/admin", icon: icons.dashboard }]
    : [
        { label: "Dashboard", path: "/dashboard", icon: icons.dashboard },
        { label: "New Analysis", path: "/input", icon: icons.input },
        { label: "History", path: "/history", icon: icons.history },
        { label: "Question Bank", path: "/question-bank", icon: icons.bank },
        { label: "Downloads", path: "/favorites", icon: icons.favorites },
        { label: "Recycle Bin", path: "/recycle-bin", icon: icons.recycle },
        { label: "Settings", path: "/settings", icon: icons.settings },
      ];

  const badgeFor = (path) => {
    return null;
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    navigate("/");
  };

  return (
    <aside
      className={`bq-user-sidebar fixed inset-y-0 left-0 z-40 flex h-screen flex-col transition-all duration-300 md:static md:z-auto ${collapsed ? "w-20" : "w-56"} ${mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}`}
      style={{ backgroundColor: "#FCFCFD", borderRight: "1px solid rgba(15, 23, 42, 0.08)" }}
    >
      <div className="flex items-center gap-3 px-3 py-4 border-b" style={{ borderColor: "rgba(15, 23, 42, 0.08)" }}>
        <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: "rgba(180, 69, 74, 0.12)" }}>
          <img src="/bloomquest-logo.png" alt="BloomQuest" className="w-5 h-5 object-contain shrink-0" />
        </div>
        {!collapsed && (
          <span className="font-bold text-[1.05rem] tracking-wide whitespace-nowrap overflow-hidden" style={{ color: "#0F172A" }}>
            BloomQuest
          </span>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto px-2.5 py-4">
        <div className="space-y-1">
          {menuItems.map((item) => {
            const isActive = location.pathname === item.path || (item.path === "/question-bank" && location.pathname.startsWith("/question-bank/"));
            const badge = badgeFor(item.path);
            return (
              <button
                key={item.path}
                onClick={() => { navigate(item.path); onNavigate?.(); }}
                title={collapsed ? item.label : undefined}
                className={`w-full flex items-center gap-3 px-2.5 py-2 rounded-xl text-sm font-medium transition-all duration-150 ${
                  isActive ? "text-white shadow-sm" : "text-slate-700 hover:text-slate-900"
                }`}
                style={{
                  backgroundColor: isActive ? "#B4454A" : "transparent",
                  boxShadow: isActive ? "0 8px 20px rgba(180, 69, 74, 0.14)" : "none",
                }}
                onMouseOver={(e) => {
                  if (!isActive) e.currentTarget.style.backgroundColor = "rgba(180, 69, 74, 0.08)";
                }}
                onMouseOut={(e) => {
                  if (!isActive) e.currentTarget.style.backgroundColor = "transparent";
                }}
              >
                <span className="flex items-center justify-center rounded-lg w-7 h-7" style={{ backgroundColor: isActive ? "rgba(255,255,255,0.16)" : "rgba(180, 69, 74, 0.08)" }}>
                  <item.icon size={18} strokeWidth={1.8} />
                </span>
                {!collapsed && <span className="min-w-0 flex-1 truncate text-left">{item.label}</span>}
                {!collapsed && badge && <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${isActive ? "bg-white/20 text-white" : "bg-red-50 text-[#B4454A]"}`}>{badge > 99 ? "99+" : badge}</span>}
              </button>
            );
          })}
        </div>
      </nav>

      <div className="px-3 pb-5 border-t pt-3" style={{ borderColor: "rgba(15, 23, 42, 0.08)" }}>
        <button
          onClick={handleLogout}
          title={collapsed ? "Logout" : undefined}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors duration-150"
          style={{ color: "#B4454A" }}
          onMouseOver={(e) => (e.currentTarget.style.backgroundColor = "rgba(180, 69, 74, 0.08)")}
          onMouseOut={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
        >
          <span className="flex items-center justify-center rounded-lg w-8 h-8" style={{ backgroundColor: "rgba(180, 69, 74, 0.08)" }}>
            <icons.logout size={18} strokeWidth={1.8} />
          </span>
          {!collapsed && <span>Logout</span>}
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;