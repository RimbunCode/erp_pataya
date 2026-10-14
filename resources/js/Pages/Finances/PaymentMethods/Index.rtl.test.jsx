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

describe("Finances/PaymentMethods/Index", () => {
  beforeEach(() => {
    dataTable2Props.mockReset();
  });

  it("templateItem menampilkan name & description (bukan lagi dead code di-comment)", () => {
    render(<Index />);
    const { templateItem } = dataTable2Props.mock.calls.at(-1)[0];
    render(
      templateItem({
        dataRow: { id: 1, name: "Bank Transfer", description: "Transfer bank" },
        deleteItem: vi.fn(),
      }),
    );

    expect(screen.getByText("Bank Transfer")).toBeInTheDocument();
    expect(screen.getByText("Transfer bank")).toBeInTheDocument();
  });

  it("description tidak dirender kalau kosong (kondisional)", () => {
    render(<Index />);
    const { templateItem } = dataTable2Props.mock.calls.at(-1)[0];
    const { container } = render(
      templateItem({ dataRow: { id: 1, name: "Cash" }, deleteItem: vi.fn() }),
    );

    expect(container.querySelectorAll("p")).toHaveLength(1);
  });

  it("templateItem tidak merender tombol hapus manual (hapus lewat ⋯ menu DataTable2)", () => {
    render(<Index />);
    const { templateItem } = dataTable2Props.mock.calls.at(-1)[0];
    render(templateItem({ dataRow: { id: 1, name: "Cash" } }));
    // Hanya Link as="button" yang tersisa; hapus dikelola menu ⋯ DataTable2.
    expect(screen.getAllByRole("button")).toHaveLength(1);
  });

  it("source tidak lagi punya templateItem di-comment atau setIdDelete", () => {
    const source = readFileSync(
      resolve(
        process.cwd(),
        "resources/js/Pages/Finances/PaymentMethods/Index.jsx",
      ),
      "utf8",
    );
    expect(source).not.toMatch(/setIdDelete/);
    expect(source).not.toMatch(/\/\/\s*templateItem/);
    expect(source).toMatch(/route\("paymentMethods\.show"/);
  });
});
