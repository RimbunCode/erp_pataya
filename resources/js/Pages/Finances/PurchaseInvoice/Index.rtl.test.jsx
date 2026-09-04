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

describe("Finances/PurchaseInvoice/Index", () => {
  beforeEach(() => {
    dataTable2Props.mockReset();
  });

  it("templateItem menampilkan code & supplier_name (bukan name/type yang tak pernah ada)", () => {
    render(<Index />);
    const { templateItem } = dataTable2Props.mock.calls.at(-1)[0];
    render(
      templateItem({
        dataRow: { id: 1, code: "PI-0001", supplier_name: "Acme Supplier" },
      }),
    );
    expect(screen.getByText("PI-0001")).toBeInTheDocument();
    expect(screen.getByText("Acme Supplier")).toBeInTheDocument();
  });

  it("source memakai route purchaseInvoices.show (plural) & field code/supplier_name, bukan name/type/purchaseInvoice.show singular", () => {
    const source = readFileSync(
      resolve(
        process.cwd(),
        "resources/js/Pages/Finances/PurchaseInvoice/Index.jsx",
      ),
      "utf8",
    );
    expect(source).toMatch(/route\("purchaseInvoices\.show"/);
    expect(source).toMatch(/dataRow\.code/);
    expect(source).not.toMatch(/dataRow\.name\b/);
    expect(source).not.toMatch(/dataRow\.type\b/);
  });
});
