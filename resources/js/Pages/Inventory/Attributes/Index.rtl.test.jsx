import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
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

describe("Inventory/Attributes Index", () => {
  it("meneruskan templateItem, form, classNameDialog ke DataTable2", () => {
    render(<Index />);
    expect(typeof capturedProps.templateItem).toBe("function");
    expect(capturedProps.classNameDialog).toBe("max-w-4xl!");
    expect(capturedProps.form).toBeTruthy();
  });

  it("templateItem merender nama atribut sebagai tombol navigasi (Link as='button')", () => {
    render(<Index />);
    const dataRow = { id: 3, name: "Warna" };
    const deleteItem = vi.fn();
    render(capturedProps.templateItem({ dataRow, deleteItem }));

    // Link di-render dgn as="button" (lihat Link.jsx: method default "get"
    // sudah eksplisit "button" dari source, sehingga elemen DOM adalah
    // <button type="button">, BUKAN <a href=...> -- href hanya dipakai
    // internal utk router.visit(), tidak muncul sbg atribut DOM).
    const link = screen.getByRole("button", { name: "Warna" });
    expect(link.tagName).toBe("BUTTON");
    expect(link).not.toHaveAttribute("href");
  });

  it("tombol hapus memanggil deleteItem tanpa argumen saat diklik", async () => {
    const user = userEvent.setup();
    render(<Index />);
    const dataRow = { id: 4, name: "Ukuran" };
    const deleteItem = vi.fn();
    render(capturedProps.templateItem({ dataRow, deleteItem }));

    // Ada 2 <button>: tombol nama atribut (Link as="button") dan tombol
    // hapus (icon-only, tanpa accessible name) -- ambil yg terakhir.
    const buttons = screen.getAllByRole("button");
    const deleteButton = buttons[buttons.length - 1];
    await user.click(deleteButton);

    expect(deleteItem).toHaveBeenCalledTimes(1);
    expect(deleteItem).toHaveBeenCalledWith();
  });
});
