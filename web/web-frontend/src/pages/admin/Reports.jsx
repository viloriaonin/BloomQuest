import React, { useEffect, useMemo, useState } from "react";

// ---------------------------------------------------------------------------
// API CONFIG — point this at your real backend.
//
// Expected response: JSON array (or { data: [...] }) of objects shaped like:
//   {
//     id: number | string,
//     name: string,        // faculty display name, e.g. "Dr. Santos"
//     dept: string,        // e.g. "CICS", "COE", "CAS", "CBA"
//     action: string,      // free-text, e.g. "Uploaded module file", "Generated 20 questions"
//     detail: string,      // activity_logs.details
//     type: string,        // activity_logs.type — one of: "generate", "upload", "classify", "login"
//     status: string,      // activity_logs.status — one of: "success", "error", "info"
//     date: string,        // "YYYY-MM-DD"
//     time: string,        // "hh:mm AM/PM"
//   }
//
// If your API already supports query params for filtering, you can pass
// period/department/faculty straight through instead of filtering client-side
// (see the commented-out query-string version in fetchActivityLog below).
// ---------------------------------------------------------------------------
const API_BASE_URL = "/api"; // <-- replace with your backend's base URL
const ACTIVITY_ENDPOINT = `${API_BASE_URL}/activity-logs`;

async function fetchActivityLog() {
  const res = await fetch(ACTIVITY_ENDPOINT, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
    // credentials: "include", // uncomment if your API relies on cookies/session auth
    // headers: { Authorization: `Bearer ${token}` }, // uncomment if using a bearer token
  });

  // --- server-side filtering version, if your API supports it ---
  // const params = new URLSearchParams({ department, faculty, days: selectedPeriod.days ?? "" });
  // const res = await fetch(`${ACTIVITY_ENDPOINT}?${params.toString()}`);

  if (!res.ok) {
    throw new Error(`Request failed with status ${res.status}`);
  }

  const json = await res.json();
  return Array.isArray(json) ? json : json.data ?? [];
}

const DEPARTMENTS = ["All Departments", "CICS", "COE", "CAS", "CBA"];

const PERIODS = [
  { label: "Last 7 Days", days: 7 },
  { label: "Last 30 Days", days: 30 },
  { label: "Last 90 Days", days: 90 },
  { label: "All Time", days: null },
];

// Matches activity_logs.type values from the schema: "generate", "upload", "download", "classify", "login"
const TYPE_STYLES = {
  generate: "bg-blue-50 text-blue-700",
  upload:   "bg-amber-50 text-amber-700",
  download: "bg-teal-50 text-teal-700",
  classify: "bg-purple-50 text-purple-700",
  login:    "bg-gray-100 text-gray-600",
};

function typeStyle(type) {
  return TYPE_STYLES[String(type).toLowerCase()] || "bg-gray-100 text-gray-600";
}

// Matches activity_logs.status values from the schema: "success", "error", "info"
const STATUS_STYLES = {
  success: "bg-emerald-50 text-emerald-700",
  error:   "bg-red-50 text-red-700",
  info:    "bg-gray-100 text-gray-600",
};

function statusStyle(status) {
  return STATUS_STYLES[String(status).toLowerCase()] || "bg-gray-100 text-gray-600";
}

function withinPeriod(dateStr, days) {
  if (days === null) return true;
  const entryDate = new Date(dateStr);
  const diff = (Date.now() - entryDate) / (1000 * 60 * 60 * 24);
  return diff <= days;
}

