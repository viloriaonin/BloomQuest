import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import ExcelJS from "exceljs";
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
        has_cis: true,
        cis_filename: "IT101-CIS.pdf",
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
  if (String(url).endsWith("/department-admin/faculty-accounts") && options.method === "POST") {
    const payload = JSON.parse(options.body);
    return {
      ok: true,
      json: async () => ({ id: 24, email: payload.email, email_status: "sent" }),
    };
  }
  if (String(url).endsWith("/department-admin/faculty-accounts")) {
    return {
      ok: true,
      json: async () => ({
        active: [{
          id: 22,
          full_name: "Active Faculty",
          email: "active.faculty@example.edu",
          faculty_number: "000345",
          department: "CICS",
          program_id: 3,
          program: "Computer Science",
          created_at: "2026-09-01T09:15:00",
        }],
        archived: [{
          id: 23,
          full_name: "Archived Faculty",
          email: "archived.faculty@example.edu",
          faculty_number: "000123",
          department: "CICS",
          program_id: null,
          program: "N/A",
          created_at: "2026-08-01T09:15:00",
        }],
      }),
    };
  }
  return { ok: true, json: async () => ({ id: 8 }) };
});

beforeEach(() => {
  global.fetch = createFetchMock();
});

afterEach(() => {
  delete global.fetch;
  delete URL.createObjectURL;
  delete URL.revokeObjectURL;
  jest.restoreAllMocks();
  localStorage.removeItem("role");
  localStorage.removeItem("department_id");
  localStorage.removeItem("token");
});

const renderAt = (path, activeSection = null) => render(
  <MemoryRouter initialEntries={[path]}>
    <Routes>
      <Route path="/admin/academic/campus/:campusId" element={<AcademicMgmtContent activeSection={activeSection} />} />
      <Route path="/admin/academic/campus/:campusId/department/:departmentId" element={<AcademicMgmtContent activeSection={activeSection} />} />
      <Route path="/admin/academic/campus/:campusId/department/:departmentId/program/:programId" element={<AcademicMgmtContent activeSection={activeSection} />} />
      <Route path="/admin/academic" element={<AcademicMgmtContent activeSection={activeSection} />} />
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
  const addProgramButton = await screen.findByRole("button", { name: "Add Program" });
  const addSubjectButton = screen.getByRole("button", { name: "Add Subject" });
  expect(addSubjectButton).toBeInTheDocument();
  expect(addProgramButton.compareDocumentPosition(addSubjectButton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Add Department" })).not.toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "Department Dean" })).not.toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "Create dean login" })).not.toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "Department-level subjects" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Edit Department Details" })).not.toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "Request a faculty account" })).not.toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "Request an academic change" })).not.toBeInTheDocument();
});

test("Department Admin can add a subject from the department header and must choose its program", async () => {
  localStorage.setItem("role", "department_admin");
  localStorage.setItem("department_id", "2");
  renderAt("/admin/academic/campus/1/department/2");

  fireEvent.click(await screen.findByRole("button", { name: "Add Subject" }));
  expect(screen.getByLabelText("Program")).toBeRequired();
  expect(screen.getByLabelText(/Course Information Sheet/)).toBeRequired();
  expect(screen.getAllByRole("button", { name: "Save" }).at(-1)).toBeDisabled();
});

test("Campus Admin does not see the academic change request form", async () => {
  localStorage.setItem("role", "campus_admin");
  renderAt("/admin/academic/campus/1/department/2");

  expect(await screen.findByRole("heading", { name: "CICS" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Edit Department Details" })).toBeInTheDocument();
  const summary = screen.getByText("Programs");
  const leadership = screen.getByRole("heading", { name: "Department Dean" });
  expect(summary.compareDocumentPosition(leadership) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Add Program" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Add Subject" })).not.toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "Department faculty" })).not.toBeInTheDocument();
  expect(screen.queryByLabelText("Program for Ada Faculty")).not.toBeInTheDocument();
  expect(screen.queryByLabelText("Assign dean from department faculty")).not.toBeInTheDocument();
  const programCard = screen.getByRole("heading", { name: "Computer Science" }).closest('[role="button"]');
  fireEvent.click(programCard.querySelector('button[aria-label="More actions"]'));
  expect(screen.queryByRole("menuitem", { name: "Edit" })).not.toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "Request an academic change" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Submit change request" })).not.toBeInTheDocument();
});

