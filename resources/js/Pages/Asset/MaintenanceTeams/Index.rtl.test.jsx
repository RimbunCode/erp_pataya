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

describe("<MaintenanceTeams> Index", () => {
  it("meneruskan templateItem, form, classNameDialog ke DataTable2", () => {
    render(<Index />);
    expect(typeof capturedProps.templateItem).toBe("function");
    expect(capturedProps.classNameDialog).toBe("max-w-4xl!");
    expect(capturedProps.form).toBeTruthy();
  });

  it("templateItem merender team_name di dalam Link (as=button) show", () => {
    render(<Index />);
    const dataRow = { id: 7, team_name: "Tim Maintenance A" };
    const deleteItem = vi.fn();
    const { container } = render(
      capturedProps.templateItem({ dataRow, deleteItem }),
    );

    expect(container).toHaveTextContent("Tim Maintenance A");
    // Link as="button" merender elemen <button> asli (bukan <a>), jadi tidak
    // punya atribut href di DOM -- navigasi ditangani lewat router.visit() via onClick.
    const link = screen.getByRole("button", { name: "Tim Maintenance A" });
    expect(link.tagName).toBe("BUTTON");
    expect(link).toHaveAttribute("type", "button");
    expect(link).not.toHaveAttribute("href");
  });

  it("templateItem tidak merender tombol hapus manual (hapus lewat ⋯ menu DataTable2)", () => {
    render(<Index />);
    const { container } = render(
      capturedProps.templateItem({ dataRow: { id: 3, team_name: "Tim Maintenance B" } }),
    );
    // Hanya Link as="button" yang tersisa; hapus dikelola menu ⋯ DataTable2.
    expect(container.querySelectorAll("button")).toHaveLength(1);
  });
});
