import React from "react";
import {
  ArrowLeft,
  BookOpen,
  Building2,
  ChevronRight,
  GraduationCap,
  Layers3,
  MoreHorizontal,
  Plus,
  Users,
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";

const ACADEMIC_API = "/api";

const pluralize = (count, singular, plural = `${singular}s`) =>
  `${count} ${count === 1 ? singular : plural}`;

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

const DepartmentLeadershipSection = ({ department, onSave, readOnly = false }) => {
  const [form, setForm] = React.useState({ dean_name: department?.dean_name || department?.dean?.name || "" });
  const [saveState, setSaveState] = React.useState({ saving: false, saved: false });

  React.useEffect(() => {
    setForm({
      dean_name: department?.dean_name || department?.dean?.name || "",
    });
    setSaveState((prev) => ({ ...prev, saved: false }));
  }, [department?.id, department?.dean_name, department?.dean?.name]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (readOnly || !onSave) return;

    setSaveState({ saving: true, saved: false });
    try {
      await onSave({
        dean_name: form.dean_name.trim(),
      });
      setSaveState({ saving: false, saved: true });
    } catch (error) {
      setSaveState({ saving: false, saved: false });
      throw error;
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bq-panel mb-5 rounded-2xl border p-3 shadow-sm" style={{ background: "var(--admin-panel, #14161c)", borderColor: "var(--admin-border, #262a34)", color: "var(--admin-text, #ecedef)" }}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--bq-accent)" }}>Leadership</p>
          <h3 className="mt-1 text-lg font-semibold text-slate-900">Department leadership</h3>
        </div>
        <div className="flex items-center gap-2">
          {saveState.saving && (
            <span className="rounded-full bg-amber-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-amber-300">
              Saving...
            </span>
          )}
          {!saveState.saving && saveState.saved && (
            <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-300">
              Saved
            </span>
          )}
          {readOnly && (
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
              View Only
            </span>
          )}
        </div>
      </div>

      <div className="grid gap-3">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="mb-2 flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: "var(--bq-accent-soft)", color: "var(--bq-accent)" }}>
              <Users size={14} />
            </span>
            <div>
              <h4 className="text-sm font-semibold text-slate-800">Department Dean</h4>
              <p className="text-[10px] text-slate-500">Assigned dean</p>
            </div>
          </div>
          <input
            value={form.dean_name}
            onChange={(event) => setForm((prev) => ({ ...prev, dean_name: event.target.value }))}
            placeholder="Enter dean name"
            disabled={readOnly}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
            style={{ borderColor: "var(--bq-border)" }}
          />
        </div>

      </div>

      {!readOnly && onSave && (
        <div className="mt-3 flex justify-end gap-2">
          <button type="button" onClick={() => {
            setForm({ dean_name: "" });
            setSaveState({ saving: false, saved: false });
          }} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50">
            Clear
          </button>
          <button type="submit" disabled={saveState.saving} className="rounded-xl px-4 py-2 text-sm font-semibold text-white shadow-sm transition disabled:cursor-not-allowed disabled:opacity-70" style={{ background: "var(--bq-accent-strong)", color: "#fff" }}>
            {saveState.saving ? "Saving..." : "Save"}
          </button>
        </div>
      )}
    </form>
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

export const AcademicMgmtContent = ({ basePath = "/admin/academic" }) => {
  const navigate = useNavigate();
  const { campusId, departmentId, programId } = useParams();
  const [hierarchy, setHierarchy] = React.useState({ campuses: [] });
  const [subjects, setSubjects] = React.useState([]);
  const [programTab, setProgramTab] = React.useState("subjects");
  const [modal, setModal] = React.useState(null);
  const [form, setForm] = React.useState({ name: "", code: "", campus_id: "", department_id: "", program_id: "", dean_name: "", chair_name: "" });
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const isSuperAdmin = (localStorage.getItem("role") || "").toLowerCase() === "super_admin";
  const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem("token") || ""}` });

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
  }, []);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  const visibleCampuses = hierarchy.campuses || [];
  const selectedCampusId = campusId ? Number(campusId) : null;
  const selectedDepartmentId = departmentId ? Number(departmentId) : null;
  const selectedProgramId = programId ? Number(programId) : null;

  const selectedCampus = visibleCampuses.find((campus) => campus.id === selectedCampusId) || null;
  const selectedDepartment = selectedCampus?.departments?.find((department) => department.id === selectedDepartmentId) || null;
  const selectedProgram = selectedDepartment?.programs?.find((program) => program.id === selectedProgramId) || null;
  const allDepartments = visibleCampuses.flatMap((campus) => (campus.departments || []).map((department) => ({
    ...department,
    campus_id: campus.id,
    campus_name: campus.name,
  })));
  const listedDepartments = selectedCampus
    ? (selectedCampus.departments || []).map((department) => ({ ...department, campus_id: selectedCampus.id, campus_name: selectedCampus.name }))
    : allDepartments;
  const modalTitle = `${modal?.item ? "Edit" : "Add"} ${modal?.type || ""}`;
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
    setModal({ type, item });
    setError("");
  };

  const submit = async (event) => {
    event.preventDefault();
    if (isSuperAdmin || !modal) return;
    const { type, item } = modal;
    const endpointName = type === "department" ? "departments" : type === "program" ? "programs" : "subjects";
    const payload = type === "department"
      ? { name: form.name, code: form.code, campus_id: Number(form.campus_id), dean_name: form.dean_name }
      : type === "program"
        ? { name: form.name, code: form.code, department_id: Number(form.department_id), chair_name: form.chair_name }
        : { name: form.name, code: form.code, department_id: Number(form.department_id), program_id: Number(form.program_id) };

    try {
      const response = await fetch(`${ACADEMIC_API}/${endpointName}${item ? `/${item.id}` : ""}`, {
        method: item ? "PUT" : "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.detail || `Could not save ${type}.`);
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

  const saveDepartmentLeadership = async ({ dean_name }) => {
    if (isSuperAdmin || !selectedDepartment?.id) return;

    try {
      const response = await fetch(`${ACADEMIC_API}/departments/${selectedDepartment.id}/dean`, {
        method: "PUT",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ name: dean_name }),
      });
      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result.detail || "Could not save department dean.");
      }
      await loadData();
      setError("");
    } catch (err) {
      setError(err.message || "Could not save department dean.");
    }
  };

  return (
    <div className="bq-academic-attached grid gap-6">
      {error && (
        <div className="rounded-xl border p-4 text-sm" style={{ borderColor: "var(--bq-border)", background: "rgba(180, 69, 74, 0.08)", color: "var(--bq-accent-strong)" }}>
          {error}
        </div>
      )}

      <section className="bq-academic-surface mx-auto w-full max-w-7xl rounded-2xl border p-4 shadow-sm sm:p-5" style={{ background: "var(--admin-panel, #14161c)", borderColor: "var(--admin-border, #262a34)", color: "var(--admin-text, #ecedef)" }}>
        <div className="mb-4 flex flex-col justify-between gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-center">
          <div>
            <Breadcrumbs campus={selectedCampus} department={selectedDepartment} program={selectedProgram} basePath={basePath} />
            <h2 className="text-xl font-semibold tracking-tight text-slate-900">
              {programId ? selectedProgram?.name || "Program" : departmentId ? selectedDepartment?.name || "Department" : campusId ? selectedCampus?.name || "Campus" : "Academic Management"}
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              {programId
                ? "Review the program and its subjects."
                : departmentId
                  ? "Review department leadership and programs."
                  : campusId
                    ? "Review campus-level academic structure."
                    : "Review the academic structure across campuses."}
            </p>
          </div>

          {!departmentId && !isSuperAdmin && visibleCampuses.length > 0 && (
            <button type="button" onClick={() => openModal("department", null, selectedCampus || (visibleCampuses.length === 1 ? visibleCampuses[0] : null))} className="inline-flex items-center gap-2 self-start rounded-xl px-4 py-2 text-sm font-semibold text-white shadow-sm transition" style={{ background: "var(--bq-accent-strong)" }}>
              <Plus size={16} /> Add Department
            </button>
          )}
          {departmentId && !programId && !isSuperAdmin && (
            <button type="button" onClick={() => openModal("program", null, selectedDepartment)} className="inline-flex items-center gap-2 self-start rounded-xl px-4 py-2 text-sm font-semibold text-white shadow-sm transition" style={{ background: "var(--bq-accent-strong)" }}>
              <Plus size={16} /> Add Program
            </button>
          )}
        </div>

        {campusId && (
          <button type="button" className="mb-3 inline-flex items-center gap-1 text-xs font-semibold text-slate-500" style={{ color: "var(--bq-muted)" }} onClick={() => navigate(backRoute)}>
            <ArrowLeft size={14} /> Back
          </button>
        )}

        {!loading && selectedDepartment && !programId && (
          <DepartmentLeadershipSection department={selectedDepartment} onSave={saveDepartmentLeadership} readOnly={isSuperAdmin} />
        )}

        {loading ? (
          <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
            Loading academic structure...
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
                    onEdit={!isSuperAdmin ? () => openModal("department", department) : null}
                    onArchive={!isSuperAdmin ? () => remove("departments", department.id) : null}
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
                    onEdit={!isSuperAdmin ? () => openModal("department", department) : null}
                    onArchive={!isSuperAdmin ? () => remove("departments", department.id) : null}
                    actionLabel="View Department"
                    readOnlyActions={isSuperAdmin}
                  />
                ))}
              </div>
            )}

            {departmentId && !programId && selectedDepartment && (
              <div className="space-y-3">
                {selectedDepartment.programs?.map((program) => (
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
                      {!isSuperAdmin && <OverflowMenu onEdit={() => openModal("program", { ...program, department_id: selectedDepartment.id })} onArchive={() => remove("programs", program.id)} />}
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
                </div>

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
                          <th className="px-4 py-3" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {programSubjects.map((subject) => (
                          <tr key={subject.id} className="hover:bg-slate-50">
                            <td className="px-4 py-3 text-sm font-medium text-slate-800">{subject.name}</td>
                            <td className="px-4 py-3">
                              <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">Active</span>
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
        )}
      </section>
      {modal && !isSuperAdmin && (
        <div className="bq-modal-overlay fixed inset-0 z-50 flex items-center justify-center p-4">
          <form onSubmit={submit} className="bq-modal-panel w-full max-w-md p-6">
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">{modalTitle}</h3>
              <button type="button" onClick={() => setModal(null)} className="bq-secondary-button px-3 py-1 text-xs" aria-label="Close dialog">Close</button>
            </div>
            <label className="mb-4 block text-sm font-semibold text-slate-700">
              Name
              <input required autoFocus value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} className="bq-field mt-1 w-full px-3" />
            </label>
            <label className="mb-4 block text-sm font-semibold text-slate-700">
              Code <span className="font-normal text-slate-400">(optional)</span>
              <input value={form.code} onChange={(event) => setForm((current) => ({ ...current, code: event.target.value }))} className="bq-field mt-1 w-full px-3" />
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
            {modal.type === "subject" && allDepartments.length > 0 && !form.program_id && <label className="mb-4 block text-sm font-semibold text-slate-700">Program<select required value={form.program_id} onChange={(event) => setForm((current) => ({ ...current, program_id: event.target.value }))} className="bq-field mt-1 w-full px-3"><option value="">Select a program</option>{allDepartments.flatMap((department) => (department.programs || []).map((program) => <option key={program.id} value={program.id}>{department.name} / {program.name}</option>))}</select></label>}
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={() => setModal(null)} className="bq-secondary-button">Cancel</button>
              <button type="submit" className="bq-primary-button">Save</button>
            </div>
          </form>
        </div>
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
