import React, { useEffect, useState } from "react";
import { Menu, ShieldCheck } from "lucide-react";
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

const pageDescriptions = {
  "/dashboard": "Overview of your question pool and assessment activity.",
  "/input": "Create questions from your course materials.",
  "/question-bank": "Review, organize, and prepare your questions.",
  "/history": "Review your recent workspace activity.",
  "/settings": "Manage your workspace and account preferences.",
  "/favorites": "Retrieve files generated from your assessments.",
  "/recycle-bin": "Restore or permanently remove archived content.",
};

const TopBar = ({ onToggleSidebar }) => {
  const location = useLocation();
  const [profile, setProfile] = useState(() => ({
    email: localStorage.getItem("email") || "faculty@bloomquest.edu",
    role: localStorage.getItem("role") || "Faculty",
    displayName: localStorage.getItem("name") || "Dr. Reyes",
    department: localStorage.getItem("department") || "Department not assigned",
  }));

  const title = pageTitles[location.pathname] || "BloomQuest";
  const description = pageDescriptions[location.pathname] || "Manage your BloomQuest workspace.";
  const initials = profile.displayName.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();

  useEffect(() => {
    const syncProfile = () => {
      setProfile({
        email: localStorage.getItem("email") || "faculty@bloomquest.edu",
        role: localStorage.getItem("role") || "Faculty",
        displayName: localStorage.getItem("name") || "Dr. Reyes",
        department: localStorage.getItem("department") || "Department not assigned",
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
    <div className="flex min-h-[76px] items-center justify-between border-b px-6 py-4" style={{ backgroundColor: bg, borderColor: border }}>
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => onToggleSidebar?.()} className="rounded-lg p-1.5 transition-colors hover:bg-white" style={{ color: textMuted }} aria-label="Toggle navigation"><Menu size={18} /></button>
        <div>
          <h1 className="text-xl font-semibold" style={{ color: textPrimary }}>{title}</h1>
          <p className="mt-1 text-xs" style={{ color: textMuted }}>{description}</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="text-right max-sm:hidden"><p className="text-sm font-medium" style={{ color: textPrimary }}>{profile.displayName}</p><p className="text-[10px] uppercase tracking-wider" style={{ color: textMuted }}>{profile.email}</p><p className="text-[10px]" style={{ color: textMuted }}>{profile.department}</p></div>
        <div className="relative flex h-10 w-10 items-center justify-center rounded-full border text-sm font-bold" style={{ backgroundColor: "#fff", borderColor: accent, color: accent }}>{initials}<span className="absolute -bottom-1 -right-1 flex h-[18px] w-[18px] items-center justify-center rounded-full border-2" style={{ backgroundColor: bg, borderColor: bg, color: accent }}><ShieldCheck size={11} /></span></div>
      </div>
    </div>
  );
};

export default TopBar;
