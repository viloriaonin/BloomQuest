import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AcademicMgmtContent } from "./AcademicMgmt";

const hierarchy = {
  campuses: [{
    id: 1,
    name: "Main Campus",
    departments: [{
      id: 2,
      name: "CICS",
      code: "CICS",
      dean_name: "Dr. Dean",
      dean: null,
      programs: [{
        id: 3,
        name: "Computer Science",
        code: "BSCS",
        department_id: 2,
        chair_name: "Dr. Chair",
        chair: null,
        faculty: [{ id: 44, name: "Ada Faculty", email: "ada@example.com" }],
      }],
      faculty: [{ id: 44, name: "Ada Faculty", email: "ada@example.com", program_id: 3 }],
    }],
  }],
};

const createFetchMock = () => jest.fn(async (url, options = {}) => {
  if (String(url).endsWith("/academic-hierarchy")) {
    return { ok: true, json: async () => hierarchy };
  }
  if (String(url).endsWith("/departments") && !options.method) {
    return { ok: true, json: async () => [] };
  }
  if (String(url).endsWith("/subjects") && !options.method) {
    return {
      ok: true,
      json: async () => [{
        id: 9,
        name: "Introduction to Computing",
        code: "IT 101",
        program_id: 3,
        department_id: 2,
        creator_id: null,
      }, {
        id: 10,
        name: "Academic Foundations",
        code: "AF 100",
        program_id: null,
        department_id: 2,
        creator_id: null,
      }],
    };
  }
  if (String(url).endsWith("/department-academic-change-requests")) {
    return { ok: true, json: async () => [] };
  }
  return { ok: true, json: async () => ({ id: 8 }) };
});

beforeEach(() => {
  global.fetch = createFetchMock();
});

afterEach(() => {
  delete global.fetch;
  localStorage.removeItem("role");
  localStorage.removeItem("department_id");
});

const renderAt = (path) => render(
  <MemoryRouter initialEntries={[path]}>
    <Routes>
      <Route path="/admin/academic/campus/:campusId" element={<AcademicMgmtContent />} />
      <Route path="/admin/academic/campus/:campusId/department/:departmentId" element={<AcademicMgmtContent />} />
      <Route path="/admin/academic/campus/:campusId/department/:departmentId/program/:programId" element={<AcademicMgmtContent />} />
      <Route path="/admin/academic" element={<AcademicMgmtContent />} />
    </Routes>
  </MemoryRouter>,
);

test("Academic Management opens directly to departments without a campus overview", async () => {
  renderAt("/admin/academic");

  expect(await screen.findByRole("heading", { name: "CICS" })).toBeInTheDocument();
  expect(screen.getByText("Departments")).toBeInTheDocument();
  expect(screen.queryByText("Campus overview")).not.toBeInTheDocument();
  expect(screen.getByText("Campus · Main Campus")).toBeInTheDocument();
});

test("Department Admin is taken to the assigned department with management actions", async () => {
  localStorage.setItem("role", "department_admin");
  localStorage.setItem("department_id", "2");
  renderAt("/admin/academic");

  expect(await screen.findByRole("heading", { name: "CICS" })).toBeInTheDocument();
  expect(await screen.findByRole("button", { name: "Add Program" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Add Department" })).not.toBeInTheDocument();
  expect(screen.getByText("Department Dean")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Edit Department Details" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Request a faculty account" })).toBeInTheDocument();
});

test("Department Admin can submit a faculty account request for a department program", async () => {
  localStorage.setItem("role", "department_admin");
  localStorage.setItem("department_id", "2");
  renderAt("/admin/academic/campus/1/department/2");

  fireEvent.change(await screen.findByLabelText("Full name"), { target: { value: "New Faculty" } });
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "new-faculty@example.com" } });
  fireEvent.change(screen.getByLabelText("Program"), { target: { value: "3" } });
  fireEvent.click(screen.getByRole("button", { name: "Submit faculty request" }));

  await waitFor(() => {
    const request = global.fetch.mock.calls.find(([url, options]) => String(url).endsWith("/department-admin/faculty-requests") && options?.method === "POST");
    expect(JSON.parse(request[1].body)).toEqual({
      full_name: "New Faculty",
      email: "new-faculty@example.com",
      program_id: 3,
    });
  });
});

