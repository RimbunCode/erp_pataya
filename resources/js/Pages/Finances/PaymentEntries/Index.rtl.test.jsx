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

describe("Finances/PaymentEntries/Index", () => {
  beforeEach(() => {
    dataTable2Props.mockReset();
  });

  it("templateItem menampilkan code & date (bukan lagi dead code di-comment)", () => {
    render(<Index />);
    const { templateItem } = dataTable2Props.mock.calls.at(-1)[0];
    render(
      templateItem({
        dataRow: { id: 1, code: "PE-0001", date: "2026-09-04" },
        deleteItem: vi.fn(),
      }),
    );

    expect(screen.getByText("PE-0001")).toBeInTheDocument();
    expect(screen.getByText("2026-09-04")).toBeInTheDocument();
  });

  it("templateItem tidak merender tombol hapus manual (hapus lewat ⋯ menu DataTable2)", () => {
    render(<Index />);
    const { templateItem } = dataTable2Props.mock.calls.at(-1)[0];
    render(templateItem({ dataRow: { id: 1, code: "PE-0002" } }));
    // Hanya Link as="button" yang tersisa; hapus dikelola menu ⋯ DataTable2.
    expect(screen.getAllByRole("button")).toHaveLength(1);
  });

  it("source tidak lagi punya templateItem di-comment atau setIdDelete", () => {
    const source = readFileSync(
      resolve(
        process.cwd(),
        "resources/js/Pages/Finances/PaymentEntries/Index.jsx",
      ),
      "utf8",
    );
    expect(source).not.toMatch(/setIdDelete/);
    expect(source).not.toMatch(/\/\/\s*templateItem/);
    expect(source).toMatch(/route\("paymentEntries\.show"/);
  });
});
