import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import SetPassword from "./SetPassword";

beforeEach(() => {
  window.history.replaceState({}, "", "/set-password?token=faculty-setup-token-123456789012345678901234567890");
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ message: "Your password has been set." }),
  });
});

afterEach(() => {
  delete global.fetch;
  localStorage.removeItem("token");
  localStorage.removeItem("must_change_password");
});

test("faculty must change the temporary password immediately after first login", async () => {
  window.history.replaceState({}, "", "/set-password?force=1");
  localStorage.setItem("token", "faculty-session-token");
  localStorage.setItem("must_change_password", "true");

  render(
    <MemoryRouter initialEntries={["/set-password?force=1"]}>
      <Routes>
        <Route path="/set-password" element={<SetPassword />} />
      </Routes>
    </MemoryRouter>,
  );

  expect(screen.getByRole("heading", { name: "Change your temporary password now" })).toBeInTheDocument();
  expect(screen.getByText(/must complete this change before you can access BloomQuest/i)).toBeInTheDocument();
  expect(screen.queryByLabelText("Temporary password")).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("New password"), { target: { value: "PermanentPassword2!" } });
  fireEvent.change(screen.getByLabelText("Confirm new password"), { target: { value: "PermanentPassword2!" } });
  fireEvent.click(screen.getByRole("button", { name: "Set password" }));

  await waitFor(() => {
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/user/initial-password/change"),
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer faculty-session-token" }),
        body: JSON.stringify({ new_password: "PermanentPassword2!" }),
      }),
    );
  });
  expect(await screen.findByRole("heading", { name: "Password set successfully" })).toBeInTheDocument();
  expect(localStorage.getItem("must_change_password")).toBeNull();
  expect(screen.getByRole("link", { name: "Continue to BloomQuest" })).toHaveAttribute("href", "/dashboard");
});

test("faculty can set a permanent password using the email token and temporary password", async () => {
  render(
    <MemoryRouter initialEntries={["/set-password"]}>
      <Routes>
        <Route path="/set-password" element={<SetPassword />} />
      </Routes>
    </MemoryRouter>,
  );

  fireEvent.change(screen.getByLabelText("Temporary password"), { target: { value: "FacultyPassword1!" } });
  fireEvent.change(screen.getByLabelText("New password"), { target: { value: "PermanentPassword2!" } });
  fireEvent.change(screen.getByLabelText("Confirm new password"), { target: { value: "PermanentPassword2!" } });
  fireEvent.click(screen.getByRole("button", { name: "Set password" }));

  await waitFor(() => {
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/set-initial-password"),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          token: "faculty-setup-token-123456789012345678901234567890",
          temporary_password: "FacultyPassword1!",
          new_password: "PermanentPassword2!",
        }),
      }),
    );
  });
  expect(await screen.findByRole("heading", { name: "Password set successfully" })).toBeInTheDocument();
});

test("password visibility controls toggle each password field independently", () => {
  render(
    <MemoryRouter initialEntries={["/set-password"]}>
      <Routes>
        <Route path="/set-password" element={<SetPassword />} />
      </Routes>
    </MemoryRouter>,
  );

  const temporaryPassword = screen.getByLabelText("Temporary password");
  const newPassword = screen.getByLabelText("New password");
  const confirmPassword = screen.getByLabelText("Confirm new password");

  expect(temporaryPassword).toHaveAttribute("type", "password");
  expect(newPassword).toHaveAttribute("type", "password");
  expect(confirmPassword).toHaveAttribute("type", "password");

  fireEvent.click(screen.getByRole("button", { name: "Show new password" }));
  expect(newPassword).toHaveAttribute("type", "text");
  expect(temporaryPassword).toHaveAttribute("type", "password");
  expect(confirmPassword).toHaveAttribute("type", "password");

  fireEvent.click(screen.getByRole("button", { name: "Hide new password" }));
  expect(newPassword).toHaveAttribute("type", "password");
});
