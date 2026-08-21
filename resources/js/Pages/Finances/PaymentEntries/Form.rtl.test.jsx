import { describe, expect, it, vi, beforeEach } from "vitest";
import { render as rtlRender, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// ============================================================================
// Form.jsx (PaymentEntries, 539 baris) adalah halaman form transaksi Payment
// Entry (pembayaran/pelunasan invoice, alokasi ke satu/banyak payment
// schedule invoice). Dibungkus <FormPageContent>/useFormPage dari @/Pages/
// Core/FormPage (sudah ada test granular sendiri) dan meng-compose banyak
// child LinkModel berat (910+ baris) yang bukan concern file ini.
//
// Strategi: stub semua LinkModel/DatetimePicker/NumberInput/FormTable
// (generik atau sudah punya test sendiri). Select (payment_type/party_type/
// discount_type) TIDAK distub -- itu jalur satu-satunya untuk memicu logic
// UNIK Form.jsx ini via interaksi user nyata. Fokus test:
//   - getAmountPayment: total outstanding_amount payment_schedules yang
//     "due" (index 0 selalu ikut, index>0 hanya jika due_date <= now, baris
//     outstanding_amount<=0 tidak ikut).
//   - selectPayment: klik tombol "select" pada baris payment schedule ->
//     mengisi paid_amount (kumulatif s.d. index), payment_method, dan
//     account_paid_from/account_paid_to sesuai party_type.
//   - Transform payment_type -> party_type (receive->customer, pay->
//     supplier, internal_transfer->null) + reset payment_method saat
//     payment_type berubah.
//   - Transform memilih paymentable (invoice) -> currency, exchange_rate,
//     partyable, paid_amount (dari getAmountPayment), payment_method,
//     account_paid_from/to dari debit_account/credit_account invoice.
//   - Visibilitas conditional: field payment_method/party detail/FormTable
//     payment schedules/exchange_rate hanya muncul sesuai payment_type &
//     currency vs default_currency_id.
// ============================================================================

const stableT = (key) => key;
vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({ t: stableT }),
}));

const usePageMock = vi.fn();
vi.mock("@inertiajs/react", () => ({
  usePage: () => usePageMock(),
}));

const toastSuccess = vi.fn();
vi.mock("@/lib/gooeyToast", () => ({
  gooeyToast: { success: (...a) => toastSuccess(...a) },
}));

// useFormPage dikendalikan lewat state module-level `formPageState` supaya
// tiap test bisa menyuntik data/setData berbeda tanpa render FormPage asli
// (orchestrator context/useForm/route yang bukan concern file ini).
// FormPageContent disederhanakan jadi <div> passthrough. FormPageContext
// dibiarkan context React sungguhan (dipakai FormInput internal via
// useCanUpdate & useFormPageMeta) supaya tidak error walau tanpa provider.
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
    useFormPage: () => formPageState,
    useFormPageMeta: () => undefined,
    FormPageContext: React.createContext(),
  };
});

// Semua LinkModel (dialog CRUD berat, Popover) di-stub jadi tombol sederhana
// yang memanggil onValueChange dengan payload tetap dari
// globalThis.__linkModelPayloads -- cukup untuk menguji Form.jsx meneruskan
// transform yang benar, tanpa merender internal LinkModel (bukan concern
// file ini, AccountLinkModel/CurrencyLinkModel/dst semuanya wrapper tipis
// dari Components/LinkModel.jsx 910 baris).
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
        {testId}:{value?.id ?? value?.name ?? "none"}
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
vi.mock("@/Pages/Sales/Customers/CustomerLinkModel", () => ({
  default: makeLinkModelStub("customer-link"),
}));
vi.mock("@/Pages/Purchase/Suppliers/SupplierLinkModel", () => ({
  default: makeLinkModelStub("supplier-link"),
}));
vi.mock("../PaymentMethods/PaymentMethodLinkModel", () => ({
  default: makeLinkModelStub("payment-method-link"),
}));
vi.mock("@/Components/LinkModel", () => ({
  default: makeLinkModelStub("paymentable-link"),
}));

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

// NumberInput sudah punya test sendiri (Components/NumberInput/index.rtl.
// test.jsx) -- distub jadi input number polos, cukup teruskan value &
// onValueChange apa adanya.
vi.mock("@/Components/NumberInput", () => ({
  default: ({ value, onValueChange, currencyCode, disabled, ...props }) => (
    <input
      type="text"
      data-currency={currencyCode}
      disabled={disabled}
      value={value ?? ""}
      onChange={(e) => onValueChange?.(Number(e.target.value))}
      {...props}
    />
  ),
}));

