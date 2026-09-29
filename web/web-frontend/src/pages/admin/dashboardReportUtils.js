const normalizeDepartment = (value) => String(value || "").trim().toLowerCase();

export const getDepartmentScopedDashboardData = (data, selectedDepartment) => {
  const isAllDepartments = selectedDepartment === "All Departments";
  const selectedKey = normalizeDepartment(selectedDepartment);
  const departments = isAllDepartments
    ? data.departments
    : data.departments.filter((item) => normalizeDepartment(item.department) === selectedKey);
  const activity = data.activity.filter((item) => {
    const role = String(item.role || "").toLowerCase();
    if (role === "admin" || String(item.name || "").toLowerCase() === "system") return false;
    return isAllDepartments || normalizeDepartment(item.dept || item.department) === selectedKey;
  });
  const faculty = isAllDepartments
    ? data.faculty
    : data.faculty.filter((item) => normalizeDepartment(item.department) === selectedKey);
  const users = isAllDepartments
    ? data.users
    : data.users.filter((item) => normalizeDepartment(item.department || item.dept) === selectedKey);

  return {
    departments,
    faculty,
    activity,
    questions: isAllDepartments
      ? data.questions
      : departments.reduce((total, item) => total + Number(item.active_questions ?? item.questions_contributed ?? 0), 0),
    assessments: activity.filter((item) => /export|download/i.test(`${item.type} ${item.action}`)).length,
    activeAccounts: isAllDepartments ? data.activeAccounts : users.length,
  };
};