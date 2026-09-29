import { getDepartmentScopedDashboardData } from "./dashboardReportUtils";

const dashboardData = {
  questions: 12,
  activeAccounts: 3,
  users: [
    { id: 1, department: "CICS" },
    { id: 2, department: "COE" },
  ],
  departments: [
    { department: "CICS", active_questions: 8, questions_contributed: 9 },
    { department: "COE", active_questions: 4, questions_contributed: 5 },
  ],
  faculty: [
    { department: "CICS", questions_contributed: 8 },
    { department: "COE", questions_contributed: 4 },
  ],
  activity: [
    { role: "faculty", name: "CICS Faculty", dept: "CICS", type: "download", action: "Exported report" },
    { role: "faculty", name: "COE Faculty", dept: "COE", type: "generate", action: "Generated questions" },
    { role: "admin", name: "Admin", dept: "CICS", type: "download", action: "Admin export" },
  ],
};

test("department selection scopes accounts, questions, faculty, activity, and assessments", () => {
  const scoped = getDepartmentScopedDashboardData(dashboardData, "CICS");

  expect(scoped.questions).toBe(8);
  expect(scoped.activeAccounts).toBe(1);
  expect(scoped.departments.map((item) => item.department)).toEqual(["CICS"]);
  expect(scoped.faculty).toHaveLength(1);
  expect(scoped.activity.map((item) => item.name)).toEqual(["CICS Faculty"]);
  expect(scoped.assessments).toBe(1);
});

test("all departments retains totals but excludes admin activity", () => {
  const scoped = getDepartmentScopedDashboardData(dashboardData, "All Departments");

  expect(scoped.questions).toBe(12);
  expect(scoped.activeAccounts).toBe(3);
  expect(scoped.departments).toHaveLength(2);
  expect(scoped.activity.map((item) => item.name)).toEqual(["CICS Faculty", "COE Faculty"]);
});