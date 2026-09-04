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

vi.mock("./Form", () => ({
  default: () => null,
}));

import Index from "./Index";

window.route = (name, param) => (param != null ? `${name}/${param}` : name);

describe("Settings Branches Index", () => {
  it("meneruskan templateItem, classNameDialog, dan form ke DataTable2", () => {
    render(<Index />);
    expect(typeof capturedProps.templateItem).toBe("function");
    expect(capturedProps.classNameDialog).toBe("max-w-(--breakpoint-2xl)!");
    expect(capturedProps.form).toBeTruthy();
  });

  it("templateItem merender name dan alamat shipping dataRow", () => {
    render(<Index />);
    const dataRow = {
      id: 1,
      name: "Cabang Jakarta",
      is_main_branch: false,
      shipping_street: "Jl. Sudirman",
      shipping_city: "Jakarta",
      shipping_state: "DKI Jakarta",
      shipping_zip_code: "12345",
      shipping_country: { name: "Indonesia" },
    };
    const { container } = render(
      capturedProps.templateItem({ dataRow, deleteItem: vi.fn() }),
    );
    expect(container).toHaveTextContent("Cabang Jakarta");
    expect(container).toHaveTextContent(
      "Jl. Sudirman, Jakarta, DKI Jakarta, 12345, Indonesia",
    );
  });

  it("menampilkan badge Main Branch hanya ketika is_main_branch true", () => {
    render(<Index />);
    const dataRow = {
      id: 2,
      name: "Cabang Pusat",
      is_main_branch: true,
      shipping_street: "Jl. Thamrin",
      shipping_city: "Jakarta",
      shipping_state: "DKI Jakarta",
      shipping_zip_code: "10110",
      shipping_country: { name: "Indonesia" },
    };
    const { container } = render(
      capturedProps.templateItem({ dataRow, deleteItem: vi.fn() }),
    );
    expect(container).toHaveTextContent(
      "TR:core.branch.columns.is_main_branch",
    );
    expect(container.querySelector("span.badge.primary")).not.toBeNull();
  });

  it("tidak merender badge Main Branch ketika is_main_branch false", () => {
    render(<Index />);
    const dataRow = {
      id: 3,
      name: "Cabang Bandung",
      is_main_branch: false,
      shipping_street: "Jl. Asia Afrika",
      shipping_city: "Bandung",
      shipping_state: "Jawa Barat",
      shipping_zip_code: "40111",
      shipping_country: { name: "Indonesia" },
    };
    const { container } = render(
      capturedProps.templateItem({ dataRow, deleteItem: vi.fn() }),
    );
    expect(container.querySelector("span.badge.primary")).toBeNull();
  });

  it("shipping_country bernilai null tidak melempar error (optional chaining)", () => {
    render(<Index />);
    const dataRow = {
      id: 4,
      name: "Cabang Tanpa Negara",
      is_main_branch: false,
      shipping_street: "Jl. Merdeka",
      shipping_city: "Surabaya",
      shipping_state: "Jawa Timur",
      shipping_zip_code: "60111",
      shipping_country: null,
    };
    let container;
    expect(() => {
      ({ container } = render(
        capturedProps.templateItem({ dataRow, deleteItem: vi.fn() }),
      ));
    }).not.toThrow();
    expect(container).toHaveTextContent("Cabang Tanpa Negara");
  });

  it('Link (as="button") memicu router.visit ke route branches.show dengan id dataRow', async () => {
    // Link diberi prop as="button" di templateItem, sehingga elemen yang
    // dirender adalah <button type="button">, bukan <a href>. Perilaku
    // navigasi custom Link (@/Components/Link) memanggil router.visit(href)
    // saat diklik -- itu yang diverifikasi di sini, bukan atribut href.
    const user = userEvent.setup();
    const { router } = await import("@inertiajs/core");
    const visitSpy = vi.spyOn(router, "visit").mockImplementation(() => {});
    render(<Index />);
    const dataRow = {
      id: 9,
      name: "Cabang Medan",
      is_main_branch: false,
      shipping_street: "Jl. Gatot Subroto",
      shipping_city: "Medan",
      shipping_state: "Sumatera Utara",
      shipping_zip_code: "20111",
      shipping_country: { name: "Indonesia" },
    };
    const { container } = render(
      capturedProps.templateItem({ dataRow, deleteItem: vi.fn() }),
    );
    const button = container.querySelector("button");
    expect(button).toHaveAttribute("type", "button");
    await user.click(button);
    expect(visitSpy).toHaveBeenCalledWith("branches.show/9", expect.anything());
    visitSpy.mockRestore();
  });
});
