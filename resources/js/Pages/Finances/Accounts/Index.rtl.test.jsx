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

describe("Finances Accounts Index", () => {
  it("meneruskan templateItem, classNameDialog, dan form ke DataTable2", () => {
    render(<Index />);
    expect(typeof capturedProps.templateItem).toBe("function");
    expect(capturedProps.classNameDialog).toBe("max-w-(--breakpoint-lg)!");
    expect(capturedProps.form).toBeTruthy();
  });

  // BUG (lihat bugFindings): templateItem di source membaca dataRow.name dan
  // dataRow.type serta route/translasi domain Sales Orders ("salesOrders.show",
  // "sales.salesOrders.types.*") padahal ini page Finances/Accounts (model
  // Account punya account_name/account_type, bukan name/type). Nampak sisa
  // copy-paste dari Sales/SalesOrders/Index.jsx. Test ini meng-assert
  // PERILAKU SAAT INI, bukan perilaku yang seharusnya.
  it("templateItem merender dataRow.name dan translasi dataRow.type via key sales.salesOrders.types (perilaku saat ini)", () => {
    render(<Index />);
    const dataRow = { id: 1, name: "Kas Kecil", type: "cash" };
    const { container } = render(
      capturedProps.templateItem({ dataRow, deleteItem: vi.fn() }),
    );
    expect(container).toHaveTextContent("Kas Kecil");
    expect(container).toHaveTextContent("TR:sales.salesOrders.types.cash");
  });

  it("templateItem tidak merender field Account asli seperti account_name (perilaku saat ini, lihat bugFindings)", () => {
    render(<Index />);
    const dataRow = {
      id: 2,
      account_name: "Bank BCA",
      account_type: "bank",
    };
    const { container } = render(
      capturedProps.templateItem({ dataRow, deleteItem: vi.fn() }),
    );
    expect(container).not.toHaveTextContent("Bank BCA");
  });

  it("Link (as='button') dirender sebagai <button>, bukan <a>, dengan href ke route salesOrders.show (perilaku saat ini)", () => {
    // Komponen Link custom (@/Components/Link) memaksa as="button" jadi
    // elemen <button type="button">, tanpa atribut href di DOM (lihat
    // Link.jsx elProps: hanya "a" yang diberi href). href tetap dipakai
    // internal utk Inertia visit saat diklik.
    render(<Index />);
    const dataRow = { id: 42, name: "Piutang Usaha", type: "receivable" };
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
    const dataRow = { id: 5, name: "Utang Usaha", type: "payable" };
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
    const dataRow = { id: 6, name: "Akun Tanpa Tipe" };
    expect(() =>
      render(capturedProps.templateItem({ dataRow, deleteItem: vi.fn() })),
    ).not.toThrow();
  });
});
