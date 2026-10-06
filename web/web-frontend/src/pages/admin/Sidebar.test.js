import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Sidebar from "./Sidebar";

const renderSidebar = (departmentAdmin = false) => {
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
      />
    </MemoryRouter>,
  );
  return setActiveTab;
};

test.each([["campus admin", false], ["department admin", true]])(
  "shows the Dashboard button for %s",
  (_adminType, departmentAdmin) => {
    const setActiveTab = renderSidebar(departmentAdmin);

    fireEvent.click(screen.getByRole("button", { name: "Dashboard" }));

    expect(setActiveTab).toHaveBeenCalledWith("dashboard");
  },
);