test("department details dialog stays within the viewport and can scroll", async () => {
  localStorage.setItem("role", "campus_admin");
  renderAt("/admin/academic/campus/1/department/2");

  fireEvent.click(await screen.findByRole("button", { name: "Edit Department Details" }));

  const dialog = screen.getByRole("heading", { name: "Edit Department Details" }).closest("form");
  expect(dialog).toHaveClass("overflow-y-auto");
  expect(dialog).toHaveClass("max-h-[calc(100vh-2rem)]");
  expect(dialog.querySelector('button[type="submit"]')).toHaveTextContent("Save");
  expect(dialog.closest(".bq-modal-overlay")).toHaveClass("fixed");
  expect(dialog.closest(".page-transition")).toBeNull();
});

test("Department Admin must provide a program and CIS when creating a subject", async () => {
  localStorage.setItem("role", "department_admin");
  localStorage.setItem("department_id", "2");
  renderAt("/admin/academic/campus/1/department/2/program/3", "academic");

  fireEvent.click(await screen.findByRole("button", { name: "Add Subject" }));
  expect(screen.getByLabelText(/Course Information Sheet/)).toBeRequired();
  expect(screen.getByLabelText("Program")).toBeRequired();
  expect(screen.getByLabelText(/Code/)).toBeRequired();
  expect(screen.getAllByRole("button", { name: "Save" }).at(-1)).toBeDisabled();

  fireEvent.change(screen.getByLabelText("Name"), { target: { value: "New Course" } });
  fireEvent.change(screen.getByLabelText(/Code/), { target: { value: "NC101" } });
  fireEvent.change(screen.getByLabelText("Program"), { target: { value: "3" } });
  const cis = new File(["Course Information Sheet"], "NC101.docx", { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
  fireEvent.change(screen.getByLabelText(/Course Information Sheet/), { target: { files: [cis] } });
  expect(screen.getAllByRole("button", { name: "Save" }).at(-1)).toBeEnabled();
  fireEvent.click(screen.getAllByRole("button", { name: "Save" }).at(-1));

  await waitFor(() => {
    const request = global.fetch.mock.calls.find(([url, options]) => String(url).endsWith("/subjects/with-cis") && options?.method === "POST");
    expect(request).toBeDefined();
    expect(request[1].body).toBeInstanceOf(FormData);
    expect(request[1].body.get("name")).toBe("New Course");
    expect(request[1].body.get("code")).toBe("NC101");
    expect(request[1].body.get("program_id")).toBe("3");
    expect(request[1].body.get("cis_file").name).toBe("NC101.docx");
  });
});

test("Department Admin cannot save a subject without a valid department program and accepted CIS file", async () => {
  localStorage.setItem("role", "department_admin");
  localStorage.setItem("department_id", "2");
  renderAt("/admin/academic/campus/1/department/2/program/3");

  fireEvent.click(await screen.findByRole("button", { name: "Add Subject" }));
  fireEvent.change(screen.getByLabelText("Name"), { target: { value: "New Course" } });
  fireEvent.change(screen.getByLabelText(/Code/), { target: { value: "NC101" } });

  const fileInput = screen.getByLabelText(/Course Information Sheet/);
  const saveButton = screen.getAllByRole("button", { name: "Save" }).at(-1);
  fireEvent.change(screen.getByLabelText("Program"), { target: { value: "" } });
  fireEvent.change(fileInput, {
    target: { files: [new File(["not a CIS"], "notes.txt", { type: "text/plain" })] },
  });
  expect(screen.getByRole("alert")).toHaveTextContent("Choose a PDF, DOCX, or XLSX file.");
  expect(saveButton).toBeDisabled();

  fireEvent.change(fileInput, {
    target: { files: [new File(["CIS"], "NC101.pdf", { type: "application/pdf" })] },
  });
  expect(saveButton).toBeDisabled();

  fireEvent.change(screen.getByLabelText("Program"), { target: { value: "3" } });
  expect(saveButton).toBeEnabled();
});

test("Department Admin can view the current CIS and open a CIS-only replacement form", async () => {
  localStorage.setItem("role", "department_admin");
  localStorage.setItem("department_id", "2");
  global.fetch.mockImplementation(async (url, options = {}) => {
    if (String(url).endsWith("/subjects/9/cis")) {
      return {
        ok: true,
        json: async () => ({
          subject_name: "Introduction to Computing",
          filename: "IT101-CIS.pdf",
          media_type: "application/pdf",
          extracted_text: "Course information",
          uploaded_at: "2026-10-01T00:00:00",
        }),
      };
    }
    if (String(url).endsWith("/subjects/9/cis/file")) {
      return { ok: true, blob: async () => new Blob(["PDF data"], { type: "application/pdf" }) };
    }
    return createFetchMock()(url, options);
  });
  URL.createObjectURL = jest.fn().mockReturnValue("blob:cis-preview");
  URL.revokeObjectURL = jest.fn();
  renderAt("/admin/academic/campus/1/department/2/program/3");

  const subjectRow = await screen.findByText("Introduction to Computing");
  const openActions = () => fireEvent.click(subjectRow.closest("tr").querySelector('button[aria-label="More actions"]'));
  openActions();
  expect(screen.getByRole("menu").parentElement).toBe(document.body);
  expect(screen.getByRole("menu").classList.contains("fixed")).toBe(true);
  fireEvent.click(screen.getByRole("menuitem", { name: "View CIS" }));
  expect(subjectRow.closest("tr").querySelector('button[aria-label="More actions"]')).toHaveAttribute("aria-expanded", "false");
  expect(await screen.findByRole("dialog", { name: "Course Information Sheet" })).toBeInTheDocument();
  expect(await screen.findByText("IT101-CIS.pdf")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /IT101-CIS\.pdf/ }));
  expect(screen.getByTitle("Preview of IT101-CIS.pdf")).toHaveAttribute("src", "blob:cis-preview");
  expect(screen.getByRole("link", { name: "Download original" })).toHaveAttribute("download", "IT101-CIS.pdf");
  fireEvent.click(screen.getByRole("button", { name: "Close CIS preview" }));

  openActions();
  fireEvent.click(screen.getByRole("menuitem", { name: "Replace CIS" }));
  expect(await screen.findByRole("heading", { name: "Replace Course Information Sheet" })).toBeInTheDocument();
  expect(screen.queryByLabelText("Name")).not.toBeInTheDocument();
  expect(screen.getAllByRole("button", { name: "Replace CIS" }).at(-1)).toBeDisabled();

  const replacement = new File(["replacement"], "replacement.pdf", { type: "application/pdf" });
  fireEvent.change(screen.getByLabelText(/Course Information Sheet/), { target: { files: [replacement] } });
  expect(screen.getAllByRole("button", { name: "Replace CIS" }).at(-1)).toBeEnabled();
  fireEvent.click(screen.getAllByRole("button", { name: "Replace CIS" }).at(-1));
  await waitFor(() => {
    expect(global.fetch.mock.calls.some(([url, options]) => String(url).endsWith("/subjects/9/cis") && options?.method === "PUT")).toBe(true);
  });
  expect(global.fetch.mock.calls.some(([url, options]) => String(url).endsWith("/subjects/9") && options?.method === "PUT")).toBe(false);

  openActions();
  fireEvent.click(screen.getByRole("menuitem", { name: "Edit subject" }));
  expect(await screen.findByRole("heading", { name: "Edit subject" })).toBeInTheDocument();
  expect(screen.queryByLabelText(/Course Information Sheet/)).not.toBeInTheDocument();
});

