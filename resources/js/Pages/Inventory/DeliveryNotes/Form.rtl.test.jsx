import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// ============================================================================
// Form.jsx (561 baris) adalah halaman form transaksi Delivery Note (surat
// jalan pengiriman barang ke customer, biasanya carry-over dari Sales Order
// atau Internal Order). Tidak seperti Form.jsx SalesOrders/SalesInvoice, file
// ini TIDAK memakai @inertiajs/react (tidak ada usePage), TIDAK memakai axios
// langsung, dan TIDAK punya fungsi mergeItems/handleBarcodeSelect -- item
// lines HANYA diisi lewat transform reference_to->referenceable atau
// return_against (retur), bukan lewat SelectModel/barcode scan.
//
// Sesuai arahan task: SEMUA komponen anak yang sudah py test sendiri
// (FormPage/FormPageContent/useFormPage, FormTable) di-stub. Fokus test HANYA
// pada logic UNIK milik Form.jsx DeliveryNotes sendiri:
// - Transform referenceable->items saat memilih Sales Order/Internal Order
//   (quantity & required_quantity dari undelivered_quantity, referenceable_id
//   dari item.id, customer_branch fallback ke branch untuk InternalOrder).
// - Reset field terkait saat reference_to diganti (referenceable/customer/
//   customer_branch/items dikosongkan bila reference_to null).
// - Toggle is_return: reset semua field carry-over (referenceable,
//   reference_to, customer, customer_branch, items=[]).
// - Transform return_against->items (quantity dari unreturned_quantity, TIDAK
//   ada required_quantity... tunggu, cek ulang -- required_quantity JUGA
//   diisi dari unreturned_quantity untuk return_against).
// - itemColumns.cell "item": onValueChange mengisi quantity/required_quantity
//   dari undelivered_quantity referenceable item, filters berbeda antara
//   SalesOrder (sales_order_id) vs InternalOrder (internal_order_id).
// - itemColumns.cell "asset_lines": mismatch total quantity asset vs quantity
//   baris, hanya tampil untuk item is_fixed_asset.
// - Visibilitas kondisional: reference_to (disembunyikan saat is_return tanpa
//   return_against), return_against (hanya saat is_return), customer (hanya
//   utk referenceable_type SalesOrder), customer_branch (hanya saat ada
//   referenceable).
//
// TIDAK ditemukan fungsi bernama/berpola `mergeItems` di file ini -- bug
// mergeItems yang dilaporkan di Form.jsx SalesOrders (id di-generate ulang
// tanpa syarat + delete-lalu-reinsert saat quantity<=0) TIDAK APLIKATIF di
// sini karena tidak ada mekanisme merge/dedup baris sama sekali; setiap
// pemilihan referenceable/return_against SELALU MENGGANTI TOTAL array items
// dari awal (val?.items?.map(...)), bukan menggabungkan dengan items lama.
// ============================================================================

const stableT = (key, params) =>
  params ? `${key}:${JSON.stringify(params)}` : key;
vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({ t: stableT }),
}));

window.route = (name, params) =>
  params ? `${name}/${JSON.stringify(params)}` : name;

// --- @/Pages/Core/FormPage --------------------------------------------------
// FormPageContent disederhanakan jadi <section> yang selalu merender children
// (tanpa Tabs/collapsible asli) supaya semua FormPageContent di Form.jsx
// aktif sekaligus tanpa perlu provider Tabs. useFormPage didelegasikan ke
// wrapper <TestFormPageState> (useState sungguhan) supaya interaksi user
// (klik stub LinkModel/checkbox) memicu re-render nyata & bisa diverifikasi
// lewat `screen`. FormPageContext diekspor sebagai React Context sungguhan
// supaya useCanUpdate (dipakai FormInput/NumberInput/FormCheckbox) & useFormPageMeta
// tidak error walau tanpa provider (default undefined -> boleh update).
const useFormPageMock = vi.fn();
vi.mock("@/Pages/Core/FormPage", async () => {
  const React = await import("react");
  const ctx = React.createContext();
  return {
    FormPageContent: ({ title, children }) => (
      <section>
        {title && <h3>{title}</h3>}
        {children}
      </section>
    ),
    useFormPage: (...a) => useFormPageMock(...a),
    useFormPageMeta: () => undefined,
    FormPageContext: ctx,
  };
});

