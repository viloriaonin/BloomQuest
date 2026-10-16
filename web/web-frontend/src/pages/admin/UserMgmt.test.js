import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { PopupProvider } from "../../components/PopupProvider";
import { UserMgmtContent } from "./UserMgmt";

beforeEach(() => {
  localStorage.setItem("role", "campus_admin");
  global.fetch = jest.fn(async (url) => {
    if (String(url).endsWith("/campus-admin/faculty-accounts")) {
      return {
        ok: true,
        json: async () => ({ email: "new.faculty@example.edu", email_status: "sent" }),
      };
    }
    if (String(url).endsWith("/campus-admin/department-admins")) {
      return {
        ok: true,
        json: async () => ({
          email: "dean@example.edu",
          department: "Computing",
          email_status: "demo",
          demo_temporary_password: "DemoDeanPassword1!",
          demo_setup_url: "https://demo.example.edu/set-password?token=demo-token",
        }),
      };
    }
    if (String(url).endsWith("/contact-admin/users")) {
      return {
        ok: true,
        json: async () => [
          {
            id: 1,
            full_name: "Active Faculty",
            email: "active@example.edu",
            role: "faculty",
            is_active: true,
          },
          {
            id: 2,
            full_name: "Archived Faculty",
            email: "archived@example.edu",
            role: "faculty",
            archived: true,
          },
        ],
      };
    }
    if (String(url).endsWith("/academic-hierarchy")) {
      return {
        ok: true,
        json: async () => ({
          campuses: [{
            id: 3,
            name: "Main Campus",
            departments: [{
              id: 7,
              name: "Computing",
              programs: [
                { id: 11, name: "Computer Science" },
                { id: 12, name: "Information Technology" },
              ],
            }],
          }],
        }),
      };
    }
    return { ok: true, json: async () => [] };
  });
});

afterEach(() => {
  delete global.fetch;
  localStorage.removeItem("role");
});

