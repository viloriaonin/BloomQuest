import React from "react";
import { createPortal } from "react-dom";
import {
  ArrowLeft,
  BookOpen,
  Building2,
  Check,
  ChevronRight,
  GraduationCap,
  Layers3,
  LoaderCircle,
  Mail,
  MoreHorizontal,
  Plus,
  RotateCcw,
  Save,
  Users,
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { API_URL } from "../../config/api";
import DepartmentUserManagement from "./DepartmentUserManagement";

const ACADEMIC_API = API_URL;

const pluralize = (count, singular, plural = `${singular}s`) =>
  `${count} ${count === 1 ? singular : plural}`;

const formatRequestDate = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(date);
};

const getProgramChairName = (program) =>
  program.faculty?.find((member) => String(member.id) === String(program.chair_id))?.name ||
  program.chair_name ||
  program.chair?.name ||
  "";

const OverflowMenu = ({ onEdit, onArchive, onDelete, readOnly = false }) => {
  if (readOnly) return null;

  return (
    <details className="relative" onClick={(event) => event.stopPropagation()}>
      <summary className="flex h-8 w-8 cursor-pointer list-none items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 [&::-webkit-details-marker]:hidden">
        <MoreHorizontal size={17} />
      </summary>
      <div className="absolute right-0 top-9 z-20 min-w-32 rounded-xl border border-slate-200 bg-white p-1.5 text-left shadow-lg">
        {onEdit && (
          <button type="button" onClick={onEdit} className="block w-full rounded-lg px-3 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50">
            Edit
          </button>
        )}
        {onArchive && (
          <button type="button" onClick={onArchive} className="block w-full rounded-lg px-3 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50">
            Archive
          </button>
        )}
        {onDelete && (
          <button type="button" onClick={onDelete} className="block w-full rounded-lg px-3 py-2 text-left text-xs font-medium" style={{ color: "var(--bq-danger)", background: "transparent" }}>
            Delete
          </button>
        )}
      </div>
    </details>
  );
};

const Breadcrumbs = ({ campus, department, program, basePath = "/admin/academic" }) => {
  const navigate = useNavigate();
  const linkClass = "rounded px-1 py-0.5 transition hover:text-[var(--bq-accent)]";

  return (
    <nav className="mb-2 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500" aria-label="Breadcrumb">
      <button type="button" onClick={() => navigate(basePath)} className={linkClass}>Academic Management</button>
      {campus && (
        <>
          <ChevronRight size={13} />
          <button type="button" onClick={() => navigate(`${basePath}/campus/${campus.id}`)} className={department || program ? linkClass : "font-medium text-slate-700"}>
            {campus.name}
          </button>
        </>
      )}
      {department && (
        <>
          <ChevronRight size={13} />
          <button type="button" onClick={() => navigate(`${basePath}/campus/${campus.id}/department/${department.id}`)} className={program ? linkClass : "font-medium text-slate-700"}>
            {department.name}
          </button>
        </>
      )}
      {program && (
        <>
          <ChevronRight size={13} />
          <span className="font-medium text-slate-700">{program.name}</span>
        </>
      )}
    </nav>
  );
};

const SummaryStat = ({ icon: Icon, label, value }) => (
  <div className="rounded-xl border px-4 py-3" style={{ background: "var(--admin-panel, #14161c)", borderColor: "var(--admin-border, #262a34)", color: "var(--admin-text, #ecedef)" }}>
    <div className="flex items-center gap-2 text-xs font-medium" style={{ color: "var(--admin-muted, #8b8f99)" }}>
      <Icon size={14} style={{ color: "var(--bq-accent)" }} />
      {label}
    </div>
    <strong className="mt-2 block text-xl font-semibold" style={{ color: "var(--admin-text, #ecedef)" }}>{value}</strong>
  </div>
);

const ProgramChairAccountForm = ({ program, onCreateAccount }) => {
  const [form, setForm] = React.useState({ full_name: "", email: "" });
  const [state, setState] = React.useState({ saving: false, error: "" });

  const handleSubmit = async (event) => {
    event.preventDefault();
    setState({ saving: true, error: "" });
    try {
      await onCreateAccount(program.id, form);
      setForm({ full_name: "", email: "" });
      setState({ saving: false, error: "" });
    } catch (error) {
      setState({ saving: false, error: error.message || "Could not create the program chair account." });
    }
  };

  return (
    <section className="mb-5 rounded-2xl border p-4" style={{ background: "var(--admin-panel, #14161c)", borderColor: "var(--admin-border, #262a34)", color: "var(--admin-text, #ecedef)" }}>
      <h3 className="text-sm font-semibold">Create program chair login</h3>
      <p className="mt-1 text-xs text-slate-500">A faculty account will be assigned to this program, and its temporary password will be emailed.</p>
      {program.chair_id ? (
        <p className="mt-3 text-sm text-emerald-700">A program chair account is assigned to this program.</p>
      ) : (
        <form onSubmit={handleSubmit} className="mt-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-semibold text-slate-600">
              Chair full name
              <input required minLength={2} maxLength={100} value={form.full_name} onChange={(event) => setForm((current) => ({ ...current, full_name: event.target.value }))} className="bq-field mt-1 w-full px-3" placeholder="Enter full name" />
            </label>
            <label className="text-xs font-semibold text-slate-600">
              Chair email
              <input required type="email" maxLength={255} value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} className="bq-field mt-1 w-full px-3" placeholder="name@institution.edu" />
            </label>
          </div>
          <div className="mt-3 flex justify-end">
            <button type="submit" disabled={state.saving} className="rounded-xl px-4 py-2 text-sm font-semibold text-white shadow-sm transition disabled:cursor-not-allowed disabled:opacity-70" style={{ background: "var(--bq-accent-strong)" }}>
              {state.saving ? "Creating account..." : "Create account and email credentials"}
            </button>
          </div>
        </form>
      )}
      {state.error && <p role="alert" className="mt-3 text-sm text-red-700">{state.error}</p>}
    </section>
  );
};

