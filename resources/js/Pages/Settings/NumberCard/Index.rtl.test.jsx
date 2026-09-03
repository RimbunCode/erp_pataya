import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
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

describe("Settings NumberCard Index", () => {
  it("meneruskan templateItem, classNameDialog, dan form ke DataTable2", () => {
    render(<Index />);
    expect(typeof capturedProps.templateItem).toBe("function");
    expect(capturedProps.classNameDialog).toBe("max-w-(--breakpoint-2xl)!");
    expect(capturedProps.form).toBeTruthy();
  });

  it("templateItem merender label dan function (diterjemahkan) dataRow", () => {
    render(<Index />);
    const dataRow = { id: 1, function: "sum", label: "Total Penjualan" };
    const { container } = render(
      capturedProps.templateItem({ dataRow, deleteItem: vi.fn() }),
    );
    expect(container).toHaveTextContent(
      "TR:settings.number_card.functions.sum",
    );
    expect(container).toHaveTextContent("Total Penjualan");
  });

  it("Link (as='button') dirender sebagai <button>, bukan <a>", () => {
    // Komponen Link custom (@/Components/Link) memaksa as="button" jadi
    // elemen <button type="button">, tanpa atribut href (lihat Link.jsx
    // elProps: hanya "a" yang diberi href). href tetap dipakai internal
    // utk Inertia visit saat diklik, hanya tidak muncul di DOM.
    render(<Index />);
    const dataRow = { id: 42, function: "avg", label: "Rata-rata Stok" };
    const { container } = render(
      capturedProps.templateItem({ dataRow, deleteItem: vi.fn() }),
    );
    const button = container.querySelector("button");
    expect(button).toHaveAttribute("type", "button");
    expect(button).not.toHaveAttribute("href");
  });

  it("mengklik Link memicu router.visit ke route numberCards.show dengan id dataRow", async () => {
    const user = userEvent.setup();
    const { router } = await import("@inertiajs/core");
    const visitSpy = vi.spyOn(router, "visit").mockImplementation(() => {});
    render(<Index />);
    const dataRow = { id: 7, function: "count", label: "Jumlah Order" };
    const { container } = render(
      capturedProps.templateItem({ dataRow, deleteItem: vi.fn() }),
    );
    const button = container.querySelector("button");
    await user.click(button);
    expect(visitSpy).toHaveBeenCalledWith(
      "numberCards.show/7",
      expect.anything(),
    );
    visitSpy.mockRestore();
  });

  it("merender dataRow berbeda dengan function dan label berbeda tanpa bocor state", () => {
    render(<Index />);
    const dataRowA = { id: 1, function: "sum", label: "Total A" };
    const dataRowB = { id: 2, function: "max", label: "Maksimum B" };

    const { container: containerA } = render(
      capturedProps.templateItem({ dataRow: dataRowA, deleteItem: vi.fn() }),
    );
    expect(containerA).toHaveTextContent(
      "TR:settings.number_card.functions.sum",
    );
    expect(containerA).toHaveTextContent("Total A");

    const { container: containerB } = render(
      capturedProps.templateItem({ dataRow: dataRowB, deleteItem: vi.fn() }),
    );
    expect(containerB).toHaveTextContent(
      "TR:settings.number_card.functions.max",
    );
    expect(containerB).toHaveTextContent("Maksimum B");
  });
});