test("Campus Admin user management only shows active and archived account views", async () => {
  render(
    <MemoryRouter>
      <PopupProvider>
        <UserMgmtContent />
      </PopupProvider>
    </MemoryRouter>,
  );

  expect(await screen.findByText("Active Faculty")).toBeInTheDocument();
  const tabs = await screen.findByRole("tablist", { name: "User management sections" });
  expect(screen.getByRole("tab", { name: "Active users (1)" })).toBeInTheDocument();
  expect(screen.getByRole("tab", { name: "Archived users (1)" })).toBeInTheDocument();
  expect(screen.queryByRole("tab", { name: /Pending requests/ })).not.toBeInTheDocument();
  expect(screen.queryByRole("tab", { name: /User requests/ })).not.toBeInTheDocument();
  expect(screen.queryByText("Pending review")).not.toBeInTheDocument();
  expect(tabs).toBeInTheDocument();
  expect(screen.getByText("Manage active and archived user accounts.")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Add faculty member" })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Add dean" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Filter" })).not.toBeInTheDocument();
  expect(screen.queryByPlaceholderText("Search users, email, department, or program...")).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Clear filters" })).not.toBeInTheDocument();
  expect(screen.getByLabelText("Filter users by role")).toBeInTheDocument();
  expect(screen.getByLabelText("Filter users by department")).toBeInTheDocument();

  await waitFor(() => {
    expect(global.fetch).not.toHaveBeenCalledWith(expect.stringContaining("/contact-admin/pending"), expect.anything());
    expect(global.fetch).not.toHaveBeenCalledWith(expect.stringContaining("/admin/user-change-requests"), expect.anything());
  });

  fireEvent.click(screen.getByRole("tab", { name: "Archived users (1)" }));
  expect(await screen.findByText("Archived Faculty")).toBeInTheDocument();

  fireEvent.click(screen.getByRole("tab", { name: "Active users (1)" }));
  expect(screen.queryByRole("button", { name: "Add faculty member" })).not.toBeInTheDocument();
});

test("Campus Admin role filter shows Program only for faculty and scopes matching users", async () => {
  const defaultFetch = global.fetch.getMockImplementation();
  global.fetch.mockImplementation(async (url, options) => {
    if (String(url).endsWith("/contact-admin/users")) {
      return {
        ok: true,
        json: async () => [
          {
            id: 10,
            full_name: "Faculty Example",
            email: "faculty@example.edu",
            role: "faculty",
            department: "Computing",
            program: "Information Technology",
            is_active: true,
          },
          {
            id: 11,
            full_name: "Dean Example",
            email: "dean@example.edu",
            role: "department_dean",
            department: "Computing",
            program: "N/A",
            is_active: true,
          },
        ],
      };
    }
    return defaultFetch(url, options);
  });

  render(
    <MemoryRouter>
      <PopupProvider>
        <UserMgmtContent />
      </PopupProvider>
    </MemoryRouter>,
  );

  expect(screen.queryByRole("button", { name: "Filter" })).not.toBeInTheDocument();
  expect(screen.queryByPlaceholderText("Search users, email, department, or program...")).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Clear filters" })).not.toBeInTheDocument();
  const roleFilter = screen.getByRole("combobox", { name: "Filter users by role" });
  expect(screen.getByLabelText("Filter users by department")).toBeInTheDocument();
  expect(screen.getByRole("option", { name: "Faculty" })).toBeInTheDocument();
  expect(screen.getByRole("option", { name: "Department dean" })).toBeInTheDocument();
  expect(screen.queryByLabelText("Program")).not.toBeInTheDocument();

  fireEvent.change(roleFilter, { target: { value: "faculty" } });
  expect(screen.getByLabelText("Program")).toBeInTheDocument();
  expect(await screen.findByText("Faculty Example")).toBeInTheDocument();
  expect(screen.queryByText("Dean Example")).not.toBeInTheDocument();

  fireEvent.change(roleFilter, { target: { value: "department_dean" } });
  expect(screen.queryByLabelText("Program")).not.toBeInTheDocument();
  expect(await screen.findByText("Dean Example")).toBeInTheDocument();
  expect(screen.queryByText("Faculty Example")).not.toBeInTheDocument();
});

test("Campus Admin can create a Department Admin dean account for a department", async () => {
  render(
    <MemoryRouter>
      <PopupProvider>
        <UserMgmtContent />
      </PopupProvider>
    </MemoryRouter>,
  );

  fireEvent.click(await screen.findByRole("button", { name: "Add dean" }));
  expect(await screen.findByRole("heading", { name: "Add a department dean" })).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Full name"), { target: { value: "Dean Example" } });
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "dean@example.edu" } });
  fireEvent.change(screen.getByLabelText("Department for dean"), { target: { value: "7" } });
  fireEvent.click(screen.getByRole("button", { name: "Create dean account" }));

  expect(await screen.findByRole("heading", { name: "Dean sign-in details" })).toBeInTheDocument();
  expect(screen.getByText(/Email was not sent/)).toBeInTheDocument();
  const password = screen.getByTestId("dean-temporary-password");
  expect(password).toHaveTextContent("DemoDeanPassword1!");
  expect(password).toHaveClass("blur-sm");
  fireEvent.click(screen.getByRole("button", { name: "Show dean temporary password" }));
  expect(password).not.toHaveClass("blur-sm");
  fireEvent.click(screen.getByRole("button", { name: "Blur dean temporary password" }));
  expect(password).toHaveClass("blur-sm");
  expect(screen.getByRole("link", { name: "https://demo.example.edu/set-password?token=demo-token" })).toBeInTheDocument();
  const request = global.fetch.mock.calls.find(
    ([url, options]) => String(url).endsWith("/campus-admin/department-admins") && options?.method === "POST",
  );
  expect(JSON.parse(request[1].body)).toEqual({
    full_name: "Dean Example",
    email: "dean@example.edu",
    department_id: 7,
  });
});

