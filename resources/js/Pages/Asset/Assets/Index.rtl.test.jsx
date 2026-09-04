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

describe("Asset Assets Index", () => {
  it("meneruskan templateItem, classNameDialog, dan form ke DataTable2", () => {
    render(<Index />);
    expect(typeof capturedProps.templateItem).toBe("function");
    expect(capturedProps.classNameDialog).toBe("max-w-(--breakpoint-lg)!");
    expect(capturedProps.form).toBeTruthy();
  });

  it("templateItem merender code dan asset_name dataRow", () => {
    render(<Index />);
    const dataRow = { id: 1, code: "AST-0001", asset_name: "Forklift Toyota" };
    const { container } = render(
      capturedProps.templateItem({ dataRow, deleteItem: vi.fn() }),
    );
    expect(container).toHaveTextContent("AST-0001");
    expect(container).toHaveTextContent("Forklift Toyota");
  });

  it("Link (as='button') dirender sebagai <button>, bukan <a>", () => {
    // Komponen Link custom (@/Components/Link) memaksa as="button" jadi
    // elemen <button type="button">, tanpa atribut href (lihat Link.jsx
    // elProps: hanya "a" yang diberi href). href tetap dipakai internal
    // utk Inertia visit saat diklik, hanya tidak muncul di DOM.
    render(<Index />);
    const dataRow = { id: 42, code: "AST-0042", asset_name: "Genset" };
    const { container } = render(
      capturedProps.templateItem({ dataRow, deleteItem: vi.fn() }),
    );
    const button = container.querySelector("button");
    expect(button).toHaveAttribute("type", "button");
    expect(button).not.toHaveAttribute("href");
  });

  it("merender badge status yang diterjemahkan via t() untuk setiap status pada dataRow.status", () => {
    render(<Index />);
    const dataRow = {
      id: 2,
      code: "AST-0002",
      asset_name: "AC Split",
      status: ["active", "in_maintenance"],
    };
    const { container } = render(
      capturedProps.templateItem({ dataRow, deleteItem: vi.fn() }),
    );
    expect(container).toHaveTextContent("TR:status.active");
    expect(container).toHaveTextContent("TR:status.in_maintenance");
  });

  it("tidak menampilkan badge status apa pun saat dataRow.status kosong/tidak ada", () => {
    render(<Index />);
    const dataRow = { id: 3, code: "AST-0003", asset_name: "Genset Kecil" };
    const { container } = render(
      capturedProps.templateItem({ dataRow, deleteItem: vi.fn() }),
    );
    expect(container.querySelectorAll("span").length).toBe(0);
  });

  it("tidak melempar error saat dataRow.status eksplisit array kosong", () => {
    render(<Index />);
    const dataRow = {
      id: 4,
      code: "AST-0004",
      asset_name: "Genset Besar",
      status: [],
    };
    expect(() =>
      render(capturedProps.templateItem({ dataRow, deleteItem: vi.fn() })),
    ).not.toThrow();
  });

  it("mengklik Link tidak melempar error (tidak ada tombol hapus di templateItem ini)", async () => {
    // Link custom (@/Components/Link) memanggil @inertiajs/core router.visit()
    // sungguhan saat diklik -- tanpa app Inertia nyata (root jsdom kosong),
    // itu throw TypeError "Cannot read properties of undefined (reading
    // 'url')" secara ASYNC (lolos dari try/catch test, muncul sbg Unhandled
    // Error terpisah, bikin seluruh run Vitest exit 1 walau test lain pass).
    // Spy router.visit spy jadi no-op, pola sama persis dgn
    // Asset/Movements/Index.rtl.test.jsx.
    const user = userEvent.setup();
    const { router } = await import("@inertiajs/core");
    const visitSpy = vi.spyOn(router, "visit").mockImplementation(() => {});
    render(<Index />);
    const dataRow = { id: 5, code: "AST-0005", asset_name: "Mesin Las" };
    const { container } = render(
      capturedProps.templateItem({ dataRow, deleteItem: vi.fn() }),
    );
    const button = container.querySelector("button");
    await user.click(button);
    expect(button).toBeInTheDocument();
    visitSpy.mockRestore();
  });
});
