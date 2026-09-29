import React, { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { Bar, Doughnut } from "react-chartjs-2";
import { Activity, BookOpen, Building2, GraduationCap, LayoutDashboard, Menu, Moon, Search, ShieldCheck, Sparkles, Sun, Users } from "lucide-react";
import { ArcElement, BarElement, CategoryScale, Chart as ChartJS, Legend, LinearScale, Tooltip } from "chart.js";
import LogoutBtn from "./Logout";
import { AcademicMgmtContent } from "./AcademicMgmt";
import { QuestionBankContent } from "./QuestionBank";
import { ReportsContent } from "./Reports";

ChartJS.register(ArcElement, BarElement, CategoryScale, Legend, LinearScale, Tooltip);

const API = "/api";
const NAV_ITEMS = [
  ["dashboard", "Dashboard", LayoutDashboard],
  ["campuses", "Campus Management", Building2],
  ["admins", "Admin Management", ShieldCheck],
  ["users", "User Management", Users],
  ["academic", "Academic Management", GraduationCap],
  ["questions", "Question Bank", BookOpen],
  ["ai_usage", "AI Usage", Sparkles],
  ["activity", "Activity Logs", Activity],
];

async function requestJson(url, options = {}) {
  const response = await fetch(`${API}${url}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
      ...options.headers,
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.detail || "The request could not be completed.");
  return payload;
}

const formatNumber = (value) => Number(value || 0).toLocaleString();

const SuperAdminDashboard = () => {
  const location = useLocation();
  const [activeTab, setActiveTab] = useState("dashboard");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem("bloomquest-admin-theme") || "dark");
  const [overview, setOverview] = useState(null);
  const [dashboardCampusFilter, setDashboardCampusFilter] = useState("");
  const [campuses, setCampuses] = useState([]);
  const [campusForm, setCampusForm] = useState({ name: "", code: "" });
  const [editingCampus, setEditingCampus] = useState(null);
  const [admins, setAdmins] = useState([]);
  const [editingAdmin, setEditingAdmin] = useState(null);
  const [adminForm, setAdminForm] = useState({ name: "", email: "", password: "", campus_id: "" });
  const [users, setUsers] = useState([]);
  const [userFilters, setUserFilters] = useState({ campus_id: "", role: "", status_filter: "active", search: "" });
  const [aiUsage, setAIUsage] = useState(null);
  const [aiUsageFilters, setAIUsageFilters] = useState({ campus_id: "", date_from: "", date_to: "", model_name: "", request_status: "" });
  const [aiUsageLoading, setAIUsageLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const toggleSidebar = () => {
    setSidebarCollapsed((previous) => !previous);
    setMobileSidebarOpen((previous) => !previous);
  };

  useEffect(() => {
    if (location.pathname.startsWith("/super-admin/academic")) setActiveTab("academic");
    else if (location.pathname.startsWith("/super-admin/questions")) setActiveTab("questions");
  }, [location.pathname]);

  const loadOverview = async () => {
    const [summary, campusRows] = await Promise.all([
      requestJson("/super-admin/overview"),
      requestJson("/super-admin/campuses"),
    ]);
    setOverview(summary);
    setCampuses(campusRows);
  };

  useEffect(() => {
    let active = true;
    requestJson("/super-admin/overview").then((summary) => {
      if (active) setOverview(summary);
    }).catch((reason) => {
      if (active) setError(reason.message);
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (activeTab !== "campuses" && activeTab !== "admins") return;
    loadOverview().catch((reason) => setError(reason.message));
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== "admins") return;
    requestJson("/super-admin/admins").then(setAdmins).catch((reason) => setError(reason.message));
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== "users") return;
    const params = new URLSearchParams();
    Object.entries(userFilters).forEach(([key, value]) => value && params.set(key, value));
    requestJson(`/super-admin/users?${params}`).then(setUsers).catch((reason) => setError(reason.message));
  }, [activeTab, userFilters]);

  useEffect(() => {
    if (activeTab !== "ai_usage") return;
    let active = true;
    const params = new URLSearchParams();
    Object.entries(aiUsageFilters).forEach(([key, value]) => value && params.set(key, value));
    setAIUsageLoading(true);
    requestJson(`/super-admin/ai-usage?${params}`).then((data) => {
      if (active) setAIUsage(data);
    }).catch((reason) => {
      if (active) setError(reason.message);
    }).finally(() => {
      if (active) setAIUsageLoading(false);
    });
    return () => { active = false; };
  }, [activeTab, aiUsageFilters]);

  const switchTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("bloomquest-admin-theme", next);
    localStorage.setItem("bloomquest-theme", next);
    window.dispatchEvent(new CustomEvent("theme-updated", { detail: { theme: next } }));
  };

  const saveCampus = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await requestJson(`/campuses${editingCampus ? `/${editingCampus.id}` : ""}`, {
        method: editingCampus ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(campusForm),
      });
      setCampusForm({ name: "", code: "" });
      setEditingCampus(null);
      setNotice(editingCampus ? "Campus updated." : "Campus created.");
      await loadOverview();
    } catch (reason) {
      setError(reason.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleCampus = async (campus) => {
    setError("");
    try {
      await requestJson(`/campuses/${campus.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !campus.is_active }),
      });
      await loadOverview();
    } catch (reason) {
      setError(reason.message);
    }
  };

  const createCampusAdmin = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      if (editingAdmin) {
        await requestJson(`/super-admin/admins/${editingAdmin.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: adminForm.name,
            email: adminForm.email,
            campus_id: Number(adminForm.campus_id),
            is_active: editingAdmin.is_active,
          }),
        });
      } else {
        await requestJson("/super-admin/admins", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...adminForm, campus_id: Number(adminForm.campus_id) }),
        });
      }
      const wasEditing = Boolean(editingAdmin);
      setEditingAdmin(null);
      setAdminForm({ name: "", email: "", password: "", campus_id: "" });
      setNotice(wasEditing ? "Campus Admin updated." : "Campus Admin account created.");
      setAdmins(await requestJson("/super-admin/admins"));
      await loadOverview();
    } catch (reason) {
      setError(reason.message);
    } finally {
      setSaving(false);
    }
  };

  const updateCampusAdmin = async (admin, updates) => {
    setError("");
    try {
      await requestJson(`/super-admin/admins/${admin.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campus_id: Number(updates.campus_id || admin.campus_id), is_active: updates.is_active ?? admin.is_active }),
      });
      setAdmins(await requestJson("/super-admin/admins"));
      await loadOverview();
    } catch (reason) {
      setError(reason.message);
    }
  };

  const stats = overview?.totals || {};
  const selectedDashboardCampus = overview?.campuses?.find(
    (campus) => String(campus.id) === dashboardCampusFilter,
  );
  const dashboardCampusRows = selectedDashboardCampus
    ? [selectedDashboardCampus]
    : overview?.campuses || [];
  const dashboardStats = selectedDashboardCampus
    ? {
        campuses: 1,
        active_campuses: selectedDashboardCampus.is_active ? 1 : 0,
        departments: selectedDashboardCampus.departments,
        programs: selectedDashboardCampus.programs,
        subjects: selectedDashboardCampus.subjects,
        faculty: selectedDashboardCampus.faculty,
        users: selectedDashboardCampus.users,
        questions: selectedDashboardCampus.questions,
      }
    : stats;
  const metadata = NAV_ITEMS.find(([id]) => id === activeTab);

  const renderDashboard = () => (
    <div className="space-y-4">
      <section className="bq-admin-panel flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2>Dashboard filters</h2>
          <p className="bq-admin-muted mt-1 text-sm">Scope summary cards and analytics by campus.</p>
        </div>
        <label className="min-w-52 text-sm font-medium">
          Campus
          <select
            aria-label="Filter dashboard by campus"
            value={dashboardCampusFilter}
            onChange={(event) => setDashboardCampusFilter(event.target.value)}
            className="bq-field mt-1 w-full"
          >
            <option value="">All campuses</option>
            {(overview?.campuses || []).map((campus) => (
              <option key={campus.id} value={campus.id}>{campus.name}</option>
            ))}
          </select>
        </label>
      </section>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Campuses", value: dashboardStats.campuses, detail: selectedDashboardCampus ? "Selected campus" : `${formatNumber(stats.active_campuses)} active`, icon: Building2, color: "#C4485A" },
          { label: "Departments", value: dashboardStats.departments, detail: "Academic departments", icon: GraduationCap, color: "#E0A458" },
          { label: "Programs", value: dashboardStats.programs, detail: "Registered programs", icon: BookOpen, color: "#378A87" },
          { label: "Subjects", value: dashboardStats.subjects, detail: "Active subjects", icon: BookOpen, color: "#5587B8" },
          { label: "Faculty", value: dashboardStats.faculty, detail: "Active faculty accounts", icon: Users, color: "#758B54" },
          { label: "Users", value: dashboardStats.users, detail: "Active accounts", icon: Users, color: "#8C6AA8" },
          { label: "Questions", value: dashboardStats.questions, detail: "Campus-attributed questions", icon: Activity, color: "#9B7465" },
        ].map(({ label, value, detail, icon: Icon, color }) => (
          <section key={label} className="bq-admin-stat flex min-h-32 flex-col justify-between">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="bq-admin-stat-label">{label}</div>
                <div className="mt-2 text-3xl font-semibold leading-none" style={{ color: "var(--admin-text, #ecedef)" }}>
                  {loading ? "..." : formatNumber(value)}
                </div>
              </div>
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: `${color}20`, color }}>
                <Icon size={19} />
              </span>
            </div>
            <p className="bq-admin-muted mt-4 text-xs">{detail}</p>
          </section>
        ))}
      </div>
      <section className="bq-admin-panel">
        <div className="flex items-center justify-between gap-3"><div><h2>{selectedDashboardCampus ? `${selectedDashboardCampus.name} Overview` : "Campus Overview"}</h2><p className="bq-admin-muted mt-1">Counts reflect records currently stored in BloomQuest.</p></div><span className="bq-admin-mono">{formatNumber(dashboardStats.active_campuses)} ACTIVE</span></div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[620px] text-left text-sm"><thead><tr className="border-b border-slate-700"><th className="py-2 pr-3">Campus</th><th className="py-2 pr-3">Departments</th><th className="py-2 pr-3">Programs</th><th className="py-2 pr-3">Faculty</th><th className="py-2">Questions</th></tr></thead>
            <tbody>{dashboardCampusRows.map((campus) => <tr key={campus.id} className="border-b border-slate-800"><td className="py-2 pr-3">{campus.name}</td><td className="py-2 pr-3">{formatNumber(campus.departments)}</td><td className="py-2 pr-3">{formatNumber(campus.programs)}</td><td className="py-2 pr-3">{formatNumber(campus.faculty)}</td><td className="py-2">{formatNumber(campus.questions)}</td></tr>)}</tbody>
          </table>
          {!loading && !dashboardCampusRows.length && <p className="bq-admin-muted py-4">No campuses have been added.</p>}
        </div>
      </section>
      {renderAnalytics()}
    </div>
  );

  const renderCampuses = () => (
    <div className="space-y-4">
      <form onSubmit={saveCampus} className="bq-admin-panel grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
        <label className="text-sm">Campus name<input required maxLength={255} value={campusForm.name} onChange={(event) => setCampusForm({ ...campusForm, name: event.target.value })} className="bq-field mt-1 w-full" /></label>
        <label className="text-sm">Campus code<input maxLength={255} value={campusForm.code} onChange={(event) => setCampusForm({ ...campusForm, code: event.target.value })} className="bq-field mt-1 w-full" /></label>
        <div className="flex gap-2"><button disabled={saving} className="bq-admin-action">{editingCampus ? "Save changes" : "Add campus"}</button>{editingCampus && <button type="button" className="bq-admin-action" onClick={() => { setEditingCampus(null); setCampusForm({ name: "", code: "" }); }}>Cancel</button>}</div>
      </form>
      <section className="bq-admin-panel overflow-x-auto"><table className="w-full min-w-[540px] text-left text-sm"><thead><tr className="border-b border-slate-700"><th className="py-2 pr-3">Campus</th><th className="py-2 pr-3">Code</th><th className="py-2 pr-3">Status</th><th className="py-2">Actions</th></tr></thead><tbody>
        {campuses.map((campus) => <tr key={campus.id} className="border-b border-slate-800"><td className="py-3 pr-3 font-medium">{campus.name}</td><td className="py-3 pr-3">{campus.code || "-"}</td><td className="py-3 pr-3"><span className="bq-admin-tag">{campus.is_active ? "Active" : "Inactive"}</span></td><td className="py-3"><div className="flex gap-2"><button type="button" className="bq-admin-action" onClick={() => { setEditingCampus(campus); setCampusForm({ name: campus.name, code: campus.code || "" }); }}>Edit</button><button type="button" className="bq-admin-action" onClick={() => toggleCampus(campus)}>{campus.is_active ? "Deactivate" : "Activate"}</button></div></td></tr>)}
      </tbody></table>{!campuses.length && <p className="bq-admin-muted py-5">No campuses found.</p>}</section>
    </div>
  );

  const renderAdmins = () => (
    <div className="space-y-4">
      <form onSubmit={createCampusAdmin} className="bq-admin-panel grid gap-3 md:grid-cols-2 xl:grid-cols-5 xl:items-end">
        <label className="text-sm">Name<input required value={adminForm.name} onChange={(event) => setAdminForm({ ...adminForm, name: event.target.value })} className="bq-field mt-1 w-full" /></label>
        <label className="text-sm">Email<input required type="email" value={adminForm.email} onChange={(event) => setAdminForm({ ...adminForm, email: event.target.value })} className="bq-field mt-1 w-full" /></label>
        {!editingAdmin && <label className="text-sm">Initial password<input required minLength={8} type="password" value={adminForm.password} onChange={(event) => setAdminForm({ ...adminForm, password: event.target.value })} className="bq-field mt-1 w-full" /></label>}
        <label className="text-sm">Campus<select required value={adminForm.campus_id} onChange={(event) => setAdminForm({ ...adminForm, campus_id: event.target.value })} className="bq-field mt-1 w-full"><option value="">Select campus</option>{campuses.filter((campus) => campus.is_active).map((campus) => <option key={campus.id} value={campus.id}>{campus.name}</option>)}</select></label>
        <div className="flex gap-2"><button disabled={saving} className="bq-admin-action">{editingAdmin ? "Save Changes" : "Create Campus Admin"}</button>{editingAdmin && <button type="button" className="bq-admin-action" onClick={() => { setEditingAdmin(null); setAdminForm({ name: "", email: "", password: "", campus_id: "" }); }}>Cancel</button>}</div>
      </form>
      <section className="bq-admin-panel overflow-x-auto"><table className="w-full min-w-[680px] text-left text-sm"><thead><tr className="border-b border-slate-700"><th className="py-2 pr-3">Administrator</th><th className="py-2 pr-3">Email</th><th className="py-2 pr-3">Campus</th><th className="py-2 pr-3">Status</th><th className="py-2">Action</th></tr></thead><tbody>
        {admins.map((admin) => <tr key={admin.id} className="border-b border-slate-800"><td className="py-3 pr-3">{admin.name}</td><td className="py-3 pr-3">{admin.email}</td><td className="py-3 pr-3"><select aria-label={`Campus for ${admin.name}`} value={admin.campus_id || ""} onChange={(event) => updateCampusAdmin(admin, { campus_id: event.target.value })} className="bq-field"><option value="">Select campus</option>{campuses.map((campus) => <option key={campus.id} value={campus.id}>{campus.name}</option>)}</select></td><td className="py-3 pr-3">{admin.is_active ? "Active" : "Inactive"}</td><td className="py-3"><div className="flex gap-2"><button type="button" className="bq-admin-action" onClick={() => { setEditingAdmin(admin); setAdminForm({ name: admin.name, email: admin.email, password: "", campus_id: String(admin.campus_id || "") }); }}>Edit</button><button type="button" className="bq-admin-action" onClick={() => updateCampusAdmin(admin, { is_active: !admin.is_active })}>{admin.is_active ? "Deactivate" : "Activate"}</button></div></td></tr>)}
      </tbody></table>{!admins.length && <p className="bq-admin-muted py-5">No Campus Admin accounts found.</p>}</section>
    </div>
  );

  const renderUsers = () => (
    <section className="bq-admin-panel space-y-4">
      <div className="grid gap-2 md:grid-cols-4">
        <label className="relative"><Search size={15} className="absolute left-3 top-3 text-slate-400" /><input aria-label="Search users" placeholder="Search name or email" value={userFilters.search} onChange={(event) => setUserFilters({ ...userFilters, search: event.target.value })} className="bq-field w-full pl-9" /></label>
        <select aria-label="Filter by campus" value={userFilters.campus_id} onChange={(event) => setUserFilters({ ...userFilters, campus_id: event.target.value })} className="bq-field"><option value="">All campuses</option>{campuses.map((campus) => <option key={campus.id} value={campus.id}>{campus.name}</option>)}</select>
        <select aria-label="Filter by role" value={userFilters.role} onChange={(event) => setUserFilters({ ...userFilters, role: event.target.value })} className="bq-field"><option value="">All roles</option><option value="campus_admin">Campus Admin</option><option value="faculty">Faculty</option></select>
        <select aria-label="Filter by status" value={userFilters.status_filter} onChange={(event) => setUserFilters({ ...userFilters, status_filter: event.target.value })} className="bq-field"><option value="active">Active</option><option value="archived">Inactive</option><option value="">All statuses</option></select>
      </div>
      <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead><tr className="border-b border-slate-700"><th className="py-2 pr-3">Name</th><th className="py-2 pr-3">Role</th><th className="py-2 pr-3">Campus</th><th className="py-2 pr-3">Department / Program</th><th className="py-2">Status</th></tr></thead><tbody>
        {users.map((user) => <tr key={user.id} className="border-b border-slate-800"><td className="py-3 pr-3">{user.name}<span className="bq-admin-muted block text-xs">{user.email}</span></td><td className="py-3 pr-3">{user.role}</td><td className="py-3 pr-3">{user.campus || "Unassigned"}</td><td className="py-3 pr-3">{[user.department, user.program].filter(Boolean).join(" / ") || "-"}</td><td className="py-3">{user.is_active ? "Active" : "Inactive"}</td></tr>)}
      </tbody></table>{!users.length && <p className="bq-admin-muted py-5">No users match these filters.</p>}</div>
    </section>
  );

  const renderAIUsage = () => {
    const totals = aiUsage?.totals || {};
    const campusRows = aiUsage?.requests_by_campus || [];
    const monthRows = aiUsage?.requests_by_month || [];
    const modelRows = aiUsage?.model_usage || [];
    const userRows = aiUsage?.requests_by_user || [];
    const errorRows = aiUsage?.error_types || [];
    const tokenUsage = aiUsage?.token_usage;
    const modelOptions = [...new Set([
      ...(aiUsage?.available_models || []),
      ...(aiUsageFilters.model_name ? [aiUsageFilters.model_name] : []),
    ])];
    const updateFilter = (key, value) => setAIUsageFilters((current) => ({ ...current, [key]: value }));
    const chartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: "bottom" } },
      scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
    };

    return (
      <div className="space-y-4">
        <section className="bq-admin-panel">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><h2>AI usage filters</h2><p className="bq-admin-muted mt-1 text-sm">Filter university-wide Gemini activity.</p></div>
            <button type="button" className="bq-admin-action" onClick={() => setAIUsageFilters({ campus_id: "", date_from: "", date_to: "", model_name: "", request_status: "" })}>Clear filters</button>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <label className="text-sm">Campus<select aria-label="Filter AI usage by campus" value={aiUsageFilters.campus_id} onChange={(event) => updateFilter("campus_id", event.target.value)} className="bq-field mt-1 w-full"><option value="">All campuses</option>{(overview?.campuses || []).map((campus) => <option key={campus.id} value={campus.id}>{campus.name}</option>)}</select></label>
            <label className="text-sm">From<input aria-label="AI usage start date" type="date" value={aiUsageFilters.date_from} onChange={(event) => updateFilter("date_from", event.target.value)} className="bq-field mt-1 w-full" /></label>
            <label className="text-sm">To<input aria-label="AI usage end date" type="date" value={aiUsageFilters.date_to} onChange={(event) => updateFilter("date_to", event.target.value)} className="bq-field mt-1 w-full" /></label>
            <label className="text-sm">Gemini model<select aria-label="Filter AI usage by Gemini model" value={aiUsageFilters.model_name} onChange={(event) => updateFilter("model_name", event.target.value)} className="bq-field mt-1 w-full"><option value="">All models</option>{modelOptions.map((model) => <option key={model} value={model}>{model}</option>)}</select></label>
            <label className="text-sm">Status<select aria-label="Filter AI usage by status" value={aiUsageFilters.request_status} onChange={(event) => updateFilter("request_status", event.target.value)} className="bq-field mt-1 w-full"><option value="">All statuses</option><option value="success">Successful</option><option value="failed">Failed</option><option value="rate_limited">Rate limited</option><option value="in_progress">In progress</option></select></label>
          </div>
        </section>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "AI Requests", value: totals.total_ai_requests, color: "#C4485A" },
            { label: "Generation Requests", value: totals.generation_requests, color: "#5587B8" },
            { label: "Questions Generated", value: totals.total_questions_generated, color: "#378A87" },
            { label: "Successful", value: totals.successful_requests, color: "#758B54" },
            { label: "Failed", value: totals.failed_requests, color: "#E0A458" },
            { label: "Rate-Limit Events", value: totals.rate_limit_events, color: "#9B7465" },
            { label: "Gemini API Calls", value: totals.gemini_api_calls, color: "#8C6AA8" },
          ].map(({ label, value, color }) => (
            <section key={label} className="bq-admin-stat flex min-h-28 flex-col justify-between">
              <div className="bq-admin-stat-label">{label}</div>
              <div className="mt-3 text-3xl font-semibold leading-none" style={{ color: "var(--admin-text, #ecedef)" }}>{aiUsageLoading ? "..." : formatNumber(value)}</div>
              <span className="mt-3 h-1 w-12 rounded-full" style={{ backgroundColor: color }} />
            </section>
          ))}
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <section className="bq-admin-panel"><h2>Requests and questions by campus</h2><div className="mt-4 h-72">{campusRows.length ? <Bar data={{ labels: campusRows.map((row) => row.campus), datasets: [{ label: "Requests", data: campusRows.map((row) => row.requests), backgroundColor: "#C4485A", borderRadius: 3 }, { label: "Questions", data: campusRows.map((row) => row.questions), backgroundColor: "#378A87", borderRadius: 3 }] }} options={chartOptions} /> : <p className="bq-admin-muted pt-8">No AI usage recorded for these filters.</p>}</div></section>
          <section className="bq-admin-panel"><h2>Requests by month</h2><div className="mt-4 h-72">{monthRows.length ? <Bar data={{ labels: monthRows.map((row) => row.month), datasets: [{ label: "Requests", data: monthRows.map((row) => row.requests), backgroundColor: "#5587B8", borderRadius: 3 }, { label: "Questions", data: monthRows.map((row) => row.questions), backgroundColor: "#E0A458", borderRadius: 3 }] }} options={chartOptions} /> : <p className="bq-admin-muted pt-8">No monthly activity in this range.</p>}</div></section>
        </div>

        <section className="bq-admin-panel">
          <div className="flex flex-wrap items-center justify-between gap-3"><div><h2>Requests by user</h2><p className="bq-admin-muted mt-1 text-sm">Faculty, administrators, and other recorded requesters.</p></div><span className="bq-admin-mono">{formatNumber(userRows.length)} USERS</span></div>
          <div className="mt-4 max-h-[32rem] overflow-auto"><table className="w-full min-w-[720px] text-left text-sm"><thead className="sticky top-0 bq-admin-panel"><tr className="border-b border-slate-700"><th className="py-2 pr-3">User</th><th className="py-2 pr-3">Role</th><th className="py-2 pr-3">Requests</th><th className="py-2">Questions</th></tr></thead><tbody>{userRows.map((row) => <tr key={row.user_id} className="border-b border-slate-800"><td className="py-3 pr-3">{row.name}<span className="bq-admin-muted block text-xs">{row.email}</span></td><td className="py-3 pr-3">{row.role || "-"}</td><td className="py-3 pr-3">{formatNumber(row.requests)}</td><td className="py-3">{formatNumber(row.questions)}</td></tr>)}</tbody></table>{!userRows.length && <p className="bq-admin-muted py-5">No requesters match these filters.</p>}</div>
        </section>

        <div className="grid gap-4 xl:grid-cols-2">
          <section className="bq-admin-panel"><h2>Gemini model usage</h2><div className="mt-4 overflow-x-auto"><table className="w-full min-w-[520px] text-left text-sm"><thead><tr className="border-b border-slate-700"><th className="py-2 pr-3">Model</th><th className="py-2 pr-3">Requests</th><th className="py-2 pr-3">API calls</th><th className="py-2">Questions</th></tr></thead><tbody>{modelRows.map((row) => <tr key={row.model} className="border-b border-slate-800"><td className="py-3 pr-3">{row.model}</td><td className="py-3 pr-3">{formatNumber(row.requests)}</td><td className="py-3 pr-3">{formatNumber(row.api_calls)}</td><td className="py-3">{formatNumber(row.questions)}</td></tr>)}</tbody></table>{!modelRows.length && <p className="bq-admin-muted py-5">No model activity recorded.</p>}</div></section>
          <section className="bq-admin-panel"><h2>Token usage</h2>{tokenUsage?.available ? <div className="mt-4 grid gap-3 sm:grid-cols-3">{[["Input", tokenUsage.input_tokens], ["Output", tokenUsage.output_tokens], ["Total", tokenUsage.total_tokens]].map(([label, value]) => <div key={label} className="rounded-lg border border-slate-700 p-4"><p className="bq-admin-stat-label">{label} tokens</p><p className="mt-2 text-2xl font-semibold">{formatNumber(value)}</p></div>)}</div> : <p className="bq-admin-muted mt-4 text-sm">Token totals are hidden because complete Gemini usage metadata is not available for every Gemini request in this selection.</p>}</section>
        </div>

        <section className="bq-admin-panel"><h2>Failure and rate-limit types</h2><div className="mt-4 overflow-x-auto"><table className="w-full min-w-[440px] text-left text-sm"><thead><tr className="border-b border-slate-700"><th className="py-2 pr-3">Type</th><th className="py-2">Requests</th></tr></thead><tbody>{errorRows.map((row) => <tr key={row.error_type} className="border-b border-slate-800"><td className="py-3 pr-3">{row.error_type}</td><td className="py-3">{formatNumber(row.requests)}</td></tr>)}</tbody></table>{!errorRows.length && <p className="bq-admin-muted py-5">No error or rate-limit events for these filters.</p>}</div></section>
      </div>
    );
  };

  const renderAnalytics = () => {
    const campusRows = dashboardCampusRows;
    const bloomDistribution = selectedDashboardCampus?.bloom_distribution || overview?.bloom_distribution || {};
    const bloomEntries = Object.entries(bloomDistribution);
    const bloomPalette = ["#C4485A", "#E0A458", "#378A87", "#5587B8", "#758B54", "#8C6AA8", "#9B7465"];
    return <div className="grid gap-4 xl:grid-cols-2">
      <section className="bq-admin-panel"><h2>Questions by Campus</h2><div className="mt-4 h-72"><Bar data={{ labels: campusRows.map((campus) => campus.name), datasets: [{ label: "Questions", data: campusRows.map((campus) => campus.questions), backgroundColor: "#C4485A", borderRadius: 3 }] }} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } }} /></div></section>
      <section className="bq-admin-panel"><h2>Bloom Level Distribution</h2><div className="mt-4 h-72">{bloomEntries.length ? <Doughnut data={{ labels: bloomEntries.map(([label]) => label), datasets: [{ data: bloomEntries.map(([, count]) => count), backgroundColor: bloomPalette, borderWidth: 1 }] }} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "bottom" } } }} /> : <p className="bq-admin-muted pt-8">No question classification data yet.</p>}</div></section>
    </div>;
  };

  const renderContent = () => {
    if (activeTab === "campuses") return renderCampuses();
    if (activeTab === "admins") return renderAdmins();
    if (activeTab === "users") return renderUsers();
    if (activeTab === "academic") return <AcademicMgmtContent basePath="/super-admin/academic" />;
    if (activeTab === "questions") return <QuestionBankContent basePath="/super-admin/dashboard" />;
    if (activeTab === "ai_usage") return renderAIUsage();
    if (activeTab === "activity") return <ReportsContent />;
    return renderDashboard();
  };

  return (
    <div className={`bq-shell bq-admin-shell ${theme === "light" ? "bq-admin-light" : "bq-admin-dark"} flex h-screen w-full overflow-hidden`}>
      {mobileSidebarOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          className="fixed inset-0 z-30 bg-slate-950/30 md:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}
      <aside className={`bq-admin-sidebar fixed inset-y-0 left-0 z-40 flex h-screen shrink-0 flex-col transition-all duration-300 md:static md:z-auto ${sidebarCollapsed ? "is-collapsed w-20" : "w-56"} ${mobileSidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}`}>
        <div className="border-b border-slate-700 px-4 py-4"><p className="bq-admin-eyebrow">BloomQuest</p><h2 className="mt-1 text-sm font-semibold">Super Admin</h2></div>
        <nav aria-label="Super Admin navigation" onClick={() => setMobileSidebarOpen(false)} className="flex-1 space-y-1 overflow-y-auto px-2 py-4">
          {NAV_ITEMS.map(([id, label, Icon]) => <button key={id} type="button" title={sidebarCollapsed ? label : undefined} onClick={() => { setActiveTab(id); setError(""); setNotice(""); }} className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition ${activeTab === id ? "bg-[#B4454A] text-white" : "text-slate-400 hover:bg-slate-800 hover:text-white"}`}><Icon size={17} /><span>{label}</span></button>)}
        </nav>
        <div className="space-y-2 border-t border-slate-700 p-3"><button type="button" title={sidebarCollapsed ? "Appearance" : undefined} aria-label={sidebarCollapsed ? "Appearance" : undefined} onClick={switchTheme} className="bq-admin-action flex w-full items-center gap-2">{theme === "dark" ? <Sun size={15} /> : <Moon size={15} />} Appearance</button><LogoutBtn collapsed={sidebarCollapsed} /></div>
      </aside>
      <main className="bq-admin-main flex min-w-0 flex-1 flex-col overflow-auto">
        <header className="bq-admin-header sticky top-0 z-10 flex min-h-[76px] items-center justify-between border-b px-6 py-4 backdrop-blur">
          <div className="flex items-center gap-3"><button type="button" onClick={toggleSidebar} className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-white/10 hover:text-white" aria-label="Toggle navigation"><Menu size={18} /></button><div><p className="bq-admin-eyebrow">UNIVERSITY ADMINISTRATION</p><h1 className="bq-admin-title">{metadata?.[1] || "Dashboard"}</h1></div></div>
          <div className="text-right"><p className="text-sm font-medium">Super Admin</p><p className="bq-admin-mono">{localStorage.getItem("email") || ""}</p></div>
        </header>
        <div className="bq-page flex-1"><div className="bq-page-inner space-y-4">
          {error && <div role="alert" className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}
          {notice && <div role="status" className="rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</div>}
          {renderContent()}
        </div></div>
      </main>
    </div>
  );
};

export default SuperAdminDashboard;