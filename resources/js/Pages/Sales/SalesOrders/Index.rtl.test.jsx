import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

// DataTable2 punya orkestrasi berat (loadData, filter, pagination, dst) --
// concern-nya sendiri, sudah ditest di DataTable2.rtl.test.jsx. Stub di sini
// supaya test fokus HANYA ke templateItem yang diteruskan Index.jsx.
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

describe("Sales/SalesOrders/Index", () => {
  beforeEach(() => {
    dataTable2Props.mockReset();
  });

  it("templateItem menampilkan code & customer_name SalesOrder (bukan name/type yang tak pernah ada)", () => {
    render(<Index />);
    const { templateItem } = dataTable2Props.mock.calls.at(-1)[0];
    const dataRow = {
      id: 1,
      code: "SO-0001",
      customer_name: "Acme Corp",
      is_rent: false,
    };

    render(templateItem({ dataRow }));

    expect(screen.getByText("SO-0001")).toBeInTheDocument();
    expect(screen.getByText("Acme Corp")).toBeInTheDocument();
  });

  it("badge is_rent hanya dirender kalau dataRow.is_rent true (kondisional, bukan selalu ada)", () => {
    render(<Index />);
    const { templateItem } = dataTable2Props.mock.calls.at(-1)[0];

    const { container: withRent } = render(
      templateItem({
        dataRow: {
          id: 1,
          code: "SO-0002",
          customer_name: "Beta",
          is_rent: true,
        },
      }),
    );
    // 2 <p> (code, customer_name) + 1 <p> badge is_rent = 3.
    expect(withRent.querySelectorAll("p")).toHaveLength(3);

    const { container: withoutRent } = render(
      templateItem({
        dataRow: {
          id: 2,
          code: "SO-0003",
          customer_name: "Gamma",
          is_rent: false,
        },
      }),
    );
    expect(withoutRent.querySelectorAll("p")).toHaveLength(2);
  });

  it("source memakai route salesOrders.show & field code/customer_name (bukan name/type)", () => {
    const source = readFileSync(
      resolve(process.cwd(), "resources/js/Pages/Sales/SalesOrders/Index.jsx"),
      "utf8",
    );
    expect(source).toMatch(/route\("salesOrders\.show"/);
    expect(source).toMatch(/dataRow\.code/);
    expect(source).toMatch(/dataRow\.customer_name/);
    expect(source).not.toMatch(/dataRow\.name\b/);
    expect(source).not.toMatch(/dataRow\.type\b/);
  });
});
