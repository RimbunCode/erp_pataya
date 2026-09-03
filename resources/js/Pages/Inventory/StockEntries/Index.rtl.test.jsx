import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({ t: (key) => `TR:${key}` }),
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

describe("Inventory StockEntries Index", () => {
  it("meneruskan templateItem, classNameDialog, dan form ke DataTable2", () => {
    render(<Index />);
    expect(typeof capturedProps.templateItem).toBe("function");
    expect(capturedProps.classNameDialog).toBe("max-w-(--breakpoint-2xl)!");
    expect(capturedProps.form).toBeTruthy();
  });

  // BUG (lihat bugFindings): templateItem di source membaca dataRow.name dan
  // dataRow.type serta route/translasi domain Inventory Categories
  // ("categories.show", "inventory.category.types.*") padahal ini page
  // Inventory/StockEntries (model StockEntry submitable dengan field seperti
  // date, warehouse, items, difference_account -- lihat Form.jsx/Show.jsx co-located
  // -- bukan name/type, dan route stock entry didaftarkan sebagai resourceDetail
  // "stockEntry", bukan "categories"). Nampak sisa copy-paste dari
  // Inventory/Categories/Index.jsx. Test ini meng-assert PERILAKU SAAT INI,
  // bukan perilaku yang seharusnya.
  it("templateItem merender dataRow.name dan translasi dataRow.type via key inventory.category.types (perilaku saat ini)", () => {
    render(<Index />);
    const dataRow = { id: 1, name: "Stock Entry #1", type: "material_issue" };
    const { container } = render(
      capturedProps.templateItem({ dataRow, deleteItem: vi.fn() }),
    );
    expect(container).toHaveTextContent("Stock Entry #1");
    expect(container).toHaveTextContent(
      "TR:inventory.category.types.material_issue",
    );
  });

  it("templateItem tidak merender field StockEntry asli seperti date/warehouse (perilaku saat ini, lihat bugFindings)", () => {
    render(<Index />);
    const dataRow = {
      id: 2,
      date: "2026-09-01",
      warehouse: { name: "Gudang Utama" },
    };
    const { container } = render(
      capturedProps.templateItem({ dataRow, deleteItem: vi.fn() }),
    );
    expect(container).not.toHaveTextContent("2026-09-01");
    expect(container).not.toHaveTextContent("Gudang Utama");
  });

  it("Link (as='button') dirender sebagai <button>, bukan <a>, dengan href ke route categories.show (perilaku saat ini)", () => {
    // Komponen Link custom (@/Components/Link) memaksa as="button" jadi
    // elemen <button type="button">, tanpa atribut href di DOM (lihat
    // Link.jsx elProps: hanya "a" yang diberi href). href tetap dipakai
    // internal utk Inertia visit saat diklik.
    render(<Index />);
    const dataRow = {
      id: 42,
      name: "Stock Entry #42",
      type: "material_transfer",
    };
    const { container } = render(
      capturedProps.templateItem({ dataRow, deleteItem: vi.fn() }),
    );
    const linkButton = container.querySelector("button[type='button']");
    expect(linkButton).toBeInTheDocument();
    expect(linkButton).not.toHaveAttribute("href");
  });

  it("tombol hapus memanggil deleteItem() tanpa argumen saat diklik", async () => {
    const user = userEvent.setup();
    const deleteItem = vi.fn();
    render(<Index />);
    const dataRow = { id: 5, name: "Stock Entry #5", type: "material_receipt" };
    const { container } = render(
      capturedProps.templateItem({ dataRow, deleteItem }),
    );
    const deleteButton = container.querySelector("button.size-8");
    await user.click(deleteButton);
    expect(deleteItem).toHaveBeenCalledTimes(1);
    expect(deleteItem).toHaveBeenCalledWith();
  });

  it("tidak melempar error saat dataRow.type undefined", () => {
    render(<Index />);
    const dataRow = { id: 6, name: "Stock Entry Tanpa Tipe" };
    expect(() =>
      render(capturedProps.templateItem({ dataRow, deleteItem: vi.fn() })),
    ).not.toThrow();
  });
});
