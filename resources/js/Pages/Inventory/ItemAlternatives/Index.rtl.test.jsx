import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const stableT = (key) => `TR:${key}`;
vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({ t: stableT }),
}));

let capturedProps = null;
vi.mock("@/Pages/Core/DataTable2", () => ({
  default: (props) => {
    capturedProps = props;
    return null; // detail lain DataTable2 di luar cakupan test ini
  },
}));

import Index from "./Index";

window.route = (name, param) => (param != null ? `${name}/${param}` : name);

describe("Item Alternatives Index", () => {
  it("meneruskan templateItem, form, dan classNameDialog ke DataTable2", () => {
    render(<Index />);
    expect(typeof capturedProps.templateItem).toBe("function");
    expect(capturedProps.classNameDialog).toBe("max-w-4xl!");
    expect(capturedProps.form).toBeTruthy();
  });

  it("templateItem merender item_code dan alternative_code dataRow", () => {
    render(<Index />);
    const dataRow = {
      id: 1,
      item_code: "ITEM-001",
      alternative_code: "ITEM-002",
      two_way: false,
    };
    const { container } = render(
      capturedProps.templateItem({ dataRow, deleteItem: vi.fn() }),
    );
    expect(container).toHaveTextContent("ITEM-001");
    expect(container).toHaveTextContent("ITEM-002");
  });

  it("dataRow.two_way true menampilkan badge two_way (diterjemahkan)", () => {
    render(<Index />);
    const dataRow = {
      id: 2,
      item_code: "ITEM-003",
      alternative_code: "ITEM-004",
      two_way: true,
    };
    const { container } = render(
      capturedProps.templateItem({ dataRow, deleteItem: vi.fn() }),
    );
    expect(container).toHaveTextContent(
      "TR:inventory.itemAlternative.columns.two_way",
    );
    expect(container.querySelector("span.badge")).toBeInTheDocument();
  });

  it("dataRow.two_way false/undefined tidak menampilkan badge two_way", () => {
    render(<Index />);
    const dataRow = {
      id: 3,
      item_code: "ITEM-005",
      alternative_code: "ITEM-006",
    };
    const { container } = render(
      capturedProps.templateItem({ dataRow, deleteItem: vi.fn() }),
    );
    expect(container.querySelector("span.badge")).not.toBeInTheDocument();
  });

  it('Link (as="button") memicu router.visit ke route itemAlternatives.show dengan id dataRow', async () => {
    // Link diberi prop as="button" di templateItem, sehingga elemen yang
    // dirender adalah <button type="button">, bukan <a href>. Perilaku
    // navigasi custom Link (@/Components/Link) memanggil router.visit(href)
    // saat diklik -- itu yang diverifikasi di sini, bukan atribut href.
    const user = userEvent.setup();
    const { router } = await import("@inertiajs/core");
    const visitSpy = vi.spyOn(router, "visit").mockImplementation(() => {});
    render(<Index />);
    const dataRow = {
      id: 7,
      item_code: "ITEM-007",
      alternative_code: "ITEM-008",
      two_way: false,
    };
    const { container } = render(
      capturedProps.templateItem({ dataRow, deleteItem: vi.fn() }),
    );
    const buttons = container.querySelectorAll("button");
    // Tombol pertama adalah Link (item), tombol kedua adalah tombol hapus.
    expect(buttons).toHaveLength(2);
    await user.click(buttons[0]);
    expect(visitSpy).toHaveBeenCalledWith(
      "itemAlternatives.show/7",
      expect.anything(),
    );
    visitSpy.mockRestore();
  });

  it("tombol hapus memanggil deleteItem() tanpa argumen saat diklik", async () => {
    const user = userEvent.setup();
    const { router } = await import("@inertiajs/core");
    const visitSpy = vi.spyOn(router, "visit").mockImplementation(() => {});
    render(<Index />);
    const dataRow = {
      id: 9,
      item_code: "ITEM-009",
      alternative_code: "ITEM-010",
      two_way: false,
    };
    const deleteItem = vi.fn();
    const { container } = render(
      capturedProps.templateItem({ dataRow, deleteItem }),
    );
    const buttons = container.querySelectorAll("button");
    await user.click(buttons[1]);
    expect(deleteItem).toHaveBeenCalledTimes(1);
    expect(deleteItem).toHaveBeenCalledWith();
    visitSpy.mockRestore();
  });
});