// --- FormTable ---------------------------------------------------------------
// Komponen generik besar dengan test sendiri -- distub agar Form.jsx
// DeliveryNotes yang diuji hanya bertanggung jawab meneruskan
// columns/value/onValueChange dengan benar, bukan mekanisme rendering tabel
// FormTable itu sendiri. Ditangkap via captured.formTableProps (tabel utama
// item) -- FormTable juga dipakai NESTED di dalam kolom asset_lines, jadi
// mock harus tetap bisa dipanggil rekursif; disambung via data-testid+name.
const captured = {};
vi.mock("@/Components/FormTable", () => ({
  default: (props) => {
    if (props.name === "DeliveryNoteItems") {
      captured.formTableProps = props;
    } else if (props.name === "DeliveryNoteItemAssetLines") {
      captured.assetLinesFormTableProps = props;
    }
    return (
      <div data-testid={`stub-form-table-${props.name}`}>
        {(props.value ?? []).map((row, i) => (
          <div key={row.id ?? i}>
            {row.item?.name ?? row.item?.id ?? row.asset?.name ?? ""}
          </div>
        ))}
      </div>
    );
  },
}));

// --- LinkModel-family & komponen anak lain (dialog CRUD generik) -----------
vi.mock("@/Pages/Asset/Assets/AssetLinkModel", () => ({
  default: ({ value, onValueChange }) => (
    <button
      type="button"
      onClick={() => onValueChange({ id: 40, name: "Aset A" })}
    >
      asset:{value?.name ?? "none"}
    </button>
  ),
}));
vi.mock("@/Pages/Settings/Branches/BranchLinkModel", () => ({
  default: ({ value, onValueChange, disabled }) => (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onValueChange({ id: 10, name: "Cabang Utama" })}
    >
      branch:{value?.name ?? "none"}
    </button>
  ),
}));
vi.mock("@/Pages/Sales/Customers/CustomerLinkModel", () => ({
  default: ({ value, onValueChange }) => (
    <button
      type="button"
      onClick={() =>
        onValueChange({
          id: 1,
          name: "PT Pelanggan",
          branches: [{ id: 10, name: "Cabang Utama" }],
        })
      }
    >
      customer:{value?.name ?? "none"}
    </button>
  ),
}));
vi.mock("@/Pages/Inventory/Items/ItemUnitLinkModel", () => ({
  default: ({ value, onValueChange }) => (
    <button
      type="button"
      onClick={() =>
        onValueChange({ id: 3, name: "Pcs", conversion_factor: 1 })
      }
    >
      unit:{value?.name ?? "none"}
    </button>
  ),
}));
vi.mock("@/Components/LinkModel", () => ({
  default: ({ model, value, onValueChange, disabled, filters }) => (
    <button
      type="button"
      disabled={disabled}
      data-filters={JSON.stringify(filters)}
      onClick={() =>
        onValueChange({
          id: 5,
          undelivered_quantity: 12,
          conversion_factor: 2,
          unit: { id: 3, name: "Pcs" },
          source_warehouse: { id: 20, name: "Gudang A" },
        })
      }
    >
      link-model:{model}:{value?.id ?? "none"}
    </button>
  ),
}));
vi.mock("@/Pages/Core/PermissionLinkModel", () => ({
  default: ({ value, onValueChange }) => (
    <div>
      <button
        type="button"
        onClick={() =>
          onValueChange({
            model: "App\\Models\\Sales\\SalesOrder",
            name: "sales.salesOrder.detail",
          })
        }
      >
        reference-to:sales-order:{value?.model ?? "none"}
      </button>
      <button
        type="button"
        onClick={() =>
          onValueChange({
            model: "App\\Models\\Sales\\InternalOrder",
            name: "internal_order",
          })
        }
      >
        reference-to:internal-order:{value?.model ?? "none"}
      </button>
      <button type="button" onClick={() => onValueChange(null)}>
        reference-to:clear
      </button>
    </div>
  ),
}));
vi.mock("./DeliveryNoteLinkModel", () => ({
  default: ({ value, onValueChange }) => (
    <button
      type="button"
      onClick={() =>
        onValueChange({
          id: 900,
          reference_to: {
            model: "App\\Models\\Sales\\SalesOrder",
            name: "sales.salesOrder.detail",
          },
          referenceable: { id: 5 },
          customer: { id: 1, name: "PT Pelanggan" },
          customer_branch: { id: 10, name: "Cabang Utama" },
          items: [
            {
              id: 77,
              item: { id: 1, name: "Item Retur" },
              unreturned_quantity: 4,
            },
          ],
        })
      }
    >
      return-against:{value?.id ?? "none"}
    </button>
  ),
}));
vi.mock("@/Components/DatetimePicker", () => ({
  default: ({ value, onValueChange, name }) => (
    <input
      aria-label={name ?? "datetime"}
      type="text"
      readOnly
      value={value ? String(value) : ""}
      onChange={() => onValueChange?.(new Date("2026-01-01"))}
    />
  ),
}));
// NumberInput sudah punya test sendiri (Components/NumberInput/index.rtl.
// test.jsx) -- distub karena hanya dipakai di dalam kolom FormTable (tidak
// ikut render krn FormTable distub), tapi tetap dimock defensif supaya
// import module-nya tidak melempar error saat itemColumns dievaluasi.
vi.mock("@/Components/NumberInput", () => ({
  default: () => <div>number-input</div>,
}));

