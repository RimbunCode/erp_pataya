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

  it("menyembunyikan tombol hapus saat dataRow.is_default true", () => {
    render(<Index />);
    const dataRow = {
      id: 2,
      group: "Weight",
      name: "Gram",
      code: "G",
      is_default: true,
    };
    const { container } = render(
      capturedProps.templateItem({ dataRow, deleteItem: vi.fn() }),
    );
    expect(container.querySelector("button:not([type])")).toBeFalsy();
    // Tidak ada tombol hapus (destructive) sama sekali dirender.
    expect(container.querySelectorAll("button").length).toBe(1); // hanya Link as="button"
  });

  it("menampilkan tombol hapus saat dataRow.is_default false, klik memanggil deleteItem()", async () => {
    const user = userEvent.setup();
    render(<Index />);
    const dataRow = {
      id: 3,
      group: "Length",
      name: "Meter",
      code: "M",
      is_default: false,
    };
    const deleteItem = vi.fn();
    const { container } = render(
      capturedProps.templateItem({ dataRow, deleteItem }),
    );
    const buttons = container.querySelectorAll("button");
    expect(buttons.length).toBe(2); // Link as="button" + tombol hapus destructive
    const deleteButton = buttons[1];
    await user.click(deleteButton);
    expect(deleteItem).toHaveBeenCalledTimes(1);
    expect(deleteItem).toHaveBeenCalledWith();
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
