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

describe("Finances/SalesInvoice/Index", () => {
  beforeEach(() => {
    dataTable2Props.mockReset();
  });

  it("templateItem menampilkan code & customer_name (bukan name/type yang tak pernah ada)", () => {
    render(<Index />);
    const { templateItem } = dataTable2Props.mock.calls.at(-1)[0];
    render(
      templateItem({
        dataRow: { id: 1, code: "SI-0001", customer_name: "Acme Corp" },
      }),
    );
    expect(screen.getByText("SI-0001")).toBeInTheDocument();
    expect(screen.getByText("Acme Corp")).toBeInTheDocument();
  });

  it("source memakai route salesInvoices.show (plural) & field code/customer_name, bukan name/type/salesInvoice.show singular", () => {
    const source = readFileSync(
      resolve(
        process.cwd(),
        "resources/js/Pages/Finances/SalesInvoice/Index.jsx",
      ),
      "utf8",
    );
    expect(source).toMatch(/route\("salesInvoices\.show"/);
    expect(source).toMatch(/dataRow\.code/);
    expect(source).not.toMatch(/dataRow\.name\b/);
    expect(source).not.toMatch(/dataRow\.type\b/);
  });
});
