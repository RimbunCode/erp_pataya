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

describe("Inventory Warehouses Index", () => {
  it("meneruskan templateItem, classNameDialog, dan form ke DataTable2", () => {
    render(<Index />);
    expect(typeof capturedProps.templateItem).toBe("function");
    expect(capturedProps.classNameDialog).toBe("max-w-4xl!");
    expect(capturedProps.form).toBeTruthy();
  });

  it("templateItem merender branch_name, code, dan name dataRow", () => {
    render(<Index />);
    const dataRow = {
      id: 1,
      branch_name: "Cabang Jakarta",
      code: "WH-0001",
      name: "Gudang Utama",
    };
    const { container } = render(
      capturedProps.templateItem({ dataRow, deleteItem: vi.fn() }),
    );
    expect(container).toHaveTextContent("Cabang Jakarta");
    expect(container).toHaveTextContent("(WH-0001) Gudang Utama");
  });

  it('Link (as="button") memicu router.visit ke route warehouses.show dengan id dataRow', async () => {
    // Link custom (@/Components/Link) dengan as="button" dirender sebagai
    // <button type="button">, tanpa atribut href -- klik memicu router.visit
    // internal, itu yang diverifikasi di sini.
    const user = userEvent.setup();
    const { router } = await import("@inertiajs/core");
    const visitSpy = vi.spyOn(router, "visit").mockImplementation(() => {});
    render(<Index />);
    const dataRow = {
      id: 7,
      branch_name: "Cabang Surabaya",
      code: "WH-0007",
      name: "Gudang Cabang",
    };
    const { container } = render(
      capturedProps.templateItem({ dataRow, deleteItem: vi.fn() }),
    );
    const buttons = container.querySelectorAll("button");
    const linkButton = buttons[0];
    expect(linkButton).toHaveAttribute("type", "button");
    expect(linkButton).not.toHaveAttribute("href");
    await user.click(linkButton);
    expect(visitSpy).toHaveBeenCalledWith(
      "warehouses.show/7",
      expect.anything(),
    );
    visitSpy.mockRestore();
  });

  it("mengklik tombol hapus memanggil deleteItem tanpa argumen", async () => {
    const user = userEvent.setup();
    render(<Index />);
    const dataRow = {
      id: 3,
      branch_name: "Cabang Bandung",
      code: "WH-0003",
      name: "Gudang Kecil",
    };
    const deleteItem = vi.fn();
    const { container } = render(
      capturedProps.templateItem({ dataRow, deleteItem }),
    );
    const buttons = container.querySelectorAll("button");
    const deleteButton = buttons[buttons.length - 1];
    await user.click(deleteButton);
    expect(deleteItem).toHaveBeenCalledTimes(1);
    expect(deleteItem).toHaveBeenCalledWith();
  });
});