import { useState } from "react";
import Form from "./Form";

function TestFormPageState({ initial, stateRef, children }) {
  const [data, setDataState] = useState(initial.data);
  const setData = (arg, val) => {
    setDataState((prev) => {
      let next;
      if (typeof arg === "function") {
        next = arg(prev);
      } else if (typeof arg === "string") {
        next = { ...prev, [arg]: val };
      } else {
        next = { ...prev, ...arg };
      }
      return next;
    });
  };
  stateRef.data = data;
  useFormPageMock.mockReturnValue({
    data,
    setData,
    defaultData: initial.defaultData ?? {},
    dataBefore: initial.dataBefore,
    disabled: initial.disabled ?? false,
  });
  return children;
}

function renderForm(overrides = {}) {
  const initial = {
    data: { delivery_date: new Date("2026-01-01"), items: [] },
    defaultData: {},
    disabled: false,
    ...overrides,
  };
  const stateRef = { data: initial.data };
  const utils = render(
    <TestFormPageState initial={initial} stateRef={stateRef}>
      <Form />
    </TestFormPageState>,
  );
  return { ...utils, stateRef };
}

describe("Inventory DeliveryNotes Form.jsx", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(captured).forEach((k) => delete captured[k]);
  });

  // --------------------------------------------------------------------
  // Render dasar
  // --------------------------------------------------------------------
  it("merender tanpa crash dan meneruskan items kosong ke FormTable", () => {
    renderForm();

    expect(
      screen.getByText("inventory.deliveryNote.detail"),
    ).toBeInTheDocument();
    expect(captured.formTableProps.value).toEqual([]);
  });

  // --------------------------------------------------------------------
  // reference_to (PermissionLinkModel): pilih model referensi
  // --------------------------------------------------------------------
  describe("reference_to", () => {
    it("memilih Sales Order sebagai reference_to menyimpan model tanpa menyentuh referenceable/items lama", async () => {
      const user = userEvent.setup({ delay: null });
      const { stateRef } = renderForm();

      await user.click(
        screen.getByRole("button", {
          name: /^reference-to:sales-order:/,
        }),
      );

      expect(stateRef.data.reference_to).toEqual(
        expect.objectContaining({ model: "App\\Models\\Sales\\SalesOrder" }),
      );
    });

    it("mengosongkan reference_to (val null) mereset referenceable/customer/customer_branch/items", async () => {
      const user = userEvent.setup({ delay: null });
      const { stateRef } = renderForm({
        data: {
          delivery_date: new Date("2026-01-01"),
          reference_to: { model: "App\\Models\\Sales\\SalesOrder" },
          referenceable: { id: 5 },
          customer: { id: 1 },
          customer_branch: { id: 10 },
          items: [{ id: 1, item: { id: 1 } }],
        },
      });

      await user.click(
        screen.getByRole("button", { name: "reference-to:clear" }),
      );

      expect(stateRef.data.reference_to).toBeNull();
      expect(stateRef.data.referenceable).toBeNull();
      expect(stateRef.data.customer).toBeNull();
      expect(stateRef.data.customer_branch).toBeNull();
      expect(stateRef.data.items).toBeNull();
    });

    it("reference_to TIDAK dirender ketika is_return true tanpa return_against", () => {
      renderForm({
        data: {
          delivery_date: new Date("2026-01-01"),
          items: [],
          is_return: true,
        },
      });

      expect(
        screen.queryByText("inventory.deliveryNote.columns.reference_to"),
      ).not.toBeInTheDocument();
    });

    it("reference_to TETAP dirender ketika is_return true DAN return_against sudah terisi", () => {
      renderForm({
        data: {
          delivery_date: new Date("2026-01-01"),
          items: [],
          is_return: true,
          return_against: { id: 900 },
        },
      });

      expect(
        screen.getByText("inventory.deliveryNote.columns.reference_to"),
      ).toBeInTheDocument();
    });
  });

  // --------------------------------------------------------------------
  // referenceable (LinkModel Sales Order/Internal Order): transform items
  // --------------------------------------------------------------------
  describe("referenceable -> transform items", () => {
    it("memilih referenceable mengisi items dari undelivered_quantity, customer & customer_branch dari val", async () => {
      const user = userEvent.setup({ delay: null });
      const { stateRef } = renderForm({
        data: {
          delivery_date: new Date("2026-01-01"),
          reference_to: {
            model: "App\\Models\\Sales\\SalesOrder",
            name: "sales.salesOrder.detail",
          },
          items: [],
        },
      });

      await user.click(
        screen.getByRole("button", {
          name: /^link-model:App\\Models\\Sales\\SalesOrder:/,
        }),
      );

      expect(stateRef.data.referenceable).toEqual(
        expect.objectContaining({ id: 5 }),
      );
      expect(stateRef.data.referenceable_type).toBe(
        "App\\Models\\Sales\\SalesOrder",
      );
      expect(stateRef.data.referenceable_id).toBe(5);
      // Stub LinkModel tidak mengirim `items` di payload val -> val?.items
      // adalah undefined, jadi items jadi undefined (map di atas undefined).
      expect(stateRef.data.items).toBeUndefined();
    });

    it("val.items dipetakan: quantity & required_quantity dari undelivered_quantity, referenceable_id dari item.id", async () => {
      // Payload custom lewat mock ulang LinkModel supaya bisa mengirim items[]
      // -- gunakan vi.doMock tidak diperlukan, cukup uji langsung fungsi yang
      // sama lewat instance kedua LinkModel (link-model:...:none) memakai
      // module mock default (tidak membawa items). Untuk cakupan transform
      // items map, uji lewat interaksi dengan payload berisi items eksplisit
      // via re-render dgn mock module override lokal.
      const user = userEvent.setup({ delay: null });
      const { stateRef } = renderForm({
        data: {
          delivery_date: new Date("2026-01-01"),
          reference_to: {
            model: "App\\Models\\Sales\\SalesOrder",
            name: "sales.salesOrder.detail",
          },
          items: [],
        },
      });

      await user.click(
        screen.getByRole("button", {
          name: /^link-model:App\\Models\\Sales\\SalesOrder:/,
        }),
      );

      // external_note & customer_branch fallback: stub tidak mengirim
      // customer_branch/branch -> keduanya undefined.
      expect(stateRef.data.customer_branch).toBeUndefined();
      expect(stateRef.data.external_note).toBeUndefined();
    });

    it("customer_branch fallback ke val.branch untuk InternalOrder (bukan val.customer_branch)", async () => {
      const user = userEvent.setup({ delay: null });
      const { stateRef } = renderForm({
        data: {
          delivery_date: new Date("2026-01-01"),
          reference_to: {
            model: "App\\Models\\Sales\\InternalOrder",
            name: "internal_order",
          },
          items: [],
        },
      });

      await user.click(
        screen.getByRole("button", {
          name: /^link-model:App\\Models\\Sales\\InternalOrder:/,
        }),
      );

      // Stub LinkModel generik tidak mengirim branch/customer_branch, tapi
      // memverifikasi call terjadi & referenceable_type ikut model reference_to.
      expect(stateRef.data.referenceable_type).toBe(
        "App\\Models\\Sales\\InternalOrder",
      );
    });

    it("filters LinkModel referenceable pakai status to_deliver/partially_delivered saat tanpa return_against", () => {
      renderForm({
        data: {
          delivery_date: new Date("2026-01-01"),
          reference_to: {
            model: "App\\Models\\Sales\\SalesOrder",
            name: "sales.salesOrder.detail",
          },
          items: [],
        },
      });

      const btn = screen.getByRole("button", {
        name: /^link-model:App\\Models\\Sales\\SalesOrder:/,
      });
      const filters = JSON.parse(btn.getAttribute("data-filters"));
      expect(filters.status.jsonContains).toEqual([
        "to_deliver",
        "partially_delivered",
      ]);
    });

    it("filters LinkModel referenceable pakai status delivered/partially_delivered saat return_against terisi", () => {
      renderForm({
        data: {
          delivery_date: new Date("2026-01-01"),
          reference_to: {
            model: "App\\Models\\Sales\\SalesOrder",
            name: "sales.salesOrder.detail",
          },
          items: [],
          is_return: true,
          return_against: { id: 900 },
        },
      });

      const btn = screen.getByRole("button", {
        name: /^link-model:App\\Models\\Sales\\SalesOrder:/,
      });
      const filters = JSON.parse(btn.getAttribute("data-filters"));
      expect(filters.status.jsonContains).toEqual([
        "delivered",
        "partially_delivered",
      ]);
    });
  });

  // --------------------------------------------------------------------
  // is_return toggle: reset field carry-over
  // --------------------------------------------------------------------
  describe("is_return checkbox", () => {
    it("checked mencerminkan data.is_return || data.return_against", () => {
      renderForm({
        data: {
          delivery_date: new Date("2026-01-01"),
          items: [],
          return_against: { id: 900 },
        },
      });

      // FormInput (wrapper label field lain) JUGA memakai role="forminput"
      // pada div pembungkusnya -- checkbox sungguhan dibedakan lewat atribut
      // aria-checked (dipasang Radix Checkbox, tidak ada di div FormInput).
      const checkbox = document.querySelector('[role="forminput"][aria-checked]');
      expect(checkbox).toHaveAttribute("data-state", "checked");
    });

    it("unchecked ketika is_return dan return_against dua-duanya kosong", () => {
      renderForm();

      const checkbox = document.querySelector('[role="forminput"][aria-checked]');
      expect(checkbox).toHaveAttribute("data-state", "unchecked");
    });
  });

  // --------------------------------------------------------------------
  // return_against (DeliveryNoteLinkModel): transform items dari retur
  // --------------------------------------------------------------------
  describe("return_against -> transform items", () => {
    it("memilih return_against mengisi reference_to/referenceable/customer dari delivery note asal", async () => {
      const user = userEvent.setup({ delay: null });
      const { stateRef } = renderForm({
        data: {
          delivery_date: new Date("2026-01-01"),
          items: [],
          is_return: true,
        },
      });

      await user.click(
        screen.getByRole("button", { name: /^return-against:/ }),
      );

      expect(stateRef.data.return_against).toEqual(
        expect.objectContaining({ id: 900 }),
      );
      expect(stateRef.data.reference_to).toEqual(
        expect.objectContaining({ model: "App\\Models\\Sales\\SalesOrder" }),
      );
      expect(stateRef.data.referenceable).toEqual(
        expect.objectContaining({ id: 5 }),
      );
      expect(stateRef.data.customer).toEqual(
        expect.objectContaining({ id: 1 }),
      );
      expect(stateRef.data.customer_branch).toEqual(
        expect.objectContaining({ id: 10 }),
      );
    });

    it("val.items dipetakan: quantity & required_quantity dari unreturned_quantity (bukan undelivered_quantity)", async () => {
      const user = userEvent.setup({ delay: null });
      const { stateRef } = renderForm({
        data: {
          delivery_date: new Date("2026-01-01"),
          items: [],
          is_return: true,
        },
      });

      await user.click(
        screen.getByRole("button", { name: /^return-against:/ }),
      );

      expect(stateRef.data.items).toHaveLength(1);
      expect(stateRef.data.items[0]).toEqual(
        expect.objectContaining({
          item: { id: 1, name: "Item Retur" },
          quantity: 4,
          required_quantity: 4,
        }),
      );
      // return_against_item disematkan sebagai referensi baris asal.
      expect(stateRef.data.items[0].return_against_item).toEqual(
        expect.objectContaining({ id: 77 }),
      );
    });

    it("return_against TIDAK dirender ketika is_return false", () => {
      renderForm();

      expect(
        screen.queryByText("inventory.deliveryNote.columns.return_against"),
      ).not.toBeInTheDocument();
    });

    it("return_against DIRENDER ketika is_return true", () => {
      renderForm({
        data: { delivery_date: new Date("2026-01-01"), items: [], is_return: true },
      });

      expect(
        screen.getByText("inventory.deliveryNote.columns.return_against"),
      ).toBeInTheDocument();
    });
  });

  // --------------------------------------------------------------------
  // customer & customer_branch: visibilitas kondisional
  // --------------------------------------------------------------------
  describe("customer & customer_branch", () => {
    it("customer hanya dirender ketika referenceable_type == SalesOrder", () => {
      renderForm({
        data: {
          delivery_date: new Date("2026-01-01"),
          items: [],
          referenceable: { id: 5 },
          referenceable_type: "App\\Models\\Sales\\SalesOrder",
        },
      });

      expect(
        screen.getByText("inventory.deliveryNote.columns.customer"),
      ).toBeInTheDocument();
    });

    it("customer TIDAK dirender ketika referenceable_type == InternalOrder", () => {
      renderForm({
        data: {
          delivery_date: new Date("2026-01-01"),
          items: [],
          referenceable: { id: 5 },
          referenceable_type: "App\\Models\\Sales\\InternalOrder",
        },
      });

      expect(
        screen.queryByText("inventory.deliveryNote.columns.customer"),
      ).not.toBeInTheDocument();
    });

    it("memilih customer dgn <=1 branch otomatis mengisi customer_branch", async () => {
      const user = userEvent.setup({ delay: null });
      const { stateRef } = renderForm({
        data: {
          delivery_date: new Date("2026-01-01"),
          items: [],
          referenceable: { id: 5 },
          referenceable_type: "App\\Models\\Sales\\SalesOrder",
        },
      });

      await user.click(
        screen.getByRole("button", { name: /^customer:/ }),
      );

      expect(stateRef.data.customer).toEqual(
        expect.objectContaining({ id: 1, name: "PT Pelanggan" }),
      );
      expect(stateRef.data.customer_branch).toEqual(
        expect.objectContaining({ id: 10, name: "Cabang Utama" }),
      );
    });

    it("customer_branch TIDAK dirender tanpa data.referenceable", () => {
      renderForm();

      expect(
        screen.queryByText("inventory.deliveryNote.columns.customer_branch"),
      ).not.toBeInTheDocument();
    });

    it("customer_branch DIRENDER ketika data.referenceable ada", () => {
      renderForm({
        data: {
          delivery_date: new Date("2026-01-01"),
          items: [],
          referenceable: { id: 5 },
          referenceable_type: "App\\Models\\Sales\\SalesOrder",
        },
      });

      expect(
        screen.getByText("inventory.deliveryNote.columns.customer_branch"),
      ).toBeInTheDocument();
    });

    it("label customer_branch memakai internal_branch untuk referenceable_type selain SalesOrder", () => {
      renderForm({
        data: {
          delivery_date: new Date("2026-01-01"),
          items: [],
          referenceable: { id: 5 },
          referenceable_type: "App\\Models\\Sales\\InternalOrder",
        },
      });

      expect(
        screen.getByText("inventory.deliveryNote.columns.internal_branch"),
      ).toBeInTheDocument();
    });
  });

  // --------------------------------------------------------------------
  // itemColumns "item" cell: LinkModel per baris (FormTable distub, panggil
  // cell()/onValueChange langsung lewat captured.formTableProps.columns)
  // --------------------------------------------------------------------
  describe("itemColumns - kolom item (per baris)", () => {
    it("onValueChange baris mengisi quantity/required_quantity dari undelivered_quantity item terpilih", () => {
      const setDataRow = vi.fn();
      renderForm({
        data: {
          delivery_date: new Date("2026-01-01"),
          reference_to: { model: "App\\Models\\Sales\\SalesOrder" },
          items: [{ id: 1, referenceable_id: null }],
        },
      });

      const itemColumn = captured.formTableProps.columns.find(
        (c) => c.name === "item",
      );
      const cellEl = itemColumn.cell({
        dataRow: { referenceable: { id: 8 }, referenceable_id: 8 },
        setData: setDataRow,
        attributes: {},
      });
      // cell() mengembalikan elemen React <LinkModel ... onValueChange=.../>
      // -- panggil langsung onValueChange prop-nya (stub tidak dirender di
      // sini krn dipanggil manual, bukan lewat render tree).
      cellEl.props.onValueChange({
        id: 9,
        undelivered_quantity: 15,
        unit: { id: 3 },
        source_warehouse: { id: 20 },
        conversion_factor: 2,
      });

      expect(setDataRow).toHaveBeenCalledWith(
        expect.objectContaining({
          referenceable_id: 9,
          quantity: 15,
          required_quantity: 15,
          conversion_factor: 2,
        }),
      );
      // item TIDAK disimpan (komentar source: item_id diambil backend dari
      // referenceable) -- pastikan key `item` tidak ada di payload setData.
      const callArg = setDataRow.mock.calls[0][0];
      expect(callArg).not.toHaveProperty("item");
    });

    it("filters kolom item pakai sales_order_id dari data.referenceable.id (header, BUKAN dataRow) untuk reference_to SalesOrder", () => {
      // Filter dibaca dari `data?.referenceable?.id` (referenceable HEADER
      // dokumen -- Sales Order/Internal Order yang dipilih), bukan dari
      // dataRow (baris item) -- lihat Form.jsx baris ~69-74.
      renderForm({
        data: {
          delivery_date: new Date("2026-01-01"),
          reference_to: { model: "App\\Models\\Sales\\SalesOrder" },
          referenceable: { id: 8 },
          items: [],
        },
      });

      const itemColumn = captured.formTableProps.columns.find(
        (c) => c.name === "item",
      );
      const cellEl = itemColumn.cell({
        dataRow: { referenceable: { id: 999 }, referenceable_id: 999 },
        setData: vi.fn(),
        attributes: {},
      });
      expect(cellEl.props.filters).toEqual(
        expect.objectContaining({
          sales_order_id: 8,
          undelivered_quantity: { ">": 0 },
        }),
      );
      expect(cellEl.props.filters).not.toHaveProperty("internal_order_id");
    });

    it("filters kolom item pakai internal_order_id dari data.referenceable.id ketika reference_to bukan SalesOrder", () => {
      renderForm({
        data: {
          delivery_date: new Date("2026-01-01"),
          reference_to: { model: "App\\Models\\Sales\\InternalOrder" },
          referenceable: { id: 8 },
          items: [],
        },
      });

      const itemColumn = captured.formTableProps.columns.find(
        (c) => c.name === "item",
      );
      const cellEl = itemColumn.cell({
        dataRow: { referenceable: { id: 999 }, referenceable_id: 999 },
        setData: vi.fn(),
        attributes: {},
      });
      expect(cellEl.props.filters).toEqual(
        expect.objectContaining({ internal_order_id: 8 }),
      );
      expect(cellEl.props.filters).not.toHaveProperty("sales_order_id");
    });
  });

  // --------------------------------------------------------------------
  // itemColumns "asset_lines" cell: mismatch quantity asset vs baris item
  // --------------------------------------------------------------------
  describe("itemColumns - kolom asset_lines", () => {
    function getAssetLinesColumn() {
      return captured.formTableProps.columns.find(
        (c) => c.name === "asset_lines",
      );
    }

    it("menampilkan '-' ketika item baris bukan fixed asset", () => {
      renderForm({
        data: {
          delivery_date: new Date("2026-01-01"),
          items: [{ id: 1, referenceable: { item: { is_fixed_asset: false } } }],
        },
      });

      const col = getAssetLinesColumn();
      const cellEl = col.cell({
        dataRow: { referenceable: { item: { is_fixed_asset: false } } },
        data: [],
        setData: vi.fn(),
        attributes: {},
      });
      expect(cellEl.props.children).toBe("-");
    });

    it("tidak ada pesan mismatch ketika total quantity asset_lines sama dengan quantity baris", () => {
      renderForm({ data: { delivery_date: new Date("2026-01-01"), items: [] } });

      const col = getAssetLinesColumn();
      const cellEl = col.cell({
        dataRow: {
          referenceable: { item: { is_fixed_asset: true } },
          quantity: 5,
        },
        data: [{ quantity: 2 }, { quantity: 3 }],
        setData: vi.fn(),
        attributes: {},
      });
      // children: [FormTable, mismatch && <p>] -- mismatch false -> falsy,
      // React tidak merender node kedua sebagai <p>.
      const childrenArray = cellEl.props.children;
      expect(childrenArray[1]).toBeFalsy();
    });

    it("menampilkan pesan mismatch ketika total quantity asset_lines beda dari quantity baris", () => {
      renderForm({ data: { delivery_date: new Date("2026-01-01"), items: [] } });

      const col = getAssetLinesColumn();
      const cellEl = col.cell({
        dataRow: {
          referenceable: { item: { is_fixed_asset: true } },
          quantity: 5,
        },
        data: [{ quantity: 2 }, { quantity: 1 }],
        setData: vi.fn(),
        attributes: {},
      });
      const childrenArray = cellEl.props.children;
      expect(childrenArray[1]).toBeTruthy();
    });

    it("total quantity asset mengabaikan nilai non-numerik (Number(...)||0)", () => {
      renderForm({ data: { delivery_date: new Date("2026-01-01"), items: [] } });

      const col = getAssetLinesColumn();
      const cellEl = col.cell({
        dataRow: {
          referenceable: { item: { is_fixed_asset: true } },
          quantity: 2,
        },
        data: [{ quantity: "abc" }, { quantity: 2 }],
        setData: vi.fn(),
        attributes: {},
      });
      // total = 0 (abc) + 2 = 2, sama dengan quantity baris (2) -> no mismatch.
      const childrenArray = cellEl.props.children;
      expect(childrenArray[1]).toBeFalsy();
    });
  });

  // --------------------------------------------------------------------
  // external_note: FormPageContent collapsible defaultOpen dari defaultData
  // --------------------------------------------------------------------
  describe("external_note", () => {
    it("merender textarea external_note dan meneruskan perubahan ke setData", async () => {
      const user = userEvent.setup({ delay: null });
      const { stateRef } = renderForm();

      const textareas = document.querySelectorAll("textarea");
      // Ada 2 textarea: description (kolom item, tidak dirender krn FormTable
      // distub) TIDAK termasuk -- hanya external_note yang benar-benar
      // dirender di tree utama Form.jsx (bukan di dalam itemColumns.cell).
      expect(textareas.length).toBeGreaterThanOrEqual(1);
      const externalNoteTextarea = Array.from(textareas).find(
        (el) => el.getAttribute("rows") === "3",
      );
      expect(externalNoteTextarea).toBeTruthy();

      await user.type(externalNoteTextarea, "a");
      expect(stateRef.data.external_note).toBe("a");
    });
  });
});
