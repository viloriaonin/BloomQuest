import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { PopupProvider } from "../../components/PopupProvider";
import UserDetailPage from "./UserDetailPage";

beforeEach(() => {
  localStorage.setItem("token", "test-token");
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
