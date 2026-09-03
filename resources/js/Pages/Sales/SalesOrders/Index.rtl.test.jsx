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
// SalesOrders/Index.jsx adalah SUMBER ASLI dari pola templateItem yang dicontek copy-paste ke
// Finances/Accounts, Inventory/{DeliveryNotes,StockEntries}, Sales/InternalOrders (lihat memory
// project_accounts_index_wrong_domain_copypaste_bug dst) -- TAPI file ASLI ini SENDIRI ternyata
// juga rusak: templateItem membaca dataRow.name & dataRow.type, padahal tabel `sales_orders`
// (database/migrations/2025_07_26_100804_create_sales_orders_table.php) TIDAK PUNYA kolom `name`
// maupun `type` sama sekali (field asli: customer_name, is_rent, date, dst), dan
// app/Models/Sales/SalesOrder.php $appends cuma ['rent_date','rental_durations'] -- tidak ada
// accessor name()/type() juga. templateLink() modelnya sendiri = ':code'.
describe("Sales/SalesOrders Index", () => {
  it("meneruskan templateItem ke DataTable2", () => {
    render(<Index />);
    expect(typeof capturedProps.templateItem).toBe("function");
  });

  it("BUG (lihat bugFindings): templateItem membaca dataRow.name & dataRow.type yang TIDAK PERNAH ada di tabel sales_orders -- kartu mobile tampil kosong", () => {
    render(<Index />);
    // Row nyata dari backend sales_orders TIDAK PERNAH punya field `name`/`type`
    // (lihat komentar describe di atas) -- disimulasikan sengaja TANPA kedua
    // field itu utk membuktikan kartu jadi kosong, bukan crash.
    const dataRow = {
      id: 1,
      customer_name: "PT Sumber Makmur",
      is_rent: false,
    };
    const { container } = render(
      capturedProps.templateItem({ dataRow, deleteItem: vi.fn() }),
    );
    // Baris nama (dataRow.name) kosong -- <p> ada tapi tanpa teks bermakna.
    const paragraphs = container.querySelectorAll("p");
    expect(paragraphs).toHaveLength(2);
    expect(paragraphs[1].textContent).toBe("");
    // Baris tipe (t(`sales.salesOrders.types.${dataRow.type}`)) memuat literal
    // "undefined" krn dataRow.type undefined diinterpolasi jadi string.
    expect(paragraphs[0]).toHaveTextContent(
      "TR:sales.salesOrders.types.undefined",
    );
  });

  it('Link (as="button") memicu router.visit ke route salesOrders.show dengan id dataRow', async () => {
    const user = userEvent.setup();
    const { router } = await import("@inertiajs/core");
    const visitSpy = vi.spyOn(router, "visit").mockImplementation(() => {});
    render(<Index />);
    const dataRow = { id: 7, name: "SO Manual Test", type: "regular" };
    const { container } = render(
      capturedProps.templateItem({ dataRow, deleteItem: vi.fn() }),
    );
    const button = container.querySelector("button");
    expect(button).toHaveAttribute("type", "button");
    await user.click(button);
    expect(visitSpy).toHaveBeenCalledWith(
      "salesOrders.show/7",
      expect.anything(),
    );
    visitSpy.mockRestore();
  });
});
