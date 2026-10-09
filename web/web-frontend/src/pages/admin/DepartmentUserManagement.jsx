import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  Archive,
  ArrowLeft,
  BookOpen,
  Check,
  ChevronRight,
  Clock3,
  Eye,
  KeyRound,
  LoaderCircle,
  Mail,
  Search,
  Send,
  ShieldCheck,
  Trash2,
  UserRound,
  UsersRound,
} from "lucide-react";
import { usePopup } from "../../components/PopupProvider";
import { API_URL } from "../../config/api";

const request = async (path, options = {}) => {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.detail || "The request could not be completed.");
  }
  return payload;
};

const formatDate = (value, includeTime = false) => {
  if (!value) return "Not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not available";
  return date.toLocaleString(undefined, includeTime
    ? { dateStyle: "medium", timeStyle: "short" }
    : { dateStyle: "medium" });
};

const initialsFor = (name) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "F";

const DepartmentUserManagement = ({ initialUserId = null, onClose }) => {
  const { showConfirm } = usePopup();
  const [users, setUsers] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [department, setDepartment] = useState("");
  const [selectedUserId, setSelectedUserId] = useState(initialUserId);
  const [detail, setDetail] = useState(null);
  const [statusFilter, setStatusFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [credentialAction, setCredentialAction] = useState("");
  const [resetEmailPromptOpen, setResetEmailPromptOpen] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [programDialogOpen, setProgramDialogOpen] = useState(false);
  const [selectedProgramId, setSelectedProgramId] = useState("");

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await request("/department-admin/users");
      setUsers(result.users || []);
      setPrograms(result.programs || []);
      setDepartment(result.department?.name || "");
    } catch (loadError) {
      setError(loadError.message || "Could not load faculty accounts.");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadDetail = useCallback(async (userId) => {
    if (!userId) return;
    setDetailLoading(true);
    setError("");
    try {
      const result = await request(`/department-admin/users/${userId}`);
      setDetail(result);
    } catch (loadError) {
      setError(loadError.message || "Could not load this faculty profile.");
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  useEffect(() => {
    if (selectedUserId) loadDetail(selectedUserId);
  }, [loadDetail, selectedUserId]);

  const visibleUsers = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return users.filter((user) => {
      const matchesStatus = statusFilter === "All" || user.status === statusFilter;
      const matchesSearch = !normalizedSearch || [
        user.full_name,
        user.email,
        user.program,
      ].some((value) => (value || "").toLowerCase().includes(normalizedSearch));
      return matchesStatus && matchesSearch;
    });
  }, [search, statusFilter, users]);

  const refreshSelectedProfile = async (message) => {
    await loadUsers();
    if (selectedUserId) await loadDetail(selectedUserId);
    setNotice(message);
  };

  const toggleArchived = async () => {
    if (!detail) return;
    const nextArchived = !detail.archived;
    const confirmed = await showConfirm(
      `${nextArchived ? "Archive" : "Restore"} ${detail.full_name}'s faculty account?`,
      nextArchived ? "Archive Faculty Account" : "Restore Faculty Account",
    );
    if (!confirmed) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await request(`/department-admin/users/${detail.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ archived: nextArchived }),
      });
      await refreshSelectedProfile(`Faculty account ${nextArchived ? "archived" : "restored"} successfully.`);
    } catch (actionError) {
      setError(actionError.message || "Could not update the faculty account.");
    } finally {
      setBusy(false);
    }
  };

  const saveProgram = async () => {
    if (!detail) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await request(`/department-admin/users/${detail.id}/program`, {
        method: "PATCH",
        body: JSON.stringify({ program_id: selectedProgramId ? Number(selectedProgramId) : null }),
      });
      setProgramDialogOpen(false);
      await refreshSelectedProfile("Faculty program updated successfully.");
    } catch (actionError) {
      setError(actionError.message || "Could not update the faculty program.");
    } finally {
      setBusy(false);
    }
  };

  const openPasswordReset = () => {
    if (!detail) return;
    setError("");
    setNotice("");
    setResetEmailPromptOpen(true);
  };

  const sendCredentialEmail = async (action) => {
    if (!detail) return;
    setBusy(true);
    setCredentialAction(action);
    setError("");
    setNotice("");
    try {
      const result = await request(`/department-admin/users/${detail.id}/credential-email`, {
        method: "POST",
        body: JSON.stringify({ action }),
      });
      if (action === "reset_password") setResetEmailPromptOpen(false);
      setNotice(result.message || `Email sent to ${detail.email}.`);
    } catch (actionError) {
      setError(actionError.message || "Could not send the faculty email.");
    } finally {
      setBusy(false);
      setCredentialAction("");
    }
  };

  const deleteAccount = async () => {
    if (!detail) return;
    const confirmed = await showConfirm(
      `Permanently delete ${detail.full_name} (${detail.email})? This removes the account and cannot be undone.`,
      "Permanently Delete Faculty Account",
    );
    if (!confirmed) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await request(`/department-admin/users/${detail.id}`, { method: "DELETE" });
      setSelectedUserId(null);
      setDetail(null);
      if (!onClose) await loadUsers();
      setNotice("Faculty account permanently deleted.");
      if (onClose) onClose();
    } catch (actionError) {
      setError(actionError.message || "Could not delete the faculty account.");
    } finally {
      setBusy(false);
    }
  };

  if (selectedUserId) {
    return (
      <div className="space-y-5">
        <button
          type="button"
          onClick={() => {
            if (onClose) {
              onClose();
              return;
            }
            setSelectedUserId(null);
            setDetail(null);
            setError("");
            setNotice("");
          }}
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 transition hover:text-slate-900"
        >
          <ArrowLeft size={16} /> Back to {onClose ? "Faculty Management" : "User Management"}
        </button>
        {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
        {notice && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</p>}
        {detailLoading || !detail ? (
          <section className="bq-admin-panel p-8 text-center text-sm text-slate-500">
            {detailLoading ? "Loading faculty profile..." : "Faculty profile is unavailable."}
          </section>
        ) : (
          <>
            <section className="bq-admin-panel overflow-hidden">
              <div className="border-b border-slate-200/80 bg-gradient-to-r from-rose-50 via-white to-white px-6 py-7">
                <div className="flex flex-wrap items-start justify-between gap-5">
                  <div className="flex min-w-0 items-center gap-4">
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-rose-100 text-xl font-bold text-rose-700">
                      {initialsFor(detail.full_name)}
                    </div>
                    <div className="min-w-0">
                      <h2 className="truncate text-2xl font-bold text-slate-900">{detail.full_name}</h2>
                      <p className="mt-1 flex items-center gap-2 text-sm text-slate-500"><Mail size={15} />{detail.email}</p>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{detail.role}</span>
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${detail.archived ? "bg-slate-200 text-slate-600" : "bg-emerald-100 text-emerald-700"}`}>
                          {detail.status}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" disabled={busy} onClick={openPasswordReset} className="inline-flex items-center gap-2 rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm font-semibold text-amber-800 transition hover:bg-amber-50 disabled:opacity-50">
                      {credentialAction === "reset_password" ? <LoaderCircle size={15} className="animate-spin" /> : <KeyRound size={15} />}
                      Reset password
                    </button>
                    <button type="button" disabled={busy} onClick={toggleArchived} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50">
                      <Archive size={15} /> {detail.archived ? "Restore account" : "Archive account"}
                    </button>
                    <button type="button" disabled={busy} onClick={deleteAccount} className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:opacity-50">
                      <Trash2 size={15} /> Delete account
                    </button>
                  </div>
                </div>
              </div>
              <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  { label: "Department", value: detail.department },
                  { label: "Program", value: detail.program },
                  { label: "Date joined", value: formatDate(detail.created_at) },
                  { label: "Account status", value: detail.status },
                ].map((item) => (
                  <div key={item.label} className="rounded-xl border border-slate-200 bg-white p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{item.label}</p>
                    <p className="mt-2 truncate text-sm font-semibold text-slate-800">{item.value || "Not assigned"}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="grid gap-4 sm:grid-cols-2">
              <div className="bq-admin-panel flex items-center gap-4 p-5">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-100 text-violet-700"><BookOpen size={21} /></span>
                <div><p className="text-sm text-slate-500">Questions created</p><p className="mt-1 text-2xl font-bold text-slate-900">{detail.question_count}</p></div>
              </div>
              <div className="bq-admin-panel flex items-center gap-4 p-5">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-100 text-blue-700"><Activity size={21} /></span>
                <div><p className="text-sm text-slate-500">Recent activity records</p><p className="mt-1 text-2xl font-bold text-slate-900">{detail.activity_count}</p></div>
              </div>
            </section>

            <div className="grid gap-5 xl:grid-cols-2">
              <section className="bq-admin-panel p-5">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div><h3 className="font-bold text-slate-900">Academic assignment</h3><p className="mt-1 text-sm text-slate-500">Manage this faculty member within {department}.</p></div>
                  <button
                    type="button"
                    onClick={() => { setSelectedProgramId(detail.program_id ? String(detail.program_id) : ""); setProgramDialogOpen(true); }}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Change program
                  </button>
                </div>
                <div className="rounded-xl border border-slate-200 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Assigned program</p>
                  <p className="mt-2 text-sm font-semibold text-slate-800">{detail.program}</p>
                </div>
                <h4 className="mb-2 mt-5 text-sm font-semibold text-slate-700">Subjects</h4>
                {detail.subjects.length ? (
                  <ul className="divide-y divide-slate-100">
                    {detail.subjects.map((subject) => <li key={subject.id} className="flex items-center justify-between gap-3 py-3 text-sm"><span className="font-medium text-slate-800">{subject.name}</span><span className="text-slate-400">{subject.code || "—"}</span></li>)}
                  </ul>
                ) : <p className="rounded-xl bg-slate-50 px-4 py-5 text-sm text-slate-500">No active subjects assigned.</p>}
              </section>
              <section className="bq-admin-panel p-5">
                <div className="mb-4 flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-700"><Clock3 size={19} /></span><div><h3 className="font-bold text-slate-900">Recent activity</h3><p className="text-sm text-slate-500">Latest account and workspace events</p></div></div>
                {detail.activity.length ? (
                  <ol className="space-y-4">
                    {detail.activity.map((item) => (
                      <li key={item.id} className="relative border-l border-slate-200 pl-4">
                        <span className="absolute -left-[5px] top-1 h-2.5 w-2.5 rounded-full bg-rose-400 ring-4 ring-white" />
                        <p className="text-sm font-semibold text-slate-800">{item.action}</p>
                        <p className="mt-1 text-xs text-slate-500">{formatDate(item.created_at, true)} · {item.type}</p>
                        {item.details && <p className="mt-1 text-sm text-slate-600">{item.details}</p>}
                      </li>
                    ))}
                  </ol>
                ) : <p className="rounded-xl bg-slate-50 px-4 py-5 text-sm text-slate-500">No activity recorded yet.</p>}
              </section>
            </div>
          </>
        )}
        {programDialogOpen && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/50 p-4" role="presentation">
            <section role="dialog" aria-modal="true" aria-labelledby="faculty-program-title" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
              <h3 id="faculty-program-title" className="text-lg font-bold text-slate-900">Change faculty program</h3>
              <p className="mt-1 text-sm text-slate-500">Only programs in {department} are available.</p>
              <label className="mt-5 block text-sm font-semibold text-slate-700" htmlFor="faculty-program">Program</label>
              <select id="faculty-program" value={selectedProgramId} onChange={(event) => setSelectedProgramId(event.target.value)} className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm">
                <option value="">Unassigned</option>
                {programs.map((program) => <option key={program.id} value={program.id}>{program.name}</option>)}
              </select>
              <div className="mt-6 flex justify-end gap-2">
                <button type="button" disabled={busy} onClick={() => setProgramDialogOpen(false)} className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100">Cancel</button>
                <button type="button" disabled={busy} onClick={saveProgram} className="inline-flex items-center gap-2 rounded-lg bg-rose-700 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-800 disabled:opacity-50"><Check size={15} />Save program</button>
              </div>
            </section>
          </div>
        )}
        {resetEmailPromptOpen && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/50 p-4">
            <section role="dialog" aria-modal="true" aria-labelledby="reset-password-title" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
              <h3 id="reset-password-title" className="text-lg font-bold text-slate-900">Reset faculty password</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                A new temporary password and secure setup link will be emailed to <strong>{detail.email}</strong>.
                The current password will be replaced and existing sessions signed out after the email is sent.
              </p>
              {error && <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
              <div className="mt-6 flex justify-end gap-2">
                <button type="button" disabled={busy} onClick={() => { setResetEmailPromptOpen(false); setError(""); }} className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100">Cancel</button>
                <button type="button" disabled={busy} onClick={() => sendCredentialEmail("reset_password")} className="inline-flex items-center gap-2 rounded-lg bg-amber-700 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-800 disabled:opacity-50">
                  {credentialAction === "reset_password" ? <LoaderCircle size={15} className="animate-spin" /> : <Send size={15} />}
                  {credentialAction === "reset_password" ? "Sending email…" : "Send reset email"}
                </button>
              </div>
            </section>
          </div>
        )}
      </div>
    );
  }

  const activeCount = users.filter((user) => !user.archived).length;
  const archivedCount = users.length - activeCount;
  return (
    <div className="space-y-5">
      <section className="bq-admin-panel flex flex-wrap items-start justify-between gap-4 p-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-rose-700"><ShieldCheck size={15} /> Department accounts</div>
          <h2 className="mt-2 text-2xl font-bold text-slate-900">User Management</h2>
          <p className="mt-1 text-sm text-slate-500">Review and manage faculty accounts in {department || "your department"}.</p>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-600"><UsersRound size={18} className="text-rose-700" /> Faculty accounts only</div>
      </section>
      {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      {notice && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</p>}
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "All faculty", value: users.length, icon: UsersRound, color: "text-rose-700 bg-rose-100" },
          { label: "Active accounts", value: activeCount, icon: Check, color: "text-emerald-700 bg-emerald-100" },
          { label: "Archived accounts", value: archivedCount, icon: Archive, color: "text-slate-600 bg-slate-100" },
        ].map((stat) => {
          const Icon = stat.icon;
          return <div key={stat.label} className="bq-admin-panel flex items-center gap-4 p-5"><span className={`flex h-11 w-11 items-center justify-center rounded-xl ${stat.color}`}><Icon size={20} /></span><div><p className="text-sm text-slate-500">{stat.label}</p><p className="text-2xl font-bold text-slate-900">{stat.value}</p></div></div>;
        })}
      </div>
      <section className="bq-admin-panel overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200/80 p-5">
          <div><h3 className="font-bold text-slate-900">Faculty directory</h3><p className="mt-1 text-sm text-slate-500">View profiles and manage faculty account status.</p></div>
          <label className="relative block w-full sm:w-72">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search faculty..." aria-label="Search faculty" className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-rose-400 focus:ring-2 focus:ring-rose-100" />
          </label>
        </div>
        <div className="flex gap-2 px-5 pt-4" role="tablist" aria-label="Filter faculty accounts">
          {["All", "Active", "Archived"].map((filter) => (
            <button key={filter} type="button" role="tab" aria-selected={statusFilter === filter} onClick={() => setStatusFilter(filter)} className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${statusFilter === filter ? "bg-rose-700 text-white" : "text-slate-500 hover:bg-slate-100"}`}>
              {filter} {filter === "Active" ? `(${activeCount})` : filter === "Archived" ? `(${archivedCount})` : `(${users.length})`}
            </button>
          ))}
        </div>
        <div className="overflow-x-auto p-5">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead><tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400"><th className="px-3 py-3 font-semibold">Faculty member</th><th className="px-3 py-3 font-semibold">Department</th><th className="px-3 py-3 font-semibold">Program</th><th className="px-3 py-3 font-semibold">Date joined</th><th className="px-3 py-3 font-semibold">Status</th><th className="px-3 py-3 text-right font-semibold">Profile</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? <tr><td colSpan="6" className="px-3 py-12 text-center text-slate-500">Loading faculty accounts...</td></tr>
                : visibleUsers.length ? visibleUsers.map((user) => (
                  <tr key={user.id} className="transition hover:bg-slate-50/80">
                    <td className="px-3 py-4"><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-100 text-sm font-bold text-rose-700">{initialsFor(user.full_name)}</span><div><p className="font-semibold text-slate-800">{user.full_name}</p><p className="mt-0.5 text-xs text-slate-500">{user.email}</p></div></div></td>
                    <td className="px-3 py-4 text-slate-600">{user.department}</td>
                    <td className="px-3 py-4 text-slate-600">{user.program}</td>
                    <td className="px-3 py-4 text-slate-600">{formatDate(user.created_at)}</td>
                    <td className="px-3 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${user.archived ? "bg-slate-100 text-slate-600" : "bg-emerald-100 text-emerald-700"}`}>{user.status}</span></td>
                    <td className="px-3 py-4 text-right"><button type="button" onClick={() => setSelectedUserId(user.id)} className="inline-flex items-center gap-1 rounded-lg px-3 py-2 font-semibold text-rose-700 transition hover:bg-rose-50"><Eye size={15} />View profile<ChevronRight size={14} /></button></td>
                  </tr>
                )) : <tr><td colSpan="6" className="px-3 py-12 text-center"><UserRound size={24} className="mx-auto text-slate-300" /><p className="mt-2 font-semibold text-slate-700">No faculty accounts found</p><p className="mt-1 text-sm text-slate-500">{search ? "Try a different search term." : "Faculty accounts for this department will appear here."}</p></td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

export default DepartmentUserManagement;
