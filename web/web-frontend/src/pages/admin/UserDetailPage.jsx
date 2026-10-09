import React, { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  FileQuestion,
  History,
  KeyRound,
  LoaderCircle,
  ShieldCheck,
  Send,
  UserRound,
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { usePopup } from "../../components/PopupProvider";
import LoadingSpinner from "../../components/LoadingSpinner";
import { API_URL } from "../../config/api";

const apiFetch = (path, options = {}) => fetch(`${API_URL}${path}`, {
  ...options,
  headers: {
    Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
    ...options.headers,
  },
});

const formatDate = (value) => {
  if (!value) return "No record";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "No record" : date.toLocaleString();
};

const UserDetailPage = () => {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { showAlert, showConfirm } = usePopup();
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [departmentManageOpen, setDepartmentManageOpen] = useState(false);
  const [departments, setDepartments] = useState([]);
  const [selectedDepartment, setSelectedDepartment] = useState("");
  const [departmentBusy, setDepartmentBusy] = useState(false);
  const [programManageOpen, setProgramManageOpen] = useState(false);
  const [programs, setPrograms] = useState([]);
  const [selectedProgram, setSelectedProgram] = useState("");
  const [programBusy, setProgramBusy] = useState(false);
  const [resetEmailPromptOpen, setResetEmailPromptOpen] = useState(false);
  const [resetEmailBusy, setResetEmailBusy] = useState(false);
  const [resetEmailError, setResetEmailError] = useState("");
  const [resetEmailNotice, setResetEmailNotice] = useState("");

  const loadDetail = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await apiFetch(`/admin/users/${userId}/overview`);
      if (!response.ok) throw new Error("Could not load this user profile.");
      setDetail(await response.json());
    } catch (err) {
      setError(err.message || "Could not load this user profile.");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  useEffect(() => {
    apiFetch("/departments")
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("Could not load departments.")))
      .then((data) => setDepartments(Array.isArray(data) ? data : []))
      .catch(() => setDepartments([]));
  }, []);

  const accountAction = async (endpoint, message) => {
    const response = await apiFetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: detail.user.email }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.detail || `Could not ${message.toLowerCase()}.`);
    }
    await showAlert(message, "User Management");
    await loadDetail();
  };

  const handleArchiveRestore = async () => {
    const action = detail.user.archived ? "restore" : "archive";
    const confirmed = await showConfirm(
      `Are you sure you want to ${action} ${detail.user.name}?`,
      `${action[0].toUpperCase()}${action.slice(1)} user`,
    );
    if (!confirmed) return;
    try {
      await accountAction(`/users/${action}`, `User ${action}d successfully.`);
    } catch (err) {
      await showAlert(err.message, "User Management");
    }
  };

  const handleUpdateDepartment = async (event) => {
    event.preventDefault();
    if (!selectedDepartment) return;
    setDepartmentBusy(true);
    try {
      const response = await apiFetch("/users/update-department", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: detail.user.email, department_id: Number(selectedDepartment) }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.detail || "Could not update the user's department.");
      setDepartmentManageOpen(false);
      setProgramManageOpen(false);
      setSelectedProgram("");
      setPrograms([]);
      await showAlert("User department updated successfully.", "User Management");
      await loadDetail();
    } catch (err) {
      await showAlert(err.message, "User Management");
    } finally {
      setDepartmentBusy(false);
    }
  };

  const handleUpdateProgram = async (event) => {
    event.preventDefault();
    if (!selectedProgram) return;
    setProgramBusy(true);
    try {
      const response = await apiFetch("/users/update-program", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: detail.user.email, program_id: Number(selectedProgram) }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.detail || "Could not update the user's program assignment.");
      setProgramManageOpen(false);
      setSelectedProgram("");
      await showAlert("User program assignment updated successfully.", "User Management");
      await loadDetail();
    } catch (err) {
      await showAlert(err.message, "User Management");
    } finally {
      setProgramBusy(false);
    }
  };

  const handleDelete = async () => {
    const confirmed = await showConfirm("This is a permanent recycle-bin style delete. The account will be removed and cannot be restored. Confirm permanent deletion?", "Permanent delete");
    if (!confirmed) return;
    try {
      const response = await apiFetch(`/users/${encodeURIComponent(detail.user.email)}/permanent`, { method: "DELETE" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.detail || "Could not permanently delete this user.");
      await showAlert("User permanently deleted.", "User Management");
      navigate("/admin/users");
    } catch (err) {
      await showAlert(err.message, "User Management");
    }
  };

  const sendPasswordResetEmail = async () => {
    setResetEmailBusy(true);
    setResetEmailError("");
    setResetEmailNotice("");
    try {
      const response = await apiFetch(`/campus-admin/users/${userId}/credential-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reset_password" }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.detail || "Could not send the password reset email.");
      setResetEmailPromptOpen(false);
      setResetEmailNotice(data.message || `Email sent to ${detail.user.email}.`);
    } catch (err) {
      setResetEmailError(err.message || "Could not send the password reset email.");
    } finally {
      setResetEmailBusy(false);
    }
  };

  if (loading)
    return (
      <div className="flex justify-center py-16">
        <LoadingSpinner
          label="Loading user profile..."
          spinnerColor="border-gray-500"
        />
      </div>
    );
  if (error || !detail)
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
        {error || "User profile not found."}
      </div>
    );

  const { user, subjects = [], activities = [] } = detail;
  const questionCount = detail.question_count ?? detail.questions?.length ?? 0;
  const statusLabel = user.archived ? "Archived" : "Active";

  return (
    <div className="space-y-5 page-transition">
      <button
        type="button"
          onClick={() => navigate("/admin/users")}
        className="inline-flex items-center gap-2 text-sm font-semibold text-[#B4454A] hover:text-[#8f3439]"
      >
        <ArrowLeft size={16} /> Back to user management
      </button>

      <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 bg-[#F0645A] px-6 py-6 text-white">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/20 text-xl font-bold">
              <UserRound size={26} />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/75">
                User profile
              </p>
              <h1 className="mt-1 text-2xl font-bold">{user.name}</h1>
              <p className="mt-1 text-sm text-white/80">{user.email}</p>
            </div>
          </div>
          <span
            className={`rounded-full px-4 py-2 text-sm font-bold ${user.archived ? "bg-white/20" : "bg-emerald-100 text-emerald-800"}`}
          >
            {statusLabel}
          </span>
        </div>
        <div className="grid gap-4 p-6 sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
              Role
            </p>
            <p className="mt-1 font-semibold text-gray-800">{user.role}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
              Department
            </p>
            <p className="mt-1 font-semibold text-gray-800">
              {user.department}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
              Program
            </p>
            <p className="mt-1 font-semibold text-gray-800">
              {user.program || "Unassigned"}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
              Account created
            </p>
            <p className="mt-1 font-semibold text-gray-800">
              {formatDate(user.joined)}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
              Recent activity
            </p>
            <p className="mt-1 font-semibold text-gray-800">
              {formatDate(activities[0]?.created_at)}
            </p>
          </div>
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <FileQuestion className="text-[#B4454A]" size={20} />
          <p className="mt-4 text-3xl font-bold text-gray-900">
            {questionCount}
          </p>
          <p className="text-sm text-gray-500">Questions created</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <History className="text-[#B4454A]" size={20} />
          <div className="mt-4 flex items-end justify-between gap-3">
            <div>
              <p className="text-3xl font-bold text-gray-900">{activities.length}</p>
              <p className="text-sm text-gray-500">Activity records</p>
            </div>
          </div>
        </div>
      </div>

      <section className="rounded-2xl border border-gray-200 bg-white p-5">
        <div className="mb-4 flex items-center gap-2">
          <ShieldCheck size={18} className="text-[#B4454A]" />
          <h2 className="font-bold text-gray-900">Account controls</h2>
        </div>
        {resetEmailNotice && <p role="status" className="mb-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{resetEmailNotice}</p>}
        <div className="flex flex-wrap gap-2">
          {user.role?.toLowerCase() === "faculty" && (
            <button
              type="button"
              onClick={() => {
                setResetEmailError("");
                setResetEmailNotice("");
                setResetEmailPromptOpen(true);
              }}
              className="bq-secondary-button"
            >
              <KeyRound size={15} className="mr-2 inline" />Reset password
            </button>
          )}
          <button
            type="button"
            onClick={handleArchiveRestore}
            className="bq-secondary-button"
          >
            {user.archived ? "Restore account" : "Archive account"}
          </button>
          <button
            type="button"
            onClick={() => {
              setSelectedDepartment(String(departments.find((item) => item.name === user.department)?.id || ""));
              setDepartmentManageOpen((open) => !open);
              setProgramManageOpen(false);
            }}
            className="bq-secondary-button"
          >
            Change department
          </button>
          <button
            type="button"
            onClick={async () => {
              const currentDepartmentId = departments.find((item) => item.name === user.department)?.id;
              setSelectedDepartment(currentDepartmentId ? String(currentDepartmentId) : "");
              if (!currentDepartmentId) {
                setPrograms([]);
                setSelectedProgram("");
                setProgramManageOpen((open) => !open);
                return;
              }

              try {
                const response = await apiFetch(`/departments/${currentDepartmentId}/programs`);
                const data = await response.json().catch(() => []);
                const nextPrograms = Array.isArray(data) ? data : [];
                setPrograms(nextPrograms);
                setSelectedProgram(String(detail.user.program_id || ""));
              } catch {
                setPrograms([]);
                setSelectedProgram("");
              }
              setProgramManageOpen((open) => !open);
            }}
            className="bq-secondary-button"
          >
            Change program assignment
          </button>
          <button
            type="button"
            onClick={handleDelete}
            className="rounded-lg bg-red-700 px-3 py-2 text-sm font-semibold text-white hover:bg-red-800"
          >
            Delete account
          </button>
        </div>
        {departmentManageOpen && (
          <form onSubmit={handleUpdateDepartment} className="mt-5 border-t border-gray-100 pt-5">
            <h3 className="text-sm font-bold text-gray-900">Manage department</h3>
            <p className="mt-1 text-xs text-gray-500">Changing the department clears the current program assignment so it can be reviewed again.</p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <select
                value={selectedDepartment}
                onChange={(event) => setSelectedDepartment(event.target.value)}
                className="bq-field flex-1 px-3 py-2 text-sm"
                required
              >
                <option value="">Select a department</option>
                {departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
              </select>
              <button type="submit" disabled={departmentBusy || !selectedDepartment} className="bq-primary-button disabled:cursor-not-allowed disabled:opacity-50">
                {departmentBusy ? "Saving..." : "Save department"}
              </button>
            </div>
          </form>
        )}
        {programManageOpen && (
          <form onSubmit={handleUpdateProgram} className="mt-5 border-t border-gray-100 pt-5">
            <h3 className="text-sm font-bold text-gray-900">Manage program assignment</h3>
            <p className="mt-1 text-xs text-gray-500">Choose the program for this user within the selected department.</p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <select
                value={selectedProgram}
                onChange={(event) => setSelectedProgram(event.target.value)}
                className="bq-field flex-1 px-3 py-2 text-sm"
                required
              >
                <option value="">Select a program</option>
                {programs.map((program) => <option key={program.id} value={program.id}>{program.name}</option>)}
              </select>
              <button type="submit" disabled={programBusy || !selectedProgram} className="bq-primary-button disabled:cursor-not-allowed disabled:opacity-50">
                {programBusy ? "Saving..." : "Save program"}
              </button>
            </div>
          </form>
        )}
      </section>
      {resetEmailPromptOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/50 p-4">
          <section role="dialog" aria-modal="true" aria-labelledby="reset-password-title" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h3 id="reset-password-title" className="text-lg font-bold text-slate-900">Reset faculty password</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              A new temporary password and secure setup link will be emailed to <strong>{detail.user.email}</strong>.
              The current password will be replaced and existing sessions signed out after the email is sent.
            </p>
            {resetEmailError && <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{resetEmailError}</p>}
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" disabled={resetEmailBusy} onClick={() => { setResetEmailPromptOpen(false); setResetEmailError(""); }} className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100">Cancel</button>
              <button type="button" disabled={resetEmailBusy} onClick={sendPasswordResetEmail} className="inline-flex items-center gap-2 rounded-lg bg-amber-700 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-800 disabled:opacity-50">
                {resetEmailBusy ? <LoaderCircle size={15} className="animate-spin" /> : <Send size={15} />}
                {resetEmailBusy ? "Sending email…" : "Send reset email"}
              </button>
            </div>
          </section>
        </div>
      )}

      <section className="rounded-2xl border border-gray-200 bg-white p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="font-bold text-gray-900">Subjects</h2>
            <p className="mt-1 text-xs text-gray-500">Subjects where this user has created questions.</p>
          </div>
          <span className="text-xs font-semibold text-gray-500">{subjects.length} subject{subjects.length === 1 ? "" : "s"}</span>
        </div>
        {subjects.length ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {subjects.map((subject) => (
              <article key={subject.id} className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                <h3 className="font-semibold text-gray-900">{subject.name}</h3>
                <p className="mt-1 text-xs text-gray-500">{subject.code || "No course code"} · {subject.department}</p>
                <details className="mt-3 border-t border-gray-200 pt-3">
                  <summary className="cursor-pointer text-xs font-semibold text-[#B4454A]">
                    View {subject.questions?.length || 0} generated question{subject.questions?.length === 1 ? "" : "s"}
                  </summary>
                  {subject.questions?.length ? (
                    <ol className="mt-3 space-y-3">
                      {subject.questions.map((question, index) => (
                        <li key={question.id} className="rounded-lg border border-gray-200 bg-white p-3">
                          <p className="text-sm leading-6 text-gray-800">{index + 1}. {question.question}</p>
                          <p className="mt-2 text-xs text-gray-500">
                            {[question.question_type, question.bloom_level]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p className="mt-3 text-xs text-gray-500">No questions are linked to this subject.</p>
                  )}
                </details>
              </article>
            ))}
          </div>
        ) : <p className="text-sm text-gray-500">No subjects with questions yet.</p>}
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-5">
        <h2 className="mb-4 font-bold text-gray-900">
          Login and activity history
        </h2>
        {activities.length ? (
          <div className="max-h-96 space-y-2 overflow-y-auto">
            {activities.map((activity) => (
              <article
                key={activity.id}
                className="flex items-start justify-between gap-4 rounded-xl border border-gray-100 bg-gray-50 p-3"
              >
                <div>
                  <p className="font-semibold text-gray-800">
                    {activity.action}
                  </p>
                  <p className="mt-1 text-sm text-gray-500">
                    {activity.detail || "No additional details"}
                  </p>
                </div>
                <div className="text-right">
                  <span
                    className={`rounded-full px-2 py-1 text-[10px] font-semibold ${activity.status === "error" ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"}`}
                  >
                    {activity.status || "success"}
                  </span>
                  <p className="mt-2 text-xs text-gray-400">
                    {formatDate(activity.created_at)}
                  </p>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500">No activity recorded.</p>
        )}
      </section>
    </div>
  );
};

export default UserDetailPage;
