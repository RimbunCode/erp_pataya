import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

let capturedProps = null;
vi.mock("@/Pages/Core/DataTable2", () => ({
  default: (props) => {
    capturedProps = props;
    return null; // detail lain DataTable2 di luar cakupan test ini
  },
}));

import Index from "./Index";

window.route = (name, param) => (param != null ? `${name}/${param}` : name);

describe("Settings Currencies Index", () => {
  it("meneruskan templateItem, classNameDialog, dan form ke DataTable2", () => {
    render(<Index />);
    expect(typeof capturedProps.templateItem).toBe("function");
    expect(capturedProps.classNameDialog).toBe("max-w-4xl!");
    expect(capturedProps.form).toBeTruthy();
  });

  it("templateItem merender code, name, dan symbol dataRow", () => {
    render(<Index />);
    const dataRow = { code: "USD", name: "US Dollar", symbol: "$" };
    const { container } = render(
      capturedProps.templateItem({ dataRow, deleteItem: vi.fn() }),
    );
    expect(container).toHaveTextContent("USD");
    expect(container).toHaveTextContent("US Dollar");
    expect(container).toHaveTextContent("($)");
  });

  it("tidak menampilkan simbol saat dataRow.symbol kosong", () => {
    render(<Index />);
    const dataRow = { code: "XXX", name: "Tanpa Simbol", symbol: null };
    const { container } = render(
      capturedProps.templateItem({ dataRow, deleteItem: vi.fn() }),
    );
    expect(container).not.toHaveTextContent("(");
  });

  it("menampilkan number_format saat tersedia pada dataRow", () => {
    render(<Index />);
    const dataRow = {
      code: "IDR",
      name: "Rupiah",
      symbol: "Rp",
      number_format: "#.###,##",
    };
    const { container } = render(
      capturedProps.templateItem({ dataRow, deleteItem: vi.fn() }),
    );
    expect(container).toHaveTextContent("#.###,##");
  });

  it("tidak merender baris number_format saat tidak tersedia", () => {
    render(<Index />);
    const dataRow = { code: "EUR", name: "Euro", symbol: "€" };
    const { container } = render(
      capturedProps.templateItem({ dataRow, deleteItem: vi.fn() }),
    );
    // Hanya 1 <p> (baris nama+kode+simbol) yang seharusnya dirender,
    // baris <p> kedua (number_format) tidak muncul.
    expect(container.querySelectorAll("p").length).toBe(1);
  });

  it("Link (as='button') dirender sebagai <button>, bukan <a>", () => {
    render(<Index />);
    const dataRow = { code: "JPY", name: "Yen", symbol: "¥" };
    const { container } = render(
      capturedProps.templateItem({ dataRow, deleteItem: vi.fn() }),
    );
    const button = container.querySelector("button");
    expect(button).toHaveAttribute("type", "button");
    expect(button).not.toHaveAttribute("href");
  });

  it('Link (as="button") memicu router.visit ke route currencies.show dengan code dataRow', async () => {
    // Link diberi prop as="button" di templateItem, sehingga elemen yang
    // dirender adalah <button type="button">, bukan <a href>. Perilaku
    // navigasi custom Link (@/Components/Link) memanggil router.visit(href)
    // saat diklik -- itu yang diverifikasi di sini, bukan atribut href.
    const user = userEvent.setup();
    const { router } = await import("@inertiajs/core");
    const visitSpy = vi.spyOn(router, "visit").mockImplementation(() => {});
    render(<Index />);
    const dataRow = { code: "GBP", name: "Pound Sterling", symbol: "£" };
    const { container } = render(
      capturedProps.templateItem({ dataRow, deleteItem: vi.fn() }),
    );
    const button = container.querySelector("button");
    await user.click(button);
    expect(visitSpy).toHaveBeenCalledWith(
      "currencies.show/GBP",
      expect.anything(),
    );
    visitSpy.mockRestore();
  });
});
