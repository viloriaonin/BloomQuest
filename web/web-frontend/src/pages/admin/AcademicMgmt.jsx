import React from "react";

const LegacyAcademicMgmtContent = () => (
  <div className="grid gap-6 xl:grid-cols-[1.3fr_1fr_1fr]">
    <div className="rounded-[32px] bg-white p-6 shadow-sm border border-gray-200">
      <div className="flex items-center justify-between gap-4 mb-6">
        <div>
          <p className="text-sm font-semibold text-gray-500">Departments</p>
          <p className="text-xs text-gray-400">Manage academic units and schools</p>
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
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 20h9" />
                    <path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4 12.5-12.5z" />
                  </svg>
                </button>
                <button className="rounded-full p-2 hover:bg-gray-100 transition">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
            <p className="font-semibold text-gray-900">Bachelor of Science in Computer Science</p>
            <p className="mt-2 text-sm text-gray-500">BSCS</p>
          </div>
          <div className="flex items-center gap-2 text-gray-500">
            <button className="rounded-full p-2 hover:bg-gray-100 transition">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4 12.5-12.5z" />
              </svg>
            </button>
            <button className="rounded-full p-2 hover:bg-gray-100 transition">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
          <p className="text-xs text-gray-400">Organize courses by year level</p>
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
          <details key={group.year} className="rounded-3xl bg-gray-50 border border-gray-100 p-4">
            <summary className="flex cursor-pointer items-center justify-between gap-4 text-sm font-semibold text-gray-900 list-none">
              <span>{group.year} ({group.count})</span>
              <span className="text-gray-400">{group.count > 0 ? "▾" : "▸"}</span>
            </summary>

            {group.items.length > 0 && (
              <div className="mt-4 space-y-3">
                {group.items.map((subject) => (
                  <div key={subject.title} className="rounded-3xl bg-white p-4 border border-gray-100 shadow-sm flex items-center justify-between gap-4">
                    <div>
                      <p className="font-semibold text-gray-900">{subject.title}</p>
                      <p className="mt-1 text-sm text-gray-500">{subject.code}</p>
                    </div>
                    <div className="flex items-center gap-2 text-gray-500">
                      <button className="rounded-full p-2 hover:bg-gray-100 transition">
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 20h9" />
                          <path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4 12.5-12.5z" />
                        </svg>
                      </button>
                      <button className="rounded-full p-2 hover:bg-gray-100 transition">
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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

export const AcademicMgmtContent = () => {
  const [departments, setDepartments] = React.useState([]);
  const [subjects, setSubjects] = React.useState([]);
  const [modal, setModal] = React.useState(null);
  const [editingItem, setEditingItem] = React.useState(null);
  const [form, setForm] = React.useState({ name: "", code: "", department_id: "" });
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");

  const loadData = React.useCallback(async () => {
    setLoading(true);
    try {
      const [departmentsRes, subjectsRes] = await Promise.all([fetch(`${ACADEMIC_API}/departments`), fetch(`${ACADEMIC_API}/subjects`)]);
      if (!departmentsRes.ok || !subjectsRes.ok) throw new Error("Could not load academic data.");
      setDepartments(await departmentsRes.json());
      setSubjects(await subjectsRes.json());
      setError("");
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, []);

  React.useEffect(() => { loadData(); }, [loadData]);

  const openModal = (type, item = null) => {
    setEditingItem(item);
    setForm(item ? { name: item.name, code: item.code, department_id: item.department_id || "" } : { name: "", code: "", department_id: departments[0]?.id || "" });
    setModal(type);
  };

  const submit = async (event) => {
    event.preventDefault();
    const isSubject = modal === "subject";
    const endpoint = `${isSubject ? "/subjects" : "/departments"}${editingItem ? `/${editingItem.id}` : ""}`;
    const payload = isSubject ? { name: form.name, code: form.code, department_id: Number(form.department_id), user_id: localStorage.getItem("user_id") } : { name: form.name, code: form.code };
    try {
      const response = await fetch(`${ACADEMIC_API}${endpoint}`, { method: editingItem ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!response.ok) throw new Error("Could not save this item.");
      setModal(null); setEditingItem(null); setForm({ name: "", code: "", department_id: "" }); loadData();
    } catch (err) { setError(err.message); }
  };

  const remove = async (type, id) => {
    if (!window.confirm("Delete this item?")) return;
    const response = await fetch(`${ACADEMIC_API}/${type}/${id}`, { method: "DELETE" });
    if (!response.ok) setError("Could not delete this item."); else loadData();
  };

  return <div className="grid gap-6 xl:grid-cols-2">
    {error && <div className="xl:col-span-2 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
    <section className="bq-panel rounded-3xl p-6"><div className="mb-6 flex items-start justify-between gap-4"><div><p className="text-sm font-semibold text-slate-500">Departments</p><p className="mt-1 text-xs text-slate-400">Manage academic units and schools</p></div><button className="bq-primary-button" onClick={() => openModal("department")}>Add department</button></div>{loading ? <p className="text-sm text-slate-400">Loading departments...</p> : <div className="space-y-3">{departments.map((department) => <div key={department.id} className="flex items-center justify-between gap-4 rounded-3xl border border-red-100 bg-[#faf7f7] p-5"><div><p className="font-semibold text-slate-900">{department.name}</p><p className="mt-1 text-sm text-slate-500">{department.code}</p></div><div className="flex gap-3"><button className="text-sm font-semibold text-slate-500 hover:text-[#B4454A]" onClick={() => openModal("department", department)}>Edit</button><button className="text-sm font-semibold text-red-600" onClick={() => remove("departments", department.id)}>Delete</button></div></div>)}</div>}</section>
    <section className="bq-panel rounded-3xl p-6"><div className="mb-6 flex items-start justify-between gap-4"><div><p className="text-sm font-semibold text-slate-500">Subjects</p><p className="mt-1 text-xs text-slate-400">Assign subjects to departments</p></div><button className="bq-primary-button" onClick={() => openModal("subject")}>Add subject</button></div>{loading ? <p className="text-sm text-slate-400">Loading subjects...</p> : <div className="space-y-3">{subjects.map((subject) => <div key={subject.id} className="flex items-center justify-between gap-4 rounded-3xl border border-red-100 bg-[#faf7f7] p-5"><div><p className="font-semibold text-slate-900">{subject.name}</p><p className="mt-1 text-sm text-slate-500">{subject.code} <span className="mx-1 text-slate-300">|</span> {departments.find((item) => item.id === subject.department_id)?.name || "Unassigned"}</p></div><div className="flex gap-3"><button className="text-sm font-semibold text-slate-500 hover:text-[#B4454A]" onClick={() => openModal("subject", subject)}>Edit</button><button className="text-sm font-semibold text-red-600" onClick={() => remove("subjects", subject.id)}>Delete</button></div></div>)}</div>}</section>
    {modal && <div className="bq-modal-overlay fixed inset-0 z-50 flex items-center justify-center p-4"><form onSubmit={submit} className="bq-modal-panel w-full max-w-md p-6"><div className="mb-5 flex items-center justify-between"><h3 className="text-lg font-bold text-slate-900">{editingItem ? "Edit" : "Add"} {modal}</h3><button type="button" className="text-slate-400" onClick={() => setModal(null)}>Close</button></div><label className="mb-4 block text-sm font-semibold text-slate-700">Name<input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="bq-field mt-1 w-full px-3" /></label><label className="mb-4 block text-sm font-semibold text-slate-700">Code<input required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} className="bq-field mt-1 w-full px-3" /></label>{modal === "subject" && <label className="mb-5 block text-sm font-semibold text-slate-700">Department<select required value={form.department_id} onChange={(e) => setForm({ ...form, department_id: e.target.value })} className="bq-field mt-1 w-full px-3"><option value="">Select department</option>{departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</select></label>}<div className="flex justify-end gap-2"><button type="button" className="bq-secondary-button" onClick={() => setModal(null)}>Cancel</button><button className="bq-primary-button">Save</button></div></form></div>}
  </div>;
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
      <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"
        style={{ color: isActive ? "#ffffff" : "var(--bq-accent)" }}>
        <path d="M10.394 2.08a1 1 0 00-.788 0l-7 3a1 1 0 000 1.84L5.25 8.051a.999.999 0 01.356-.257l4-1.714a1 1 0 11.788 1.838L7.667 9.088l1.94.831a1 1 0 00.787 0l7-3a1 1 0 000-1.838l-7-3zM3.31 9.397L5 10.12v4.102a8.969 8.969 0 00-1.05-.174 1 1 0 01-.89-.89 11.115 11.115 0 01.25-3.762zM9.3 16.573A9.026 9.026 0 007 14.935v-3.957l1.818.78a3 3 0 002.364 0l5.508-2.361a11.026 11.026 0 01.25 3.762 1 1 0 01-.89.89 8.968 8.968 0 00-5.35 2.524 1 1 0 01-1.4 0zM6 18a1 1 0 001-1v-2.065a8.935 8.935 0 00-2-.712V17a1 1 0 001 1z" />
      </svg>
      <span className="text-sm font-medium tracking-wide">Academic Management</span>
    </button>
  );
};

export default AcademicMgmtBtn;