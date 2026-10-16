import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { PopupProvider } from "../../components/PopupProvider";
import AdminDashboard from "./admindashboard";
import { API_URL } from "../../config/api";

jest.mock("./SuperAdminDashboard", () => ({
  SuperAdminDashboardContent: ({ activeTab }) => (
    <div data-testid="super-admin-content">{activeTab}</div>
  ),
}));

jest.mock("./CampusAdminOverview", () => () => <div>Campus overview content</div>);

const setupDashboard = (role, path = "/admin/dashboard", fullName = "") => {
  window.history.pushState({}, "", path);
  localStorage.clear();
  localStorage.setItem("role", role);
  localStorage.setItem("token", "test-token");
  if (fullName) localStorage.setItem("name", fullName);
  global.fetch = jest.fn(async () => ({
    ok: true,
    json: async () => [],
  }));

  render(
    <MemoryRouter initialEntries={[path]}>
      <PopupProvider>
        <AdminDashboard />
      </PopupProvider>
    </MemoryRouter>,
  );
};

afterEach(() => {
  localStorage.clear();
});

test("renders Super Admin content and dispatches role-specific sections", () => {
  setupDashboard("super_admin", "/super-admin/dashboard", "Alex Superadmin");

  expect(screen.getByText("UNIVERSITY WORKSPACE")).toBeInTheDocument();
  expect(screen.getByTestId("super-admin-content")).toHaveTextContent("dashboard");

  [
    ["Campus Management", "campuses"],
    ["Admin Management", "admins"],
    ["Global Users", "users"],
    ["Academic Management", "academic"],
    ["Question Bank", "questions"],
    ["AI Usage", "ai_usage"],
    ["Activity Logs", "activity"],
  ].forEach(([label, contentTab]) => {
    fireEvent.click(screen.getByRole("button", { name: label }));
    expect(screen.getByTestId("super-admin-content")).toHaveTextContent(contentTab);
    expect(screen.getByRole("heading", { level: 1, name: label })).toBeInTheDocument();
  });

  fireEvent.click(screen.getByRole("button", { name: "Settings" }));
  expect(screen.getByRole("heading", { level: 1, name: "Settings" })).toBeInTheDocument();
  expect(screen.getByText("Alex Superadmin")).toBeInTheDocument();
  expect(screen.getByText("Super administrator")).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Profile" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Security" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Appearance" })).toBeInTheDocument();
  expect(screen.getByLabelText("Role")).toHaveValue("Super administrator");
  expect(screen.queryByTestId("super-admin-content")).not.toBeInTheDocument();

  expect(global.fetch).not.toHaveBeenCalled();
});

