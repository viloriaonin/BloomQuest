import React, { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Bell,
  CheckCheck,
  ChevronDown,
  FileCheck2,
  HelpCircle,
  Info,
  LogOut,
  Menu,
  X,
  Search,
  Settings,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

const bg = "#F5F7FB";
const surface = "#FFFFFF";
const border = "rgba(15, 23, 42, 0.08)";
const textPrimary = "#0F172A";
const textMuted = "#64748B";
const accent = "#B4454A";
const accentSoft = "rgba(180, 69, 74, 0.12)";

const pageTitles = {
  "/dashboard": "Dashboard",
  "/input": "Input Questions",
  "/question-bank": "Question Bank",
  "/history": "History",
  "/settings": "Settings",
  "/assessments": "Assessments",
  "/favorites": "Favorites",
  "/subjects": "Subjects & Topics",
  "/notifications": "Notifications",
  "/imports": "Import / Export",
  "/recycle-bin": "Recycle Bin",
  "/system-status": "System Status",
  "/help": "Help & Documentation",
  "/admin": "Admin Dashboard",
  "/admin/dashboard": "Admin Dashboard",
};

const TopBar = ({ onToggleSidebar }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const menuRef = useRef(null);
  const [openMenu, setOpenMenu] = useState(null);
  const [notificationsCenterOpen, setNotificationsCenterOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [commandOpen, setCommandOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState("");
  const [readNotifications, setReadNotifications] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("bloomquest-read-notifications") || "[]");
    } catch {
      return [];
    }
  });
  const title = pageTitles[location.pathname] || "BloomQuest";
  const email = localStorage.getItem("email") || "faculty@bloomquest.edu";
  const role = localStorage.getItem("role") || "Faculty";
  const displayName = localStorage.getItem("name") || "Dr. Reyes";
  const initials = displayName.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();
  const unreadCount = notifications.filter(({ id }) => !readNotifications.includes(id)).length;
  const commands = [
    ["Dashboard", "/dashboard"], ["New Analysis", "/input"],
    ["Assessments", "/assessments"], ["Question Bank", "/question-bank"], ["Favorites", "/favorites"],
    ["Subjects & Topics", "/subjects"], ["Notifications", "/notifications"], ["Import / Export", "/imports"],
    ["System Status", "/system-status"], ["Settings", "/settings"], ["Help & Documentation", "/help"],
  ];
  const filteredCommands = commands.filter(([label]) => label.toLowerCase().includes(commandQuery.trim().toLowerCase()));

  useEffect(() => {
    const userId = localStorage.getItem("user_id");
    if (!userId) return;
    fetch(`/api/history?user_id=${encodeURIComponent(userId)}`)
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("Failed to load notifications")))
      .then((history) => {
        const items = history.slice(0, 10).map((item) => ({
          id: `activity-${item.id}`,
          title: item.action || "Workspace activity",
          detail: item.details || "An activity was recorded in your workspace.",
          time: item.date || "",
          tone: item.type === "generate" ? "success" : item.type === "error" ? "warning" : "info",
          path: item.type === "generate" ? "/question-bank" : "/history",
        }));
        if (items.length) setNotifications(items);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (!menuRef.current?.contains(event.target)) setOpenMenu(null);
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  useEffect(() => {
    const handleShortcut = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandOpen(true);
      }
      if (event.key === "Escape") {
        setCommandOpen(false);
        setCommandQuery("");
      }
    };
    document.addEventListener("keydown", handleShortcut);
    return () => document.removeEventListener("keydown", handleShortcut);
  }, []);

  const markNotificationRead = (notification) => {
    if (!readNotifications.includes(notification.id)) {
      const nextRead = [...readNotifications, notification.id];
      setReadNotifications(nextRead);
      localStorage.setItem("bloomquest-read-notifications", JSON.stringify(nextRead));
    }
    setOpenMenu(null);
    navigate(notification.path);
  };

  const markAllRead = () => {
    const allIds = notifications.map(({ id }) => id);
    setReadNotifications(allIds);
    localStorage.setItem("bloomquest-read-notifications", JSON.stringify(allIds));
  };

  const notificationIcon = (tone) => {
    if (tone === "success") return <FileCheck2 size={16} />;
    if (tone === "warning") return <AlertTriangle size={16} />;
    return <Info size={16} />;
  };

  const openNotificationsCenter = () => {
    setOpenMenu(null);
    setNotificationsCenterOpen(true);
  };

  return (
    <div
      className="flex items-center justify-between px-4 py-2.5 border-b"
      style={{ backgroundColor: bg, borderColor: border }}
    >
      <div className="flex items-center gap-3">
        <button
          onClick={() => onToggleSidebar?.()}
          className="p-1.5 rounded-lg transition-colors"
          style={{ color: textMuted }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = surface)}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
        >
          <Menu size={18} />
        </button>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em]" style={{ color: textMuted }}>
            Workspace
          </p>
          <span className="text-[0.92rem] font-semibold" style={{ color: textPrimary }}>
            {title}
          </span>
        </div>
      </div>

      <div ref={menuRef} className="relative flex items-center gap-2">
        <button
          type="button"
          aria-label="Search question bank"
          title="Open command search"
          onClick={() => setCommandOpen(true)}
          className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-white"
          style={{ color: textMuted }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = surface)}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
        >
          <Search size={17} />
          <span className="hidden text-xs font-semibold sm:inline">Search</span>
        </button>

        <button
          type="button"
          aria-label="Open notifications"
          aria-expanded={openMenu === "notifications"}
          onClick={() => setOpenMenu(openMenu === "notifications" ? null : "notifications")}
          className="relative p-1.5 rounded-full transition-colors"
          style={{ color: textMuted }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = surface)}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
        >
          <Bell size={17} />
          <span
            className="absolute -top-0.5 -right-0.5 flex items-center justify-center text-[9px] font-bold rounded-full"
            style={{ width: 15, height: 15, backgroundColor: "#F43F5E", color: "#fff" }}
          >
            {unreadCount}
          </span>
        </button>

        {openMenu === "notifications" && (
          <div className="absolute right-12 top-12 z-30 w-80 overflow-hidden rounded-2xl border bg-white shadow-xl" style={{ borderColor: border }}>
            <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: border }}>
              <div>
                <h2 className="text-sm font-semibold" style={{ color: textPrimary }}>Notifications</h2>
                <p className="mt-0.5 text-xs" style={{ color: textMuted }}>{unreadCount} unread</p>
              </div>
              <button type="button" onClick={markAllRead} className="inline-flex items-center gap-1 text-xs font-semibold" style={{ color: accent }}>
                <CheckCheck size={14} /> Mark all read
              </button>
            </div>
            <div className="max-h-80 overflow-y-auto">
              {notifications.map((notification) => {
                const isRead = readNotifications.includes(notification.id);
                return (
                  <button
                    type="button"
                    key={notification.id}
                    onClick={() => markNotificationRead(notification)}
                    className="flex w-full gap-3 border-b px-4 py-3 text-left transition-colors hover:bg-slate-50"
                    style={{ borderColor: border, backgroundColor: isRead ? "#FFFFFF" : "#FCFAFF" }}
                  >
                    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full" style={{ color: notification.tone === "warning" ? "#D97706" : accent, backgroundColor: notification.tone === "warning" ? "#FFF7E8" : accentSoft }}>
                      {notificationIcon(notification.tone)}
                    </span>
                    <span className="min-w-0">
                      <span className="flex items-center gap-2 text-xs font-semibold" style={{ color: textPrimary }}>
                        {notification.title}
                        {!isRead && <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: accent }} />}
                      </span>
                      <span className="mt-1 block text-xs leading-5" style={{ color: textMuted }}>{notification.detail}</span>
                      <span className="mt-1 block text-[10px]" style={{ color: textMuted }}>{notification.time}</span>
                    </span>
                  </button>
                );
              })}
            </div>
            <button type="button" onClick={openNotificationsCenter} className="w-full px-4 py-3 text-center text-xs font-semibold" style={{ color: accent }}>
              View all notifications
            </button>
          </div>
        )}

        <button
          type="button"
          aria-label="Open profile menu"
          aria-expanded={openMenu === "profile"}
          onClick={() => setOpenMenu(openMenu === "profile" ? null : "profile")}
          className="relative ml-1 flex items-center gap-1 rounded-lg p-1 transition-colors hover:bg-white"
        >
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
            style={{ backgroundColor: accentSoft, color: accent }}
          >
            {initials || "DR"}
          </div>
          <span
            className="absolute bottom-0 right-0 w-2 h-2 rounded-full"
            style={{ backgroundColor: "#22C55E", border: `2px solid ${bg}` }}
          />
          <ChevronDown size={14} style={{ color: textMuted }} />
        </button>

        {openMenu === "profile" && (
          <div className="absolute right-0 top-12 z-30 w-64 rounded-2xl border bg-white p-2 shadow-xl" style={{ borderColor: border }}>
            <div className="border-b px-3 pb-3 pt-2" style={{ borderColor: border }}>
              <p className="text-sm font-semibold" style={{ color: textPrimary }}>{displayName}</p>
              <p className="mt-1 truncate text-xs" style={{ color: textMuted }}>{email}</p>
              <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider" style={{ color: accent }}>{role}</p>
            </div>
            <button type="button" onClick={() => { setOpenMenu(null); navigate("/settings"); }} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50">
              <Settings size={16} /> Profile settings
            </button>
            <button type="button" onClick={() => setOpenMenu(null)} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50">
              <HelpCircle size={16} /> Help and documentation
            </button>
            <button type="button" onClick={() => { localStorage.removeItem("token"); setOpenMenu(null); navigate("/"); }} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-semibold hover:bg-red-50" style={{ color: accent }}>
              <LogOut size={16} /> Log out
            </button>
          </div>
        )}
      </div>

      {notificationsCenterOpen && (
        <div
          className="bq-modal-overlay fixed inset-0 z-50 flex items-center justify-center p-4"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setNotificationsCenterOpen(false);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="notifications-center-title"
            className="bq-panel flex max-h-[min(680px,calc(100vh-2rem))] w-full max-w-2xl flex-col overflow-hidden"
          >
            <header className="flex items-start justify-between border-b px-5 py-4 sm:px-6" style={{ borderColor: border }}>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: accent }}>Workspace updates</p>
                <h2 id="notifications-center-title" className="mt-1 text-xl font-bold" style={{ color: textPrimary }}>All notifications</h2>
                <p className="mt-1 text-sm" style={{ color: textMuted }}>{unreadCount} unread notification{unreadCount === 1 ? "" : "s"}</p>
              </div>
              <button
                type="button"
                aria-label="Close all notifications"
                title="Close"
                onClick={() => setNotificationsCenterOpen(false)}
                className="rounded-lg p-2 transition-colors hover:bg-slate-100"
                style={{ color: textMuted }}
              >
                <X size={18} />
              </button>
            </header>

            <div className="flex items-center justify-between border-b px-5 py-3 sm:px-6" style={{ borderColor: border, backgroundColor: "#FCFAFF" }}>
              <span className="text-xs font-semibold" style={{ color: textMuted }}>Recent activity and system alerts</span>
              <button type="button" onClick={markAllRead} className="inline-flex items-center gap-1 text-xs font-semibold" style={{ color: accent }}>
                <CheckCheck size={14} /> Mark all read
              </button>
            </div>

            <div className="overflow-y-auto">
              {notifications.map((notification) => {
                const isRead = readNotifications.includes(notification.id);
                return (
                  <button
                    type="button"
                    key={`center-${notification.id}`}
                    onClick={() => {
                      setNotificationsCenterOpen(false);
                      markNotificationRead(notification);
                    }}
                    className="flex w-full gap-4 border-b px-5 py-5 text-left transition-colors hover:bg-slate-50 sm:px-6"
                    style={{ borderColor: border, backgroundColor: isRead ? "#FFFFFF" : "#FFF9F8" }}
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full" style={{ color: notification.tone === "warning" ? "#D97706" : accent, backgroundColor: notification.tone === "warning" ? "#FFF7E8" : accentSoft }}>
                      {notificationIcon(notification.tone)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2 text-sm font-bold" style={{ color: textPrimary }}>
                        {notification.title}
                        {!isRead && <span className="h-2 w-2 rounded-full" style={{ backgroundColor: accent }} />}
                      </span>
                      <span className="mt-1 block text-sm leading-6" style={{ color: textMuted }}>{notification.detail}</span>
                      <span className="mt-2 block text-xs font-semibold" style={{ color: textMuted }}>{notification.time}</span>
                    </span>
                  </button>
                );
              })}
            </div>

            <footer className="flex items-center justify-between gap-3 border-t px-5 py-4 sm:px-6" style={{ borderColor: border }}>
              <span className="text-xs" style={{ color: textMuted }}>Showing all available workspace notifications</span>
              <button type="button" onClick={() => setNotificationsCenterOpen(false)} className="bq-secondary-button min-h-9 px-3 py-1.5 text-xs">Done</button>
            </footer>
          </section>
        </div>
      )}

      {commandOpen && (
        <div className="bq-modal-overlay fixed inset-0 z-[60] flex items-start justify-center p-4 pt-[12vh]" onMouseDown={(event) => { if (event.target === event.currentTarget) { setCommandOpen(false); setCommandQuery(""); } }}>
          <section role="dialog" aria-modal="true" aria-labelledby="command-search-title" className="bq-panel w-full max-w-xl overflow-hidden">
            <div className="border-b p-4" style={{ borderColor: border }}>
              <p id="command-search-title" className="mb-2 text-xs font-bold uppercase tracking-[0.18em]" style={{ color: accent }}>Quick navigation</p>
              <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input autoFocus value={commandQuery} onChange={(event) => setCommandQuery(event.target.value)} placeholder="Search pages and actions" className="w-full rounded-lg border border-slate-200 py-3 pl-9 pr-3 text-sm outline-none focus:border-[#B4454A]" /></div>
            </div>
            <div className="max-h-80 overflow-y-auto p-2">{filteredCommands.length ? filteredCommands.map(([label, path]) => <button type="button" key={path} onClick={() => { navigate(path); setCommandOpen(false); setCommandQuery(""); }} className="flex w-full items-center justify-between rounded-lg px-3 py-3 text-left text-sm font-semibold text-slate-700 hover:bg-red-50 hover:text-[#B4454A]"><span>{label}</span><span className="text-xs text-slate-400">{path}</span></button>) : <p className="p-5 text-center text-sm text-slate-500">No matching destination.</p>}</div>
            <div className="border-t px-4 py-3 text-xs text-slate-400" style={{ borderColor: border }}>Press Esc to close</div>
          </section>
        </div>
      )}
    </div>
  );
};

export default TopBar;
