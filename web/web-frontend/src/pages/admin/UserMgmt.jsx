import React, { useState, useEffect } from "react";
import { usePopup } from "../../components/PopupProvider";
import LoadingSpinner from "../../components/LoadingSpinner";

const API_BASE_URL = "http://localhost:8000/api";

export const UserMgmtContent = () => {
  const { showAlert, showConfirm } = usePopup();
  const [requests, setRequests] = useState([]);
  const [activeUsers, setActiveUsers] = useState([]);
  const [archivedUsers, setArchivedUsers] = useState([]);
  const [loadingRequests, setLoadingRequests] = useState(true);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [errorRequests, setErrorRequests] = useState("");
  const [errorUsers, setErrorUsers] = useState("");

  const [editingUser, setEditingUser] = useState(null);
  const [adminPassword, setAdminPassword] = useState("");
  const [credentialsVerified, setCredentialsVerified] = useState(false);
  const [verifiedUserCredentials, setVerifiedUserCredentials] = useState(null);
  const [adminAuthError, setAdminAuthError] = useState("");

  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    fetchPendingRequests();
    fetchUsers();
  }, []);

  const fetchPendingRequests = async () => {
    setLoadingRequests(true);
    setErrorRequests("");
    try {
      const response = await fetch(`${API_BASE_URL}/contact-admin/pending`, { cache: "no-store" });
      if (!response.ok) throw new Error("Failed to load account requests.");
      const data = await response.json();
      setRequests(data);
    } catch (err) {
      console.error(err);
      setErrorRequests("Could not load dynamic account tickets from database.");
    } finally {
      setLoadingRequests(false);
    }
  };

  const fetchUsers = async () => {
    setLoadingUsers(true);
    setErrorUsers("");
    try {
      const response = await fetch(`${API_BASE_URL}/contact-admin/users`, { cache: "no-store" });
      if (!response.ok) throw new Error("Failed to fetch active users");
      const data = await response.json();
      
      // Included both faculty and students, and handles missing roles safely
      const isManagedUser = (user) => {
        if (!user || typeof user.role !== "string") return true; 
        const role = user.role.toLowerCase();
        return role === "faculty" || role === "student";
      };

      // Handle both flat arrays and nested object responses
      if (Array.isArray(data)) {
        setActiveUsers(data.filter((user) => isManagedUser(user) && !user.archived && user.is_active !== false));
        setArchivedUsers(data.filter((user) => isManagedUser(user) && (user.archived || user.is_active === false)));
      } else {
        setActiveUsers((data.active || []).filter(isManagedUser));
        setArchivedUsers((data.archived || []).filter(isManagedUser));
      }
    } catch (err) {
      console.error(err);
      setErrorUsers("Could not load users from database.");
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleApprove = async (email) => {
    const confirmed = await showConfirm(`Are you sure you want to approve the account for ${email}?`, "Approve Account");
    if (!confirmed) return;

    try {
      const response = await fetch(`${API_BASE_URL}/contact-admin/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Backend approval failed.");
      }

      const data = await response.json();

      await showAlert(`Success! Account created and credentials securely emailed to ${email}.`, "Approved");
      setRequests((prev) => prev.filter((req) => req.email !== email));

      await fetchUsers();
      if (data && data.created_user) {
        const created = data.created_user;
        const exists = activeUsers.some((u) => u.email === created.email);
        if (!exists) {
          setActiveUsers((prev) => [created, ...prev]);
        }
      }
    } catch (err) {
      console.error(err);
      await showAlert(`Error: ${err.message}`, "Error");
    }
  };

  const handleDecline = async (email) => {
    const confirmed = await showConfirm(`Are you sure you want to decline the account for ${email}?`, "Decline Request");
    if (!confirmed) return;
    try {
      const response = await fetch(`${API_BASE_URL}/contact-admin/decline`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to decline request.");
      }
      await fetchPendingRequests();
    } catch (err) {
      console.error(err);
      await showAlert(`Error: ${err.message}`, "Error");
    }
  };

  const handleOpenManage = (user) => {
    setEditingUser(user);
    setAdminPassword("");
    setCredentialsVerified(false);
    setVerifiedUserCredentials(null);
    setAdminAuthError("");
    setNewPassword("");
    setShowPassword(false);
  };

  const handleVerifyAdminPassword = async () => {
    if (!adminPassword.trim()) {
      setAdminAuthError("Please enter your admin password to continue.");
      return;
    }

    const adminEmail = window.localStorage.getItem("email");
    if (!adminEmail) {
      setAdminAuthError("Admin email not found. Please log in again.");
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/users/verify-admin-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          admin_email: adminEmail,
          admin_password: adminPassword,
          target_email: editingUser.email,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Invalid admin credentials.");
      }

      const data = await response.json();
      setCredentialsVerified(true);
      setVerifiedUserCredentials(data);
      setAdminAuthError("");
      setNewPassword("");
      setShowPassword(false);
    } catch (err) {
      setCredentialsVerified(false);
      setVerifiedUserCredentials(null);
      setAdminAuthError(err.message || "Admin verification failed.");
    }
  };

  const handleSavePassword = async () => {
    if (!newPassword.trim()) {
      await showAlert("Please enter a new password.", "Missing Password");
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/users/update-password`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: editingUser.email, new_password: newPassword }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to update password");
      }

      await showAlert(`Password successfully updated for ${editingUser.full_name || editingUser.name || editingUser.email}!`, "Password Updated");
      setEditingUser(null);
      setNewPassword("");
    } catch (err) {
      console.error(err);
      await showAlert(err.message || "Error updating password.", "Error");
    }
  };

  const handleArchiveUser = async (user) => {
    if (!user) return;
    const confirmed = await showConfirm(`Are you sure you want to archive ${user.full_name || user.email}?`, "Archive User");
    if (!confirmed) return;

    try {
      const response = await fetch(`${API_BASE_URL}/users/archive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: user.email }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to archive user.");
      }
      await showAlert("User archived successfully.", "Archived");
      await fetchUsers();
    } catch (err) {
      console.error(err);
      await showAlert(err.message || "Error archiving user.", "Error");
    }
  };

  const handleRestoreUser = async (email) => {
    try {
      const response = await fetch(`${API_BASE_URL}/users/restore`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to restore user.");
      }
      await showAlert("User restored successfully.", "Restored");
      await fetchUsers();
    } catch (err) {
      console.error(err);
      await showAlert(err.message || "Error restoring user.", "Error");
    }
  };

  const handleDeleteUser = async (email) => {
    if (!email) return;
    const confirmed = await showConfirm(`Permanently delete user ${email}? This cannot be undone.`, "Delete User");
    if (!confirmed) return;

    try {
      const response = await fetch(`${API_BASE_URL}/users/${encodeURIComponent(email)}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.detail || "Failed to delete user.");
      }

      await showAlert("User deleted permanently.", "Deleted");
      await fetchUsers();
      await fetchPendingRequests();
    } catch (err) {
      console.error(err);
      await showAlert(err.message || "Error deleting user.", "Error");
    }
  };

  return (
    <div className="space-y-6 relative page-transition">
      <div className="grid gap-5 md:grid-cols-4">
        {[
          { label: "Total Users", value: (activeUsers.length + archivedUsers.length).toString(), tone: "text-red-700" },
          { label: "Active", value: activeUsers.length.toString(), tone: "text-green-700" },
          { label: "Pending", value: requests.length.toString(), tone: "text-amber-700" },
          { label: "Archived", value: archivedUsers.length.toString(), tone: "text-slate-700" },
        ].map((card) => (
          <div key={card.label} className="rounded-3xl bg-white border border-gray-200 p-6 shadow-sm">
            <div className="flex justify-between items-start gap-4">
              <div>
                <p className="text-sm font-medium text-gray-500">{card.label}</p>
                <p className="mt-4 text-3xl font-bold text-gray-900">{card.value}</p>
              </div>
              <div className={`rounded-2xl bg-gray-50 p-3 ${card.tone}`}>
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /></svg>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-3xl bg-white border border-gray-200 p-6 shadow-sm">
        <div className="mb-4">
          <h3 className="text-base font-bold text-gray-900">Pending Account Requests</h3>
          <p className="text-xs text-gray-500 mt-0.5">Review submissions from the administrator contact form.</p>
        </div>

        {loadingRequests ? (
          <div className="py-6 text-center text-sm text-gray-500 fade-in">
            <LoadingSpinner label="Loading requests..." spinnerColor="border-gray-500" />
          </div>
        ) : errorRequests ? (
          <div className="p-4 rounded-xl text-center text-sm text-red-700 bg-red-50 border border-red-100">{errorRequests}</div>
        ) : requests.length === 0 ? (
          <div className="py-8 text-center text-sm text-gray-400 border border-dashed border-gray-200 rounded-2xl">No pending registration requests found.</div>
        ) : (
          <div className="space-y-3">
            {requests.map((request, idx) => {
              const name = request.full_name || request.name || "Unknown User";
              const email = request.email;
              const dept = request.department || "No Department Provided";
              const timestamp = request.requested_at || request.requestedAt || "Recent";
              return (
                <div key={email || idx} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-gray-50 border border-gray-100 transition hover:bg-gray-100/70">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-800 text-sm font-bold">
                      {name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .substring(0, 2)
                        .toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-gray-900">{name}</p>
                        <span className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200/60 rounded px-1.5 py-0.5 font-medium">{timestamp}</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">{email}</p>
                      <p className="text-xs text-gray-400 font-medium mt-1">Dept: {dept}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 self-end sm:self-center">
                    <button onClick={() => handleApprove(email)} className="rounded-full bg-emerald-700 px-4 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800 transition shadow-sm">Approve</button>
                    <button onClick={() => handleDecline(email)} className="rounded-full border border-gray-300 bg-white px-4 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition">Decline</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="rounded-3xl bg-white border border-gray-200 p-6 shadow-sm overflow-x-auto">
        <div className="text-sm font-medium text-gray-500 mb-4">
          {loadingUsers ? <LoadingSpinner label="Loading users..." spinnerColor="border-gray-500" /> : `Showing ${activeUsers.length} active users`}
        </div>
        {errorUsers ? (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{errorUsers}</div>
        ) : null}
        <table className="min-w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-gray-600">
              {['Name', 'Employee ID', 'Department', 'College', 'Status', 'Joined', 'Actions'].map((heading) => (
                <th key={heading} className="py-4 pr-6 font-semibold">{heading}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {activeUsers.length === 0 ? (
              <tr>
                <td colSpan="7" className="py-8 text-center text-gray-400">No active users found in database.</td>
              </tr>
            ) : (
              activeUsers.map((user) => {
                const displayName = user.full_name || user.name || "Unknown";
                const displayInitials = displayName
                  .split(' ')
                  .map((n) => n[0])
                  .join('')
                  .substring(0, 2)
                  .toUpperCase();
                const displayStatus = user.status || (user.is_active === false ? "Inactive" : "Active");

                return (
                  <tr key={user.id || user.email} className="hover:bg-gray-50 transition-colors">
                    <td className="py-5 pr-6">
                      <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-red-700 text-sm font-bold text-white">
                          {displayInitials}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">{displayName}</p>
                          <p className="text-xs text-gray-500">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-5 pr-6 text-gray-600">{user.employee_id || user.id || "N/A"}</td>
                    <td className="py-5 pr-6 text-gray-600">{user.department || "N/A"}</td>
                    <td className="py-5 pr-6 text-gray-600">{user.college || "N/A"}</td>
                    <td className="py-5 pr-6">
                      <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${displayStatus === 'Active' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-700'}`}>
                        {displayStatus}
                      </span>
                    </td>
                    <td className="py-5 pr-6 text-gray-600">{user.joined_date || user.joined || "Recent"}</td>
                    <td className="py-5 pr-6">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleOpenManage(user)}
                          className="rounded-full border border-gray-300 bg-white px-4 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-100 transition shadow-sm"
                        >
                          Manage
                        </button>
                        <button
                          onClick={() => handleArchiveUser(user)}
                          className="rounded-full border border-gray-300 bg-white px-4 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-100 transition"
                        >
                          Archive
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="rounded-3xl bg-white border border-gray-200 p-6 shadow-sm overflow-x-auto mt-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-gray-900">Archived Users</h3>
            <p className="text-xs text-gray-500 mt-0.5">Soft-archived faculty accounts are listed here so you can restore them later.</p>
          </div>
          <span className="inline-flex rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600">
            {archivedUsers.length} archived
          </span>
        </div>

        {archivedUsers.length === 0 ? (
          <div className="py-8 text-center text-sm text-gray-400 border border-dashed border-gray-200 rounded-2xl">No archived users found.</div>
        ) : (
          <div className="space-y-3">
            {archivedUsers.map((user) => {
              const displayName = user.full_name || user.name || "Unknown";
              return (
                <div key={user.email} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-gray-50 border border-gray-100 transition hover:bg-gray-100/70">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{displayName}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{user.email}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleRestoreUser(user.email)}
                      className="rounded-full bg-emerald-700 px-4 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800 transition shadow-sm"
                    >
                      Restore
                    </button>
                    <button
                      onClick={() => handleDeleteUser(user.email)}
                      className="rounded-full bg-red-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-red-700 transition shadow-sm"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl relative">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-xl font-bold text-gray-900">Manage User</h3>
                <p className="text-sm text-gray-500 mt-1">{editingUser.full_name || editingUser.email}</p>
              </div>
              <button onClick={() => setEditingUser(null)} className="text-gray-400 hover:text-gray-600 transition">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="space-y-5">
              
              {!credentialsVerified && (
                <div className="rounded-3xl border border-gray-200 bg-gray-50 p-4">
                  <p className="text-sm font-semibold text-gray-800">Admin verification required</p>
                  <p className="text-xs text-gray-500 mt-1">Enter your admin password to view credentials and make changes.</p>
                  <div className="mt-4 space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Admin Password</label>
                      <input
                        type="password"
                        value={adminPassword}
                        onChange={(e) => setAdminPassword(e.target.value)}
                        placeholder="Enter admin password"
                        className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-red-700 focus:ring-1 focus:ring-red-700 outline-none transition"
                      />
                      {adminAuthError && <p className="text-xs text-red-600 mt-2">{adminAuthError}</p>}
                    </div>
                    <button
                      onClick={handleVerifyAdminPassword}
                      className="w-full rounded-xl bg-red-700 py-3 text-sm font-semibold text-white hover:bg-red-800 transition"
                    >
                      Verify Admin Password
                    </button>
                  </div>
                </div>
              )}

              {credentialsVerified && verifiedUserCredentials && (
                <div className="rounded-3xl border border-green-200 bg-green-50 p-4">
                  <p className="text-sm font-semibold text-green-900">Verified user credentials</p>
                  <div className="mt-3 space-y-2 text-sm text-gray-700">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">Email</span>
                      <span>{verifiedUserCredentials.email}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-medium">Password</span>
                      <span>{verifiedUserCredentials.password}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-medium">Role</span>
                      <span>{verifiedUserCredentials.role || "faculty"}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-medium">Archived</span>
                      <span>{verifiedUserCredentials.archived ? "Yes" : "No"}</span>
                    </div>
                  </div>
                </div>
              )}

              {credentialsVerified && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Enter new password"
                        className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-red-700 focus:ring-1 focus:ring-red-700 outline-none pr-12 transition"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition"
                      >
                        {showPassword ? (
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                        ) : (
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="pt-4 flex flex-col gap-3">
                    <div className="flex gap-3">
                      <button onClick={() => setEditingUser(null)} className="flex-1 rounded-xl border border-gray-300 bg-white py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition">Cancel</button>
                      <button onClick={handleSavePassword} className="flex-1 rounded-xl bg-red-700 py-3 text-sm font-semibold text-white hover:bg-red-800 transition">Save Password</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const UserMgmtBtn = ({ activeTab, setActiveTab }) => {
  const isActive = activeTab === "users";

  return (
    <button
      onClick={() => setActiveTab("users")}
      className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-left transition-all duration-150 relative"
      style={
        isActive
          ? { background: "rgba(255,255,255,0.15)", color: "#ffffff", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.1)" }
          : { color: "rgba(255,255,255,0.65)", background: "transparent" }
      }
    >
      {isActive && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full" style={{ background: "#fff" }} />}
      <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20" style={{ color: isActive ? "#ffffff" : "rgba(255,255,255,0.5)" }}>
        <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
      </svg>
      <span className="text-sm font-medium tracking-wide">User Management</span>
    </button>
  );
};

export default UserMgmtBtn;