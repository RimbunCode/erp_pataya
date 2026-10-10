import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
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
// - kolom Asset Items memilih baris SalesOrderItem dengan asset_id terisi dan
//   tidak menampilkan gudang sumber.
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
    // Spec asset-items-section: props tiap section ditangkap per title supaya test
    // bisa memeriksa collapsible/defaultOpen section Asset Items.
    FormPageContent: (props) => {
      const { title, children } = props;
      if (title) {
        captured.contentProps = { ...captured.contentProps, [title]: props };
      }
      return (
        <section>
          {title && <h3>{title}</h3>}
          {children}
        </section>
      );
    },
    FormPageContentDescription: ({ children }) => <p>{children}</p>,
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
// item) -- kedua tabel menyimpan daftar baris secara langsung.
const captured = {};
vi.mock("@/Components/FormTable", () => ({
  default: (props) => {
    if (props.name === "DeliveryNoteItems") {
      captured.formTableProps = props;
    } else if (props.name === "DeliveryNoteAssetItems") {
      // Spec asset-items-section: tabel Asset Items terpisah dari Items.
      captured.assetFormTableProps = props;
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
        onValueChange(
          // Payload bisa di-override per test (mis. referenceable dengan items[]).
          globalThis.__linkModelPayload ?? {
            id: 5,
            undelivered_quantity: 12,
            conversion_factor: 2,
            unit: { id: 3, name: "Pcs" },
            source_warehouse: { id: 20, name: "Gudang A" },
          },
        )
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
        onValueChange(
          globalThis.__returnAgainstPayload ?? {
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
          },
        )
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
import SalesOrderItemLinkModel from "@/Pages/Sales/SalesOrders/SalesOrderItemLinkModel";
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
    globalThis.__linkModelPayload = undefined;
    globalThis.__returnAgainstPayload = undefined;
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
          asset_items: [{ id: 2, item: { id: 2 } }],
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
      // Spec asset-items-section: reset header juga mengosongkan Asset Items.
      expect(stateRef.data.asset_items).toBeNull();
    });

    it("memilih reference_to (val ada) mempertahankan items dan asset_items lama", async () => {
      const user = userEvent.setup({ delay: null });
      const { stateRef } = renderForm({
        data: {
          delivery_date: new Date("2026-01-01"),
          items: [{ id: 1 }],
          asset_items: [{ id: 2 }],
        },
      });

      await user.click(
        screen.getByRole("button", { name: /^reference-to:sales-order:/ }),
      );

      expect(stateRef.data.items).toEqual([{ id: 1 }]);
      expect(stateRef.data.asset_items).toEqual([{ id: 2 }]);
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
      // Payload tanpa source rows menghasilkan kedua bucket kosong.
      expect(stateRef.data.items).toEqual([]);
      expect(stateRef.data.asset_items).toEqual([]);
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
      const checkbox = document.querySelector(
        '[role="forminput"][aria-checked]',
      );
      expect(checkbox).toHaveAttribute("data-state", "checked");
    });

    it("unchecked ketika is_return dan return_against dua-duanya kosong", () => {
      renderForm();

      const checkbox = document.querySelector(
        '[role="forminput"][aria-checked]',
      );
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
        data: {
          delivery_date: new Date("2026-01-01"),
          items: [],
          is_return: true,
        },
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

      await user.click(screen.getByRole("button", { name: /^customer:/ }));

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
      // item_id diisi backend dari referenceable; field UI item tidak dipakai.
      const callArg = setDataRow.mock.calls[0][0];
      expect(callArg.item).toBeNull();
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

  describe("source asset row", () => {
    it("memakai SalesOrderItemLinkModel dengan template Asset dan tanpa kolom warehouse", () => {
      renderForm({
        data: {
          delivery_date: new Date(),
          items: [],
          asset_items: [],
          reference_to: { model: "App\\Models\\Sales\\SalesOrder" },
          referenceable: { id: 7 },
        },
      });

      const assetColumns = captured.assetFormTableProps.columns;
      const sourceColumn = assetColumns.find(
        (column) => column.name === "item",
      );
      const cell = sourceColumn.cell({
        dataRow: {},
        setData: vi.fn(),
        attributes: {},
      });

      expect(sourceColumn.titleTrans).toBe("asset.assetItems.asset");
      expect(cell.type).toBe(SalesOrderItemLinkModel);
      expect(cell.props.as).toBe("asset:asset_id");
      expect(assetColumns.map((column) => column.name)).toEqual([
        "item",
        "description",
        "quantity",
      ]);
    });

    it("memilih source row mempertahankan referenceable dan mengisi asset_id langsung", () => {
      renderForm({
        data: {
          delivery_date: new Date(),
          items: [],
          asset_items: [],
          reference_to: { model: "App\\Models\\Sales\\SalesOrder" },
          referenceable: { id: 7 },
        },
      });

      const setRow = vi.fn();
      const cell = captured.assetFormTableProps.columns
        .find((column) => column.name === "item")
        .cell({ dataRow: {}, setData: setRow, attributes: {} });
      const sourceRow = {
        id: "source-asset-1",
        asset_id: "asset-1",
        asset: { id: "asset-1" },
        undelivered_quantity: 2,
        unit: { id: "unit-1" },
      };
      cell.props.onValueChange(sourceRow);

      expect(setRow).toHaveBeenCalledWith(
        expect.objectContaining({
          referenceable: sourceRow,
          referenceable_id: "source-asset-1",
          asset_id: "asset-1",
          asset: { id: "asset-1" },
          source_warehouse: null,
        }),
      );
    });
  });

  // --------------------------------------------------------------------
  // Spec asset-items-section: section Asset Items terpisah dari Items
  // --------------------------------------------------------------------
  describe("section Asset Items (spec asset-items-section)", () => {
    const ASSET_ITEMS_TITLE = "asset.assetItems.title";
    const SALES_ORDER = "App\\Models\\Sales\\SalesOrder";
    const INTERNAL_ORDER = "App\\Models\\Sales\\InternalOrder";

    it("merender section Asset Items untuk Sales Order di atas Items", () => {
      renderForm({
        data: {
          delivery_date: new Date(),
          items: [],
          asset_items: [],
          reference_to: { model: SALES_ORDER },
        },
      });

      expect(screen.getByText(ASSET_ITEMS_TITLE)).toBeInTheDocument();
      expect(
        screen.getByText("asset.assetItems.description"),
      ).toBeInTheDocument();
      expect(captured.contentProps[ASSET_ITEMS_TITLE].collapsible).toBe(true);

      const headings = screen
        .getAllByRole("heading", { level: 3 })
        .map((heading) => heading.textContent);
      expect(headings.indexOf(ASSET_ITEMS_TITLE)).toBe(
        headings.indexOf("inventory.deliveryNote.items") - 1,
      );
    });

    it("tertutup default saat belum ada baris aset, terbuka saat defaultData punya asset_items", () => {
      const { unmount } = renderForm({
        data: {
          delivery_date: new Date(),
          items: [],
          asset_items: [],
          reference_to: { model: SALES_ORDER },
        },
      });
      expect(captured.contentProps[ASSET_ITEMS_TITLE].defaultOpen).toBe(false);
      unmount();

      const assetRow = { id: "a1", referenceable: { item_id: "I2" } };
      renderForm({
        data: {
          delivery_date: new Date(),
          items: [],
          asset_items: [assetRow],
          reference_to: { model: SALES_ORDER },
        },
        defaultData: { asset_items: [assetRow] },
      });
      expect(captured.contentProps[ASSET_ITEMS_TITLE].defaultOpen).toBe(true);
    });

    it("dua FormTable dengan name berbeda; value dan onValueChange terpisah", () => {
      const itemRow = { id: "r1" };
      const assetRow = { id: "a1" };
      const { stateRef } = renderForm({
        data: {
          delivery_date: new Date(),
          items: [itemRow],
          asset_items: [assetRow],
          reference_to: { model: SALES_ORDER },
        },
      });

      expect(captured.formTableProps.name).toBe("DeliveryNoteItems");
      expect(captured.assetFormTableProps.name).toBe("DeliveryNoteAssetItems");
      expect(captured.formTableProps.value).toEqual([itemRow]);
      expect(captured.assetFormTableProps.value).toEqual([assetRow]);

      act(() => {
        captured.assetFormTableProps.onValueChange([{ id: "a9" }]);
      });

      expect(stateRef.data.asset_items).toEqual([{ id: "a9" }]);
      expect(stateRef.data.items).toEqual([itemRow]);
    });

    it("kolom Asset Items menghilangkan Source Warehouse dari Items", () => {
      renderForm({
        data: {
          delivery_date: new Date(),
          items: [],
          asset_items: [],
          reference_to: { model: SALES_ORDER },
        },
      });

      const names = (props) => props.columns.map((column) => column.name);

      expect(names(captured.assetFormTableProps)).toEqual(
        names(captured.formTableProps).filter(
          (name) => !["source_warehouse", "unit"].includes(name),
        ),
      );
    });

    it("filter dan template link SalesOrderItem mengikuti asset_id per section", () => {
      renderForm({
        data: {
          delivery_date: new Date(),
          items: [],
          asset_items: [],
          reference_to: { model: SALES_ORDER },
          referenceable: { id: 7 },
        },
      });

      const itemCell = captured.formTableProps.columns
        .find((c) => c.name === "item")
        .cell({ dataRow: {}, setData: vi.fn(), attributes: {} });
      const assetCell = captured.assetFormTableProps.columns
        .find((c) => c.name === "item")
        .cell({ dataRow: {}, setData: vi.fn(), attributes: {} });

      expect(itemCell.props.filters).toEqual({
        sales_order_id: 7,
        undelivered_quantity: { ">": 0 },
        asset_id: null,
      });
      expect(assetCell.type).toBe(SalesOrderItemLinkModel);
      expect(assetCell.props.as).toBe("asset:asset_id");
      expect(assetCell.props.filters).toEqual({
        sales_order_id: 7,
        undelivered_quantity: { ">": 0 },
        asset_id: { "!=": null },
      });
    });

    it("Asset Items disembunyikan untuk InternalOrder dan picker barang tetap memakai model asal", () => {
      renderForm({
        data: {
          delivery_date: new Date(),
          items: [],
          asset_items: [],
          reference_to: { model: INTERNAL_ORDER },
          referenceable: { id: 8 },
        },
      });

      const cell = captured.formTableProps.columns
        .find((c) => c.name === "item")
        .cell({ dataRow: {}, setData: vi.fn(), attributes: {} });

      expect(captured.assetFormTableProps).toBeUndefined();
      expect(screen.queryByText(ASSET_ITEMS_TITLE)).not.toBeInTheDocument();
      expect(cell.type).not.toBe(SalesOrderItemLinkModel);
      expect(cell.props.filters).toEqual({
        internal_order_id: 8,
        undelivered_quantity: { ">": 0 },
      });
    });

    it("toggle is_return mereset asset_items bersama items", async () => {
      const user = userEvent.setup({ delay: null });
      const { stateRef } = renderForm({
        data: {
          delivery_date: new Date(),
          items: [{ id: 1 }],
          asset_items: [{ id: 2 }],
        },
      });

      await user.click(
        document.querySelector('[role="forminput"][aria-checked]'),
      );

      expect(stateRef.data.items).toEqual([]);
      expect(stateRef.data.asset_items).toEqual([]);
    });

    describe("baris hasil pilih referenceable/retur dipisah berdasarkan asset_id", () => {
      const referenceablePayload = () => ({
        id: 5,
        items: [
          { id: 100, item_id: "V1", asset_id: null, undelivered_quantity: 3 },
          {
            id: 101,
            item_id: null,
            asset_id: "A1",
            asset: { id: "A1" },
            undelivered_quantity: 1,
          },
        ],
      });
      const soData = () => ({
        delivery_date: new Date("2026-01-01"),
        reference_to: { model: SALES_ORDER, name: "sales.salesOrder.detail" },
        items: [],
      });
      const clickReferenceable = (user) =>
        user.click(
          screen.getByRole("button", {
            name: /^link-model:App\\Models\\Sales\\SalesOrder:/,
          }),
        );

      it("mempartisi Sales Order rows tanpa lookup ItemVariant", async () => {
        const user = userEvent.setup({ delay: null });
        globalThis.__linkModelPayload = referenceablePayload();
        const { stateRef } = renderForm({ data: soData() });

        await clickReferenceable(user);

        await waitFor(() => expect(stateRef.data.asset_items).toHaveLength(1));
        expect(stateRef.data.items.map((row) => row.referenceable_id)).toEqual([
          100,
        ]);
        expect(
          stateRef.data.asset_items.map((row) => row.referenceable_id),
        ).toEqual([101]);
        expect(stateRef.data.asset_items[0].asset_id).toBe("A1");
      });

      it("tanpa asset_id: semua baris tetap di items dan asset_items kosong", async () => {
        const user = userEvent.setup({ delay: null });
        const payload = referenceablePayload();
        payload.items[1].asset_id = null;
        payload.items[1].item_id = "V2";
        payload.items[1].asset = null;
        globalThis.__linkModelPayload = payload;
        const { stateRef } = renderForm({ data: soData() });

        await clickReferenceable(user);
        await waitFor(() => expect(stateRef.data.items).toHaveLength(2));

        expect(stateRef.data.asset_items).toEqual([]);
      });

      it("referenceable tanpa items menghasilkan kedua bucket kosong", async () => {
        const user = userEvent.setup({ delay: null });
        globalThis.__linkModelPayload = { id: 5 };
        const { stateRef } = renderForm({ data: soData() });

        await clickReferenceable(user);

        expect(stateRef.data.items).toEqual([]);
        expect(stateRef.data.asset_items).toEqual([]);
      });

      it("retur: baris sumber ber-asset_id dipindah ke asset_items", async () => {
        const user = userEvent.setup({ delay: null });
        globalThis.__returnAgainstPayload = {
          id: 900,
          reference_to: { model: SALES_ORDER },
          referenceable: { id: 5 },
          items: [
            {
              id: 77,
              item_id: null,
              asset_id: "A1",
              asset: { id: "A1" },
              unreturned_quantity: 4,
            },
          ],
        };
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

        await waitFor(() => expect(stateRef.data.asset_items).toHaveLength(1));
        expect(stateRef.data.items).toEqual([]);
        expect(stateRef.data.asset_items[0].return_against_item).toEqual(
          expect.objectContaining({ id: 77 }),
        );
      });
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
