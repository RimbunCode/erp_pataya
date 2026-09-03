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

// BUG (lihat bugFindings): templateItem di Services/WorkOrders/Index.jsx membaca
// dataRow.name & dataRow.type -- persis pola copy-paste yang sama dengan
// Sales/SalesOrders/Index.jsx (lihat memory
// project_salesorders_internalorders_index_blank_name_root_bug). Tabel `work_orders`
// (database/migrations/2025_04_26_161008_create_work_orders_table.php) TIDAK PUNYA
// kolom `name` maupun `type` sama sekali -- kolom aslinya: customer_id, customer_name,
// customer_branch_id, customer_branch_name, item_service_id, item_service_name, date,
// external_note, started_at, completed_at. app/Models/Service/WorkOrder.php $appends
// cuma ['for_internal'] (accessor forInternal()) -- tidak ada accessor name()/type()
// juga. templateLink() modelnya = ':code'. lang/en/service/workOrder.php juga TIDAK
// PUNYA key `types` sama sekali di bawah `service.workOrder` (cuma ada `columns`,
// `actions`, `workOrderItem`) -- jadi t(`service.workOrder.types.${dataRow.type}`)
// selalu me-resolve ke key yang tidak pernah ada.
describe("Services/WorkOrders Index", () => {
  it("meneruskan templateItem & classNameDialog ke DataTable2", () => {
    render(<Index />);
    expect(typeof capturedProps.templateItem).toBe("function");
    expect(capturedProps.classNameDialog).toBe("max-w-(--breakpoint-2xl)!");
  });

  it("BUG (lihat bugFindings): templateItem membaca dataRow.name & dataRow.type yang TIDAK PERNAH ada di tabel work_orders -- kartu mobile tampil kosong", () => {
    render(<Index />);
    // Row nyata dari backend work_orders TIDAK PERNAH punya field `name`/`type`
    // (lihat komentar describe di atas) -- disimulasikan sengaja TANPA kedua
    // field itu utk membuktikan kartu jadi kosong, bukan crash.
    const dataRow = {
      id: 1,
      customer_name: "PT Sumber Makmur",
      item_service_name: "AC Split 1 PK",
    };
    const { container } = render(
      capturedProps.templateItem({ dataRow, deleteItem: vi.fn() }),
    );
    // Baris nama (dataRow.name) kosong -- <p> ada tapi tanpa teks bermakna.
    const paragraphs = container.querySelectorAll("p");
    expect(paragraphs).toHaveLength(2);
    expect(paragraphs[1].textContent).toBe("");
    // Baris tipe (t(`service.workOrder.types.${dataRow.type}`)) memuat literal
    // "undefined" krn dataRow.type undefined diinterpolasi jadi string, dan key
    // `types` sendiri tidak pernah ada di lang/en/service/workOrder.php.
    expect(paragraphs[0]).toHaveTextContent(
      "TR:service.workOrder.types.undefined",
    );
  });

  it('Link (as="button") memicu router.visit ke route workOrders.show dengan id dataRow', async () => {
    const user = userEvent.setup();
    const { router } = await import("@inertiajs/core");
    const visitSpy = vi.spyOn(router, "visit").mockImplementation(() => {});
    render(<Index />);
    const dataRow = { id: 7, name: "WO Manual Test", type: "internal" };
    const { container } = render(
      capturedProps.templateItem({ dataRow, deleteItem: vi.fn() }),
    );
    const button = container.querySelector("button");
    expect(button).toHaveAttribute("type", "button");
    await user.click(button);
    expect(visitSpy).toHaveBeenCalledWith(
      "workOrders.show/7",
      expect.anything(),
    );
    visitSpy.mockRestore();
  });
});
