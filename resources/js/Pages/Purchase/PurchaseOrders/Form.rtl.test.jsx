import { describe, expect, it, vi, beforeEach } from "vitest";
import { render as rtlRender, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";

// ============================================================================
// Form.jsx (PurchaseOrders) adalah halaman transaksi (749 baris) yang men-
// compose banyak child berat: FormPage/FormPageContent (context form induk),
// FormTable (tabel item generik 2074 baris, sudah ada test sendiri), semua
// *LinkModel (Item/Warehouse/Supplier/Tax/Currency/Unit -- wrapper LinkModel
// dialog berat), ItemBarcode, DatetimePicker, SelectModel (import items dari
// WorkOrder/PurchaseRequest), AdditionalDiscount & PaymentSchedule (masing2
// sudah ada test sendiri). Sesuai arahan task: SEMUA child di atas di-stub,
// fokus HANYA ke logic UNIK milik Form.jsx sendiri:
//   1. Kalkulasi total (rawNetAmount/rawTaxAmount/net_amount/tax_amount/amount)
//      dari data.items via allocateDiscount (basis MENTAH terpisah dari basis
//      teralokasi -- lihat komentar panjang di Form.jsx baris 37-50).
//   2. mergeItems (import dari WorkOrder/PurchaseRequest via SelectModel atau
//      loadFrom prop) -- dedupe by referenceable_type+id, hapus baris qty<=0.
//   3. handleBarcodeSelect (scan barcode) -- increment qty baris existing atau
//      tambah baris baru.
//   4. Cascade required_date/target_warehouse header -> seluruh items.
//   5. Wiring kolom item (item_column) -- pilih item mengisi unit+conversion_
//      factor+required_date+target_warehouse sekaligus.
//   6. Tampilan dual-currency (kolom konversi default_currency_id) hanya saat
//      currency dokumen beda dari default_currency_id.
// NumberInput dan FormInput/Textarea dipakai REAL (mengikuti pola
// PaymentSchedule.rtl.test.jsx) karena NumberInput sudah punya test sendiri
// dan diperlukan di sini untuk membaca nilai total yang benar-benar dihitung
// Form.jsx (bukan sekadar stub pass-through).
// ============================================================================

const stableT = (key) => key;
vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({ t: stableT }),
}));

const usePageMock = vi.fn();
vi.mock("@inertiajs/react", () => ({
  usePage: () => usePageMock(),
}));

// useFormPage di-mock sebagai stateful hook (mirip makeFakeUseForm di
// FormPage.rtl.test.jsx) supaya setData yang dipanggil Form.jsx benar2
// memicu re-render dengan data terbaru -- diperlukan utk menguji cascade
// (required_date/target_warehouse -> items) dan kalkulasi total yang
// reaktif terhadap perubahan data.items.
let formPageSeed = {};
function useFormPageStateful() {
  const [data, setDataState] = useState(formPageSeed);
  const setData = (...args) => {
    if (typeof args[0] === "function") {
      setDataState((prev) => args[0](prev));
    } else if (typeof args[0] === "string") {
      setDataState((prev) => ({ ...prev, [args[0]]: args[1] }));
    } else {
      setDataState((prev) => ({ ...prev, ...args[0] }));
    }
  };
  return {
    data,
    setData,
    defaultData: {},
    disabled: false,
    dataBefore: {},
  };
}

vi.mock("@/Pages/Core/FormPage", async () => {
  const React = await import("react");
  return {
    FormPageContent: ({ title, actions, children }) => (
      <div>
        {title && <h2>{title}</h2>}
        {actions}
        {children}
      </div>
    ),
    useFormPage: (...args) => useFormPageStateful(...args),
    useFormPageMeta: () => undefined,
    FormPageContext: React.createContext(),
  };
});

