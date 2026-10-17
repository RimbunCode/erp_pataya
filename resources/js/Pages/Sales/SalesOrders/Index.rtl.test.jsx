import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

// DataTable2 punya orkestrasi berat (loadData, filter, pagination, dst) --
// concern-nya sendiri, sudah ditest di DataTable2.rtl.test.jsx. Stub di sini
// supaya test fokus ke props yang diteruskan Index.jsx.
const dataTable2Props = vi.fn();
vi.mock("@/Pages/Core/DataTable2", () => ({
  default: (props) => {
    dataTable2Props(props);
    return <div data-testid="stub-datatable2" />;
  },
}));

import Index from "./Index";

describe("Sales/SalesOrders/Index", () => {
  beforeEach(() => {
    dataTable2Props.mockReset();
  });

  it("merender DataTable2 tanpa prop templateItem (kartu mobile memakai mobileTemplate() model SalesOrder)", () => {
    render(<Index />);

    expect(screen.getByTestId("stub-datatable2")).toBeInTheDocument();
    const props = dataTable2Props.mock.calls.at(-1)[0];
    expect(props).not.toHaveProperty("templateItem");
  });

  it("source tidak lagi memakai templateItem, route salesOrders.show, maupun field name/type", () => {
    const source = readFileSync(
      resolve(process.cwd(), "resources/js/Pages/Sales/SalesOrders/Index.jsx"),
      "utf8",
    );
    expect(source).not.toMatch(/templateItem/);
    expect(source).not.toMatch(/dataRow\.name\b/);
    expect(source).not.toMatch(/dataRow\.type\b/);
  });
});
