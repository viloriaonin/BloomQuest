import React from "react";
import { useNavigate } from "react-router-dom";
import { API_URL } from "../../config/api";

const LogoutBtn = ({ collapsed = false }) => {
  const navigate = useNavigate();

  const handleLogout = async () => {
    if (!window.confirm("Are you sure you want to log out?")) return;
    await fetch(`${API_URL}/logout`, { method: "POST" }).catch(() => {});
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    localStorage.removeItem("email");
    localStorage.removeItem("campus_id");
    localStorage.removeItem("department_id");
    localStorage.removeItem("name");
    navigate("/");
  };

  return (
    <button
      title={collapsed ? "Log out" : undefined}
      aria-label={collapsed ? "Log out" : undefined}
      onClick={handleLogout}
      className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-left transition-all duration-150"
      style={{ color: "rgba(255,255,255,0.5)" }}
      onMouseEnter={(e) => {
        e.currentTarget.style.color = "rgba(255,255,255,0.9)";
        e.currentTarget.style.background = "rgba(255,255,255,0.08)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.color = "rgba(255,255,255,0.5)";
        e.currentTarget.style.background = "transparent";
      }}
    >
      <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
      </svg>
      <span className="text-sm font-medium tracking-wide">Log out</span>
    </button>
  );
};

export default LogoutBtn;