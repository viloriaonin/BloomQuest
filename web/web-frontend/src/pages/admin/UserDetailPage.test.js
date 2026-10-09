import { fireEvent, render, screen } from "@testing-library/react";
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

test("Campus Admin can reset a faculty password from the user profile", async () => {
  render(
    <MemoryRouter initialEntries={["/admin/users/8"]}>
      <PopupProvider>
        <Routes>
          <Route path="/admin/users/:userId" element={<UserDetailPage />} />
        </Routes>
      </PopupProvider>
    </MemoryRouter>,
  );

  fireEvent.click(await screen.findByRole("button", { name: "Reset password" }));
  expect(await screen.findByRole("dialog", { name: "Reset faculty password" })).toBeInTheDocument();
  expect(screen.getByText(/existing sessions signed out after the email is sent/)).toBeInTheDocument();
  expect(global.fetch).not.toHaveBeenCalledWith(
    expect.stringContaining("/campus-admin/users/8/credential-email"),
    expect.anything(),
  );

  fireEvent.click(screen.getByRole("button", { name: "Send reset email" }));
  expect(await screen.findByRole("status")).toHaveTextContent("The password reset email was sent to faculty@example.edu.");
  expect(global.fetch).toHaveBeenCalledWith(
    expect.stringContaining("/campus-admin/users/8/credential-email"),
    expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ action: "reset_password" }),
    }),
  );
});

test("Campus Admin can reset a department dean password from the user profile", async () => {
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

  fireEvent.click(await screen.findByRole("button", { name: "Show demo password" }));
  const temporaryPassword = await screen.findByText("DemoDeanPassword1!");
  expect(temporaryPassword).not.toHaveClass("blur-sm");
  fireEvent.click(screen.getByRole("button", { name: "Blur demo password" }));
  expect(temporaryPassword).toHaveClass("blur-sm");
  expect(global.fetch).toHaveBeenCalledWith(
    expect.stringContaining("/campus-admin/users/8/demo-password"),
    expect.objectContaining({ headers: expect.objectContaining({ Authorization: "Bearer test-token" }) }),
  );

  fireEvent.click(await screen.findByRole("button", { name: "Reset password" }));
  expect(await screen.findByRole("dialog", { name: "Reset dean password" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Send reset email" }));

  expect(await screen.findByRole("status")).toHaveTextContent("The password reset email was sent to dean@example.edu.");
  expect(global.fetch).toHaveBeenCalledWith(
    expect.stringContaining("/campus-admin/users/8/credential-email"),
    expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ action: "reset_password" }),
    }),
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
});
