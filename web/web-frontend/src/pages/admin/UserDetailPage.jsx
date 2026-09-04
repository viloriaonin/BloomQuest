import React, { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  BookOpen,
  FileQuestion,
  History,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { usePopup } from "../../components/PopupProvider";
import LoadingSpinner from "../../components/LoadingSpinner";

const API_BASE_URL = "http://localhost:8000/api";

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
  const [passwordResetOpen, setPasswordResetOpen] = useState(false);
  const [adminPassword, setAdminPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [passwordVerified, setPasswordVerified] = useState(false);
  const [passwordBusy, setPasswordBusy] = useState(false);

  const loadDetail = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(
        `${API_BASE_URL}/admin/users/${userId}/overview`,
      );
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

  const accountAction = async (endpoint, message) => {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
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

  const handleRevokeSessions = async () => {
    const confirmed = await showConfirm("Sign this user out of all active sessions?", "Revoke sessions");
    if (!confirmed) return;
    try {
      const response = await fetch(`${API_BASE_URL}/admin/users/bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_ids: [Number(userId)], action: "revoke_sessions" }),
      });
      if (!response.ok) throw new Error("Could not revoke sessions.");
      await showAlert("All active sessions were revoked.", "Security");
    } catch (err) {
      await showAlert(err.message, "Security");
    }
  };

  const handleDelete = async () => {
    const confirmed = await showConfirm("Permanently delete this user and their account record? This cannot be undone.", "Delete user");
    if (!confirmed) return;
    try {
      const response = await fetch(`${API_BASE_URL}/users/${encodeURIComponent(detail.user.email)}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Could not delete this user.");
      await showAlert("User deleted permanently.", "User Management");
      navigate("/admin");
    } catch (err) {
      await showAlert(err.message, "User Management");
    }
  };

  const handlePasswordReset = async (event) => {
    event.preventDefault();
    setPasswordBusy(true);
    try {
      if (!passwordVerified) {
        const verifyResponse = await fetch(`${API_BASE_URL}/users/verify-admin-password`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            admin_email: localStorage.getItem("email"),
            admin_password: adminPassword,
            target_email: user.email,
          }),
        });
        if (!verifyResponse.ok) {
          const data = await verifyResponse.json().catch(() => ({}));
          throw new Error(data.detail || "Administrator verification failed.");
        }
        setPasswordVerified(true);
        setAdminPassword("");
        return;
      }

      if (newPassword.length < 8) {
        throw new Error("The new password must contain at least 8 characters.");
      }
      const resetResponse = await fetch(`${API_BASE_URL}/users/update-password`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: user.email, new_password: newPassword }),
      });
      if (!resetResponse.ok) throw new Error("Could not reset this user's password.");
      setNewPassword("");
      setPasswordVerified(false);
      setPasswordResetOpen(false);
      await showAlert("The user's password was changed successfully.", "Security");
    } catch (err) {
      await showAlert(err.message, "Security");
    } finally {
      setPasswordBusy(false);
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

  const { user, subjects = [], questions = [], activities = [] } = detail;
  const statusLabel = user.archived ? "Archived" : "Active";

  return (
    <div className="space-y-5 page-transition">
      <button
        type="button"
        onClick={() => navigate("/admin")}
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
        <div className="grid gap-4 p-6 sm:grid-cols-2 lg:grid-cols-4">
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

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <BookOpen className="text-[#B4454A]" size={20} />
          <p className="mt-4 text-3xl font-bold text-gray-900">
            {subjects.length}
          </p>
          <p className="text-sm text-gray-500">Subjects created</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <FileQuestion className="text-[#B4454A]" size={20} />
          <p className="mt-4 text-3xl font-bold text-gray-900">
            {questions.length}
          </p>
          <p className="text-sm text-gray-500">Questions created</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <History className="text-[#B4454A]" size={20} />
          <p className="mt-4 text-3xl font-bold text-gray-900">
            {activities.length}
          </p>
          <p className="text-sm text-gray-500">Activity records</p>
        </div>
      </div>

      <section className="rounded-2xl border border-gray-200 bg-white p-5">
        <div className="mb-4 flex items-center gap-2">
          <ShieldCheck size={18} className="text-[#B4454A]" />
          <h2 className="font-bold text-gray-900">Account controls</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleArchiveRestore}
            className="bq-secondary-button"
          >
            {user.archived ? "Restore account" : "Archive account"}
          </button>
          <button
            type="button"
            onClick={handleRevokeSessions}
            className="bq-secondary-button"
          >
            Revoke all sessions
          </button>
          <button
            type="button"
            onClick={handleDelete}
            className="rounded-lg bg-red-700 px-3 py-2 text-sm font-semibold text-white hover:bg-red-800"
          >
            Delete account
          </button>
          <button
            type="button"
            onClick={() => {
              setPasswordResetOpen((open) => !open);
              setPasswordVerified(false);
              setAdminPassword("");
              setNewPassword("");
            }}
            className="bq-primary-button"
          >
            Reset password
          </button>
        </div>
        {passwordResetOpen && (
          <form onSubmit={handlePasswordReset} className="mt-5 border-t border-gray-100 pt-5">
            <h3 className="text-sm font-bold text-gray-900">Secure password reset</h3>
            <p className="mt-1 text-xs text-gray-500">
              Verify your administrator password first. The current user password cannot be displayed because it is stored as a one-way hash.
            </p>
            {!passwordVerified ? (
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <input
                  type="password"
                  value={adminPassword}
                  onChange={(event) => setAdminPassword(event.target.value)}
                  placeholder="Your administrator password"
                  className="bq-field flex-1 px-3 py-2 text-sm"
                  required
                />
                <button type="submit" disabled={passwordBusy} className="bq-primary-button">
                  {passwordBusy ? "Verifying..." : "Verify administrator"}
                </button>
              </div>
            ) : (
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <div className="relative flex-1">
                  <input
                    type={showNewPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    placeholder="New password (minimum 8 characters)"
                    minLength="8"
                    className="bq-field w-full px-3 py-2 pr-16 text-sm"
                    required
                  />
                  <button type="button" onClick={() => setShowNewPassword((visible) => !visible)} className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-[#B4454A]">
                    {showNewPassword ? "Hide" : "Show"}
                  </button>
                </div>
                <button type="submit" disabled={passwordBusy} className="bq-primary-button">
                  {passwordBusy ? "Changing..." : "Change password"}
                </button>
              </div>
            )}
          </form>
        )}
      </section>

      <div className="grid gap-5 xl:grid-cols-2">
        <section className="rounded-2xl border border-gray-200 bg-white p-5">
          <h2 className="mb-4 font-bold text-gray-900">Subjects created</h2>
          {subjects.length ? (
            <div className="space-y-2">
              {subjects.map((subject) => (
                <article
                  key={subject.id}
                  className="rounded-xl border border-gray-100 bg-gray-50 p-3"
                >
                  <p className="font-semibold text-gray-800">{subject.name}</p>
                  <p className="mt-1 text-xs text-gray-500">
                    {subject.code || "No course code"} · {subject.department} ·{" "}
                    {formatDate(subject.created_at)}
                  </p>
                </article>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">No subjects created.</p>
          )}
        </section>
        <section className="rounded-2xl border border-gray-200 bg-white p-5">
          <h2 className="mb-4 font-bold text-gray-900">Questions created</h2>
          {questions.length ? (
            <div className="max-h-96 space-y-2 overflow-y-auto">
              {questions.map((question) => (
                <article
                  key={question.id}
                  className="rounded-xl border border-gray-100 bg-gray-50 p-3"
                >
                  <p className="font-semibold text-gray-800">
                    {question.question}
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    {question.subject} · {question.type} ·{" "}
                    {question.bloom_level || "Unclassified"}
                  </p>
                </article>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">No questions created.</p>
          )}
        </section>
      </div>

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
