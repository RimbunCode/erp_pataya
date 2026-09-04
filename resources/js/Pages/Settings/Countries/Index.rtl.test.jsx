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

describe("Settings Countries Index", () => {
  it("meneruskan templateItem, classNameDialog, dan form ke DataTable2", () => {
    render(<Index />);
    expect(typeof capturedProps.templateItem).toBe("function");
    expect(capturedProps.classNameDialog).toBe("max-w-4xl!");
    expect(capturedProps.form).toBeTruthy();
  });

  it("templateItem merender code, name, dan lang_code dataRow", () => {
    render(<Index />);
    const dataRow = {
      code: "ID",
      name: "Indonesia",
      lang_code: "id",
      url_flag: null,
    };
    const { container } = render(
      capturedProps.templateItem({ dataRow, deleteItem: vi.fn() }),
    );
    expect(container).toHaveTextContent("ID");
    expect(container).toHaveTextContent("Indonesia");
    expect(container).toHaveTextContent("id");
  });

  it("dataRow.url_flag terisi merender img flag dengan src dan alt sesuai dataRow", () => {
    render(<Index />);
    const dataRow = {
      code: "US",
      name: "United States",
      lang_code: "en",
      url_flag: "https://example.test/flags/us.png",
    };
    const { container } = render(
      capturedProps.templateItem({ dataRow, deleteItem: vi.fn() }),
    );
    const img = container.querySelector("img");
    expect(img).toHaveAttribute("src", "https://example.test/flags/us.png");
    expect(img).toHaveAttribute("alt", "US");
  });

  it("dataRow.url_flag kosong tidak merender img dan tidak melempar error", () => {
    render(<Index />);
    const dataRow = {
      code: "SG",
      name: "Singapore",
      lang_code: null,
      url_flag: null,
    };
    let container;
    expect(() => {
      ({ container } = render(
        capturedProps.templateItem({ dataRow, deleteItem: vi.fn() }),
      ));
    }).not.toThrow();
    expect(container.querySelector("img")).not.toBeInTheDocument();
  });

  it("dataRow.lang_code kosong tidak merender baris lang_code", () => {
    render(<Index />);
    const dataRow = {
      code: "SG",
      name: "Singapore",
      lang_code: null,
      url_flag: null,
    };
    const { container } = render(
      capturedProps.templateItem({ dataRow, deleteItem: vi.fn() }),
    );
    // Hanya 1 <p> (nama+code); baris lang_code tidak dirender krn falsy.
    expect(container.querySelectorAll("p").length).toBe(1);
  });

  it('Link (as="button") memicu router.visit ke route countries.show dengan code dataRow', async () => {
    // Link diberi prop as="button" di templateItem, sehingga elemen yang
    // dirender adalah <button type="button">, bukan <a href>. Perilaku
    // navigasi custom Link (@/Components/Link) memanggil router.visit(href)
    // saat diklik -- itu yang diverifikasi di sini, bukan atribut href.
    const user = userEvent.setup();
    const { router } = await import("@inertiajs/core");
    const visitSpy = vi.spyOn(router, "visit").mockImplementation(() => {});
    render(<Index />);
    const dataRow = {
      code: "ID",
      name: "Indonesia",
      lang_code: "id",
      url_flag: null,
    };
    const { container } = render(
      capturedProps.templateItem({ dataRow, deleteItem: vi.fn() }),
    );
    const button = container.querySelector("button");
    expect(button).toHaveAttribute("type", "button");
    await user.click(button);
    expect(visitSpy).toHaveBeenCalledWith(
      "countries.show/ID",
      expect.anything(),
    );
    visitSpy.mockRestore();
  });
});
