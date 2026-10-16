import { render, screen, waitFor } from "@testing-library/react";
import CampusAdminOverview from "./CampusAdminOverview";

jest.mock("react-chartjs-2", () => ({
  Bar: () => <div data-testid="bar-chart" />,
  Doughnut: () => <div data-testid="doughnut-chart" />,
}));

const departments = [{
  id: 9,
  name: "Engineering",
  programs: [
    {
      id: 30,
      name: "Computer Science",
      faculty: [
        { id: 1, name: "Alice Smith", email: "alice@example.com" },
        { id: 2, name: "Bob Jones", email: "bob@example.com" },
      ],
    },
    { id: 31, name: "Civil Engineering", faculty: [] },
  ],
}];

beforeEach(() => {
  global.fetch = jest.fn(async () => ({
    ok: true,
    json: async () => ({
      totals: {},
      campuses: [],
      bloom_distribution: {},
      question_type_distribution: {},
    }),
  }));
});

afterEach(() => {
  delete global.fetch;
});

test("shows question counts by program for a selected department and all programs", async () => {
  render(
    <CampusAdminOverview
      departments={departments}
      departmentId={9}
      selectedDepartment="Engineering"
    />,
  );

  expect(await screen.findByRole("heading", { name: "Questions by Program" })).toBeInTheDocument();
  await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(
    expect.stringContaining("program_id=30"),
    expect.any(Object),
  ));
  expect(global.fetch).toHaveBeenCalledWith(
    expect.stringContaining("program_id=31"),
    expect.any(Object),
  );
});

test("shows question counts by instructor for a selected program", async () => {
  render(
    <CampusAdminOverview
      departments={departments}
      departmentId={9}
      programId={30}
      selectedDepartment="Engineering"
      selectedProgram="Computer Science"
    />,
  );

  expect(await screen.findByRole("heading", { name: "Questions by Instructor" })).toBeInTheDocument();
  await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(
    expect.stringContaining("instructor_id=1"),
    expect.any(Object),
  ));
  expect(global.fetch).toHaveBeenCalledWith(
    expect.stringContaining("instructor_id=2"),
    expect.any(Object),
  );
});
