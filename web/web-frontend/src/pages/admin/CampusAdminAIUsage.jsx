import React, { useEffect, useState } from "react";
import { Bar } from "react-chartjs-2";
import { BarElement, CategoryScale, Chart as ChartJS, Legend, LinearScale, Tooltip } from "chart.js";
import { API_URL } from "../../config/api";

ChartJS.register(BarElement, CategoryScale, Legend, LinearScale, Tooltip);

const EMPTY_FILTERS = {
  date_from: "",
  date_to: "",
  department_id: "",
  program_id: "",
  instructor_id: "",
  request_status: "",
};
const formatNumber = (value) => new Intl.NumberFormat().format(Number(value) || 0);
const BREAKDOWN_CHART_OPTIONS = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false } },
  scales: {
    x: {
      grid: { display: false },
      ticks: {
        autoSkip: false,
        minRotation: 18,
        maxRotation: 25,
        color: "rgba(203, 213, 225, 0.62)",
      },
    },
    y: {
      beginAtZero: true,
      ticks: { precision: 0, color: "rgba(203, 213, 225, 0.62)" },
      grid: { color: "rgba(255, 255, 255, 0.06)" },
    },
  },
};
const CampusAdminAIUsage = () => {
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [usage, setUsage] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [filtersLoading, setFiltersLoading] = useState(true);
  const [filtersError, setFiltersError] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    const loadFilterOptions = async () => {
      setFiltersLoading(true);
      setFiltersError("");
      try {
        const response = await fetch(`${API_URL}/academic-hierarchy`, {
          headers: { Authorization: `******"token") || ""}` },
          signal: controller.signal,
        });
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload.detail || "Could not load department, program, and instructor filters.");
        }
        const hierarchy = await response.json();
        const campusDepartments = (hierarchy.campuses || []).flatMap((campus) => campus.departments || []);
        setDepartments(campusDepartments);
      } catch (loadError) {
        if (loadError.name !== "AbortError") {
          setFiltersError(loadError.message || "Could not load department, program, and instructor filters.");
        }
      } finally {
        if (!controller.signal.aborted) setFiltersLoading(false);
      }
    };
    loadFilterOptions();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const loadUsage = async () => {
      setLoading(true);
      setError("");
      setUsage(null);
      try {
        const params = new URLSearchParams();
        Object.entries(filters).forEach(([key, value]) => {
          if (value) params.set(key, value);
        });
        const response = await fetch(`${API_URL}/admin/ai-usage?${params.toString()}`, {
          headers: { Authorization: `Bearer ${localStorage.getItem("token") || ""}` },
          signal: controller.signal,
        });
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload.detail || "Could not load campus AI usage.");
        }
        setUsage(await response.json());
      } catch (loadError) {
        if (loadError.name !== "AbortError") setError(loadError.message || "Could not load campus AI usage.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    loadUsage();
    return () => controller.abort();
  }, [filters]);

  const totals = usage?.totals || {};
  const userRows = usage?.requests_by_user || [];
  const errorRows = usage?.error_types || [];
  const tokenUsage = usage?.token_usage;
  const selectedDepartment = departments.find((department) => String(department.id) === filters.department_id);
  const programOptions = selectedDepartment?.programs || [];
  const selectedProgram = programOptions.find((program) => String(program.id) === filters.program_id);
  const instructorOptions = selectedProgram
    ? selectedProgram.faculty || []
    : selectedDepartment
      ? selectedDepartment.faculty || []
      : [];
  const uniqueInstructorOptions = [...new Map(instructorOptions.map((instructor) => [instructor.id, instructor])).values()];
  const breakdownLevel = filters.instructor_id
    ? "instructor"
    : filters.program_id
      ? "instructor"
      : filters.department_id
        ? "program"
        : "department";
  const breakdownTitle = {
    department: "by department",
    program: "by program",
    instructor: "by instructor",
  }[breakdownLevel];
  const breakdown = userRows.reduce((groups, user) => {
    let id;
    let label;
    if (breakdownLevel === "instructor") {
      id = `instructor-${user.user_id}`;
      label = user.name;
    } else if (breakdownLevel === "program") {
      const program = programOptions.find((option) => Number(option.id) === Number(user.program_id));
      id = user.program_id ? `program-${user.program_id}` : "program-unassigned";
      label = program?.name || "No program";
    } else {
      const department = departments.find((option) => (
        Number(option.id) === Number(user.department_id)
        || (
          user.department
          && option.name.trim().toLowerCase() === user.department.trim().toLowerCase()
        )
      ));
      id = department ? `department-${department.id}` : "department-unassigned";
      label = department?.name || "No department";
    }
    const group = groups.get(id) || { label, requests: 0, questions: 0 };
    group.requests += Number(user.requests) || 0;
    group.questions += Number(user.questions) || 0;
    groups.set(id, group);
    return groups;
  }, new Map());
  const breakdownRows = [...breakdown.values()];
  const requestChartData = {
    labels: breakdownRows.map((row) => row.label),
    datasets: [{ label: "Requests", data: breakdownRows.map((row) => row.requests), backgroundColor: "#C4485A", borderRadius: 3, borderSkipped: "bottom" }],
  };
  const questionChartData = {
    labels: breakdownRows.map((row) => row.label),
    datasets: [{ label: "Questions generated", data: breakdownRows.map((row) => row.questions), backgroundColor: "#C4485A", borderRadius: 3, borderSkipped: "bottom" }],
  };
  const updateFilter = (key, value) => setFilters((current) => ({ ...current, [key]: value }));
  const updateDepartmentFilter = (departmentId) => setFilters((current) => ({
    ...current,
    department_id: departmentId,
    program_id: "",
    instructor_id: "",
  }));
  const updateProgramFilter = (programId) => setFilters((current) => ({
    ...current,
    program_id: programId,
    instructor_id: "",
  }));
  const stats = [
    ["AI Requests", totals.total_ai_requests, "#C4485A"],
    ["Generation Requests", totals.generation_requests, "#5587B8"],
    ["Questions Generated", totals.total_questions_generated, "#378A87"],
    ["Successful", totals.successful_requests, "#758B54"],
    ["Failed", totals.failed_requests, "#E0A458"],
    ["Rate-Limit Events", totals.rate_limit_events, "#9B7465"],
    ["Gemini API Calls", totals.gemini_api_calls, "#8C6AA8"],
  ];

  return (
    <div className="space-y-4">
      <section className="bq-admin-panel">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><h2>AI usage filters</h2><p className="bq-admin-muted mt-1 text-sm">View Gemini activity for your assigned campus.</p></div>
          <button type="button" className="bq-admin-action" onClick={() => setFilters(EMPTY_FILTERS)}>Clear filters</button>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <label className="text-sm">From<input aria-label="AI usage start date" type="date" value={filters.date_from} onChange={(event) => updateFilter("date_from", event.target.value)} className="bq-field mt-1 w-full" /></label>
          <label className="text-sm">To<input aria-label="AI usage end date" type="date" value={filters.date_to} onChange={(event) => updateFilter("date_to", event.target.value)} className="bq-field mt-1 w-full" /></label>
          <label className="text-sm">Department<select aria-label="Filter AI usage by department" value={filters.department_id} disabled={filtersLoading} onChange={(event) => updateDepartmentFilter(event.target.value)} className="bq-field mt-1 w-full"><option value="">All departments</option>{departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</select></label>
          <label className="text-sm">Program<select aria-label="Filter AI usage by program" value={filters.program_id} disabled={filtersLoading || !selectedDepartment || !programOptions.length} onChange={(event) => updateProgramFilter(event.target.value)} className="bq-field mt-1 w-full"><option value="">{selectedDepartment && !programOptions.length ? "No programs available" : selectedDepartment ? "All programs" : "Select a department first"}</option>{programOptions.map((program) => <option key={program.id} value={program.id}>{program.name}</option>)}</select></label>
          <label className="text-sm">Instructor<select aria-label="Filter AI usage by instructor" value={filters.instructor_id} disabled={filtersLoading || !selectedDepartment || !uniqueInstructorOptions.length} onChange={(event) => updateFilter("instructor_id", event.target.value)} className="bq-field mt-1 w-full"><option value="">{selectedDepartment && !uniqueInstructorOptions.length ? "No instructors available" : selectedDepartment ? "All instructors" : "Select a department first"}</option>{uniqueInstructorOptions.map((instructor) => <option key={instructor.id} value={instructor.id}>{instructor.name}</option>)}</select></label>
          <label className="text-sm">Status<select aria-label="Filter AI usage by status" value={filters.request_status} onChange={(event) => updateFilter("request_status", event.target.value)} className="bq-field mt-1 w-full"><option value="">All statuses</option><option value="success">Successful</option><option value="failed">Failed</option><option value="rate_limited">Rate limited</option><option value="in_progress">In progress</option></select></label>
        </div>
        {filtersError && <p role="alert" className="mt-3 text-sm text-red-300">{filtersError}</p>}
      </section>

      {error && <div role="alert" className="bq-admin-panel border border-red-500/40 text-sm text-red-300">{error}</div>}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map(([label, value, color]) => (
          <section key={label} className="bq-admin-stat flex min-h-28 flex-col justify-between">
            <div className="bq-admin-stat-label">{label}</div>
            <div className="mt-3 text-3xl font-semibold leading-none" style={{ color: "var(--admin-text, #ecedef)" }}>{loading ? "..." : formatNumber(value)}</div>
            <span className="mt-3 h-1 w-12 rounded-full" style={{ backgroundColor: color }} />
          </section>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="bq-admin-panel"><h2>AI requests {breakdownTitle}</h2><div className="mt-4 h-72">{loading ? <p className="bq-admin-muted pt-8">Loading request breakdown...</p> : breakdownRows.length ? <Bar data={requestChartData} options={BREAKDOWN_CHART_OPTIONS} /> : <p className="bq-admin-muted pt-8">No request data for this selection.</p>}</div></section>
        <section className="bq-admin-panel"><h2>Questions generated {breakdownTitle}</h2><div className="mt-4 h-72">{loading ? <p className="bq-admin-muted pt-8">Loading question breakdown...</p> : breakdownRows.length ? <Bar data={questionChartData} options={BREAKDOWN_CHART_OPTIONS} /> : <p className="bq-admin-muted pt-8">No question data for this selection.</p>}</div></section>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="bq-admin-panel"><h2>Token usage</h2>{tokenUsage?.available ? <div className="mt-4 grid gap-3 sm:grid-cols-3">{[["Input", tokenUsage.input_tokens], ["Output", tokenUsage.output_tokens], ["Total", tokenUsage.total_tokens]].map(([label, value]) => <div key={label} className="rounded-lg border border-slate-700 p-4"><p className="bq-admin-stat-label">{label} tokens</p><p className="mt-2 text-2xl font-semibold">{formatNumber(value)}</p></div>)}</div> : <p className="bq-admin-muted mt-4 text-sm">Token totals are hidden when complete Gemini usage metadata is not available for every request in this selection.</p>}</section>
        <section className="bq-admin-panel"><h2>Failure and rate-limit types</h2><div className="mt-4 overflow-x-auto"><table className="w-full min-w-[360px] text-left text-sm"><thead><tr className="border-b border-slate-700"><th className="py-2 pr-3">Type</th><th className="py-2">Requests</th></tr></thead><tbody>{errorRows.map((row) => <tr key={row.error_type} className="border-b border-slate-800"><td className="py-3 pr-3">{row.error_type}</td><td className="py-3">{formatNumber(row.requests)}</td></tr>)}</tbody></table>{!loading && !errorRows.length && <p className="bq-admin-muted py-5">No error or rate-limit events for these filters.</p>}</div></section>
      </div>
    </div>
  );
};

export default CampusAdminAIUsage;
