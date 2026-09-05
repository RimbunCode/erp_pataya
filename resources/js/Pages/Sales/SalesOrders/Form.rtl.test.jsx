import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// ============================================================================
// Form.jsx (819 baris) adalah halaman form transaksi Sales Order yang selalu
// dirender di dalam <FormPage> (lihat resources/js/Pages/Sales/SalesOrders/
// Index.jsx / Create.jsx pola project ini). Permukaan dependency-nya sangat
// besar: FormPage/FormPageContent/useFormPage (context form generik, sudah
// ada test sendiri di FormPage.rtl.test.jsx & FormPageContent.rtl.test.jsx),
// FormTable (2000+ baris, sudah punya test sendiri), AdditionalDiscount &
// PaymentSchedule (komponen transaksi lain, sudah ada test sendiri:
// PaymentSchedule.rtl.test.jsx), SelectModel (dialog import item, berat:
// Table2 + FilterBuilder + Pagination), dan belasan *LinkModel (dialog CRUD
// generik LinkModel.jsx).
//
// Sesuai arahan task: SEMUA komponen anak yang sudah py test sendiri di-stub,
// fokus test HANYA pada logic UNIK milik Form.jsx SalesOrders sendiri:
// - Kalkulasi header (net_amount/tax_amount/grand_total) dari data.items +
//   alokasi diskon (rawLines/rawNetAmount/rawTaxAmount/allocatedLines) --
//   fungsi allocateDiscount & calculateArray dipakai REAL (pure util, sudah
//   ada test sendiri di discountAllocation.test.js) supaya assertion angka
//   benar-benar mencerminkan algoritma produksi, bukan re-implementasi di test.
// - mergeItems (dedup+update quantity berdasar referenceable_type/id, hapus
//   baris yang quantity hasil merge <= 0).
// - handleBarcodeSelect (tambah baris baru vs increment quantity kalau
//   item+unit yang sama sudah ada).
// - mapItem (callback FormTable, alokasi diskon per baris) -- pure logic,
//   dipanggil langsung dari prop yang ditangkap stub FormTable.
// - useEffect loadFrom -> loadFromModel -> mergeItems.
// - Visibility kondisional: rent_date (is_rent), reference_to (referenceable),
//   exchange_rate & baris total dual-currency (currency != default_currency).
// ============================================================================

const stableT = (key) => key;
vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({ t: stableT }),
}));

window.route = (name, params) =>
  params ? `${name}/${JSON.stringify(params)}` : name;

const usePageMock = vi.fn();
vi.mock("@inertiajs/react", () => ({
  usePage: () => usePageMock(),
}));

const axiosPost = vi.fn();
vi.mock("axios", () => ({
  default: {
    get: vi.fn(),
    post: (...a) => axiosPost(...a),
    delete: vi.fn(),
    patch: vi.fn(),
  },
}));

// --- @/Pages/Core/FormPage --------------------------------------------------
// FormPageContent disederhanakan jadi <section> yang selalu merender children
// (tanpa Tabs/collapsible asli) supaya semua FormPageContent di Form.jsx aktif
// sekaligus tanpa perlu provider Tabs. useFormPage dikontrol per test lewat
// useFormPageMock. FormPageContext diekspor sebagai React Context sungguhan
// supaya useCanUpdate (dipakai FormInput/NumberInput/FormCheckbox di dalam
// pohon) tidak error walau tanpa provider (default undefined -> boleh update).
const useFormPageMock = vi.fn();
vi.mock("@/Pages/Core/FormPage", async () => {
  const React = await import("react");
  const ctx = React.createContext();
  return {
    FormPageContent: ({ title, actions, children }) => (
      <section>
        {title && <h3>{title}</h3>}
        {actions}
        {children}
      </section>
    ),
    useFormPage: (...a) => useFormPageMock(...a),
    useFormPageMeta: () => undefined,
    FormPageContext: ctx,
  };
});

// --- FormTable ---------------------------------------------------------------
// Komponen generik besar dgn test sendiri -- distub agar Form.jsx SalesOrders
// yang diuji hanya bertanggung jawab meneruskan props (columns/value/mapItem)
// dengan benar, bukan mekanisme rendering tabel/drag-drop FormTable itu sendiri.
// Ditangkap via captured.formTableProps supaya test bisa memanggil mapItem()
// langsung (pure logic alokasi diskon per baris).
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

