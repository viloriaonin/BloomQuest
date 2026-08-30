import React, { useEffect, useState } from "react";
import { Menu } from "lucide-react";
import { useLocation } from "react-router-dom";

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
  const [profile, setProfile] = useState(() => ({
    email: localStorage.getItem("email") || "faculty@bloomquest.edu",
    role: localStorage.getItem("role") || "Faculty",
    displayName: localStorage.getItem("name") || "Dr. Reyes",
  }));

  const title = pageTitles[location.pathname] || "BloomQuest";
  const initials = profile.displayName.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();

  useEffect(() => {
    const syncProfile = () => {
      setProfile({
        email: localStorage.getItem("email") || "faculty@bloomquest.edu",
        role: localStorage.getItem("role") || "Faculty",
        displayName: localStorage.getItem("name") || "Dr. Reyes",
      });
    };

    window.addEventListener("profile-updated", syncProfile);
    window.addEventListener("storage", syncProfile);

    return () => {
      window.removeEventListener("profile-updated", syncProfile);
      window.removeEventListener("storage", syncProfile);
    };
  }, []);

  return (
    <div className="flex items-center justify-between border-b px-4 py-2.5" style={{ backgroundColor: bg, borderColor: border }}>
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => onToggleSidebar?.()} className="rounded-lg p-1.5 transition-colors hover:bg-white" style={{ color: textMuted }} aria-label="Toggle navigation"><Menu size={18} /></button>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em]" style={{ color: textMuted }}>Welcome, {profile.displayName}</p>
          <span className="text-[0.92rem] font-semibold" style={{ color: textPrimary }}>{title}</span>
        </div>
      </div>

      <div className="flex items-center gap-2" />
    </div>
  );
};

export default TopBar;
