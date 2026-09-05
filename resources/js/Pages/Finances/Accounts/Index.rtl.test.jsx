import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

const dataTable2Props = vi.fn();
vi.mock("@/Pages/Core/DataTable2", () => ({
  default: (props) => {
    dataTable2Props(props);
    return <div data-testid="stub-datatable2" />;
  },
}));

window.route = (name, params) =>
  params ? `${name}/${JSON.stringify(params)}` : name;

import Index from "./Index";

describe("Finances/Accounts/Index", () => {
  beforeEach(() => {
    dataTable2Props.mockReset();
  });

  it("templateItem menampilkan code (account_number - account_name gabungan backend), bukan name/type", () => {
    render(<Index />);
    const { templateItem } = dataTable2Props.mock.calls.at(-1)[0];
    render(
      templateItem({ dataRow: { id: 1, code: "2000 - Accounts Payable" } }),
    );
    expect(screen.getByText("2000 - Accounts Payable")).toBeInTheDocument();
  });

  it("source memakai route accounts.show & field code, bukan name/type/salesOrders.show", () => {
    const source = readFileSync(
      resolve(process.cwd(), "resources/js/Pages/Finances/Accounts/Index.jsx"),
      "utf8",
    );
    expect(source).toMatch(/route\("accounts\.show"/);
    expect(source).toMatch(/dataRow\.code/);
    expect(source).not.toMatch(/dataRow\.name\b/);
    expect(source).not.toMatch(/dataRow\.type\b/);
    expect(source).not.toMatch(/salesOrders\.show/);
  });
});
