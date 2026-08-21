import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// ============================================================================
// Form.jsx (SalesInvoice) adalah salah satu halaman form transaksi terbesar
// (893 baris) -- dibungkus <FormPageContent>/useFormPage dari @/Pages/Core/
// FormPage (2234 baris, sudah ada test granular sendiri di FormPage.rtl.test
// .jsx & FormPageContent.rtl.test.jsx) dan meng-compose banyak child besar
// yang SUDAH punya test sendiri (PaymentSchedule, AdditionalDiscount) atau
// generik reusable yang belum ditest di sini (FormTable, LinkModel-LinkModel).
//
// Strategi: stub SEMUA child berat/sudah-ditest, fokus HANYA ke logic UNIK
// Form.jsx sendiri:
//   - Memo kalkulasi net_amount/dpp_amount/tax_amount/amount dari data.items.
//   - useEffect rekalkulasi price item rental "running" saat rental_cutoff_date
//     berubah (item "completed" tidak ikut).
//   - defaultValue() (getContraIncomeAccount tidak dites krn dipanggil manual
//     dari handler is_return, sedangkan defaultValue() dipanggil useFormPage
//     internal -- yang terakhir ini sudah dicover test lain, cukup pastikan
//     Form tidak crash saat useFormPage dipanggil dgn defaultValue callback).
//   - Transform data saat memilih sales_order (checkout SO -> item invoice).
//   - Transform reset saat toggle is_return checkbox + panggilan
//     getContraIncomeAccount (income_account contra).
//   - Transform data saat memilih return_against (retur invoice lama).
//   - mapItem callback yang diteruskan ke FormTable (alokasi diskon per-baris
//     via allocateDiscount dgn DPP_FACTOR 11/12 -- port dari
//     SalesInvoiceService::DPP_FACTOR).
//   - additionalData callback yang diteruskan ke PaymentSchedule (payment/
//     outstanding amount per invoice_portion).
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
// calculateDurationDays, calculateRentalAmount, generateRandom) dipakai APA
// ADANYA (implementasi asli) supaya logic Form.jsx yang menggunakannya benar-
// benar diuji, bukan stub.
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
// render FormPage asli (675 baris, orchestrator context/useForm/route yang
// bukan concern file ini). FormPageContent & FormPageContentTitle
// disederhanakan jadi <div>/<h3> passthrough. FormPageContext dibiarkan
// context React sungguhan (dipakai FormInput internal via useCanUpdate &
// useFormPageMeta) supaya tidak error walau tanpa provider.
let formPageState;
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
      // Replika perilaku useFormPage nyata: defaultValue callback dipanggil
      // (agar tidak crash bila diakses), hasilnya diabaikan di sini karena
      // fokus test bukan pada defaultValue resolution (sudah dicover
      // FormPage.rtl.test.jsx / useFormPage internal).
      if (typeof defaultValue === "function") {
        defaultValue().catch(() => {});
      }
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
        onClick={() => onValueChange?.(globalThis.__linkModelPayloads?.[testId])}
      >
        {testId}:{value?.id ?? value?.code ?? "none"}
      </button>
    );
  };
}

