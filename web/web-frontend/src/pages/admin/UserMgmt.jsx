import React from "react";

export const UserMgmtContent = () => (
  <div className="space-y-6">
    <div className="grid gap-5 md:grid-cols-4">
      {[
        { label: "Total Users", value: "8", icon: "users", tone: "text-red-700" },
        { label: "Active", value: "5", icon: "check-circle", tone: "text-green-700" },
        { label: "Pending", value: "2", icon: "clock", tone: "text-amber-700" },
        { label: "Inactive", value: "1", icon: "x-circle", tone: "text-slate-700" },
      ].map((card) => (
        <div key={card.label} className="rounded-3xl bg-white border border-gray-200 p-6 shadow-sm">
          <div className="flex justify-between items-start gap-4">
            <div>
              <p className="text-sm font-medium text-gray-500">{card.label}</p>
              <p className="mt-4 text-3xl font-bold text-gray-900">{card.value}</p>
            </div>
            <div className={`rounded-2xl bg-gray-50 p-3 ${card.tone}`}>
              {card.icon === "users" && (
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 00-3-3.87" />
                  <path d="M16 3.13a4 4 0 010 7.75" />
                </svg>
              )}
              {card.icon === "check-circle" && (
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 12l2 2 4-4" />
                  <circle cx="12" cy="12" r="10" />
                </svg>
              )}
              {card.icon === "clock" && (
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 6v6l4 2" />
                </svg>
              )}
              {card.icon === "x-circle" && (
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M15 9l-6 6" />
                  <path d="M9 9l6 6" />
                </svg>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>

    <div className="rounded-3xl bg-white border border-gray-200 p-6 shadow-sm">
      <div className="grid gap-4 lg:grid-cols-[1.8fr_0.8fr_0.8fr] items-center">
        <div className="rounded-3xl border border-gray-200 bg-gray-50 px-4 py-3">
          <input
            type="text"
            placeholder="Search by name, email, or employee ID..."
            className="w-full bg-transparent text-sm text-gray-700 placeholder:text-gray-400 outline-none"
          />
        </div>
        <div className="rounded-3xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-600">
          All Departments
        </div>
        <div className="rounded-3xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-600">
          All Status
        </div>
      </div>
    </div>

    <div className="rounded-3xl bg-white border border-gray-200 p-6 shadow-sm overflow-x-auto">
      <div className="text-sm font-medium text-gray-500 mb-4">Showing 8 of 8 users</div>
      <table className="min-w-full text-left text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-gray-600">
            {['Name', 'Employee ID', 'Department', 'College', 'Status', 'Joined', 'Actions'].map((heading) => (
              <th key={heading} className="py-4 pr-6 font-semibold">{heading}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {[
            { initials: 'DM', name: 'Dr. Maria Santos', email: 'm.santos@batstateu.edu.ph', id: 'EMP-2021-001', department: 'Computer Science', college: 'CICS', status: 'Active', joined: 'Jun 1, 2021' },
            { initials: 'PJ', name: 'Prof. Jose Reyes', email: 'j.reyes@batstateu.edu.ph', id: 'EMP-2020-045', department: 'Information Technology', college: 'CICS', status: 'Active', joined: 'Aug 15, 2020' },
            { initials: 'DA', name: 'Dr. Ana Cruz', email: 'a.cruz@batstateu.edu.ph', id: 'EMP-2019-012', department: 'Civil Engineering', college: 'COE', status: 'Active', joined: 'Jan 10, 2019' },
            { initials: 'PC', name: 'Prof. Carlos Garcia', email: 'c.garcia@batstateu.edu.ph', id: 'EMP-2022-008', department: 'Computer Science', college: 'CICS', status: 'Active', joined: 'Mar 22, 2022' },
          ].map((user) => (
            <tr key={user.id} className="hover:bg-gray-50 transition-colors">
              <td className="py-5 pr-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-red-700 text-sm font-bold text-white">{user.initials}</div>
                  <div>
                    <p className="font-semibold text-gray-900">{user.name}</p>
                    <p className="text-xs text-gray-500">{user.email}</p>
                  </div>
                </div>
              </td>
              <td className="py-5 pr-6 text-gray-600">{user.id}</td>
              <td className="py-5 pr-6 text-gray-600">{user.department}</td>
              <td className="py-5 pr-6 text-gray-600">{user.college}</td>
              <td className="py-5 pr-6">
                <span className="inline-flex rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">{user.status}</span>
              </td>
              <td className="py-5 pr-6 text-gray-600">{user.joined}</td>
              <td className="py-5 pr-6">
                <button className="rounded-full border border-gray-200 bg-white px-3 py-1 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition">Deactivate</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

const UserMgmtBtn = ({ activeTab, setActiveTab }) => {
  const isActive = activeTab === "users";

  return (
    <button
      onClick={() => setActiveTab("users")}
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
        <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
      </svg>
      <span className="text-sm font-medium tracking-wide">User Management</span>
    </button>
  );
};

export default UserMgmtBtn;