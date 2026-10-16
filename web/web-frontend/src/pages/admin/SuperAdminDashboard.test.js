import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { API_URL } from "../../config/api";
import { SuperAdminDashboardContent } from "./SuperAdminDashboard";

jest.mock("react-chartjs-2", () => ({
  Bar: ({ data }) => <div data-testid="questions-chart">{JSON.stringify(data)}</div>,
  Doughnut: ({ data }) => <div data-testid="bloom-chart">{JSON.stringify(data)}</div>,
}));

const hierarchy = {
  campuses: [{
    id: 1,
    name: "Alpha Campus",
    departments: [{
      id: 7,
      name: "Engineering",
      programs: [{
        id: 8,
        name: "Computer Science",
        faculty: [{ id: 9, name: "Taylor Instructor" }],
      }],
    }],
  }],
};

const makeOverview = (searchParams) => {
  const instructorFiltered = searchParams.get("instructor_id") === "9";
  const programFiltered = searchParams.get("program_id") === "8";
  const departmentFiltered = searchParams.get("department_id") === "7";
  const campus = {
    id: 1,
    name: "Alpha Campus",
    departments: departmentFiltered ? 1 : 3,
    programs: programFiltered ? 1 : 4,
    subjects: 2,
    users: instructorFiltered ? 1 : 6,
    faculty: instructorFiltered ? 1 : 3,
    questions: instructorFiltered ? 1 : programFiltered ? 2 : departmentFiltered ? 3 : 8,
    is_active: true,
    bloom_distribution: instructorFiltered
      ? { Remember: 1 }
      : programFiltered
        ? { Remember: 1, Analyze: 1 }
        : { Remember: 2, Analyze: 1 },
  };
  if (!searchParams.has("campus_id")) {
    return {
      totals: { campuses: 1, active_campuses: 1, departments: 3, programs: 4, subjects: 2, users: 6, faculty: 3, questions: 8 },
      bloom_distribution: { Remember: 2, Analyze: 1 },
      question_type_distribution: {},
      campuses: [campus],
    };
  }
  return {
    totals: {
      campuses: 1,
      active_campuses: 1,
      departments: campus.departments,
      programs: campus.programs,
      subjects: campus.subjects,
      users: campus.users,
      faculty: campus.faculty,
      questions: campus.questions,
    },
    bloom_distribution: campus.bloom_distribution,
    question_type_distribution: {},
    campuses: [campus],
  };
};

