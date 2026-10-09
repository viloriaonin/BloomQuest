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
      code: "CICS",
      dean_name: "Dr. Department Dean",
      faculty: [{ id: 8, name: "Department Faculty", email: "faculty@example.com", program_id: 3 }],
      programs: [{
        id: 3,
        name: "Computer Science",
        code: "BSCS",
        chair_id: 8,
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
      return { ok: true, json: async () => [{ id: 9, name: "Introduction to Computing", department_id: 2, program_id: 3, creator_id: 8 }] };
    }
    if (String(url).endsWith("/department-academic-change-requests")) {
      return { ok: true, json: async () => [] };
    }
    if (String(url).endsWith("/department-admin/faculty-accounts")) {
      return {
        ok: true,
        json: async () => ({
          pending: [],
          active: [{
            id: 8,
            full_name: "Department Faculty",
            email: "faculty@example.com",
            department: "CICS",
            program_id: 3,
            program: "Computer Science",
            status: "Active",
            archived: false,
            created_at: "2024-01-10T00:00:00",
          }],
          archived: [],
        }),
      };
    }
    if (String(url).endsWith("/department-admin/users")) {
      return {
        ok: true,
        json: async () => ({
          department: { id: 2, name: "CICS" },
          programs: [{ id: 3, name: "Computer Science" }],
          users: [],
        }),
      };
    }
    if (String(url).endsWith("/department-admin/users/8")) {
      return {
        ok: true,
        json: async () => ({
          id: 8,
          full_name: "Department Faculty",
          email: "faculty@example.com",
          role: "Faculty",
          department: "CICS",
          program_id: 3,
          program: "Computer Science",
          archived: false,
          status: "Active",
          created_at: "2024-01-10T00:00:00",
          question_count: 4,
          activity_count: 1,
          subjects: [{ id: 9, name: "Introduction to Computing", code: "CS101" }],
          activity: [{ id: 1, action: "Signed in", type: "login", status: "success", details: "", created_at: "2024-01-11T00:00:00" }],
        }),
      };
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

  expect(await screen.findByRole("heading", { name: "CICS" })).toBeInTheDocument();
  expect(screen.getByText("Department code: CICS")).toBeInTheDocument();
  expect(screen.getByText("Dr. Department Dean")).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Programs you manage" })).toBeInTheDocument();
  expect(screen.getByText("Computer Science")).toBeInTheDocument();
  expect(screen.getByText("BSCS")).toBeInTheDocument();
  expect(screen.getByText("DEPARTMENT WORKSPACE")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Dashboard" })).toBeInTheDocument();
  const facultyTab = screen.getByRole("button", { name: "Faculty Management" });
  const leadershipTab = screen.getByRole("button", { name: "Leadership Management" });
  const academicTab = screen.getByRole("button", { name: "Academic Management" });
  expect(facultyTab).toBeInTheDocument();
  expect(leadershipTab).toBeInTheDocument();
  expect(academicTab).toBeInTheDocument();
  const dashboardTab = screen.getByRole("button", { name: "Dashboard" });
  expect(dashboardTab.compareDocumentPosition(leadershipTab) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(leadershipTab.compareDocumentPosition(facultyTab) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Academic Requests" })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Settings" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "User Management" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Question Bank" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Reports" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Recycle Bin" })).not.toBeInTheDocument();
});

test("Department Admin can open a faculty profile from Faculty Management actions", async () => {
  renderDashboard();

  fireEvent.click(await screen.findByRole("button", { name: "Faculty Management" }));
  expect(await screen.findByRole("heading", { name: "Faculty accounts" })).toBeInTheDocument();
  expect(await screen.findByText("faculty@example.com")).toBeInTheDocument();
  expect(screen.getByRole("tab", { name: /Active/ })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /View profile/ }));

  expect(await screen.findByRole("heading", { name: "Department Faculty" })).toBeInTheDocument();
  expect(screen.getByText("Questions created")).toBeInTheDocument();
  expect(screen.getByText("Introduction to Computing")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Change program" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Archive account" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Reset password" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Re-email faculty" })).not.toBeInTheDocument();
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Change program" }));
  expect(await screen.findByLabelText("Program")).toHaveValue("3");
  expect(screen.getByRole("option", { name: "Computer Science" })).toBeInTheDocument();
  expect(screen.getByText("Only programs in CICS are available.")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  fireEvent.click(screen.getByRole("button", { name: /Back to Faculty Management/ }));
  expect(await screen.findByRole("heading", { name: "Faculty accounts" })).toBeInTheDocument();
});

test("Department Admin can send password reset and faculty access emails from the profile page", async () => {
  renderDashboard();

  fireEvent.click(await screen.findByRole("button", { name: "Faculty Management" }));
  fireEvent.click(await screen.findByRole("button", { name: /View profile/ }));
  await screen.findByRole("heading", { name: "Department Faculty" });

  fireEvent.click(screen.getByRole("button", { name: "Reset password" }));
  expect(await screen.findByRole("dialog", { name: "Reset faculty password" })).toBeInTheDocument();
  expect(global.fetch).not.toHaveBeenCalledWith(
    expect.stringContaining("/department-admin/users/8/credential-email"),
    expect.anything(),
  );
  fireEvent.click(screen.getByRole("button", { name: "Send reset email" }));
  expect(await screen.findByRole("status")).toHaveTextContent("Email sent to faculty@example.com");
  expect(global.fetch).toHaveBeenCalledWith(
    expect.stringContaining("/department-admin/users/8/credential-email"),
    expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ action: "reset_password" }),
    }),
  );

});

test("Department Admin can open academic and faculty workspace sections from navigation", async () => {
  renderDashboard();
  fireEvent.click(await screen.findByRole("button", { name: "Academic Management" }));

  expect(await screen.findByRole("button", { name: "Add Program" })).toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "Department Dean" })).not.toBeInTheDocument();
  expect(screen.queryByText("Main Campus")).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Back" })).not.toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "Department faculty" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Faculty Management" }));
  expect(await screen.findByRole("heading", { name: "Faculty accounts" })).toBeInTheDocument();
  const activeTab = screen.getByRole("tab", { name: /Active/ });
  const archivedTab = screen.getByRole("tab", { name: /Archived/ });
  expect(activeTab).toBeInTheDocument();
  expect(archivedTab).toBeInTheDocument();
  expect(screen.queryByRole("tab", { name: /Pending/ })).not.toBeInTheDocument();
  expect(screen.queryByRole("tab", { name: /User requests/ })).not.toBeInTheDocument();
  expect(activeTab.compareDocumentPosition(archivedTab) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  const facultyMetric = screen.getByText("Department faculty");
  const accountsSection = screen.getByRole("heading", { name: "Faculty accounts" });
  expect(facultyMetric.compareDocumentPosition(accountsSection) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(screen.queryByRole("heading", { name: "Department faculty" })).not.toBeInTheDocument();
  expect(screen.queryByRole("combobox", { name: "Program chair for Computer Science" })).not.toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "Subject faculty assignments" })).not.toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "Create program chair login" })).not.toBeInTheDocument();
  expect(screen.queryByText("Department Dean")).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Add Program" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Add Subject" })).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Leadership Management" }));
  expect(await screen.findByRole("heading", { name: "Leadership Management", level: 1 })).toBeInTheDocument();
  expect(screen.getByLabelText("Assign dean from department faculty")).toBeInTheDocument();
  expect(screen.getByRole("combobox", { name: "Program chair for Computer Science" })).toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "Create dean login" })).not.toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "Faculty accounts" })).not.toBeInTheDocument();
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
