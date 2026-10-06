import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
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

const renderQuestionBank = () => render(
  <MemoryRouter>
    <QuestionBankContent />
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

test("central super admin retains campus selection", async () => {
  localStorage.setItem("role", "super_admin");
  renderQuestionBank();

  expect(await screen.findByRole("heading", { name: "Choose a campus" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /North Campus/ })).toBeInTheDocument();
});
