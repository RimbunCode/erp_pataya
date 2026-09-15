import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// ============================================================================
// Form.jsx (PurchaseInvoice) adalah halaman form transaksi tagihan dari
// supplier (730 baris) -- dibungkus <FormPageContent>/useFormPage dari
// @/Pages/Core/FormPage (sudah ada test granular sendiri) dan meng-compose
// banyak child besar yang SUDAH punya test sendiri (PaymentSchedule,
// AdditionalDiscount) atau generik reusable yang belum ditest di sini
// (FormTable, LinkModel-LinkModel).
//
// Strategi (paralel dgn SalesInvoice/Form.rtl.test.jsx): stub SEMUA child
// berat/sudah-ditest, fokus HANYA ke logic UNIK Form.jsx sendiri:
//   - defaultValue() -- resolve expense_head_account (stock_received_but_not_
//     billed) & credit_account (payable) dari getDataModel, filter is_contra
//     false diterapkan di FE (bukan bagian query filter langsung, cek shape).
//   - Memo kalkulasi net_amount/dpp_amount/tax_amount/amount dihitung dari
//     quantity*rate + tax.rate MENTAH per baris (rawLines) lalu dialokasikan
//     ulang via allocateDiscount dgn DPP_FACTOR 11/12 (allocatedLines) --
//     BUKAN dibaca dari kolom basic_amount/dpp_amount/tax_amount milik
//     data.items (yang hanya di-refresh oleh mapItem FormTable saat referensi
//     array items berubah, bukan saat discount_on/discount_rate/discount_amount
//     berubah sendirian -- ini akar bug "total tidak reaktif saat diskon
//     diubah" yang diperbaiki). rawNetAmount/rawTaxAmount (basis sebelum
//     diskon) diteruskan ke AdditionalDiscount terpisah dari netAmount/
//     taxAmount (basis setelah diskon).
//   - Transform data saat memilih purchase_order (checkout PO -> item invoice,
//     quantity dari unbilled_quantity, amount = basic_amount+tax_amount).
//   - Transform reset saat toggle is_return checkbox (SEMUA field terkait dan
//     is_return sendiri, TANPA panggilan getDataModel -- beda dgn SalesInvoice
//     yang punya getContraIncomeAccount async).
//   - Transform data saat memilih return_against (retur invoice lama) --
//     termasuk fallback credit_account/expense_head_account ke prev jika
//     return_against tidak membawa field tsb.
//   - mapItem callback yang diteruskan ke FormTable (alokasi diskon per-baris
//     via allocateDiscount dgn DPP_FACTOR 11/12, port dari
//     PurchaseInvoiceService::DPP_FACTOR).
//   - additionalData callback yang diteruskan ke PaymentSchedule (payment/
//     outstanding amount per invoice_portion, dihitung dari `amount`).
//   - Kolom item: PurchaseOrderItemLinkModel filter & carry-over field
//     (unit/conversion_factor/quantity/rate/tax/description), disabled saat
//     data.purchase_order belum dipilih.
//
// Tidak ada fungsi mergeItems di file ini -- item dari purchase_order/
// return_against di-assign langsung via `.map()` dengan
// `id: generateRandom(8)` per baris baru (bukan merge ke array existing),
// jadi bug ganda mergeItems (id ditimpa tanpa syarat + itemMap.delete diikuti
// itemMap.has yang selalu false) di SalesOrders/Form.jsx TIDAK berlaku/tidak
// ada padanannya di Form.jsx PurchaseInvoice ini.
// ============================================================================

const stableT = (key) => key;
vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({ t: stableT }),
}));

const usePageMock = vi.fn();
vi.mock("@inertiajs/react", () => ({
  usePage: () => usePageMock(),
}));

// getDataModel adalah satu-satunya bagian dari @/lib/utils yang butuh mock
// (network call via axios) -- fungsi kalkulasi murni lain (calculateArray,
// generateRandom, getDataModel-independent) dipakai APA ADANYA (implementasi
// asli) supaya logic Form.jsx yang menggunakannya benar-benar diuji.
const getDataModelMock = vi.fn();
vi.mock("@/lib/utils", async () => {
  const actual = await vi.importActual("@/lib/utils");
  return {
    ...actual,
    getDataModel: (...args) => getDataModelMock(...args),
  };
});