test("academic filters follow campus hierarchy and update the question and Bloom charts", async () => {
  global.fetch = jest.fn(async (input) => {
    const url = new URL(String(input));
    if (url.pathname.endsWith("/academic-hierarchy")) {
      return { ok: true, json: async () => hierarchy };
    }
    if (url.pathname.endsWith("/super-admin/overview")) {
      return { ok: true, json: async () => makeOverview(url.searchParams) };
    }
    return { ok: true, json: async () => [] };
  });
  const setError = jest.fn();
  const setNotice = jest.fn();

  render(
    <MemoryRouter initialEntries={["/super-admin/dashboard"]}>
      <SuperAdminDashboardContent
        activeTab="dashboard"
        setError={setError}
        setNotice={setNotice}
      />
    </MemoryRouter>,
  );

  const departmentFilter = await screen.findByRole("combobox", { name: "Filter dashboard by department" });
  const programFilter = screen.getByRole("combobox", { name: "Filter dashboard by program" });
  const instructorFilter = screen.getByRole("combobox", { name: "Filter dashboard by instructor" });
  const campusFilter = screen.getByRole("combobox", { name: "Filter dashboard by campus" });
  expect(departmentFilter).toBeDisabled();
  expect(programFilter).toBeDisabled();
  expect(instructorFilter).toBeDisabled();

  await screen.findByRole("option", { name: "Alpha Campus" });
  fireEvent.change(campusFilter, { target: { value: "1" } });
  expect(departmentFilter).toBeEnabled();
  await screen.findByRole("option", { name: "Engineering — Alpha Campus" });

  fireEvent.change(departmentFilter, { target: { value: "7" } });
  expect(programFilter).toBeEnabled();
  expect(instructorFilter).toBeDisabled();
  await screen.findByRole("option", { name: "Computer Science" });
  await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(
    `${API_URL}/super-admin/overview?campus_id=1&department_id=7`,
    expect.anything(),
  ));
  await waitFor(() => {
    const questionChart = JSON.parse(screen.getByTestId("questions-chart").textContent);
    expect(questionChart.labels).toEqual(["Computer Science"]);
    expect(questionChart.datasets[0].data).toEqual([2]);
    expect(JSON.parse(screen.getByTestId("bloom-chart").textContent).datasets[0].data).toEqual([2, 1]);
  });

  fireEvent.change(programFilter, { target: { value: "8" } });
  expect(instructorFilter).toBeEnabled();
  await screen.findByRole("option", { name: "Taylor Instructor" });
  await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(
    `${API_URL}/super-admin/overview?campus_id=1&department_id=7&program_id=8`,
    expect.anything(),
  ));
  await waitFor(() => {
    const questionChart = JSON.parse(screen.getByTestId("questions-chart").textContent);
    expect(questionChart.labels).toEqual(["Taylor Instructor"]);
    expect(questionChart.datasets[0].data).toEqual([1]);
    expect(JSON.parse(screen.getByTestId("bloom-chart").textContent).labels).toEqual(["Remember", "Analyze"]);
  });

  fireEvent.change(instructorFilter, { target: { value: "9" } });
  await waitFor(() => {
    expect(global.fetch).toHaveBeenCalledWith(
      `${API_URL}/super-admin/overview?campus_id=1&department_id=7&program_id=8&instructor_id=9`,
      expect.anything(),
    );
  });
  await waitFor(() => {
    const questionChart = JSON.parse(screen.getByTestId("questions-chart").textContent);
    expect(questionChart.labels).toEqual(["Taylor Instructor"]);
    expect(questionChart.datasets[0].data).toEqual([1]);
    expect(JSON.parse(screen.getByTestId("bloom-chart").textContent).labels).toEqual(["Remember"]);
  });
});

test("campus creation requires password confirmation before sending the create request", async () => {
  global.fetch = jest.fn(async (input, options = {}) => {
    const url = new URL(String(input));
    if (url.pathname.endsWith("/super-admin/overview")) {
      return { ok: true, json: async () => ({ totals: {}, campuses: [] }) };
    }
    if (url.pathname.endsWith("/super-admin/campuses")) {
      return { ok: true, json: async () => [] };
    }
    if (url.pathname.endsWith("/campuses") && options.method === "POST") {
      return { ok: true, json: async () => ({ id: 1, name: "New Campus" }) };
    }
    return { ok: true, json: async () => [] };
  });

  render(
    <MemoryRouter>
      <SuperAdminDashboardContent activeTab="campuses" setError={jest.fn()} setNotice={jest.fn()} />
    </MemoryRouter>,
  );

  fireEvent.change(screen.getByLabelText("Campus name"), { target: { value: "New Campus" } });
  fireEvent.click(screen.getByRole("button", { name: "Add campus" }));
  const dialog = await screen.findByRole("dialog", { name: "Confirm your identity" });
  expect(global.fetch).not.toHaveBeenCalledWith(
    `${API_URL}/campuses`,
    expect.objectContaining({ method: "POST" }),
  );

  fireEvent.change(within(dialog).getByLabelText("Current Super Admin password"), {
    target: { value: "ValidAdminPassword1!" },
  });
  fireEvent.click(within(dialog).getByRole("button", { name: "Confirm" }));

  await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(
    `${API_URL}/campuses`,
    expect.objectContaining({
      method: "POST",
      body: JSON.stringify({
        name: "New Campus",
        code: "",
        current_password: "ValidAdminPassword1!",
      }),
    }),
  ));
});