vi.mock("@/Components/ui/textarea", () => ({
  Textarea: ({ value, onChange, ...props }) => (
    <textarea value={value ?? ""} onChange={onChange} {...props} />
  ),
}));

// FormTable (2074+ baris, generik reusable, punya test sendiri) -- distub
// sebagai capture-props sederhana yang tetap merender tombol actions() per
// baris `value` supaya selectPayment() (logic UNIK Form.jsx ini) bisa diuji
// end-to-end tanpa merender mekanisme tabel FormTable sungguhan.
const formTablePropsSpy = vi.fn();
vi.mock("@/Components/FormTable", () => ({
  default: (props) => {
    formTablePropsSpy(props);
    const rows = props.value ?? [];
    return (
      <div data-testid="form-table-stub">
        {rows.map((row, index) => (
          <div key={row.id ?? index} data-testid={`row-${index}`}>
            {props.actions?.({ row, index })}
          </div>
        ))}
      </div>
    );
  },
}));

import Form from "./Form";
import { TooltipProvider } from "@/Components/ui/tooltip";

// Select (payment_type/party_type/discount_type) & FormInput bawa <Tooltip>
// internal tanpa provider sendiri.
const render = (ui) => rtlRender(<TooltipProvider>{ui}</TooltipProvider>);

function makeFormPageState(overrides = {}) {
  return {
    data: { ...overrides.data },
    defaultData: overrides.defaultData ?? {},
    setData: overrides.setData ?? vi.fn(),
  };
}

