import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// ============================================================================
// Form.jsx (296 baris) adalah halaman form transaksi Internal Order (order
// internal antar-cabang/departemen, domain mirip Sales Order tapi jauh lebih
// sederhana -- tanpa kalkulasi total/diskon/pajak, tanpa mergeItems/
// SelectModel, tanpa exchange_rate). Selalu dirender di dalam <FormPage>.
//
// Sesuai arahan task: SEMUA komponen anak yang sudah py test sendiri di-stub
// (FormPageContent/useFormPage, FormTable, DatetimePicker, ItemBarcode,
// WarehouseLinkModel, ItemVariantLinkModel, ItemUnitLinkModel). Fokus test
// HANYA pada logic UNIK milik Form.jsx InternalOrders sendiri:
// - itemColumns["item"].cell onValueChange: set item/unit/conversion_factor/
//   source_warehouse dgn cascade dari dataRow.source_warehouse ATAU
//   sourceWarehouseRef.current (ref yang selalu sinkron ke data.source_warehouse
//   terbaru lewat assignment langsung tiap render -- BUKAN useEffect).
// - itemColumns["item"].cell (spec asset-service-billing-reference-flow):
//   saat data.referenceable_type=AssetService, filter Item (item.category.type
//   =service OR id in consumedItems), auto-link referenceable ke
//   AssetServiceConsumedItem (match persis) atau AssetService (item Jasa),
//   lock Item+Quantity utk baris part -- kolom "referenceable" per-baris lama
//   (AssetServiceLinkModel/AssetServiceConsumedItemLinkModel) SUDAH DIHAPUS.
// - itemColumns["unit"].cell onValueChange: set unit + conversion_factor.
// - handleBarcodeSelect: tambah baris baru vs increment quantity kalau
//   item+unit yang sama sudah ada di data.items (TIDAK ditemukan pola bug
//   mergeItems SalesOrders/PurchaseRequests di file ini -- Form.jsx
//   InternalOrders tidak punya fungsi mergeItems/SelectModel sama sekali,
//   hanya handleBarcodeSelect yang logic-nya bersih, lihat laporan akhir).
// - Header source_warehouse cascade ke SEMUA baris items TANPA gating
//   is_stock_item apa pun (beda dari SalesOrders yang gated oleh
//   val.item.is_stock_item) -- Form.jsx InternalOrders baris ~249-263.
// - external_note collapsible defaultOpen dari defaultData?.external_note.
// ============================================================================

const stableT = (key) => key;
vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({ t: stableT }),
}));

window.route = (name, params) =>
  params !== undefined ? `${name}/${JSON.stringify(params)}` : name;

// NumberInput (kolom quantity) & DatetimePicker (header date) sama-sama
// memanggil usePage().props.preferences -- tanpa mock ini keduanya melempar
// "usePage must be used within the Inertia component".
const usePageMock = vi.fn();
vi.mock("@inertiajs/react", () => ({
  usePage: () => usePageMock(),
}));

vi.mock("axios", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
    patch: vi.fn(),
  },
}));