vi.mock("../Accounts/AccountLinkModel", () => ({
  default: makeLinkModelStub("account-link"),
}));
vi.mock("@/Pages/Asset/Assets/AssetLinkModel", () => ({
  default: makeLinkModelStub("asset-link"),
}));
vi.mock("@/Pages/Settings/Branches/BranchLinkModel", () => ({
  default: makeLinkModelStub("branch-link"),
}));
vi.mock("@/Pages/Core/CurrencyLinkModel", () => ({
  default: makeLinkModelStub("currency-link"),
}));
vi.mock("@/Pages/Sales/Customers/CustomerLinkModel", () => ({
  default: makeLinkModelStub("customer-link"),
}));
vi.mock("@/Pages/Inventory/Items/ItemUnitLinkModel", () => ({
  default: makeLinkModelStub("item-unit-link"),
}));
vi.mock("@/Pages/Sales/SalesOrders/SalesOrderItemLinkModel", () => ({
  default: makeLinkModelStub("sales-order-item-link"),
}));
vi.mock("./SalesInvoiceLinkModel", () => ({
  default: makeLinkModelStub("sales-invoice-link"),
}));
vi.mock("@/Pages/Sales/SalesOrders/SalesOrderLinkModel", () => ({
  default: makeLinkModelStub("sales-order-link"),
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

// NumberInput distub jadi input number polos -- bukan concern Form.jsx
// (kalkulasi & formatting NumberInput sudah menjadi concern komponen itu
// sendiri di tempat lain), cukup teruskan value & onValueChange apa adanya
// supaya assertion bisa membaca angka hasil memo net_amount/dpp_amount/
// tax_amount/amount.
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

// FormTable adalah komponen besar (2074+ baris) generik reusable yang BELUM
// ditest di sesi ini -- distub sebagai capture props sederhana (bukan full
// renderer kolom seperti stub PaymentSchedule) karena fokus test di sini
// hanya memverifikasi Form.jsx meneruskan columns/value/mapItem yang benar,
// bukan rendering tabel itu sendiri.
const formTablePropsSpy = vi.fn();
vi.mock("@/Components/FormTable", () => ({
  default: (props) => {
    formTablePropsSpy(props);
    return <div data-testid="form-table-stub">{props.name}</div>;
  },
}));

// PaymentSchedule & AdditionalDiscount SUDAH punya test granular sendiri
// (PaymentSchedule.rtl.test.jsx, AdditionalDiscount.rtl.test.jsx) -- distub
// jadi capture-props sederhana di sini supaya hanya wiring props dari
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

describe("SalesInvoice Form", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.__linkModelPayloads = {};
    usePageMock.mockReturnValue({
      props: { preferences: { default_currency_id: "idr" } },
    });
    getDataModelMock.mockResolvedValue([]);
    formPageState = makeFormPageState();
  });

  describe("kalkulasi total (net_amount/dpp_amount/tax_amount/amount)", () => {
    it("net_amount menjumlahkan basic_amount dikurangi discount_amount tiap item", () => {
      formPageState = makeFormPageState({
        data: {
          items: [
            { basic_amount: 1000, discount_amount: 100 },
            { basic_amount: 500, discount_amount: 0 },
          ],
        },
      });
      render(<Form />);

      // net_amount = (1000-100) + (500-0) = 1400 -- muncul di label readOnly
      // "Jumlah Dasar (IDR)" (currency dokumen sama dgn default, hanya 1 baris).
      const netAmountInputs = screen.getAllByDisplayValue("1400");
      expect(netAmountInputs.length).toBeGreaterThan(0);
    });

    it("item tanpa discount_amount (carry-over dari SalesOrder, belum dihitung backend) default ke 0", () => {
      formPageState = makeFormPageState({
        data: {
          items: [{ basic_amount: 750 }], // discount_amount undefined
        },
      });
      render(<Form />);

      expect(screen.getAllByDisplayValue("750").length).toBeGreaterThan(0);
    });

    it("dpp_amount & tax_amount dijumlahkan dari kolom dpp_amount/tax_amount tiap item (calculateArray)", () => {
      formPageState = makeFormPageState({
        data: {
          items: [
            { basic_amount: 1000, discount_amount: 0, dpp_amount: 916.67, tax_amount: 110 },
            { basic_amount: 500, discount_amount: 0, dpp_amount: 458.33, tax_amount: 55 },
          ],
        },
      });
      render(<Form />);

      expect(screen.getAllByDisplayValue("1375").length).toBeGreaterThan(0); // dpp 916.67+458.33
      expect(screen.getAllByDisplayValue("165").length).toBeGreaterThan(0); // tax 110+55
    });

    it("amount = net_amount + tax_amount - discount_amount dokumen (diteruskan ke additionalData PaymentSchedule)", () => {
      formPageState = makeFormPageState({
        data: {
          items: [{ basic_amount: 1000, discount_amount: 0, tax_amount: 110 }],
          discount_amount: 50,
        },
      });
      render(<Form />);

      // amount = 1000 + 110 - 50 = 1060. additionalData adalah callback yang
      // Form.jsx teruskan ke PaymentSchedule -- panggil dgn payment_schedules
      // dummy utk verifikasi payment_amount dihitung dari `amount` di atas.
      const { additionalData } = paymentSchedulePropsSpy.mock.calls[0][0];
      const result = additionalData([{ id: "row1", invoice_portion: 50 }]);
      expect(result.row1.payment_amount).toBe(530); // 1060 * 50 / 100
      expect(result.row1.outstanding_amount).toBe(530);
    });

    it("data.items undefined tidak crash -- net_amount/dpp_amount/tax_amount default ke 0", () => {
      formPageState = makeFormPageState({ data: { items: undefined } });
      expect(() => render(<Form />)).not.toThrow();
    });
  });

  describe("rekalkulasi price item rental saat rental_cutoff_date berubah", () => {
    it("item berstatus running dihitung ulang pakai calculateRentalAmount(monthly_rate, durationDays)", () => {
      const setData = vi.fn();
      formPageState = makeFormPageState({
        setData,
        data: {
          sales_order: { is_rent: true },
          rental_cutoff_date: "2026-01-31T00:00:00.000Z",
          items: [
            {
              id: 1,
              rental_status: "running",
              rental_shipped_date: "2026-01-01T00:00:00.000Z",
              rental_monthly_rate: 3000000,
              price: 0,
            },
          ],
        },
      });
      render(<Form />);

      expect(setData).toHaveBeenCalled();
      const updater = setData.mock.calls[setData.mock.calls.length - 1][0];
      const result = updater(formPageState.data);
      // durationDays inklusif 1 Jan s.d. 31 Jan = 31 hari.
      // calculateRentalAmount(3000000, 31): fullMonths=1, remainingDays=1
      // -> 1*3000000 + 1*(3000000/30) = 3100000.
      expect(result.items[0].rental_duration_days).toBe(31);
      expect(result.items[0].price).toBeCloseTo(3100000, 5);
    });

    it("item berstatus completed TIDAK ikut dihitung ulang", () => {
      const setData = vi.fn();
      formPageState = makeFormPageState({
        setData,
        data: {
          sales_order: { is_rent: true },
          rental_cutoff_date: "2026-01-31T00:00:00.000Z",
          items: [
            {
              id: 1,
              rental_status: "completed",
              rental_shipped_date: "2026-01-01T00:00:00.000Z",
              rental_monthly_rate: 3000000,
              price: 999,
            },
          ],
        },
      });
      render(<Form />);

      if (setData.mock.calls.length > 0) {
        const updater = setData.mock.calls[setData.mock.calls.length - 1][0];
        const result = updater(formPageState.data);
        expect(result.items[0].price).toBe(999);
        expect(result.items[0].rental_duration_days).toBeUndefined();
      }
    });

    it("tidak memanggil setData saat sales_order bukan rental (is_rent falsy)", () => {
      const setData = vi.fn();
      formPageState = makeFormPageState({
        setData,
        data: {
          sales_order: { is_rent: false },
          rental_cutoff_date: "2026-01-31T00:00:00.000Z",
          items: [{ id: 1, rental_status: "running" }],
        },
      });
      render(<Form />);

      expect(setData).not.toHaveBeenCalled();
    });

    it("tidak memanggil setData saat rental_cutoff_date belum diisi", () => {
      const setData = vi.fn();
      formPageState = makeFormPageState({
        setData,
        data: {
          sales_order: { is_rent: true },
          rental_cutoff_date: null,
          items: [{ id: 1, rental_status: "running" }],
        },
      });
      render(<Form />);

      expect(setData).not.toHaveBeenCalled();
    });
  });

  describe("transform data saat memilih sales_order", () => {
    it("memilih sales_order mengisi customer/currency/items/payment_schedules dari SO", async () => {
      const user = userEvent.setup({ delay: null });
      const setData = vi.fn();
      formPageState = makeFormPageState({ setData, data: { items: [] } });
      globalThis.__linkModelPayloads["sales-order-link"] = {
        id: 9,
        customer: { id: 1, name: "PT Sejahtera" },
        customer_branch: { id: 2 },
        currency: { id: 3, code: "usd" },
        items: [
          {
            id: 100,
            unbilled_quantity: 5,
            quantity: 10,
            basic_amount: 1000,
            tax_amount: 110,
          },
        ],
        payment_schedules: [{ id: 55, invoice_portion: 100 }],
        amount: 1110,
        discount_on: "net_total",
        discount_rate: 10,
        discount_amount: 100,
        exchange_rate: 15000,
        external_note: "Catatan SO",
      };

      render(<Form />);
      await user.click(screen.getByTestId("sales-order-link"));

      expect(setData).toHaveBeenCalled();
      const updater = setData.mock.calls[setData.mock.calls.length - 1][0];
      const result = updater({ items: [] });

      expect(result.customer).toEqual({ id: 1, name: "PT Sejahtera" });
      expect(result.currency).toEqual({ id: 3, code: "usd" });
      // quantity harus pakai unbilled_quantity (SO item mungkin partial billed).
      expect(result.items[0].quantity).toBe(5);
      // amount item = basic_amount + tax_amount (bukan net setelah discount).
      expect(result.items[0].amount).toBe(1110);
      expect(result.items[0].sales_order_item).toEqual(
        expect.objectContaining({ id: 100 }),
      );
      expect(result.payment_schedules[0].invoice_portion).toBe(100);
      expect(result.discount_rate).toBe(10);
      expect(result.exchange_rate).toBe(15000);
      expect(result.external_note).toBe("Catatan SO");
    });
  });

  describe("toggle is_return", () => {
    it("mencentang is_return mereset field terkait SO/customer/items dan memanggil getContraIncomeAccount (is_contra=true)", async () => {
      const user = userEvent.setup({ delay: null });
      const setData = vi.fn();
      formPageState = makeFormPageState({
        setData,
        data: {
          items: [{ id: 1 }],
          sales_order: { id: 1 },
          customer: { id: 1 },
        },
      });
      getDataModelMock.mockResolvedValue({ id: 77, is_contra: true });

      render(<Form />);
      const checkbox = screen.getByRole("forminput", {
        name: /finances.salesInvoice.columns.is_return/,
      });
      await user.click(checkbox);

      // getContraIncomeAccount dipanggil dgn is_contra=true (checkbox baru
      // dicentang) -- getDataModel dipanggil dgn filter is_contra: true.
      expect(getDataModelMock).toHaveBeenCalledWith(
        "App\\Models\\Finances\\Account",
        expect.objectContaining({
          root_type: "income",
          account_type: "income_account",
          is_contra: true,
        }),
        expect.objectContaining({ limit: 1 }),
      );

      expect(setData).toHaveBeenCalled();
      // Form.jsx memanggil setData dua kali secara independen saat toggle
      // is_return: (1) reset field sinkron via functional updater, (2)
      // getContraIncomeAccount().then() mengisi income_account secara async
      // setelah getDataModel resolve -- urutan keduanya di mock.calls tidak
      // dijamin, jadi cari pemanggilan functional updater yang menghasilkan
      // is_return alih-alih mengasumsikan salah satu index tetap.
      const resetCall = setData.mock.calls
        .map(([arg]) => (typeof arg === "function" ? arg(formPageState.data) : arg))
        .find((result) => result?.is_return === true);

      expect(resetCall).toBeDefined();
      expect(resetCall.sales_order).toBeUndefined();
      expect(resetCall.customer).toBeUndefined();
      expect(resetCall.items).toEqual([]);
    });
  });

  describe("transform data saat memilih return_against", () => {
    it("memilih return_against mengisi sales_order/customer/currency/items dari invoice yang diretur", async () => {
      const user = userEvent.setup({ delay: null });
      const setData = vi.fn();
      formPageState = makeFormPageState({
        setData,
        data: { items: [], is_return: true },
      });
      globalThis.__linkModelPayloads["sales-invoice-link"] = {
        id: 200,
        sales_order: { id: 9 },
        customer: { id: 1, name: "PT Retur" },
        customer_branch: { id: 2 },
        currency: { id: 3, code: "idr" },
        exchange_rate: 1,
        debit_account: { id: 88 },
        discount_on: null,
        items: [{ id: 300, price: 500 }],
      };

      render(<Form />);
      await user.click(screen.getByTestId("sales-invoice-link"));

      expect(setData).toHaveBeenCalled();
      const updater = setData.mock.calls[setData.mock.calls.length - 1][0];
      const result = updater({ items: [], debit_account: { id: 1 } });

      expect(result.customer).toEqual({ id: 1, name: "PT Retur" });
      expect(result.sales_order).toEqual({ id: 9 });
      expect(result.debit_account).toEqual({ id: 88 });
      expect(result.items[0]).toEqual(
        expect.objectContaining({ return_against_item_id: 300 }),
      );
    });

    it("debit_account fallback ke prev.debit_account saat return_against tidak membawa debit_account", async () => {
      const user = userEvent.setup({ delay: null });
      const setData = vi.fn();
      formPageState = makeFormPageState({
        setData,
        data: { items: [], is_return: true },
      });
      globalThis.__linkModelPayloads["sales-invoice-link"] = {
        id: 201,
        items: [],
        debit_account: undefined,
      };

      render(<Form />);
      await user.click(screen.getByTestId("sales-invoice-link"));

      const updater = setData.mock.calls[setData.mock.calls.length - 1][0];
      const prevDebitAccount = { id: 42 };
      const result = updater({ items: [], debit_account: prevDebitAccount });
      expect(result.debit_account).toBe(prevDebitAccount);
    });
  });

  describe("mapItem FormTable (alokasi diskon per baris item, DPP_FACTOR 11/12)", () => {
    it("tanpa discount_on: discount_amount 0, dpp_amount = basic_amount * 11/12, tax_amount dari tax_rate item", () => {
      formPageState = makeFormPageState({
        data: {
          items: [
            { id: 1, quantity: 2, price: 500, tax: { rate: 11 } },
          ],
        },
      });
      render(<Form />);

      const { mapItem } = formTablePropsSpy.mock.calls[0][0];
      const item = { id: 1, quantity: 2, price: 500, tax: { rate: 11 } };
      const result = mapItem({ item, dataTable: [item], index: 0 });

      // basic_amount gross = 2*500 = 1000, tanpa discount_on hasil basic_amount
      // = gross (allocateDiscount return apa adanya).
      expect(result.discount_amount).toBe(0);
      // dpp_amount = basic_amount_setelah_alokasi * DPP_FACTOR = 1000 * 11/12.
      expect(result.dpp_amount).toBeCloseTo(1000 * (11 / 12), 5);
      // tax_amount = dpp_amount * tax_rate/100 = (1000*11/12)*11/100.
      expect(result.tax_amount).toBeCloseTo(((1000 * (11 / 12)) * 11) / 100, 2);
    });

    it("dengan discount_on=net_total: discount_amount mencerminkan selisih gross vs basic_amount hasil alokasi", () => {
      formPageState = makeFormPageState({
        data: {
          discount_on: "net_total",
          discount_rate: 10,
          latestDiscountKey: "discount_rate",
          items: [
            { id: 1, quantity: 1, price: 1000, tax: { rate: 11 } },
            { id: 2, quantity: 1, price: 1000, tax: { rate: 11 } },
          ],
        },
      });
      render(<Form />);

      const { mapItem } = formTablePropsSpy.mock.calls[0][0];
      const rows = [
        { id: 1, quantity: 1, price: 1000, tax: { rate: 11 } },
        { id: 2, quantity: 1, price: 1000, tax: { rate: 11 } },
      ];
      const result = mapItem({ item: rows[0], dataTable: rows, index: 0 });

      // Total basic 2000, discount 10% dari net_total (2000) = 200, dialokasikan
      // pro-rata 50/50 -> tiap baris basic_amount turun 100 dari gross 1000.
      expect(result.discount_amount).toBeCloseTo(100, 2);
    });

    it("meneruskan value={data.items} dan valueBefore={dataBefore.items} apa adanya ke FormTable", () => {
      const items = [{ id: 1, quantity: 1 }];
      const dataBefore = { items: [{ id: 1, quantity: 2 }] };
      formPageState = makeFormPageState({ data: { items }, dataBefore });
      render(<Form />);

      const props = formTablePropsSpy.mock.calls[0][0];
      expect(props.value).toBe(items);
      expect(props.valueBefore).toBe(dataBefore.items);
      expect(props.name).toBe("SalesInvoiceItems");
    });
  });

  describe("kolom item: SalesOrderItemLinkModel filter & carry-over field", () => {
    it("memilih sales_order_item pada baris item mengisi unit/conversion_factor/quantity/price/tax/description", () => {
      formPageState = makeFormPageState({
        data: { items: [{ id: 1 }], sales_order: { id: 9 } },
      });
      render(<Form />);

      const itemColumns = formTablePropsSpy.mock.calls[0][0].columns;
      const itemCol = itemColumns.find((c) => c.name === "item");
      const setDataRow = vi.fn();
      const cellUi = itemCol.cell({
        dataRow: { id: 1 },
        setData: setDataRow,
        attributes: {},
      });

      // Simulasikan onValueChange dari SalesOrderItemLinkModel via akses props.
      cellUi.props.onValueChange({
        id: 500,
        unit: { id: 1, name: "Pcs" },
        conversion_factor: 2,
        unbilled_quantity: 7,
        price: 2500,
        tax: { id: 1, rate: 11 },
        description: "Barang A",
      });

      expect(setDataRow).toHaveBeenCalledWith(
        expect.objectContaining({
          unit: { id: 1, name: "Pcs" },
          conversion_factor: 2,
          quantity: 7,
          price: 2500,
          description: "Barang A",
        }),
      );
    });

    it("kolom item SalesOrderItemLinkModel disabled ketika data.sales_order belum dipilih", () => {
      formPageState = makeFormPageState({
        data: { items: [{ id: 1 }], sales_order: null },
      });
      render(<Form />);

      const itemColumns = formTablePropsSpy.mock.calls[0][0].columns;
      const itemCol = itemColumns.find((c) => c.name === "item");
      const cellUi = itemCol.cell({
        dataRow: { id: 1 },
        setData: vi.fn(),
        attributes: {},
      });
      expect(cellUi.props.disabled).toBe(true);
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
});