// --- AdditionalDiscount & PaymentSchedule ------------------------------------
// Komponen transaksi lain yang sudah py test sendiri (PaymentSchedule.rtl.
// test.jsx) -- distub, hanya menangkap props yang diteruskan Form.jsx.
vi.mock("@/Pages/Finances/Components/AdditionalDiscount", () => ({
  default: (props) => {
    captured.additionalDiscountProps = props;
    return <div data-testid="stub-additional-discount" />;
  },
}));
vi.mock("@/Pages/Finances/Components/PaymentSchedule", () => ({
  default: (props) => {
    captured.paymentScheduleProps = props;
    return <div data-testid="stub-payment-schedule" />;
  },
}));

// --- SelectModel (default export + loadFromModel named export) --------------
// SelectModel asli membawa Table2 + FilterBuilder + Pagination (berat, dialog
// import item dari WorkOrder) -- distub jadi tombol yang memanggil onSelected
// langsung dgn payload tetap, cukup untuk menguji mergeItems. loadFromModel
// dikontrol lewat mock fn agar useEffect(loadFrom) bisa diuji tanpa axios asli.
const loadFromModelMock = vi.fn();
vi.mock("@/Components/SelectModel", () => ({
  default: ({ onSelected, label }) => (
    <button
      type="button"
      onClick={() => onSelected(captured.selectModelPayload)}
    >
      {label}
    </button>
  ),
  loadFromModel: (...a) => loadFromModelMock(...a),
}));