test("Department Admin can click an XLSX CIS filename to preview its original worksheet", async () => {
  localStorage.setItem("role", "department_admin");
  localStorage.setItem("department_id", "2");
  const workbook = new ExcelJS.Workbook();
  workbook.addWorksheet("Course Info").addRows([
    ["Course Code", "Course Title"],
    ["IT332", "Integrative Programming"],
  ]);
  const workbookBytes = await workbook.xlsx.writeBuffer();
  global.fetch.mockImplementation(async (url) => {
    if (String(url).endsWith("/subjects/9/cis")) {
      return {
        ok: true,
        json: async () => ({
          subject_name: "Introduction to Computing",
          filename: "IT332-CIS.xlsx",
          media_type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          extracted_text: "Course Code IT332",
          uploaded_at: "2026-10-01T00:00:00",
        }),
      };
    }
    if (String(url).endsWith("/subjects/9/cis/file")) {
      const fileBlob = new Blob([workbookBytes]);
      fileBlob.arrayBuffer = async () => workbookBytes;
      return { ok: true, blob: async () => fileBlob };
    }
    return createFetchMock()(url);
  });
  URL.createObjectURL = jest.fn().mockReturnValue("blob:cis-xlsx");
  URL.revokeObjectURL = jest.fn();
  renderAt("/admin/academic/campus/1/department/2/program/3");
  const subjectRow = await screen.findByText("Introduction to Computing");
  fireEvent.click(subjectRow.closest("tr").querySelector('button[aria-label="More actions"]'));
  fireEvent.click(screen.getByRole("menuitem", { name: "View CIS" }));

  fireEvent.click(await screen.findByRole("button", { name: /IT332-CIS\.xlsx/ }));
  expect(await screen.findByText("Integrative Programming")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Course Info" })).toBeInTheDocument();
  expect(screen.getByText("Original file preview")).toBeInTheDocument();
});

test("Department Admin can directly add a faculty account for a department program", async () => {
  localStorage.setItem("role", "department_admin");
  localStorage.setItem("department_id", "2");
  renderAt("/admin/academic/campus/1/department/2", "faculty");

  fireEvent.click(await screen.findByRole("button", { name: "Add faculty member" }));
  fireEvent.change(await screen.findByLabelText("Full name"), { target: { value: "New Faculty" } });
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "new-faculty@example.com" } });
  fireEvent.change(screen.getByLabelText("Number for faculty member 1"), { target: { value: "000345" } });
  fireEvent.change(screen.getByLabelText("Program for faculty member 1"), { target: { value: "3" } });
  fireEvent.click(screen.getByRole("button", { name: "Add 1 & send email", exact: true }));

  await waitFor(() => {
    const request = global.fetch.mock.calls.find(([url, options]) => String(url).endsWith("/department-admin/faculty-accounts") && options?.method === "POST");
    expect(JSON.parse(request[1].body)).toEqual({
      full_name: "New Faculty",
      email: "new-faculty@example.com",
      faculty_number: "000345",
      program_id: 3,
    });
  });
  await waitFor(() => {
    expect(screen.getByRole("status")).toHaveTextContent("Created 1 faculty account and sent the temporary password email to: new-faculty@example.com.");
  });
});