// FormTable adalah komponen generik besar dengan test sendiri (FormTable.
// test.js) -- distub sebagai renderer sederhana yang memanggil tiap
// column.cell() untuk baris dari `value`, supaya definisi kolom (itemColumns)
// milik Form.jsx yang diuji, bukan mekanisme drag-drop/tabel FormTable itu
// sendiri. Pola identik dgn PaymentSchedule.rtl.test.jsx.
vi.mock("@/Components/FormTable", () => ({
  default: ({ columns, value, onValueChange }) => {
    const rows = value ?? [];
    const updateRow = (index, keyOrObj, val) => {
      const next = [...rows];
      const row = { ...next[index] };
      if (typeof keyOrObj === "object") {
        Object.assign(row, keyOrObj);
      } else {
        row[keyOrObj] = val;
      }
      next[index] = row;
      onValueChange?.(next);
    };
    return (
      <div data-testid="stub-form-table">
        {rows.map((row, index) => (
          <div key={row.id ?? index} data-testid={`row-${index}`}>
            {columns.map((col) => (
              <div key={col.name} data-testid={`cell-${col.name}-${index}`}>
                {col.cell({
                  dataRow: row,
                  data: row[col.name],
                  setData: (keyOrObj, val) => updateRow(index, keyOrObj, val),
                  attributes: {},
                })}
              </div>
            ))}
          </div>
        ))}
      </div>
    );
  },
}));

vi.mock("./ItemForm", () => ({
  default: () => <div data-testid="stub-item-form" />,
}));

// Semua *LinkModel (dialog combobox berat via Components/LinkModel.jsx) dan
// ItemBarcode/DatetimePicker distub jadi tombol sederhana yang memanggil
// onValueChange/onSelect dengan payload tetap -- cukup untuk menguji bahwa
// Form.jsx meneruskan value & memproses callback dengan benar.
vi.mock("@/Pages/Inventory/Items/ItemVariantLinkModel", () => ({
  default: ({ value, onValueChange }) => (
    <button
      type="button"
      data-testid="item-link-model"
      onClick={() =>
        onValueChange?.({
          id: 100,
          name: "Item A",
          default_uom: { id: 1, name: "PCS", conversion_factor: 1 },
        })
      }
    >
      item:{value?.name ?? "none"}
    </button>
  ),
}));

vi.mock("@/Pages/Inventory/Warehouses/WarehouseLinkModel", () => ({
  default: ({ value, onValueChange }) => (
    <button
      type="button"
      data-testid="warehouse-link-model"
      onClick={() => onValueChange?.({ id: 1, name: "Gudang A" })}
    >
      warehouse:{value?.name ?? "none"}
    </button>
  ),
}));

vi.mock("../Suppliers/SupplierLinkModel", () => ({
  default: ({ value, onValueChange }) => (
    <button
      type="button"
      data-testid="supplier-link-model"
      onClick={() => onValueChange?.({ id: 1, name: "Supplier A" })}
    >
      supplier:{value?.name ?? "none"}
    </button>
  ),
}));

vi.mock("@/Pages/Finances/Taxes/TaxLinkModel", () => ({
  default: ({ value, onValueChange }) => (
    <button
      type="button"
      data-testid="tax-link-model"
      onClick={() => onValueChange?.({ id: 1, name: "PPN", rate: 11 })}
    >
      tax:{value?.name ?? "none"}
    </button>
  ),
}));

vi.mock("@/Pages/Inventory/Items/ItemUnitLinkModel", () => ({
  default: ({ value, onValueChange }) => (
    <button
      type="button"
      data-testid="unit-link-model"
      onClick={() =>
        onValueChange?.({ id: 2, name: "BOX", conversion_factor: 12 })
      }
    >
      unit:{value?.name ?? "none"}
    </button>
  ),
}));

vi.mock("@/Pages/Core/CurrencyLinkModel", () => ({
  default: ({ value, onValueChange }) => (
    <button
      type="button"
      data-testid="currency-link-model"
      onClick={() => onValueChange?.({ id: 1, code: "usd" })}
    >
      currency:{value?.code ?? "none"}
    </button>
  ),
}));

vi.mock("@/Pages/Inventory/Items/ItemBarcode", () => ({
  default: ({ onSelect }) => (
    <button
      type="button"
      data-testid="item-barcode"
      onClick={() =>
        onSelect?.({
          item: { id: 100, name: "Item A" },
          unit: { id: 1, name: "PCS" },
        })
      }
    >
      scan-barcode
    </button>
  ),
}));

vi.mock("@/Components/DatetimePicker", () => ({
  default: ({ value, onValueChange, ...rest }) => (
    <input
      data-testid="datetime-picker"
      {...rest}
      type="text"
      value={value ? new Date(value).toISOString() : ""}
      onChange={(e) => {
        const v = e.target.value;
        onValueChange?.(v ? new Date(v) : null);
      }}
    />
  ),
}));

