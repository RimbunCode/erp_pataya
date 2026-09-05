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

describe("Settings/FormatingSeries/Index", () => {
  beforeEach(() => {
    dataTable2Props.mockReset();
  });

  it("templateItem menampilkan name & format FormatingSeries (bukan field Branch)", () => {
    render(<Index />);
    const { templateItem } = dataTable2Props.mock.calls.at(-1)[0];
    const dataRow = {
      id: 1,
      name: "Format PO",
      format: "PO-@[iiii]/@[yy]",
      model: "PurchaseOrder",
    };

    render(templateItem({ dataRow }));

    expect(screen.getByText("Format PO")).toBeInTheDocument();
    expect(screen.getByText("PO-@[iiii]/@[yy]")).toBeInTheDocument();
    expect(screen.getByText("PurchaseOrder")).toBeInTheDocument();
  });

  it("source tidak lagi mereferensikan field Branch (is_main_branch / shipping_*)", () => {
    const source = readFileSync(
      resolve(
        process.cwd(),
        "resources/js/Pages/Settings/FormatingSeries/Index.jsx",
      ),
      "utf8",
    );
    expect(source).not.toMatch(/is_main_branch|shipping_/);
  });
});