test("newly created dean appears in the active user list", async () => {
  let deanCreated = false;
  const defaultFetch = global.fetch.getMockImplementation();
  global.fetch.mockImplementation(async (url, options) => {
    if (String(url).endsWith("/campus-admin/department-admins") && options?.method === "POST") {
      deanCreated = true;
      return {
        ok: true,
        json: async () => ({
          id: 3,
          name: "Dean Example",
          email: "dean@example.edu",
          role: "department_admin",
          department: "Computing",
          email_status: "sent",
        }),
      };
    }
    if (String(url).endsWith("/contact-admin/users")) {
      return {
        ok: true,
        json: async () => deanCreated
          ? [{
            id: 3,
            full_name: "Dean Example",
            email: "dean@example.edu",
            role: "department_admin",
            is_department_dean: true,
            department: "Computing",
            status: "Active",
            archived: false,
          }]
          : [],
      };
    }
    return defaultFetch(url, options);
  });

  render(
    <MemoryRouter>
      <PopupProvider>
        <UserMgmtContent />
      </PopupProvider>
    </MemoryRouter>,
  );

  fireEvent.click(await screen.findByRole("button", { name: "Add dean" }));
  fireEvent.change(screen.getByLabelText("Full name"), { target: { value: "Dean Example" } });
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "dean@example.edu" } });
  fireEvent.change(screen.getByLabelText("Department for dean"), { target: { value: "7" } });
  fireEvent.click(screen.getByRole("button", { name: "Create dean account" }));

  expect(await screen.findByText("Dean Example")).toBeInTheDocument();
  expect(screen.getByText("Department Dean")).toBeInTheDocument();
  expect(screen.getByText("Active", { selector: "span" })).toBeInTheDocument();
});

test("Campus Admin does not see the add faculty action", async () => {
  render(
    <MemoryRouter>
      <PopupProvider>
        <UserMgmtContent />
      </PopupProvider>
    </MemoryRouter>,
  );

  expect(await screen.findByRole("button", { name: "Add dean" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Add faculty member" })).not.toBeInTheDocument();
});

test("Campus Admin can delete archived dean accounts only after entering their password", async () => {
  global.fetch.mockImplementation(async (url) => {
    if (String(url).endsWith("/contact-admin/users")) {
      return {
        ok: true,
        json: async () => ({
          active: [],
          archived: [
            {
              id: 3,
              full_name: "Archived Dean",
              email: "dean@example.edu",
              role: "department_admin",
              is_department_dean: true,
              archived: true,
            },
            {
              id: 4,
              full_name: "Archived Faculty",
              email: "faculty@example.edu",
              role: "faculty",
              archived: true,
            },
          ],
        }),
      };
    }
    return { ok: true, json: async () => ({}) };
  });

  render(
    <MemoryRouter>
      <PopupProvider>
        <UserMgmtContent />
      </PopupProvider>
    </MemoryRouter>,
  );

  fireEvent.click(await screen.findByRole("tab", { name: "Archived users (2)" }));
  expect(await screen.findByText("Archived Dean")).toBeInTheDocument();
  expect(screen.getByText("Archived Faculty")).toBeInTheDocument();
  expect(screen.getAllByRole("button", { name: "Delete" })).toHaveLength(1);
  fireEvent.click(screen.getByRole("button", { name: "Delete" }));

  expect(await screen.findByRole("heading", { name: "Delete department dean" })).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Admin password"), { target: { value: "AdminPassword1!" } });
  fireEvent.click(screen.getByRole("button", { name: "Verify and delete" }));

  await waitFor(() => {
    const deleteCall = global.fetch.mock.calls.find(
      ([url, options]) => String(url).endsWith("/users/dean%40example.edu/permanent") && options?.method === "DELETE",
    );
    expect(deleteCall).toBeDefined();
    expect(JSON.parse(deleteCall[1].body)).toEqual({
      email: "dean@example.edu",
      admin_password: "AdminPassword1!",
    });
  });
  fireEvent.click(await screen.findByRole("button", { name: "OK" }));
});