test("Department Admin sees an email delivery failure after the faculty account is created", async () => {
  localStorage.setItem("role", "department_admin");
  localStorage.setItem("department_id", "2");
  renderAt("/admin/academic/campus/1/department/2", "faculty");

  fireEvent.click(await screen.findByRole("button", { name: "Add faculty member" }));
  fireEvent.change(await screen.findByLabelText("Full name"), { target: { value: "New Faculty" } });
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "new-faculty@example.com" } });
  fireEvent.change(screen.getByLabelText("Number for faculty member 1"), { target: { value: "000345" } });
  fireEvent.change(screen.getByLabelText("Program for faculty member 1"), { target: { value: "3" } });
  const defaultFetch = global.fetch.getMockImplementation();
  global.fetch.mockImplementation((url, options) => {
    if (String(url).endsWith("/department-admin/faculty-accounts") && options.method === "POST") {
      return Promise.resolve({
        ok: true,
        json: async () => ({ id: 24, email: "new-faculty@example.com", email_status: "failed" }),
      });
    }
    return defaultFetch(url, options);
  });

  fireEvent.click(screen.getByRole("button", { name: "Add 1 & send email", exact: true }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Account created, but email could not be sent to: new-faculty@example.com. Contact your system administrator to resend the invitation.",
  );
});