test("campus activation changes require password confirmation", async () => {
  global.fetch = jest.fn(async (input, options = {}) => {
    const url = new URL(String(input));
    if (url.pathname.endsWith("/super-admin/overview")) {
      return { ok: true, json: async () => ({ totals: {}, campuses: [] }) };
    }
    if (url.pathname.endsWith("/super-admin/campuses")) {
      return { ok: true, json: async () => [{
        id: 1,
        name: "Alpha Campus",
        code: "ALPHA",
        is_active: false,
      }] };
    }
    if (url.pathname.endsWith("/campuses/1/status") && options.method === "PATCH") {
      return { ok: true, json: async () => ({ id: 1, name: "Alpha Campus", is_active: true }) };
    }
    return { ok: true, json: async () => [] };
  });

  render(
    <MemoryRouter>
      <SuperAdminDashboardContent activeTab="campuses" setError={jest.fn()} setNotice={jest.fn()} />
    </MemoryRouter>,
  );

  fireEvent.click(await screen.findByRole("button", { name: "Activate" }));
  const dialog = await screen.findByRole("dialog", { name: "Confirm your identity" });
  fireEvent.change(within(dialog).getByLabelText("Current Super Admin password"), {
    target: { value: "ValidAdminPassword1!" },
  });
  fireEvent.click(within(dialog).getByRole("button", { name: "Confirm" }));

  await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(
    `${API_URL}/campuses/1/status`,
    expect.objectContaining({
      method: "PATCH",
      body: JSON.stringify({ is_active: true, current_password: "ValidAdminPassword1!" }),
    }),
  ));
});

test("campus administrator creation requires current-password confirmation", async () => {
  global.fetch = jest.fn(async (input, options = {}) => {
    const url = new URL(String(input));
    if (url.pathname.endsWith("/super-admin/overview")) {
      return { ok: true, json: async () => ({ totals: {}, campuses: [] }) };
    }
    if (url.pathname.endsWith("/super-admin/campuses")) {
      return { ok: true, json: async () => [{ id: 1, name: "Alpha Campus", is_active: true }] };
    }
    if (url.pathname.endsWith("/super-admin/admins") && options.method === "POST") {
      return { ok: true, json: async () => ({ id: 11, name: "Campus Manager" }) };
    }
    if (url.pathname.endsWith("/super-admin/admins")) {
      return { ok: true, json: async () => [] };
    }
    return { ok: true, json: async () => [] };
  });

  render(
    <MemoryRouter>
      <SuperAdminDashboardContent activeTab="admins" setError={jest.fn()} setNotice={jest.fn()} />
    </MemoryRouter>,
  );

  fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Campus Manager" } });
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "manager@example.edu" } });
  fireEvent.change(screen.getByLabelText("Initial password"), { target: { value: "InitialPassword1!" } });
  const createForm = screen.getByRole("button", { name: "Create Campus Admin" }).closest("form");
  await within(createForm).findByRole("option", { name: "Alpha Campus" });
  fireEvent.change(within(createForm).getByLabelText("Campus"), { target: { value: "1" } });
  fireEvent.click(screen.getByRole("button", { name: "Create Campus Admin" }));
  const dialog = await screen.findByRole("dialog", { name: "Confirm your identity" });
  expect(global.fetch).not.toHaveBeenCalledWith(
    `${API_URL}/super-admin/admins`,
    expect.objectContaining({ method: "POST" }),
  );

  fireEvent.change(within(dialog).getByLabelText("Current Super Admin password"), {
    target: { value: "ValidAdminPassword1!" },
  });
  fireEvent.click(within(dialog).getByRole("button", { name: "Confirm" }));

  await waitFor(() => {
    const createRequest = global.fetch.mock.calls.find(([input, options = {}]) => (
      new URL(String(input)).pathname.endsWith("/super-admin/admins")
      && options.method === "POST"
    ));
    expect(createRequest).toBeDefined();
    expect(JSON.parse(createRequest[1].body)).toMatchObject({
      name: "Campus Manager",
      email: "manager@example.edu",
      password: "InitialPassword1!",
      campus_id: 1,
      current_password: "ValidAdminPassword1!",
    });
  });
});

