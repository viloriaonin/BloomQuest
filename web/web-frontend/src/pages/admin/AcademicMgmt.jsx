import React from "react";

export const AcademicMgmtContent = () => (
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

const AcademicMgmtBtn = ({ activeTab, setActiveTab }) => {
  const isActive = activeTab === "academic";

  return (
    <button
      onClick={() => setActiveTab("academic")}
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
        <path d="M10.394 2.08a1 1 0 00-.788 0l-7 3a1 1 0 000 1.84L5.25 8.051a.999.999 0 01.356-.257l4-1.714a1 1 0 11.788 1.838L7.667 9.088l1.94.831a1 1 0 00.787 0l7-3a1 1 0 000-1.838l-7-3zM3.31 9.397L5 10.12v4.102a8.969 8.969 0 00-1.05-.174 1 1 0 01-.89-.89 11.115 11.115 0 01.25-3.762zM9.3 16.573A9.026 9.026 0 007 14.935v-3.957l1.818.78a3 3 0 002.364 0l5.508-2.361a11.026 11.026 0 01.25 3.762 1 1 0 01-.89.89 8.968 8.968 0 00-5.35 2.524 1 1 0 01-1.4 0zM6 18a1 1 0 001-1v-2.065a8.935 8.935 0 00-2-.712V17a1 1 0 001 1z" />
      </svg>
      <span className="text-sm font-medium tracking-wide">Academic Management</span>
    </button>
  );
};

export default AcademicMgmtBtn;