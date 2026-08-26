import React, { useEffect, useRef, useState } from "react";
import { ChevronDown, HelpCircle, LogOut, Menu, Settings } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

const bg = "#F5F7FB";
const border = "rgba(15, 23, 42, 0.08)";
const textPrimary = "#0F172A";
const textMuted = "#64748B";
const accent = "#B4454A";
const accentSoft = "rgba(180, 69, 74, 0.12)";

const pageTitles = {
  "/dashboard": "Dashboard", "/input": "Input Questions", "/question-bank": "Question Bank",
  "/history": "History", "/settings": "Settings", "/assessments": "Assessments",
  "/favorites": "Downloads", "/subjects": "Subjects & Topics", "/notifications": "Notifications",
  "/imports": "Import / Export", "/recycle-bin": "Recycle Bin", "/system-status": "System Status",
  "/help": "Help & Documentation", "/admin": "Admin Dashboard", "/admin/dashboard": "Admin Dashboard",
};

const TopBar = ({ onToggleSidebar }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const menuRef = useRef(null);
  const [openMenu, setOpenMenu] = useState(null);
  const title = pageTitles[location.pathname] || "BloomQuest";
  const email = localStorage.getItem("email") || "faculty@bloomquest.edu";
  const role = localStorage.getItem("role") || "Faculty";
  const displayName = localStorage.getItem("name") || "Dr. Reyes";
  const initials = displayName.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (!menuRef.current?.contains(event.target)) setOpenMenu(null);
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  return (
    <div className="flex items-center justify-between border-b px-4 py-2.5" style={{ backgroundColor: bg, borderColor: border }}>
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => onToggleSidebar?.()} className="rounded-lg p-1.5 transition-colors hover:bg-white" style={{ color: textMuted }} aria-label="Toggle navigation"><Menu size={18} /></button>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em]" style={{ color: textMuted }}>Welcome, {displayName}</p>
          <span className="text-[0.92rem] font-semibold" style={{ color: textPrimary }}>{title}</span>
        </div>
      </div>
      <div ref={menuRef} className="relative">
        <button type="button" aria-label="Open profile menu" aria-expanded={openMenu === "profile"} onClick={() => setOpenMenu(openMenu === "profile" ? null : "profile")} className="relative flex items-center gap-1 rounded-lg p-1 transition-colors hover:bg-white">
          <div className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold" style={{ backgroundColor: accentSoft, color: accent }}>{initials || "DR"}</div>
          <span className="absolute bottom-0 right-0 h-2 w-2 rounded-full" style={{ backgroundColor: "#22C55E", border: `2px solid ${bg}` }} />
          <ChevronDown size={14} style={{ color: textMuted }} />
        </button>
        {openMenu === "profile" && <div className="absolute right-0 top-12 z-30 w-64 rounded-2xl border bg-white p-2 shadow-xl" style={{ borderColor: border }}>
          <div className="border-b px-3 pb-3 pt-2" style={{ borderColor: border }}><p className="text-sm font-semibold" style={{ color: textPrimary }}>{displayName}</p><p className="mt-1 truncate text-xs" style={{ color: textMuted }}>{email}</p><p className="mt-1 text-[10px] font-semibold uppercase tracking-wider" style={{ color: accent }}>{role}</p></div>
          <button type="button" onClick={() => { setOpenMenu(null); navigate("/settings"); }} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50"><Settings size={16} /> Profile settings</button>
          <button type="button" onClick={() => setOpenMenu(null)} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50"><HelpCircle size={16} /> Help and documentation</button>
          <button type="button" onClick={() => { localStorage.removeItem("token"); setOpenMenu(null); navigate("/"); }} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-semibold hover:bg-red-50" style={{ color: accent }}><LogOut size={16} /> Log out</button>
        </div>}
      </div>
    </div>
  );
};

export default TopBar;