test("reactivating a Campus Admin requires password confirmation", async () => {
  let activated = false;
  global.fetch = jest.fn(async (input, options = {}) => {
    const url = new URL(String(input));
    if (url.pathname.endsWith("/super-admin/overview")) {
      return { ok: true, json: async () => ({ totals: {}, campuses: [] }) };
    }
    if (url.pathname.endsWith("/super-admin/campuses")) {
      return { ok: true, json: async () => [{ id: 1, name: "Alpha Campus", is_active: true }] };
    }
    if (url.pathname.endsWith("/super-admin/admins/11/activate") && options.method === "POST") {
      activated = true;
      return { ok: true, json: async () => ({ id: 11, is_active: true }) };
    }
    if (url.pathname.endsWith("/super-admin/admins")) {
      return {
        ok: true,
        json: async () => [{
          id: 11,
          name: "Campus Manager",
          email: "manager@example.edu",
          role: "campus_admin",
          campus_id: 1,
          campus: "Alpha Campus",
          is_active: activated,
          is_deactivated: !activated,
        }],
      };
    }
    return { ok: true, json: async () => [] };
  });

  render(
    <MemoryRouter>
      <SuperAdminDashboardContent activeTab="admins" setError={jest.fn()} setNotice={jest.fn()} />
    </MemoryRouter>,
  );

  fireEvent.click(await screen.findByRole("button", { name: "Activate" }));
  const dialog = await screen.findByRole("dialog", { name: "Confirm your identity" });
  expect(global.fetch.mock.calls.some(([input, options = {}]) => (
    new URL(String(input)).pathname.endsWith("/super-admin/admins/11/activate")
    && options.method === "POST"
  ))).toBe(false);

  fireEvent.change(within(dialog).getByLabelText("Current Super Admin password"), {
    target: { value: "ValidAdminPassword1!" },
  });
  fireEvent.click(within(dialog).getByRole("button", { name: "Confirm" }));

  await waitFor(() => {
    const activationRequest = global.fetch.mock.calls.find(([input, options = {}]) => (
      new URL(String(input)).pathname.endsWith("/super-admin/admins/11/activate")
      && options.method === "POST"
    ));
    expect(activationRequest).toBeDefined();
    expect(JSON.parse(activationRequest[1].body)).toEqual({
      current_password: "ValidAdminPassword1!",
    });
  });
  expect(await screen.findByText("Active")).toBeInTheDocument();
});

