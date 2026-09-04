import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
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

describe("Inventory/Categories Index", () => {
  it("meneruskan templateItem, form, classNameDialog ke DataTable2", () => {
    render(<Index />);
    expect(typeof capturedProps.templateItem).toBe("function");
    expect(capturedProps.classNameDialog).toBe("max-w-4xl!");
    expect(capturedProps.form).toBeTruthy();
  });

  it("templateItem merender type & name kategori di dalam Link as='button'", () => {
    render(<Index />);
    const dataRow = { id: 3, type: "raw_material", name: "Besi Baja" };
    const deleteItem = vi.fn();
    render(capturedProps.templateItem({ dataRow, deleteItem }));

    // Link di-render dgn as="button" (lihat Link.jsx: eksplisit as="button"
    // dari source, sehingga elemen DOM adalah <button type="button">, BUKAN
    // <a href=...> -- href hanya dipakai internal utk router.visit()).
    const link = screen.getByRole("button", { name: /Besi Baja/ });
    expect(link.tagName).toBe("BUTTON");
    expect(link).not.toHaveAttribute("href");
    expect(
      screen.getByText("TR:inventory.category.types.raw_material"),
    ).toBeInTheDocument();
    expect(screen.getByText("Besi Baja")).toBeInTheDocument();
  });

  it("templateItem menyusun key i18n type sesuai dataRow.type yg berbeda", () => {
    render(<Index />);
    const dataRow = { id: 4, type: "finished_good", name: "Kursi Kayu" };
    const deleteItem = vi.fn();
    render(capturedProps.templateItem({ dataRow, deleteItem }));

    expect(
      screen.getByText("TR:inventory.category.types.finished_good"),
    ).toBeInTheDocument();
  });

  it("tombol hapus memanggil deleteItem tanpa argumen saat diklik", async () => {
    const user = userEvent.setup();
    render(<Index />);
    const dataRow = { id: 5, type: "raw_material", name: "Kain Katun" };
    const deleteItem = vi.fn();
    render(capturedProps.templateItem({ dataRow, deleteItem }));

    // Ada 2 <button>: tombol nama kategori (Link as="button") dan tombol
    // hapus (icon-only, tanpa accessible name) -- ambil yg terakhir.
    const buttons = screen.getAllByRole("button");
    const deleteButton = buttons[buttons.length - 1];
    await user.click(deleteButton);

    expect(deleteItem).toHaveBeenCalledTimes(1);
    expect(deleteItem).toHaveBeenCalledWith();
  });
});
