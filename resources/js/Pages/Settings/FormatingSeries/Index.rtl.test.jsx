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

// BUG (lihat bugFindings): templateItem di sini adalah copy-paste PERSIS dari
// Settings/Branches/Index.jsx (bandingkan baris 11-30 kedua file -- identik
// kecuali nama route & namespace key i18n). Field yang dibaca --
// dataRow.is_main_branch, dataRow.shipping_street, dataRow.shipping_city,
// dataRow.shipping_state, dataRow.shipping_zip_code, dataRow.shipping_country
// -- adalah kolom milik tabel `branches`, BUKAN `formating_series`.
// Skema asli (database/migrations/2025_05_16_170355_create_formating_series_table.php)
// cuma py kolom: id, name, model, logs, format, timestamps. Model
// app/Models/Core/FormatingSeries.php juga tidak py $appends apapun yang
// menghasilkan field shipping_*/is_main_branch. Akibatnya di kartu mobile:
// badge is_main_branch tidak pernah muncul (dead code, selalu falsy), dan
// baris alamat kedua cuma menampilkan koma kosong -- field `format` yang
// justru relevan (satu-satunya kolom lain selain name, lihat $configColumns
// di model) malah tidak pernah ditampilkan di card mobile.
describe("Settings/FormatingSeries Index", () => {
  it("meneruskan templateItem ke DataTable2", () => {
    render(<Index />);
    expect(typeof capturedProps.templateItem).toBe("function");
  });

  it("BUG (lihat bugFindings): templateItem membaca field shipping_*/is_main_branch yang tidak pernah ada di tabel formating_series -- badge tak pernah muncul & baris kedua cuma koma kosong", () => {
    render(<Index />);
    // Row nyata dari backend formating_series HANYA py: id, name, model,
    // logs, format, timestamps -- disimulasikan persis begitu (TANPA field
    // shipping_*/is_main_branch) utk membuktikan card jadi rusak, bukan crash.
    const dataRow = {
      id: 5,
      name: "Sales Order Series",
      model: "App\\Models\\Sales\\SalesOrder",
      format: "SO-@[yyyy]-@[i]",
      logs: {},
    };
    const { container } = render(
      capturedProps.templateItem({ dataRow, deleteItem: vi.fn() }),
    );
    const paragraphs = container.querySelectorAll("p");
    expect(paragraphs).toHaveLength(2);

    // Baris pertama: nama tampil benar (kolom `name` memang ada), tapi badge
    // is_main_branch TIDAK PERNAH dirender krn dataRow.is_main_branch selalu
    // undefined (kolomnya tidak ada di tabel formating_series).
    expect(paragraphs[0]).toHaveTextContent("Sales Order Series");
    expect(paragraphs[0].querySelector("span")).toBeNull();

    // Baris kedua: seluruh field shipping_* undefined -> yang tersisa cuma
    // literal koma dari template, tidak ada informasi alamat/format apapun.
    expect(paragraphs[1].textContent.replace(/\s+/g, " ").trim()).toBe(
      ", , , ,",
    );
    expect(paragraphs[1]).not.toHaveTextContent("SO-@[yyyy]-@[i]");
  });

  it('Link (as="button") memicu router.visit ke route formatingSeries.show dengan id dataRow', async () => {
    const user = userEvent.setup();
    const { router } = await import("@inertiajs/core");
    const visitSpy = vi.spyOn(router, "visit").mockImplementation(() => {});
    render(<Index />);
    const dataRow = {
      id: 9,
      name: "Purchase Order Series",
      model: "App\\Models\\Purchase\\PurchaseOrder",
      format: "PO-@[yyyy]-@[i]",
      logs: {},
    };
    const { container } = render(
      capturedProps.templateItem({ dataRow, deleteItem: vi.fn() }),
    );
    const button = container.querySelector("button");
    expect(button).toHaveAttribute("type", "button");
    await user.click(button);
    expect(visitSpy).toHaveBeenCalledWith(
      "formatingSeries.show/9",
      expect.anything(),
    );
    visitSpy.mockRestore();
  });
});