export const ReportsContent = () => {
  const [period, setPeriod] = useState(PERIODS[1].label); // Last 30 Days
  const [department, setDepartment] = useState("All Departments");
  const [faculty, setFaculty] = useState("All Faculty");
  const [activeTab, setActiveTab] = useState("logins");
  const [searchTerm, setSearchTerm] = useState("");
  const [exportOpen, setExportOpen] = useState(false);
  const [exportTabs, setExportTabs] = useState(["logins", "generated", "exports", "deleted"]);
  const [exportFormat, setExportFormat] = useState("csv");
  const [pageByTab, setPageByTab] = useState({ logins: 1, generated: 1, exports: 1, deleted: 1 });
  const pageSize = 10;

  const [activityLog, setActivityLog] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;

    setIsLoading(true);
    setError(null);

    fetchActivityLog()
      .then((rows) => {
        if (!cancelled) setActivityLog(rows);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || "Failed to load activity data.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [reloadToken]);

  const facultyOptions = useMemo(() => {
    const names = activityLog
      .filter((row) => {
        const isAdminRow = String(row.role ?? "").toLowerCase() === "admin" ||
          String(row.name ?? "").toLowerCase() === "system";
        return !isAdminRow && (department === "All Departments" || row.dept === department);
      })
      .map((row) => row.name);
    return ["All Faculty", ...Array.from(new Set(names)).sort()];
  }, [activityLog, department]);

  // If the department changes and the selected faculty no longer applies, reset it.
  const effectiveFaculty = facultyOptions.includes(faculty) ? faculty : "All Faculty";

  const filteredLog = useMemo(() => {
    const selectedPeriod = PERIODS.find((p) => p.label === period);
    return activityLog.filter((row) => {
      const isAdminRow = String(row.role ?? "").toLowerCase() === "admin" ||
        String(row.name ?? "").toLowerCase() === "system";
      const matchesPeriod = withinPeriod(row.date, selectedPeriod.days);
      const matchesDept = department === "All Departments" || row.dept === department;
      const matchesFaculty = effectiveFaculty === "All Faculty" || row.name === effectiveFaculty;
      const categories = {
        logins: ["login"],
        generated: ["generate", "question", "question_set", "classify"],
        exports: ["export", "download"],
      };
      const rowType = String(row.type || "").toLowerCase();
      const deleted = String(row.type || "").toLowerCase() === "delete" || /\bdeleted?\b|permanently removed/i.test(`${row.action || ""} ${row.detail || ""}`);
      const matchesTab = activeTab === "deleted" ? deleted : categories[activeTab]?.includes(rowType);
      const text = `${row.name || ""} ${row.action || ""} ${row.detail || ""}`.toLowerCase();
      return !isAdminRow && matchesPeriod && matchesDept && matchesFaculty && matchesTab && text.includes(searchTerm.toLowerCase());
    }).sort((a, b) => new Date(`${b.date} ${b.time}`) - new Date(`${a.date} ${a.time}`));
  }, [activityLog, period, department, effectiveFaculty, activeTab, searchTerm]);

  const currentPage = pageByTab[activeTab] || 1;
  const pageCount = Math.max(1, Math.ceil(filteredLog.length / pageSize));
  const paginatedLog = filteredLog.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  useEffect(() => {
    setPageByTab((current) => ({ ...current, [activeTab]: 1 }));
  }, [activeTab, period, department, effectiveFaculty, searchTerm]);

  useEffect(() => {
    if (currentPage > pageCount) {
      setPageByTab((current) => ({ ...current, [activeTab]: pageCount }));
    }
  }, [activeTab, currentPage, pageCount]);

  const reportTabs = [
    { id: "logins", label: "Users logged", types: ["login"] },
    { id: "generated", label: "Question generation", types: ["generate", "question", "question_set", "classify"] },
    { id: "exports", label: "Exports / downloads", types: ["export", "download"] },
    { id: "deleted", label: "Deleted", deleted: true },
  ];

  const matchesReportTab = (row, tab) => {
    if (tab.deleted) return String(row.type || "").toLowerCase() === "delete" || /\bdeleted?\b|permanently removed/i.test(`${row.action || ""} ${row.detail || ""}`);
    return tab.types.includes(String(row.type || "").toLowerCase());
  };

  const countForTab = (tab) => activityLog.filter((row) => matchesReportTab(row, tab)).length;

  const rowsForExport = () => {
    const selected = reportTabs.filter((tab) => exportTabs.includes(tab.id));
    return selected.map((tab) => ({
      tab,
      rows: activityLog
        .filter((row) => matchesReportTab(row, tab) && !String(row.role || "").toLowerCase().includes("admin"))
        .sort((first, second) => new Date(`${second.date} ${second.time}`) - new Date(`${first.date} ${first.time}`)),
    }));
  };

  const handleExport = () => {
    if (!exportTabs.length) return;
    const groupedRows = rowsForExport();
    const header = ["Faculty Name", "Dept", "Action", "Detail", "Type", "Status", "Date", "Time"];
    const escapeCsv = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
    const escapeHtml = (value) => String(value ?? "").replace(/[&<>]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[char]));
    const csvSections = groupedRows.flatMap(({ tab, rows }) => [
      [tab.label],
      header,
      ...rows.map((row) => [row.name, row.dept, row.action, row.detail, row.type, row.status, row.date, row.time]),
      [],
    ]);
    const csv = csvSections.map((row) => row.map(escapeCsv).join(",")).join("\n");
    const html = groupedRows.map(({ tab, rows }) => `<section><h2>${escapeHtml(tab.label)}</h2><table><thead><tr>${header.map((cell) => `<th>${cell}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${[row.name, row.dept, row.action, row.detail, row.type, row.status, row.date, row.time].map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`).join("")}</tbody></table></section>`).join("");
    if (exportFormat === "pdf") {
      const printWindow = window.open("", "_blank", "width=900,height=700");
      if (!printWindow) return;
      printWindow.document.write(`<html><head><title>Activity report</title><style>body{font:12px Arial;padding:24px}section{break-inside:avoid;margin-bottom:24px}h2{border-bottom:2px solid #333;padding-bottom:6px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ccc;padding:6px;text-align:left}th{background:#eee}</style></head><body><h1>Activity report</h1>${html}</body></html>`);
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
      return;
    }
    const extension = exportFormat === "word" ? "doc" : exportFormat === "excel" ? "xls" : "csv";
    const content = exportFormat === "csv" ? csv : `<!doctype html><html><head><meta charset="utf-8"></head><body>${html}</body></html>`;
    const mimeType = exportFormat === "csv" ? "text/csv" : exportFormat === "word" ? "application/msword" : "application/vnd.ms-excel";
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `activity-report.${extension}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setExportOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="rounded-3xl bg-white border border-gray-200 p-6 shadow-sm flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Reports</h2>
          <p className="mt-2 text-sm text-gray-600">Filter and export faculty activity, question contributions, and assessment trends.</p>
        </div>
        <button
          onClick={() => setExportOpen(true)}
          className="inline-flex items-center gap-2 rounded-full bg-red-700 px-5 py-3 text-sm font-semibold text-white hover:bg-red-800 transition"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5v14" />
            <path d="M5 12h14" />
          </svg>
          Export Report
        </button>
      </div>

      {/* Filters */}
      <div className="rounded-3xl bg-white border border-gray-200 p-6 shadow-sm">
        <div className="grid gap-4 md:grid-cols-3">
          <FilterSelect
            label="Period"
            value={period}
            onChange={setPeriod}
            options={PERIODS.map((p) => p.label)}
          />
          <FilterSelect
            label="Department"
            value={department}
            onChange={(val) => {
              setDepartment(val);
              setFaculty("All Faculty");
            }}
            options={DEPARTMENTS}
          />
          <FilterSelect
            label="Faculty"
            value={effectiveFaculty}
            onChange={setFaculty}
            options={facultyOptions}
          />
        </div>
      </div>

      <div className="flex items-center gap-3"><input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Search activity..." className="bq-field w-full px-4 sm:max-w-sm" /></div>
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white px-3 shadow-sm"><div className="flex min-w-max items-center gap-1" role="tablist" aria-label="Report categories">{reportTabs.map((tab) => <button key={tab.id} type="button" role="tab" aria-selected={activeTab === tab.id} onClick={() => setActiveTab(tab.id)} className={`border-b-2 px-4 py-3 text-sm font-semibold ${activeTab === tab.id ? "border-[#B4454A] text-[#B4454A]" : "border-transparent text-slate-500 hover:border-slate-200 hover:text-slate-700"}`}>{tab.label}<span className={`ml-2 rounded-full px-2 py-0.5 text-[11px] ${activeTab === tab.id ? "bg-red-50 text-[#B4454A]" : "bg-slate-100 text-slate-500"}`}>{countForTab(tab)}</span></button>)}</div></div>

      {/* Activity Log */}
      <div className="bq-panel p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">User Activity Log</h3>
          {!isLoading && !error && (
            <span className="text-xs font-medium text-gray-500">
              {filteredLog.length} {filteredLog.length === 1 ? "entry" : "entries"}
            </span>
          )}
        </div>

        {isLoading ? (
          <div className="rounded-2xl bg-gray-50 py-12 text-center text-sm text-gray-500">
            Loading activity data…
          </div>
        ) : error ? (
          <div className="rounded-2xl bg-red-50 py-10 px-6 text-center text-sm text-red-700">
            <p className="font-semibold mb-1">Couldn't load activity data</p>
            <p className="mb-4 text-red-600">{error}</p>
            <button
              onClick={() => setReloadToken((t) => t + 1)}
              className="rounded-full bg-white border border-red-200 px-4 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 transition"
            >
              Try Again
            </button>
          </div>
        ) : filteredLog.length === 0 ? (
          <div className="rounded-2xl bg-gray-50 py-12 text-center text-sm text-gray-500">
            No activity matches these filters. Try widening the date range or department.
          </div>
        ) : (
          <div className="relative ml-3 space-y-6 border-l-2 border-slate-100 pb-4 md:ml-6">
            {paginatedLog.map((row) => <div key={row.id} className="relative pl-8 md:pl-10"><div className={`absolute -left-[17px] top-1 flex h-8 w-8 items-center justify-center rounded-full border-4 border-white shadow-sm ${row.status === "error" ? "bg-red-50" : "bg-slate-50"}`}><span className={`h-2.5 w-2.5 rounded-full ${row.status === "error" ? "bg-red-500" : "bg-[#B4454A]"}`} /></div><div className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm hover:shadow-md"><div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><h3 className={`font-semibold ${row.status === "error" ? "text-red-600" : "text-slate-800"}`}>{row.action}</h3><span className="whitespace-nowrap rounded-full bg-slate-50 px-2.5 py-1 text-xs text-slate-400">{row.date} {row.time}</span></div><div className="flex flex-wrap items-center gap-2 text-sm text-slate-600"><span className="font-semibold text-slate-800">{row.name}</span><span>{row.dept}</span><span>{row.detail}</span><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${typeStyle(row.type)}`}>{row.type || "system"}</span><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${statusStyle(row.status)}`}>{row.status || "info"}</span></div></div></div>)}
          </div>
        )}
        {!isLoading && !error && filteredLog.length > 0 && <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4"><span className="text-xs text-slate-500">Page {currentPage} of {pageCount}</span><div className="flex items-center gap-2"><button type="button" disabled={currentPage === 1} onClick={() => setPageByTab((current) => ({ ...current, [activeTab]: currentPage - 1 }))} className="bq-secondary-button px-3 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-40">Previous</button><button type="button" disabled={currentPage === pageCount} onClick={() => setPageByTab((current) => ({ ...current, [activeTab]: currentPage + 1 }))} className="bq-secondary-button px-3 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-40">Next</button></div></div>}
      </div>

      {exportOpen && <div className="bq-modal-overlay fixed inset-0 z-50 flex items-center justify-center p-4"><section className="bq-modal-panel w-full max-w-lg p-6"><div className="mb-5 flex items-start justify-between gap-4"><div><h2>Export Report</h2><p className="bq-admin-muted mt-1">Choose one or more activity tabs to include.</p></div><button type="button" onClick={() => setExportOpen(false)} className="bq-secondary-button px-3 py-1 text-xs">Close</button></div><fieldset><legend className="mb-2 text-sm font-semibold">Activity tabs</legend><div className="grid gap-2 sm:grid-cols-2">{reportTabs.map((tab) => <label key={tab.id} className="flex items-center gap-2 rounded-md border border-slate-700 px-3 py-2 text-sm"><input type="checkbox" checked={exportTabs.includes(tab.id)} onChange={(event) => setExportTabs((current) => event.target.checked ? [...new Set([...current, tab.id])] : current.filter((id) => id !== tab.id))} className="h-4 w-4 accent-[#C4485A]" />{tab.label}</label>)}</div></fieldset><label className="mt-5 block text-sm font-semibold">File type<select value={exportFormat} onChange={(event) => setExportFormat(event.target.value)} className="bq-field mt-2 w-full px-3 py-2"><option value="csv">CSV</option><option value="word">Word document</option><option value="excel">Excel spreadsheet</option><option value="pdf">PDF</option></select></label><div className="mt-6 flex justify-end"><button type="button" onClick={handleExport} disabled={!exportTabs.length} className="bq-admin-action disabled:cursor-not-allowed disabled:opacity-50">Export selected tabs</button></div></section></div>}

    </div>
  );
};

// Small reusable filter dropdown, styled to match the existing pill filter look.
const FilterSelect = ({ label, value, onChange, options }) => (
  <div className="rounded-3xl border border-gray-200 bg-gray-50 px-4 py-3 flex items-center justify-between gap-3 text-sm text-gray-600">
    <span>{label}</span>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-gray-700 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-red-200 cursor-pointer"
    >
      {options.map((opt) => (
        <option key={opt} value={opt}>{opt}</option>
      ))}
    </select>
  </div>
);

const ReportsBtn = ({ activeTab, setActiveTab }) => {
  const isActive = activeTab === "reports";

  return (
    <button
      onClick={() => setActiveTab("reports")}
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
        <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
      </svg>
      <span className="text-sm font-medium tracking-wide">Reports</span>
    </button>
  );
};

export default ReportsBtn;