test("deactivating a Campus Admin requires password confirmation", async () => {
  let deactivated = false;
  global.fetch = jest.fn(async (input, options = {}) => {
    const url = new URL(String(input));
    if (url.pathname.endsWith("/super-admin/overview")) {
      return { ok: true, json: async () => ({ totals: {}, campuses: [] }) };
    }
    if (url.pathname.endsWith("/super-admin/campuses")) {
      return { ok: true, json: async () => [{ id: 1, name: "Alpha Campus", is_active: true }] };
    }
    if (url.pathname.endsWith("/super-admin/admins/11") && options.method === "PUT") {
      deactivated = true;
      return { ok: true, json: async () => ({ id: 11, is_active: false }) };
    }
    if (url.pathname.endsWith("/super-admin/admins")) {
      return {
        ok: true,
        json: async () => [{
          id: 11,
          name: "Campus Manager",
          email: "manager@example.edu",
          role: "campus_admin",
          campus_id: 1,
          campus: "Alpha Campus",
          is_active: !deactivated,
          is_deactivated: deactivated,
        }],
      };
    }
    return { ok: true, json: async () => [] };
  });

  render(
    <MemoryRouter>
      <SuperAdminDashboardContent activeTab="admins" setError={jest.fn()} setNotice={jest.fn()} />
    </MemoryRouter>,
  );

  fireEvent.click(await screen.findByRole("button", { name: "Deactivate" }));
  const dialog = await screen.findByRole("dialog", { name: "Confirm your identity" });
  expect(global.fetch.mock.calls.some(([input, options = {}]) => (
    new URL(String(input)).pathname.endsWith("/super-admin/admins/11")
    && options.method === "PUT"
  ))).toBe(false);

  fireEvent.change(within(dialog).getByLabelText("Current Super Admin password"), {
    target: { value: "ValidAdminPassword1!" },
  });
  fireEvent.click(within(dialog).getByRole("button", { name: "Confirm" }));

  await waitFor(() => {
    const deactivationRequest = global.fetch.mock.calls.find(([input, options = {}]) => (
      new URL(String(input)).pathname.endsWith("/super-admin/admins/11")
      && options.method === "PUT"
    ));
    expect(deactivationRequest).toBeDefined();
    expect(JSON.parse(deactivationRequest[1].body)).toEqual({
      is_active: false,
      current_password: "ValidAdminPassword1!",
    });
  });
  expect(await screen.findByText("Inactive")).toBeInTheDocument();
});

test("Admin Management shows campus assignments as fixed and filters read-only Department Admins by campus", async () => {
  global.fetch = jest.fn(async (input) => {
    const url = new URL(String(input));
    if (url.pathname.endsWith("/super-admin/overview")) {
      return { ok: true, json: async () => ({ totals: {}, campuses: [] }) };
    }
    if (url.pathname.endsWith("/super-admin/campuses")) {
      return { ok: true, json: async () => [
        { id: 1, name: "Alpha Campus", is_active: true },
        { id: 2, name: "Beta Campus", is_active: true },
      ] };
    }
    if (url.pathname.endsWith("/super-admin/admins")) {
      return { ok: true, json: async () => [{
        id: 10,
        name: "Campus Manager",
        email: "manager@example.edu",
        role: "campus_admin",
        campus_id: 1,
        campus: "Alpha Campus",
        is_active: true,
      }] };
    }
    if (url.pathname.endsWith("/super-admin/department-admins")) {
      return { ok: true, json: async () => [
        { id: 20, name: "Alpha Dept Admin", email: "alpha@example.edu", campus_id: 1, campus: "Alpha Campus", department: "Engineering", is_active: true },
        { id: 21, name: "Beta Dept Admin", email: "beta@example.edu", campus_id: 2, campus: "Beta Campus", department: "Arts", is_active: true },
      ] };
    }
    return { ok: true, json: async () => [] };
  });

  render(
    <MemoryRouter>
      <SuperAdminDashboardContent activeTab="admins" setError={jest.fn()} setNotice={jest.fn()} />
    </MemoryRouter>,
  );

  expect(await screen.findByText("Campus Manager")).toBeInTheDocument();
  expect(screen.getByText("Campus Admin")).toBeInTheDocument();
  expect(screen.queryByRole("combobox", { name: "Campus for Campus Manager" })).not.toBeInTheDocument();
  expect(await screen.findByText("Alpha Dept Admin")).toBeInTheDocument();
  expect(screen.getByText("Beta Dept Admin")).toBeInTheDocument();
  const departmentAdminSection = screen.getByRole("heading", { name: "Department Administrators" }).closest("section");
  expect(within(departmentAdminSection).queryByRole("button")).not.toBeInTheDocument();
  expect(within(departmentAdminSection).queryByRole("combobox", { name: "Filter Department Admins by campus" })).toBeInTheDocument();

  fireEvent.change(screen.getByRole("combobox", { name: "Filter Department Admins by campus" }), {
    target: { value: "1" },
  });
  expect(screen.getByText("Alpha Dept Admin")).toBeInTheDocument();
  expect(screen.queryByText("Beta Dept Admin")).not.toBeInTheDocument();
});
