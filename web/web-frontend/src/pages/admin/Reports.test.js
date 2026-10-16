import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ReportsContent } from "./Reports";

const activityRows = [
  {
    id: 1,
    name: "Faculty One",
    dept: "CICS",
    action: "Generated questions",
    detail: "Created a question set",
    type: "generate",
    status: "success",
    date: new Date().toISOString().slice(0, 10),
    time: "10:00 AM",
  },
  {
    id: 2,
    name: "Faculty Two",
    dept: "COE",
    action: "Report download failed",
    detail: "Could not create file",
    type: "download",
    status: "error",
    date: new Date().toISOString().slice(0, 10),
    time: "09:00 AM",
  },
];

beforeEach(() => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => activityRows,
  });
  Object.defineProperty(URL, "createObjectURL", { configurable: true, value: jest.fn(() => "blob:report") });
  Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: jest.fn() });
  jest.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
  delete global.fetch;
});

test("Reports exports the selected activity as a CSV download", async () => {
  render(<ReportsContent />);

  expect(await screen.findByPlaceholderText("Search activity...")).toBeInTheDocument();
  fireEvent.click(await screen.findByRole("tab", { name: /Exports \/ downloads/ }));
  expect(await screen.findByText("Report download failed")).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Export Report" }));
  fireEvent.click(screen.getByRole("button", { name: "Export selected tabs" }));

  await waitFor(() => expect(HTMLAnchorElement.prototype.click).toHaveBeenCalled());
  expect(URL.createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
  expect(screen.queryByText("Export selected tabs")).not.toBeInTheDocument();
});

test("Super Admin activity logs filter by campus before role-specific filters", async () => {
  const today = new Date().toISOString().slice(0, 10);
  const hierarchy = {
    campuses: [{
      id: 10,
      name: "North Campus",
      departments: [{
        id: 20,
        name: "Engineering",
        faculty: [
          { id: 101, name: "Alice Faculty", program_id: 30 },
          { id: 102, name: "Bob Faculty", program_id: 31 },
        ],
        programs: [
          { id: 30, name: "Computer Science", faculty: [{ id: 101, name: "Alice Faculty" }] },
          { id: 31, name: "Mathematics", faculty: [{ id: 102, name: "Bob Faculty" }] },
        ],
      }],
    }],
  };
  global.fetch.mockImplementation(async (url) => {
    if (String(url).endsWith("/academic-hierarchy")) {
      return { ok: true, json: async () => hierarchy };
    }
    return {
      ok: true,
      json: async () => [
        { ...activityRows[0], id: 11, name: "Alice Faculty", role: "faculty", dept: "Engineering", campus_id: 10, department_id: 20, program_id: 30, user_id: 101, date: today },
        { ...activityRows[0], id: 12, name: "Bob Faculty", role: "faculty", dept: "Engineering", campus_id: 10, department_id: 20, program_id: 31, user_id: 102, date: today, action: "Bob generated questions" },
        { ...activityRows[0], id: 13, name: "Carol Faculty", role: "faculty", dept: "Engineering", campus_id: 11, department_id: 22, program_id: 30, user_id: 103, date: today, action: "Carol generated questions" },
        { ...activityRows[0], id: 14, name: "Dan Faculty", role: "faculty", dept: "Science", campus_id: 10, department_id: 21, program_id: 30, user_id: 104, date: today, action: "Dan generated questions" },
        { ...activityRows[0], id: 15, name: "Old Alice", role: "faculty", dept: "Engineering", campus_id: 10, department_id: 20, program_id: 30, user_id: 101, date: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10) },
        { ...activityRows[0], id: 16, name: "Dept Admin", role: "department_admin", campus_id: 10, dept: "Engineering", department_id: 20, action: "Department admin generated questions" },
        { ...activityRows[0], id: 17, name: "Campus Admin", role: "campus_admin", campus_id: 10, dept: "", department_id: null, action: "Campus admin generated questions" },
      ],
    };
  });

  render(<ReportsContent showCampusFilter />);

  expect(screen.getByRole("combobox", { name: "Campus" })).toBeInTheDocument();
  const roleFilter = screen.getByRole("combobox", { name: "Role" });
  expect(roleFilter).toBeInTheDocument();
  expect([...roleFilter.options].map((option) => option.textContent)).toEqual([
    "All Roles",
    "Faculty",
    "Department Admin",
    "Campus Admin",
  ]);
  expect(screen.getByRole("combobox", { name: "Period" })).toBeInTheDocument();
  expect(screen.queryByRole("combobox", { name: "Department" })).not.toBeInTheDocument();
  expect(screen.queryByRole("combobox", { name: "Program" })).not.toBeInTheDocument();
  expect(screen.queryByRole("combobox", { name: "Instructor" })).not.toBeInTheDocument();
  expect(screen.queryByPlaceholderText("Search activity...")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("tab", { name: /Question generation/ }));
  const activityName = (name) => screen.queryByText(name, { selector: "span.font-semibold.text-slate-800" });
  expect(await screen.findByText("Campus Admin", { selector: "span.font-semibold.text-slate-800" })).toBeInTheDocument();
  expect(activityName("Carol Faculty")).toBeInTheDocument();
  fireEvent.change(screen.getByRole("combobox", { name: "Campus" }), { target: { value: "10" } });
  expect(activityName("Carol Faculty")).not.toBeInTheDocument();
  fireEvent.change(roleFilter, { target: { value: "faculty" } });
  expect(screen.getByRole("combobox", { name: "Department" })).toBeInTheDocument();
  expect(screen.getByRole("combobox", { name: "Program" })).toBeInTheDocument();
  expect(screen.getByRole("combobox", { name: "Instructor" })).toBeInTheDocument();
  expect(screen.queryByText("Campus Admin", { selector: "span.font-semibold.text-slate-800" })).not.toBeInTheDocument();
  expect(await screen.findByText("Alice Faculty", { selector: "span.font-semibold.text-slate-800" })).toBeInTheDocument();
  expect(activityName("Old Alice")).not.toBeInTheDocument();
  fireEvent.change(screen.getByRole("combobox", { name: "Period" }), { target: { value: "All Time" } });
  expect(await screen.findByText("Old Alice", { selector: "span.font-semibold.text-slate-800" })).toBeInTheDocument();
  fireEvent.change(screen.getByRole("combobox", { name: "Period" }), { target: { value: "Last 7 Days" } });

  await screen.findByRole("option", { name: "Engineering" });
  fireEvent.change(screen.getByRole("combobox", { name: "Department" }), { target: { value: "20" } });
  await screen.findByRole("option", { name: "Computer Science" });
  fireEvent.change(screen.getByRole("combobox", { name: "Program" }), { target: { value: "30" } });
  await screen.findByRole("option", { name: "Alice Faculty" });
  fireEvent.change(screen.getByRole("combobox", { name: "Instructor" }), { target: { value: "101" } });

  expect(await screen.findByText("Alice Faculty", { selector: "span.font-semibold.text-slate-800" })).toBeInTheDocument();
  expect(screen.queryByText("Bob Faculty", { selector: "span.font-semibold.text-slate-800" })).not.toBeInTheDocument();
  expect(activityName("Carol Faculty")).not.toBeInTheDocument();
  expect(activityName("Dan Faculty")).not.toBeInTheDocument();
  expect(activityName("Old Alice")).not.toBeInTheDocument();
  fireEvent.change(roleFilter, { target: { value: "department_admin" } });
  expect(screen.getByRole("combobox", { name: "Department" })).toBeInTheDocument();
  expect(screen.queryByRole("combobox", { name: "Program" })).not.toBeInTheDocument();
  expect(screen.queryByRole("combobox", { name: "Instructor" })).not.toBeInTheDocument();
  expect(screen.getByRole("combobox", { name: "Campus" })).toBeInTheDocument();
  expect(await screen.findByText("Dept Admin", { selector: "span.font-semibold.text-slate-800" })).toBeInTheDocument();
  expect(activityName("Alice Faculty")).not.toBeInTheDocument();
  fireEvent.change(roleFilter, { target: { value: "campus_admin" } });
  expect(screen.queryByRole("combobox", { name: "Department" })).not.toBeInTheDocument();
  expect(screen.queryByRole("combobox", { name: "Program" })).not.toBeInTheDocument();
  expect(screen.queryByRole("combobox", { name: "Instructor" })).not.toBeInTheDocument();
  expect(await screen.findByText("Campus Admin", { selector: "span.font-semibold.text-slate-800" })).toBeInTheDocument();
  expect(activityName("Dept Admin")).not.toBeInTheDocument();
});