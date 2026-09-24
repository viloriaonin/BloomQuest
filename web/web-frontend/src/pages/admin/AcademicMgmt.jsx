import React from "react";
import { Building2, GraduationCap, Layers3, MoreHorizontal, Plus, Search, ArrowLeft, BookOpen, Users, ChevronRight, Archive } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";

const LegacyAcademicMgmtContent = () => (
  <div className="grid gap-6 xl:grid-cols-[1.3fr_1fr_1fr]">
    <div className="rounded-[32px] bg-white p-6 shadow-sm border border-gray-200">
      <div className="flex items-center justify-between gap-4 mb-6">
        <div>
          <p className="text-sm font-semibold text-gray-500">Departments</p>
          <p className="text-xs text-gray-400">
            Manage academic units and schools
          </p>
        </div>
        <button className="inline-flex items-center gap-2 rounded-full bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800 transition">
          + Add New
        </button>
      </div>

      <div className="space-y-4">
        {[
          { name: "Computer Science", code: "CICS", highlighted: true },
          { name: "Information Technology", code: "CICS" },
          { name: "Civil Engineering", code: "COE" },
        ].map((department) => (
          <div
            key={department.name}
            className={`rounded-3xl p-5 shadow-sm border ${department.highlighted ? "border-red-100 bg-red-50" : "border-gray-100 bg-[#faf7f7]"}`}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-semibold text-gray-900">{department.name}</p>
                <p className="mt-1 text-sm text-gray-500">{department.code}</p>
              </div>
              <div className="flex items-center gap-2 text-gray-500">
                <button className="rounded-full p-2 hover:bg-gray-100 transition">
                  <svg
                    className="w-4 h-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M12 20h9" />
                    <path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4 12.5-12.5z" />
                  </svg>
                </button>
                <button className="rounded-full p-2 hover:bg-gray-100 transition">
                  <svg
                    className="w-4 h-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M3 6h18" />
                    <path d="M8 6v14" />
                    <path d="M16 6v14" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>

    <div className="rounded-[32px] bg-white p-6 shadow-sm border border-gray-200">
      <div className="flex items-center justify-between gap-4 mb-6">
        <div>
          <p className="text-sm font-semibold text-gray-500">Courses</p>
          <p className="text-xs text-gray-400">Assign courses to departments</p>
        </div>
        <button className="inline-flex items-center gap-2 rounded-full bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800 transition">
          + Add New
        </button>
      </div>

      <div className="rounded-3xl bg-[#faf7f7] p-5 border border-red-100">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-semibold text-gray-900">
              Bachelor of Science in Computer Science
            </p>
            <p className="mt-2 text-sm text-gray-500">BSCS</p>
          </div>
          <div className="flex items-center gap-2 text-gray-500">
            <button className="rounded-full p-2 hover:bg-gray-100 transition">
              <svg
                className="w-4 h-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4 12.5-12.5z" />
              </svg>
            </button>
            <button className="rounded-full p-2 hover:bg-gray-100 transition">
              <svg
                className="w-4 h-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3 6h18" />
                <path d="M8 6v14" />
                <path d="M16 6v14" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>

    <div className="rounded-[32px] bg-white p-6 shadow-sm border border-gray-200">
      <div className="flex items-center justify-between gap-4 mb-6">
        <div>
          <p className="text-sm font-semibold text-gray-500">Subjects</p>
          <p className="text-xs text-gray-400">
            Organize courses by year level
          </p>
        </div>
        <button className="inline-flex items-center gap-2 rounded-full bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800 transition">
          + Add New
        </button>
      </div>

      <div className="space-y-4">
        {[
          {
            year: "Year 1",
            count: 2,
            items: [
              { title: "Programming Fundamentals", code: "CS101" },
              { title: "Discrete Mathematics", code: "CS102" },
            ],
          },
          {
            year: "Year 2",
            count: 2,
            items: [
              { title: "Data Structures and Algorithms", code: "CS201" },
              { title: "Database Systems", code: "CS202" },
            ],
          },
          {
            year: "Year 3",
            count: 1,
            items: [{ title: "Software Engineering", code: "CS301" }],
          },
          {
            year: "Year 4",
            count: 0,
            items: [],
          },
        ].map((group) => (
          <details
            key={group.year}
            className="rounded-3xl bg-gray-50 border border-gray-100 p-4"
          >
            <summary className="flex cursor-pointer items-center justify-between gap-4 text-sm font-semibold text-gray-900 list-none">
              <span>
                {group.year} ({group.count})
              </span>
              <span className="text-gray-400">
                {group.count > 0 ? "▾" : "▸"}
              </span>
            </summary>

            {group.items.length > 0 && (
              <div className="mt-4 space-y-3">
                {group.items.map((subject) => (
                  <div
                    key={subject.title}
                    className="rounded-3xl bg-white p-4 border border-gray-100 shadow-sm flex items-center justify-between gap-4"
                  >
                    <div>
                      <p className="font-semibold text-gray-900">
                        {subject.title}
                      </p>
                      <p className="mt-1 text-sm text-gray-500">
                        {subject.code}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 text-gray-500">
                      <button className="rounded-full p-2 hover:bg-gray-100 transition">
                        <svg
                          className="w-4 h-4"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M12 20h9" />
                          <path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4 12.5-12.5z" />
                        </svg>
                      </button>
                      <button className="rounded-full p-2 hover:bg-gray-100 transition">
                        <svg
                          className="w-4 h-4"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M3 6h18" />
                          <path d="M8 6v14" />
                          <path d="M16 6v14" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </details>
        ))}
      </div>
    </div>
  </div>
);

const ACADEMIC_API = "/api";

const pluralize = (count, singular, plural = `${singular}s`) => `${count} ${count === 1 ? singular : plural}`;

const OverflowMenu = ({ onEdit, onArchive, onDelete }) => (
  <details className="relative" onClick={(event) => event.stopPropagation()}>
    <summary className="flex h-8 w-8 cursor-pointer list-none items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 [&::-webkit-details-marker]:hidden">
      <MoreHorizontal size={17} />
    </summary>
    <div className="absolute right-0 top-9 z-20 min-w-32 rounded-xl border border-slate-200 bg-white p-1.5 text-left shadow-lg">
      {onEdit && <button type="button" onClick={onEdit} className="block w-full rounded-lg px-3 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50">Edit</button>}
      {onArchive && <button type="button" onClick={onArchive} className="block w-full rounded-lg px-3 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50">Archive</button>}
      {onDelete && <button type="button" onClick={onDelete} className="block w-full rounded-lg px-3 py-2 text-left text-xs font-medium text-red-600 hover:bg-red-50">Delete</button>}
    </div>
  </details>
);

const Breadcrumbs = ({ campus, department, program }) => {
  const navigate = useNavigate();
  const linkClass = "rounded px-1 py-0.5 transition hover:bg-red-50 hover:text-[#B4454A]";
  return (
    <nav className="mb-2 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500" aria-label="Breadcrumb">
      <button type="button" onClick={() => navigate("/admin/academic")} className={linkClass}>Academic Management</button>
      {campus && <><ChevronRight size={13} /><button type="button" onClick={() => navigate(`/admin/academic/campus/${campus.id}`)} className={department || program ? linkClass : "font-medium text-slate-700"}>{campus.name}</button></>}
      {department && <><ChevronRight size={13} /><button type="button" onClick={() => navigate(`/admin/academic/campus/${campus.id}/department/${department.id}`)} className={program ? linkClass : "font-medium text-slate-700"}>{department.name}</button></>}
      {program && <><ChevronRight size={13} /><span className="font-medium text-slate-700">{program.name}</span></>}
    </nav>
  );
};

const SummaryStat = ({ icon: Icon, label, value }) => (
  <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
    <div className="flex items-center gap-2 text-xs font-medium text-slate-500"><Icon size={14} className="text-[#B4454A]" />{label}</div>
    <strong className="mt-2 block text-xl font-semibold text-slate-900">{value}</strong>
  </div>
);

const DepartmentLeadershipSection = ({ department, onSave }) => {
  const [form, setForm] = React.useState({
    dean_name: department?.dean_name || department?.dean?.name || "",
    chair_name: department?.chair_name || "",
  });

  React.useEffect(() => {
    setForm({
      dean_name: department?.dean_name || department?.dean?.name || "",
      chair_name: department?.chair_name || "",
    });
  }, [department?.id, department?.dean_name, department?.dean?.name, department?.chair_name]);

  const handleSave = async (event) => {
    event.preventDefault();
    await onSave({
      dean_name: form.dean_name.trim(),
      chair_name: form.chair_name.trim(),
    });
  };

  return (
    <form onSubmit={handleSave} className="mb-5 rounded-2xl border border-slate-700 bg-[#121b2a] p-2.5 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.08)]">
      <div className="grid gap-2.5 md:grid-cols-2">
        <div className="rounded-xl border border-slate-700 bg-[#0d1522] p-2.5">
          <div className="mb-2 flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#B4454A]/15 text-[#f4a4a6]"><Users size={13} /></span>
            <div>
              <h3 className="text-base font-semibold text-slate-100">Department Dean</h3>
              <p className="mt-0.5 text-[10px] text-slate-400">Type the dean assigned to this department.</p>
            </div>
          </div>
          <input
            value={form.dean_name}
            onChange={(event) => setForm((prev) => ({ ...prev, dean_name: event.target.value }))}
            placeholder="Enter dean name"
            className="w-full rounded-lg border border-slate-600 bg-[#1a2436] px-2.5 py-2 text-sm text-slate-100 outline-none ring-0 placeholder:text-slate-400 focus:border-[#B4454A]"
          />
          {!form.dean_name && <p className="mt-1 text-[9px] text-slate-400">No dean assigned yet</p>}
        </div>

        <div className="rounded-xl border border-slate-700 bg-[#0d1522] p-2.5">
          <div className="mb-2 flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#B4454A]/15 text-[#f4a4a6]"><Users size={13} /></span>
            <div>
              <h3 className="text-base font-semibold text-slate-100">Program Chair</h3>
              <p className="mt-0.5 text-[10px] text-slate-400">Type the program chair assigned to this department.</p>
            </div>
          </div>
          <input
            value={form.chair_name}
            onChange={(event) => setForm((prev) => ({ ...prev, chair_name: event.target.value }))}
            placeholder="Enter program chair name"
            className="w-full rounded-lg border border-slate-600 bg-[#1a2436] px-2.5 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-400 focus:border-[#B4454A]"
          />
          {!form.chair_name && <p className="mt-1 text-[9px] text-slate-400">No program chair assigned yet</p>}
        </div>
      </div>

      <div className="mt-2.5 flex justify-end gap-2">
        <button
          type="button"
          onClick={async () => {
            setForm({ dean_name: "", chair_name: "" });
            await onSave({ dean_name: "", chair_name: "" });
          }}
          className="inline-flex items-center justify-center rounded-xl border border-slate-600 bg-transparent px-4 py-2 text-sm font-medium text-slate-300 transition hover:border-slate-500 hover:text-slate-100"
        >
          Clear
        </button>
        <button type="submit" className="inline-flex items-center justify-center rounded-xl bg-[#D96A73] px-4 py-2 text-sm font-semibold text-white shadow-md transition hover:bg-[#c85d67] focus:outline-none focus:ring-2 focus:ring-[#D96A73]/50">
          Save
        </button>
      </div>
    </form>
  );
};

const AcademicCard = ({ icon: Icon, title, code, description, meta, selected, onSelect, onEdit, onArchive, onDelete, actionLabel = "View" }) => {
  if (description === "Academic department") {
    return <AcademicListRow icon={Icon} title={title} code={code} status="Active" meta={meta} onSelect={onSelect} onEdit={onEdit} onArchive={onArchive} onDelete={onDelete} actionLabel={actionLabel} />;
  }

  return (
    <article role="button" tabIndex={0} onClick={onSelect} onKeyDown={(event) => event.key === "Enter" && onSelect()} className={`group rounded-xl border bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[#B4454A]/50 hover:shadow-md ${selected ? "border-[#B4454A] ring-1 ring-[#B4454A]/20" : "border-slate-200"}`}>
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#B4454A]/10 text-[#B4454A]"><Icon size={20} /></span>
        <div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><h3 className="truncate font-semibold text-slate-900">{title}</h3><OverflowMenu onEdit={onEdit} onArchive={onArchive} onDelete={onDelete} /></div>{code && <span className="mt-1 inline-flex rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-600">{code}</span>}<p className="mt-2 line-clamp-2 text-xs text-slate-500">{description}</p></div>
      </div>
      <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3"><span className="text-xs text-slate-500">{meta}</span><button type="button" onClick={(event) => { event.stopPropagation(); onSelect(); }} className="text-xs font-semibold text-[#B4454A] hover:text-[#8F1C2B]">{actionLabel} <ChevronRight size={13} className="ml-0.5 inline" /></button></div>
    </article>
  );
};

const AcademicListRow = ({ icon: Icon, title, code, status, meta, onSelect, onEdit, onArchive, onDelete, actionLabel }) => (
  <article role="button" tabIndex={0} onClick={onSelect} onKeyDown={(event) => event.key === "Enter" && onSelect()} className="flex cursor-pointer flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-[#B4454A]/40 hover:shadow-md sm:col-span-2 sm:flex-row sm:items-center lg:col-span-3">
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#B4454A]/10 text-[#B4454A]"><Icon size={20} /></span>
    <div className="min-w-0 flex-1">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="truncate font-semibold text-slate-900">{title}</h3>
        {code && <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-600">{code}</span>}
        {status && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">{status}</span>}
      </div>
      <p className="mt-1 text-xs text-slate-500">{meta}</p>
    </div>
    <div className="flex items-center justify-between gap-3 sm:shrink-0">
      <button type="button" onClick={(event) => { event.stopPropagation(); onSelect(); }} className="text-xs font-semibold text-[#B4454A] hover:text-[#8F1C2B]">{actionLabel} <ChevronRight size={13} className="ml-0.5 inline" /></button>
      <OverflowMenu onEdit={onEdit} onArchive={onArchive} onDelete={onDelete} />
    </div>
  </article>
);

export const AcademicMgmtContent = () => {
  const navigate = useNavigate();
  const { campusId, departmentId, programId } = useParams();
  const [hierarchy, setHierarchy] = React.useState({ campuses: [] });
  const [subjects, setSubjects] = React.useState([]);
  const [programTab, setProgramTab] = React.useState("subjects");
  const [search, setSearch] = React.useState("");
  const [modal, setModal] = React.useState(null);
  const [form, setForm] = React.useState({ name: "", code: "", campus_id: "", department_id: "" });
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");

  const loadData = async () => {
    setLoading(true);
    try {
      const [hierarchyRes, departmentsRes, subjectsRes] = await Promise.all([
        fetch(`${ACADEMIC_API}/academic-hierarchy`),
        fetch(`${ACADEMIC_API}/departments`),
        fetch(`${ACADEMIC_API}/subjects`),
      ]);
      if (!hierarchyRes.ok || !departmentsRes.ok || !subjectsRes.ok) {
        throw new Error("Could not load academic data.");
      }
      const nextHierarchy = await hierarchyRes.json();
      setHierarchy(nextHierarchy);
      setSubjects(await subjectsRes.json());
      await departmentsRes.json();
      setError("");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => { loadData(); }, []);

  const openModal = (type, item = null, parent = null) => {
    setForm({
      name: item?.name || "",
      code: item?.code || "",
      campus_id: item?.campus_id || parent?.id || "",
      department_id: item?.department_id || parent?.department_id || parent?.id || "",
      program_id: item?.program_id || (type === "subject" ? parent?.id || "" : ""),
    });
    setModal({ type, item });
  };

  const submit = async (event) => {
    event.preventDefault();
    const type = modal.type;
    const item = modal.item;
    const endpoint = `/${type === "department" ? "departments" : type === "program" ? "programs" : type === "subject" ? "subjects" : "campuses"}${item ? `/${item.id}` : ""}`;
    const payload = type === "department"
        ? { name: form.name, code: form.code, campus_id: Number(form.campus_id) }
        : type === "program"
          ? { name: form.name, code: form.code, department_id: Number(form.department_id) }
          : type === "subject"
            ? { name: form.name, code: form.code, department_id: Number(form.department_id), program_id: Number(form.program_id) }
          : type === "campus"
            ? { name: form.name }
            : { name: form.name, code: form.code };
    try {
      const response = await fetch(`${ACADEMIC_API}${endpoint}`, {
        method: item ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error("Could not save this item.");
      setModal(null);
      loadData();
    } catch (err) {
      setError(err.message);
    }
  };

  const remove = async (type, id) => {
    if (!window.confirm("Delete this item?")) return;
    const response = await fetch(`${ACADEMIC_API}/${type}/${id}`, {
      method: "DELETE",
    });
    if (!response.ok) setError("Could not delete this item.");
    else loadData();
  };

  const allDepartments = hierarchy.campuses.flatMap((campus) => campus.departments);
  const modalTitle = `${modal?.item ? "Edit" : "Add"} ${modal?.type}`;
  const normalizedSearch = search.trim().toLowerCase();
  const visibleCampuses = hierarchy.campuses.map((campus) => ({
    ...campus,
    departments: campus.departments
      .map((department) => ({
        ...department,
        programs: department.programs.filter((program) => !normalizedSearch || [campus.name, department.name, department.code, program.name, program.code].some((value) => String(value || "").toLowerCase().includes(normalizedSearch))),
      }))
      .filter((department) => !normalizedSearch || [campus.name, department.name, department.code].some((value) => String(value || "").toLowerCase().includes(normalizedSearch)) || department.programs.length > 0),
  })).filter((campus) => !normalizedSearch || campus.name.toLowerCase().includes(normalizedSearch) || campus.departments.length > 0);
  const selectedCampusId = campusId ? Number(campusId) : null;
  const selectedDepartmentId = departmentId ? Number(departmentId) : null;
  const selectedProgramId = programId ? Number(programId) : null;
  const selectedCampus = hierarchy.campuses.find((campus) => campus.id === selectedCampusId) || null;
  const selectedDepartment = selectedCampus?.departments.find((department) => department.id === selectedDepartmentId) || null;
  const selectedProgram = selectedDepartment?.programs.find((program) => program.id === selectedProgramId) || null;
  const programSubjects = subjects.filter((subject) => subject.program_id === selectedProgramId);

  const chooseCampus = (campus) => navigate(`/admin/academic/campus/${campus.id}`);
  const chooseDepartment = (department) => navigate(`/admin/academic/campus/${selectedCampus.id}/department/${department.id}`);
  const chooseProgram = (program) => navigate(`/admin/academic/campus/${selectedCampus.id}/department/${selectedDepartment.id}/program/${program.id}`);
  const saveDepartmentLeadership = async ({ dean_name, chair_name }) => {
    try {
      const updates = [];
      const deanValue = typeof dean_name === "string" ? dean_name.trim() : "";
      const chairValue = typeof chair_name === "string" ? chair_name.trim() : "";

      setHierarchy((previousHierarchy) => ({
        ...previousHierarchy,
        campuses: previousHierarchy.campuses.map((campus) => ({
          ...campus,
          departments: campus.departments.map((department) => department.id === selectedDepartment?.id
            ? {
                ...department,
                dean_name: deanValue ?? "",
                chair_name: chairValue ?? "",
                dean: deanValue ? department.dean || null : null,
              }
            : department),
        })),
      }));

      if (deanValue !== (selectedDepartment?.dean_name || selectedDepartment?.dean?.name || null)) {
        updates.push(fetch(`${ACADEMIC_API}/departments/${selectedDepartment.id}/dean`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: deanValue }),
        }));
      }

      if (chairValue !== (selectedDepartment?.chair_name || null)) {
        updates.push(fetch(`${ACADEMIC_API}/departments/${selectedDepartment.id}/chair`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: chairValue }),
        }));
      }

      if (!updates.length) return;

      const responses = await Promise.all(updates);
      const failed = responses.find((response) => !response.ok);
      if (failed) throw new Error("Could not update this leadership assignment.");
      await loadData();
    } catch (err) {
      setError(err.message);
    }
  };
  const departmentFaculty = selectedDepartment ? [...new Map([...hierarchy.faculty.filter((member) => (member.department || "").toLowerCase() === selectedDepartment.name.toLowerCase()), ...selectedDepartment.programs.flatMap((program) => program.faculty || [])].map((member) => [member.id, member])).values()] : [];

  return (
    <div className="bq-academic-attached grid gap-6">
      {error && (
        <div className="xl:col-span-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}
      <section className="bq-academic-surface mx-auto w-full max-w-7xl rounded-2xl border border-slate-200 bg-slate-50/70 p-4 shadow-sm sm:p-5">
        <div className="mb-4 flex flex-col justify-between gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-center">
          <div>
            <Breadcrumbs campus={selectedCampus} department={selectedDepartment} program={selectedProgram} />
            <h2 className="text-xl font-semibold tracking-tight text-slate-900">{programId ? selectedProgram?.name || "Program" : departmentId ? selectedDepartment?.name || "Department" : campusId ? selectedCampus?.name || "Campus" : "Academic Management"}</h2>
            <p className="mt-0.5 text-xs text-slate-500">{programId ? "Manage subjects, faculty, and curriculum for this program." : departmentId ? "Manage academic programs offered by this department." : campusId ? "Manage departments and academic units within this campus." : "Manage your institution&apos;s academic organization."}</p>
          </div>
          {!campusId && <button className="bq-primary-button inline-flex items-center gap-2 self-start whitespace-nowrap" onClick={() => openModal("campus")}><Plus size={16} /> Add Campus</button>}
          {campusId && !departmentId && <button className="bq-primary-button inline-flex items-center gap-2 self-start whitespace-nowrap" onClick={() => openModal("department", null, selectedCampus)}><Plus size={16} /> Add Department</button>}
          {departmentId && !programId && <button className="bq-primary-button inline-flex items-center gap-2 self-start whitespace-nowrap" onClick={() => openModal("program", null, selectedDepartment)}><Plus size={16} /> Add Program</button>}
        </div>
        <div className="mb-5 flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <Search size={16} className="text-slate-400" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={campusId ? "Search this academic page..." : "Search campus, department, or program..."}
            className="w-full bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
          />
        </div>
        {!loading && selectedDepartment && !programId && (
          <DepartmentLeadershipSection department={selectedDepartment} onSave={saveDepartmentLeadership} />
        )}
        {loading ? (
          <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">Loading academic structure...</div>
        ) : !campusId && visibleCampuses.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
            <Building2 size={28} className="mx-auto text-slate-300" /><p className="mt-3 text-sm font-semibold text-slate-700">{search ? "No matching academic units found." : "No campuses yet."}</p><p className="mt-1 text-xs text-slate-500">Add a campus to begin organizing your academic structure.</p>
          </div>
        ) : !campusId ? (
          <div>
            <div>
              <div className="mb-4 flex items-end justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#B4454A]">Campus overview</p><h3 className="mt-1 text-lg font-semibold text-slate-900">Select a campus</h3></div><span className="text-xs text-slate-500">{pluralize(visibleCampuses.length, "campus")}</span></div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">{visibleCampuses.map((campus) => <AcademicCard key={campus.id} icon={Building2} title={campus.name} description="Academic campus" meta={pluralize(campus.departments.length, "Department")} selected={selectedCampusId === campus.id} onSelect={() => chooseCampus(campus)} onEdit={() => openModal("campus", campus)} onArchive={() => remove("campuses", campus.id)} actionLabel="View Departments" />)}</div>
            </div>
          </div>
        ) : (
          <div>
            <div className="mb-6"><button className="mb-3 inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-[#B4454A]" onClick={() => navigate(departmentId ? `/admin/academic/campus/${campusId}` : "/admin/academic")}><ArrowLeft size={14} /> Back</button>{!departmentId && selectedCampus && <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">{selectedCampus.departments.map((department) => <AcademicCard key={department.id} icon={GraduationCap} title={department.name} code={department.code} description="Academic department" meta={`${pluralize(department.programs.length, "Program")} · ${pluralize(department.programs.reduce((total, program) => total + (program.faculty?.length || 0), 0), "Faculty")}`} onSelect={() => chooseDepartment(department)} onEdit={() => openModal("department", { ...department, campus_id: selectedCampus.id })} onArchive={() => remove("departments", department.id)} actionLabel="View Department" />)}</div>}{departmentId && !programId && selectedDepartment && <div className="space-y-3">{selectedDepartment.programs.map((program) => <div key={program.id} role="button" tabIndex={0} onClick={() => chooseProgram(program)} onKeyDown={(event) => event.key === "Enter" && chooseProgram(program)} className="flex cursor-pointer flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-[#B4454A]/40 hover:shadow-md sm:flex-row sm:items-center"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#B4454A]/10 text-[#B4454A]"><Layers3 size={20} /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold text-slate-900">{program.name}</h3>{program.code && <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-600">{program.code}</span>}<span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">Active</span></div><p className="mt-1 text-xs text-slate-500">Bachelor&apos;s degree · {pluralize(subjects.filter((subject) => subject.program_id === program.id).length, "Subject")} · {pluralize(program.faculty?.length || 0, "Faculty")}</p></div><span className="text-xs font-semibold text-[#B4454A]">View Program <ChevronRight size={13} className="inline" /></span><OverflowMenu onEdit={() => openModal("program", { ...program, department_id: selectedDepartment.id })} onArchive={() => remove("programs", program.id)} /></div>)}</div>}</div>
            {programId && selectedProgram && <div>
              <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><SummaryStat icon={BookOpen} label="Subjects" value={programSubjects.length} /><SummaryStat icon={Users} label="Faculty" value={selectedProgram.faculty?.length || 0} /><SummaryStat icon={Layers3} label="Program length" value="4 years" /><SummaryStat icon={Archive} label="Status" value="Active" /></div>
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200"><div className="flex gap-5"><button type="button" onClick={() => setProgramTab("subjects")} className={`border-b-2 px-1 pb-3 text-sm font-semibold ${programTab === "subjects" ? "border-[#B4454A] text-[#B4454A]" : "border-transparent text-slate-500"}`}>Subjects</button><button type="button" onClick={() => setProgramTab("faculty")} className={`border-b-2 px-1 pb-3 text-sm font-semibold ${programTab === "faculty" ? "border-[#B4454A] text-[#B4454A]" : "border-transparent text-slate-500"}`}>Faculty</button></div>{programTab === "subjects" && <button type="button" className="bq-primary-button mb-2 inline-flex items-center gap-2" onClick={() => openModal("subject", null, { id: selectedProgram.id, department_id: selectedDepartment.id })}><Plus size={15} /> Add Subject</button>}</div>
              {programTab === "subjects" && <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white"><table className="w-full min-w-[700px] text-left"><thead className="bg-slate-50 text-[11px] uppercase tracking-[0.12em] text-slate-500"><tr><th className="px-4 py-3 font-semibold">Subject</th><th className="px-4 py-3 font-semibold">Code</th><th className="px-4 py-3 font-semibold">Units</th><th className="px-4 py-3 font-semibold">Year</th><th className="px-4 py-3 font-semibold">Semester</th><th className="px-4 py-3 font-semibold">Status</th><th className="px-4 py-3" /></tr></thead><tbody className="divide-y divide-slate-100">{programSubjects.map((subject) => <tr key={subject.id} className="hover:bg-slate-50"><td className="px-4 py-3 text-sm font-medium text-slate-800">{subject.name}</td><td className="px-4 py-3 text-sm text-slate-500">{subject.code || "-"}</td><td className="px-4 py-3 text-sm text-slate-500">3 Units</td><td className="px-4 py-3 text-sm text-slate-500">-</td><td className="px-4 py-3 text-sm text-slate-500">-</td><td className="px-4 py-3"><span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">Active</span></td><td className="px-4 py-3"><OverflowMenu onEdit={() => openModal("subject", subject, selectedProgram)} onArchive={() => remove("subjects", subject.id)} /></td></tr>)}</tbody></table>{programSubjects.length === 0 && <div className="p-10 text-center"><BookOpen size={28} className="mx-auto text-slate-300" /><p className="mt-3 text-sm font-semibold text-slate-700">No subjects assigned yet.</p><p className="mt-1 text-xs text-slate-500">Add subjects to this program to begin building its curriculum.</p><button type="button" className="bq-primary-button mt-4 inline-flex items-center gap-2" onClick={() => openModal("subject", null, { id: selectedProgram.id, department_id: selectedDepartment.id })}><Plus size={15} /> Add Subject</button></div>}</div>}
              {programTab === "faculty" && <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white"><table className="w-full text-left"><thead className="bg-slate-50 text-[11px] uppercase tracking-[0.12em] text-slate-500"><tr><th className="px-4 py-3 font-semibold">Name</th><th className="px-4 py-3 font-semibold">Email</th></tr></thead><tbody className="divide-y divide-slate-100">{(selectedProgram.faculty || []).map((member) => <tr key={member.id}><td className="px-4 py-3 text-sm text-slate-800">{member.name}</td><td className="px-4 py-3 text-sm text-slate-500">{member.email}</td></tr>)}</tbody></table>{!selectedProgram.faculty?.length && <p className="p-8 text-center text-sm text-slate-500">No faculty assigned to this program.</p>}</div>}
            </div>}
          </div>
        )}
      </section>
      {modal && (
        <div className="bq-modal-overlay fixed inset-0 z-50 flex items-center justify-center p-4">
          <form
            onSubmit={submit}
            className="bq-modal-panel w-full max-w-md p-6"
          >
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">
                {modalTitle}
              </h3>
              <button
                type="button"
                className="text-slate-400"
                onClick={() => setModal(null)}
              >
                Close
              </button>
            </div>
            <>
            <label className="mb-4 block text-sm font-semibold text-slate-700">
              Name
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="bq-field mt-1 w-full px-3"
              />
            </label>
            {modal.type !== "campus" && <label className="mb-5 block text-sm font-semibold text-slate-700">
              Code
              <input
                required
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                className="bq-field mt-1 w-full px-3"
              />
            </label>}
            {modal.type === "department" && <label className="mb-5 block text-sm font-semibold text-slate-700">Campus<select required value={form.campus_id} onChange={(e) => setForm({ ...form, campus_id: e.target.value })} className="bq-field mt-1 w-full px-3"><option value="">Select a campus</option>{hierarchy.campuses.map((campus) => <option key={campus.id} value={campus.id}>{campus.name}</option>)}</select></label>}
            {modal.type === "program" && <label className="mb-5 block text-sm font-semibold text-slate-700">Department<select required value={form.department_id} onChange={(e) => setForm({ ...form, department_id: e.target.value })} className="bq-field mt-1 w-full px-3"><option value="">Select a department</option>{allDepartments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</select></label>}
            {modal.type === "subject" && <label className="mb-5 block text-sm font-semibold text-slate-700">Program<select required value={form.program_id} onChange={(e) => setForm({ ...form, program_id: e.target.value })} className="bq-field mt-1 w-full px-3"><option value="">Select a program</option>{allDepartments.flatMap((department) => department.programs.map((program) => <option key={program.id} value={program.id}>{department.name} / {program.name}</option>))}</select></label>}
            </>}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="bq-secondary-button"
                onClick={() => setModal(null)}
              >
                Cancel
              </button>
              <button className="bq-primary-button">Save</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

const AcademicMgmtBtn = ({ activeTab, setActiveTab }) => {
  const isActive = activeTab === "academic";

  return (
    <button
      onClick={() => setActiveTab("academic")}
      className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-left transition-all duration-150 relative"
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
      {isActive && (
        <span
          className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full"
          style={{ background: "#fff" }}
        />
      )}
      <svg
        className="w-5 h-5 flex-shrink-0"
        fill="currentColor"
        viewBox="0 0 20 20"
        style={{ color: isActive ? "#ffffff" : "var(--bq-accent)" }}
      >
        <path d="M10.394 2.08a1 1 0 00-.788 0l-7 3a1 1 0 000 1.84L5.25 8.051a.999.999 0 01.356-.257l4-1.714a1 1 0 11.788 1.838L7.667 9.088l1.94.831a1 1 0 00.787 0l7-3a1 1 0 000-1.838l-7-3zM3.31 9.397L5 10.12v4.102a8.969 8.969 0 00-1.05-.174 1 1 0 01-.89-.89 11.115 11.115 0 01.25-3.762zM9.3 16.573A9.026 9.026 0 007 14.935v-3.957l1.818.78a3 3 0 002.364 0l5.508-2.361a11.026 11.026 0 01.25 3.762 1 1 0 01-.89.89 8.968 8.968 0 00-5.35 2.524 1 1 0 01-1.4 0zM6 18a1 1 0 001-1v-2.065a8.935 8.935 0 00-2-.712V17a1 1 0 001 1z" />
      </svg>
      <span className="text-sm font-medium tracking-wide">
        Academic Management
      </span>
    </button>
  );
};

export default AcademicMgmtBtn;
