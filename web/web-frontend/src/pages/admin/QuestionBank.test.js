import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QuestionBankContent } from "./QuestionBank";

const hierarchy = {
  campuses: [{
    id: 4,
    name: "North Campus",
    code: "NC",
    departments: [{
      id: 9,
      name: "Engineering",
      code: "ENG",
      programs: [],
    }],
  }],
};

const renderQuestionBank = (path = "/admin/questions") => render(
  <MemoryRouter initialEntries={[path]}>
    <Routes>
      <Route path="/admin/questions" element={<QuestionBankContent />} />
      <Route path="/admin/questions/:subjectId" element={<QuestionBankContent />} />
    </Routes>
  </MemoryRouter>,
);

beforeEach(() => {
  global.fetch = jest.fn(async (url) => {
    if (String(url).endsWith("/academic-hierarchy")) {
      return { ok: true, json: async () => hierarchy };
    }
    if (String(url).endsWith("/subjects")) {
      return { ok: true, json: async () => [] };
    }
    return { ok: true, json: async () => [] };
  });

});

afterEach(() => {
  delete global.fetch;
  localStorage.removeItem("role");
});

test("campus admin opens directly to their campus departments", async () => {
  localStorage.setItem("role", "campus_admin");
  renderQuestionBank();

  expect((await screen.findAllByRole("heading", { name: "Choose a department" })).length).toBeGreaterThan(0);
  expect(screen.getByRole("button", { name: /Engineering/ })).toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "Choose a campus" })).not.toBeInTheDocument();
  expect(screen.queryByText("North Campus")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /Engineering/ }));
  const backButton = await screen.findByRole("button", { name: "Back" });
  expect(backButton).toHaveClass("shadow-sm");
  expect(backButton).toHaveStyle({ background: "var(--bq-accent-strong)" });
});

test("Super Admin sees an indication when a campus has no departments", async () => {
  localStorage.setItem("role", "super_admin");
  global.fetch.mockImplementation(async (url) => {
    if (String(url).endsWith("/academic-hierarchy")) {
      return {
        ok: true,
        json: async () => ({ campuses: [{ id: 4, name: "North Campus", departments: [] }] }),
      };
    }
    return { ok: true, json: async () => [] };
  });

  renderQuestionBank();

  fireEvent.click(await screen.findByRole("button", { name: /North Campus/ }));
  const backButton = await screen.findByRole("button", { name: "Back" });
  expect(backButton).toHaveClass("shadow-sm");
  expect(backButton).toHaveStyle({ background: "var(--bq-accent-strong)" });
  expect(await screen.findByText("No departments are available in this campus.")).toBeInTheDocument();
});

test("Super Admin sees an indication when a department has no programs", async () => {
  localStorage.setItem("role", "super_admin");
  renderQuestionBank();

  fireEvent.click(await screen.findByRole("button", { name: /North Campus/ }));
  fireEvent.click(await screen.findByRole("button", { name: /Engineering/ }));
  expect(await screen.findByText("No programs are available in this department.")).toBeInTheDocument();
});

test("Super Admin sees an indication when a program has no subjects", async () => {
  localStorage.setItem("role", "super_admin");
  const linkedHierarchy = {
    campuses: [{
      id: 4,
      name: "North Campus",
      departments: [{
        id: 9,
        name: "Engineering",
        programs: [{ id: 30, name: "Computer Science", faculty: [] }],
      }],
    }],
  };
  global.fetch.mockImplementation(async (url) => {
    if (String(url).endsWith("/academic-hierarchy")) {
      return { ok: true, json: async () => linkedHierarchy };
    }
    return { ok: true, json: async () => [] };
  });

  renderQuestionBank();

  fireEvent.click(await screen.findByRole("button", { name: /North Campus/ }));
  fireEvent.click(await screen.findByRole("button", { name: /Engineering/ }));
  fireEvent.click(await screen.findByRole("button", { name: /Computer Science/ }));
  expect(await screen.findByText("No subjects are assigned to this program yet.")).toBeInTheDocument();
});

test("opens the requested subject from an admin question-bank deep link", async () => {
  localStorage.setItem("role", "campus_admin");
  const linkedHierarchy = {
    campuses: [{
      id: 4,
      name: "North Campus",
      code: "NC",
      departments: [{
        id: 9,
        name: "Engineering",
        code: "ENG",
        programs: [{
          id: 30,
          name: "Computer Science",
          code: "CS",
          faculty: [
            { id: 1, name: "Alice", email: "alice@example.com" },
            { id: 2, name: "Bob", email: "bob@example.com" },
          ],
        }],
      }],
    }],
  };
  global.fetch.mockImplementation(async (url) => {
    if (String(url).endsWith("/academic-hierarchy")) {
      return { ok: true, json: async () => linkedHierarchy };
    }
    if (String(url).includes("/subjects")) {
      return {
        ok: true,
        json: async () => [{
          id: 11,
          name: "Algorithms",
          code: "CS201",
          program_id: 30,
          department_id: 9,
          question_count: 1,
        }],
      };
    }
    return { ok: true, json: async () => [] };
  });

  renderQuestionBank("/admin/questions/11");

  expect(await screen.findByRole("heading", { name: "Algorithms" })).toBeInTheDocument();
});

