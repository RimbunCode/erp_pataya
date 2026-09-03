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

vi.mock("./Form", () => ({
  default: () => null, // Form berat (banyak dependency), tidak relevan di sini
}));

import Index from "./Index";

window.route = (name, param) => (param != null ? `${name}/${param}` : name);

describe("Finances SalesInvoice Index", () => {
  it("meneruskan templateItem, form, dan classNameDialog ke DataTable2", () => {
    render(<Index />);
    expect(typeof capturedProps.templateItem).toBe("function");
    expect(capturedProps.classNameDialog).toBe("max-w-(--breakpoint-2xl)!");
    expect(capturedProps.form).toBeTruthy();
  });

  it("templateItem merender type (diterjemahkan) dan name dataRow", () => {
    render(<Index />);
    const dataRow = { id: 1, type: "invoice", name: "SINV-0001" };
    const { container } = render(
      capturedProps.templateItem({ dataRow, deleteItem: vi.fn() }),
    );
    expect(container).toHaveTextContent(
      "TR:finance.salesInvoice.types.invoice",
    );
    expect(container).toHaveTextContent("SINV-0001");
  });

  it("templateItem menerjemahkan type berbeda sesuai dataRow.type", () => {
    render(<Index />);
    const dataRow = { id: 2, type: "credit_note", name: "SINV-0002" };
    const { container } = render(
      capturedProps.templateItem({ dataRow, deleteItem: vi.fn() }),
    );
    expect(container).toHaveTextContent(
      "TR:finance.salesInvoice.types.credit_note",
    );
    expect(container).not.toHaveTextContent(
      "TR:finance.salesInvoice.types.invoice",
    );
  });

  it('Link (as="button") memicu router.visit ke route salesInvoice.show dengan id dataRow', async () => {
    // Link diberi prop as="button" di templateItem, sehingga elemen yang
    // dirender adalah <button type="button">, bukan <a href>. Perilaku
    // navigasi custom Link (@/Components/Link) memanggil router.visit(href)
    // saat diklik -- itu yang diverifikasi di sini, bukan atribut href.
    const user = userEvent.setup();
    const { router } = await import("@inertiajs/core");
    const visitSpy = vi.spyOn(router, "visit").mockImplementation(() => {});
    render(<Index />);
    const dataRow = { id: 7, type: "invoice", name: "SINV-0007" };
    const { container } = render(
      capturedProps.templateItem({ dataRow, deleteItem: vi.fn() }),
    );
    const button = container.querySelector("button");
    expect(button).toHaveAttribute("type", "button");
    await user.click(button);
    expect(visitSpy).toHaveBeenCalledWith(
      "salesInvoice.show/7",
      expect.anything(),
    );
    visitSpy.mockRestore();
  });

  it("mengklik Link tidak melempar error (tidak ada tombol hapus di templateItem ini)", async () => {
    const user = userEvent.setup();
    const { router } = await import("@inertiajs/core");
    const visitSpy = vi.spyOn(router, "visit").mockImplementation(() => {});
    render(<Index />);
    const dataRow = { id: 9, type: "invoice", name: "SINV-0009" };
    const { container } = render(
      capturedProps.templateItem({ dataRow, deleteItem: vi.fn() }),
    );
    const button = container.querySelector("button");
    await user.click(button);
    // Link custom (Components/Link) tidak melakukan navigasi nyata di jsdom
    // (router.visit di-mock); cukup pastikan klik tidak melempar error.
    expect(button).toBeInTheDocument();
    visitSpy.mockRestore();
  });
});