const DepartmentLeadershipSection = ({ department, faculty = [], onSave, onCreateAccount, readOnly = false, showDeanFacultyPicker = true }) => {
  const [form, setForm] = React.useState({
    dean_name: department?.dean_name || department?.dean?.name || "",
    dean_id: department?.dean_id || "",
  });
  const [saveState, setSaveState] = React.useState({ status: "idle", message: "" });
  const [accountForm, setAccountForm] = React.useState({ full_name: "", email: "" });
  const [accountState, setAccountState] = React.useState({ saving: false, message: "", error: "" });

  React.useEffect(() => {
    setForm({
      dean_name: department?.dean_name || department?.dean?.name || "",
      dean_id: department?.dean_id || "",
    });
    setSaveState({ status: "idle", message: "" });
    setAccountForm({ full_name: "", email: "" });
    setAccountState({ saving: false, message: "", error: "" });
  }, [department?.id, department?.dean_id, department?.dean_name, department?.dean?.name]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (readOnly || !onSave) return;

    setSaveState({ status: "saving", message: "" });
    try {
      await onSave({
        dean_name: form.dean_name.trim(),
        dean_id: form.dean_id ? Number(form.dean_id) : null,
      });
      setSaveState({ status: "saved", message: "Dean assignment saved." });
    } catch (error) {
      setSaveState({
        status: "error",
        message: error.message || "Could not save the dean assignment.",
      });
    }
  };

  const handleCreateAccount = async (event) => {
    event.preventDefault();
    if (readOnly || !onCreateAccount) return;
    setAccountState({ saving: true, message: "", error: "" });
    try {
      await onCreateAccount(accountForm);
      setAccountForm({ full_name: "", email: "" });
      setAccountState({ saving: false, message: "Account created. Login credentials are queued for email delivery.", error: "" });
    } catch (error) {
      setAccountState({ saving: false, message: "", error: error.message || "Could not create the dean account." });
    }
  };

  return (
    <section className="bq-panel mb-5 overflow-hidden rounded-2xl border shadow-sm" style={{ background: "var(--admin-panel, #fff)", borderColor: "var(--admin-border, #e2e8f0)", color: "var(--admin-text, #0f172a)" }}>
      <div className="flex flex-wrap items-center justify-between gap-4 border-b px-5 py-4 sm:px-6" style={{ borderColor: "var(--bq-border)", background: "linear-gradient(115deg, var(--bq-accent-soft), transparent 70%)" }}>
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl" style={{ background: "var(--bq-accent-soft)", color: "var(--bq-accent)" }}>
            <GraduationCap size={21} />
          </span>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: "var(--bq-accent)" }}>Leadership</p>
            <h3 className="mt-0.5 text-lg font-semibold text-slate-900">Department leadership</h3>
            <p className="mt-0.5 text-sm text-slate-500">Assign the dean responsible for this department.</p>
          </div>
        </div>
        {readOnly && (
          <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600">
            View only
          </span>
        )}
      </div>

      <div className="p-5 sm:p-6">
        <div className="rounded-xl border border-slate-200/80 bg-slate-50/80 p-4 sm:p-5">
          <div className="mb-3 flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ background: "var(--bq-accent-soft)", color: "var(--bq-accent)" }}>
              <Users size={16} />
            </span>
            <div>
              <h4 className="text-sm font-semibold text-slate-800">Department Dean</h4>
              <p className="mt-0.5 text-xs text-slate-500">Enter a name or select a faculty member.</p>
            </div>
          </div>
          <input
            value={form.dean_name}
            onChange={(event) => {
              setForm((prev) => ({ ...prev, dean_name: event.target.value, dean_id: "" }));
              setSaveState({ status: "idle", message: "" });
            }}
            placeholder="Enter dean name"
            disabled={readOnly || department?.dean?.role === "department_dean"}
            className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-rose-400 focus:ring-4 focus:ring-rose-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
            style={{ borderColor: "var(--bq-border)" }}
          />
          {showDeanFacultyPicker && faculty.length > 0 && (
            <select
              aria-label="Assign dean from department faculty"
              value={form.dean_id}
              onChange={(event) => {
                const member = faculty.find((item) => String(item.id) === event.target.value);
                setForm((prev) => ({
                  ...prev,
                  dean_id: event.target.value,
                  dean_name: member?.name || prev.dean_name,
                }));
                setSaveState({ status: "idle", message: "" });
              }}
              disabled={readOnly}
              className="mt-3 w-full rounded-lg border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-700 outline-none transition hover:border-slate-300 focus:border-rose-400 focus:ring-4 focus:ring-rose-100 disabled:cursor-not-allowed disabled:bg-slate-100"
            >
              <option value="">Set dean by name / no faculty account</option>
              {faculty.map((member) => (
                <option key={member.id} value={member.id}>{member.name} · {member.email}</option>
              ))}
            </select>
          )}
          {department?.dean?.role === "department_dean" && (
            <p className="mt-3 rounded-lg bg-white px-3 py-2 text-xs text-slate-600">Login account: {department.dean.email}</p>
          )}
        </div>

        {!readOnly && onSave && department?.dean?.role !== "department_dean" && (
          <form onSubmit={handleSubmit} className="mt-4 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-h-5 text-sm" aria-live="polite">
              {saveState.status === "saving" && (
                <span className="inline-flex items-center gap-2 text-slate-500">
                  <LoaderCircle size={15} className="animate-spin" /> Saving dean assignment…
                </span>
              )}
              {saveState.status === "saved" && (
                <span role="status" className="inline-flex items-center gap-2 font-medium text-emerald-700">
                  <Check size={15} /> {saveState.message}
                </span>
              )}
              {saveState.status === "cleared" && (
                <span role="status" className="text-slate-500">{saveState.message}</span>
              )}
              {saveState.status === "error" && (
                <span role="alert" className="font-medium text-red-700">{saveState.message}</span>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setForm({ dean_name: "", dean_id: "" });
                  setSaveState({ status: "cleared", message: "Draft cleared. Save to apply this change." });
                }}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 active:scale-[0.98] focus:outline-none focus:ring-4 focus:ring-slate-100"
              >
                <RotateCcw size={15} />
                Clear
              </button>
              <button
                type="submit"
                disabled={saveState.status === "saving"}
                className="inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:brightness-95 active:scale-[0.98] focus:outline-none focus:ring-4 focus:ring-rose-200 disabled:cursor-not-allowed disabled:opacity-70"
                style={{ background: "var(--bq-accent-strong)", color: "#fff" }}
              >
                {saveState.status === "saving" ? <LoaderCircle size={16} className="animate-spin" /> : saveState.status === "saved" ? <Check size={16} /> : <Save size={16} />}
                {saveState.status === "saving" ? "Saving…" : saveState.status === "saved" ? "Saved" : "Save"}
              </button>
            </div>
          </form>
        )}
      {!readOnly && onCreateAccount && !department?.dean_id && (
        <form onSubmit={handleCreateAccount} className="mt-5 border-t border-slate-200 pt-5">
          <h4 className="text-sm font-semibold text-slate-800">Create dean login</h4>
          <p className="mt-1 text-xs text-slate-500">A temporary password will be emailed to the dean’s address.</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-semibold text-slate-600">
              Dean full name
              <input required minLength={2} maxLength={100} value={accountForm.full_name} onChange={(event) => setAccountForm((current) => ({ ...current, full_name: event.target.value }))} className="bq-field mt-1 w-full px-3" placeholder="Enter full name" />
            </label>
            <label className="text-xs font-semibold text-slate-600">
              Dean email
              <input required type="email" maxLength={255} value={accountForm.email} onChange={(event) => setAccountForm((current) => ({ ...current, email: event.target.value }))} className="bq-field mt-1 w-full px-3" placeholder="name@institution.edu" />
            </label>
          </div>
          {accountState.error && <p role="alert" className="mt-3 text-sm text-red-700">{accountState.error}</p>}
          {accountState.message && <p role="status" className="mt-3 text-sm text-emerald-700">{accountState.message}</p>}
          <div className="mt-3 flex justify-end">
            <button type="submit" disabled={accountState.saving} className="rounded-xl px-4 py-2 text-sm font-semibold text-white shadow-sm transition disabled:cursor-not-allowed disabled:opacity-70" style={{ background: "var(--bq-accent-strong)", color: "#fff" }}>
              {accountState.saving ? "Creating account..." : "Create account and email credentials"}
            </button>
          </div>
        </form>
      )}
      {!readOnly && department?.dean_id && department?.dean?.role !== "department_dean" && (
        <p className="mt-5 border-t border-slate-200 pt-4 text-xs text-amber-700">
          Clear and save the current dean assignment before creating a separate dean login.
        </p>
      )}
      </div>
    </section>
  );
};

const AcademicCard = ({
  icon: Icon,
  title,
  code,
  description,
  meta,
  onSelect,
  onEdit,
  onArchive,
  onDelete,
  actionLabel = "View",
  readOnlyActions = false,
}) => (
  <article
    role="button"
    tabIndex={0}
    onClick={onSelect}
    onKeyDown={(event) => event.key === "Enter" && onSelect()}
    className="bq-panel group rounded-xl border p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
    style={{ background: "var(--admin-panel, #14161c)", borderColor: "var(--admin-border, #262a34)", color: "var(--admin-text, #ecedef)" }}
  >
    <div className="flex items-start gap-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg" style={{ background: "var(--bq-accent-soft)", color: "var(--bq-accent)" }}>
        <Icon size={20} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <h3 className="truncate font-semibold text-slate-900">{title}</h3>
          <OverflowMenu onEdit={onEdit} onArchive={onArchive} onDelete={onDelete} readOnly={readOnlyActions} />
        </div>
        {code && (
          <span className="mt-1 inline-flex rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-600">
            {code}
          </span>
        )}
        <p className="mt-2 line-clamp-2 text-xs text-slate-500">{description}</p>
      </div>
    </div>
    <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
      <span className="text-xs text-slate-500">{meta}</span>
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onSelect();
        }}
        className="text-xs font-semibold"
        style={{ color: "var(--bq-accent)" }}
      >
        {actionLabel} <ChevronRight size={13} className="ml-0.5 inline" />
      </button>
    </div>
  </article>
);

