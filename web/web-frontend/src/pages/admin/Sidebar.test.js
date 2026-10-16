import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Sidebar from "./Sidebar";

const renderSidebar = ({ departmentAdmin = false, campusAdmin = false, campusExperience = campusAdmin, superAdmin = false } = {}) => {
  const setActiveTab = jest.fn();
  render(
    <MemoryRouter>
      <Sidebar
        activeTab="dashboard"
        setActiveTab={setActiveTab}
        adminTheme="light"
        onThemeToggle={jest.fn()}
        collapsed={false}
        mobileOpen={false}
        onNavigate={jest.fn()}
        departmentAdmin={departmentAdmin}
        campusAdmin={campusAdmin}
        campusExperience={campusExperience}
        superAdmin={superAdmin}
      />
    </MemoryRouter>,
  );
  return setActiveTab;
};

test("keeps the Campus Admin navigation entries distinct from global admin features", () => {
  renderSidebar({ campusAdmin: true });

  expect(screen.getByRole("button", { name: "Dashboard" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Academic Management" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Question Bank" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "User Management" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Reports" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "AI Usage" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Recycle Bin" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Global Users" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Activity Logs" })).not.toBeInTheDocument();
});

test("keeps Department Admin navigation limited to its existing workspace features", () => {
  renderSidebar({ departmentAdmin: true });

  expect(screen.getByRole("button", { name: "Dashboard" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Leadership Management" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Faculty Management" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Academic Management" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Question Bank" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "User Management" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Reports" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "AI Usage" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Recycle Bin" })).not.toBeInTheDocument();
});

test("keeps Campus Admin navigation actions mapped to existing tab IDs", () => {
  const setActiveTab = renderSidebar({ campusAdmin: true });

  fireEvent.click(screen.getByRole("button", { name: "User Management" }));
  expect(setActiveTab).toHaveBeenCalledWith("users");

  fireEvent.click(screen.getByRole("button", { name: "Reports" }));
  expect(setActiveTab).toHaveBeenCalledWith("reports");
});

test("keeps legacy admin on the Campus Admin navigation", () => {
  renderSidebar({ campusExperience: true });

  expect(screen.getByRole("button", { name: "User Management" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Reports" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Global Users" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Activity Logs" })).not.toBeInTheDocument();
});

test("shows the Super Admin navigation with distinct global users and activity logs entries", () => {
  renderSidebar({ superAdmin: true });

  [
    "Dashboard",
    "Campus Management",
    "Admin Management",
    "Global Users",
    "Academic Management",
    "Question Bank",
    "AI Usage",
    "Activity Logs",
    "Settings",
  ].forEach((label) => {
    expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
  });
  expect(screen.queryByRole("switch", { name: "Switch to dark mode" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "User Management" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Reports" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Recycle Bin" })).not.toBeInTheDocument();
});

test("maps Super Admin navigation to shared shell tab IDs", () => {
  const setActiveTab = renderSidebar({ superAdmin: true });

  [
    ["Campus Management", "campuses"],
    ["Admin Management", "admins"],
    ["Global Users", "global-users"],
    ["Academic Management", "academic"],
    ["Question Bank", "question-bank"],
    ["AI Usage", "ai-usage"],
    ["Activity Logs", "activity-logs"],
    ["Settings", "settings"],
  ].forEach(([label, tab]) => {
    fireEvent.click(screen.getByRole("button", { name: label }));
    expect(setActiveTab).toHaveBeenLastCalledWith(tab);
  });
});

test.each([
  ["campus admin", { campusAdmin: true }],
  ["department admin", { departmentAdmin: true }],
])("does not show Super Admin-only entries for %s", (_role, options) => {
  renderSidebar(options);

  expect(screen.queryByRole("button", { name: "Campus Management" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Admin Management" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Global Users" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Activity Logs" })).not.toBeInTheDocument();
});

test("hides the sidebar Appearance switch for campus admins only", () => {
  renderSidebar({ campusAdmin: true });
  expect(screen.queryByRole("switch", { name: "Switch to dark mode" })).not.toBeInTheDocument();
});
