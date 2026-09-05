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

describe("Asset Maintenances Index", () => {
  it("meneruskan templateItem ke DataTable2", () => {
    render(<Index />);
    expect(typeof capturedProps.templateItem).toBe("function");
  });

  it("templateItem merender nama asset dan nama tim maintenance sebagai tombol navigasi (Link as='button')", () => {
    render(<Index />);
    const dataRow = {
      id: 5,
      asset: { asset_name: "Forklift Toyota" },
      maintenanceTeam: { team_name: "Tim Maintenance A" },
    };
    const deleteItem = vi.fn();
    render(capturedProps.templateItem({ dataRow, deleteItem }));

    expect(screen.getByText("Forklift Toyota")).toBeInTheDocument();
    expect(screen.getByText("Tim Maintenance A")).toBeInTheDocument();

    // Link di-render dgn as="button" (lihat Link.jsx: prop `as` eksplisit
    // "button" dari source), sehingga elemen DOM adalah <button type="button">,
    // BUKAN <a href=...> -- href hanya dipakai internal utk router.visit(),
    // tidak muncul sbg atribut DOM. Tidak diklik di sini (klik nyata memicu
    // Inertia router.visit() yang butuh app context penuh, di luar cakupan
    // test render templateItem ini).
    const button = screen.getByRole("button");
    expect(button.tagName).toBe("BUTTON");
    expect(button).not.toHaveAttribute("href");
  });

  it("menangani dataRow tanpa asset atau maintenanceTeam tanpa error", () => {
    render(<Index />);
    const dataRow = { id: 9 };
    expect(() =>
      render(capturedProps.templateItem({ dataRow, deleteItem: vi.fn() })),
    ).not.toThrow();
  });
});
