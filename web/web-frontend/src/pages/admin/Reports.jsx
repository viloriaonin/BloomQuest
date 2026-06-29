import React from "react";

export const ReportsContent = () => (
  <div className="space-y-6">
    <div className="rounded-3xl bg-white border border-gray-200 p-6 shadow-sm flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Reports</h2>
        <p className="mt-2 text-sm text-gray-600">Filter and export faculty activity, question contributions, and assessment trends.</p>
      </div>
      <button className="inline-flex items-center gap-2 rounded-full bg-red-700 px-5 py-3 text-sm font-semibold text-white hover:bg-red-800 transition">
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 5v14" />
          <path d="M5 12h14" />
        </svg>
        Export Report
      </button>
    </div>

    <div className="rounded-3xl bg-white border border-gray-200 p-6 shadow-sm">
      <div className="grid gap-4 md:grid-cols-3">
        {[
          { label: "Last 30 Days", value: "Period" },
          { label: "All Departments", value: "Department" },
          { label: "All Faculty", value: "Faculty" },
        ].map((filter) => (
          <div key={filter.label} className="rounded-3xl border border-gray-200 bg-gray-50 px-4 py-3 flex items-center justify-between gap-3 text-sm text-gray-600">
            <span>{filter.label}</span>
            <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-gray-700">{filter.value}</span>
          </div>
        ))}
      </div>
    </div>

    <div className="rounded-3xl bg-white border border-gray-200 p-6 shadow-sm">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Faculty Activity</h3>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm text-gray-700">
          <thead className="border-b border-gray-200 text-gray-500">
            <tr>
              {['Faculty Name', 'Dept', 'Questions', 'Assessments', 'Last Active'].map((heading) => (
                <th key={heading} className="py-4 pr-6 font-medium">{heading}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {[
              { name: 'Dr. Santos', dept: 'CICS', questions: 95, assessments: 12, lastActive: '2026-04-15' },
              { name: 'Prof. Reyes', dept: 'CICS', questions: 78, assessments: 9, lastActive: '2026-04-14' },
              { name: 'Dr. Cruz', dept: 'COE', questions: 65, assessments: 8, lastActive: '2026-04-13' },
              { name: 'Prof. Garcia', dept: 'CAS', questions: 58, assessments: 7, lastActive: '2026-04-12' },
              { name: 'Dr. Martinez', dept: 'CICS', questions: 52, assessments: 6, lastActive: '2026-04-11' },
              { name: 'Prof. Dela Cruz', dept: 'CBA', questions: 45, assessments: 5, lastActive: '2026-04-10' },
            ].map((row) => (
              <tr key={row.name} className="hover:bg-gray-50 transition-colors">
                <td className="py-4 pr-6 font-semibold text-gray-900">{row.name}</td>
                <td className="py-4 pr-6">{row.dept}</td>
                <td className="py-4 pr-6">{row.questions}</td>
                <td className="py-4 pr-6">{row.assessments}</td>
                <td className="py-4 pr-6">{row.lastActive}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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
            { label: 'CICS', value: '38%' },
            { label: 'COE', value: '24%' },
            { label: 'CAS', value: '18%' },
            { label: 'CBA', value: '20%' },
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