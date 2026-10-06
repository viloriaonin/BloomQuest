import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { PopupProvider } from "../../components/PopupProvider";
import { DepartmentAdminDashboard } from "./admindashboard";

const scopedHierarchy = {
  campuses: [{
    id: 1,
    name: "Main Campus",
    departments: [{
      id: 2,
      name: "CICS",
      faculty: [{ id: 8, name: "Department Faculty", email: "faculty@example.com", program_id: 3 }],
      programs: [{
        id: 3,
        name: "Computer Science",
        code: "BSCS",
        chair_name: "Faculty Chair",
        faculty: [{ id: 8, name: "Department Faculty", email: "faculty@example.com" }],
      }],
    }],
  }],
};

beforeEach(() => {
  localStorage.setItem("role", "department_admin");
  localStorage.setItem("department_id", "2");
  localStorage.setItem("campus_id", "1");
  localStorage.setItem("email", "department-admin@example.com");
  global.fetch = jest.fn(async (url) => {
    if (String(url).endsWith("/academic-hierarchy")) {
      return { ok: true, json: async () => scopedHierarchy };
    }
    if (String(url).endsWith("/subjects")) {
      return { ok: true, json: async () => [{ id: 9, department_id: 2, program_id: 3 }] };
    }
    if (String(url).endsWith("/department-academic-change-requests")) {
      return { ok: true, json: async () => [] };
    }
    return { ok: true, json: async () => ({}) };
  });
});

afterEach(() => {
  delete global.fetch;
  ["role", "department_id", "campus_id", "email"].forEach((key) => localStorage.removeItem(key));
});

const renderDashboard = () => render(
  <PopupProvider>
    <MemoryRouter initialEntries={["/admin/academic"]}>
      <Routes>
        <Route path="/admin/academic" element={<DepartmentAdminDashboard />} />
        <Route path="/admin/academic/campus/:campusId/department/:departmentId" element={<DepartmentAdminDashboard />} />
        <Route path="/admin/academic/campus/:campusId/department/:departmentId/program/:programId" element={<DepartmentAdminDashboard />} />
      </Routes>
    </MemoryRouter>
  </PopupProvider>,
);

test("Department Admin uses the admin dashboard shell with only department tools", async () => {
  renderDashboard();

  expect(await screen.findByText("Your department at a glance")).toBeInTheDocument();
  expect(screen.getByText("DEPARTMENT WORKSPACE")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Dashboard" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Academic Management" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Faculty Management" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Academic Requests" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Settings" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "User Management" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Question Bank" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Reports" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Recycle Bin" })).not.toBeInTheDocument();
});

test("Department Admin can open academic and faculty workspace sections from navigation", async () => {
  renderDashboard();
  fireEvent.click(await screen.findByRole("button", { name: "Academic Management" }));

  expect(await screen.findByRole("button", { name: "Add Program" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Faculty Management" }));
  await waitFor(() => expect(screen.getByRole("heading", { name: "Department faculty" })).toBeInTheDocument());
  expect(screen.getByRole("combobox", { name: "Program for Department Faculty" })).toBeInTheDocument();
});

test("Academic Requests navigation scrolls to the academic-change request form", async () => {
  let scrolledElement;
  const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;
  HTMLElement.prototype.scrollIntoView = jest.fn(function scrollIntoView() {
    scrolledElement = this;
  });

  try {
    renderDashboard();
    fireEvent.click(await screen.findByRole("button", { name: "Academic Requests" }));

    await waitFor(() => {
      expect(scrolledElement).toHaveAttribute("id", "department-requests-section");
    });
    expect(screen.getByRole("heading", { name: "Academic change requests" })).toBeInTheDocument();
  } finally {
    if (originalScrollIntoView) {
      HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
    } else {
      delete HTMLElement.prototype.scrollIntoView;
    }
  }
});

test("Department Admin settings persist profile name through the profile API", async () => {
  renderDashboard();
  fireEvent.click(await screen.findByRole("button", { name: "Settings" }));
  fireEvent.change(await screen.findByLabelText("Full name"), { target: { value: "Updated Department Admin" } });
  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
  fireEvent.click(await screen.findByRole("button", { name: "Confirm" }));

  await waitFor(() => {
    const request = global.fetch.mock.calls.find(([url, options]) =>
      String(url).endsWith("/user/profile") && options?.method === "PUT",
    );
    expect(request).toBeDefined();
    expect(JSON.parse(request[1].body)).toEqual({ full_name: "Updated Department Admin" });
  });
  expect(await screen.findByText("Changes saved successfully.")).toBeInTheDocument();
});
