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

// BUG (lihat bugFindings di memory project_salesorders_internalorders_index_blank_name_root_bug):
// templateItem di sini copy-paste dari Sales/SalesOrders/Index.jsx (route & i18n key SUDAH
// disesuaikan ke "internalOrder.show"/"sales.internalOrder.types", tapi field dataRow.name &
// dataRow.type TIDAK pernah disesuaikan -- keduanya juga tidak pernah disesuaikan di file ASLI
// SalesOrders sendiri krn memang tidak pernah ada). Tabel `internal_orders`
// (database/migrations/2025_08_23_074916_create_internal_orders_table.php) HANYA punya kolom
// id/date/timestamps/softDeletes -- TIDAK ADA name/type sama sekali.
// app/Models/Sales/InternalOrder.php templateLink() = ':code' (bukan :name).
describe("Sales/InternalOrders Index", () => {
  it("meneruskan templateItem ke DataTable2", () => {
    render(<Index />);
    expect(typeof capturedProps.templateItem).toBe("function");
  });

  it("BUG (lihat bugFindings): templateItem membaca dataRow.name & dataRow.type yang TIDAK PERNAH ada di tabel internal_orders -- kartu mobile tampil kosong", () => {
    render(<Index />);
    // Row nyata backend internal_orders cuma py id/date -- disimulasikan
    // TANPA name/type utk membuktikan kartu jadi kosong, bukan crash.
    const dataRow = { id: 1, date: "2026-09-01" };
    const { container } = render(
      capturedProps.templateItem({ dataRow, deleteItem: vi.fn() }),
    );
    const paragraphs = container.querySelectorAll("p");
    expect(paragraphs).toHaveLength(2);
    expect(paragraphs[1].textContent).toBe("");
    expect(paragraphs[0]).toHaveTextContent(
      "TR:sales.internalOrder.types.undefined",
    );
  });

  it('Link (as="button") memicu router.visit ke route internalOrder.show dengan id dataRow (route SUDAH benar disesuaikan, beda dari kasus Accounts/DeliveryNotes/StockEntries)', async () => {
    const user = userEvent.setup();
    const { router } = await import("@inertiajs/core");
    const visitSpy = vi.spyOn(router, "visit").mockImplementation(() => {});
    render(<Index />);
    const dataRow = { id: 7 };
    const { container } = render(
      capturedProps.templateItem({ dataRow, deleteItem: vi.fn() }),
    );
    const button = container.querySelector("button");
    expect(button).toHaveAttribute("type", "button");
    await user.click(button);
    expect(visitSpy).toHaveBeenCalledWith(
      "internalOrder.show/7",
      expect.anything(),
    );
    visitSpy.mockRestore();
  });
});