// useFormPage dikendalikan lewat state module-level `formPageState` supaya
// tiap test bisa menyuntik data/dataBefore/disabled berbeda tanpa perlu
// render FormPage asli. FormPageContent & FormPageContentTitle disederhanakan
// jadi <div>/<h3> passthrough.
let formPageState;
let lastDefaultValueArg;
vi.mock("@/Pages/Core/FormPage", async () => {
  const React = await import("react");
  return {
    FormPageContent: ({ title, children }) => (
      <div>
        {title && <h3>{title}</h3>}
        {children}
      </div>
    ),
    FormPageContentTitle: ({ children, ...props }) => (
      <div {...props}>{children}</div>
    ),
    useFormPage: (defaultValue) => {
      lastDefaultValueArg = defaultValue;
      return formPageState;
    },
    useFormPageMeta: () => undefined,
    FormPageContext: React.createContext(),
  };
});

// Semua LinkModel/komponen link berat (dialog CRUD, navigasi, Popover) di-
// stub jadi tombol sederhana yang memanggil onValueChange dengan payload
// tetap -- cukup untuk menguji bahwa Form.jsx meneruskan transform yang
// benar, tanpa mem-render internal LinkModel (bukan concern file ini).
function makeLinkModelStub(testId) {
  return function LinkModelStub({ value, onValueChange, disabled }) {
    return (
      <button
        type="button"
        data-testid={testId}
        disabled={disabled}
        onClick={() =>
          onValueChange?.(globalThis.__linkModelPayloads?.[testId])
        }
      >
        {testId}:{value?.id ?? value?.code ?? "none"}
      </button>
    );
  };
}

vi.mock("../Accounts/AccountLinkModel", () => ({
  default: makeLinkModelStub("account-link"),
}));
vi.mock("@/Pages/Core/CurrencyLinkModel", () => ({
  default: makeLinkModelStub("currency-link"),
}));
vi.mock("@/Pages/Inventory/Items/ItemUnitLinkModel", () => ({
  default: makeLinkModelStub("item-unit-link"),
}));
vi.mock("@/Pages/Purchase/PurchaseOrders/PurchaseOrderItemLinkModel", () => ({
  default: makeLinkModelStub("purchase-order-item-link"),
}));
vi.mock("../PurchaseInvoice/PurchaseInvoiceLinkModel", () => ({
  default: makeLinkModelStub("purchase-invoice-link"),
}));
vi.mock("@/Pages/Purchase/PurchaseOrders/PurchaseOrderLinkModel", () => ({
  default: makeLinkModelStub("purchase-order-link"),
}));
vi.mock("@/Pages/Purchase/Suppliers/SupplierLinkModel", () => ({
  default: makeLinkModelStub("supplier-link"),
}));
vi.mock("@/Pages/Finances/Taxes/TaxLinkModel", () => ({
  default: makeLinkModelStub("tax-link"),
}));
vi.mock("./ItemForm", () => ({ default: () => <div>item-form</div> }));

vi.mock("@/Components/DatetimePicker", () => ({
  default: ({ value, onValueChange, name }) => (
    <input
      aria-label={name ?? "datetime"}
      type="text"
      value={value ? new Date(value).toISOString() : ""}
      onChange={(e) => {
        const v = e.target.value;
        onValueChange?.(v ? new Date(v) : null);
      }}
    />
  ),
}));

vi.mock("@/Components/ui/checkbox", () => ({
  FormCheckbox: ({ label, checked, onCheckedChange }) => (
    <label>
      {label}
      <input
        type="checkbox"
        role="forminput"
        checked={!!checked}
        onChange={(e) => onCheckedChange?.(e.target.checked)}
      />
    </label>
  ),
}));

vi.mock("@/Components/ui/textarea", () => ({
  Textarea: ({ value, onChange, ...props }) => (
    <textarea value={value ?? ""} onChange={onChange} {...props} />
  ),
}));

