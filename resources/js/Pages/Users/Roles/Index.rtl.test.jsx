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

describe("Users Roles Index", () => {
  it("meneruskan templateItem, form, dan classNameDialog ke DataTable2", () => {
    render(<Index />);
    expect(typeof capturedProps.templateItem).toBe("function");
    expect(capturedProps.classNameDialog).toBe("max-w-(--breakpoint-2xl)!");
    expect(capturedProps.form).toBeTruthy();
  });

  it("templateItem merender name dan badge Enabled saat is_disabled false", () => {
    render(<Index />);
    const dataRow = { id: 1, name: "Admin", is_disabled: false };
    const { container } = render(
      capturedProps.templateItem({ dataRow, deleteItem: vi.fn() }),
    );
    expect(container).toHaveTextContent("Admin");
    expect(container).toHaveTextContent("Enabled");
    expect(container).not.toHaveTextContent("Disabled");
  });

  it("templateItem merender badge Disabled saat is_disabled true", () => {
    render(<Index />);
    const dataRow = { id: 2, name: "Guest", is_disabled: true };
    const { container } = render(
      capturedProps.templateItem({ dataRow, deleteItem: vi.fn() }),
    );
    expect(container).toHaveTextContent("Guest");
    expect(container).toHaveTextContent("Disabled");
  });

  it("badge memakai className error saat disabled dan primary saat enabled", () => {
    render(<Index />);
    const enabledRow = { id: 3, name: "Manager", is_disabled: false };
    const { container: enabledContainer } = render(
      capturedProps.templateItem({ dataRow: enabledRow, deleteItem: vi.fn() }),
    );
    const enabledBadge = enabledContainer.querySelector("p.badge");
    expect(enabledBadge).toHaveClass("primary");
    expect(enabledBadge).not.toHaveClass("error");

    const disabledRow = { id: 4, name: "Locked", is_disabled: true };
    const { container: disabledContainer } = render(
      capturedProps.templateItem({ dataRow: disabledRow, deleteItem: vi.fn() }),
    );
    const disabledBadge = disabledContainer.querySelector("p.badge");
    expect(disabledBadge).toHaveClass("error");
    expect(disabledBadge).not.toHaveClass("primary");
  });

  it('Link (as="button") memicu router.visit ke route roles.show dengan id dataRow', async () => {
    // Link diberi prop as="button" di templateItem, sehingga elemen yang
    // dirender adalah <button type="button">, bukan <a href>. Perilaku
    // navigasi custom Link (@/Components/Link) memanggil router.visit(href)
    // saat diklik -- itu yang diverifikasi di sini, bukan atribut href.
    const user = userEvent.setup();
    const { router } = await import("@inertiajs/core");
    const visitSpy = vi.spyOn(router, "visit").mockImplementation(() => {});
    render(<Index />);
    const dataRow = { id: 5, name: "Editor", is_disabled: false };
    const { container } = render(
      capturedProps.templateItem({ dataRow, deleteItem: vi.fn() }),
    );
    const button = container.querySelector("button");
    expect(button).toHaveAttribute("type", "button");
    await user.click(button);
    expect(visitSpy).toHaveBeenCalledWith("roles.show/5", expect.anything());
    visitSpy.mockRestore();
  });
});
