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
      return !isAdminRow && matchesPeriod && matchesDept && matchesFaculty;
    }).sort((a, b) => new Date(`${b.date} ${b.time}`) - new Date(`${a.date} ${a.time}`));
  }, [activityLog, period, department, effectiveFaculty]);

  const handleExport = () => {
    const header = ["Faculty Name", "Dept", "Action", "Detail", "Type", "Status", "Date", "Time"];
    const rows = filteredLog.map((r) => [r.name, r.dept, r.action, r.detail, r.type, r.status, r.date, r.time]);
    const csv = [header, ...rows].map((r) => r.map((v) => `"${v}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "activity-report.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="rounded-3xl bg-white border border-gray-200 p-6 shadow-sm flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Reports</h2>
          <p className="mt-2 text-sm text-gray-600">Filter and export faculty activity, question contributions, and assessment trends.</p>
        </div>
        <button
          onClick={handleExport}
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

      {/* Activity Log */}
      <div className="rounded-3xl bg-white border border-gray-200 p-6 shadow-sm">
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
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm text-gray-700">
              <thead className="border-b border-gray-200 text-gray-500">
                <tr>
                  {["Faculty Name", "Dept", "Action", "Detail", "Type", "Status", "Date", "Time"].map((heading) => (
                    <th key={heading} className="py-4 pr-6 font-medium">{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredLog.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                    <td className="py-4 pr-6 font-semibold text-gray-900">{row.name}</td>
                    <td className="py-4 pr-6">{row.dept}</td>
                    <td className="py-4 pr-6 text-gray-900">{row.action}</td>
                    <td className="py-4 pr-6 text-gray-600">{row.detail}</td>
                    <td className="py-4 pr-6">
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${typeStyle(row.type)}`}>
                        {row.type}
                      </span>
                    </td>
                    <td className="py-4 pr-6">
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusStyle(row.status)}`}>
                        {row.status}
                      </span>
                    </td>
                    <td className="py-4 pr-6">{row.date}</td>
                    <td className="py-4 pr-6">{row.time}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-3xl bg-white border border-gray-200 p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Question Submission Trend</h3>
          <div className="h-48 rounded-3xl bg-red-50 p-4 text-sm text-red-700">[Chart placeholder]</div>
        </div>
        <div className="rounded-3xl bg-white border border-gray-200 p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Assessment Generation by Department</h3>
          <div className="space-y-4">
            {[
              { label: "CICS", value: "38%" },
              { label: "COE", value: "24%" },
              { label: "CAS", value: "18%" },
              { label: "CBA", value: "20%" },
            ].map((item) => (
              <div key={item.label}>
                <div className="flex items-center justify-between text-sm text-gray-700 mb-2">
                  <span>{item.label}</span>
                  <span className="font-semibold">{item.value}</span>
                </div>
                <div className="h-2 rounded-full bg-gray-100">
                  <div className="h-2 rounded-full bg-red-600" style={{ width: item.value }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
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
              background: "rgba(255,255,255,0.15)",
              color: "#ffffff",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.1)",
            }
          : { color: "rgba(255,255,255,0.65)", background: "transparent" }
      }
    >
      {isActive && (
        <span
          className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full"
          style={{ background: "#fff" }}
        />
      )}
      <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"
        style={{ color: isActive ? "#ffffff" : "rgba(255,255,255,0.5)" }}>
        <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
      </svg>
      <span className="text-sm font-medium tracking-wide">Reports</span>
    </button>
  );
};

export default ReportsBtn;