test("Department Admin can add multiple faculty members with the plus action", async () => {
  localStorage.setItem("role", "department_admin");
  localStorage.setItem("department_id", "2");
  renderAt("/admin/academic/campus/1/department/2", "faculty");

  fireEvent.click(await screen.findByRole("button", { name: "Add faculty member" }));
  fireEvent.change(await screen.findByLabelText("Full name"), { target: { value: "Faculty One" } });
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "faculty-one@example.com" } });
  fireEvent.change(screen.getByLabelText("Number for faculty member 1"), { target: { value: "000001" } });
  fireEvent.change(screen.getByLabelText("Program for faculty member 1"), { target: { value: "3" } });
  fireEvent.click(screen.getByRole("button", { name: "Add another" }));

  fireEvent.change(screen.getAllByLabelText("Full name")[1], { target: { value: "Faculty Two" } });
  fireEvent.change(screen.getAllByLabelText("Email")[1], { target: { value: "faculty-two@example.com" } });
  fireEvent.change(screen.getByLabelText("Number for faculty member 2"), { target: { value: "000002" } });
  fireEvent.change(screen.getByLabelText("Program for faculty member 2"), { target: { value: "3" } });
  fireEvent.click(screen.getByRole("button", { name: "Add 2 & send emails" }));

  await waitFor(() => {
    const requests = global.fetch.mock.calls.filter(([url, options]) =>
      String(url).endsWith("/department-admin/faculty-accounts") && options.method === "POST",
    );
    expect(requests).toHaveLength(2);
    expect(requests.map(([, options]) => JSON.parse(options.body).email)).toEqual([
      "faculty-one@example.com",
      "faculty-two@example.com",
    ]);
    expect(requests.map(([, options]) => JSON.parse(options.body).faculty_number)).toEqual([
      "000001",
      "000002",
    ]);
  });
  await waitFor(() => {
    expect(screen.getByRole("status")).toHaveTextContent("Created 2 faculty accounts and sent the temporary password email to: faculty-one@example.com, faculty-two@example.com.");
  });
});

test("Department Admin faculty view no longer contains the program-chair assignment table", async () => {
  localStorage.setItem("role", "department_admin");
  localStorage.setItem("department_id", "2");
  renderAt("/admin/academic/campus/1/department/2", "faculty");

  expect(await screen.findByRole("heading", { name: "Faculty accounts" })).toBeInTheDocument();
  expect(screen.queryByLabelText("Program chair for Computer Science")).not.toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "Department faculty" })).not.toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "Subject faculty assignments" })).not.toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "Create program chair login" })).not.toBeInTheDocument();
});