describe("PaymentEntries Form", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.__linkModelPayloads = {};
    usePageMock.mockReturnValue({
      props: { preferences: { default_currency_id: "idr" } },
    });
    formPageState = makeFormPageState();
  });

  it("merender tanpa error saat data kosong (mode create)", () => {
    expect(() => render(<Form />)).not.toThrow();
  });

  describe("memilih payment_type (Select asli)", () => {
    it("memilih 'Receive' mengisi party_type='customer' via setData functional updater", async () => {
      const user = userEvent.setup({ delay: null });
      const setData = vi.fn();
      formPageState = makeFormPageState({ setData });
      render(<Form />);

      // Select.jsx menampilkan nilai terpilih di dalam <input readOnly
      // value="..."> (bukan text node polos) -- ambil trigger lewat id
      // FormInput ("_r_19_" dst tidak stabil, jadi query by role combobox-
      // like/textbox pada urutan render: payment_type adalah Select kedua
      // setelah date). Opsi dropdown berupa text node sungguhan (CommandItem).
      const triggers = document.querySelectorAll('[cmdk-root] input');
      const trigger = triggers[0];
      await user.click(trigger);
      await user.click(
        await screen.findByText(
          "finances.paymentEntry.columns.payment_type.options.receive",
        ),
      );

      expect(setData).toHaveBeenCalled();
      const updater = setData.mock.calls[setData.mock.calls.length - 1][0];
      const result = updater({ payment_type: undefined, payment_method: null });
      expect(result.payment_type).toBe("receive");
      expect(result.party_type).toBe("customer");
    });

    it("memilih 'Pay' mengisi party_type='supplier'", async () => {
      const user = userEvent.setup({ delay: null });
      const setData = vi.fn();
      formPageState = makeFormPageState({ setData });
      render(<Form />);

      const trigger = document.querySelectorAll('[cmdk-root] input')[0];
      await user.click(trigger);
      await user.click(
        await screen.findByText(
          "finances.paymentEntry.columns.payment_type.options.pay",
        ),
      );

      const updater = setData.mock.calls[setData.mock.calls.length - 1][0];
      const result = updater({ payment_type: undefined, payment_method: null });
      expect(result.party_type).toBe("supplier");
    });

    it("memilih 'internal_transfer' mengosongkan party_type (null)", async () => {
      const user = userEvent.setup({ delay: null });
      const setData = vi.fn();
      formPageState = makeFormPageState({ setData });
      render(<Form />);

      const trigger = document.querySelectorAll('[cmdk-root] input')[0];
      await user.click(trigger);
      await user.click(
        await screen.findByText(
          "finances.paymentEntry.columns.payment_type.options.internal_transfer",
        ),
      );

      const updater = setData.mock.calls[setData.mock.calls.length - 1][0];
      const result = updater({ payment_type: undefined, payment_method: null });
      expect(result.party_type).toBeNull();
    });

    it("mengganti payment_type yang sudah berbeda dari sebelumnya mereset payment_method ke null", async () => {
      const user = userEvent.setup({ delay: null });
      const setData = vi.fn();
      formPageState = makeFormPageState({ setData, data: { payment_type: "pay" } });
      render(<Form />);

      const trigger = document.querySelectorAll('[cmdk-root] input')[0];
      await user.click(trigger);
      await user.click(
        await screen.findByText(
          "finances.paymentEntry.columns.payment_type.options.receive",
        ),
      );

      const updater = setData.mock.calls[setData.mock.calls.length - 1][0];
      const result = updater({ payment_type: "pay", payment_method: { id: 1 } });
      expect(result.payment_method).toBeNull();
    });
  });

  describe("getAmountPayment (via memilih paymentable)", () => {
    it("index 0 selalu ikut dijumlahkan walau due_date di masa depan", async () => {
      const user = userEvent.setup({ delay: null });
      const setData = vi.fn();
      formPageState = makeFormPageState({
        setData,
        data: { payment_type: "receive", party_type: "customer" },
      });
      const futureDate = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);
      globalThis.__linkModelPayloads["paymentable-link"] = {
        id: 1,
        currency: { id: 1, code: "idr" },
        exchange_rate: 1,
        customer: { id: 5, name: "PT Sejahtera" },
        payment_schedules: [
          {
            outstanding_amount: 1000,
            due_date: futureDate,
            payment_method: { id: 1, name: "Transfer", default_account: { id: 10 } },
          },
        ],
      };

      render(<Form />);
      await user.click(screen.getByTestId("paymentable-link"));

      expect(setData).toHaveBeenCalled();
      const updater = setData.mock.calls[setData.mock.calls.length - 1][0];
      const result = updater({ party_type: "customer" });

      expect(result.paid_amount).toBe(1000);
      expect(result.payment_method).toEqual(
        expect.objectContaining({ id: 1, name: "Transfer" }),
      );
      // party_type customer -> account_paid_to diisi dari default_account.
      expect(result.account_paid_to).toEqual({ id: 10 });
    });

    it("index > 0 hanya ikut dijumlahkan jika due_date sudah lewat (<= now)", async () => {
      const user = userEvent.setup({ delay: null });
      const setData = vi.fn();
      formPageState = makeFormPageState({
        setData,
        data: { payment_type: "receive", party_type: "customer" },
      });
      const pastDate = new Date(Date.now() - 1000 * 60 * 60 * 24);
      const futureDate = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);
      globalThis.__linkModelPayloads["paymentable-link"] = {
        id: 2,
        currency: { id: 1, code: "idr" },
        exchange_rate: 1,
        customer: { id: 5 },
        payment_schedules: [
          { outstanding_amount: 500, due_date: pastDate, payment_method: null },
          { outstanding_amount: 300, due_date: pastDate, payment_method: null },
          { outstanding_amount: 200, due_date: futureDate, payment_method: null },
        ],
      };

      render(<Form />);
      await user.click(screen.getByTestId("paymentable-link"));

      const updater = setData.mock.calls[setData.mock.calls.length - 1][0];
      const result = updater({ party_type: "customer" });

      // Hanya index 0 (500) dan index 1 (300, due_date lewat) yang ikut;
      // index 2 (200, due_date di masa depan) TIDAK ikut -> total 800.
      expect(result.paid_amount).toBe(800);
    });

    it("outstanding_amount <= 0 pada suatu baris tidak ikut dijumlahkan", async () => {
      const user = userEvent.setup({ delay: null });
      const setData = vi.fn();
      formPageState = makeFormPageState({
        setData,
        data: { payment_type: "receive", party_type: "customer" },
      });
      const pastDate = new Date(Date.now() - 1000 * 60 * 60 * 24);
      globalThis.__linkModelPayloads["paymentable-link"] = {
        id: 3,
        currency: { id: 1, code: "idr" },
        exchange_rate: 1,
        customer: { id: 5 },
        payment_schedules: [
          { outstanding_amount: 0, due_date: pastDate, payment_method: null },
          { outstanding_amount: 400, due_date: pastDate, payment_method: null },
        ],
      };

      render(<Form />);
      await user.click(screen.getByTestId("paymentable-link"));

      const updater = setData.mock.calls[setData.mock.calls.length - 1][0];
      const result = updater({ party_type: "customer" });

      expect(result.paid_amount).toBe(400);
    });
  });

  describe("transform data saat memilih paymentable (invoice)", () => {
    it("party_type=customer: mengisi currency, exchange_rate, partyable dari customer, dan account_paid_from dari debit_account", async () => {
      const user = userEvent.setup({ delay: null });
      const setData = vi.fn();
      formPageState = makeFormPageState({
        setData,
        data: { payment_type: "receive", party_type: "customer" },
      });
      globalThis.__linkModelPayloads["paymentable-link"] = {
        id: 10,
        currency: { id: 2, code: "usd" },
        exchange_rate: 15000,
        customer: { id: 7, name: "PT ABC" },
        debit_account: { id: 55 },
        payment_schedules: [],
      };

      render(<Form />);
      await user.click(screen.getByTestId("paymentable-link"));

      const updater = setData.mock.calls[setData.mock.calls.length - 1][0];
      const result = updater({ party_type: "customer" });

      expect(result.currency).toEqual({ id: 2, code: "usd" });
      expect(result.exchange_rate).toBe(15000);
      expect(result.partyable).toEqual({ id: 7, name: "PT ABC" });
      expect(result.account_paid_from).toEqual({ id: 55 });
    });

    it("party_type=supplier: partyable dari supplier, account_paid_to dari credit_account", async () => {
      const user = userEvent.setup({ delay: null });
      const setData = vi.fn();
      formPageState = makeFormPageState({
        setData,
        data: { payment_type: "pay", party_type: "supplier" },
      });
      globalThis.__linkModelPayloads["paymentable-link"] = {
        id: 11,
        currency: { id: 1, code: "idr" },
        exchange_rate: 1,
        supplier: { id: 9, name: "Supplier X" },
        credit_account: { id: 66 },
        payment_schedules: [],
      };

      render(<Form />);
      await user.click(screen.getByTestId("paymentable-link"));

      const updater = setData.mock.calls[setData.mock.calls.length - 1][0];
      const result = updater({ party_type: "supplier" });

      expect(result.partyable).toEqual({ id: 9, name: "Supplier X" });
      expect(result.account_paid_to).toEqual({ id: 66 });
    });

    it("exchange_rate fallback ke 1 bila paymentable tidak membawa exchange_rate", async () => {
      const user = userEvent.setup({ delay: null });
      const setData = vi.fn();
      formPageState = makeFormPageState({
        setData,
        data: { payment_type: "receive", party_type: "customer" },
      });
      globalThis.__linkModelPayloads["paymentable-link"] = {
        id: 12,
        currency: { id: 1, code: "idr" },
        customer: { id: 1 },
        payment_schedules: [],
      };

      render(<Form />);
      await user.click(screen.getByTestId("paymentable-link"));

      const updater = setData.mock.calls[setData.mock.calls.length - 1][0];
      const result = updater({ party_type: "customer" });
      expect(result.exchange_rate).toBe(1);
    });

    it("account_paid_to fallback ke prev value saat paymentMethod tidak punya default_account (party_type customer)", async () => {
      const user = userEvent.setup({ delay: null });
      const setData = vi.fn();
      formPageState = makeFormPageState({
        setData,
        data: { payment_type: "receive", party_type: "customer" },
      });
      globalThis.__linkModelPayloads["paymentable-link"] = {
        id: 13,
        currency: { id: 1, code: "idr" },
        customer: { id: 1 },
        payment_schedules: [
          { outstanding_amount: 100, payment_method: null },
        ],
      };

      render(<Form />);
      await user.click(screen.getByTestId("paymentable-link"));

      const updater = setData.mock.calls[setData.mock.calls.length - 1][0];
      const prevAccount = { id: 999 };
      const result = updater({
        party_type: "customer",
        account_paid_to: prevAccount,
      });
      expect(result.account_paid_to).toBe(prevAccount);
    });
  });

  describe("selectPayment (tombol select pada baris payment schedule)", () => {
    it("klik select pada index 0 mengisi paid_amount dari outstanding_amount baris itu saja", async () => {
      const user = userEvent.setup({ delay: null });
      const setData = vi.fn();
      formPageState = makeFormPageState({
        setData,
        data: {
          payment_type: "receive",
          party_type: "customer",
          paymentable: {
            id: 1,
            payment_schedules: [
              {
                outstanding_amount: 700,
                payment_method: {
                  id: 3,
                  name: "Cash",
                  default_account: { id: 20 },
                },
              },
              { outstanding_amount: 300, payment_method: null },
            ],
          },
        },
      });

      render(<Form />);
      const row0 = screen.getByTestId("row-0");
      await user.click(row0.querySelector("button"));

      expect(setData).toHaveBeenCalled();
      const updater = setData.mock.calls[setData.mock.calls.length - 1][0];
      const result = updater({
        party_type: "customer",
        paymentable: formPageState.data.paymentable,
      });

      expect(result.paid_amount).toBe(700);
      expect(result.payment_method).toEqual(
        expect.objectContaining({ id: 3, name: "Cash" }),
      );
      expect(result.account_paid_to).toEqual({ id: 20 });
      expect(toastSuccess).toHaveBeenCalledWith(
        "finances.paymentTermTemplate.alert.success",
      );
    });

    it("klik select pada index 1 mengakumulasi outstanding_amount index 0..1", async () => {
      const user = userEvent.setup({ delay: null });
      const setData = vi.fn();
      formPageState = makeFormPageState({
        setData,
        data: {
          payment_type: "pay",
          party_type: "supplier",
          paymentable: {
            id: 1,
            payment_schedules: [
              { outstanding_amount: 700, payment_method: null },
              { outstanding_amount: 300, payment_method: null },
            ],
          },
        },
      });

      render(<Form />);
      const row1 = screen.getByTestId("row-1");
      await user.click(row1.querySelector("button"));

      const updater = setData.mock.calls[setData.mock.calls.length - 1][0];
      const result = updater({
        party_type: "supplier",
        paymentable: formPageState.data.paymentable,
      });

      expect(result.paid_amount).toBe(1000);
    });

    it("party_type=supplier: account_paid_from diisi dari default_account payment_method terpilih", async () => {
      const user = userEvent.setup({ delay: null });
      const setData = vi.fn();
      formPageState = makeFormPageState({
        setData,
        data: {
          payment_type: "pay",
          party_type: "supplier",
          paymentable: {
            id: 1,
            payment_schedules: [
              {
                outstanding_amount: 500,
                payment_method: {
                  id: 4,
                  name: "Transfer",
                  default_account: { id: 88 },
                },
              },
            ],
          },
        },
      });

      render(<Form />);
      const row0 = screen.getByTestId("row-0");
      await user.click(row0.querySelector("button"));

      const updater = setData.mock.calls[setData.mock.calls.length - 1][0];
      const result = updater({
        party_type: "supplier",
        paymentable: formPageState.data.paymentable,
      });

      expect(result.account_paid_from).toEqual({ id: 88 });
    });

    it("tombol select disabled saat baris outstanding_amount <= 0", () => {
      formPageState = makeFormPageState({
        data: {
          payment_type: "receive",
          party_type: "customer",
          paymentable: {
            id: 1,
            payment_schedules: [{ outstanding_amount: 0, payment_method: null }],
          },
        },
      });

      render(<Form />);
      const row0 = screen.getByTestId("row-0");
      expect(row0.querySelector("button")).toBeDisabled();
    });

    it("tombol select tidak dirender (actions null) saat dokumen sudah submitted (defaultData.submitted_at terisi)", () => {
      formPageState = makeFormPageState({
        defaultData: { submitted_at: "2026-01-01T00:00:00.000Z" },
        data: {
          payment_type: "receive",
          party_type: "customer",
          paymentable: {
            id: 1,
            payment_schedules: [{ outstanding_amount: 500, payment_method: null }],
          },
        },
      });

      render(<Form />);
      const row0 = screen.getByTestId("row-0");
      expect(row0.querySelector("button")).toBeNull();
    });
  });

  describe("visibilitas FormTable payment schedules & exchange_rate", () => {
    it("FormTable payment schedules tidak dirender bila paymentable belum dipilih", () => {
      formPageState = makeFormPageState({
        data: { payment_type: "receive", party_type: "customer" },
      });
      render(<Form />);
      expect(screen.queryByTestId("form-table-stub")).not.toBeInTheDocument();
    });

    it("FormTable payment schedules dirender & menerima value=paymentable.payment_schedules bila paymentable sudah dipilih", () => {
      const schedules = [{ id: 1, outstanding_amount: 100, payment_method: null }];
      formPageState = makeFormPageState({
        data: {
          payment_type: "receive",
          party_type: "customer",
          paymentable: { id: 1, payment_schedules: schedules },
        },
      });
      render(<Form />);

      expect(screen.getByTestId("form-table-stub")).toBeInTheDocument();
      const props = formTablePropsSpy.mock.calls[0][0];
      expect(props.value).toBe(schedules);
      expect(props.readOnly).toBe(true);
      expect(props.name).toBe("paymentEntrySchedules");
    });

    it("exchange_rate FormInput tidak muncul bila currency.code sama dengan default_currency_id", () => {
      formPageState = makeFormPageState({
        data: {
          payment_type: "receive",
          party_type: "customer",
          paymentable: { id: 1, payment_schedules: [] },
          currency: { id: 1, code: "idr" },
        },
      });
      render(<Form />);
      expect(
        screen.queryByText("finances.paymentEntry.columns.exchange_rate"),
      ).not.toBeInTheDocument();
    });

    it("exchange_rate FormInput muncul bila currency.code berbeda dari default_currency_id", () => {
      formPageState = makeFormPageState({
        data: {
          payment_type: "receive",
          party_type: "customer",
          paymentable: { id: 1, payment_schedules: [] },
          currency: { id: 2, code: "usd" },
          exchange_rate: 15000,
        },
      });
      render(<Form />);
      expect(
        screen.getByText("finances.paymentEntry.columns.exchange_rate"),
      ).toBeInTheDocument();
    });

    it("field party_type/paymentable tidak dirender saat payment_type='internal_transfer'", () => {
      formPageState = makeFormPageState({
        data: { payment_type: "internal_transfer" },
      });
      render(<Form />);
      expect(
        screen.queryByText("finances.paymentEntry.columns.party_type"),
      ).not.toBeInTheDocument();
      expect(screen.queryByTestId("paymentable-link")).not.toBeInTheDocument();
    });

    it("field payment_method (header) tidak dirender saat payment_type='internal_transfer'", () => {
      formPageState = makeFormPageState({
        data: { payment_type: "internal_transfer" },
      });
      render(<Form />);
      expect(
        screen.queryByTestId("payment-method-link"),
      ).not.toBeInTheDocument();
    });

    it("field payment_method (header) dirender saat payment_type='receive'", () => {
      formPageState = makeFormPageState({
        data: { payment_type: "receive", party_type: "customer" },
      });
      render(<Form />);
      expect(screen.getByTestId("payment-method-link")).toBeInTheDocument();
    });
  });

  describe("memilih payment_method (header) via PaymentMethodLinkModel", () => {
    it("party_type=receive: account_paid_to diisi dari default_account payment method", async () => {
      const user = userEvent.setup({ delay: null });
      const setData = vi.fn();
      formPageState = makeFormPageState({
        setData,
        data: { payment_type: "receive", party_type: "customer" },
      });
      globalThis.__linkModelPayloads["payment-method-link"] = {
        id: 5,
        name: "QRIS",
        default_account: { id: 33 },
      };

      render(<Form />);
      await user.click(screen.getByTestId("payment-method-link"));

      const updater = setData.mock.calls[setData.mock.calls.length - 1][0];
      const result = updater({ payment_type: "receive" });

      expect(result.payment_method).toEqual(
        expect.objectContaining({ id: 5, name: "QRIS" }),
      );
      expect(result.account_paid_to).toEqual({ id: 33 });
    });
  });

  describe("field lain", () => {
    it("account-link (account_paid_from/account_paid_to) dirender", () => {
      formPageState = makeFormPageState({
        data: { payment_type: "receive", party_type: "customer" },
      });
      render(<Form />);
      expect(screen.getAllByTestId("account-link").length).toBe(2);
    });

    it("merender tanpa error saat payment_type='pay'", () => {
      formPageState = makeFormPageState({
        data: { payment_type: "pay", party_type: "supplier" },
      });
      expect(() => render(<Form />)).not.toThrow();
    });

    it("mengubah notes memanggil setData('notes', value)", async () => {
      const user = userEvent.setup({ delay: null });
      const setData = vi.fn();
      formPageState = makeFormPageState({ setData });
      render(<Form />);

      const textarea = document.querySelector("textarea");
      await user.type(textarea, "a");

      expect(setData).toHaveBeenCalledWith("notes", "a");
    });
  });
});