test("filters subject questions by creator", async () => {
  localStorage.setItem("role", "campus_admin");
  const linkedHierarchy = {
    campuses: [{
      id: 4,
      name: "North Campus",
      code: "NC",
      departments: [{
        id: 9,
        name: "Engineering",
        code: "ENG",
        programs: [{
          id: 30,
          name: "Computer Science",
          code: "CS",
          faculty: [
            { id: 1, name: "Alice", email: "alice@example.com" },
            { id: 2, name: "Bob", email: "bob@example.com" },
          ],
        }],
      }],
    }],
  };
  global.fetch.mockImplementation(async (url) => {
    if (String(url).endsWith("/academic-hierarchy")) {
      return { ok: true, json: async () => linkedHierarchy };
    }
    if (String(url).includes("/subjects")) {
      return {
        ok: true,
        json: async () => [{
          id: 11,
          name: "Algorithms",
          code: "CS201",
          program_id: 30,
          department_id: 9,
        }],
      };
    }
    if (String(url).includes("/questions?subject_id=11")) {
      return {
        ok: true,
        json: async () => [
          { id: 1, question: "Question by Alice", creator_name: "Alice", creator_email: "alice@example.com" },
          { id: 2, question: "Question by Bob", creator_name: "Bob", creator_email: "bob@example.com" },
        ],
      };
    }
    return { ok: true, json: async () => [] };
  });

  renderQuestionBank("/admin/questions/11");

  expect(await screen.findByText("Question by Alice")).toBeInTheDocument();
  expect(screen.getByText("Question by Bob")).toBeInTheDocument();
  fireEvent.change(screen.getByRole("combobox", { name: "Created by" }), {
    target: { value: "alice@example.com" },
  });

  expect(screen.getByText("Question by Alice")).toBeInTheDocument();
  expect(screen.queryByText("Question by Bob")).not.toBeInTheDocument();
});

test("program faculty appear in the created-by filter", async () => {
  localStorage.setItem("role", "campus_admin");
  const linkedHierarchy = {
    campuses: [{
      id: 4,
      name: "North Campus",
      code: "NC",
      departments: [{
        id: 9,
        name: "Engineering",
        code: "ENG",
        programs: [{
          id: 30,
          name: "Computer Science",
          code: "CS",
          faculty: [
            { id: 1, name: "Alice Smith", email: "alice@example.com" },
            { id: 2, name: "Bob Jones", email: "bob@example.com" },
            { id: 3, name: "  ", email: "unnamed@example.com" },
            { id: 4, email: "missing-name@example.com" },
          ],
        }],
      }],
    }],
  };
  global.fetch.mockImplementation(async (url) => {
    if (String(url).endsWith("/academic-hierarchy")) {
      return { ok: true, json: async () => linkedHierarchy };
    }
    if (String(url).includes("/subjects")) {
      return {
        ok: true,
        json: async () => [{
          id: 11,
          name: "Algorithms",
          code: "CS201",
          program_id: 30,
          department_id: 9,
        }],
      };
    }
    if (String(url).includes("/questions?subject_id=11")) {
      return {
        ok: true,
        json: async () => [
          { id: 1, question: "Question by Alice", creator_name: "Alice Smith", creator_email: "alice@example.com" },
          { id: 2, question: "Question by Unassigned", creator_name: "Unassigned Creator", creator_email: "unassigned@example.com" },
          { id: 3, question: "Question by Missing Name", creator_email: "unnamed@example.com" },
        ],
      };
    }
    return { ok: true, json: async () => [] };
  });

  renderQuestionBank("/admin/questions/11");

  const creatorSelect = await screen.findByRole("combobox", { name: "Created by" });
  expect(screen.getByRole("option", { name: "Alice Smith" })).toBeInTheDocument();
  expect(screen.getByRole("option", { name: "Bob Jones" })).toBeInTheDocument();
  expect(screen.queryByRole("option", { name: "Unassigned Creator" })).not.toBeInTheDocument();
  expect(screen.queryByRole("option", { name: "unnamed@example.com" })).not.toBeInTheDocument();
  expect(screen.queryByRole("option", { name: "Missing Name" })).not.toBeInTheDocument();
  fireEvent.change(creatorSelect, { target: { value: "bob@example.com" } });
  expect(screen.queryByText("Question by Alice")).not.toBeInTheDocument();
});

test("central super admin retains campus selection", async () => {
  localStorage.setItem("role", "super_admin");
  renderQuestionBank();

  expect(await screen.findByRole("heading", { name: "Choose a campus" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /North Campus/ })).toBeInTheDocument();
});
