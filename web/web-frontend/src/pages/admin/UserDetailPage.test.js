import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { PopupProvider } from "../../components/PopupProvider";
import UserDetailPage from "./UserDetailPage";

beforeEach(() => {
  localStorage.setItem("token", "test-token");
  localStorage.setItem("role", "campus_admin");
  global.fetch = jest.fn(async (url) => {
    if (String(url).endsWith("/admin/users/8/overview")) {
      return {
        ok: true,
        json: async () => ({
          user: {
            id: 8,
            name: "Faculty User",
            email: "faculty@example.edu",
            role: "faculty",
            department: "Computing",
            archived: false,
          },
          subjects: [],
          activities: [],
          question_count: 0,
        }),
      };
    }
    if (String(url).endsWith("/campus-admin/users/8/credential-email")) {
      return {
        ok: true,
        json: async () => ({
          message: "The password reset email was sent to faculty@example.edu.",
          email_status: "sent",
        }),
      };
    }
    return { ok: true, json: async () => [] };
  });
});

afterEach(() => {
  delete global.fetch;
  localStorage.removeItem("token");
  localStorage.removeItem("role");
});

test("Campus Admin cannot reset or reassign a faculty account", async () => {
  render(
    <MemoryRouter initialEntries={["/admin/users/8"]}>
      <PopupProvider>
        <Routes>
          <Route path="/admin/users/:userId" element={<UserDetailPage />} />
        </Routes>
      </PopupProvider>
    </MemoryRouter>,
  );

  await screen.findByText("Faculty User");
  expect(screen.queryByRole("button", { name: "Reset password" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Change department" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Change program assignment" })).not.toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "Manage department" })).not.toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "Manage program assignment" })).not.toBeInTheDocument();
  expect(global.fetch).not.toHaveBeenCalledWith(
    expect.stringContaining("/campus-admin/users/8/credential-email"),
    expect.anything(),
  );
});

test("Campus Admin can edit and resend an unopened faculty invitation", async () => {
  global.fetch.mockImplementation(async (url, options = {}) => {
    if (String(url).endsWith("/admin/users/8/overview")) {
      return {
        ok: true,
        json: async () => ({
          user: {
            id: 8,
            name: "New Faculty",
            email: "typo@example.edu",
            role: "faculty",
            department: "Computing",
            archived: false,
            can_edit_email: true,
            can_resend_invitation: true,
            invitation_resend_available_at: null,
          },
          subjects: [],
          activities: [],
          question_count: 0,
        }),
      };
    }
    if (String(url).endsWith("/campus-admin/users/8/email")) {
      return { ok: true, json: async () => ({ message: "Faculty email updated successfully." }) };
    }
    if (String(url).endsWith("/campus-admin/users/8/resend-invitation")) {
      return { ok: true, json: async () => ({ message: "Invitation email sent." }) };
    }
    return { ok: true, json: async () => [] };
  });

  render(
    <MemoryRouter initialEntries={["/admin/users/8"]}>
      <PopupProvider>
        <Routes>
          <Route path="/admin/users/:userId" element={<UserDetailPage />} />
        </Routes>
      </PopupProvider>
    </MemoryRouter>,
  );

  fireEvent.click(await screen.findByRole("button", { name: "Edit email" }));
  fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "correct@example.edu" } });
  fireEvent.click(screen.getByRole("button", { name: "Save email" }));
  await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(
    expect.stringContaining("/campus-admin/users/8/email"),
    expect.objectContaining({
      method: "PATCH",
      body: JSON.stringify({ email: "correct@example.edu" }),
    }),
  ));

  fireEvent.click(await screen.findByRole("button", { name: "Resend invitation" }));
  await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(
    expect.stringContaining("/campus-admin/users/8/resend-invitation"),
    expect.objectContaining({ method: "POST" }),
  ));
});