vi.mock("@/Components/SelectModel", () => ({
  default: ({ label, onSelected }) => (
    <button
      type="button"
      data-testid="select-model-import"
      onClick={() =>
        onSelected?.({
          items: [
            {
              id: 1,
              item: { id: 200, name: "Item Import" },
              target_warehouse: { id: 5, name: "Gudang Import" },
              description: "dari WO",
              unordered_quantity: 3,
              unit: { id: 1, name: "PCS" },
            },
          ],
          model: "App\\Models\\Purchase\\PurchaseRequest",
        })
      }
    >
      {label}
    </button>
  ),
  loadFromModel: vi.fn(),
}));

vi.mock("@/Pages/Finances/Components/AdditionalDiscount", () => ({
  default: ({ netAmount, taxAmount, rawNetAmount, rawTaxAmount }) => (
    <div data-testid="additional-discount">
      net:{netAmount} tax:{taxAmount} rawNet:{rawNetAmount} rawTax:
      {rawTaxAmount}
    </div>
  ),
}));

vi.mock("@/Pages/Finances/Components/PaymentSchedule", () => ({
  default: ({ value }) => (
    <div data-testid="payment-schedule">rows:{value?.length ?? 0}</div>
  ),
}));

import Form from "./Form";
import { TooltipProvider } from "@/Components/ui/tooltip";

// NumberInput (dipakai kolom total readOnly) membungkus diri dengan
// <Tooltip> internal tanpa provider sendiri.
const render = (ui) => rtlRender(<TooltipProvider>{ui}</TooltipProvider>);

function setPageProps(overrides = {}) {
  usePageMock.mockReturnValue({
    props: {
      loadFrom: null,
      preferences: {
        default_currency_id: "idr",
        default_number_format: "#,###.##",
      },
      ...overrides,
    },
  });
}

