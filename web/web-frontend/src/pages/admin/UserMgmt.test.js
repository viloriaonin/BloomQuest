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
          email_status: "sent",
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
  expect(screen.getByRole("button", { name: "Add faculty member" })).toBeInTheDocument();

  await waitFor(() => {
    expect(global.fetch).not.toHaveBeenCalledWith(expect.stringContaining("/contact-admin/pending"), expect.anything());
    expect(global.fetch).not.toHaveBeenCalledWith(expect.stringContaining("/admin/user-change-requests"), expect.anything());
  });

  fireEvent.click(screen.getByRole("tab", { name: "Archived users (1)" }));
  expect(await screen.findByText("Archived Faculty")).toBeInTheDocument();

  fireEvent.click(screen.getByRole("tab", { name: "Active users (1)" }));
  fireEvent.click(screen.getByRole("button", { name: "Add faculty member" }));
  fireEvent.change(screen.getByLabelText("Number for faculty member 1"), { target: { value: "000542" } });
  fireEvent.change(screen.getByLabelText("Full name for faculty member 1"), { target: { value: "New Faculty" } });
  fireEvent.change(screen.getByLabelText("Email for faculty member 1"), { target: { value: "new.faculty@example.edu" } });
  fireEvent.change(screen.getByLabelText("Department for faculty member 1"), { target: { value: "7" } });
  fireEvent.change(screen.getByLabelText("Program for faculty member 1"), { target: { value: "12" } });
  fireEvent.click(screen.getByRole("button", { name: "Add another" }));
  const secondNumber = screen.getByLabelText("Number for faculty member 2");
  fireEvent.change(secondNumber, { target: { value: "000543" } });
  fireEvent.change(screen.getByLabelText("Full name for faculty member 2"), { target: { value: "Second Faculty" } });
  fireEvent.change(screen.getByLabelText("Email for faculty member 2"), { target: { value: "second.faculty@example.edu" } });
  fireEvent.change(screen.getByLabelText("Department for faculty member 2"), { target: { value: "7" } });
  fireEvent.change(screen.getByLabelText("Program for faculty member 2"), { target: { value: "11" } });
  fireEvent.click(screen.getByRole("button", { name: "Create faculty accounts" }));

  await waitFor(() => {
    const creationCalls = global.fetch.mock.calls.filter(
      ([url, options]) => String(url).endsWith("/campus-admin/faculty-accounts") && options?.method === "POST",
    );
    expect(creationCalls).toHaveLength(2);
    expect(JSON.parse(creationCalls[0][1].body)).toEqual({
      full_name: "New Faculty",
      email: "new.faculty@example.edu",
      faculty_number: "000542",
      program_id: 12,
    });
    expect(JSON.parse(creationCalls[1][1].body)).toEqual({
      full_name: "Second Faculty",
      email: "second.faculty@example.edu",
      faculty_number: "000543",
      program_id: 11,
    });
  });
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
  fireEvent.change(screen.getByLabelText("Department"), { target: { value: "7" } });
  fireEvent.click(screen.getByRole("button", { name: "Create dean account" }));

  expect(await screen.findByRole("heading", { name: "Dean account created" })).toBeInTheDocument();
  const request = global.fetch.mock.calls.find(
    ([url, options]) => String(url).endsWith("/campus-admin/department-admins") && options?.method === "POST",
  );
  expect(JSON.parse(request[1].body)).toEqual({
    full_name: "Dean Example",
    email: "dean@example.edu",
    department_id: 7,
  });
});
