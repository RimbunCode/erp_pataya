import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const stableT = (key) => `TR:${key}`;
vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({ t: stableT }),
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

describe("Finances PurchaseInvoice Index", () => {
  it("meneruskan templateItem, form, dan classNameDialog ke DataTable2", () => {
    render(<Index />);
    expect(typeof capturedProps.templateItem).toBe("function");
    expect(capturedProps.classNameDialog).toBe("max-w-(--breakpoint-2xl)!");
    expect(capturedProps.form).toBeTruthy();
  });

  it("templateItem merender type (diterjemahkan) dan name dataRow", () => {
    render(<Index />);
    const dataRow = { id: 1, type: "standard", name: "PI-0001" };
    const { container } = render(
      capturedProps.templateItem({ dataRow, deleteItem: vi.fn() }),
    );
    expect(container).toHaveTextContent(
      "TR:finance.purchaseInvoice.types.standard",
    );
    expect(container).toHaveTextContent("PI-0001");
  });

  it("dataRow.type berbeda menghasilkan key terjemahan yang sesuai", () => {
    render(<Index />);
    const dataRow = { id: 2, type: "return", name: "PI-0002" };
    const { container } = render(
      capturedProps.templateItem({ dataRow, deleteItem: vi.fn() }),
    );
    expect(container).toHaveTextContent(
      "TR:finance.purchaseInvoice.types.return",
    );
    expect(container).toHaveTextContent("PI-0002");
  });

  it('Link (as="button") merender <button type="button"> tanpa href', () => {
    render(<Index />);
    const dataRow = { id: 3, type: "standard", name: "PI-0003" };
    const { container } = render(
      capturedProps.templateItem({ dataRow, deleteItem: vi.fn() }),
    );
    const button = container.querySelector("button");
    expect(button).toHaveAttribute("type", "button");
    expect(container.querySelector("a")).not.toBeInTheDocument();
  });

  it("mengklik Link memicu router.visit ke route purchaseInvoice.show dengan id dataRow", async () => {
    const user = userEvent.setup();
    const { router } = await import("@inertiajs/core");
    const visitSpy = vi.spyOn(router, "visit").mockImplementation(() => {});
    render(<Index />);
    const dataRow = { id: 7, type: "standard", name: "PI-0007" };
    const { container } = render(
      capturedProps.templateItem({ dataRow, deleteItem: vi.fn() }),
    );
    const button = container.querySelector("button");
    await user.click(button);
    expect(visitSpy).toHaveBeenCalledWith(
      "purchaseInvoice.show/7",
      expect.anything(),
    );
    visitSpy.mockRestore();
  });

  it("templateItem tidak merender tombol hapus (tidak ada UI delete di templateItem ini)", () => {
    render(<Index />);
    const dataRow = { id: 4, type: "standard", name: "PI-0004" };
    const { container } = render(
      capturedProps.templateItem({ dataRow, deleteItem: vi.fn() }),
    );
    expect(container.querySelectorAll("button").length).toBe(1);
  });
});