const DepartmentWorkflowPanels = ({
  department,
  faculty = [],
  isDepartmentAdmin,
  canReviewRequests,
  authHeaders,
  onError,
}) => {
  const [changeForm, setChangeForm] = React.useState({ title: "", details: "" });
  const [requestUpdates, setRequestUpdates] = React.useState({});
  const [requests, setRequests] = React.useState([]);
  const [notice, setNotice] = React.useState("");

  const loadRequests = React.useCallback(async () => {
    const response = await fetch(`${ACADEMIC_API}/department-academic-change-requests`, {
      headers: authHeaders(),
    });
    const result = await response.json().catch(() => []);
    if (!response.ok) throw new Error(result.detail || "Could not load academic change requests.");
    setRequests(result);
  }, [authHeaders]);

  React.useEffect(() => {
    loadRequests().catch((error) => onError(error.message));
  }, [loadRequests, onError, department?.id]);

  const submitChangeRequest = async (event) => {
    event.preventDefault();
    setNotice("");
    try {
      const response = await fetch(`${ACADEMIC_API}/department-academic-change-requests`, {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ ...changeForm, department_id: department.id }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.detail || "Could not submit the change request.");
      setChangeForm({ title: "", details: "" });
      setNotice("Academic change request submitted.");
      await loadRequests();
    } catch (error) {
      onError(error.message);
    }
  };

  const reviewRequest = async (requestId, status) => {
    const responseText = window.prompt("Optional response for the Department Admin:") || "";
    try {
      const response = await fetch(`${ACADEMIC_API}/department-academic-change-requests/${requestId}`, {
        method: "PUT",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ status, response: responseText }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.detail || "Could not review the change request.");
      await loadRequests();
    } catch (error) {
      onError(error.message);
    }
  };

  const respondToRequest = async (requestId) => {
    try {
      const response = await fetch(`${ACADEMIC_API}/department-academic-change-requests/${requestId}/respond`, {
        method: "PUT",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ details: requestUpdates[requestId] || "" }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.detail || "Could not update the academic change request.");
      setRequestUpdates((current) => ({ ...current, [requestId]: "" }));
      await loadRequests();
    } catch (error) {
      onError(error.message);
    }
  };

  const panelStyle = { background: "var(--admin-panel, #14161c)", borderColor: "var(--admin-border, #262a34)", color: "var(--admin-text, #ecedef)" };
  const fieldClass = "bq-field mt-1 w-full px-3";

  return (
    <div className="mt-5 grid gap-4">
      {notice && <p role="status" className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-700">{notice}</p>}
      {isDepartmentAdmin && (
        <form id="department-requests-section" onSubmit={submitChangeRequest} className="rounded-2xl border p-4" style={panelStyle}>
          <h3 className="text-base font-semibold">Request an academic change</h3>
          <p className="mt-1 text-xs text-slate-500">Use this for academic data that needs coordination or approval outside this department.</p>
          <label className="mt-3 block text-sm font-medium">Request title<input required minLength="4" value={changeForm.title} onChange={(event) => setChangeForm((form) => ({ ...form, title: event.target.value }))} className={fieldClass} /></label>
          <label className="mt-3 block text-sm font-medium">Details<textarea required minLength="10" rows="3" value={changeForm.details} onChange={(event) => setChangeForm((form) => ({ ...form, details: event.target.value }))} className={`${fieldClass} py-2`} /></label>
          <button type="submit" className="mt-3 rounded-lg px-4 py-2 text-sm font-semibold text-white" style={{ background: "var(--bq-accent-strong)" }}>Submit change request</button>
        </form>
      )}

      <section className="rounded-2xl border p-4" style={panelStyle}>
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-base font-semibold">Academic change requests</h3>
          <span className="text-xs text-slate-500">{pluralize(requests.length, "Request")}</span>
        </div>
        {requests.length ? <div className="mt-3 space-y-3">{requests.map((request) => (
          <article key={request.id} className="rounded-xl border border-slate-200 p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div><p className="font-semibold">{request.title}</p><p className="text-xs text-slate-500">{request.department} · {request.submitted_by_name}{request.related_department ? ` · Related: ${request.related_department}` : ""}</p></div>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold capitalize text-slate-600">{request.status.replace("_", " ")}</span>
            </div>
            <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{request.details}</p>
            {request.response && <p className="mt-2 text-xs text-slate-500">Response: {request.response}</p>}
            {isDepartmentAdmin && request.status === "needs_info" && <div className="mt-3">
              <label className="block text-xs font-semibold text-slate-600">Update request details
                <textarea required minLength="10" rows="3" value={requestUpdates[request.id] || ""} onChange={(event) => setRequestUpdates((current) => ({ ...current, [request.id]: event.target.value }))} className={`${fieldClass} py-2`} />
              </label>
              <button type="button" onClick={() => respondToRequest(request.id)} className="mt-2 rounded-lg px-3 py-1.5 text-xs font-semibold text-white" style={{ background: "var(--bq-accent-strong)" }}>Resubmit for review</button>
            </div>}
            {canReviewRequests && request.status === "pending" && <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" onClick={() => reviewRequest(request.id, "approved")} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white">Approve</button>
              <button type="button" onClick={() => reviewRequest(request.id, "needs_info")} className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white">Request details</button>
              <button type="button" onClick={() => reviewRequest(request.id, "rejected")} className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white">Reject</button>
            </div>}
          </article>
        ))}</div> : <p className="mt-3 text-sm text-slate-500">No academic change requests yet.</p>}
      </section>

      {faculty.length > 0 && <span className="sr-only">{pluralize(faculty.length, "faculty member")} in {department.name}</span>}
    </div>
  );
};

export const AcademicMgmtContent = ({ basePath = "/admin/academic", activeSection = null }) => {
  const navigate = useNavigate();
  const { campusId, departmentId, programId } = useParams();
  const [hierarchy, setHierarchy] = React.useState({ campuses: [] });
  const [subjects, setSubjects] = React.useState([]);
  const [programTab, setProgramTab] = React.useState("subjects");
  const [modal, setModal] = React.useState(null);
  const [cisFile, setCisFile] = React.useState(null);
  const [form, setForm] = React.useState({ name: "", code: "", campus_id: "", department_id: "", program_id: "", dean_name: "", chair_name: "" });
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [notice, setNotice] = React.useState("");
  const [facultyAccountView, setFacultyAccountView] = React.useState("active");
  const [facultyAccounts, setFacultyAccounts] = React.useState({ active: [], archived: [] });
  const [facultyAccountsLoading, setFacultyAccountsLoading] = React.useState(false);
  const [facultyAccountsError, setFacultyAccountsError] = React.useState("");
  const [facultyActionEmail, setFacultyActionEmail] = React.useState("");
  const [selectedFacultyProfileId, setSelectedFacultyProfileId] = React.useState(null);
  const [showFacultyForm, setShowFacultyForm] = React.useState(false);
  const [facultyForms, setFacultyForms] = React.useState([{ full_name: "", email: "", program_id: "" }]);
  const [creatingFaculty, setCreatingFaculty] = React.useState(false);
  const [programChairDrafts, setProgramChairDrafts] = React.useState({});
  const [savingProgramChairId, setSavingProgramChairId] = React.useState(null);
  const [programChairSaveStates, setProgramChairSaveStates] = React.useState({});
  const currentRole = (localStorage.getItem("role") || "").toLowerCase();
  const adminTheme = localStorage.getItem("bloomquest-admin-theme") || "dark";
  const isSuperAdmin = currentRole === "super_admin";
  const isDepartmentAdmin = currentRole === "department_admin";
  const departmentAdminSection = isDepartmentAdmin ? activeSection || "academic" : null;
  const authHeaders = React.useCallback(
    () => ({ Authorization: `Bearer ${localStorage.getItem("token") || ""}` }),
    [],
  );

  const loadData = React.useCallback(async () => {
    setLoading(true);
    try {
      const [hierarchyRes, subjectsRes] = await Promise.all([
        fetch(`${ACADEMIC_API}/academic-hierarchy`, { headers: authHeaders() }),
        fetch(`${ACADEMIC_API}/subjects`, { headers: authHeaders() }),
      ]);

      if (!hierarchyRes.ok || !subjectsRes.ok) {
        throw new Error("Could not load academic data.");
      }

      const nextHierarchy = await hierarchyRes.json();
      setHierarchy(nextHierarchy);
      setSubjects(await subjectsRes.json());
      setError("");
    } catch (err) {
      setError(err.message || "Could not load academic data.");
    } finally {
      setLoading(false);
    }
  }, [authHeaders]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  const loadFacultyAccounts = React.useCallback(async () => {
    if (!isDepartmentAdmin) return;
    setFacultyAccountsLoading(true);
    setFacultyAccountsError("");
    try {
      const response = await fetch(`${ACADEMIC_API}/department-admin/faculty-accounts`, {
        headers: authHeaders(),
        cache: "no-store",
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.detail || "Could not load faculty accounts.");
      setFacultyAccounts({
        active: result.active || [],
        archived: result.archived || [],
      });
    } catch (err) {
      setFacultyAccountsError(err.message || "Could not load faculty accounts.");
    } finally {
      setFacultyAccountsLoading(false);
    }
  }, [authHeaders, isDepartmentAdmin]);

  React.useEffect(() => {
    if (isDepartmentAdmin && departmentAdminSection === "faculty") {
      loadFacultyAccounts();
    }
  }, [departmentAdminSection, isDepartmentAdmin, loadFacultyAccounts]);

  React.useEffect(() => {
    if (!isDepartmentAdmin || loading || departmentId) return;
    const department = (hierarchy.campuses || [])
      .flatMap((campus) => (campus.departments || []).map((item) => ({ ...item, campus_id: campus.id })))
      .find((item) => item.id === Number(localStorage.getItem("department_id"))) ||
      (hierarchy.campuses || []).flatMap((campus) =>
        (campus.departments || []).map((item) => ({ ...item, campus_id: campus.id })),
      )[0];
    if (department) {
      navigate(`${basePath}/campus/${department.campus_id}/department/${department.id}`, { replace: true });
    }
  }, [basePath, departmentId, hierarchy, isDepartmentAdmin, loading, navigate]);

  const visibleCampuses = hierarchy.campuses || [];
  const selectedCampusId = campusId ? Number(campusId) : null;
  const selectedDepartmentId = departmentId ? Number(departmentId) : null;
  const selectedProgramId = programId ? Number(programId) : null;

  const selectedCampus = visibleCampuses.find((campus) => campus.id === selectedCampusId) || null;
  const selectedDepartment = selectedCampus?.departments?.find((department) => department.id === selectedDepartmentId) || null;
  const selectedProgram = selectedDepartment?.programs?.find((program) => program.id === selectedProgramId) || null;
  React.useEffect(() => {
    if (isDepartmentAdmin && programId && departmentAdminSection !== "academic" && selectedCampusId && selectedDepartmentId) {
      navigate(`${basePath}/campus/${selectedCampusId}/department/${selectedDepartmentId}`, { replace: true });
    }
  }, [basePath, departmentAdminSection, isDepartmentAdmin, navigate, programId, selectedCampusId, selectedDepartmentId]);

  const departmentPrograms = selectedDepartment?.programs || [];
  const departmentFaculty = selectedDepartment?.faculty || [];
  const allDepartments = visibleCampuses.flatMap((campus) => (campus.departments || []).map((department) => ({
    ...department,
    campus_id: campus.id,
    campus_name: campus.name,
  })));
  const listedDepartments = selectedCampus
    ? (selectedCampus.departments || []).map((department) => ({ ...department, campus_id: selectedCampus.id, campus_name: selectedCampus.name }))
    : allDepartments;
  const modalTitle = modal?.type === "department_details"
    ? "Edit Department Details"
    : `${modal?.item ? "Edit" : "Add"} ${modal?.type || ""}`;
  const departmentSubjects = subjects.filter((subject) =>
    !subject.archived && (
      subject.department_id === selectedDepartmentId ||
      departmentPrograms.some((program) => program.id === subject.program_id)
    ),
  );
  const departmentLevelSubjects = departmentSubjects.filter((subject) => !subject.program_id);
  const programSubjects = subjects.filter(
    (subject) =>
      subject.program_id === selectedProgramId &&
      !subject.archived,
  );

  const chooseDepartment = (department) => navigate(`${basePath}/campus/${department.campus_id || selectedCampus.id}/department/${department.id}`);
  const chooseProgram = (program) => navigate(`${basePath}/campus/${selectedCampus.id}/department/${selectedDepartment.id}/program/${program.id}`);

  const openModal = (type, item = null, parent = null) => {
    setForm({
      name: item?.name || "",
      code: item?.code || "",
      campus_id: item?.campus_id || parent?.id || (type === "department" && visibleCampuses.length === 1 ? visibleCampuses[0].id : ""),
      department_id: item?.department_id || (type === "subject" ? parent?.department_id : parent?.id) || "",
      program_id: item?.program_id || (type === "subject" ? parent?.id || "" : ""),
      dean_name: item?.dean_name || item?.dean?.name || "",
      chair_name: item?.chair_name || item?.chair?.name || "",
    });
    setCisFile(null);
    setModal({ type, item });
    setError("");
  };

  const submit = async (event) => {
    event.preventDefault();
    if (isSuperAdmin || !modal) return;
    const { type, item } = modal;
    const endpointName = type.startsWith("department") ? "departments" : type === "program" ? "programs" : "subjects";
    if (type === "subject" && isDepartmentAdmin && !item && !cisFile) {
      setError("Upload the subject's Course Information Sheet before creating it.");
      return;
    }
    if (type === "subject" && isDepartmentAdmin && (!form.code.trim() || !form.program_id)) {
      setError("Enter a subject code and assign the subject to a program so faculty can use it.");
      return;
    }
    const payload = type === "department_details"
      ? { name: form.name, code: form.code }
      : type === "department"
      ? { name: form.name, code: form.code, campus_id: Number(form.campus_id), dean_name: form.dean_name }
      : type === "program"
        ? { name: form.name, code: form.code, department_id: Number(form.department_id), chair_name: form.chair_name }
        : { name: form.name, code: form.code, department_id: Number(form.department_id), program_id: form.program_id ? Number(form.program_id) : null };

    try {
      let response;
      if (type === "subject" && isDepartmentAdmin && !item) {
        const body = new FormData();
        body.append("name", form.name.trim());
        body.append("code", form.code.trim());
        body.append("department_id", String(selectedDepartment.id));
        body.append("program_id", String(form.program_id));
        body.append("cis_file", cisFile);
        response = await fetch(`${ACADEMIC_API}/subjects/with-cis`, {
          method: "POST",
          headers: authHeaders(),
          body,
        });
      } else {
        const suffix = type === "department_details" ? `/${item.id}/details` : `${item ? `/${item.id}` : ""}`;
        response = await fetch(`${ACADEMIC_API}/${endpointName}${suffix}`, {
          method: item ? "PUT" : "POST",
          headers: { ...authHeaders(), "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.detail || `Could not save ${type.replace("_", " ")}.`);
      if (type === "subject" && isDepartmentAdmin && item && cisFile) {
        const body = new FormData();
        body.append("cis_file", cisFile);
        const cisResponse = await fetch(`${ACADEMIC_API}/subjects/${item.id}/cis`, {
          method: "PUT",
          headers: authHeaders(),
          body,
        });
        const cisResult = await cisResponse.json().catch(() => ({}));
        if (!cisResponse.ok) throw new Error(cisResult.detail || "Could not save the Course Information Sheet.");
      }
      setModal(null);
      await loadData();
    } catch (saveError) {
      setError(saveError.message || `Could not save ${type}.`);
    }
  };

  const remove = async (type, id) => {
    if (isSuperAdmin || !window.confirm("Delete this item?")) return;
    try {
      const response = await fetch(`${ACADEMIC_API}/${type}/${id}`, { method: "DELETE", headers: authHeaders() });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.detail || "Could not delete this item.");
      await loadData();
    } catch (removeError) {
      setError(removeError.message || "Could not delete this item.");
    }
  };

  const backRoute = programId
    ? `${basePath}/campus/${campusId}/department/${departmentId}`
    : departmentId
      ? `${basePath}/campus/${campusId}`
      : basePath;

  const saveDepartmentLeadership = async ({ dean_name, dean_id }) => {
    if (isSuperAdmin || !selectedDepartment?.id) return;

    try {
      const response = await fetch(`${ACADEMIC_API}/departments/${selectedDepartment.id}/dean`, {
        method: "PUT",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(dean_id ? { faculty_id: dean_id } : { name: dean_name }),
      });
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result.detail || "Could not save department dean.");
      }
      await loadData();
      setError("");
    } catch (err) {
      setError(err.message || "Could not save department dean.");
      throw err;
    }
  };

  const assignFacultyProgram = async (facultyId, nextProgramId) => {
    try {
      const response = await fetch(`${ACADEMIC_API}/faculty/${facultyId}/program`, {
        method: "PUT",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ program_id: nextProgramId ? Number(nextProgramId) : null }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.detail || "Could not assign faculty to the program.");
      await loadData();
    } catch (err) {
      setError(err.message || "Could not assign faculty to the program.");
    }
  };

  const assignProgramChair = async (program, chairName) => {
    const normalizedName = chairName.trim();
    const matchingFaculty = (program.faculty || []).find(
      (member) => member.name?.trim().toLowerCase() === normalizedName.toLowerCase(),
    );
    setSavingProgramChairId(program.id);
    setProgramChairSaveStates((states) => ({
      ...states,
      [program.id]: { status: "saving", message: "" },
    }));
    try {
      const response = await fetch(`${ACADEMIC_API}/programs/${program.id}/chair`, {
        method: "PUT",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(
          matchingFaculty
            ? { faculty_id: Number(matchingFaculty.id) }
            : normalizedName
              ? { name: normalizedName }
              : { faculty_id: null },
        ),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.detail || "Could not assign the program chair.");
      await loadData();
      setError("");
      setProgramChairSaveStates((states) => ({
        ...states,
        [program.id]: {
          status: "saved",
          message: normalizedName ? "Chair assignment saved." : "Chair assignment cleared.",
        },
      }));
    } catch (err) {
      const message = err.message || "Could not assign the program chair.";
      setError(message);
      setProgramChairSaveStates((states) => ({
        ...states,
        [program.id]: { status: "error", message },
      }));
    } finally {
      setSavingProgramChairId(null);
    }
  };

  const createProgramChairAccount = async (programIdToUpdate, { full_name, email }) => {
    if (!isDepartmentAdmin) return;
    setNotice("");
    try {
      const response = await fetch(`${ACADEMIC_API}/programs/${programIdToUpdate}/chair-account`, {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ full_name, email }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.detail || "Could not create the program chair account.");
      await loadData();
      setError("");
      setNotice("Program chair account created. Login credentials are queued for email delivery.");
    } catch (err) {
      setError(err.message || "Could not create the program chair account.");
      throw err;
    }
  };

  const createFacultyAccount = async (event) => {
    event.preventDefault();
    if (!isDepartmentAdmin || !selectedDepartment?.id) return;

    setCreatingFaculty(true);
    setFacultyAccountsError("");
    setNotice("");
    const sentEmails = [];
    const emailFailures = [];
    const creationFailures = [];

    for (const [index, facultyForm] of facultyForms.entries()) {
      try {
        const response = await fetch(`${ACADEMIC_API}/department-admin/faculty-accounts`, {
          method: "POST",
          headers: { ...authHeaders(), "Content-Type": "application/json" },
          body: JSON.stringify({
            full_name: facultyForm.full_name,
            email: facultyForm.email,
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
          sentEmails.push(result.email || facultyForm.email);
        } else {
          emailFailures.push(result.email || facultyForm.email);
        }
      } catch (err) {
        creationFailures.push({
          ...facultyForm,
          row: index,
          error: err.message || "Could not create this faculty account.",
        });
      }
    }

    setFacultyForms(creationFailures.length
      ? creationFailures.map(({ row: _row, ...facultyForm }) => facultyForm)
      : [{ full_name: "", email: "", program_id: "" }]);
    setFacultyAccountView("active");

    const summaries = [];
    if (sentEmails.length) {
      summaries.push(`Created ${sentEmails.length} ${sentEmails.length === 1 ? "faculty account" : "faculty accounts"} and sent the temporary password email to: ${sentEmails.join(", ")}.`);
    }
    if (emailFailures.length) {
      summaries.push(`Account created, but email could not be sent to: ${emailFailures.join(", ")}. Contact your system administrator to resend the invitation.`);
    }
    if (creationFailures.length) {
      summaries.push(`Could not create ${creationFailures.length === 1 ? "one account" : `${creationFailures.length} accounts`}. Correct the highlighted rows and try again.`);
    }

    setNotice(sentEmails.length ? summaries[0] : "");
    const outcomeError = summaries.filter((_, index) => !(sentEmails.length && index === 0)).join(" ");
    if (!creationFailures.length) setShowFacultyForm(false);
    let refreshError = "";
    try {
      await Promise.all([loadFacultyAccounts(), loadData()]);
    } catch (err) {
      refreshError = err.message || "Faculty accounts were created, but the list could not be refreshed.";
    } finally {
      setFacultyAccountsError([outcomeError, refreshError].filter(Boolean).join(" "));
      setCreatingFaculty(false);
    }
  };

  const updateFacultyAccount = async (action, email) => {
    const actionLabel = `${action} this faculty account`;
    if (!window.confirm(`Are you sure you want to ${actionLabel} for ${email}?`)) return;
    setFacultyActionEmail(email);
    setFacultyAccountsError("");
    try {
      const response = await fetch(`${ACADEMIC_API}/department-admin/faculty-accounts/${action}`, {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.detail || `Could not ${action} faculty account.`);
      await Promise.all([loadFacultyAccounts(), loadData()]);
    } catch (err) {
      setFacultyAccountsError(err.message || `Could not ${action} faculty account.`);
    } finally {
      setFacultyActionEmail("");
    }
  };

  const assignSubjectFaculty = async (subjectId, facultyId) => {
    try {
      const response = await fetch(`${ACADEMIC_API}/subjects/${subjectId}/faculty`, {
        method: "PUT",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ faculty_id: facultyId ? Number(facultyId) : null }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.detail || "Could not assign faculty to the subject.");
      await loadData();
    } catch (err) {
      setError(err.message || "Could not assign faculty to the subject.");
    }
  };

  const createDepartmentDeanAccount = async ({ full_name, email }) => {
    if (isSuperAdmin || !selectedDepartment?.id) return;
    try {
      const response = await fetch(`${ACADEMIC_API}/departments/${selectedDepartment.id}/dean-account`, {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ full_name, email }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.detail || "Could not create the dean account.");
      await loadData();
      setError("");
    } catch (err) {
      setError(err.message || "Could not create the dean account.");
      throw err;
    }
  };
  if (selectedFacultyProfileId) {
    return (
      <DepartmentUserManagement
        initialUserId={selectedFacultyProfileId}
        onClose={() => setSelectedFacultyProfileId(null)}
      />
    );
  }
  return (
    <div className="bq-academic-attached grid gap-6">
      {error && (
        <div className="rounded-xl border p-4 text-sm" style={{ borderColor: "var(--bq-border)", background: "rgba(180, 69, 74, 0.08)", color: "var(--bq-accent-strong)" }}>
          {error}
        </div>
      )}
      {notice && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{notice}</div>}

      <section className="bq-academic-surface mx-auto w-full max-w-7xl rounded-2xl border p-4 shadow-sm sm:p-5" style={{ background: "var(--admin-panel, #14161c)", borderColor: "var(--admin-border, #262a34)", color: "var(--admin-text, #ecedef)" }}>
        <div className="mb-4 flex flex-col justify-between gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-center">
          <div>
            {!isDepartmentAdmin && (
              <Breadcrumbs
                campus={selectedCampus}
                department={selectedDepartment}
                program={selectedProgram}
                basePath={basePath}
              />
            )}
            <h2 className="text-xl font-semibold tracking-tight text-slate-900">
              {departmentAdminSection === "faculty"
                ? "Faculty Management"
                : departmentAdminSection === "leadership"
                  ? "Leadership Management"
                  : programId ? selectedProgram?.name || "Program" : departmentId ? selectedDepartment?.name || "Department" : campusId ? selectedCampus?.name || "Campus" : "Academic Management"}
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              {departmentAdminSection === "faculty"
                ? "Review department faculty and manage program assignments."
                : departmentAdminSection === "leadership"
                  ? "Manage your department dean and program chair assignments."
                  : programId
                    ? "Review the program and its subjects."
                    : departmentId
                      ? isDepartmentAdmin
                        ? "Manage programs and subjects for your department."
                        : "Review department details, leadership, programs, and subjects."
                      : campusId
                        ? "Review campus-level academic structure."
                        : "Review the academic structure across campuses."}
            </p>
          </div>

          {departmentAdminSection !== "faculty" && !departmentId && !isSuperAdmin && !isDepartmentAdmin && visibleCampuses.length > 0 && (
            <button type="button" onClick={() => openModal("department", null, selectedCampus || (visibleCampuses.length === 1 ? visibleCampuses[0] : null))} className="inline-flex items-center gap-2 self-start rounded-xl px-4 py-2 text-sm font-semibold text-white shadow-sm transition" style={{ background: "var(--bq-accent-strong)" }}>
              <Plus size={16} /> Add Department
            </button>
          )}
          {isDepartmentAdmin && departmentAdminSection === "academic" && departmentId && !programId && (
            <button type="button" onClick={() => openModal("program", null, selectedDepartment)} className="inline-flex items-center gap-2 self-start rounded-xl px-4 py-2 text-sm font-semibold text-white shadow-sm transition" style={{ background: "var(--bq-accent-strong)" }}>
              <Plus size={16} /> Add Program
            </button>
          )}
          {!isDepartmentAdmin && departmentAdminSection !== "faculty" && departmentId && !programId && !isSuperAdmin && selectedDepartment && (
            <button type="button" onClick={() => openModal("department_details", selectedDepartment)} className="inline-flex items-center gap-2 self-start rounded-xl border px-4 py-2 text-sm font-semibold transition" style={{ borderColor: "var(--bq-border)", color: "var(--bq-accent)" }}>
              Edit Department Details
            </button>
          )}
          {isDepartmentAdmin && departmentAdminSection === "academic" && departmentId && !programId && selectedDepartment && (
            <button type="button" onClick={() => openModal("subject", null, { department_id: selectedDepartment.id })} className="inline-flex items-center gap-2 self-start rounded-xl border px-4 py-2 text-sm font-semibold transition" style={{ borderColor: "var(--bq-border)", color: "var(--bq-accent)" }}>
              <Plus size={16} /> Add Subject
            </button>
          )}
        </div>

        {campusId && (!isDepartmentAdmin || programId) && (
          <button type="button" className="mb-3 inline-flex items-center gap-1 text-xs font-semibold text-slate-500" style={{ color: "var(--bq-muted)" }} onClick={() => navigate(backRoute)}>
            <ArrowLeft size={14} /> Back
          </button>
        )}

        {loading ? (
          <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
            Loading academic structure...
          </div>
        ) : (
        !campusId && isSuperAdmin ? (
          <div>
            <div className="mb-4 flex items-end justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--bq-accent)" }}>Academic units</p>
                <h3 className="mt-1 text-lg font-semibold text-slate-900">Campuses</h3>
              </div>
              <span className="text-xs text-slate-500">{pluralize(visibleCampuses.length, "Campus")}</span>
            </div>
            {visibleCampuses.length ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {visibleCampuses.map((campus) => (
                  <AcademicCard
                    key={campus.id}
                    icon={Building2}
                    title={campus.name}
                    code={campus.code}
                    description="Campus academic structure"
                    meta={pluralize(campus.departments?.length || 0, "Department")}
                    onSelect={() => navigate(`${basePath}/campus/${campus.id}`)}
                    actionLabel="View Departments"
                    readOnlyActions
                  />
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
                <Building2 size={28} className="mx-auto text-slate-300" />
                <p className="mt-3 text-sm font-semibold text-slate-700">No campuses have been added.</p>
              </div>
            )}
          </div>
        ) : !campusId ? (
          <div>
            <div className="mb-4 flex items-end justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--bq-accent)" }}>Academic units</p>
                <h3 className="mt-1 text-lg font-semibold text-slate-900">Departments</h3>
              </div>
              <span className="text-xs text-slate-500">{pluralize(allDepartments.length, "Department")}</span>
            </div>
            {allDepartments.length ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {allDepartments.map((department) => (
                  <AcademicCard
                    key={department.id}
                    icon={GraduationCap}
                    title={department.name}
                    code={department.code}
                    description={`Campus · ${department.campus_name}`}
                    meta={`${pluralize(department.programs?.length || 0, "Program")} · Dean: ${department.dean_name || department.dean?.name || "Not assigned"}`}
                    onSelect={() => chooseDepartment(department)}
                    onEdit={!isSuperAdmin && !isDepartmentAdmin ? () => openModal("department", department) : null}
                    onArchive={!isSuperAdmin && !isDepartmentAdmin ? () => remove("departments", department.id) : null}
                    actionLabel="View Department"
                    readOnlyActions={isSuperAdmin}
                  />
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
                <GraduationCap size={28} className="mx-auto text-slate-300" />
                <p className="mt-3 text-sm font-semibold text-slate-700">No departments yet.</p>
                <p className="mt-1 text-xs text-slate-500">Add a department to begin organizing academic programs.</p>
              </div>
            )}
          </div>
        ) : (
          <div>
            {!departmentId && selectedCampus && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {listedDepartments.map((department) => (
                  <AcademicCard
                    key={department.id}
                    icon={GraduationCap}
                    title={department.name}
                    code={department.code}
                    description={`Campus · ${department.campus_name || selectedCampus.name}`}
                    meta={`${pluralize(department.programs?.length || 0, "Program")} · Dean: ${department.dean_name || department.dean?.name || "Not assigned"}`}
                    onSelect={() => chooseDepartment(department)}
                    onEdit={!isSuperAdmin && !isDepartmentAdmin ? () => openModal("department", department) : null}
                    onArchive={!isSuperAdmin && !isDepartmentAdmin ? () => remove("departments", department.id) : null}
                    actionLabel="View Department"
                    readOnlyActions={isSuperAdmin}
                  />
                ))}
              </div>
            )}

            {departmentId && !programId && selectedDepartment && (
              <div className="space-y-5">
                {departmentAdminSection === "faculty" ? (
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <SummaryStat icon={Users} label="Department faculty" value={departmentFaculty.length} />
                    <SummaryStat icon={GraduationCap} label="Program assignments" value={`${departmentFaculty.filter((member) => member.program_id).length}/${departmentFaculty.length}`} />
                    <SummaryStat icon={GraduationCap} label="Program chairs assigned" value={`${departmentPrograms.filter((program) => program.chair_id).length}/${departmentPrograms.length}`} />
                    <SummaryStat icon={BookOpen} label="Subjects with faculty" value={`${departmentSubjects.filter((subject) => subject.creator_id).length}/${departmentSubjects.length}`} />
                  </div>
                ) : !isDepartmentAdmin || departmentAdminSection === "academic" ? (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <SummaryStat icon={Layers3} label="Programs" value={departmentPrograms.length} />
                    <SummaryStat icon={BookOpen} label="Subjects" value={departmentSubjects.length} />
                    <SummaryStat icon={Users} label="Faculty" value={departmentFaculty.length} />
                    <SummaryStat
                      icon={GraduationCap}
                      label="Faculty assigned to programs"
                      value={`${departmentFaculty.filter((member) => member.program_id).length}/${departmentFaculty.length}`}
                    />
                  </div>
                ) : null}
                {isDepartmentAdmin && departmentAdminSection === "faculty" && (
                  <section className="overflow-hidden rounded-xl border" style={{ borderColor: "var(--bq-border)" }}>
                    <div className="flex flex-col gap-3 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between" style={{ borderColor: "var(--bq-border)" }}>
                      <div>
                        <h3 className="font-semibold">Faculty accounts</h3>
                        <p className="text-xs text-slate-500">Add faculty directly and manage active or archived accounts.</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="flex flex-wrap gap-1 rounded-lg border p-1" role="tablist" aria-label="Faculty account status">
                          {[
                            ["active", "Active"],
                            ["archived", "Archived"],
                          ].map(([view, label]) => (
                            <button
                              key={view}
                              type="button"
                              role="tab"
                              aria-selected={facultyAccountView === view}
                              onClick={() => setFacultyAccountView(view)}
                              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${facultyAccountView === view ? "bg-[var(--bq-accent)] text-white" : "text-slate-600 hover:bg-slate-100"}`}
                            >
                              {label} ({facultyAccounts[view].length})
                            </button>
                          ))}
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setShowFacultyForm((visible) => !visible);
                            setFacultyAccountsError("");
                          }}
                          className="inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:brightness-95"
                          style={{ background: "var(--bq-accent-strong)" }}
                        >
                          <Plus size={16} />
                          Add faculty member
                        </button>
                      </div>
                    </div>
                    {showFacultyForm && (
                      <form onSubmit={createFacultyAccount} className="border-b border-slate-200 bg-slate-50/70 p-4 sm:p-5">
                        <div className="mb-3">
                          <h4 className="font-semibold text-slate-800">Add faculty accounts</h4>
                          <p className="mt-1 text-xs text-slate-500">Each faculty member will receive a temporary password and a secure link to set a permanent one.</p>
                        </div>
                        {creatingFaculty && (
                          <p className="mb-4 flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-medium text-blue-800" role="status" aria-live="polite">
                            <LoaderCircle size={16} className="animate-spin" aria-hidden="true" />
                            Creating accounts and sending emails…
                          </p>
                        )}
                        <div className="space-y-4">
                          {facultyForms.map((facultyForm, index) => (
                            <div key={index} className="rounded-xl border border-slate-200 bg-white p-3 sm:p-4">
                              <div className="mb-3 flex items-center justify-between">
                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Faculty member {index + 1}</p>
                                {facultyForms.length > 1 && (
                                  <button
                                    type="button"
                                    aria-label={`Remove faculty member ${index + 1}`}
                                    disabled={creatingFaculty}
                                    onClick={() => setFacultyForms((current) => current.filter((_, rowIndex) => rowIndex !== index))}
                                    className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-60"
                                  >
                                    Remove
                                  </button>
                                )}
                              </div>
                              <div className="grid gap-3 sm:grid-cols-3">
                                <label className="text-xs font-semibold text-slate-600">
                                  Full name
                                  <input required minLength={2} maxLength={100} value={facultyForm.full_name} onChange={(event) => setFacultyForms((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, full_name: event.target.value, error: "" } : row))} className="bq-field mt-1 w-full px-3 py-2.5 text-sm" placeholder="Enter full name" />
                                </label>
                                <label className="text-xs font-semibold text-slate-600">
                                  Email
                                  <input required type="email" maxLength={255} value={facultyForm.email} onChange={(event) => setFacultyForms((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, email: event.target.value, error: "" } : row))} className="bq-field mt-1 w-full px-3 py-2.5 text-sm" placeholder="name@institution.edu" />
                                </label>
                                <label className="text-xs font-semibold text-slate-600">
                                  Program
                                  <select required value={facultyForm.program_id} onChange={(event) => setFacultyForms((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, program_id: event.target.value, error: "" } : row))} className="bq-field mt-1 w-full px-3 py-2.5 text-sm">
                                    <option value="">Select program</option>
                                    {departmentPrograms.map((program) => <option key={program.id} value={program.id}>{program.name}</option>)}
                                  </select>
                                </label>
                              </div>
                              {facultyForm.error && <p className="mt-3 text-sm font-medium text-red-700">{facultyForm.error}</p>}
                            </div>
                          ))}
                        </div>
                        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                          <button type="button" disabled={creatingFaculty} onClick={() => setFacultyForms((current) => [...current, { full_name: "", email: "", program_id: "" }])} className="inline-flex items-center gap-2 rounded-lg border border-rose-200 bg-white px-4 py-2 text-sm font-semibold text-rose-800 hover:bg-rose-50 disabled:opacity-60">
                            <Plus size={15} />
                            Add another
                          </button>
                          <div className="flex flex-wrap justify-end gap-2">
                          <button type="button" disabled={creatingFaculty} onClick={() => {
                            setShowFacultyForm(false);
                            setFacultyAccountsError("");
                            setFacultyForms([{ full_name: "", email: "", program_id: "" }]);
                          }} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60">
                            Cancel
                          </button>
                          <button type="submit" disabled={creatingFaculty || !departmentPrograms.length} className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60" style={{ background: "var(--bq-accent-strong)" }}>
                            {creatingFaculty ? <LoaderCircle size={15} className="animate-spin" /> : <Mail size={15} />}
                            {creatingFaculty ? "Sending emails…" : `Add ${facultyForms.length} & send email${facultyForms.length === 1 ? "" : "s"}`}
                          </button>
                          </div>
                        </div>
                      </form>
                    )}
                    {facultyAccountsError && <p role="alert" className="border-b border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">{facultyAccountsError}</p>}
                    {facultyAccountsLoading ? (
                      <p className="p-5 text-sm text-slate-500">Loading faculty accounts...</p>
                    ) : facultyAccounts[facultyAccountView].length === 0 ? (
                      <p className="p-5 text-sm text-slate-500">
                        No {facultyAccountView} faculty accounts.
                      </p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[720px] text-left">
                          <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                            <tr>
                              <th className="px-4 py-3">Name</th>
                              <th className="px-4 py-3">Email</th>
                              <th className="px-4 py-3">Department</th>
                              <th className="px-4 py-3">Program</th>
                              <th className="px-4 py-3">Account date</th>
                              <th className="px-4 py-3">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {facultyAccounts[facultyAccountView].map((account) => (
                              <tr key={account.id} className="hover:bg-slate-50">
                                <td className="px-4 py-3 text-sm font-medium text-slate-800">{account.full_name || "—"}</td>
                                <td className="px-4 py-3 text-sm text-slate-600">{account.email}</td>
                                <td className="px-4 py-3 text-sm text-slate-600">{account.department || selectedDepartment.name}</td>
                                <td className="px-4 py-3 text-sm text-slate-600">{account.program || "—"}</td>
                                <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">{formatRequestDate(account.created_at)}</td>
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-2">
                                  <button type="button" onClick={() => setSelectedFacultyProfileId(account.id)} className="rounded-lg border px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50">View profile</button>
                                  {facultyAccountView === "active" ? (
                                    <button type="button" disabled={facultyActionEmail === account.email} onClick={() => updateFacultyAccount("archive", account.email)} className="rounded-lg border px-3 py-1.5 text-xs font-semibold text-slate-600 disabled:opacity-60">Archive</button>
                                  ) : (
                                    <button type="button" disabled={facultyActionEmail === account.email} onClick={() => updateFacultyAccount("restore", account.email)} className="rounded-lg border px-3 py-1.5 text-xs font-semibold text-slate-600 disabled:opacity-60">Restore</button>
                                  )}
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </section>
                )}
                {((!isDepartmentAdmin && departmentAdminSection !== "faculty") ||
                  (isDepartmentAdmin && departmentAdminSection === "leadership")) && (
                  <DepartmentLeadershipSection
                    department={selectedDepartment}
                    faculty={departmentFaculty}
                    onSave={saveDepartmentLeadership}
                    onCreateAccount={isDepartmentAdmin ? undefined : createDepartmentDeanAccount}
                    readOnly={isSuperAdmin}
                    showDeanFacultyPicker={isDepartmentAdmin || isSuperAdmin}
                  />
                )}
                {isSuperAdmin && <section className="overflow-hidden rounded-xl border" style={{ borderColor: "var(--bq-border)" }}>
                  <div className="flex items-center justify-between gap-3 border-b px-4 py-3" style={{ borderColor: "var(--bq-border)" }}>
                    <div><h3 className="font-semibold">Department faculty</h3><p className="text-xs text-slate-500">Assign active faculty to programs in this department.</p></div>
                    <span className="text-xs text-slate-500">{pluralize(departmentFaculty.length, "Faculty member")}</span>
                  </div>
                  {departmentFaculty.length ? <div className="overflow-x-auto">
                    <table className="w-full min-w-[560px] text-left">
                      <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Faculty</th><th className="px-4 py-3">Email</th><th className="px-4 py-3">Program</th></tr></thead>
                      <tbody className="divide-y divide-slate-100">
                        {departmentFaculty.map((member) => (
                          <tr key={member.id}>
                            <td className="px-4 py-3 text-sm font-medium">{member.name}</td>
                            <td className="px-4 py-3 text-sm text-slate-500">{member.email}</td>
                            <td className="px-4 py-3">
                              <select aria-label={`Program for ${member.name}`} value={member.program_id || ""} onChange={(event) => assignFacultyProgram(member.id, event.target.value)} className="bq-field w-full max-w-xs px-3 py-2 text-sm">
                                <option value="">Not assigned</option>
                                {departmentPrograms.map((program) => <option key={program.id} value={program.id}>{program.name}</option>)}
                              </select>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div> : <p className="p-5 text-sm text-slate-500">No active faculty are currently associated with this department.</p>}
                </section>}
                {departmentAdminSection === "leadership" && (
                  <>
                    <section className="overflow-hidden rounded-2xl border bg-white shadow-sm" style={{ borderColor: "var(--bq-border)" }}>
                      <div className="flex items-center gap-3 border-b px-5 py-4" style={{ borderColor: "var(--bq-border)" }}>
                        <span className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ background: "var(--bq-accent-soft)", color: "var(--bq-accent)" }}>
                          <Users size={16} />
                        </span>
                        <div>
                          <h3 className="font-semibold text-slate-900">Program chairs</h3>
                          <p className="mt-0.5 text-xs text-slate-500">Type a chair name or choose faculty assigned to each program.</p>
                        </div>
                      </div>
                      {departmentPrograms.length ? (
                        <div className="overflow-x-auto">
                          <table className="w-full min-w-[520px] text-left">
                            <thead className="bg-slate-50/90 text-[11px] uppercase tracking-[0.12em] text-slate-500"><tr><th className="px-5 py-3.5">Program</th><th className="px-5 py-3.5">Program chair</th></tr></thead>
                            <tbody className="divide-y divide-slate-100">
                              {departmentPrograms.map((program) => (
                                <tr key={program.id} className="transition-colors hover:bg-slate-50/70">
                                  <td className="px-5 py-4 text-sm font-semibold text-slate-800">{program.name}</td>
                                  <td className="px-5 py-3.5">
                                    <div className="flex max-w-md items-center gap-2">
                                      <input
                                        type="text"
                                        aria-label={`Program chair for ${program.name}`}
                                        list={`program-chair-options-${program.id}`}
                                        value={programChairDrafts[program.id] ?? getProgramChairName(program)}
                                        onChange={(event) => {
                                          setProgramChairDrafts((drafts) => ({
                                            ...drafts,
                                            [program.id]: event.target.value,
                                          }));
                                          setProgramChairSaveStates((states) => ({
                                            ...states,
                                            [program.id]: { status: "idle", message: "" },
                                          }));
                                        }}
                                        placeholder="Type a chair name"
                                        className="bq-field min-w-0 flex-1 px-3 py-2.5 text-sm transition focus:ring-4 focus:ring-rose-100"
                                      />
                                      <datalist id={`program-chair-options-${program.id}`}>
                                        {(program.faculty || []).map((member) => (
                                          <option key={member.id} value={member.name}>{member.email}</option>
                                        ))}
                                      </datalist>
                                      <button
                                        type="button"
                                        disabled={savingProgramChairId === program.id}
                                        aria-label={`Clear chair for ${program.name}`}
                                        onClick={() => {
                                          setProgramChairDrafts((drafts) => ({
                                            ...drafts,
                                            [program.id]: "",
                                          }));
                                          setProgramChairSaveStates((states) => ({
                                            ...states,
                                            [program.id]: {
                                              status: "cleared",
                                              message: "Draft cleared. Save to remove the current chair.",
                                            },
                                          }));
                                        }}
                                        className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 active:scale-[0.98] focus:outline-none focus:ring-4 focus:ring-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                                      >
                                        <RotateCcw size={14} />
                                        Clear
                                      </button>
                                      <button
                                        type="button"
                                        disabled={savingProgramChairId === program.id}
                                        onClick={() => assignProgramChair(program, programChairDrafts[program.id] ?? getProgramChairName(program))}
                                        className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg px-3.5 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:brightness-95 active:scale-[0.98] focus:outline-none focus:ring-4 focus:ring-rose-200 disabled:cursor-not-allowed disabled:opacity-60"
                                        style={{ background: "var(--bq-accent-strong)" }}
                                      >
                                        {savingProgramChairId === program.id ? <LoaderCircle size={14} className="animate-spin" /> : programChairSaveStates[program.id]?.status === "saved" ? <Check size={14} /> : <Save size={14} />}
                                        {savingProgramChairId === program.id ? "Saving…" : programChairSaveStates[program.id]?.status === "saved" ? "Saved" : "Save"}
                                      </button>
                                    </div>
                                    {programChairSaveStates[program.id]?.status === "saved" && (
                                      <p role="status" className="mt-1.5 text-xs font-medium text-emerald-700">
                                        {programChairSaveStates[program.id].message}
                                      </p>
                                    )}
                                    {programChairSaveStates[program.id]?.status === "cleared" && (
                                      <p role="status" className="mt-1.5 text-xs text-slate-500">
                                        {programChairSaveStates[program.id].message}
                                      </p>
                                    )}
                                    {programChairSaveStates[program.id]?.status === "error" && (
                                      <p role="alert" className="mt-1.5 text-xs font-medium text-red-700">
                                        {programChairSaveStates[program.id].message}
                                      </p>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : <p className="p-6 text-sm text-slate-500">Create a program before assigning a program chair.</p>}
                    </section>
                  </>
                )}
                {!isDepartmentAdmin && departmentAdminSection !== "faculty" && <section className="overflow-hidden rounded-xl border" style={{ borderColor: "var(--bq-border)" }}>
                  <div className="border-b px-4 py-3" style={{ borderColor: "var(--bq-border)" }}>
                    <h3 className="font-semibold">Department-level subjects</h3>
                    <p className="text-xs text-slate-500">Associate these subjects with a program when appropriate.</p>
                  </div>
                  {departmentLevelSubjects.length ? <div className="overflow-x-auto">
                    <table className="w-full min-w-[600px] text-left">
                      <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Subject</th><th className="px-4 py-3">Program</th><th className="px-4 py-3">Faculty</th><th className="px-4 py-3" /></tr></thead>
                      <tbody className="divide-y divide-slate-100">{departmentLevelSubjects.map((subject) => (
                        <tr key={subject.id}>
                          <td className="px-4 py-3 text-sm font-medium">{subject.name}{subject.code ? <span className="ml-2 text-xs text-slate-500">{subject.code}</span> : null}</td>
                          <td className="px-4 py-3"><button type="button" onClick={() => openModal("subject", subject, { department_id: selectedDepartment.id })} className="text-sm font-semibold" style={{ color: "var(--bq-accent)" }}>Associate with program</button></td>
                          <td className="px-4 py-3">
                            {isDepartmentAdmin
                              ? <span className="text-sm text-slate-500">Assign in Faculty Management</span>
                              : <select aria-label={`Faculty for ${subject.name}`} value={subject.creator_id || ""} onChange={(event) => assignSubjectFaculty(subject.id, event.target.value)} className="bq-field w-full min-w-40 px-3 py-2 text-sm">
                                <option value="">Unassigned</option>
                                {departmentFaculty.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
                              </select>}
                          </td>
                          <td className="px-4 py-3"><OverflowMenu onEdit={() => openModal("subject", subject, { department_id: selectedDepartment.id })} onArchive={() => remove("subjects", subject.id)} /></td>
                        </tr>
                      ))}</tbody>
                    </table>
                  </div> : <p className="p-5 text-sm text-slate-500">No department-level subjects.</p>}
                </section>}
                {(!isDepartmentAdmin || departmentAdminSection === "academic") && selectedDepartment.programs?.map((program) => (
                  <div key={program.id} role="button" tabIndex={0} onClick={() => chooseProgram(program)} onKeyDown={(event) => event.key === "Enter" && chooseProgram(program)} className="bq-panel flex cursor-pointer flex-col gap-4 rounded-xl border p-4 text-left shadow-sm transition hover:shadow-md sm:flex-row sm:items-center" style={{ borderColor: "var(--bq-border)" }}>
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg" style={{ background: "var(--bq-accent-soft)", color: "var(--bq-accent)" }}>
                      <Layers3 size={20} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold text-slate-900">{program.name}</h3>
                        {program.code && (
                          <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-600">
                            {program.code}
                          </span>
                        )}
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">Active</span>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">{program.faculty?.length || 0} faculty members · Program Chair: {program.chair_name || program.chair?.name || "Not assigned"}</p>
                    </div>
                    <div className="flex items-center justify-between gap-3 sm:shrink-0">
                      <button type="button" onClick={(event) => { event.stopPropagation(); chooseProgram(program); }} className="text-xs font-semibold" style={{ color: "var(--bq-accent)" }}>
                        View Program <ChevronRight size={13} className="ml-0.5 inline" />
                      </button>
                      {!isSuperAdmin && <OverflowMenu onEdit={isDepartmentAdmin ? () => openModal("program", { ...program, department_id: selectedDepartment.id }) : null} onArchive={() => remove("programs", program.id)} />}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {programId && selectedProgram && (
              <div>
                <div className="mb-5 grid gap-3 sm:grid-cols-2">
                  <SummaryStat icon={BookOpen} label="Subjects" value={programSubjects.length} />
                  <SummaryStat icon={Users} label="Faculty" value={selectedProgram.faculty?.length || 0} />
                </div>

                <div className="mb-5 rounded-xl border px-4 py-3" style={{ background: "var(--admin-panel, #14161c)", borderColor: "var(--admin-border, #262a34)" }}>
                  <p className="text-xs font-medium" style={{ color: "var(--admin-muted, #8b8f99)" }}>Program Chair</p>
                  <p className="mt-1 text-sm font-semibold" style={{ color: "var(--admin-text, #ecedef)" }}>{selectedProgram.chair_name || selectedProgram.chair?.name || "Not assigned"}</p>
                  {isDepartmentAdmin && departmentAdminSection === "faculty" && (
                    <label className="mt-3 block max-w-md text-xs font-medium" style={{ color: "var(--admin-muted, #8b8f99)" }}>
                      Assign program chair
                      <select aria-label="Assign program chair" value={selectedProgram.chair_id || ""} onChange={(event) => assignProgramChair(selectedProgram.id, event.target.value)} className="bq-field mt-1 w-full px-3 py-2 text-sm text-slate-800">
                        <option value="">No faculty chair assigned</option>
                        {(selectedProgram.faculty || []).map((member) => <option key={member.id} value={member.id}>{member.name} · {member.email}</option>)}
                      </select>
                    </label>
                  )}
                </div>
                {isDepartmentAdmin && departmentAdminSection === "faculty" && (
                  <ProgramChairAccountForm program={selectedProgram} onCreateAccount={createProgramChairAccount} />
                )}

                <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200">
                  <div className="flex gap-5">
                    <button type="button" onClick={() => setProgramTab("subjects")} className={`border-b-2 px-1 pb-3 text-sm font-semibold ${programTab === "subjects" ? "border-[var(--bq-accent)] text-[var(--bq-accent)]" : "border-transparent text-slate-500"}`}>
                      Subjects
                    </button>
                    <button type="button" onClick={() => setProgramTab("faculty")} className={`border-b-2 px-1 pb-3 text-sm font-semibold ${programTab === "faculty" ? "border-[var(--bq-accent)] text-[var(--bq-accent)]" : "border-transparent text-slate-500"}`}>
                      Faculty
                    </button>
                  </div>

                  {programTab === "subjects" && !isSuperAdmin && (
                    <button type="button" onClick={() => openModal("subject", null, { id: selectedProgram.id, department_id: selectedDepartment.id })} className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white shadow-sm transition" style={{ background: "var(--bq-accent-strong)" }}>
                      <Plus size={15} /> Add Subject
                    </button>
                  )}
                </div>

                {programTab === "subjects" && (
                  <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                    <table className="w-full min-w-[460px] text-left">
                      <thead className="bg-slate-50 text-[11px] uppercase tracking-[0.12em] text-slate-500">
                        <tr>
                          <th className="px-4 py-3 font-semibold">Subject</th>
                          <th className="px-4 py-3 font-semibold">Status</th>
                          {(isDepartmentAdmin || isSuperAdmin) && <th className="px-4 py-3 font-semibold">Assigned Faculty</th>}
                          <th className="px-4 py-3" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {programSubjects.map((subject) => (
                          <tr key={subject.id} className="hover:bg-slate-50">
                            <td className="px-4 py-3 text-sm font-medium text-slate-800">
                              <div>{subject.name}</div>
                              {subject.code && (
                                <div className="mt-1 text-xs font-semibold tracking-wide" style={{ color: "var(--admin-muted, #8b8f99)" }}>
                                  {subject.code}
                                </div>
                              )}
                              <div className={`mt-1 text-xs font-medium ${subject.has_cis ? "text-emerald-700" : "text-amber-700"}`}>{subject.has_cis ? `CIS on file${subject.cis_filename ? ` · ${subject.cis_filename}` : ""}` : "CIS required before faculty can use this subject"}</div>
                            </td>
                            <td className="px-4 py-3">
                              <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">Active</span>
                            </td>
                            <td className="px-4 py-3">
                              {isDepartmentAdmin && departmentAdminSection === "faculty" ? (
                                <select aria-label={`Faculty for ${subject.name}`} value={subject.creator_id || ""} onChange={(event) => assignSubjectFaculty(subject.id, event.target.value)} className="bq-field w-full min-w-48 px-3 py-2 text-sm">
                                  <option value="">Unassigned</option>
                                  {departmentFaculty.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
                                </select>
                              ) : subject.faculty_name || (isDepartmentAdmin ? "Assign in Faculty Management" : null)}
                            </td>
                            <td className="px-4 py-3">
                              {!isSuperAdmin && <OverflowMenu onEdit={() => openModal("subject", subject, { id: selectedProgram.id, department_id: selectedDepartment.id })} onArchive={() => remove("subjects", subject.id)} />}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {programSubjects.length === 0 && (
                      <div className="p-10 text-center">
                        <BookOpen size={28} className="mx-auto text-slate-300" />
                        <p className="mt-3 text-sm font-semibold text-slate-700">No subjects assigned yet.</p>
                        <p className="mt-1 text-xs text-slate-500">This program currently has no subjects.</p>
                      </div>
                    )}
                  </div>
                )}

                {programTab === "faculty" && (
                  <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                    <table className="w-full text-left">
                      <thead className="bg-slate-50 text-[11px] uppercase tracking-[0.12em] text-slate-500">
                        <tr>
                          <th className="px-4 py-3 font-semibold">Name</th>
                          <th className="px-4 py-3 font-semibold">Email</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {(selectedProgram.faculty || []).map((member) => (
                          <tr key={member.id}>
                            <td className="px-4 py-3 text-sm text-slate-800">{member.name}</td>
                            <td className="px-4 py-3 text-sm text-slate-500">{member.email}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {!selectedProgram.faculty?.length && (
                      <p className="p-8 text-center text-sm text-slate-500">No faculty assigned to this program.</p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </section>
      {departmentId && selectedDepartment && !isDepartmentAdmin && (
        <section className="bq-academic-surface mx-auto w-full max-w-7xl rounded-2xl border p-4 shadow-sm sm:p-5" style={{ background: "var(--admin-panel, #14161c)", borderColor: "var(--admin-border, #262a34)", color: "var(--admin-text, #ecedef)" }}>
          <DepartmentWorkflowPanels
            department={selectedDepartment}
            faculty={departmentFaculty}
            isDepartmentAdmin={isDepartmentAdmin}
            canReviewRequests={!isDepartmentAdmin}
            authHeaders={authHeaders}
            onError={setError}
          />
        </section>
      )}
      {modal && !isSuperAdmin && createPortal(
        <div className={`bq-admin-${adminTheme}`}>
          <div className="bq-modal-overlay fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto p-4">
            <form onSubmit={submit} className="bq-modal-panel my-auto w-full max-w-md max-h-[calc(100vh-2rem)] overflow-y-auto p-6">
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">{modalTitle}</h3>
              <button type="button" onClick={() => setModal(null)} className="bq-secondary-button px-3 py-1 text-xs" aria-label="Close dialog">Close</button>
            </div>
            <label className="mb-4 block text-sm font-semibold text-slate-700">
              Name
              <input required autoFocus value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} className="bq-field mt-1 w-full px-3" />
            </label>
            <label className="mb-4 block text-sm font-semibold text-slate-700">
              Code {!isDepartmentAdmin && <span className="font-normal text-slate-400">(optional)</span>}
              <input required={isDepartmentAdmin && modal.type === "subject"} value={form.code} onChange={(event) => setForm((current) => ({ ...current, code: event.target.value }))} className="bq-field mt-1 w-full px-3" />
            </label>
            {modal.type === "department" && (
              <>
                <label className="mb-4 block text-sm font-semibold text-slate-700">
                  Dean <span className="font-normal text-slate-400">(optional)</span>
                  <input value={form.dean_name} onChange={(event) => setForm((current) => ({ ...current, dean_name: event.target.value }))} placeholder="Enter dean name" className="bq-field mt-1 w-full px-3" />
                </label>
                {visibleCampuses.length > 1 && <label className="mb-4 block text-sm font-semibold text-slate-700">Campus<select required value={form.campus_id} onChange={(event) => setForm((current) => ({ ...current, campus_id: event.target.value }))} className="bq-field mt-1 w-full px-3"><option value="">Select a campus</option>{visibleCampuses.map((campus) => <option key={campus.id} value={campus.id}>{campus.name}</option>)}</select></label>}
              </>
            )}
            {modal.type === "program" && (
              <>
                <label className="mb-4 block text-sm font-semibold text-slate-700">
                  Program Chair <span className="font-normal text-slate-400">(optional)</span>
                  <input value={form.chair_name} onChange={(event) => setForm((current) => ({ ...current, chair_name: event.target.value }))} placeholder="Enter program chair name" className="bq-field mt-1 w-full px-3" />
                </label>
                {allDepartments.length > 1 && <label className="mb-4 block text-sm font-semibold text-slate-700">Department<select required value={form.department_id} onChange={(event) => setForm((current) => ({ ...current, department_id: event.target.value }))} className="bq-field mt-1 w-full px-3"><option value="">Select a department</option>{allDepartments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</select></label>}
              </>
            )}
            {modal.type === "subject" && selectedDepartment && <label className="mb-4 block text-sm font-semibold text-slate-700">Program<select required={isDepartmentAdmin} value={form.program_id} onChange={(event) => setForm((current) => ({ ...current, program_id: event.target.value, department_id: selectedDepartment.id }))} className="bq-field mt-1 w-full px-3"><option value="">{isDepartmentAdmin ? "Select a program" : "Department-level (not linked to a program)"}</option>{departmentPrograms.map((program) => <option key={program.id} value={program.id}>{program.name}</option>)}</select></label>}
            {modal.type === "subject" && isDepartmentAdmin && (
              <div className="mb-4">
                <label className="block text-sm font-semibold text-slate-700">
                  Course Information Sheet (CIS) {modal.item?.has_cis && <span className="font-normal text-emerald-700">· Current CIS on file</span>}
                  <input
                    type="file"
                    accept=".pdf,.docx,.xlsx"
                    required={!modal.item}
                    onChange={(event) => setCisFile(event.target.files?.[0] || null)}
                    className="bq-field mt-1 w-full px-3 py-2"
                  />
                </label>
                <p className="mt-1 text-xs text-slate-500">{modal.item ? "Upload a replacement CIS if the existing document has changed." : "Required before this subject can be created or used by faculty. Accepted formats: PDF, DOCX, or XLSX (10 MB max)."}</p>
                {cisFile && <p className="mt-1 text-xs font-medium text-emerald-700">Selected: {cisFile.name}</p>}
                {modal.item && !modal.item.has_cis && <p className="mt-1 text-xs font-medium text-amber-700">No CIS is on file; faculty cannot use this subject until one is uploaded.</p>}
              </div>
            )}
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={() => setModal(null)} className="bq-secondary-button">Cancel</button>
              <button type="submit" className="bq-primary-button">Save</button>
            </div>
            </form>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
};

const AcademicMgmtBtn = ({ activeTab, setActiveTab, collapsed }) => {
  const isActive = activeTab === "academic";

  return (
    <button
      title={collapsed ? "Academic Management" : undefined}
      aria-label={collapsed ? "Academic Management" : undefined}
      onClick={() => setActiveTab("academic")}
      className="relative flex w-full items-center gap-3 rounded-lg px-4 py-2.5 text-left transition-all duration-150"
      style={
        isActive
          ? {
              background: "var(--bq-accent)",
              color: "#ffffff",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.1)",
            }
          : { color: "var(--bq-muted)", background: "transparent" }
      }
    >
      {isActive && <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r-full bg-white" />}
      <svg className="h-5 w-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20" style={{ color: isActive ? "#ffffff" : "var(--bq-accent)" }}>
        <path d="M10.394 2.08a1 1 0 00-.788 0l-7 3a1 1 0 000 1.84L5.25 8.051a.999.999 0 01.356-.257l4-1.714a1 1 0 11.788 1.838L7.667 9.088l1.94.831a1 1 0 00.787 0l7-3a1 1 0 000-1.838l-7-3zM3.31 9.397L5 10.12v4.102a8.969 8.969 0 00-1.05-.174 1 1 0 01-.89-.89 11.115 11.115 0 01.25-3.762zM9.3 16.573A9.026 9.026 0 007 14.935v-3.957l1.818.78a3 3 0 002.364 0l5.508-2.361a11.026 11.026 0 01.25 3.762 1 1 0 01-.89.89 8.968 8.968 0 00-5.35 2.524 1 1 0 01-1.4 0zM6 18a1 1 0 001-1v-2.065a8.935 8.935 0 00-2-.712V17a1 1 0 001 1z" />
      </svg>
      <span className="text-sm font-medium tracking-wide">Academic Management</span>
    </button>
  );
};

export default AcademicMgmtBtn;
