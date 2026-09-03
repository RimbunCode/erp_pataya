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

describe("Asset Services Index", () => {
  it("meneruskan templateItem ke DataTable2", () => {
    render(<Index />);
    expect(typeof capturedProps.templateItem).toBe("function");
  });

  it("templateItem merender code dan type (diterjemahkan) dataRow", () => {
    render(<Index />);
    const dataRow = { id: 1, code: "AS-0001", type: "internal", status: [] };
    const { container } = render(
      capturedProps.templateItem({ dataRow, deleteItem: vi.fn() }),
    );
    expect(container).toHaveTextContent("AS-0001");
    expect(container).toHaveTextContent("TR:asset.service.type.internal");
  });

  it("merender badge status (diterjemahkan) untuk setiap entri dataRow.status", () => {
    render(<Index />);
    const dataRow = {
      id: 2,
      code: "AS-0002",
      type: "external",
      status: ["draft", "submitted"],
    };
    const { container } = render(
      capturedProps.templateItem({ dataRow, deleteItem: vi.fn() }),
    );
    expect(container).toHaveTextContent("TR:status.draft");
    expect(container).toHaveTextContent("TR:status.submitted");
    expect(container.querySelectorAll("span").length).toBe(2);
  });

  it("dataRow.status undefined tidak melempar error dan tidak merender badge apapun", () => {
    render(<Index />);
    const dataRow = { id: 3, code: "AS-0003", type: "internal" };
    let container;
    expect(() => {
      ({ container } = render(
        capturedProps.templateItem({ dataRow, deleteItem: vi.fn() }),
      ));
    }).not.toThrow();
    expect(container.querySelectorAll("span").length).toBe(0);
  });

  it('Link (as="button") memicu router.visit ke route assetServices.show dengan id dataRow', async () => {
    // Link diberi prop as="button" di templateItem, sehingga elemen yang
    // dirender adalah <button type="button">, bukan <a href>. Perilaku
    // navigasi custom Link (@/Components/Link) memanggil router.visit(href)
    // saat diklik -- itu yang diverifikasi di sini, bukan atribut href.
    const user = userEvent.setup();
    const { router } = await import("@inertiajs/core");
    const visitSpy = vi.spyOn(router, "visit").mockImplementation(() => {});
    render(<Index />);
    const dataRow = {
      id: 7,
      code: "AS-0007",
      type: "internal",
      status: [],
    };
    const { container } = render(
      capturedProps.templateItem({ dataRow, deleteItem: vi.fn() }),
    );
    const button = container.querySelector("button");
    expect(button).toHaveAttribute("type", "button");
    await user.click(button);
    expect(visitSpy).toHaveBeenCalledWith(
      "assetServices.show/7",
      expect.anything(),
    );
    visitSpy.mockRestore();
  });

  it("mengklik Link tidak melempar error (tidak ada tombol hapus di templateItem ini)", async () => {
    const user = userEvent.setup();
    const { router } = await import("@inertiajs/core");
    const visitSpy = vi.spyOn(router, "visit").mockImplementation(() => {});
    render(<Index />);
    const dataRow = {
      id: 9,
      code: "AS-0009",
      type: "external",
      status: ["draft"],
    };
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
