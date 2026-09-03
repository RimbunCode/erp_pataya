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

describe("Inventory DeliveryNotes Index", () => {
  it("meneruskan templateItem, classNameDialog, dan form ke DataTable2", () => {
    render(<Index />);
    expect(typeof capturedProps.templateItem).toBe("function");
    expect(capturedProps.classNameDialog).toBe("max-w-(--breakpoint-2xl)!");
    expect(capturedProps.form).toBeTruthy();
  });

  // BUG (lihat bugFindings): templateItem di source membaca dataRow.name dan
  // dataRow.type serta route/translasi domain Sales Orders ("salesOrders.show",
  // "sales.salesOrders.types.*") padahal ini page Inventory/DeliveryNotes
  // (model DeliveryNote punya field code/delivery_date/referenceable/customer,
  // bukan name/type -- lihat app/Models/Inventory/DeliveryNote.php, tidak ada
  // key i18n "inventory.deliveryNote.types.*"). Nampak sisa copy-paste dari
  // Sales/SalesOrders/Index.jsx yang tidak disesuaikan ke domain DeliveryNotes.
  // Test ini meng-assert PERILAKU SAAT INI, bukan perilaku yang seharusnya.
  it("templateItem merender dataRow.name dan translasi dataRow.type via key sales.salesOrders.types (perilaku saat ini)", () => {
    render(<Index />);
    const dataRow = { id: 1, name: "DN-0001", type: "return" };
    const { container } = render(
      capturedProps.templateItem({ dataRow, deleteItem: vi.fn() }),
    );
    expect(container).toHaveTextContent("DN-0001");
    expect(container).toHaveTextContent("TR:sales.salesOrders.types.return");
  });

  it("templateItem tidak merender field DeliveryNote asli seperti code/delivery_date (perilaku saat ini, lihat bugFindings)", () => {
    render(<Index />);
    const dataRow = {
      id: 2,
      code: "DN-0002",
      delivery_date: "2026-09-01",
    };
    const { container } = render(
      capturedProps.templateItem({ dataRow, deleteItem: vi.fn() }),
    );
    expect(container).not.toHaveTextContent("DN-0002");
    expect(container).not.toHaveTextContent("2026-09-01");
  });

  it("Link (as='button') dirender sebagai <button>, bukan <a>, dengan href ke route salesOrders.show (perilaku saat ini)", () => {
    // Komponen Link custom (@/Components/Link) memaksa as="button" jadi
    // elemen <button type="button">, tanpa atribut href di DOM (lihat
    // Link.jsx elProps: hanya "a" yang diberi href). href tetap dipakai
    // internal utk Inertia visit saat diklik.
    render(<Index />);
    const dataRow = { id: 42, name: "DN-0042", type: "return" };
    const { container } = render(
      capturedProps.templateItem({ dataRow, deleteItem: vi.fn() }),
    );
    const button = container.querySelector("button");
    expect(button).toHaveAttribute("type", "button");
    expect(button).not.toHaveAttribute("href");
  });

  it("mengklik Link tidak melempar error (tidak ada tombol hapus di templateItem ini)", async () => {
    const user = userEvent.setup();
    render(<Index />);
    const dataRow = { id: 5, name: "DN-0005", type: "delivery" };
    const { container } = render(
      capturedProps.templateItem({ dataRow, deleteItem: vi.fn() }),
    );
    const button = container.querySelector("button");
    await user.click(button);
    // Link custom (Components/Link) tidak melakukan navigasi nyata di jsdom;
    // cukup pastikan klik tidak melempar error.
    expect(button).toBeInTheDocument();
  });

  it("tidak melempar error saat dataRow.type undefined", () => {
    render(<Index />);
    const dataRow = { id: 6, name: "DN-0006" };
    expect(() =>
      render(capturedProps.templateItem({ dataRow, deleteItem: vi.fn() })),
    ).not.toThrow();
  });
});