// --- LinkModel-family & komponen anak berat lain (dialog CRUD generik / Popover) ---
vi.mock("@/Pages/Sales/Customers/CustomerLinkModel", () => ({
  default: ({ value, onValueChange, disabled }) => (
    <button
      type="button"
      disabled={disabled}
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
vi.mock("@/Pages/Core/CurrencyLinkModel", () => ({
  default: ({ value, onValueChange }) => (
    <button type="button" onClick={() => onValueChange({ id: 2, code: "USD" })}>
      currency:{value?.code ?? "none"}
    </button>
  ),
}));
vi.mock("./SalesOrderLinkModel", () => ({
  default: ({ value, onValueChange }) => (
    <button
      type="button"
      onClick={() => onValueChange({ id: 99, code: "SO-099" })}
    >
      reference_so:{value?.code ?? "none"}
    </button>
  ),
}));
vi.mock("@/Components/LinkModel", () => ({
  default: ({ model, value }) => (
    <div>
      link-model:{model}:{value?.id ?? "none"}
    </div>
  ),
}));
vi.mock("@/Pages/Inventory/Items/ItemBarcode", () => ({
  default: ({ onSelect }) => (
    <button type="button" onClick={() => onSelect(captured.barcodePayload)}>
      scan-barcode
    </button>
  ),
}));
vi.mock("@/Pages/Inventory/Warehouses/WarehouseLinkModel", () => ({
  default: ({ value, onValueChange }) => (
    <button
      type="button"
      onClick={() =>
        onValueChange({
          id: 20,
          name: "Gudang A",
          item: { is_stock_item: true },
        })
      }
    >
      warehouse:{value?.name ?? "none"}
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
// Kolom item (ItemVariantLinkModel/ItemUnitLinkModel/TaxLinkModel) hanya
// dipanggil lewat itemColumns[].cell -- tidak ikut render krn FormTable
// distub -- tapi tetap dimock defensif supaya import module-nya tidak
// melempar error saat dievaluasi.
vi.mock("@/Pages/Inventory/Items/ItemVariantLinkModel", () => ({
  default: () => <div>item-variant-link</div>,
}));
vi.mock("@/Pages/Inventory/Items/ItemUnitLinkModel", () => ({
  default: () => <div>item-unit-link</div>,
}));
vi.mock("@/Pages/Finances/Taxes/TaxLinkModel", () => ({
  default: () => <div>tax-link</div>,
}));

import { useState } from "react";
import Form from "./Form";

// useFormPage asli mengembalikan context React (state hidup, re-render saat
// setData dipanggil). Supaya interaksi user (klik checkbox/tombol) benar-benar
// memicu re-render Form dan bisa diverifikasi lewat `screen`, useFormPageMock
// didelegasikan ke komponen wrapper <TestFormPageState> yang pakai useState
// sungguhan -- BUKAN sekadar mengubah nilai return mock (yang tidak memicu
// re-render React sama sekali). `latestState` di-expose ke luar render lewat
// ref supaya assertion di test bisa membaca data.items final setelah interaksi.
function TestFormPageState({ initial, stateRef, children }) {
  const [data, setDataState] = useState(initial.data);
  // Meniru semantik ASLI Inertia useForm().setData() (lihat
  // @inertiajs/react setDataFunction): argumen string -> set 1 field
  // (merge), argumen fungsi -> updater (bebas merge/replace sesuai
  // implementasi fungsinya), TAPI argumen objek MENGGANTI SELURUH data
  // form -- BUKAN merge. Mock lama (selalu merge utk objek) pernah
  // menyembunyikan bug nyata (Form.jsx sempat memanggil setData({...})
  // form-level yg menghapus date/referenceable/items).
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

// Varian async renderForm() -- dipakai HANYA oleh test yang datanya memicu
// efek async saat mount (loadFrom -> loadFromModel, referenceable ->
// AssetService lookup): render() polos RTL cuma membungkus act() bagian
// SINKRON; promise mock (walau instan) tetap lanjut di microtask SESUDAH
// act() itu selesai, dan waitFor() pasca-render cuma membungkus tiap
// POLL-nya sendiri (balapan vs resolusi microtask pertama). Bungkus render()
// ITU SENDIRI dalam `await act(async () => {})` -- versi async act() secara
// eksplisit menunggu SEMUA microtask sampai stabil dulu.
async function renderFormAsync(overrides = {}) {
  let result;
  await act(async () => {
    result = renderForm(overrides);
  });
  return result;
}

describe("Sales Order Form.jsx", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(captured).forEach((k) => delete captured[k]);
    usePageMock.mockReturnValue({
      props: {
        preferences: { default_currency_id: "idr" },
        loadFrom: null,
      },
    });
    loadFromModelMock.mockReset();
  });

  // --------------------------------------------------------------------
  // Kalkulasi header: net_amount / tax_amount / grand_total
  // --------------------------------------------------------------------
  describe("kalkulasi total dari data.items", () => {
    it("tanpa item, semua total nol dan tidak crash", () => {
      renderForm({ data: { date: new Date(), items: [] } });

      // net_total & tax_amount & grand_total masing-masing dirender readOnly
      // NumberInput bernilai 0 -- FormTable distub jadi cukup pastikan tidak
      // ada error dan header FormPageContent utama muncul.
      expect(screen.getByText("sales.salesOrder.detail")).toBeInTheDocument();
      expect(captured.formTableProps.value).toEqual([]);
    });

    it("menghitung net_amount & tax_amount dari beberapa baris item tanpa diskon", () => {
      renderForm({
        data: {
          date: new Date(),
          items: [
            { item: { id: 1 }, quantity: 2, price: 100000, tax: { rate: 10 } },
            { item: { id: 2 }, quantity: 1, price: 50000, tax: { rate: 0 } },
          ],
        },
      });

      // basic: 2*100000 + 1*50000 = 250000; tax: 200000*10% + 50000*0% = 20000
      const numberInputs = document.querySelectorAll("input");
      const values = Array.from(numberInputs).map((el) => el.value);
      expect(values).toContain("250,000.00");
      expect(values).toContain("20,000.00");
      expect(values).toContain("270,000.00"); // grand total
    });

    it("baris item tanpa `item` (baris kosong) diabaikan dari kalkulasi (rawLines filter)", () => {
      renderForm({
        data: {
          date: new Date(),
          items: [
            { item: { id: 1 }, quantity: 1, price: 10000, tax: { rate: 0 } },
            { item: null, quantity: 5, price: 999999, tax: { rate: 50 } },
          ],
        },
      });

      const values = Array.from(document.querySelectorAll("input")).map(
        (el) => el.value,
      );
      expect(values).toContain("10,000.00");
      expect(values).not.toContain("999,999.00");
    });

    it("discount_on=net_total memotong net_amount pro-rata dan tax_amount dihitung ulang dari basis terpotong", () => {
      renderForm({
        data: {
          date: new Date(),
          items: [
            { item: { id: 1 }, quantity: 1, price: 100000, tax: { rate: 10 } },
          ],
          discount_on: "net_total",
          discount_rate: 10,
          latestDiscountKey: "discount_rate",
        },
      });

      // basic 100000, diskon 10% -> net 90000, tax 90000*10% = 9000, grand 99000.
      const values = Array.from(document.querySelectorAll("input")).map(
        (el) => el.value,
      );
      expect(values).toContain("90,000.00");
      expect(values).toContain("9,000.00");
      expect(values).toContain("99,000.00");
    });

    it("menampilkan baris total tambahan dalam default_currency_id ketika currency dokumen berbeda", () => {
      renderForm({
        data: {
          date: new Date(),
          items: [
            { item: { id: 1 }, quantity: 1, price: 1000, tax: { rate: 0 } },
          ],
          currency: { code: "usd" },
          exchange_rate: 15000,
        },
      });

      // net_total dalam currency dokumen (1,000.00) DAN dalam default currency
      // (1,000 * 15000 = 15,000,000.00) sama-sama harus muncul.
      const values = Array.from(document.querySelectorAll("input")).map(
        (el) => el.value,
      );
      expect(values).toContain("1,000.00");
      expect(values).toContain("15,000,000.00");
    });

    it("tidak menampilkan baris total dual-currency ketika currency dokumen sama dengan default", () => {
      renderForm({
        data: {
          date: new Date(),
          items: [
            { item: { id: 1 }, quantity: 1, price: 1000, tax: { rate: 0 } },
          ],
          currency: { code: "idr" },
        },
      });

      const labels = screen
        .getAllByText((_, el) => el?.tagName === "LABEL")
        .map((el) => el.textContent);
      const netTotalLabels = labels.filter((t) =>
        t.includes("sales.salesOrder.columns.net_total"),
      );
      // Hanya 1 baris net_total (currency dokumen == default, tidak ada baris
      // duplikat dalam default_currency_id).
      expect(netTotalLabels).toHaveLength(1);
    });
  });

  // --------------------------------------------------------------------
  // AdditionalDiscount & PaymentSchedule: props diteruskan dengan benar
  // --------------------------------------------------------------------
  describe("props diteruskan ke AdditionalDiscount & PaymentSchedule", () => {
    it("AdditionalDiscount menerima net_amount/tax_amount/rawNetAmount/rawTaxAmount hasil kalkulasi Form", () => {
      renderForm({
        data: {
          date: new Date(),
          items: [
            { item: { id: 1 }, quantity: 1, price: 100000, tax: { rate: 10 } },
          ],
        },
      });

      expect(captured.additionalDiscountProps.netAmount).toBe(100000);
      expect(captured.additionalDiscountProps.taxAmount).toBe(10000);
      expect(captured.additionalDiscountProps.rawNetAmount).toBe(100000);
      expect(captured.additionalDiscountProps.rawTaxAmount).toBe(10000);
    });

    it("PaymentSchedule.additionalData menghitung payment_amount dari invoice_portion terhadap grand total (amount)", () => {
      renderForm({
        data: {
          date: new Date(),
          items: [
            { item: { id: 1 }, quantity: 1, price: 100000, tax: { rate: 0 } },
          ],
          payment_schedules: [{ id: "row1", invoice_portion: 50 }],
        },
      });

      const result = captured.paymentScheduleProps.additionalData(
        captured.paymentScheduleProps.value,
      );
      // amount = net_amount(100000) + tax_amount(0) = 100000; 50% -> 50000.
      expect(result.row1).toEqual({
        payment_amount: 50000,
        outstanding_amount: 50000,
      });
    });

    it("PaymentSchedule menerima readOnly dari disabled form dan currencyCode dari data.currency", () => {
      renderForm({
        data: { date: new Date(), items: [], currency: { code: "usd" } },
        disabled: true,
      });

      expect(captured.paymentScheduleProps.readOnly).toBe(true);
      expect(captured.paymentScheduleProps.currencyCode).toBe("usd");
    });
  });

  // --------------------------------------------------------------------
  // mapItem: alokasi diskon per baris yang diteruskan ke FormTable
  // --------------------------------------------------------------------
  describe("mapItem (alokasi diskon per baris FormTable)", () => {
    it("tanpa diskon dokumen, discount_amount 0 dan tax_amount murni dari tax_rate baris", () => {
      renderForm({
        data: {
          date: new Date(),
          items: [
            { item: { id: 1 }, quantity: 2, price: 100000, tax: { rate: 10 } },
          ],
        },
      });

      const row = { quantity: 2, price: 100000, tax: { rate: 10 } };
      const result = captured.formTableProps.mapItem({
        item: row,
        dataTable: [row],
        index: 0,
      });

      expect(result.discount_amount).toBe(0);
      expect(result.tax_amount).toBe(20000); // 200000 * 10%
    });

    it("dengan discount_on=net_total, discount_amount baris dialokasikan pro-rata dari selisih basic_amount", () => {
      renderForm({
        data: {
          date: new Date(),
          items: [],
          discount_on: "net_total",
          discount_rate: 10,
          latestDiscountKey: "discount_rate",
        },
      });

      const row = { quantity: 1, price: 100000, tax: { rate: 0 } };
      const result = captured.formTableProps.mapItem({
        item: row,
        dataTable: [row],
        index: 0,
      });

      // basic 100000, diskon 10% -> net baris 90000 -> discount_amount = 10000.
      expect(result.discount_amount).toBe(10000);
    });
  });

  // --------------------------------------------------------------------
  // mergeItems: dipanggil dari SelectModel.onSelected & loadFrom effect
  // --------------------------------------------------------------------
  describe("mergeItems", () => {
    it("SelectModel.onSelected menambah baris baru ke data.items", async () => {
      const user = userEvent.setup({ delay: null });
      const { stateRef } = renderForm({
        data: { date: new Date(), items: [] },
      });
      captured.selectModelPayload = {
        model: "App\\Models\\Service\\WorkOrder",
        items: [
          {
            id: 501,
            item: { id: 1, name: "Item A" },
            unit: { id: 1 },
            quantity: 3,
          },
        ],
      };

      await user.click(
        screen.getByRole("button", {
          name: "purchase.purchaseRequest.import_items",
        }),
      );

      expect(stateRef.data.items).toHaveLength(1);
      expect(stateRef.data.items[0]).toEqual(
        expect.objectContaining({
          item: { id: 1, name: "Item A" },
          quantity: 3,
          referenceable_type: "App\\Models\\Service\\WorkOrder",
          referenceable_id: 501,
        }),
      );
    });

    it("SelectModel.onSelected meng-update quantity baris existing berdasar referenceable_type+id (bukan duplikat baris)", async () => {
      // CATATAN BUG PRODUKSI (dilaporkan, tidak diperbaiki -- lihat laporan
      // akhir task): mergeItems SELALU meng-generate `id` baru
      // (generateRandom(5)) untuk setiap entri di `items` yang di-merge, lalu
      // menimpa `id` baris existing lewat spread `{...old, ...newItem}` --
      // padahal baris TIDAK duplikat (key referenceable_type+id match). Efek:
      // baris existing kehilangan id stabilnya setiap kali user meng-import
      // ulang dari SelectModel/loadFrom, walau secara jumlah baris tetap benar
      // (tidak duplikat). Assertion di bawah menguji perilaku AKTUAL (bukan
      // idealnya), yaitu jumlah baris tetap 1 & quantity ter-update, TANPA
      // menuntut id tetap sama.
      const user = userEvent.setup({ delay: null });
      const { stateRef } = renderForm({
        data: {
          date: new Date(),
          items: [
            {
              id: "existing-1",
              item: { id: 1, name: "Item A" },
              quantity: 2,
              referenceable_type: "App\\Models\\Service\\WorkOrder",
              referenceable_id: 501,
            },
          ],
        },
      });
      captured.selectModelPayload = {
        model: "App\\Models\\Service\\WorkOrder",
        items: [
          {
            id: 501,
            item: { id: 1, name: "Item A" },
            unit: { id: 1 },
            quantity: 7,
          },
        ],
      };

      await user.click(
        screen.getByRole("button", {
          name: "purchase.purchaseRequest.import_items",
        }),
      );

      expect(stateRef.data.items).toHaveLength(1);
      expect(stateRef.data.items[0].quantity).toBe(7);
      expect(stateRef.data.items[0].referenceable_id).toBe(501);
    });

    it("BUG: quantity hasil merge <= 0 TIDAK benar-benar menghapus baris (delete lalu langsung re-insert)", async () => {
      // CATATAN BUG PRODUKSI (dilaporkan, tidak diperbaiki): mergeItems
      // (Form.jsx baris ~139-151) melakukan `itemMap.delete(key)` saat
      // quantity<=0, TAPI langsung diikuti `if (itemMap.has(key)) {...} else
      // { itemMap.set(key, newItem) }` TANPA else-if/return -- karena entry
      // baru saja dihapus, itemMap.has(key) jadi false, sehingga jatuh ke
      // cabang else yang MENAMBAHKAN KEMBALI baris tsb (dengan quantity 0,
      // id baru). Komentar kode "hapus baris yang quantity<=0" tidak sesuai
      // perilaku aktual -- baris tidak pernah benar-benar hilang dari array.
      const user = userEvent.setup({ delay: null });
      const { stateRef } = renderForm({
        data: {
          date: new Date(),
          items: [
            {
              id: "existing-1",
              item: { id: 1 },
              quantity: 2,
              referenceable_type: "App\\Models\\Service\\WorkOrder",
              referenceable_id: 501,
            },
          ],
        },
      });
      captured.selectModelPayload = {
        model: "App\\Models\\Service\\WorkOrder",
        items: [{ id: 501, item: { id: 1 }, unit: { id: 1 }, quantity: 0 }],
      };

      await user.click(
        screen.getByRole("button", {
          name: "purchase.purchaseRequest.import_items",
        }),
      );

      // Perilaku AKTUAL: baris tetap ada (panjang 1), quantity jadi 0 --
      // BUKAN terhapus seperti yang dimaksudkan komentar source.
      expect(stateRef.data.items).toHaveLength(1);
      expect(stateRef.data.items[0].quantity).toBe(0);
    });

    it("useEffect loadFrom memanggil loadFromModel lalu mergeItems hasilnya ke data.items", async () => {
      usePageMock.mockReturnValue({
        props: {
          preferences: { default_currency_id: "idr" },
          loadFrom: {
            model: "App\\Models\\CRM\\Quotation",
            id: 77,
            select: null,
          },
        },
      });
      loadFromModelMock.mockResolvedValue({
        model: "App\\Models\\CRM\\Quotation",
        items: [
          {
            id: 1,
            item: { id: 9, name: "Dari Quotation" },
            unit: { id: 1 },
            quantity: 4,
          },
        ],
      });
      const { stateRef } = await renderFormAsync({
        data: { date: new Date(), items: [] },
      });

      await vi.waitFor(() => {
        expect(stateRef.data.items).toHaveLength(1);
      });
      expect(loadFromModelMock).toHaveBeenCalledWith(
        "App\\Models\\CRM\\Quotation",
        77,
        null,
        stableT,
      );
      expect(stateRef.data.items[0]).toEqual(
        expect.objectContaining({
          item: { id: 9, name: "Dari Quotation" },
          quantity: 4,
          referenceable_type: "App\\Models\\CRM\\Quotation",
          referenceable_id: 1,
        }),
      );
    });

    it("useEffect loadFrom tidak memanggil loadFromModel bila loadFrom kosong (null)", () => {
      usePageMock.mockReturnValue({
        props: { preferences: { default_currency_id: "idr" }, loadFrom: null },
      });

      renderForm({ data: { date: new Date(), items: [] } });

      expect(loadFromModelMock).not.toHaveBeenCalled();
    });
  });

  // --------------------------------------------------------------------
  // handleBarcodeSelect: scan barcode nambah baris baru / increment qty
  // --------------------------------------------------------------------
  describe("handleBarcodeSelect (scan barcode)", () => {
    it("scan item+unit baru menambah baris baru dengan quantity 1", async () => {
      const user = userEvent.setup({ delay: null });
      const { stateRef } = renderForm({
        data: { date: new Date(), items: [] },
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

    it("scan tanpa item/unit valid (selected null) tidak mengubah data.items", async () => {
      const user = userEvent.setup({ delay: null });
      const { stateRef } = renderForm({
        data: { date: new Date(), items: [] },
      });
      captured.barcodePayload = null;

      await user.click(screen.getByRole("button", { name: "scan-barcode" }));

      expect(stateRef.data.items).toEqual([]);
    });
  });

  // --------------------------------------------------------------------
  // Visibilitas kondisional field header
  // --------------------------------------------------------------------
  describe("visibilitas kondisional field", () => {
    it("is_rent=false menyembunyikan FormInput rent_date", () => {
      renderForm({ data: { date: new Date(), items: [], is_rent: false } });

      expect(
        screen.queryByText("sales.salesOrder.rent_date"),
      ).not.toBeInTheDocument();
    });

    it("is_rent=true menampilkan FormInput rent_date (daterange)", () => {
      // Interaksi klik checkbox Radix asli sengaja TIDAK disimulasikan di
      // sini (rapuh di jsdom -- onCheckedChange butuh pointer event capture
      // yang tidak konsisten ter-emulasi oleh user-event terhadap Radix
      // Checkbox tanpa polyfill tambahan) -- FormCheckbox sendiri adalah
      // primitive generik ui/checkbox.jsx, bukan logic unik Form.jsx.
      // Cakupan yang relevan untuk Form.jsx adalah conditional rendering
      // `{data.is_rent && <FormInput .../>}` itu sendiri, diuji langsung
      // lewat nilai data.is_rent dari useFormPage.
      renderForm({ data: { date: new Date(), items: [], is_rent: true } });

      expect(
        screen.getByText("sales.salesOrder.rent_date"),
      ).toBeInTheDocument();
    });

    it("data.referenceable menampilkan FormInput reference_to readOnly berisi LinkModel", () => {
      renderForm({
        data: {
          date: new Date(),
          items: [],
          referenceable: { id: 3 },
          referenceable_type: "App\\Models\\CRM\\Quotation",
        },
      });

      expect(
        screen.getByText("sales.salesOrder.columns.reference_to"),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/link-model:App\\Models\\CRM\\Quotation:3/),
      ).toBeInTheDocument();
    });

    it("tanpa data.referenceable, FormInput reference_to tidak dirender", () => {
      renderForm({ data: { date: new Date(), items: [] } });

      expect(
        screen.queryByText("sales.salesOrder.columns.reference_to"),
      ).not.toBeInTheDocument();
    });

    it("exchange_rate hanya muncul ketika currency dokumen berbeda dari default_currency_id", () => {
      renderForm({
        data: { date: new Date(), items: [], currency: { code: "usd" } },
      });

      expect(
        screen.getByText("sales.salesOrder.exchange_rate"),
      ).toBeInTheDocument();
    });

    it("exchange_rate tidak muncul ketika currency dokumen sama dengan default", () => {
      renderForm({
        data: { date: new Date(), items: [], currency: { code: "idr" } },
      });

      expect(
        screen.queryByText("sales.salesOrder.exchange_rate"),
      ).not.toBeInTheDocument();
    });
  });

  // --------------------------------------------------------------------
  // itemColumns["source_warehouse"].cell -- disabled utk item jasa
  // (is_stock_item=false), item jasa tidak butuh gudang asal.
  // --------------------------------------------------------------------
  describe("itemColumns source_warehouse.cell disabled state", () => {
    it("item stock (is_stock_item true): tidak disabled", () => {
      renderForm({ data: { date: new Date(), items: [] } });

      const column = captured.formTableProps.columns.find(
        (c) => c.name === "source_warehouse",
      );
      const element = column.cell({
        dataRow: { item: { id: 1, is_stock_item: true } },
        data: null,
        setData: vi.fn(),
        attributes: {},
      });

      expect(element.props.disabled).toBeFalsy();
    });

    it("item jasa (is_stock_item false): disabled", () => {
      renderForm({ data: { date: new Date(), items: [] } });

      const column = captured.formTableProps.columns.find(
        (c) => c.name === "source_warehouse",
      );
      const element = column.cell({
        dataRow: { item: { id: 1, is_stock_item: false } },
        data: null,
        setData: vi.fn(),
        attributes: {},
      });

      expect(element.props.disabled).toBe(true);
    });

    it("belum ada item dipilih: disabled", () => {
      renderForm({ data: { date: new Date(), items: [] } });

      const column = captured.formTableProps.columns.find(
        (c) => c.name === "source_warehouse",
      );
      const element = column.cell({
        dataRow: {},
        data: null,
        setData: vi.fn(),
        attributes: {},
      });

      expect(element.props.disabled).toBe(true);
    });
  });

  // --------------------------------------------------------------------
  // Warehouse header cascade: mengganti source_warehouse header menerapkan
  // nilai yang sama ke semua baris item, gated oleh `is_stock_item` MILIK
  // WAREHOUSE YANG DIPILIH (val.item.is_stock_item) -- BUKAN is_stock_item
  // milik masing-masing baris item seperti yang mungkin diduga dari nama
  // variabelnya. Lihat Form.jsx baris ~628-633.
  // --------------------------------------------------------------------
  describe("source_warehouse header cascade ke items", () => {
    it("mengganti warehouse header menerapkan warehouse ke semua baris ketika val.item.is_stock_item true", async () => {
      const user = userEvent.setup({ delay: null });
      const { stateRef } = renderForm({
        data: {
          date: new Date(),
          items: [
            { item: { id: 1, is_stock_item: true }, quantity: 1 },
            { item: { id: 2, is_stock_item: false }, quantity: 1 },
          ],
        },
      });

      const warehouseButton = screen.getByRole("button", {
        name: /^warehouse:/,
      });
      await user.click(warehouseButton);

      expect(stateRef.data.source_warehouse).toEqual(
        expect.objectContaining({ id: 20, name: "Gudang A" }),
      );
      // Stub WarehouseLinkModel mengirim val.item.is_stock_item=true -> SEMUA
      // baris (termasuk yang item-nya sendiri is_stock_item=false) ikut
      // menerima source_warehouse yang sama.
      expect(stateRef.data.items[0].source_warehouse).toEqual(
        expect.objectContaining({ id: 20 }),
      );
      expect(stateRef.data.items[1].source_warehouse).toEqual(
        expect.objectContaining({ id: 20 }),
      );
    });
  });

  // --------------------------------------------------------------------
  // Requirement 3-7, spec asset-service-billing-reference-flow: kolom
  // "referenceable" per-baris DIHAPUS, logic-nya pindah ke itemColumns["item"].
  // --------------------------------------------------------------------
  describe("itemColumns item.cell -- filter/auto-link/lock AssetService", () => {
    const ASSET_SERVICE_CLASS = "App\\Models\\Asset\\AssetService";
    const ASSET_SERVICE_CONSUMED_ITEM_CLASS =
      "App\\Models\\Asset\\AssetServiceConsumedItem";

    function assetServiceReferenceable(overrides = {}) {
      return {
        id: 10,
        bill_to_renter: true,
        customer: { id: 77, name: "Cust A" },
        customer_branch: { id: 88, name: "Branch A" },
        consumed_items: [
          {
            id: 5,
            item: { id: 501 },
            quantity: 4,
            valuation_rate: 15000,
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

    it("tanpa referenceable_type AssetService: filters kosong, perilaku item.cell normal (regresi)", () => {
      renderForm({ data: { date: new Date(), items: [] } });

      const setDataRow = vi.fn();
      const itemColumn = captured.formTableProps.columns.find(
        (c) => c.name === "item",
      );
      const selectedVal = {
        id: 1,
        default_uom: { id: 11, conversion_factor: 2 },
      };
      const element = itemColumn.cell({
        dataRow: {},
        setData: setDataRow,
        attributes: {},
      });

      expect(element.props.filters).toBeUndefined();

      element.props.onValueChange(selectedVal);

      expect(setDataRow).toHaveBeenCalledWith({
        item: selectedVal,
        unit: selectedVal.default_uom,
        conversion_factor: 2,
        source_warehouse: undefined,
      });
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

    it("pilih ItemVariant yang cocok consumedItem: auto-link ke AssetServiceConsumedItem, quantity/price/unit ikut, assetServiceLocked true, customer header ikut terisi (bill_to_renter)", () => {
      const { stateRef } = renderForm({
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

      act(() => {
        element.props.onValueChange({ id: 501, default_uom: null });
      });

      expect(setDataRow).toHaveBeenCalledWith(
        expect.objectContaining({
          referenceable: {
            type: ASSET_SERVICE_CONSUMED_ITEM_CLASS,
            id: 5,
          },
          quantity: 4,
          price: 15000,
          unit: { id: 9, conversion_factor: 1 },
          conversion_factor: 1,
          assetServiceLocked: true,
        }),
      );
      // customer/customer_branch adalah field HEADER (form-level setData),
      // bukan field baris -- diverifikasi lewat stateRef, bukan setDataRow.
      expect(stateRef.data.customer).toEqual({ id: 77, name: "Cust A" });
      expect(stateRef.data.customer_branch).toEqual({
        id: 88,
        name: "Branch A",
      });
    });

    it("pilih ItemVariant kategori service tanpa match consumedItem: auto-link ke AssetService header, TIDAK locked", async () => {
      await renderFormAsync({
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

      act(() => {
        element.props.onValueChange({
          id: 999,
          default_uom: null,
          item: { category: { type: "service" } },
        });
      });

      expect(setDataRow).toHaveBeenCalledWith(
        expect.objectContaining({
          referenceable: { type: ASSET_SERVICE_CLASS, id: 10 },
          assetServiceLocked: false,
        }),
      );
    });

    it("pilih ItemVariant non-service tanpa match consumedItem: tidak auto-link, tidak locked", async () => {
      await renderFormAsync({
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

      act(() => {
        element.props.onValueChange({
          id: 12345,
          default_uom: null,
          item: { category: { type: "inventory" } },
        });
      });

      const patch = setDataRow.mock.calls[0][0];
      expect(patch.referenceable).toBeUndefined();
      expect(patch.assetServiceLocked).toBe(false);
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

    it("dataRow.assetServiceLocked false/undefined: kolom Item DAN Quantity tidak disabled (selama ada item)", () => {
      renderForm({ data: { date: new Date(), items: [] } });

      const itemColumn = captured.formTableProps.columns.find(
        (c) => c.name === "item",
      );
      const quantityColumn = captured.formTableProps.columns.find(
        (c) => c.name === "quantity",
      );

      const itemEl = itemColumn.cell({
        dataRow: { item: { id: 1 } },
        setData: vi.fn(),
        attributes: {},
      });
      const quantityEl = quantityColumn.cell({
        dataRow: { item: { id: 1 } },
        data: 4,
        setData: vi.fn(),
        attributes: {},
      });

      expect(itemEl.props.disabled).toBeFalsy();
      expect(quantityEl.props.disabled).toBeFalsy();
    });
  });
});
