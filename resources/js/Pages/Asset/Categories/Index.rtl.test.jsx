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

describe("Asset/Categories Index", () => {
  it("meneruskan templateItem, form, classNameDialog ke DataTable2", () => {
    render(<Index />);
    expect(typeof capturedProps.templateItem).toBe("function");
    expect(capturedProps.classNameDialog).toBe("max-w-4xl!");
    expect(capturedProps.form).toBeTruthy();
  });

  it("templateItem merender nama kategori sebagai tombol navigasi (Link as='button')", () => {
    render(<Index />);
    const dataRow = { id: 7, category_name: "Kendaraan", is_rentable: false };
    const deleteItem = vi.fn();
    render(capturedProps.templateItem({ dataRow, deleteItem }));

    // Link di-render dgn as="button" (lihat Link.jsx: method default "get" tapi
    // as sudah eksplisit "button" dari source, sehingga elemen DOM adalah
    // <button type="button">, BUKAN <a href=...> -- href hanya dipakai
    // internal utk router.visit(), tidak muncul sbg atribut DOM).
    const link = screen.getByRole("button", { name: "Kendaraan" });
    expect(link.tagName).toBe("BUTTON");
    expect(link).not.toHaveAttribute("href");
    expect(
      screen.queryByText("TR:asset.category.columns.is_rentable"),
    ).not.toBeInTheDocument();
  });

  it("menampilkan label is_rentable saat dataRow.is_rentable true", () => {
    render(<Index />);
    const dataRow = { id: 8, category_name: "Alat Berat", is_rentable: true };
    const deleteItem = vi.fn();
    render(capturedProps.templateItem({ dataRow, deleteItem }));

    expect(
      screen.getByText("TR:asset.category.columns.is_rentable"),
    ).toBeInTheDocument();
  });

  it("tidak menampilkan label is_rentable saat dataRow.is_rentable false", () => {
    render(<Index />);
    const dataRow = { id: 9, category_name: "Elektronik", is_rentable: false };
    const deleteItem = vi.fn();
    render(capturedProps.templateItem({ dataRow, deleteItem }));

    expect(
      screen.queryByText("TR:asset.category.columns.is_rentable"),
    ).not.toBeInTheDocument();
  });

  it("tombol hapus memanggil deleteItem tanpa argumen saat diklik", async () => {
    const user = userEvent.setup();
    render(<Index />);
    const dataRow = { id: 10, category_name: "Furniture", is_rentable: false };
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
