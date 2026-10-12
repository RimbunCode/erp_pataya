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

describe("Inventory Units Index", () => {
  it("meneruskan templateItem, classNameDialog, dan form ke DataTable2", () => {
    render(<Index />);
    expect(typeof capturedProps.templateItem).toBe("function");
    expect(capturedProps.classNameDialog).toBe("max-w-4xl!");
    expect(capturedProps.form).toBeTruthy();
  });

  it("templateItem merender group, name, dan code dataRow", () => {
    render(<Index />);
    const dataRow = {
      id: 1,
      group: "Weight",
      name: "Kilogram",
      code: "KG",
      is_default: false,
    };
    const { container } = render(
      capturedProps.templateItem({ dataRow, deleteItem: vi.fn() }),
    );
    expect(container).toHaveTextContent("Weight");
    expect(container).toHaveTextContent("Kilogram (KG)");
  });


  it("templateItem tidak merender tombol hapus manual (hapus lewat ⋯ menu DataTable2)", () => {
    render(<Index />);
    for (const is_default of [false, true]) {
      const { container } = render(
        capturedProps.templateItem({
          dataRow: { id: 3, group: "Length", name: "Meter", code: "M", is_default },
        }),
      );
      // Hanya Link as="button" yang tersisa, baik unit default maupun bukan.
      expect(container.querySelectorAll("button")).toHaveLength(1);
    }
  });

  it('Link (as="button") memicu router.visit ke route units.show dengan id dataRow', async () => {
    // Link diberi prop as="button" di templateItem, sehingga elemen yang
    // dirender adalah <button type="button">, bukan <a href>. Perilaku
    // navigasi custom Link (@/Components/Link) memanggil router.visit(href)
    // saat diklik -- itu yang diverifikasi di sini, bukan atribut href.
    const user = userEvent.setup();
    const { router } = await import("@inertiajs/core");
    const visitSpy = vi.spyOn(router, "visit").mockImplementation(() => {});
    render(<Index />);
    const dataRow = {
      id: 5,
      group: "Volume",
      name: "Liter",
      code: "L",
      is_default: false,
    };
    const { container } = render(
      capturedProps.templateItem({ dataRow, deleteItem: vi.fn() }),
    );
    const linkButton = container.querySelector('button[type="button"]');
    expect(linkButton).toBeInTheDocument();
    await user.click(linkButton);
    expect(visitSpy).toHaveBeenCalledWith("units.show/5", expect.anything());
    visitSpy.mockRestore();
  });
});
