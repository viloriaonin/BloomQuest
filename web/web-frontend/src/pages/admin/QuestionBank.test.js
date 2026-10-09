import { render, screen } from "@testing-library/react";
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
        programs: [{ id: 30, name: "Computer Science", code: "CS", faculty: [] }],
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

test("central super admin retains campus selection", async () => {
  localStorage.setItem("role", "super_admin");
  renderQuestionBank();

  expect(await screen.findByRole("heading", { name: "Choose a campus" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /North Campus/ })).toBeInTheDocument();
});