test("Super Admin confirms through the current email before verifying the new email", async () => {
  setupDashboard("super_admin", "/super-admin/dashboard", "Alex Superadmin");
  global.fetch.mockImplementation(async (url) => ({
    ok: true,
    json: async () => String(url).endsWith("/email-change/confirm")
      ? { email: "alex.new@example.edu" }
      : { message: "Confirmation completed." },
  }));

  fireEvent.click(screen.getByRole("button", { name: "Settings" }));
  expect(screen.getByLabelText("Email address")).toHaveValue("admin@bloomquest.edu");
  expect(screen.queryByLabelText("New email address")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Change password" })).toHaveClass("bq-admin-action");
  expect(screen.getByRole("button", { name: "Update email address" })).toHaveClass("bq-admin-action");
  fireEvent.click(screen.getByRole("button", { name: "Update email address" }));
  expect(screen.getByRole("dialog", { name: "Update Email Address" })).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("New email address"), {
    target: { value: "alex.new@example.edu" },
  });
  expect(screen.getByLabelText("Current password")).toHaveAttribute("type", "password");
  fireEvent.click(screen.getByRole("button", { name: "Show current password" }));
  expect(screen.getByLabelText("Current password")).toHaveAttribute("type", "text");
  fireEvent.click(screen.getByRole("button", { name: "Hide current password" }));
  expect(screen.getByLabelText("Current password")).toHaveAttribute("type", "password");
  fireEvent.change(screen.getByLabelText("Current password"), {
    target: { value: "ValidAdminPassword1!" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Send confirmation code" }));

  expect(await screen.findByLabelText("Current email confirmation code")).toBeInTheDocument();
  const request = global.fetch.mock.calls.find(([url]) => String(url).endsWith("/email-change/request-otp"));
  expect(JSON.parse(request[1].body)).toEqual({
    new_email: "alex.new@example.edu",
    current_password: "ValidAdminPassword1!",
  });
  expect(request[1].headers.Authorization).toBeTruthy();

  fireEvent.change(screen.getByLabelText("Current email confirmation code"), {
    target: { value: "123456" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Confirm email change request" }));

  await waitFor(() => {
    const confirmation = global.fetch.mock.calls.find(([url]) => String(url).endsWith("/email-change/confirm-current-email"));
    expect(JSON.parse(confirmation[1].body)).toEqual({
      current_email_confirmation_code: "123456",
    });
  });

  expect(await screen.findByLabelText("New email verification code")).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("New email verification code"), {
    target: { value: "654321" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Verify new email and update" }));

  await waitFor(() => {
    const confirmation = global.fetch.mock.calls.find(([url]) => String(url).endsWith("/email-change/confirm"));
    expect(JSON.parse(confirmation[1].body)).toEqual({
      new_email_otp: "654321",
    });
  });
  expect(await screen.findByLabelText("Email address")).toHaveValue("alex.new@example.edu");
  expect(localStorage.getItem("email")).toBe("alex.new@example.edu");
  expect(screen.getByText("alex.new@example.edu")).toBeInTheDocument();
});

test("Super Admin can show and hide each password in the Change Password modal", () => {
  setupDashboard("super_admin", "/super-admin/dashboard");

  fireEvent.click(screen.getByRole("button", { name: "Settings" }));
  fireEvent.click(screen.getByRole("button", { name: "Change password" }));

  ["Current Password", "New Password", "Confirm New Password"].forEach((label) => {
    const input = screen.getByLabelText(label);
    expect(input).toHaveAttribute("type", "password");
    fireEvent.click(screen.getByRole("button", { name: `Show ${label.toLowerCase()}` }));
    expect(input).toHaveAttribute("type", "text");
    fireEvent.click(screen.getByRole("button", { name: `Hide ${label.toLowerCase()}` }));
    expect(input).toHaveAttribute("type", "password");
  });
});

test("Super Admin password changes require an email verification code", async () => {
  setupDashboard("super_admin", "/super-admin/dashboard");
  global.fetch.mockImplementation(async (url) => ({
    ok: true,
    json: async () => String(url).endsWith("/request-otp")
      ? { message: "A verification code was sent to your email address." }
      : { message: "Password updated successfully." },
  }));

  fireEvent.click(screen.getByRole("button", { name: "Settings" }));
  fireEvent.click(screen.getByRole("button", { name: "Change password" }));
  fireEvent.change(screen.getByLabelText("Current Password"), {
    target: { value: "ValidAdminPassword1!" },
  });
  fireEvent.change(screen.getByLabelText("New Password"), {
    target: { value: "ChangedAdminPassword2!" },
  });
  fireEvent.change(screen.getByLabelText("Confirm New Password"), {
    target: { value: "ChangedAdminPassword2!" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Send verification code" }));

  const otpInput = await screen.findByLabelText("Email verification code");
  const request = global.fetch.mock.calls.find(([url]) => String(url).endsWith("/request-otp"));
  expect(request[0]).toBe(`${API_URL}/user/change-password/request-otp`);
  expect(JSON.parse(request[1].body)).toEqual({
    email: "admin@bloomquest.edu",
    current_password: "ValidAdminPassword1!",
    new_password: "ChangedAdminPassword2!",
  });

  fireEvent.change(otpInput, { target: { value: "123456" } });
  fireEvent.click(screen.getByRole("button", { name: "Verify and update password" }));

  await waitFor(() => {
    const update = global.fetch.mock.calls.find(([url]) => String(url).endsWith("/change-password/update"));
    expect(update[0]).toBe(`${API_URL}/user/change-password/update`);
    expect(update[1].method).toBe("PATCH");
    expect(JSON.parse(update[1].body)).toEqual({
      email: "admin@bloomquest.edu",
      current_password: "ValidAdminPassword1!",
      new_password: "ChangedAdminPassword2!",
      otp: "123456",
    });
  });
  expect(await screen.findByText("Password updated successfully.")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "OK" }));
  await waitFor(() => {
    expect(screen.queryByRole("dialog", { name: "Change Password" })).not.toBeInTheDocument();
  });
});

test.each([
  ["/super-admin/academic/campus/1", "academic"],
  ["/super-admin/questions", "questions"],
])("selects the Super Admin content for deep link %s", (path, contentTab) => {
  setupDashboard("super_admin", path);

  expect(screen.getByTestId("super-admin-content")).toHaveTextContent(contentTab);
  expect(window.location.pathname).toBe(path);
});

test.each(["campus_admin", "admin"])(
  "%s keeps Campus Admin content and does not mount Super Admin content",
  async (role) => {
    setupDashboard(role);

    expect(screen.getByText("Campus overview content")).toBeInTheDocument();
    expect(screen.queryByTestId("super-admin-content")).not.toBeInTheDocument();

    expect(global.fetch.mock.calls.some(([url]) => String(url) === `${API_URL}/departments`)).toBe(true);
    expect(global.fetch).not.toHaveBeenCalledWith(
      expect.stringContaining("/super-admin/"),
      expect.anything(),
    );
  },
);

test("keeps Department Admin content separate and does not mount Super Admin content", () => {
  setupDashboard("department_admin", "/admin/academic");

  expect(screen.getByText("DEPARTMENT OVERVIEW")).toBeInTheDocument();
  expect(screen.queryByTestId("super-admin-content")).not.toBeInTheDocument();
  expect(global.fetch).not.toHaveBeenCalledWith(
    expect.stringContaining("/super-admin/"),
    expect.anything(),
  );
  expect(global.fetch).not.toHaveBeenCalledWith(
    `${API_URL}/departments`,
    expect.anything(),
  );
});

test("does not expose dashboard features or load dashboard data for an unrelated role", () => {
  setupDashboard("faculty");

  expect(screen.queryByTestId("super-admin-content")).not.toBeInTheDocument();
  expect(screen.queryByText("Campus overview content")).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "User Management" })).not.toBeInTheDocument();
  expect(global.fetch).not.toHaveBeenCalled();
});
