import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Sidebar from "./Sidebar";

test("renders the faculty navigation including Recycle Bin", () => {
  localStorage.setItem("role", "faculty");

  render(
    <MemoryRouter initialEntries={["/dashboard"]}>
      <Sidebar collapsed={false} mobileOpen={false} />
    </MemoryRouter>,
  );

  expect(screen.getByText("Recycle Bin")).toBeInTheDocument();
});
