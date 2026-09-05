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

describe("Inventory Items Index", () => {
  it("meneruskan templateItem, classNameDialog, dan form ke DataTable2", () => {
    render(<Index />);
    expect(typeof capturedProps.templateItem).toBe("function");
    expect(capturedProps.classNameDialog).toBe("max-w-6xl!");
    expect(capturedProps.form).toBeTruthy();
  });

  it("templateItem merender name dataRow", () => {
    render(<Index />);
    const dataRow = { id: 1, name: "Kertas A4" };
    const { container } = render(
      capturedProps.templateItem({ dataRow, deleteItem: vi.fn() }),
    );
    expect(container).toHaveTextContent("Kertas A4");
  });

  it('Link (as="button") memicu router.visit ke route items.show dengan id dataRow', async () => {
    // Link custom (@/Components/Link) dengan as="button" dirender sebagai
    // <button type="button">, tanpa atribut href -- klik memicu router.visit
    // internal, itu yang diverifikasi di sini.
    const user = userEvent.setup();
    const { router } = await import("@inertiajs/core");
    const visitSpy = vi.spyOn(router, "visit").mockImplementation(() => {});
    render(<Index />);
    const dataRow = { id: 7, name: "Pulpen Biru" };
    const { container } = render(
      capturedProps.templateItem({ dataRow, deleteItem: vi.fn() }),
    );
    const buttons = container.querySelectorAll("button");
    const linkButton = buttons[0];
    expect(linkButton).toHaveAttribute("type", "button");
    expect(linkButton).not.toHaveAttribute("href");
    await user.click(linkButton);
    expect(visitSpy).toHaveBeenCalledWith("items.show/7", expect.anything());
    visitSpy.mockRestore();
  });

  it("href Link kosong ('') saat dataRow.id falsy, tidak memicu router.visit dengan id", async () => {
    // Sesuai source: href={dataRow.id ? route("items.show", dataRow.id) : ""}
    const user = userEvent.setup();
    const { router } = await import("@inertiajs/core");
    const visitSpy = vi.spyOn(router, "visit").mockImplementation(() => {});
    render(<Index />);
    const dataRow = { id: 0, name: "Item Tanpa Id" };
    const { container } = render(
      capturedProps.templateItem({ dataRow, deleteItem: vi.fn() }),
    );
    const linkButton = container.querySelectorAll("button")[0];
    await user.click(linkButton);
    expect(visitSpy).not.toHaveBeenCalledWith(
      "items.show/0",
      expect.anything(),
    );
    visitSpy.mockRestore();
  });

  it("mengklik tombol hapus memanggil deleteItem tanpa argumen", async () => {
    const user = userEvent.setup();
    render(<Index />);
    const dataRow = { id: 3, name: "Gunting Kecil" };
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