// --- @/Pages/Core/FormPage --------------------------------------------------
// FormPageContent disederhanakan jadi <section> yang selalu merender children
// (tanpa Tabs/collapsible asli) supaya semua FormPageContent di Form.jsx aktif
// sekaligus tanpa perlu provider Tabs. useFormPage dikontrol per test lewat
// useFormPageMock (didelegasikan ke TestFormPageState, lihat di bawah).
// FormPageContext diekspor sebagai React Context sungguhan supaya
// useCanUpdate (dipakai FormInput/NumberInput di dalam pohon) tidak error
// walau tanpa provider (default undefined -> boleh update).
const useFormPageMock = vi.fn();
vi.mock("@/Pages/Core/FormPage", async () => {
  const React = await import("react");
  const ctx = React.createContext();
  return {
    FormPageContent: ({ title, collapsible, defaultOpen, children }) => (
      <section
        data-collapsible={collapsible ? String(!!defaultOpen) : undefined}
      >
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
// Komponen generik besar dgn test sendiri -- distub agar Form.jsx
// InternalOrders yang diuji hanya bertanggung jawab meneruskan props
// (columns/value) dengan benar. Ditangkap via captured.formTableProps supaya
// test bisa memanggil itemColumns[].cell(...) langsung (pure logic).
const captured = {};
vi.mock("@/Components/FormTable", () => ({
  default: (props) => {
    captured.formTableProps = props;
    return (
      <div data-testid="stub-form-table">
        {(props.value ?? []).map((row, i) => (
          <div key={row.id ?? i}>{row.item?.name ?? row.item?.id ?? ""}</div>
        ))}
      </div>
    );
  },
}));

vi.mock("./ItemForm", () => ({
  default: () => <div data-testid="stub-item-form" />,
}));

// --- ItemBarcode (scan) -------------------------------------------------------
vi.mock("@/Pages/Inventory/Items/ItemBarcode", () => ({
  default: ({ onSelect }) => (
    <button type="button" onClick={() => onSelect(captured.barcodePayload)}>
      scan-barcode
    </button>
  ),
}));

// --- WarehouseLinkModel (header) ---------------------------------------------
// Dipakai 2 kali di Form.jsx: header (di luar FormTable) DAN sebagai cell
// kolom "source_warehouse" (hanya terpanggil via itemColumns[].cell, TIDAK
// ikut render krn FormTable distub). Stub tunggal ini cukup utk instance
// header krn hanya itu yang benar-benar dirender.
vi.mock("@/Pages/Inventory/Warehouses/WarehouseLinkModel", () => ({
  default: ({ value, onValueChange, disabled }) => (
    <button
      type="button"
      disabled={disabled}
      onClick={() =>
        onValueChange(captured.warehousePayload ?? { id: 20, name: "Gudang A" })
      }
    >
      warehouse:{value?.name ?? "none"}
    </button>
  ),
}));

vi.mock("@/Components/DatetimePicker", () => ({
  default: ({ value, onValueChange, type }) => (
    <input
      aria-label={`datetime-${type}`}
      type="text"
      readOnly
      value={value ? String(value) : ""}
      onChange={() => onValueChange?.(new Date("2026-01-01"))}
    />
  ),
}));

// Kolom item (ItemVariantLinkModel/ItemUnitLinkModel/AssetService*LinkModel)
// hanya dipanggil lewat itemColumns[].cell -- tidak ikut render krn FormTable
// distub -- tapi tetap dimock defensif supaya import module-nya tidak
// melempar error saat dievaluasi module Form.jsx.
vi.mock("@/Pages/Inventory/Items/ItemVariantLinkModel", () => ({
  default: () => <div>item-variant-link</div>,
}));
vi.mock("@/Pages/Inventory/Items/ItemUnitLinkModel", () => ({
  default: () => <div>item-unit-link</div>,
}));
// @/Components/LinkModel dipakai field "Reference To" header (Requirement
// 2.3/1.4, spec asset-service-billing-reference-flow) -- distub supaya tidak
// perlu usePermission()/usePage().props.auth sungguhan.
vi.mock("@/Components/LinkModel", () => ({
  default: ({ model, value }) => (
    <div>
      link-model:{model}:{value?.id ?? "none"}
    </div>
  ),
}));

import { useState } from "react";
import Form from "./Form";

// useFormPage asli mengembalikan context React (state hidup, re-render saat
// setData dipanggil). Supaya interaksi user (klik tombol stub) benar-benar
// memicu re-render Form dan bisa diverifikasi lewat `screen`, useFormPageMock
// didelegasikan ke komponen wrapper <TestFormPageState> yang pakai useState
// sungguhan. `latestState` di-expose ke luar render lewat ref supaya
// assertion di test bisa membaca data.items final setelah interaksi.
function TestFormPageState({ initial, stateRef, children }) {
  const [data, setDataState] = useState(initial.data);
  // Meniru semantik ASLI Inertia useForm().setData(): argumen string ->
  // set 1 field (merge), argumen fungsi -> updater, argumen objek MENGGANTI
  // SELURUH data form (bukan merge) -- lihat catatan sama di
  // SalesOrders/Form.rtl.test.jsx.
  const setData = (arg, val) => {
    setDataState((prev) => {
      if (typeof arg === "function") {
        return arg(prev);
      } else if (typeof arg === "string") {
        return { ...prev, [arg]: val };
      }
      return arg;
    });
  };
  stateRef.data = data;
  useFormPageMock.mockReturnValue({
    data,
    setData,
    defaultData: initial.defaultData ?? {},
    disabled: initial.disabled ?? false,
  });
  return children;
}

function renderForm(overrides = {}) {
  const initial = {
    data: { date: new Date("2026-01-01"), items: [] },
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

describe("Internal Order Form.jsx", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(captured).forEach((k) => delete captured[k]);
    usePageMock.mockReturnValue({
      props: { preferences: { default_currency_id: "idr" } },
    });
  });

  // --------------------------------------------------------------------
  // Render dasar
  // --------------------------------------------------------------------
  describe("render dasar", () => {
    it("merender ketiga FormPageContent (detail, items, external_note) tanpa crash", () => {
      renderForm();

      expect(
        screen.getByText("sales.internalOrder.detail"),
      ).toBeInTheDocument();
      expect(screen.getByText("sales.internalOrder.items")).toBeInTheDocument();
      expect(
        screen.getByText("sales.internalOrder.columns.external_note"),
      ).toBeInTheDocument();
      expect(captured.formTableProps.value).toEqual([]);
    });

    it("meneruskan data.items ke FormTable dan readOnly dari disabled", () => {
      renderForm({
        data: {
          date: new Date(),
          items: [{ id: 1, item: { id: 1, name: "Item A" } }],
        },
        disabled: true,
      });

      expect(captured.formTableProps.value).toHaveLength(1);
      expect(captured.formTableProps.readOnly).toBe(true);
    });

    it("external_note collapsible defaultOpen mengikuti defaultData.external_note", () => {
      const { container } = renderForm({
        data: { date: new Date(), items: [] },
        defaultData: { external_note: "catatan lama" },
      });

      const sections = container.querySelectorAll("section[data-collapsible]");
      const target = Array.from(sections).find(
        (s) => s.getAttribute("data-collapsible") === "true",
      );
      expect(target).toBeTruthy();
    });

    it("data.referenceable menampilkan FormInput reference_to readOnly berisi LinkModel (Requirement 2.3/1.4)", () => {
      renderForm({
        data: {
          date: new Date(),
          items: [],
          referenceable: { id: 10 },
          referenceable_type: "App\\Models\\Asset\\AssetService",
        },
      });

      expect(
        screen.getByText("sales.internalOrder.columns.reference_to"),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/link-model:App\\Models\\Asset\\AssetService:10/),
      ).toBeInTheDocument();
    });

    it("tanpa data.referenceable, FormInput reference_to tidak dirender", () => {
      renderForm({ data: { date: new Date(), items: [] } });

      expect(
        screen.queryByText("sales.internalOrder.columns.reference_to"),
      ).not.toBeInTheDocument();
    });
  });

  // --------------------------------------------------------------------
  // itemColumns["item"].cell onValueChange -- cascade unit/conversion_factor/
  // source_warehouse
  // --------------------------------------------------------------------
  describe("itemColumns item.cell onValueChange", () => {
    it("set item, unit default, conversion_factor, dan source_warehouse dari dataRow.source_warehouse bila ada", () => {
      renderForm({ data: { date: new Date(), items: [] } });

      const setDataRow = vi.fn();
      const dataRow = { source_warehouse: { id: 5, name: "Gudang Row" } };
      const itemColumn = captured.formTableProps.columns.find(
        (c) => c.name === "item",
      );
      const selectedVal = {
        id: 1,
        default_uom: { id: 11, conversion_factor: 2 },
      };

      const element = itemColumn.cell({
        dataRow,
        setData: setDataRow,
        attributes: {},
      });
      element.props.onValueChange(selectedVal);

      expect(setDataRow).toHaveBeenCalledWith({
        item: selectedVal,
        unit: selectedVal.default_uom,
        conversion_factor: 2,
        source_warehouse: { id: 5, name: "Gudang Row" },
      });
    });

    it("fallback ke sourceWarehouseRef.current (data.source_warehouse) bila dataRow.source_warehouse kosong", () => {
      renderForm({
        data: {
          date: new Date(),
          items: [],
          source_warehouse: { id: 20, name: "Gudang Header" },
        },
      });

      const setDataRow = vi.fn();
      const itemColumn = captured.formTableProps.columns.find(
        (c) => c.name === "item",
      );
      const element = itemColumn.cell({
        dataRow: {},
        setData: setDataRow,
        attributes: {},
      });
      element.props.onValueChange({ id: 2, default_uom: null });

      expect(setDataRow).toHaveBeenCalledWith(
        expect.objectContaining({
          item: { id: 2, default_uom: null },
          unit: null,
          conversion_factor: undefined,
          source_warehouse: { id: 20, name: "Gudang Header" },
        }),
      );
    });
  });

  // --------------------------------------------------------------------
  // Requirement 3-6, spec asset-service-billing-reference-flow: kolom
  // "referenceable" per-baris DIHAPUS, logic-nya pindah ke itemColumns["item"].
  // InternalOrder TIDAK punya field price/customer (beda dari SalesOrder).
  // --------------------------------------------------------------------
  describe("itemColumns item.cell -- filter/auto-link/lock AssetService", () => {
    const ASSET_SERVICE_CLASS = "App\\Models\\Asset\\AssetService";
    const ASSET_SERVICE_CONSUMED_ITEM_CLASS =
      "App\\Models\\Asset\\AssetServiceConsumedItem";

    function assetServiceReferenceable(overrides = {}) {
      return {
        id: 10,
        consumed_items: [
          {
            id: 5,
            item: { id: 501 },
            quantity: 4,
            item_unit: { id: 9, conversion_factor: 1 },
          },
        ],
        ...overrides,
      };
    }

    it("kolom referenceable per-baris tidak lagi dirender", () => {
      renderForm({ data: { date: new Date(), items: [] } });

      expect(
        captured.formTableProps.columns.find((c) => c.name === "referenceable"),
      ).toBeUndefined();
    });

    it("referenceable_type AssetService: filters berisi or item.category.type=service DAN id in consumedItemVariantIds", () => {
      renderForm({
        data: {
          date: new Date(),
          items: [],
          referenceable_type: ASSET_SERVICE_CLASS,
          referenceable_id: 10,
          referenceable: assetServiceReferenceable(),
        },
      });

      const itemColumn = captured.formTableProps.columns.find(
        (c) => c.name === "item",
      );
      const element = itemColumn.cell({
        dataRow: {},
        setData: vi.fn(),
        attributes: {},
      });

      expect(element.props.filters).toEqual({
        or: {
          "item.category.type": "service",
          id: { in: [501] },
        },
      });
    });

    it("tanpa referenceable_type AssetService: filters kosong (regresi)", () => {
      renderForm({ data: { date: new Date(), items: [] } });

      const itemColumn = captured.formTableProps.columns.find(
        (c) => c.name === "item",
      );
      const element = itemColumn.cell({
        dataRow: {},
        setData: vi.fn(),
        attributes: {},
      });

      expect(element.props.filters).toBeUndefined();
    });

    it("pilih ItemVariant yang cocok consumedItem: auto-link ke AssetServiceConsumedItem, quantity/unit ikut, assetServiceLocked true", () => {
      renderForm({
        data: {
          date: new Date(),
          items: [],
          referenceable_type: ASSET_SERVICE_CLASS,
          referenceable_id: 10,
          referenceable: assetServiceReferenceable(),
        },
      });

      const setDataRow = vi.fn();
      const itemColumn = captured.formTableProps.columns.find(
        (c) => c.name === "item",
      );
      const element = itemColumn.cell({
        dataRow: {},
        setData: setDataRow,
        attributes: {},
      });

      element.props.onValueChange({ id: 501, default_uom: null });

      expect(setDataRow).toHaveBeenCalledWith(
        expect.objectContaining({
          referenceable: {
            type: ASSET_SERVICE_CONSUMED_ITEM_CLASS,
            id: 5,
          },
          quantity: 4,
          unit: { id: 9, conversion_factor: 1 },
          conversion_factor: 1,
          assetServiceLocked: true,
        }),
      );
    });

    it("pilih ItemVariant kategori service tanpa match consumedItem: auto-link ke AssetService header, TIDAK locked", () => {
      renderForm({
        data: {
          date: new Date(),
          items: [],
          referenceable_type: ASSET_SERVICE_CLASS,
          referenceable_id: 10,
          referenceable: assetServiceReferenceable(),
        },
      });

      const setDataRow = vi.fn();
      const itemColumn = captured.formTableProps.columns.find(
        (c) => c.name === "item",
      );
      const element = itemColumn.cell({
        dataRow: {},
        setData: setDataRow,
        attributes: {},
      });

      element.props.onValueChange({
        id: 999,
        default_uom: null,
        item: { category: { type: "service" } },
      });

      expect(setDataRow).toHaveBeenCalledWith(
        expect.objectContaining({
          referenceable: { type: ASSET_SERVICE_CLASS, id: 10 },
          assetServiceLocked: false,
        }),
      );
    });

    it("dataRow.assetServiceLocked true: kolom Item DAN Quantity disabled", () => {
      renderForm({ data: { date: new Date(), items: [] } });

      const itemColumn = captured.formTableProps.columns.find(
        (c) => c.name === "item",
      );
      const quantityColumn = captured.formTableProps.columns.find(
        (c) => c.name === "quantity",
      );

      const itemEl = itemColumn.cell({
        dataRow: { item: { id: 1 }, assetServiceLocked: true },
        setData: vi.fn(),
        attributes: {},
      });
      const quantityEl = quantityColumn.cell({
        dataRow: { item: { id: 1 }, assetServiceLocked: true },
        data: 4,
        setData: vi.fn(),
        attributes: {},
      });

      expect(itemEl.props.disabled).toBe(true);
      expect(quantityEl.props.disabled).toBe(true);
    });
  });

  // --------------------------------------------------------------------
  // itemColumns["unit"].cell -- set unit + conversion_factor
  // --------------------------------------------------------------------
  describe("itemColumns unit.cell", () => {
    it("onValueChange set unit dan conversion_factor dari val yang dipilih", () => {
      renderForm({ data: { date: new Date(), items: [] } });

      const setDataRow = vi.fn();
      const unitColumn = captured.formTableProps.columns.find(
        (c) => c.name === "unit",
      );
      const element = unitColumn.cell({
        data: null,
        dataRow: { item: { item_id: 3 } },
        setData: setDataRow,
        attributes: {},
      });

      expect(element.props.filters).toEqual({ item_id: 3 });
      element.props.onValueChange({ id: 9, conversion_factor: 4 });

      expect(setDataRow).toHaveBeenCalledWith({
        unit: { id: 9, conversion_factor: 4 },
        conversion_factor: 4,
      });
    });
  });

  // --------------------------------------------------------------------
  // handleBarcodeSelect: scan barcode nambah baris baru / increment qty
  // --------------------------------------------------------------------
  describe("handleBarcodeSelect (scan barcode)", () => {
    it("scan item+unit baru menambah baris baru dengan quantity 1 dan source_warehouse dari header", async () => {
      const user = userEvent.setup({ delay: null });
      const { stateRef } = renderForm({
        data: {
          date: new Date(),
          items: [],
          source_warehouse: { id: 20, name: "Gudang A" },
        },
      });
      captured.barcodePayload = {
        item: { id: 5, name: "Barang Scan" },
        unit: { id: 2, name: "Pcs" },
      };

      await user.click(screen.getByRole("button", { name: "scan-barcode" }));

      expect(stateRef.data.items).toHaveLength(1);
      expect(stateRef.data.items[0]).toEqual(
        expect.objectContaining({
          item: { id: 5, name: "Barang Scan" },
          unit: { id: 2, name: "Pcs" },
          quantity: 1,
          source_warehouse: { id: 20, name: "Gudang A" },
        }),
      );
    });

    it("scan item+unit yang sudah ada di baris meningkatkan quantity (bukan duplikat baris)", async () => {
      const user = userEvent.setup({ delay: null });
      const { stateRef } = renderForm({
        data: {
          date: new Date(),
          items: [
            {
              id: "row-1",
              item: { id: 5, name: "Barang Scan" },
              unit: { id: 2, name: "Pcs" },
              quantity: 3,
            },
          ],
        },
      });
      captured.barcodePayload = {
        item: { id: 5, name: "Barang Scan" },
        unit: { id: 2, name: "Pcs" },
      };

      await user.click(screen.getByRole("button", { name: "scan-barcode" }));

      expect(stateRef.data.items).toHaveLength(1);
      expect(stateRef.data.items[0].quantity).toBe(4);
      expect(stateRef.data.items[0].id).toBe("row-1");
    });

    it("scan item yang sama tapi unit berbeda menambah baris baru terpisah (bukan increment)", async () => {
      const user = userEvent.setup({ delay: null });
      const { stateRef } = renderForm({
        data: {
          date: new Date(),
          items: [
            {
              id: "row-1",
              item: { id: 5, name: "Barang Scan" },
              unit: { id: 2, name: "Pcs" },
              quantity: 3,
            },
          ],
        },
      });
      captured.barcodePayload = {
        item: { id: 5, name: "Barang Scan" },
        unit: { id: 99, name: "Box" },
      };

      await user.click(screen.getByRole("button", { name: "scan-barcode" }));

      expect(stateRef.data.items).toHaveLength(2);
      expect(stateRef.data.items[1]).toEqual(
        expect.objectContaining({
          item: { id: 5, name: "Barang Scan" },
          unit: { id: 99, name: "Box" },
          quantity: 1,
        }),
      );
    });

    it("scan tanpa item/unit valid (selected null) tidak mengubah data.items", async () => {
      const user = userEvent.setup({ delay: null });
      const { stateRef } = renderForm({
        data: { date: new Date(), items: [] },
      });
      captured.barcodePayload = null;

      await user.click(screen.getByRole("button", { name: "scan-barcode" }));

      expect(stateRef.data.items).toEqual([]);
    });

    it("selected berupa item langsung (tanpa wrapper .item) memakai default_uom sebagai unit", async () => {
      const user = userEvent.setup({ delay: null });
      const { stateRef } = renderForm({
        data: { date: new Date(), items: [] },
      });
      // handleBarcodeSelect: selectedItem = selected?.item ?? selected;
      // selectedUnit = selected?.unit ?? selected?.default_uom;
      captured.barcodePayload = {
        id: 6,
        name: "Barang Langsung",
        default_uom: { id: 3, name: "Unit" },
      };

      await user.click(screen.getByRole("button", { name: "scan-barcode" }));

      expect(stateRef.data.items).toHaveLength(1);
      expect(stateRef.data.items[0]).toEqual(
        expect.objectContaining({
          item: captured.barcodePayload,
          unit: { id: 3, name: "Unit" },
          quantity: 1,
        }),
      );
    });
  });

  // --------------------------------------------------------------------
  // Header source_warehouse cascade ke SEMUA baris items (TANPA gating
  // is_stock_item -- beda dari SalesOrders yang gated oleh
  // val.item.is_stock_item).
  // --------------------------------------------------------------------
  describe("header source_warehouse cascade ke items", () => {
    it("mengganti warehouse header menerapkan warehouse ke SEMUA baris tanpa syarat apa pun", async () => {
      const user = userEvent.setup({ delay: null });
      captured.warehousePayload = { id: 30, name: "Gudang B" };
      const { stateRef } = renderForm({
        data: {
          date: new Date(),
          items: [
            { id: 1, item: { id: 1, is_stock_item: true }, quantity: 1 },
            { id: 2, item: { id: 2, is_stock_item: false }, quantity: 1 },
          ],
        },
      });

      const warehouseButton = screen.getByRole("button", {
        name: /^warehouse:/,
      });
      await user.click(warehouseButton);

      expect(stateRef.data.source_warehouse).toEqual({
        id: 30,
        name: "Gudang B",
      });
      expect(stateRef.data.items[0].source_warehouse).toEqual({
        id: 30,
        name: "Gudang B",
      });
      expect(stateRef.data.items[1].source_warehouse).toEqual({
        id: 30,
        name: "Gudang B",
      });
    });

    it("cascade tetap berjalan walau data.items kosong (tidak crash pada map array kosong)", async () => {
      const user = userEvent.setup({ delay: null });
      captured.warehousePayload = { id: 30, name: "Gudang B" };
      const { stateRef } = renderForm({
        data: { date: new Date(), items: [] },
      });

      const warehouseButton = screen.getByRole("button", {
        name: /^warehouse:/,
      });
      await user.click(warehouseButton);

      expect(stateRef.data.source_warehouse).toEqual({
        id: 30,
        name: "Gudang B",
      });
      expect(stateRef.data.items).toEqual([]);
    });
  });
});