describe("PurchaseOrders Form", () => {
  beforeEach(() => {
    formPageSeed = {};
    setPageProps();
  });

  describe("kalkulasi total", () => {
    it("net_amount & tax_amount dihitung dari items tanpa diskon dokumen", () => {
      formPageSeed = {
        items: [
          {
            item: { id: 1, name: "A" },
            quantity: 2,
            rate: 1000,
            tax: { rate: 10 },
          },
          {
            item: { id: 2, name: "B" },
            quantity: 1,
            rate: 500,
            tax: { rate: 0 },
          },
        ],
      };
      render(<Form />);

      // net_amount = 2*1000 + 1*500 = 2500 (tanpa discount_on aktif)
      expect(
        screen.getByLabelText("purchase.purchaseOrder.columns.net_total (IDR)"),
      ).toHaveValue("2,500.00");
      // tax_amount = 2000*10/100 + 500*0 = 200
      expect(
        screen.getByLabelText(
          "purchase.purchaseOrder.columns.tax_amount (IDR)",
        ),
      ).toHaveValue("200.00");
      // amount = net + tax = 2700
      expect(
        screen.getByLabelText("purchase.purchaseOrder.columns.total (IDR)"),
      ).toHaveValue("2,700.00");
    });

    it("baris tanpa item (belum dipilih) diabaikan dari perhitungan rawNetAmount/rawTaxAmount", () => {
      formPageSeed = {
        items: [
          { item: null, quantity: 5, rate: 1000 },
          { item: { id: 1 }, quantity: 1, rate: 300, tax: { rate: 0 } },
        ],
      };
      render(<Form />);

      expect(
        screen.getByLabelText("purchase.purchaseOrder.columns.net_total (IDR)"),
      ).toHaveValue("300.00");
    });

    it("discount_on=net_total memotong net_amount secara pro-rata dan ikut menurunkan tax_amount", () => {
      formPageSeed = {
        discount_on: "net_total",
        discount_rate: 10,
        latestDiscountKey: "discount_rate",
        items: [
          {
            item: { id: 1 },
            quantity: 1,
            rate: 1000,
            tax: { rate: 10 },
          },
        ],
      };
      render(<Form />);

      // basis net_total = 1000, discount 10% = 100 -> basic_amount jadi 900
      expect(
        screen.getByLabelText("purchase.purchaseOrder.columns.net_total (IDR)"),
      ).toHaveValue("900.00");
      // tax dihitung ulang dari basic_amount setelah diskon: 900*10/100 = 90
      expect(
        screen.getByLabelText(
          "purchase.purchaseOrder.columns.tax_amount (IDR)",
        ),
      ).toHaveValue("90.00");
    });

    it("AdditionalDiscount menerima rawNetAmount/rawTaxAmount (basis SEBELUM diskon) terpisah dari net/tax teralokasi", () => {
      formPageSeed = {
        discount_on: "net_total",
        discount_rate: 10,
        latestDiscountKey: "discount_rate",
        items: [
          { item: { id: 1 }, quantity: 1, rate: 1000, tax: { rate: 10 } },
        ],
      };
      render(<Form />);

      const el = screen.getByTestId("additional-discount");
      // rawNet tetap 1000 (mentah), net setelah diskon 900.
      expect(el).toHaveTextContent("net:900");
      expect(el).toHaveTextContent("rawNet:1000");
      // rawTax mentah = 100, tax setelah diskon = 90.
      expect(el).toHaveTextContent("tax:90");
      expect(el).toHaveTextContent("rawTax:100");
    });

    it("kolom konversi mata uang default TIDAK muncul saat currency dokumen sama dengan default_currency_id", () => {
      formPageSeed = {
        currency: { code: "idr" },
        items: [{ item: { id: 1 }, quantity: 1, rate: 100 }],
      };
      render(<Form />);

      // Hanya SATU field net_total (basis dokumen) -- tanpa duplikasi kolom
      // konversi (yang seharusnya cuma muncul saat currency != default).
      expect(
        screen.getAllByLabelText(/purchase\.purchaseOrder\.columns\.net_total/),
      ).toHaveLength(1);
      expect(
        screen.getByLabelText("purchase.purchaseOrder.columns.net_total (IDR)"),
      ).toBeInTheDocument();
    });

    it("kolom konversi mata uang default MUNCUL dan terkonversi via exchange_rate saat currency dokumen beda", () => {
      formPageSeed = {
        currency: { code: "usd" },
        exchange_rate: 15000,
        items: [{ item: { id: 1 }, quantity: 1, rate: 10, tax: { rate: 0 } }],
      };
      render(<Form />);

      // Baris USD (basis dokumen): net_total 10.
      expect(
        screen.getByLabelText("purchase.purchaseOrder.columns.net_total (USD)"),
      ).toHaveValue("10.00");
      // Baris konversi IDR: 10 * 15000 = 150000.
      expect(
        screen.getByLabelText("purchase.purchaseOrder.columns.net_total (IDR)"),
      ).toHaveValue("150,000.00");
    });
  });

  describe("mergeItems (import dari WorkOrder/PurchaseRequest)", () => {
    it("klik tombol import (SelectModel) menambah baris baru ke data.items", async () => {
      const user = userEvent.setup({ delay: null });
      formPageSeed = { items: [] };
      render(<Form />);

      await user.click(screen.getByTestId("select-model-import"));

      expect(screen.getByTestId("row-0")).toBeInTheDocument();
      const itemCell = screen.getByTestId("cell-item-0");
      expect(itemCell).toHaveTextContent("item:Item Import");
    });

    it("import item dengan referenceable yang sudah ada meng-update quantity baris existing (bukan duplikat)", async () => {
      const user = userEvent.setup({ delay: null });
      formPageSeed = {
        items: [
          {
            id: "existing-1",
            item: { id: 200, name: "Item Import" },
            referenceable_type: "App\\Models\\Purchase\\PurchaseRequest",
            referenceable_id: 1,
            quantity: 1,
          },
        ],
      };
      render(<Form />);

      await user.click(screen.getByTestId("select-model-import"));

      // Tetap 1 baris (update, bukan tambah baris baru) dengan quantity dari
      // unordered_quantity (3) hasil merge.
      expect(screen.queryByTestId("row-1")).not.toBeInTheDocument();
      expect(screen.getByTestId("row-0")).toBeInTheDocument();
    });
  });

  describe("handleBarcodeSelect (scan barcode)", () => {
    it("scan item+unit baru menambah baris baru dengan quantity 1", async () => {
      const user = userEvent.setup({ delay: null });
      formPageSeed = { items: [] };
      render(<Form />);

      await user.click(screen.getByTestId("item-barcode"));

      expect(screen.getByTestId("row-0")).toBeInTheDocument();
      const qtyCell = screen.getByTestId("cell-quantity-0");
      const qtyInput = qtyCell.querySelector("input");
      expect(qtyInput).toHaveValue("1.00");
    });

    it("scan item+unit yang sudah ada di baris manapun meng-increment quantity baris tsb (bukan menambah baris baru)", async () => {
      const user = userEvent.setup({ delay: null });
      formPageSeed = {
        items: [
          {
            id: "row-a",
            item: { id: 100, name: "Item A" },
            unit: { id: 1, name: "PCS" },
            quantity: 4,
          },
        ],
      };
      render(<Form />);

      await user.click(screen.getByTestId("item-barcode"));

      expect(screen.queryByTestId("row-1")).not.toBeInTheDocument();
      const qtyCell = screen.getByTestId("cell-quantity-0");
      const qtyInput = qtyCell.querySelector("input");
      expect(qtyInput).toHaveValue("5.00");
    });
  });

  describe("cascade header ke items", () => {
    it("mengubah required_date header ikut memperbarui required_date semua baris items", async () => {
      formPageSeed = {
        items: [
          { id: "r1", item: { id: 1 }, quantity: 1, rate: 10 },
          { id: "r2", item: { id: 2 }, quantity: 1, rate: 20 },
        ],
      };
      render(<Form />);

      const requiredDateInput = screen.getByLabelText(
        /^purchase\.purchaseOrder\.columns\.required_date/,
      );

      const { fireEvent } = await import("@testing-library/react");
      fireEvent.change(requiredDateInput, {
        target: { value: "2026-03-01T00:00:00.000Z" },
      });

      const row0DateCell = screen.getByTestId("cell-required_date-0");
      const row1DateCell = screen.getByTestId("cell-required_date-1");
      const row0Input = row0DateCell.querySelector(
        '[data-testid="datetime-picker"]',
      );
      const row1Input = row1DateCell.querySelector(
        '[data-testid="datetime-picker"]',
      );
      expect(row0Input).toHaveValue("2026-03-01T00:00:00.000Z");
      expect(row1Input).toHaveValue("2026-03-01T00:00:00.000Z");
    });

    it("mengubah target_warehouse header ikut memperbarui target_warehouse semua baris items", async () => {
      const user = userEvent.setup({ delay: null });
      formPageSeed = {
        items: [
          { id: "r1", item: { id: 1 }, quantity: 1, rate: 10 },
          { id: "r2", item: { id: 2 }, quantity: 1, rate: 20 },
        ],
      };
      render(<Form />);

      // Ada 2 instance WarehouseLinkModel di layar: field header
      // target_warehouse dan kolom target_warehouse tiap baris item. Field
      // header selalu dirender lebih dulu (sebelum FormTable) -- ambil
      // instance pertama.
      const [headerWarehouseButton] = screen.getAllByTestId(
        "warehouse-link-model",
      );
      await user.click(headerWarehouseButton);

      const row0Cell = screen.getByTestId("cell-target_warehouse-0");
      const row1Cell = screen.getByTestId("cell-target_warehouse-1");
      expect(row0Cell).toHaveTextContent("warehouse:Gudang A");
      expect(row1Cell).toHaveTextContent("warehouse:Gudang A");
    });

    it("target_warehouse header TIDAK error saat items masih kosong", async () => {
      const user = userEvent.setup({ delay: null });
      formPageSeed = { items: [] };
      render(<Form />);

      await user.click(screen.getByTestId("warehouse-link-model"));

      expect(screen.getByTestId("warehouse-link-model")).toHaveTextContent(
        "warehouse:Gudang A",
      );
    });
  });

  describe("wiring kolom item", () => {
    it("memilih item pada kolom item mengisi unit dan target_warehouse header sekaligus pada baris tsb", async () => {
      const user = userEvent.setup({ delay: null });
      formPageSeed = {
        required_date: new Date("2026-05-01T00:00:00.000Z"),
        target_warehouse: { id: 9, name: "Gudang Utama" },
        items: [{ id: "r1", item: null, quantity: 1 }],
      };
      render(<Form />);

      await user.click(screen.getByTestId("item-link-model"));

      const unitCell = screen.getByTestId("cell-unit-0");
      expect(unitCell).toHaveTextContent("unit:PCS");
      const warehouseCell = screen.getByTestId("cell-target_warehouse-0");
      expect(warehouseCell).toHaveTextContent("warehouse:Gudang Utama");
    });
  });

  describe("loadFrom prop (via useEffect)", () => {
    it("loadFrom null tidak memanggil loadFromModel/mergeItems", async () => {
      const { loadFromModel } = await import("@/Components/SelectModel");
      setPageProps({ loadFrom: null });
      formPageSeed = { items: [] };
      render(<Form />);

      expect(loadFromModel).not.toHaveBeenCalled();
    });
  });
});
