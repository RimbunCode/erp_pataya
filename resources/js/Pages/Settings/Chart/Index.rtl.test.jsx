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

describe("Settings Chart Index", () => {
  it("meneruskan templateItem, form, dan classNameDialog ke DataTable2", () => {
    render(<Index />);
    expect(typeof capturedProps.templateItem).toBe("function");
    expect(capturedProps.classNameDialog).toBe("max-w-(--breakpoint-2xl)!");
    expect(capturedProps.form).toBeTruthy();
  });

  it("templateItem merender chart_name dan visual_type (diterjemahkan) dari dataRow", () => {
    render(<Index />);
    const dataRow = {
      id: 1,
      chart_name: "Penjualan Bulanan",
      visual_type: "bar",
    };
    const { container } = render(
      capturedProps.templateItem({ dataRow, deleteItem: vi.fn() }),
    );
    expect(container).toHaveTextContent("Penjualan Bulanan");
    expect(container).toHaveTextContent("TR:settings.chart.visual_types.bar");
  });

  it('Link (as="button") memicu router.visit ke route charts.show dengan id dataRow', async () => {
    // Link diberi prop as="button" di templateItem, sehingga elemen yang
    // dirender adalah <button type="button">, bukan <a href>. Perilaku
    // navigasi custom Link (@/Components/Link) memanggil router.visit(href)
    // saat diklik -- itu yang diverifikasi di sini, bukan atribut href.
    const user = userEvent.setup();
    const { router } = await import("@inertiajs/core");
    const visitSpy = vi.spyOn(router, "visit").mockImplementation(() => {});
    render(<Index />);
    const dataRow = { id: 7, chart_name: "Grafik Stok", visual_type: "line" };
    const { container } = render(
      capturedProps.templateItem({ dataRow, deleteItem: vi.fn() }),
    );
    const button = container.querySelector("button");
    expect(button).toHaveAttribute("type", "button");
    await user.click(button);
    expect(visitSpy).toHaveBeenCalledWith("charts.show/7", expect.anything());
    visitSpy.mockRestore();
  });

  it("templateItem tidak melempar error untuk visual_type berbeda (pie)", () => {
    render(<Index />);
    const dataRow = {
      id: 2,
      chart_name: "Distribusi Kategori",
      visual_type: "pie",
    };
    let container;
    expect(() => {
      ({ container } = render(
        capturedProps.templateItem({ dataRow, deleteItem: vi.fn() }),
      ));
    }).not.toThrow();
    expect(container).toHaveTextContent("TR:settings.chart.visual_types.pie");
    expect(container).toHaveTextContent("Distribusi Kategori");
  });
});
