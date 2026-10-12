import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

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
    const dataRow = { id: 7, category_name: "Kendaraan" };
    const deleteItem = vi.fn();
    render(capturedProps.templateItem({ dataRow, deleteItem }));

    // Link di-render dgn as="button" (lihat Link.jsx: method default "get" tapi
    // as sudah eksplisit "button" dari source, sehingga elemen DOM adalah
    // <button type="button">, BUKAN <a href=...> -- href hanya dipakai
    // internal utk router.visit(), tidak muncul sbg atribut DOM).
    const link = screen.getByRole("button", { name: "Kendaraan" });
    expect(link.tagName).toBe("BUTTON");
    expect(link).not.toHaveAttribute("href");
  });

  it("templateItem tidak merender tombol hapus manual (hapus lewat ⋯ menu DataTable2)", () => {
    render(<Index />);
    const { container } = render(
      capturedProps.templateItem({ dataRow: { id: 10, category_name: "Furniture" } }),
    );
    // Hanya Link as="button" yang tersisa; hapus dikelola menu ⋯ DataTable2.
    expect(container.querySelectorAll("button")).toHaveLength(1);
  });
});
