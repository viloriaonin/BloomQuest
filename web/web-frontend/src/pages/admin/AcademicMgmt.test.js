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
        faculty: [],
      }],
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
    return { ok: true, json: async () => [] };
  }
  return { ok: true, json: async () => ({ id: 8 }) };
});

beforeEach(() => {
  global.fetch = createFetchMock();
});

afterEach(() => {
  delete global.fetch;
});

const renderAt = (path) => render(
  <MemoryRouter initialEntries={[path]}>
    <Routes>
      <Route path="/admin/academic/campus/:campusId" element={<AcademicMgmtContent />} />
      <Route path="/admin/academic/campus/:campusId/department/:departmentId" element={<AcademicMgmtContent />} />
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