test("Department Admin can assign program and subject faculty", async () => {
  localStorage.setItem("role", "department_admin");
  localStorage.setItem("department_id", "2");
  renderAt("/admin/academic/campus/1/department/2/program/3");

  fireEvent.change(await screen.findByLabelText("Assign program chair"), { target: { value: "44" } });
  fireEvent.change(screen.getByLabelText("Faculty for Introduction to Computing"), { target: { value: "44" } });

  await waitFor(() => {
    expect(global.fetch.mock.calls.some(([url, options]) => String(url).endsWith("/programs/3/chair") && JSON.parse(options.body).faculty_id === 44)).toBe(true);
    expect(global.fetch.mock.calls.some(([url, options]) => String(url).endsWith("/subjects/9/faculty") && JSON.parse(options.body).faculty_id === 44)).toBe(true);
  });
});

test("Department Admin can associate a department-level subject with a program", async () => {
  localStorage.setItem("role", "department_admin");
  localStorage.setItem("department_id", "2");
  renderAt("/admin/academic/campus/1/department/2");

  fireEvent.click(await screen.findByRole("button", { name: "Associate with program" }));
  fireEvent.change(screen.getAllByLabelText("Program").at(-1), { target: { value: "3" } });
  fireEvent.click(screen.getAllByRole("button", { name: "Save" }).at(-1));

  await waitFor(() => {
    const request = global.fetch.mock.calls.find(([url, options]) => String(url).endsWith("/subjects/10") && options?.method === "PUT");
    expect(JSON.parse(request[1].body)).toMatchObject({ department_id: 2, program_id: 3 });
  });
});

test("department list shows its dean and Add Department saves the Dean field", async () => {
  renderAt("/admin/academic/campus/1");

  expect(await screen.findByText(/Dean: Dr\. Dean/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Add Department" }));
  fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Engineering" } });
  fireEvent.change(screen.getByLabelText(/Code/), { target: { value: "ENG" } });
  fireEvent.change(screen.getByLabelText(/Dean/), { target: { value: "Dr. New Dean" } });
  fireEvent.click(screen.getAllByRole("button", { name: "Save" }).at(-1));

  await waitFor(() => {
    const request = global.fetch.mock.calls.find(([url, options]) => String(url).endsWith("/departments") && options?.method === "POST");
    expect(JSON.parse(request[1].body).dean_name).toBe("Dr. New Dean");
  });
});

test("program list shows its chair and Add Program saves the Program Chair field", async () => {
  renderAt("/admin/academic/campus/1/department/2");

  expect(await screen.findByText(/Program Chair: Dr\. Chair/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Add Program" }));
  fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Information Technology" } });
  fireEvent.change(screen.getByLabelText(/Code/), { target: { value: "BSIT" } });
  fireEvent.change(screen.getByLabelText(/Program Chair/), { target: { value: "Dr. New Chair" } });
  fireEvent.click(screen.getAllByRole("button", { name: "Save" }).at(-1));

  await waitFor(() => {
    const request = global.fetch.mock.calls.find(([url, options]) => String(url).endsWith("/programs") && options?.method === "POST");
    expect(JSON.parse(request[1].body).chair_name).toBe("Dr. New Chair");
  });
});

test("subject list displays each subject code beneath its name", async () => {
  renderAt("/admin/academic/campus/1/department/2/program/3");

  expect(await screen.findByText("Introduction to Computing")).toBeInTheDocument();
  expect(screen.getByText("IT 101")).toBeInTheDocument();
});
