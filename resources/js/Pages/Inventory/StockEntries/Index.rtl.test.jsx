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

describe("Inventory/StockEntries/Index", () => {
  beforeEach(() => {
    dataTable2Props.mockReset();
  });

  it("templateItem menampilkan code, bukan name yang tak pernah ada", () => {
    render(<Index />);
    const { templateItem } = dataTable2Props.mock.calls.at(-1)[0];
    render(
      templateItem({ dataRow: { id: 1, code: "SE-0001", type: "item_issue" } }),
    );
    expect(screen.getByText("SE-0001")).toBeInTheDocument();
  });

  it("baris type hanya dirender kalau dataRow.type ada (kondisional)", () => {
    render(<Index />);
    const { templateItem } = dataTable2Props.mock.calls.at(-1)[0];

    const { container: withType } = render(
      templateItem({ dataRow: { id: 1, code: "SE-0002", type: "item_issue" } }),
    );
    expect(withType.querySelectorAll("p")).toHaveLength(2);

    const { container: withoutType } = render(
      templateItem({ dataRow: { id: 2, code: "SE-0003" } }),
    );
    expect(withoutType.querySelectorAll("p")).toHaveLength(1);
  });

  it("source memakai route stockEntries.show (plural) & field code/type, bukan name/categories.show", () => {
    const source = readFileSync(
      resolve(
        process.cwd(),
        "resources/js/Pages/Inventory/StockEntries/Index.jsx",
      ),
      "utf8",
    );
    expect(source).toMatch(/route\("stockEntries\.show"/);
    expect(source).toMatch(/dataRow\.code/);
    expect(source).toMatch(/inventory\.stockEntry\.types/);
    expect(source).not.toMatch(/dataRow\.name\b/);
    expect(source).not.toMatch(/categories\.show/);
    expect(source).not.toMatch(/inventory\.category\.types/);
  });
});
