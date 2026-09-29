import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ReportsContent } from "./Reports";

const activityRows = [
  {
    id: 1,
    name: "Faculty One",
    dept: "CICS",
    action: "Generated questions",
    detail: "Created a question set",
    type: "generate",
    status: "success",
    date: new Date().toISOString().slice(0, 10),
    time: "10:00 AM",
  },
  {
    id: 2,
    name: "Faculty Two",
    dept: "COE",
    action: "Report download failed",
    detail: "Could not create file",
    type: "download",
    status: "error",
    date: new Date().toISOString().slice(0, 10),
    time: "09:00 AM",
  },
];

beforeEach(() => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => activityRows,
  });
  Object.defineProperty(URL, "createObjectURL", { configurable: true, value: jest.fn(() => "blob:report") });
  Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: jest.fn() });
  jest.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
  delete global.fetch;
});

test("Reports exports the selected activity as a CSV download", async () => {
  render(<ReportsContent />);

  fireEvent.click(await screen.findByRole("tab", { name: /Exports \/ downloads/ }));
  expect(await screen.findByText("Report download failed")).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: "Export Report" }));
  fireEvent.click(screen.getByRole("button", { name: "Export selected tabs" }));

  await waitFor(() => expect(HTMLAnchorElement.prototype.click).toHaveBeenCalled());
  expect(URL.createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
  expect(screen.queryByText("Export selected tabs")).not.toBeInTheDocument();
});