import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { usePopup } from "../../components/PopupProvider";
import LoadingSpinner from "../../components/LoadingSpinner";
import { Activity, FileText, Filter, History, Plus, X, Users } from "lucide-react";
import { API_URL } from "../../config/api";


export const UserMgmtContent = () => {
  const { showAlert, showConfirm } = usePopup();
  const navigate = useNavigate();
  const isCampusAdmin = String(localStorage.getItem("role") || "").toLowerCase() === "campus_admin";
  const [requests, setRequests] = useState([]);
  const [changeRequests, setChangeRequests] = useState([]);
  const [changeRequestStatus, setChangeRequestStatus] = useState("pending");
  const [activeUsers, setActiveUsers] = useState([]);
  const [archivedUsers, setArchivedUsers] = useState([]);
  const [loadingRequests, setLoadingRequests] = useState(true);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [errorRequests, setErrorRequests] = useState("");
  const [errorUsers, setErrorUsers] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [programFilter, setProgramFilter] = useState("all");
  const [academicDepartments, setAcademicDepartments] = useState([]);
  const [academicPrograms, setAcademicPrograms] = useState([]);
  const [campusFacultyDepartments, setCampusFacultyDepartments] = useState([]);
  const [showFacultyForm, setShowFacultyForm] = useState(false);
  const [facultyForms, setFacultyForms] = useState([{ full_name: "", email: "", faculty_number: "", department_id: "", program_id: "", error: "" }]);
  const [creatingFaculty, setCreatingFaculty] = useState(false);
  const [showDeanForm, setShowDeanForm] = useState(false);
  const [deanForm, setDeanForm] = useState({ full_name: "", email: "", department_id: "" });
  const [creatingDean, setCreatingDean] = useState(false);
  const [taxonomyError, setTaxonomyError] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [userView, setUserView] = useState("active");
  const [activityUser, setActivityUser] = useState(null);
  const [userActivity] = useState([]);
  const [facultyDetail] = useState(null);
  const [loadingActivity] = useState(false);

  const [editingUser, setEditingUser] = useState(null);
  const [adminPassword, setAdminPassword] = useState("");
  const [credentialsVerified, setCredentialsVerified] = useState(false);
  const [verifiedUserCredentials, setVerifiedUserCredentials] = useState(null);
  const [adminAuthError, setAdminAuthError] = useState("");

  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const fetchPendingRequests = useCallback(async () => {
    setLoadingRequests(true);
    setErrorRequests("");
    try {
      const response = await fetch(`${API_URL}/contact-admin/pending`, { cache: "no-store" });
      if (!response.ok) throw new Error("Failed to load account requests.");
      const data = await response.json();
      setRequests(data);
    } catch (err) {
      console.error(err);
      setErrorRequests("Could not load dynamic account tickets from database.");
    } finally {
      setLoadingRequests(false);
    }
  }, []);

  const fetchChangeRequests = useCallback(async (status = changeRequestStatus) => {
    try {
      const url = new URL(`${API_URL}/admin/user-change-requests`);
      if (status && status !== "all") url.searchParams.set("status", status);
      const response = await fetch(url.toString(), { cache: "no-store" });
      if (response.ok) setChangeRequests(await response.json());
    } catch (err) { console.error(err); }
  }, [changeRequestStatus]);

  const fetchUsers = useCallback(async () => {
    setLoadingUsers(true);
    setErrorUsers("");
    try {
      const response = await fetch(`${API_URL}/contact-admin/users`, { cache: "no-store" });
      if (!response.ok) throw new Error("Failed to fetch active users");
      const data = await response.json();

      const isManagedUser = (user) => {
        if (!user || typeof user.role !== "string") return true;
        const role = user.role.toLowerCase();
        return role === "faculty" || role === "student" || role === "department_dean";
      };
      const uniqueUsers = (users) => Array.from(
        new Map(
          users.map((user) => [user.id ?? String(user.email || "").toLowerCase(), user]),
        ).values(),
      );

      if (Array.isArray(data)) {
        setActiveUsers(uniqueUsers(data.filter((user) => isManagedUser(user) && !user.archived && user.is_active !== false)));
        setArchivedUsers(uniqueUsers(data.filter((user) => isManagedUser(user) && (user.archived || user.is_active === false))));
      } else {
        setActiveUsers(uniqueUsers((data.active || []).filter(isManagedUser)));
        setArchivedUsers(uniqueUsers((data.archived || []).filter(isManagedUser)));
      }
    } catch (err) {
      console.error(err);
      setErrorUsers("Could not load users from database.");
    } finally {
      setLoadingUsers(false);
    }
  }, []);

  const fetchAcademicOptions = useCallback(async () => {
    setTaxonomyError("");
    try {
      const response = await fetch(`${API_URL}/academic-hierarchy`, {
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
        },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.detail || "Could not load department and program options.");
      }
      const departments = (data.campuses || []).flatMap((campus) => campus.departments || []);
      setAcademicDepartments(departments.map((department) => department.name).filter(Boolean));
      setAcademicPrograms(departments.flatMap((department) => (
        (department.programs || []).map((program) => program.name).filter(Boolean)
      )));
      setCampusFacultyDepartments(departments);
    } catch (err) {
      console.error(err);
      setTaxonomyError(err.message || "Could not load department and program options.");
    }
  }, []);

  useEffect(() => {
    if (!isCampusAdmin) {
      fetchPendingRequests();
      fetchChangeRequests();
    }
    fetchUsers();
    fetchAcademicOptions();
  }, [fetchPendingRequests, fetchChangeRequests, fetchUsers, fetchAcademicOptions, isCampusAdmin]);

  useEffect(() => {
    if (isCampusAdmin) return;
    fetchChangeRequests(changeRequestStatus);
  }, [changeRequestStatus, fetchChangeRequests, isCampusAdmin]);

  const reviewChangeRequest = async (id, action) => {
    const response = await fetch(`${API_URL}/admin/user-change-requests/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) { await showAlert(data.detail || "Could not review request.", "User Request"); return; }
    await showAlert(`Request ${action}d successfully.`, "User Request");
    await fetchChangeRequests();
    await fetchUsers();
  };

  const createFacultyAccounts = async (event) => {
    event.preventDefault();
    if (!isCampusAdmin || creatingFaculty) return;

    setCreatingFaculty(true);
    setErrorUsers("");
    const created = [];
    const emailFailures = [];
    const creationFailures = [];

    for (const [index, facultyForm] of facultyForms.entries()) {
      try {
        const response = await fetch(`${API_URL}/campus-admin/faculty-accounts`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
          },
          body: JSON.stringify({
            full_name: facultyForm.full_name,
            email: facultyForm.email,
            faculty_number: facultyForm.faculty_number,
            program_id: Number(facultyForm.program_id),
          }),
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) {
          creationFailures.push({
            ...facultyForm,
            row: index,
            error: result.detail || "Could not create this faculty account.",
          });
        } else if (result.email_status === "sent") {
          created.push(result.email || facultyForm.email);
        } else {
          emailFailures.push(result.email || facultyForm.email);
        }
      } catch (error) {
        creationFailures.push({
          ...facultyForm,
          row: index,
          error: error.message || "Could not create this faculty account.",
        });
      }
    }

    const retainedForms = creationFailures.map(({ row: _row, ...facultyForm }) => facultyForm);
    setFacultyForms(retainedForms.length
      ? retainedForms
      : [{ full_name: "", email: "", faculty_number: "", department_id: "", program_id: "", error: "" }]);
    setCreatingFaculty(false);

    if (created.length || emailFailures.length) {
      await fetchUsers();
      const messages = [];
      if (created.length) {
        messages.push(`Created ${created.length} ${created.length === 1 ? "faculty account" : "faculty accounts"} and sent the temporary password email to: ${created.join(", ")}.`);
      }
      if (emailFailures.length) {
        messages.push(`Account created, but email could not be sent to: ${emailFailures.join(", ")}. Contact your system administrator to resend the invitation.`);
      }
      await showAlert(messages.join("\n\n"), emailFailures.length ? "Account created with email issue" : "Faculty account created");
    }

    if (creationFailures.length) {
      await showAlert(
        `Could not create ${creationFailures.length === 1 ? "one account" : `${creationFailures.length} accounts`}. Correct the highlighted rows and try again.`,
        "Some accounts could not be created",
      );
    } else {
      setShowFacultyForm(false);
    }
  };

  const createDeanAccount = async (event) => {
    event.preventDefault();
    if (!isCampusAdmin || creatingDean) return;
    setCreatingDean(true);
    try {
      const response = await fetch(`${API_URL}/campus-admin/department-admins`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
        },
        body: JSON.stringify({
          full_name: deanForm.full_name,
          email: deanForm.email,
          department_id: Number(deanForm.department_id),
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.detail || "Could not create the dean account.");
      setShowDeanForm(false);
      setDeanForm({ full_name: "", email: "", department_id: "" });
      await showAlert(
        result.email_status === "sent"
          ? `Dean account created for ${result.department}. A secure password setup link was emailed to ${result.email}.`
          : `Dean account created for ${result.department}, but the setup email could not be sent to ${result.email}. Contact your system administrator.`,
        result.email_status === "sent" ? "Dean account created" : "Dean account created with email issue",
      );
    } catch (error) {
      await showAlert(error.message || "Could not create the dean account.", "Could not create dean account");
    } finally {
      setCreatingDean(false);
    }
  };


  const handleApprove = async (email) => {
    const confirmed = await showConfirm(`Are you sure you want to approve the account for ${email}?`, "Approve Account");
    if (!confirmed) return;

    try {
      const response = await fetch(`${API_URL}/contact-admin/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Backend approval failed.");
      }

      const approvalData = await response.json();
      const successMessage = approvalData.demo_temporary_password
        ? `Account Approved — Temporary Password: ${approvalData.demo_temporary_password}\n\nPlease provide these credentials to ${email}. This password is shown only once.`
        : `Success! Account created and credentials securely emailed to ${email}.`;

      await showAlert(successMessage, "Approved");
      setRequests((prev) => prev.filter((req) => req.email !== email));

      await fetchUsers();
    } catch (err) {
      console.error(err);
      await showAlert(`Error: ${err.message}`, "Error");
    }
  };

  const handleDecline = async (email) => {
    const confirmed = await showConfirm(`Are you sure you want to decline the account for ${email}?`, "Decline Request");
    if (!confirmed) return;
    try {
      const response = await fetch(`${API_URL}/contact-admin/decline`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to decline request.");
      }
      if (!isCampusAdmin) await fetchPendingRequests();
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
      const response = await fetch(`${API_URL}/users/verify-admin-password`, {
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
      const response = await fetch(`${API_URL}/users/update-password`, {
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
      const response = await fetch(`${API_URL}/users/archive`, {
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
      const response = await fetch(`${API_URL}/users/restore`, {
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
      const response = await fetch(`${API_URL}/users/${encodeURIComponent(email)}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
        },
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

  const matchesSearch = (user) => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return true;
    return [user.full_name, user.name, user.email, user.department, user.program, user.employee_id]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(query));
  };

  const matchesUserFilters = (user) => {
    return (departmentFilter === "all" || user.department === departmentFilter)
      && (programFilter === "all" || user.program === programFilter);
  };

  const formatActivityDate = (value) => {
    if (!value) return "No activity";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "No activity";
    const elapsedMs = Date.now() - date.getTime();
    const elapsedHours = Math.floor(elapsedMs / (1000 * 60 * 60));
    if (elapsedHours < 24) {
      if (elapsedHours < 1) {
        const elapsedMinutes = Math.max(1, Math.floor(elapsedMs / (1000 * 60)));
        return `${elapsedMinutes} minute${elapsedMinutes === 1 ? "" : "s"} ago`;
      }
      return `${elapsedHours} hour${elapsedHours === 1 ? "" : "s"} ago`;
    }
    return date.toLocaleDateString([], { dateStyle: "medium" });
  };

  const formatJoinedDate = (value) => {
    if (!value) return "N/A";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "N/A" : date.toLocaleDateString([], { dateStyle: "medium" });
  };

  const formatRequestedDateTime = (value) => {
    if (!value) return "N/A";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "N/A" : date.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
  };

  const filteredRequests = requests.filter(matchesSearch);
  const changeRequestFilter = (request) => changeRequestStatus === "all" ? true : request.status === changeRequestStatus;
  const filteredChangeRequests = changeRequests.filter(changeRequestFilter);
  const filteredActiveUsers = activeUsers.filter((user) => matchesSearch(user) && matchesUserFilters(user));
  const filteredArchivedUsers = archivedUsers.filter((user) => matchesSearch(user) && matchesUserFilters(user));
  const allUsers = [...activeUsers, ...archivedUsers];
  const departmentOptions = [...new Set([
    ...academicDepartments,
    ...allUsers.map((user) => user.department).filter((department) => department && department !== "N/A"),
  ])].sort((left, right) => left.localeCompare(right));
  const programOptions = [...new Set([
    ...academicPrograms,
    ...allUsers.map((user) => user.program).filter((program) => program && program !== "N/A"),
  ])].sort((left, right) => left.localeCompare(right));

  const visibleUsers = filteredActiveUsers;
  const usersPerPage = 15;
  const totalPages = Math.max(1, Math.ceil(visibleUsers.length / usersPerPage));
  const paginatedUsers = visibleUsers.slice((currentPage - 1) * usersPerPage, currentPage * usersPerPage);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, departmentFilter, programFilter, userView]);

  return (
    <div className="bq-admin-user-management bq-attached-user-ui relative space-y-4 page-transition">
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center justify-between gap-4 bg-[#F0645A] px-5 py-4 text-white">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/75">Administration</p>
            <h1 className="mt-1 text-xl font-bold">User management</h1>
            <p className="mt-1 text-xs text-white/80">{isCampusAdmin ? "Manage active and archived user accounts." : "Review accounts, departments, activity, and access status."}</p>
          </div>
          <Users className="h-8 w-8 shrink-0" />
        </div>
        <div className={`grid gap-3 px-5 py-4 sm:grid-cols-2 ${isCampusAdmin ? "lg:grid-cols-3" : "lg:grid-cols-4"}`}>
          <div><p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Total accounts</p><p className="mt-0.5 text-lg font-bold text-gray-900">{activeUsers.length + archivedUsers.length}</p></div>
          {!isCampusAdmin && <div><p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Pending review</p><p className="mt-0.5 text-lg font-bold text-amber-700">{requests.length}</p></div>}
          <div><p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Active accounts</p><p className="mt-0.5 text-lg font-bold text-emerald-700">{activeUsers.length}</p></div>
          <div><p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Archived accounts</p><p className="mt-0.5 text-lg font-bold text-gray-700">{archivedUsers.length}</p></div>
        </div>
      </div>
        <div className="relative rounded-md border border-gray-200 bg-white p-2 shadow-sm">
          <div className="flex flex-col gap-2 sm:flex-row">
            <input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Search users, email, department, or program..." className="bq-field min-w-0 flex-1 px-3 py-1.5 text-sm" />
            <button type="button" onClick={() => setFilterOpen((open) => !open)} className={`inline-flex items-center justify-center gap-2 rounded-md border px-3 py-1.5 text-sm font-semibold transition ${filterOpen || departmentFilter !== "all" || programFilter !== "all" ? "border-[#B4454A] bg-red-50 text-[#B4454A]" : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"}`}><Filter size={15} /> Filter</button>
          </div>
          {filterOpen && <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
            <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-semibold text-gray-600">Department<select value={departmentFilter} onChange={(event) => setDepartmentFilter(event.target.value)} className="bq-field mt-1 w-full px-2 py-2 text-sm"><option value="all">All departments</option>{departmentOptions.map((department) => <option key={department} value={department}>{department}</option>)}</select></label>
            <label className="text-xs font-semibold text-gray-600">Program<select value={programFilter} onChange={(event) => setProgramFilter(event.target.value)} className="bq-field mt-1 w-full px-2 py-2 text-sm"><option value="all">All programs</option>{programOptions.map((program) => <option key={program} value={program}>{program}</option>)}</select></label>
            </div>
            {taxonomyError && <p role="alert" className="mt-2 text-xs text-red-700">{taxonomyError}</p>}
            <div className="mt-3 flex justify-end">
              <button type="button" onClick={() => { setDepartmentFilter("all"); setProgramFilter("all"); }} className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-600 transition hover:bg-gray-100">Clear filters</button>
            </div>
          </div>}
        </div>
      <div className="flex flex-wrap gap-1 rounded-md border border-gray-200 bg-white p-1 shadow-sm" role="tablist" aria-label="User management sections">
        {[
          ...(!isCampusAdmin ? [
            ["pending", "Pending requests", requests.length],
            ["changes", "User requests", changeRequests.length],
          ] : []),
          ["active", "Active users", filteredActiveUsers.length],
          ["archived", "Archived users", filteredArchivedUsers.length],
        ].map(([view, label, count]) => (
          <button
            key={view}
            type="button"
            role="tab"
            aria-selected={userView === view}
            onClick={() => setUserView(view)}
            className={`rounded-md px-3 py-1.5 text-sm font-semibold transition-colors ${userView === view ? "bg-red-700 text-white" : "text-gray-600 hover:bg-gray-100"}`}
          >
            {label} <span className="ml-1 opacity-75">({count})</span>
          </button>
        ))}
      </div>

      {userView === "pending" && <div className="bq-admin-user-section rounded-md bg-white border border-gray-200 p-4 shadow-sm">
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
        ) : filteredRequests.length === 0 ? (
          <div className="py-8 text-center text-sm text-gray-400 border border-dashed border-gray-200 rounded-2xl">No pending registration requests found.</div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-gray-200">
            <table className="w-full table-fixed text-left text-sm">
              <colgroup><col className="w-[16%]" /><col className="w-[18%]" /><col className="w-[20%]" /><col className="w-[18%]" /><col className="w-[14%]" /><col className="w-[14%]" /></colgroup>
              <thead className="border-b border-gray-200 bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                <tr><th className="px-4 py-3">Applicant</th><th className="px-4 py-3">Email</th><th className="px-4 py-3">Department</th><th className="px-4 py-3">Program</th><th className="px-4 py-3">Requested</th><th className="px-4 py-3">Actions</th></tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {filteredRequests.map((request, idx) => {
                  const name = request.full_name || request.name || "Unknown User";
                  const email = request.email;
                  return (
                    <tr key={email || idx} className="transition hover:bg-gray-50">
                      <td className="px-4 py-3 font-semibold text-gray-900">{name}</td>
                      <td className="px-4 py-3 text-xs text-gray-500">{email}</td>
                      <td className="px-4 py-3 text-gray-700">{request.department || "N/A"}</td>
                      <td className="px-4 py-3 text-gray-700">{request.program || "N/A"}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-500">{formatRequestedDateTime(request.requested_at || request.requestedAt || request.created_at)}</td>
                      <td className="px-3 py-3"><div className="flex flex-nowrap items-center gap-1.5"><button onClick={() => handleApprove(email)} className="whitespace-nowrap rounded-md bg-emerald-700 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800 transition">Approve</button><button onClick={() => handleDecline(email)} className="whitespace-nowrap rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition">Decline</button></div></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>}

      {userView === "changes" && <div className="bq-admin-user-section rounded-md bg-white border border-gray-200 p-4 shadow-sm overflow-hidden">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-base font-bold text-gray-900">User change requests</h3>
            <p className="mt-1 text-xs text-gray-500">Review department and other account-change requests from faculty users.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              ["pending", "Pending"],
              ["approved", "Approved"],
              ["declined", "Declined"],
              ["all", "All"],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setChangeRequestStatus(value)}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${changeRequestStatus === value ? "bg-red-700 text-white" : "border border-gray-300 bg-white text-gray-600 hover:bg-gray-50"}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full table-fixed text-left text-sm">
            <thead className="border-b border-gray-200 bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="w-[20%] px-4 py-3">User</th>
                <th className="w-[14%] px-4 py-3">Type</th>
                <th className="w-[18%] px-4 py-3">Current</th>
                <th className="w-[18%] px-4 py-3">Requested</th>
                <th className="w-[14%] px-4 py-3">Status</th>
                <th className="w-[16%] px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredChangeRequests.length === 0 ? (
                <tr>
                  <td colSpan="6" className="p-8 text-center text-sm text-gray-500">No {changeRequestStatus === "all" ? "user change" : changeRequestStatus} requests.</td>
                </tr>
              ) : (
                filteredChangeRequests.map((request) => (
                  <tr key={request.id}>
                    <td className="break-words px-4 py-3">
                      <strong>{request.user_name}</strong>
                      <span className="block text-xs text-gray-500">{request.email}</span>
                    </td>
                    <td className="px-4 py-3 capitalize">{request.request_type}</td>
                    <td className="break-words px-4 py-3 text-gray-600">{request.current_value || "Unassigned"}</td>
                    <td className="break-words px-4 py-3 font-semibold text-gray-800">{request.requested_value}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-wide ${request.status === "approved" ? "bg-emerald-100 text-emerald-700" : request.status === "declined" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>
                        {request.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {request.status === "pending" ? (
                        <div className="flex flex-wrap gap-1.5">
                          <button type="button" onClick={() => reviewChangeRequest(request.id, "approve")} className="rounded-md bg-emerald-700 px-2.5 py-1.5 text-xs font-semibold text-white">Approve</button>
                          <button type="button" onClick={() => reviewChangeRequest(request.id, "decline")} className="rounded-md border border-gray-300 px-2.5 py-1.5 text-xs font-semibold text-gray-600">Decline</button>
                        </div>
                      ) : (
                        <div className="text-xs text-gray-500">
                          {request.reviewer_name ? `Reviewed by ${request.reviewer_name}` : "Reviewed"}
                          {request.reviewed_at && <div className="mt-1">{new Date(request.reviewed_at).toLocaleDateString([], { dateStyle: "medium" })}</div>}
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>}

      {userView === "active" && <div className="bq-admin-user-section rounded-md bg-white border border-gray-200 p-4 shadow-sm overflow-hidden">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm font-medium text-gray-500">
            {loadingUsers ? <LoadingSpinner label="Loading users..." spinnerColor="border-gray-500" /> : `Showing ${filteredActiveUsers.length} of ${activeUsers.length} active users`}
          </div>
          {isCampusAdmin && (
            <div className="flex flex-col items-stretch gap-2 sm:items-end">
              <button
                type="button"
                onClick={() => {
                  setShowFacultyForm((visible) => !visible);
                  setShowDeanForm(false);
                }}
                className="inline-flex items-center justify-center gap-2 rounded-md bg-red-700 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-red-800"
              >
                <Plus size={16} />
                Add faculty member
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowDeanForm((visible) => !visible);
                  setShowFacultyForm(false);
                }}
                className="inline-flex items-center justify-center gap-2 rounded-md border border-red-200 bg-white px-3.5 py-2 text-sm font-semibold text-red-800 shadow-sm transition hover:bg-red-50"
              >
                <Plus size={16} />
                Add dean
              </button>
            </div>
          )}
        </div>
        {showDeanForm && isCampusAdmin && (
          <form onSubmit={createDeanAccount} className="mb-5 rounded-xl border border-gray-200 bg-gray-50 p-4">
            <div className="mb-3">
              <h3 className="text-sm font-semibold text-gray-900">Add a department dean</h3>
              <p className="mt-1 text-xs text-gray-500">The dean will receive Department Admin access for the selected department and an email link to set a password.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <label className="text-xs font-semibold text-gray-600">
                Full name
                <input required minLength={2} maxLength={100} value={deanForm.full_name} onChange={(event) => setDeanForm((current) => ({ ...current, full_name: event.target.value }))} className="bq-field mt-1 w-full px-3 py-2 text-sm" placeholder="Enter dean's full name" />
              </label>
              <label className="text-xs font-semibold text-gray-600">
                Email
                <input required type="email" maxLength={255} value={deanForm.email} onChange={(event) => setDeanForm((current) => ({ ...current, email: event.target.value }))} className="bq-field mt-1 w-full px-3 py-2 text-sm" placeholder="name@institution.edu" />
              </label>
              <label className="text-xs font-semibold text-gray-600">
                Department
                <select required value={deanForm.department_id} onChange={(event) => setDeanForm((current) => ({ ...current, department_id: event.target.value }))} className="bq-field mt-1 w-full px-3 py-2 text-sm">
                  <option value="">Select department</option>
                  {campusFacultyDepartments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
                </select>
              </label>
            </div>
            {taxonomyError && <p role="alert" className="mt-3 text-sm text-red-700">{taxonomyError}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" disabled={creatingDean} onClick={() => { setShowDeanForm(false); setDeanForm({ full_name: "", email: "", department_id: "" }); }} className="bq-secondary-button px-3 py-2 text-sm">Cancel</button>
              <button type="submit" disabled={creatingDean || !campusFacultyDepartments.length} className="inline-flex items-center gap-2 rounded-md bg-red-700 px-3.5 py-2 text-sm font-semibold text-white hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-50">
                {creatingDean ? "Creating dean..." : "Create dean account"}
              </button>
            </div>
          </form>
        )}
        {showFacultyForm && isCampusAdmin && (
          <form onSubmit={createFacultyAccounts} className="mb-5 rounded-xl border border-gray-200 bg-gray-50 p-4">
            <div className="mb-3">
              <h3 className="text-sm font-semibold text-gray-900">Add faculty accounts</h3>
              <p className="mt-1 text-xs text-gray-500">Faculty will be assigned to a program in your campus and emailed a secure link to set a password.</p>
            </div>
            <div className="space-y-3">
              {facultyForms.map((facultyForm, index) => {
                const selectedDepartment = campusFacultyDepartments.find(
                  (department) => String(department.id) === String(facultyForm.department_id),
                );
                const updateRow = (field, value) => setFacultyForms((current) => current.map(
                  (row, rowIndex) => rowIndex === index
                    ? { ...row, [field]: value, ...(field === "department_id" ? { program_id: "" } : {}), error: "" }
                    : row,
                ));
                return (
                  <div key={index} className="rounded-lg border border-gray-200 bg-white p-3">
                    <div className="mb-3 flex items-center justify-between">
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Faculty member {index + 1}</p>
                      {facultyForms.length > 1 && (
                        <button
                          type="button"
                          disabled={creatingFaculty}
                          aria-label={`Remove faculty member ${index + 1}`}
                          onClick={() => setFacultyForms((current) => current.filter((_, rowIndex) => rowIndex !== index))}
                          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                        >
                          <X size={13} /> Remove
                        </button>
                      )}
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                      <label className="text-xs font-semibold text-gray-600">
                        Number
                        <input required aria-label={`Number for faculty member ${index + 1}`} type="text" inputMode="numeric" pattern="[0-9]+" maxLength={50} value={facultyForm.faculty_number} onChange={(event) => updateRow("faculty_number", event.target.value)} className="bq-field mt-1 w-full px-3 py-2 text-sm" placeholder="Enter faculty number" />
                      </label>
                      <label className="text-xs font-semibold text-gray-600">
                        Full name
                        <input required aria-label={`Full name for faculty member ${index + 1}`} minLength={2} maxLength={100} value={facultyForm.full_name} onChange={(event) => updateRow("full_name", event.target.value)} className="bq-field mt-1 w-full px-3 py-2 text-sm" placeholder="Enter full name" />
                      </label>
                      <label className="text-xs font-semibold text-gray-600">
                        Email
                        <input required aria-label={`Email for faculty member ${index + 1}`} type="email" maxLength={255} value={facultyForm.email} onChange={(event) => updateRow("email", event.target.value)} className="bq-field mt-1 w-full px-3 py-2 text-sm" placeholder="name@institution.edu" />
                      </label>
                      <label className="text-xs font-semibold text-gray-600">
                        Department
                        <select required aria-label={`Department for faculty member ${index + 1}`} value={facultyForm.department_id} onChange={(event) => updateRow("department_id", event.target.value)} className="bq-field mt-1 w-full px-3 py-2 text-sm">
                          <option value="">Select department</option>
                          {campusFacultyDepartments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
                        </select>
                      </label>
                      <label className="text-xs font-semibold text-gray-600">
                        Program
                        <select required aria-label={`Program for faculty member ${index + 1}`} disabled={!selectedDepartment} value={facultyForm.program_id} onChange={(event) => updateRow("program_id", event.target.value)} className="bq-field mt-1 w-full px-3 py-2 text-sm disabled:cursor-not-allowed disabled:bg-gray-100">
                          <option value="">Select program</option>
                          {(selectedDepartment?.programs || []).map((program) => <option key={program.id} value={program.id}>{program.name}</option>)}
                        </select>
                      </label>
                    </div>
                    {facultyForm.error && <p role="alert" className="mt-3 text-sm font-medium text-red-700">{facultyForm.error}</p>}
                  </div>
                );
              })}
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                disabled={creatingFaculty}
                onClick={() => setFacultyForms((current) => [...current, { full_name: "", email: "", faculty_number: "", department_id: "", program_id: "", error: "" }])}
                className="inline-flex items-center gap-2 rounded-md border border-red-200 bg-white px-3 py-2 text-sm font-semibold text-red-800 hover:bg-red-50 disabled:opacity-50"
              >
                <Plus size={15} /> Add another
              </button>
              <div className="flex gap-2">
                <button type="button" disabled={creatingFaculty} onClick={() => setShowFacultyForm(false)} className="bq-secondary-button px-3 py-2 text-sm">Cancel</button>
                <button type="submit" disabled={creatingFaculty || !campusFacultyDepartments.length} className="rounded-md bg-red-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-50">
                  {creatingFaculty ? "Creating accounts..." : "Create faculty accounts"}
                </button>
              </div>
            </div>
            {taxonomyError && <p role="alert" className="mt-3 text-sm text-red-700">{taxonomyError}</p>}
          </form>
        )}
        {errorUsers ? (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{errorUsers}</div>
        ) : null}
        {visibleUsers.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-200 py-10 text-center text-sm text-gray-400">No active users found in database.</div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-gray-200">
            <table className="w-full table-fixed text-left text-sm">
              <colgroup>
                <col className="w-[24%]" />
                <col className="w-[21%]" />
                <col className="w-[21%]" />
                <col className="w-[14%]" />
                <col className="w-[9%]" />
                <col className="w-[11%]" />
              </colgroup>
              <thead className="border-b border-gray-200 bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3">Department</th>
                  <th className="px-4 py-3">Program</th>
                  <th className="px-4 py-3">Date joined</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
            {paginatedUsers.map((user) => {
              const displayName = user.full_name || user.name || "Unknown";
              const displayInitials = displayName.split(" ").map((n) => n[0]).join("").substring(0, 2).toUpperCase();
              const displayStatus = user.status || (user.is_active === false ? "Inactive" : "Active");
              return (
                <tr key={user.id || user.email} className="transition hover:bg-gray-50">
                  <td className="px-3 py-3"><div className="flex min-w-0 items-center gap-2.5"><div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-700 text-xs font-bold text-white">{displayInitials}</div><div className="min-w-0"><p className="break-words font-semibold text-gray-900">{displayName}</p><p className="break-all text-xs text-gray-500">{user.email}</p>{user.role === "department_dean" && <span className="mt-1 inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">Department Dean</span>}</div></div></td>
                  <td className="break-words px-3 py-3 text-gray-700">{user.department || "N/A"}</td>
                  <td className="break-words px-3 py-3 text-gray-700">{user.program || "N/A"}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-xs text-gray-500">{formatJoinedDate(user.joined || user.created_at)}</td>
                  <td className="px-3 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${displayStatus === "Active" ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-700"}`}>{displayStatus}</span></td>
                  <td className="px-3 py-3"><button type="button" onClick={() => navigate(`/admin/users/${user.id}`)} className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-100 transition"><Activity size={13} /> View profile</button></td>
                </tr>
              );
            })}
              </tbody>
            </table>
          </div>
        )}
        {visibleUsers.length > 0 && <div className="mt-4 flex items-center justify-between gap-3 text-sm text-gray-500"><span>Page {currentPage} of {totalPages}</span><div className="flex gap-2"><button type="button" disabled={currentPage === 1} onClick={() => setCurrentPage((page) => Math.max(1, page - 1))} className="bq-secondary-button px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50">Previous</button><button type="button" disabled={currentPage === totalPages} onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))} className="bq-secondary-button px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50">Next</button></div></div>}
      </div>}

      {userView === "archived" && <div className="bq-admin-user-section rounded-md bg-white border border-gray-200 p-4 shadow-sm overflow-hidden mt-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-gray-900">Archived Users</h3>
            <p className="text-xs text-gray-500 mt-0.5">Soft-archived faculty accounts are listed here so you can restore them later.</p>
          </div>
          <span className="inline-flex rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600">
            {archivedUsers.length} archived
          </span>
        </div>

            {filteredArchivedUsers.length === 0 ? (
          <div className="py-8 text-center text-sm text-gray-400 border border-dashed border-gray-200 rounded-2xl">No archived users found.</div>
        ) : (
          <div className="space-y-3">
            {filteredArchivedUsers.map((user) => {
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
      </div>}

      {activityUser && (
        <div className="bq-modal-overlay fixed inset-0 z-50 flex justify-end" onMouseDown={(event) => { if (event.target === event.currentTarget) setActivityUser(null); }}>
          <aside className="bq-modal-panel h-full w-full max-w-xl overflow-y-auto rounded-none border-l p-6">
            <div className="mb-6 flex items-start justify-between gap-4 border-b border-gray-200 pb-4">
              <div><p className="bq-eyebrow">User activity</p><h3 className="text-xl font-bold text-gray-900">{activityUser.full_name || activityUser.email}</h3><p className="mt-1 text-sm text-gray-500">{activityUser.email}</p><div className="mt-4 grid grid-cols-2 gap-2 text-xs sm:grid-cols-3"><div className="rounded-lg border border-gray-200 bg-gray-50 p-2"><span className="block text-gray-400">Joined</span><strong className="mt-1 block text-gray-700">{formatActivityDate(activityUser.created_at || activityUser.joined)}</strong></div><div className="rounded-lg border border-gray-200 bg-gray-50 p-2"><span className="block text-gray-400">Last Active</span><strong className="mt-1 block text-gray-700">{formatActivityDate(activityUser.last_active)}</strong></div><div className="rounded-lg border border-gray-200 bg-gray-50 p-2"><span className="block text-gray-400">Last Export</span><strong className="mt-1 block text-gray-700">{formatActivityDate(activityUser.last_export)}</strong></div><div className="rounded-lg border border-gray-200 bg-gray-50 p-2"><span className="block text-gray-400">Last Generate</span><strong className="mt-1 block text-gray-700">{formatActivityDate(activityUser.last_generate)}</strong></div><div className="rounded-lg border border-gray-200 bg-gray-50 p-2"><span className="block text-gray-400">Activity</span><strong className="mt-1 block text-gray-700">{activityUser.activity_count ?? 0} records</strong></div></div><div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={() => { setActivityUser(null); handleOpenManage(activityUser); }} className="bq-primary-button px-3 py-2 text-xs">Manage User</button>{activityUser.archived ? <button type="button" onClick={() => { setActivityUser(null); handleRestoreUser(activityUser.email); }} className="bq-secondary-button px-3 py-2 text-xs">Restore User</button> : <button type="button" onClick={() => { setActivityUser(null); handleArchiveUser(activityUser); }} className="bq-secondary-button px-3 py-2 text-xs">Archive User</button>}</div></div>
              <button type="button" onClick={() => setActivityUser(null)} className="bq-secondary-button px-2 py-2"><X size={16} /></button>
            </div>
            {loadingActivity ? <LoadingSpinner label="Loading faculty history..." spinnerColor="border-gray-500" /> : facultyDetail && <div className="space-y-6">
              <section><h4 className="mb-3 flex items-center gap-2 text-sm font-bold text-gray-900"><FileText size={15} /> Subjects created ({facultyDetail.subjects.length})</h4>{facultyDetail.subjects.length ? <div className="space-y-2">{facultyDetail.subjects.map((subject) => <article key={subject.id} className="rounded-xl border border-gray-200 bg-gray-50 p-3"><div className="flex items-center justify-between gap-3"><div><p className="font-semibold text-gray-900">{subject.name}</p><p className="text-xs text-gray-500">{subject.code || "No course code"} · {subject.department}</p></div><span className="text-xs text-gray-400">{formatActivityDate(subject.created_at)}</span></div></article>)}</div> : <p className="text-sm text-gray-500">No subjects created.</p>}</section>
              <section><h4 className="mb-3 flex items-center gap-2 text-sm font-bold text-gray-900"><FileText size={15} /> Questions created ({facultyDetail.questions.length})</h4>{facultyDetail.questions.length ? <div className="space-y-2">{facultyDetail.questions.map((question) => <article key={question.id} className="rounded-xl border border-gray-200 bg-gray-50 p-3"><p className="font-semibold text-gray-900">{question.question}</p><p className="mt-1 text-xs text-gray-500">{question.subject} · {question.topic} · {question.type} · {question.bloom_level || "Unclassified"} · {question.difficulty || "No difficulty"}</p><div className="mt-2 flex justify-end"><span className="text-xs text-gray-400">{formatActivityDate(question.created_at)}</span></div></article>)}</div> : <p className="text-sm text-gray-500">No questions created.</p>}</section>
              <section><h4 className="mb-3 flex items-center gap-2 text-sm font-bold text-gray-900"><History size={15} /> Complete activity history ({userActivity.length})</h4>{userActivity.length ? <div className="space-y-3">{userActivity.map((entry) => <article key={entry.id} className="rounded-xl border border-gray-200 bg-gray-50 p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold text-gray-900">{entry.action}</p><p className="mt-1 text-sm text-gray-500">{entry.detail || "No additional details"}</p>{entry.filename && <p className="mt-1 text-xs text-gray-400">File: {entry.filename}</p>}</div><span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${entry.status === "error" ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"}`}>{entry.status || "success"}</span></div><p className="mt-3 text-xs text-gray-400">{entry.type || "activity"} · {formatActivityDate(entry.created_at)}</p></article>)}</div> : <p className="text-sm text-gray-500">No recorded activity.</p>}</section>
            </div>}
          </aside>
        </div>
      )}

      {editingUser && (
        <div className="bq-modal-overlay fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="bq-modal-panel relative w-full max-w-md p-6">
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
                    <p className="text-xs text-gray-500">Password is protected and cannot be displayed. Use the password update form below to set a new one.</p>
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

const UserMgmtBtn = ({ activeTab, setActiveTab, collapsed }) => {
  const isActive = activeTab === "users";

  return (
    <button
      title={collapsed ? "User Management" : undefined}
      aria-label={collapsed ? "User Management" : undefined}
      onClick={() => setActiveTab("users")}
      className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-left transition-all duration-150 relative"
      style={
        isActive
          ? { background: "var(--bq-accent)", color: "#ffffff", boxShadow: "0 8px 20px rgba(180, 69, 74, 0.14)" }
          : { color: "var(--bq-muted)", background: "transparent" }
      }
    >
      {isActive && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full" style={{ background: "#fff" }} />}
      <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20" style={{ color: isActive ? "#ffffff" : "var(--bq-accent)" }}>
        <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
      </svg>
      <span className="text-sm font-medium tracking-wide">User Management</span>
    </button>
  );
};

export default UserMgmtBtn;