test("Campus Admin cannot edit email or resend after first faculty access", async () => {
  global.fetch.mockImplementation(async (url) => {
    if (String(url).endsWith("/admin/users/8/overview")) {
      return {
        ok: true,
        json: async () => ({
          user: {
            id: 8,
            name: "Opened Faculty",
            email: "faculty@example.edu",
            role: "faculty",
            department: "Computing",
            archived: false,
            first_login_at: "2026-10-17T12:00:00",
            can_edit_email: false,
            can_resend_invitation: false,
          },
          subjects: [],
          activities: [],
          question_count: 0,
        }),
      };
    }
    return { ok: true, json: async () => [] };
  });

  render(
    <MemoryRouter initialEntries={["/admin/users/8"]}>
      <PopupProvider>
        <Routes>
          <Route path="/admin/users/:userId" element={<UserDetailPage />} />
        </Routes>
      </PopupProvider>
    </MemoryRouter>,
  );

  await screen.findByText("Opened Faculty");
  expect(screen.queryByRole("button", { name: "Edit email" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Resend invitation" })).not.toBeInTheDocument();
  expect(screen.getByText(/disabled because this account has been opened/)).toBeInTheDocument();
});

test("Campus Admin cannot reset or reassign a department dean account", async () => {
  const defaultFetch = global.fetch.getMockImplementation();
  global.fetch.mockImplementation(async (url, options) => {
    if (String(url).endsWith("/admin/users/8/overview")) {
      return {
        ok: true,
        json: async () => ({
          user: {
            id: 8,
            name: "Dean User",
            email: "dean@example.edu",
            role: "department_dean",
            is_department_dean: true,
            demo_password_available: true,
            department: "Computing",
            archived: false,
          },
          subjects: [],
          activities: [],
          question_count: 0,
        }),
      };
    }
    if (String(url).endsWith("/campus-admin/users/8/credential-email")) {
      return {
        ok: true,
        json: async () => ({
          message: "The password reset email was sent to dean@example.edu.",
          email_status: "sent",
        }),
      };
    }
    if (String(url).endsWith("/campus-admin/users/8/demo-password")) {
      return {
        ok: true,
        json: async () => ({ temporary_password: "DemoDeanPassword1!" }),
      };
    }
    return defaultFetch(url, options);
  });

  render(
    <MemoryRouter initialEntries={["/admin/users/8"]}>
      <PopupProvider>
        <Routes>
          <Route path="/admin/users/:userId" element={<UserDetailPage />} />
        </Routes>
      </PopupProvider>
    </MemoryRouter>,
  );

  await screen.findByText("Dean User");
  expect(screen.queryByRole("button", { name: "Reset password" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Change department" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Change program assignment" })).not.toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "Manage department" })).not.toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "Manage program assignment" })).not.toBeInTheDocument();

  fireEvent.click(await screen.findByRole("button", { name: "Show demo password" }));
  const temporaryPassword = await screen.findByText("DemoDeanPassword1!");
  expect(temporaryPassword).not.toHaveClass("blur-sm");
  fireEvent.click(screen.getByRole("button", { name: "Blur demo password" }));
  expect(temporaryPassword).toHaveClass("blur-sm");
  expect(global.fetch).toHaveBeenCalledWith(
    expect.stringContaining("/campus-admin/users/8/demo-password"),
    expect.objectContaining({ headers: expect.objectContaining({ Authorization: "Bearer test-token" }) }),
  );

  expect(global.fetch).not.toHaveBeenCalledWith(
    expect.stringContaining("/campus-admin/users/8/credential-email"),
    expect.anything(),
  );
});

test("Campus Admin cannot reveal a non-dean account password", async () => {
  render(
    <MemoryRouter initialEntries={["/admin/users/8"]}>
      <PopupProvider>
        <Routes>
          <Route path="/admin/users/:userId" element={<UserDetailPage />} />
        </Routes>
      </PopupProvider>
    </MemoryRouter>,
  );

  await screen.findByText("Faculty User");
  expect(screen.queryByRole("button", { name: "Show demo password" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Archive account" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Delete account" })).not.toBeInTheDocument();
});

test("Campus Admin must enter their password before archiving a dean account", async () => {
  const defaultFetch = global.fetch.getMockImplementation();
  global.fetch.mockImplementation(async (url, options) => {
    if (String(url).endsWith("/admin/users/8/overview")) {
      return {
        ok: true,
        json: async () => ({
          user: {
            id: 8,
            name: "Dean User",
            email: "dean@example.edu",
            role: "department_admin",
            is_department_dean: true,
            department: "Computing",
            archived: false,
          },
          subjects: [],
          activities: [],
          question_count: 0,
        }),
      };
    }
    if (String(url).endsWith("/users/archive") && options?.method === "POST") {
      return { ok: true, json: async () => ({ status: "archived" }) };
    }
    return defaultFetch(url, options);
  });

  render(
    <MemoryRouter initialEntries={["/admin/users/8"]}>
      <PopupProvider>
        <Routes>
          <Route path="/admin/users/:userId" element={<UserDetailPage />} />
        </Routes>
      </PopupProvider>
    </MemoryRouter>,
  );

  fireEvent.click(await screen.findByRole("button", { name: "Archive account" }));
  fireEvent.click(await screen.findByRole("button", { name: "Confirm" }));
  expect(await screen.findByRole("heading", { name: "Verify to archive dean account" })).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Admin password"), { target: { value: "AdminPassword1!" } });
  fireEvent.click(screen.getByRole("button", { name: "Verify and continue" }));

  await waitFor(() => {
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/users/archive"),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ email: "dean@example.edu", admin_password: "AdminPassword1!" }),
      }),
    );
  });
  fireEvent.click(await screen.findByRole("button", { name: "OK" }));
});