// NumberInput distub jadi input polos -- bukan concern Form.jsx, cukup
// teruskan value & onValueChange apa adanya supaya assertion bisa membaca
// angka hasil memo net_amount/dpp_amount/tax_amount/amount.
vi.mock("@/Components/NumberInput", () => ({
  default: ({ value, onValueChange, currencyCode, ...props }) => (
    <input
      type="text"
      data-currency={currencyCode}
      value={value ?? ""}
      onChange={(e) => onValueChange?.(Number(e.target.value))}
      {...props}
    />
  ),
}));

// FormTable adalah komponen besar generik reusable yang BELUM ditest di sesi
// ini -- distub sebagai capture props sederhana karena fokus test di sini
// hanya memverifikasi Form.jsx meneruskan columns/value/mapItem yang benar,
// bukan rendering tabel itu sendiri.
const formTablePropsSpy = vi.fn();
vi.mock("@/Components/FormTable", () => ({
  default: (props) => {
    formTablePropsSpy(props);
    return <div data-testid="form-table-stub">{props.name}</div>;
  },
}));

// PaymentSchedule & AdditionalDiscount SUDAH punya test granular sendiri --
// distub jadi capture-props sederhana di sini supaya hanya wiring props dari
// Form.jsx (bukan perilaku internal mereka) yang diuji.
const paymentSchedulePropsSpy = vi.fn();
vi.mock("../Components/PaymentSchedule", () => ({
  default: (props) => {
    paymentSchedulePropsSpy(props);
    return <div data-testid="payment-schedule-stub" />;
  },
}));

const additionalDiscountPropsSpy = vi.fn();
vi.mock("../Components/AdditionalDiscount", () => ({
  default: (props) => {
    additionalDiscountPropsSpy(props);
    return <div data-testid="additional-discount-stub" />;
  },
}));

import Form from "./Form";

function makeFormPageState(overrides = {}) {
  const state = {
    data: { items: [], ...overrides.data },
    setData: overrides.setData ?? vi.fn(),
    disabled: overrides.disabled ?? false,
    dataBefore: overrides.dataBefore,
  };
  return state;
}

