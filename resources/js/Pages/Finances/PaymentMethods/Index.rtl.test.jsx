import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

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

  it("tombol hapus memanggil deleteItem() dari DataTable2 (bukan setIdDelete yang tak terdefinisi)", async () => {
    const user = userEvent.setup();
    render(<Index />);
    const { templateItem } = dataTable2Props.mock.calls.at(-1)[0];
    const deleteItem = vi.fn();
    render(templateItem({ dataRow: { id: 1, name: "Cash" }, deleteItem }));

    const buttons = screen.getAllByRole("button");
    await user.click(buttons[buttons.length - 1]);

    expect(deleteItem).toHaveBeenCalledTimes(1);
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