test("Department Admin Leadership Management contains dean and program chair controls", async () => {
  localStorage.setItem("role", "department_admin");
  localStorage.setItem("department_id", "2");
  renderAt("/admin/academic/campus/1/department/2", "leadership");

  expect(await screen.findByLabelText("Program chair for Computer Science")).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Leadership Management", level: 2 })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Program chairs", level: 3 })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Department Dean" })).toBeInTheDocument();
  expect(screen.getByLabelText("Assign dean from department faculty")).toBeInTheDocument();
  const chairInput = screen.getByRole("combobox", { name: "Program chair for Computer Science" });
  expect(chairInput).toHaveValue("Dr. Chair");
  expect(screen.queryByRole("heading", { name: "Faculty accounts" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Add Program" })).not.toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "Create dean login" })).not.toBeInTheDocument();

  const deanForm = screen.getByRole("button", { name: "Clear" }).closest("form");
  fireEvent.click(within(deanForm).getByRole("button", { name: "Clear" }));
  expect(await screen.findByRole("status")).toHaveTextContent("Draft cleared. Save to apply this change.");

  fireEvent.change(screen.getByLabelText("Assign dean from department faculty"), { target: { value: "44" } });
  fireEvent.click(within(deanForm).getByRole("button", { name: "Save" }));

  await waitFor(() => {
    const request = global.fetch.mock.calls.find(([url, options]) =>
      String(url).endsWith("/departments/2/dean") && options?.method === "PUT",
    );
    expect(JSON.parse(request[1].body)).toEqual({ faculty_id: 44 });
  });
  expect(await screen.findByRole("status")).toHaveTextContent("Dean assignment saved.");

  const programRow = screen.getByText("Computer Science").closest("tr");
  fireEvent.click(within(programRow).getByRole("button", { name: "Clear chair for Computer Science" }));
  expect(chairInput).toHaveValue("");
  expect(await within(programRow).findByRole("status")).toHaveTextContent("Draft cleared. Save to remove the current chair.");
  fireEvent.click(within(programRow).getByRole("button", { name: "Save" }));

  await waitFor(() => {
    const clearRequest = global.fetch.mock.calls.find(([url, options]) =>
      String(url).endsWith("/programs/3/chair") &&
      options?.method === "PUT" &&
      JSON.parse(options.body).faculty_id === null,
    );
    expect(clearRequest).toBeDefined();
  });
  expect(await within(programRow).findByRole("status")).toHaveTextContent("Chair assignment cleared.");

  fireEvent.change(chairInput, { target: { value: "Dr. Typed Chair" } });
  fireEvent.click(within(programRow).getByRole("button", { name: "Save" }));

  await waitFor(() => {
    const request = global.fetch.mock.calls.find(([url, options]) =>
      String(url).endsWith("/programs/3/chair") &&
      options?.method === "PUT" &&
      JSON.parse(options.body).name === "Dr. Typed Chair",
    );
    expect(JSON.parse(request[1].body)).toEqual({ name: "Dr. Typed Chair" });
  });
  expect(await within(programRow).findByRole("status")).toHaveTextContent("Chair assignment saved.");
});

test("Department Admin Faculty Management only shows active and archived accounts", async () => {
  localStorage.setItem("role", "department_admin");
  localStorage.setItem("department_id", "2");
  jest.spyOn(window, "confirm").mockReturnValue(true);
  renderAt("/admin/academic/campus/1/department/2", "faculty");

  expect(await screen.findByRole("heading", { name: "Faculty accounts" })).toBeInTheDocument();
  const statusTabs = screen.getByRole("tablist", { name: "Faculty account status" });
  expect(statusTabs).toHaveTextContent("Active (1)");
  expect(statusTabs).toHaveTextContent("Archived (1)");
  expect(screen.queryByRole("tab", { name: /Pending/ })).not.toBeInTheDocument();
  expect(screen.queryByRole("tab", { name: /User requests/ })).not.toBeInTheDocument();
  expect(screen.queryByText("New Applicant")).not.toBeInTheDocument();
  expect(global.fetch).not.toHaveBeenCalledWith(
    expect.stringContaining("/admin/user-change-requests"),
    expect.anything(),
  );
  fireEvent.click(screen.getByRole("tab", { name: "Active (1)" }));
  expect(await screen.findByText("Active Faculty")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Archive" })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "View profile" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("tab", { name: "Archived (1)" }));
  expect(await screen.findByText("Archived Faculty")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Restore" })).toBeInTheDocument();
});

test("Department Admin can filter faculty accounts by search, program, and assignment", async () => {
  localStorage.setItem("role", "department_admin");
  localStorage.setItem("department_id", "2");
  renderAt("/admin/academic/campus/1/department/2", "faculty");

  expect(await screen.findByText("Active Faculty")).toBeInTheDocument();
  const facultyHeaders = screen.getAllByRole("columnheader").map((header) => header.textContent.trim());
  expect(facultyHeaders.indexOf("Number")).toBeLessThan(facultyHeaders.indexOf("Name"));
  expect(screen.getByText("000345")).toBeInTheDocument();
  expect(screen.getByText("Showing 1 of 1")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Clear filters" })).toBeEnabled();
  fireEvent.change(screen.getByLabelText("Search faculty by number, name, or email"), {
    target: { value: "000345" },
  });
  expect(screen.getByText("Active Faculty")).toBeInTheDocument();

  fireEvent.change(screen.getByLabelText("Search faculty by number, name, or email"), {
    target: { value: "not a faculty member" },
  });
  expect(screen.getByText("No faculty match these filters.")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
  expect(screen.getByLabelText("Search faculty by number, name, or email")).toHaveValue("");
  expect(screen.getByRole("button", { name: "Clear filters" })).toBeEnabled();

  fireEvent.change(screen.getByLabelText("Filter faculty accounts by program"), {
    target: { value: "3" },
  });
  expect(screen.getByText("Active Faculty")).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Filter faculty by assignment"), {
    target: { value: "unassigned" },
  });
  expect(screen.getByText("No faculty match these filters.")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));

  fireEvent.click(screen.getByRole("tab", { name: "Archived (1)" }));
  expect(await screen.findByText("Archived Faculty")).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Filter faculty by assignment"), {
    target: { value: "unassigned" },
  });
  expect(screen.getByText("Archived Faculty")).toBeInTheDocument();
  expect(screen.getByText("Showing 1 of 1")).toBeInTheDocument();
});