describe("PurchaseInvoice Form", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.__linkModelPayloads = {};
    usePageMock.mockReturnValue({
      props: { preferences: { default_currency_id: "idr" } },
    });
    getDataModelMock.mockResolvedValue([]);
    formPageState = makeFormPageState();
    lastDefaultValueArg = undefined;
  });

  describe("defaultValue (mode create)", () => {
    it("mengambil expense_head_account (stock_received_but_not_billed) & credit_account (payable) dari getDataModel", async () => {
      getDataModelMock.mockResolvedValue([
        { id: 1, account_type: "payable", name: "Hutang Usaha" },
        {
          id: 2,
          account_type: "stock_received_but_not_billed",
          name: "Barang Belum Ditagih",
        },
      ]);
      render(<Form />);

      // useFormPage (di-stub, tidak memanggil defaultValue secara otomatis di
      // sini -- concern useFormPage internal sudah dicover FormPage.rtl.test
      // .jsx) menerima defaultValue sebagai argumen pertama; panggil manual
      // utk menguji isi callback itu sendiri.
      const result = await lastDefaultValueArg();

      expect(getDataModelMock).toHaveBeenCalledWith(
        "App\\Models\\Finances\\Account",
        expect.objectContaining({
          root_type: "liability",
          account_type: { in: ["stock_received_but_not_billed", "payable"] },
          is_contra: false,
        }),
      );

      expect(result.expense_head_account).toEqual(
        expect.objectContaining({ id: 2 }),
      );
      expect(result.credit_account).toEqual(expect.objectContaining({ id: 1 }));
      expect(result.date).toBeInstanceOf(Date);
    });
  });

  describe("kalkulasi total (net_amount/dpp_amount/tax_amount/amount)", () => {
    // Item acuan dipakai berulang: quantity 12 x rate 100 = basic_amount 1200
    // (kelipatan 12 supaya basic_amount * DPP_FACTOR (11/12) hasilnya bilangan
    // bulat bersih -- 1100, bukan desimal berulang -- jadi assertion display
    // value bisa exact-match tanpa masalah presisi floating point).
    // Tanpa diskon: net_amount=1200, dpp_amount=1200*11/12=1100,
    // tax_amount=1100*11/100=121, amount=1200+121=1321 (diverifikasi via
    // allocateDiscount asli, bukan angka karangan).
    const referenceItem = {
      purchase_order_item: { id: 1 },
      quantity: 12,
      rate: 100,
      tax: { rate: 11 },
    };

    it("dihitung dari quantity x rate + tax.rate per baris, BUKAN dari kolom basic_amount/dpp_amount/tax_amount milik item", () => {
      formPageState = makeFormPageState({
        data: {
          items: [
            {
              ...referenceItem,
              // Kolom-kolom ini SENGAJA diisi angka ngaco -- kalau memo masih
              // membaca kolom per-item (perilaku lama), hasil di bawah akan
              // ikut 99999, bukan 1200/1100/121/1321 yang benar dari quantity*rate.
              basic_amount: 99999,
              dpp_amount: 99999,
              tax_amount: 99999,
              amount: 99999,
            },
          ],
        },
      });
      render(<Form />);

      expect(screen.getAllByDisplayValue("1200").length).toBeGreaterThan(0); // Jumlah Dasar
      expect(screen.getAllByDisplayValue("1100").length).toBeGreaterThan(0); // DPP
      expect(screen.getAllByDisplayValue("121").length).toBeGreaterThan(0); // Pajak
      expect(screen.getAllByDisplayValue("1321").length).toBeGreaterThan(0); // Total
    });

    it("REAKTIVITAS: mengubah discount_rate header saja (referensi data.items TIDAK berubah) tetap memperbarui semua total -- bug utama yang diperbaiki", () => {
      // items dipertahankan sebagai SATU referensi array yang sama di kedua
      // render -- mensimulasikan persis skenario bug: user mengetik diskon
      // tanpa menyentuh tabel item sama sekali, jadi mapItem (yang hanya
      // jalan saat referensi items berubah) TIDAK akan pernah ter-trigger.
      const items = [referenceItem];
      formPageState = makeFormPageState({
        data: { items, discount_on: "net_total" },
      });
      const { rerender } = render(<Form />);

      expect(screen.getAllByDisplayValue("1200").length).toBeGreaterThan(0);
      expect(screen.getAllByDisplayValue("1100").length).toBeGreaterThan(0);
      expect(screen.getAllByDisplayValue("121").length).toBeGreaterThan(0);
      expect(screen.getAllByDisplayValue("1321").length).toBeGreaterThan(0);

      formPageState = makeFormPageState({
        data: { items, discount_on: "net_total", discount_rate: 10 },
      });
      rerender(<Form />);

      // Diskon 10% dari net_total (1200) = 120 -> basic_amount 1080, dpp
      // 1080*11/12=990, tax dihitung ulang dari basis DPP baru = 108.9,
      // total 1080+108.9=1188.9. SEMUA field ikut berubah walau `items`
      // (referensi array) sama sekali tidak disentuh.
      expect(screen.getAllByDisplayValue("1080").length).toBeGreaterThan(0);
      expect(screen.getAllByDisplayValue("990").length).toBeGreaterThan(0);
      expect(screen.getAllByDisplayValue("108.9").length).toBeGreaterThan(0);
      expect(screen.getAllByDisplayValue("1188.9").length).toBeGreaterThan(0);
      // Nilai lama (sebelum diskon) tidak boleh tersisa di layar -- inilah
      // yang gagal sebelum perbaikan (baru berubah setelah dokumen disimpan).
      expect(screen.queryAllByDisplayValue("1200").length).toBe(0);
    });

    it("baris kosong di akhir tabel (tanpa purchase_order_item) tidak ikut dihitung", () => {
      formPageState = makeFormPageState({
        data: {
          items: [
            referenceItem,
            // Baris kosong yang selalu disisakan FormTable di akhir tabel --
            // angka besar sengaja dipasang supaya kalau filter gagal, total
            // akan meleset jauh dan test ini gagal dengan jelas.
            { quantity: 999, rate: 999, tax: { rate: 999 } },
          ],
        },
      });
      render(<Form />);

      expect(screen.getAllByDisplayValue("1200").length).toBeGreaterThan(0);
      expect(screen.getAllByDisplayValue("1100").length).toBeGreaterThan(0);
      expect(screen.getAllByDisplayValue("121").length).toBeGreaterThan(0);
      expect(screen.getAllByDisplayValue("1321").length).toBeGreaterThan(0);
    });

    it("data.items undefined tidak crash -- net_amount/dpp_amount/tax_amount/amount & rawNetAmount/rawTaxAmount default ke 0", () => {
      formPageState = makeFormPageState({ data: { items: undefined } });
      expect(() => render(<Form />)).not.toThrow();

      const props = additionalDiscountPropsSpy.mock.calls[0][0];
      expect(props.netAmount).toBe(0);
      expect(props.taxAmount).toBe(0);
      expect(props.rawNetAmount).toBe(0);
      expect(props.rawTaxAmount).toBe(0);
    });

    it("meneruskan rawNetAmount/rawTaxAmount MENTAH (sebelum diskon) ke AdditionalDiscount, terpisah dari netAmount/taxAmount hasil alokasi", () => {
      formPageState = makeFormPageState({
        data: {
          discount_on: "net_total",
          discount_rate: 10,
          latestDiscountKey: "discount_rate",
          items: [referenceItem],
        },
      });
      render(<Form />);

      const props = additionalDiscountPropsSpy.mock.calls[0][0];
      // rawNetAmount/rawTaxAmount tetap basis MENTAH (1200/121), tidak peduli
      // discount_rate sudah 10% -- kalau basisnya ikut memakai angka yang
      // sudah terpotong, discount_rate akan memotong basis yang terus
      // menyusut tiap kali dihitung ulang.
      expect(props.rawNetAmount).toBe(1200);
      expect(props.rawTaxAmount).toBe(121);
      // netAmount/taxAmount SUDAH hasil alokasi diskon 10% dari net_total.
      expect(props.netAmount).toBeCloseTo(1080, 5);
      expect(props.taxAmount).toBeCloseTo(108.9, 5);
      expect(props.rawNetAmount).not.toBe(props.netAmount);
      expect(props.rawTaxAmount).not.toBe(props.taxAmount);
    });

    it("rawTaxAmount memakai basis DPP Nilai Lain (basic_amount x 11/12 x tax_rate/100), BUKAN basic_amount x tax_rate/100 langsung", () => {
      formPageState = makeFormPageState({
        data: { items: [referenceItem] },
      });
      render(<Form />);

      const props = additionalDiscountPropsSpy.mock.calls[0][0];
      // Basis DPP: 1200 * 11/12 * 11/100 = 121.
      expect(props.rawTaxAmount).toBe(121);
      // BUKAN 1200 * 11/100 = 132 (basic_amount x tax_rate langsung tanpa DPP_FACTOR).
      expect(props.rawTaxAmount).not.toBe(132);
    });

    it("additionalData PaymentSchedule dihitung dari total baru (amount hasil memo), bukan kolom amount milik item", () => {
      formPageState = makeFormPageState({
        data: {
          items: [{ ...referenceItem, amount: 99999 }], // kolom lama, harus diabaikan
        },
      });
      render(<Form />);

      const { additionalData } = paymentSchedulePropsSpy.mock.calls[0][0];
      const result = additionalData([{ id: "row1", invoice_portion: 50 }]);
      // amount benar = 1321 (lihat test kalkulasi di atas) -> payment 50% = 660.5.
      expect(result.row1.payment_amount).toBe(660.5);
      expect(result.row1.outstanding_amount).toBe(660.5);
    });
  });

  describe("kolom tax (item table)", () => {
    it("kolom tax TIDAK required -- pajak boleh kosong (perbaikan 1)", () => {
      formPageState = makeFormPageState({
        data: { items: [{ id: 1 }] },
      });
      render(<Form />);

      const itemColumns = formTablePropsSpy.mock.calls[0][0].columns;
      const taxCol = itemColumns.find((c) => c.name === "tax");
      expect(taxCol.required).not.toBe(true);
    });
  });

  describe("transform data saat memilih purchase_order", () => {
    it("memilih purchase_order mengisi supplier/currency/items/payment_schedules dari PO", async () => {
      const user = userEvent.setup({ delay: null });
      const setData = vi.fn();
      formPageState = makeFormPageState({ setData, data: { items: [] } });
      globalThis.__linkModelPayloads["purchase-order-link"] = {
        id: 9,
        supplier: { id: 1, name: "PT Pemasok" },
        currency: { id: 3, code: "usd" },
        items: [
          {
            id: 100,
            unbilled_quantity: 5,
            quantity: 10,
            rate: 2000,
            basic_amount: 1000,
            tax_amount: 110,
            unit: { id: 1 },
            tax: { id: 1 },
            description: "Barang A",
            conversion_factor: 1,
          },
        ],
        payment_schedules: [{ id: 55, invoice_portion: 100 }],
        amount: 1110,
        discount_on: "net_total",
        discount_rate: 10,
        discount_amount: 100,
        exchange_rate: 15000,
        external_note: "Catatan PO",
      };

      render(<Form />);
      await user.click(screen.getByTestId("purchase-order-link"));

      expect(setData).toHaveBeenCalled();
      const updater = setData.mock.calls[setData.mock.calls.length - 1][0];
      const result = updater({ items: [] });

      expect(result.supplier).toEqual({ id: 1, name: "PT Pemasok" });
      expect(result.currency).toEqual({ id: 3, code: "usd" });
      // quantity harus pakai unbilled_quantity (PO item mungkin partial billed).
      expect(result.items[0].quantity).toBe(5);
      // amount item = basic_amount + tax_amount (bukan net setelah discount).
      expect(result.items[0].amount).toBe(1110);
      expect(result.items[0].purchase_order_item).toEqual(
        expect.objectContaining({ id: 100 }),
      );
      expect(result.items[0].purchase_order_item_id).toBe(100);
      expect(result.payment_schedules[0].invoice_portion).toBe(100);
      expect(result.discount_rate).toBe(10);
      expect(result.exchange_rate).toBe(15000);
      expect(result.external_note).toBe("Catatan PO");
    });

    it("kolom item PurchaseOrderItemLinkModel difilter purchase_order_id & unbilled_quantity > 0", () => {
      formPageState = makeFormPageState({
        data: { items: [{ id: 1 }], purchase_order: { id: 9 } },
      });
      render(<Form />);

      const itemColumns = formTablePropsSpy.mock.calls[0][0].columns;
      const itemCol = itemColumns.find((c) => c.name === "purchase_order_item");
      const cellUi = itemCol.cell({
        dataRow: { id: 1 },
        setData: vi.fn(),
        attributes: {},
      });
      // cell() membungkus PurchaseOrderItemLinkModel dalam <div> bersama
      // AssetCompletionRowBadge (fitur asset-management-purchase-integration)
      // -- child pertama adalah LinkModel-nya, bukan cellUi langsung.
      const linkModel = cellUi.props.children[0];

      expect(linkModel.props.filters).toEqual(
        expect.objectContaining({
          purchase_order_id: 9,
          unbilled_quantity: { ">": 0 },
        }),
      );
      expect(linkModel.props.disabled).toBe(false);
    });

    it("kolom item PurchaseOrderItemLinkModel disabled ketika data.purchase_order belum dipilih", () => {
      formPageState = makeFormPageState({
        data: { items: [{ id: 1 }], purchase_order: null },
      });
      render(<Form />);

      const itemColumns = formTablePropsSpy.mock.calls[0][0].columns;
      const itemCol = itemColumns.find((c) => c.name === "purchase_order_item");
      const cellUi = itemCol.cell({
        dataRow: { id: 1 },
        setData: vi.fn(),
        attributes: {},
      });
      const linkModel = cellUi.props.children[0];
      expect(linkModel.props.disabled).toBe(true);
    });

    it("memilih purchase_order_item pada baris item mengisi unit/conversion_factor/quantity/rate/tax/description", () => {
      formPageState = makeFormPageState({
        data: { items: [{ id: 1 }], purchase_order: { id: 9 } },
      });
      render(<Form />);

      const itemColumns = formTablePropsSpy.mock.calls[0][0].columns;
      const itemCol = itemColumns.find((c) => c.name === "purchase_order_item");
      const setDataRow = vi.fn();
      const cellUi = itemCol.cell({
        dataRow: { id: 1 },
        setData: setDataRow,
        attributes: {},
      });
      const linkModel = cellUi.props.children[0];

      linkModel.props.onValueChange({
        id: 500,
        unit: { id: 1, name: "Pcs" },
        conversion_factor: 2,
        unbilled_quantity: 7,
        rate: 2500,
        tax: { id: 1, rate: 11 },
        description: "Barang B",
      });

      expect(setDataRow).toHaveBeenCalledWith(
        expect.objectContaining({
          unit: { id: 1, name: "Pcs" },
          conversion_factor: 2,
          quantity: 7,
          rate: 2500,
          tax: { id: 1, rate: 11 },
          description: "Barang B",
        }),
      );
    });
  });

  describe("toggle is_return", () => {
    it("mencentang is_return mereset seluruh field terkait PO/supplier/items/discount", async () => {
      const user = userEvent.setup({ delay: null });
      const setData = vi.fn();
      formPageState = makeFormPageState({
        setData,
        data: {
          items: [{ id: 1 }],
          purchase_order: { id: 1 },
          supplier: { id: 1 },
          discount_amount: 100,
        },
      });

      render(<Form />);
      const checkbox = screen.getByRole("forminput", {
        name: /finances.purchaseInvoice.columns.is_return/,
      });
      await user.click(checkbox);

      // Toggle is_return TIDAK memanggil getDataModel sama sekali (beda dari
      // SalesInvoice yang punya getContraIncomeAccount async) -- reset field
      // murni functional updater sinkron.
      expect(getDataModelMock).not.toHaveBeenCalled();

      expect(setData).toHaveBeenCalled();
      const updater = setData.mock.calls[setData.mock.calls.length - 1][0];
      const result = updater(formPageState.data);

      expect(result.is_return).toBe(true);
      expect(result.purchase_order).toBeUndefined();
      expect(result.supplier).toBeUndefined();
      expect(result.currency).toBeUndefined();
      expect(result.items).toEqual([]);
      expect(result.payment_schedules).toEqual([]);
      expect(result.amount).toBe(0);
      expect(result.discount_amount).toBeUndefined();
      expect(result.return_against).toBeUndefined();
    });
  });

  describe("transform data saat memilih return_against", () => {
    it("memilih return_against mengisi purchase_order/supplier/currency/items dari invoice yang diretur", async () => {
      const user = userEvent.setup({ delay: null });
      const setData = vi.fn();
      formPageState = makeFormPageState({
        setData,
        data: { items: [], is_return: true },
      });
      globalThis.__linkModelPayloads["purchase-invoice-link"] = {
        id: 200,
        purchase_order: { id: 9 },
        supplier: { id: 1, name: "PT Retur" },
        currency: { id: 3, code: "idr" },
        exchange_rate: 1,
        credit_account: { id: 88 },
        expense_head_account: { id: 89 },
        discount_on: null,
        items: [{ id: 300, rate: 500 }],
      };

      render(<Form />);
      await user.click(screen.getByTestId("purchase-invoice-link"));

      expect(setData).toHaveBeenCalled();
      const updater = setData.mock.calls[setData.mock.calls.length - 1][0];
      const result = updater({
        items: [],
        credit_account: { id: 1 },
        expense_head_account: { id: 2 },
      });

      expect(result.supplier).toEqual({ id: 1, name: "PT Retur" });
      expect(result.purchase_order).toEqual({ id: 9 });
      expect(result.credit_account).toEqual({ id: 88 });
      expect(result.expense_head_account).toEqual({ id: 89 });
      expect(result.items[0]).toEqual(
        expect.objectContaining({ return_against_item_id: 300 }),
      );
    });

    it("credit_account & expense_head_account fallback ke prev saat return_against tidak membawa field tsb", async () => {
      const user = userEvent.setup({ delay: null });
      const setData = vi.fn();
      formPageState = makeFormPageState({
        setData,
        data: { items: [], is_return: true },
      });
      globalThis.__linkModelPayloads["purchase-invoice-link"] = {
        id: 201,
        items: [],
        credit_account: undefined,
        expense_head_account: undefined,
      };

      render(<Form />);
      await user.click(screen.getByTestId("purchase-invoice-link"));

      const updater = setData.mock.calls[setData.mock.calls.length - 1][0];
      const prevCreditAccount = { id: 42 };
      const prevExpenseHeadAccount = { id: 43 };
      const result = updater({
        items: [],
        credit_account: prevCreditAccount,
        expense_head_account: prevExpenseHeadAccount,
      });
      expect(result.credit_account).toBe(prevCreditAccount);
      expect(result.expense_head_account).toBe(prevExpenseHeadAccount);
    });
  });

  describe("mapItem FormTable (alokasi diskon per baris item, DPP_FACTOR 11/12)", () => {
    it("tanpa discount_on: discount_amount 0, dpp_amount = basic_amount * 11/12, tax_amount dari tax_rate item", () => {
      formPageState = makeFormPageState({
        data: {
          items: [{ id: 1, quantity: 2, rate: 500, tax: { rate: 11 } }],
        },
      });
      render(<Form />);

      const { mapItem } = formTablePropsSpy.mock.calls[0][0];
      const item = { id: 1, quantity: 2, rate: 500, tax: { rate: 11 } };
      const result = mapItem({ item, dataTable: [item], index: 0 });

      // basic_amount gross = 2*500 = 1000, tanpa discount_on hasil basic_amount
      // = gross (allocateDiscount return apa adanya).
      expect(result.discount_amount).toBe(0);
      // dpp_amount = basic_amount_setelah_alokasi * DPP_FACTOR = 1000 * 11/12.
      expect(result.dpp_amount).toBeCloseTo(1000 * (11 / 12), 5);
      // tax_amount = dpp_amount * tax_rate/100 = (1000*11/12)*11/100.
      expect(result.tax_amount).toBeCloseTo((1000 * (11 / 12) * 11) / 100, 2);
      // amount = gross - discountForLine(0) + tax_amount.
      expect(result.amount).toBeCloseTo(1000 + result.tax_amount, 2);
    });

    it("dengan discount_on=net_total: discount_amount mencerminkan selisih gross vs basic_amount hasil alokasi", () => {
      formPageState = makeFormPageState({
        data: {
          discount_on: "net_total",
          discount_rate: 10,
          latestDiscountKey: "discount_rate",
          items: [
            { id: 1, quantity: 1, rate: 1000, tax: { rate: 11 } },
            { id: 2, quantity: 1, rate: 1000, tax: { rate: 11 } },
          ],
        },
      });
      render(<Form />);

      const { mapItem } = formTablePropsSpy.mock.calls[0][0];
      const rows = [
        { id: 1, quantity: 1, rate: 1000, tax: { rate: 11 } },
        { id: 2, quantity: 1, rate: 1000, tax: { rate: 11 } },
      ];
      const result = mapItem({ item: rows[0], dataTable: rows, index: 0 });

      // Total basic 2000, discount 10% dari net_total (2000) = 200, dialokasikan
      // pro-rata 50/50 -> tiap baris basic_amount turun 100 dari gross 1000.
      expect(result.discount_amount).toBeCloseTo(100, 2);
    });

    it("meneruskan value={data.items} apa adanya ke FormTable dengan name PurchaseInvoiceItems", () => {
      const items = [{ id: 1, quantity: 1 }];
      formPageState = makeFormPageState({ data: { items } });
      render(<Form />);

      const props = formTablePropsSpy.mock.calls[0][0];
      expect(props.value).toBe(items);
      expect(props.name).toBe("PurchaseInvoiceItems");
    });
  });

  it("merender tanpa error saat data kosong (mode create)", () => {
    formPageState = makeFormPageState({ data: {} });
    expect(() => render(<Form />)).not.toThrow();
  });

  it("meneruskan disabled dari useFormPage ke PaymentSchedule sebagai readOnly", () => {
    formPageState = makeFormPageState({ disabled: true, data: { items: [] } });
    render(<Form />);

    const props = paymentSchedulePropsSpy.mock.calls[0][0];
    expect(props.readOnly).toBe(true);
  });

  it("meneruskan netAmount & taxAmount ke AdditionalDiscount", () => {
    formPageState = makeFormPageState({
      data: {
        items: [
          {
            purchase_order_item: { id: 1 },
            quantity: 12,
            rate: 100,
            tax: { rate: 11 },
          },
        ],
      },
    });
    render(<Form />);

    const props = additionalDiscountPropsSpy.mock.calls[0][0];
    expect(props.netAmount).toBe(1200);
    expect(props.taxAmount).toBe(121);
  });
});