test.skip("Legacy Department Admin user change request review is removed", async () => {
  localStorage.setItem("role", "department_admin");
  localStorage.setItem("department_id", "2");
  localStorage.setItem("token", "department-token");
  renderAt("/admin/academic/campus/1/department/2", "faculty");

  fireEvent.click(await screen.findByRole("tab", { name: "User requests (1)" }));
  expect(await screen.findByRole("heading", { name: "User change requests" })).toBeInTheDocument();
  expect(await screen.findByText("Ada Faculty")).toBeInTheDocument();
  expect(screen.getByText("Information Technology")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Pending" })).toHaveAttribute("aria-pressed", "false");
  expect(screen.getByRole("button", { name: "All" })).toHaveAttribute("aria-pressed", "true");

  fireEvent.click(screen.getByRole("button", { name: "Pending" }));
  expect(screen.getByRole("button", { name: "Pending" })).toHaveAttribute("aria-pressed", "true");
  fireEvent.click(screen.getByRole("button", { name: "Approve" }));
  await waitFor(() => {
    const request = global.fetch.mock.calls.find(([url, options]) =>
      String(url).endsWith("/admin/user-change-requests/25") && options?.method === "PATCH",
    );
    expect(JSON.parse(request[1].body)).toEqual({ action: "approve" });
    expect(request[1].headers.Authorization).toBe("Bearer department-token");
  });
});

test("Department Admin does not see duplicate program chair login forms in Faculty Management", async () => {
  localStorage.setItem("role", "department_admin");
  localStorage.setItem("department_id", "2");
  renderAt("/admin/academic/campus/1/department/2", "faculty");

  await screen.findByRole("heading", { name: "Faculty accounts" });
  expect(screen.queryByRole("heading", { name: "Create program chair login" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Create account and email credentials" })).not.toBeInTheDocument();
});

test("Department Admin does not see the Academic Management breadcrumb", async () => {
  localStorage.setItem("role", "department_admin");
  localStorage.setItem("department_id", "2");
  renderAt("/admin/academic/campus/1/department/2/program/3", "faculty");

  await screen.findByRole("heading", { name: "Faculty Management" });
  expect(screen.queryByRole("navigation", { name: "Breadcrumb" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Academic Management" })).not.toBeInTheDocument();
});

test("Campus Admin can view the program chair but cannot reassign it", async () => {
  renderAt("/admin/academic/campus/1/department/2/program/3");

  expect(await screen.findByText("Program Chair")).toBeInTheDocument();
  expect(screen.getByText("Dr. Chair")).toBeInTheDocument();
  expect(screen.queryByLabelText("Assign program chair")).not.toBeInTheDocument();
  expect(screen.queryByRole("columnheader", { name: "Assigned Faculty" })).not.toBeInTheDocument();
  expect(screen.queryByLabelText("Faculty for Introduction to Computing")).not.toBeInTheDocument();
});

test("Department Admin program subjects are not assigned to one faculty member", async () => {
  localStorage.setItem("role", "department_admin");
  localStorage.setItem("department_id", "2");
  renderAt("/admin/academic/campus/1/department/2/program/3", "academic");

  expect(await screen.findByText("Introduction to Computing")).toBeInTheDocument();
  expect(screen.queryByRole("columnheader", { name: /Assigned Faculty|Faculty/ })).not.toBeInTheDocument();
  expect(screen.queryByLabelText("Faculty for Introduction to Computing")).not.toBeInTheDocument();
  expect(screen.queryByText("Assign in Faculty Management")).not.toBeInTheDocument();
});

test("Department Admin manages dean details on Leadership Management, not Academic Management", async () => {
  localStorage.setItem("role", "department_admin");
  localStorage.setItem("department_id", "2");
  renderAt("/admin/academic/campus/1/department/2");

  await screen.findByRole("heading", { name: "CICS" });
  expect(screen.queryByLabelText("Assign dean from department faculty")).not.toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "Department Dean" })).not.toBeInTheDocument();
  const programCard = screen.getByRole("heading", { name: "Computer Science" }).closest('[role="button"]');
  fireEvent.click(programCard.querySelector('button[aria-label="More actions"]'));
  expect(await screen.findByRole("menuitem", { name: "Edit" })).toBeInTheDocument();
});

test("Department Admin does not see department-level subject management", async () => {
  localStorage.setItem("role", "department_admin");
  localStorage.setItem("department_id", "2");
  renderAt("/admin/academic/campus/1/department/2");

  await screen.findByRole("heading", { name: "CICS" });
  expect(screen.queryByRole("heading", { name: "Department-level subjects" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Associate with program" })).not.toBeInTheDocument();
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

test("campus admin can create a dean login from the department leadership section", async () => {
  let deanCreated = false;
  const defaultFetch = global.fetch.getMockImplementation();
  global.fetch.mockImplementation(async (url, options) => {
    if (String(url).endsWith("/departments/2/dean-account") && options?.method === "POST") {
      deanCreated = true;
      return {
        ok: true,
        json: async () => ({
          id: 24,
          email: "alex.dean@example.edu",
          role: "department_admin",
          email_status: "demo",
          demo_temporary_password: "SecureRandom1!",
          demo_setup_url: "https://demo.example.edu/set-password?token=demo-token",
        }),
      };
    }
    if (String(url).endsWith("/academic-hierarchy") && deanCreated) {
      return {
        ok: true,
        json: async () => ({
          campuses: hierarchy.campuses.map((campus) => ({
            ...campus,
            departments: campus.departments.map((department) => ({
              ...department,
              dean_id: 24,
              dean_name: "Dr. Alex Dean",
              dean: { id: 24, name: "Dr. Alex Dean", role: "department_admin" },
            })),
          })),
        }),
      };
    }
    return defaultFetch(url, options);
  });
  renderAt("/admin/academic/campus/1");
  await screen.findByRole("heading", { name: "CICS" });
  fireEvent.click(screen.getByRole("button", { name: "View Department" }));

  fireEvent.change(await screen.findByLabelText("Dean full name"), { target: { value: "Dr. Alex Dean" } });
  fireEvent.change(screen.getByLabelText("Dean email"), { target: { value: "alex.dean@example.edu" } });
  fireEvent.click(screen.getByRole("button", { name: "Create dean account" }));

  await waitFor(() => {
    const request = global.fetch.mock.calls.find(([url, options]) => String(url).endsWith("/departments/2/dean-account") && options?.method === "POST");
    expect(JSON.parse(request[1].body)).toEqual({ full_name: "Dr. Alex Dean", email: "alex.dean@example.edu" });
  });
  expect(await screen.findByRole("status")).toHaveTextContent("Account created without email");
  expect(screen.getByRole("status")).toHaveTextContent("Temporary password: SecureRandom1!");
  expect(screen.getByRole("link", { name: "https://demo.example.edu/set-password?token=demo-token" })).toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "Create dean login" })).not.toBeInTheDocument();
});

test("Campus Admin can view program chairs but cannot add programs", async () => {
  renderAt("/admin/academic/campus/1/department/2");

  expect(await screen.findByText(/Program Chair: Dr\. Chair/)).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Add Program" })).not.toBeInTheDocument();
});

test("subject list displays each subject code beneath its name", async () => {
  renderAt("/admin/academic/campus/1/department/2/program/3");

  expect(await screen.findByText("Introduction to Computing")).toBeInTheDocument();
  expect(screen.getByText("IT 101")).toBeInTheDocument();
});

test("Department Admin sees demo setup credentials without an email-failure message", async () => {
  localStorage.setItem("role", "department_admin");
  localStorage.setItem("department_id", "2");
  const defaultFetch = global.fetch.getMockImplementation();
  global.fetch.mockImplementation((url, options) => {
    if (String(url).endsWith("/department-admin/faculty-accounts") && options?.method === "POST") {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          id: 24,
          email: "new-faculty@example.com",
          email_status: "demo",
          demo_temporary_password: "DemoPass123!",
          demo_setup_url: "https://example.com/setup/demo-token",
        }),
      });
    }
    return defaultFetch(url, options);
  });

  renderAt("/admin/academic/campus/1/department/2", "faculty");
  fireEvent.click(await screen.findByRole("button", { name: "Add faculty member" }));
  fireEvent.change(await screen.getByLabelText("Full name"), { target: { value: "New Faculty" } });
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "new-faculty@example.com" } });
  fireEvent.change(screen.getByLabelText("Number for faculty member 1"), { target: { value: "000345" } });
  fireEvent.change(screen.getByLabelText("Program for faculty member 1"), { target: { value: "3" } });
  fireEvent.click(screen.getByRole("button", { name: "Add 1 & send email", exact: true }));

  await waitFor(() => {
    const notice = screen.getByRole("status");
    expect(notice).toHaveTextContent("Demo mode: email was not sent.");
    expect(notice).toHaveTextContent("Temporary password: DemoPass123!");
    expect(notice).toHaveTextContent("Setup link: https://example.com/setup/demo-token");
  });
  const notice = screen.getByRole("status");
  expect(notice).toHaveTextContent("Demo mode: email was not sent.");
  expect(screen.queryByText(/email could not be sent/i)).not.toBeInTheDocument();
});
