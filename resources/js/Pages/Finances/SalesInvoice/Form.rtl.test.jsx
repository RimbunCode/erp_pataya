import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  act,
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axios from "axios";

vi.mock("axios", () => ({ default: { post: vi.fn() } }));
let conditionalDefaultsMode = false;

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
//   - defaultValue() hanya mengisi tanggal (akun ditentukan engine, Q-P2-23);
//     tidak ada lookup akun default via getDataModel.
//   - Transform data saat memilih sales_order (checkout SO -> item invoice).
//   - Transform reset saat toggle is_return checkbox (tanpa lookup akun).
//   - Transform data saat memilih return_against (retur invoice lama).
//   - mapItem callback yang diteruskan ke FormTable (alokasi diskon per-baris
//     via allocateDiscount dgn faktor DPP 11/12 dari versi aturan fixture -- port dari
//     InvoiceItemTaxCalculator).
//   - additionalData callback yang diteruskan ke PaymentSchedule (payment/
//     outstanding amount per invoice_portion).
// ============================================================================

const stableT = (key) => key;
vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({ t: stableT }),
}));

// Izin `manage_off_source_items` (baris di luar dokumen sumber): default diizinkan,
// test tertentu mematikan lewat globalThis.__canOffSource = false.
vi.mock("@/Hooks/usePermission", () => ({
  default: () => ({
    can: () => globalThis.__canOffSource !== false,
    canGlobal: () => globalThis.__canOffSource !== false,
  }),
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
let lastDefaultValueResult;
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
    // Spec asset-items-section: props tiap section ditangkap per title supaya test
    // bisa memeriksa collapsible/defaultOpen section Asset Items.
    FormPageContent: (props) => {
      const { title, children } = props;
      if (title) {
        globalThis.__contentProps = {
          ...globalThis.__contentProps,
          [title]: props,
        };
      }
      return (
        <div>
          {title && <h3>{title}</h3>}
          {children}
        </div>
      );
    },
    FormPageContentDescription: ({ children }) => <p>{children}</p>,
    FormPageContentTitle: ({ children, ...props }) => (
      <div {...props}>{children}</div>
    ),
    useFormPage: (defaultValue) => {
      const [data, setDataState] = React.useState(formPageState.data);
      const setData = React.useCallback((keyOrFn, value) => {
        setDataState((previous) =>
          typeof keyOrFn === "function"
            ? keyOrFn(previous)
            : { ...previous, [keyOrFn]: value },
        );
      }, []);
      // Replika perilaku useFormPage nyata: defaultValue callback dipanggil
      // (agar tidak crash bila diakses), hasilnya diabaikan di sini karena
      // fokus test bukan pada defaultValue resolution (sudah dicover
      // FormPage.rtl.test.jsx / useFormPage internal).
      if (typeof defaultValue === "function") {
        lastDefaultValueResult = defaultValue();
        lastDefaultValueResult.catch(() => {});
      }
      return conditionalDefaultsMode
        ? { ...formPageState, data, setData, isCreate: true }
        : formPageState;
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
  return function LinkModelStub({
    value,
    onValueChange,
    disabled,
    required,
    with: withRelations,
    fields,
  }) {
    globalThis.__linkModelProps[testId] = { with: withRelations, fields };

    return (
      <button
        type="button"
        data-testid={testId}
        data-required={String(!!required)}
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
let deferTableUpdate;
vi.mock("@/Components/FormTable", () => ({
  default: (props) => {
    formTablePropsSpy(props);
    if (conditionalDefaultsMode && props.name === "SalesInvoiceItems") {
      return (
        <div>
          <output data-testid="conditional-items">
            {JSON.stringify(props.value)}
          </output>
          {props.value.map((row, rowIndex) => (
            <div key={row.id} data-testid={`conditional-row-${row.id}`}>
              {props.columns
                .filter((column) => ["item", "taxes"].includes(column.name))
                .map((column) => (
                  <div key={column.name}>
                    {column.cell(
                      {
                        dataRow: row,
                        data: row[column.name],
                        attributes: { required: !!column.required },
                        setData: (keyOrPatch, value) => {
                          const publish = () =>
                            props.onValueChange(
                              props.value.map((current) =>
                                current.id === row.id
                                  ? {
                                      ...current,
                                      ...(typeof keyOrPatch === "string"
                                        ? { [keyOrPatch]: value }
                                        : keyOrPatch),
                                    }
                                  : current,
                              ),
                            );
                          if (deferTableUpdate) deferTableUpdate(publish);
                          else publish();
                        },
                      },
                      rowIndex,
                    )}
                  </div>
                ))}
            </div>
          ))}
        </div>
      );
    }
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
    defaultData: overrides.defaultData,
    errors: overrides.errors,
  };
  return state;
}

// Props FormTable diambil per `name`, dari render TERAKHIR tabel tersebut.
function tableProps(name) {
  const calls = formTablePropsSpy.mock.calls
    .map(([props]) => props)
    .filter((props) => props.name === name);
  return calls[calls.length - 1];
}

const TAX_MODEL = "App\\Models\\Finances\\Tax";

// Versi aturan pajak yang dikirim server (Requirement 12.8): faktor DPP dan tarif TIDAK lagi konstanta klien.
// `tax-ppn` memakai DPP Nilai Lain 11/12; `tax-flat` berfaktor 1/1 (DPP tidak ditampilkan); `tax-half` berfaktor 1/2
// (membuktikan faktor datang dari data, bukan 11/12 tetap); `tax-pph` adalah pajak potong (withholding).
const TAX_RULE_VERSIONS = [
  {
    id: "ver-ppn",
    tax_id: "tax-ppn",
    status: "active",
    effective_from: "2000-01-01",
    effective_to: null,
    rate: 11,
    dpp_numerator: 11,
    dpp_denominator: 12,
    behavior: "additive",
  },
  {
    id: "ver-flat",
    tax_id: "tax-flat",
    status: "active",
    effective_from: "2000-01-01",
    effective_to: null,
    rate: 10,
    dpp_numerator: 1,
    dpp_denominator: 1,
    behavior: "additive",
  },
  {
    id: "ver-half",
    tax_id: "tax-half",
    status: "active",
    effective_from: "2000-01-01",
    effective_to: null,
    rate: 10,
    dpp_numerator: 1,
    dpp_denominator: 2,
    behavior: "additive",
  },
  {
    id: "ver-pph",
    tax_id: "tax-pph",
    status: "active",
    effective_from: "2000-01-01",
    effective_to: null,
    rate: 2,
    dpp_numerator: 1,
    dpp_denominator: 1,
    behavior: "withholding",
  },
];

describe("SalesInvoice Form", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    conditionalDefaultsMode = false;
    globalThis.__linkModelPayloads = {};
    globalThis.__linkModelProps = {};
    globalThis.__contentProps = {};
    usePageMock.mockReturnValue({
      props: {
        preferences: { default_currency_id: "idr" },
        taxRuleVersions: TAX_RULE_VERSIONS,
      },
    });
    getDataModelMock.mockResolvedValue([]);
    formPageState = makeFormPageState();
  });

  describe("akun dikelola engine (Q-P2-23, Task 12.3)", () => {
    const ACCOUNTS_TITLE = "finances.salesInvoice.columns.accounts";

    it("selalu menyembunyikan seksi akun", () => {
      render(<Form />);

      expect(globalThis.__contentProps[ACCOUNTS_TITLE]).toBeUndefined();
      expect(screen.queryByTestId("account-link")).not.toBeInTheDocument();
    });

    it("tidak terpengaruh prop accountsManagedByEngine yang sudah dihapus", () => {
      usePageMock.mockReturnValue({
        props: {
          preferences: { default_currency_id: "idr" },
          accountsManagedByEngine: false,
        },
      });
      render(<Form />);

      expect(globalThis.__contentProps[ACCOUNTS_TITLE]).toBeUndefined();
    });

    it("defaultValue hanya mengisi tanggal dan tidak mengambil akun default", async () => {
      render(<Form />);

      await expect(lastDefaultValueResult).resolves.toEqual({
        date: expect.any(Date),
      });
      expect(getDataModelMock).not.toHaveBeenCalled();
    });
  });

  describe("conditional defaults integration", () => {
    const moduleTax = { id: "module-tax", rate: 11 };
    const ruleTax = { id: "rule-tax", rate: 5 };
    const manualTax = { id: "manual-tax", rate: 7 };
    const variant = (id) => ({
      id: `variant-${id}`,
      item: { id },
      thisModel: "App\\Models\\Inventory\\ItemVariant",
      is_stock_item: true,
    });
    const rows = () =>
      JSON.parse(screen.getByTestId("conditional-items").textContent);
    const choose = async (testId, value) => {
      globalThis.__linkModelPayloads[testId] = value;
      await userEvent.click(
        within(screen.getByTestId("conditional-row-row-1")).getByTestId(testId),
      );
    };
    const mount = (row = {}, errors) => {
      conditionalDefaultsMode = true;
      deferTableUpdate = undefined;
      usePageMock.mockReturnValue({
        props: {
          preferences: { default_currency_id: "idr" },
          defaults: { tax: moduleTax, warehouse: { id: "module-warehouse" } },
        },
      });
      formPageState = makeFormPageState({
        data: { sales_order: { id: "so-1" }, items: [{ id: "row-1", ...row }] },
        errors,
      });
      const responses = new Map();
      axios.post.mockImplementation((url, payload) => {
        if (url === "/defaults/resolve")
          return new Promise((resolve) => {
            responses.set(payload.items[0].item_id, resolve);
          });
        return Promise.resolve({
          data: {
            data: payload.model.endsWith("Tax")
              ? [ruleTax]
              : [{ id: "rule-warehouse" }],
          },
        });
      });
      render(<Form />);
      return async (
        itemId = "item-1",
        taxIds = [ruleTax.id],
        taxOptional = false,
      ) => {
        await waitFor(() => expect(responses.has(itemId)).toBe(true));
        await act(async () => {
          responses.get(itemId)({
            data: {
              items: {
                [itemId]: {
                  tax_ids: taxIds,
                  taxes: taxIds.map((id) => ({ ...ruleTax, id })),
                  tax_optional: taxOptional,
                  warehouse_id: "rule-warehouse",
                },
              },
            },
          });
        });
      };
    };

    it.each([[[]], [[ruleTax.id]]])(
      "retains early resolution %j until the selected row reaches the parent",
      async (taxIds) => {
        const respond = mount();
        let publish;
        deferTableUpdate = (callback) => {
          publish = callback;
        };
        await choose("sales-order-item-link", variant("item-1"));
        await respond("item-1", taxIds);
        expect(rows()[0].item).toBeUndefined();
        deferTableUpdate = undefined;
        act(() => publish());
        expect(rows()[0].tax).toEqual(taxIds.length ? ruleTax : null);
        expect(rows()[0].tax_rate).toBe(taxIds.length ? 5 : 0);
      },
    );

    it("menandai pajak baris wajib bila resolusi tidak optional", async () => {
      const respond = mount();
      await choose("sales-order-item-link", variant("item-1"));
      await respond();

      await waitFor(() => expect(rows()[0].tax).toEqual(ruleTax));
      expect(
        within(screen.getByTestId("conditional-row-row-1")).getByTestId(
          "tax-link",
        ),
      ).toHaveAttribute("data-required", "true");
    });

    it("pajak baris boleh kosong tanpa penanda wajib bila resolusi tax_optional", async () => {
      const respond = mount();
      await choose("sales-order-item-link", variant("item-1"));
      await respond("item-1", [], true);

      await waitFor(() => expect(rows()[0].tax).toBeNull());
      await waitFor(() =>
        expect(
          within(screen.getByTestId("conditional-row-row-1")).getByTestId(
            "tax-link",
          ),
        ).toHaveAttribute("data-required", "false"),
      );
    });

    it.each([
      ["baris dari baris SO", { sales_order_item: { id: "soi-1" } }],
      ["baris Asset", { asset: { id: "asset-1" }, asset_id: "asset-1" }],
    ])(
      "%s tanpa pajak tidak pernah di-resolve sehingga tidak diblokir di klien",
      (_label, row) => {
        mount({ ...row, item: variant("item-1") });

        expect(
          within(screen.getByTestId("conditional-row-row-1")).getByTestId(
            "tax-link",
          ),
        ).toHaveAttribute("data-required", "false");
      },
    );

    it("menampilkan galat server items.N.tax.id pada sel pajak baris yang benar", () => {
      mount({}, { "items.0.tax.id": "Pajak wajib diisi." });

      const message = screen.getByText("Pajak wajib diisi.");
      expect(message.previousElementSibling).toBe(
        within(screen.getByTestId("conditional-row-row-1")).getByTestId(
          "tax-link",
        ),
      );
    });

    it("keeps manually cleared tax empty when replacing an item", async () => {
      const respond = mount();
      await choose("sales-order-item-link", variant("item-1"));
      await choose("tax-link", []);
      await choose("sales-order-item-link", variant("item-2"));
      expect(rows()[0].tax).toBeNull();
      await respond("item-2");
      expect(rows()[0].tax).toBeNull();
    });

    it("applies hydrated conditional tax to a manual item through the real resolver", async () => {
      const respond = mount();
      await choose("sales-order-item-link", variant("item-1"));
      await waitFor(() =>
        expect(axios.post).toHaveBeenCalledWith(
          "/defaults/resolve",
          {
            document_type: "sales_invoice",
            items: [{ item_id: "item-1" }],
          },
          expect.objectContaining({ signal: expect.any(AbortSignal) }),
        ),
      );
      expect(rows()[0].tax).toEqual(moduleTax);
      await respond();
      await waitFor(() => expect(rows()[0].tax).toEqual(ruleTax));
      expect(rows()[0].tax_rate).toBe(5);
      expect(rows()[0]).not.toHaveProperty("warehouse");
    });

    it.each([manualTax, null, moduleTax])(
      "preserves user tax selection %j while resolution is pending",
      async (tax) => {
        const respond = mount();
        await choose("sales-order-item-link", variant("item-1"));
        await waitFor(() =>
          expect(axios.post).toHaveBeenCalledWith(
            "/defaults/resolve",
            expect.anything(),
            expect.objectContaining({ signal: expect.any(AbortSignal) }),
          ),
        );
        await choose("tax-link", tax ? [tax] : []);
        await respond();
        expect(axios.post).not.toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({ model: TAX_MODEL }),
          expect.anything(),
        );
        expect(rows()[0].tax).toEqual(tax);
      },
    );

    it("preserves a source row selected before the manual item response arrives", async () => {
      const respond = mount();
      await choose("sales-order-item-link", variant("item-1"));
      await waitFor(() =>
        expect(axios.post).toHaveBeenCalledWith(
          "/defaults/resolve",
          expect.anything(),
          expect.objectContaining({ signal: expect.any(AbortSignal) }),
        ),
      );
      await choose("sales-order-item-link", {
        id: "source-1",
        item: { id: "item-1" },
        tax: manualTax,
        unbilled_quantity: 2,
      });
      await respond();
      expect(axios.post).not.toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ model: TAX_MODEL }),
        expect.anything(),
      );
      expect(rows()[0].sales_order_item.id).toBe("source-1");
      expect(rows()[0].tax).toEqual(manualTax);
    });

    it("ignores an older item response after the row changes item", async () => {
      const respond = mount();
      await choose("sales-order-item-link", variant("item-1"));
      await waitFor(() =>
        expect(axios.post).toHaveBeenCalledWith(
          "/defaults/resolve",
          expect.anything(),
          expect.objectContaining({ signal: expect.any(AbortSignal) }),
        ),
      );
      await choose("sales-order-item-link", variant("item-2"));
      await respond("item-2", []);
      await waitFor(() => expect(rows()[0].tax).toBeNull());
      await respond();
      expect(axios.post).not.toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ model: TAX_MODEL }),
        expect.anything(),
      );
      expect(rows()[0].item.item.id).toBe("item-2");
      expect(rows()[0].tax).toBeNull();
    });

    it("applies an explicit no-tax result instead of the module fallback", async () => {
      const respond = mount();
      await choose("sales-order-item-link", variant("item-1"));
      await waitFor(() =>
        expect(axios.post).toHaveBeenCalledWith(
          "/defaults/resolve",
          expect.anything(),
          expect.objectContaining({ signal: expect.any(AbortSignal) }),
        ),
      );
      await respond("item-1", []);
      await waitFor(() => expect(rows()[0].tax).toBeNull());
      expect(rows()[0].tax_rate).toBe(0);
    });
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
            {
              tax: { id: "tax-ppn" },
              basic_amount: 1000,
              discount_amount: 0,
              dpp_amount: 916.67,
              tax_amount: 110,
            },
            {
              tax: { id: "tax-ppn" },
              basic_amount: 500,
              discount_amount: 0,
              dpp_amount: 458.33,
              tax_amount: 55,
            },
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
    it("mencentang is_return mereset field terkait SO/customer/items tanpa lookup akun", async () => {
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
      render(<Form />);
      getDataModelMock.mockClear();
      const checkbox = screen.getByRole("forminput", {
        name: /finances.salesInvoice.columns.is_return/,
      });
      await user.click(checkbox);

      // Akun ditentukan engine: tidak ada lookup akun kontra saat toggle.
      expect(getDataModelMock).not.toHaveBeenCalled();

      expect(setData).toHaveBeenCalled();
      // Cari pemanggilan functional updater yang menghasilkan is_return.
      const resetCall = setData.mock.calls
        .map(([arg]) =>
          typeof arg === "function" ? arg(formPageState.data) : arg,
        )
        .find((result) => result?.is_return === true);

      expect(resetCall).toBeDefined();
      expect(resetCall.sales_order).toBeUndefined();
      expect(resetCall.customer).toBeUndefined();
      expect(resetCall.items).toEqual([]);
    });

    describe("melepas centang is_return", () => {
      const checkboxName = /finances.salesInvoice.columns.is_return/;
      const lastResult = (setData, prevData) =>
        setData.mock.calls
          .map(([arg]) => (typeof arg === "function" ? arg(prevData) : arg))
          .pop();

      it("tidak ada akun dan tidak memanggil getDataModel saat retur dilepas", async () => {
        const user = userEvent.setup({ delay: null });
        const setData = vi.fn();
        usePageMock.mockReturnValue({
          props: {
            preferences: { default_currency_id: "idr" },
          },
        });
        formPageState = makeFormPageState({
          setData,
          data: { items: [], is_return: true },
        });

        render(<Form />);
        getDataModelMock.mockClear();
        await user.click(screen.getByRole("forminput", { name: checkboxName }));

        const result = lastResult(setData, formPageState.data);
        expect(result.is_return).toBe(false);
        expect(result.income_account).toBeUndefined();
        expect(getDataModelMock).not.toHaveBeenCalled();
      });
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
      // Akun ditentukan engine: tidak disalin dari invoice yang diretur.
      expect(result.debit_account).toEqual({ id: 1 });
      expect(result.items[0]).toEqual(
        expect.objectContaining({ return_against_item_id: 300 }),
      );
    });
  });

  describe("mapItem FormTable (alokasi diskon per baris item, faktor DPP 11/12)", () => {
    it("tanpa discount_on: discount_amount 0, dpp_amount = basic_amount * 11/12, tax_amount dari tax_rate item", () => {
      formPageState = makeFormPageState({
        data: {
          items: [
            {
              id: 1,
              quantity: 2,
              price: 500,
              tax: { id: "tax-ppn", rate: 11 },
            },
          ],
        },
      });
      render(<Form />);

      const { mapItem } = tableProps("SalesInvoiceItems");
      const item = {
        id: 1,
        quantity: 2,
        price: 500,
        tax: { id: "tax-ppn", rate: 11 },
      };
      const result = mapItem({ item, dataTable: [item], index: 0 });

      // basic_amount gross = 2*500 = 1000, tanpa discount_on hasil basic_amount
      // = gross (allocateDiscount return apa adanya).
      expect(result.discount_amount).toBe(0);
      // dpp_amount = basic_amount_setelah_alokasi * faktor DPP = 1000 * 11/12.
      expect(result.dpp_amount).toBeCloseTo(1000 * (11 / 12), 5);
      // tax_amount = dpp_amount * tax_rate/100 = (1000*11/12)*11/100.
      expect(result.tax_amount).toBeCloseTo((1000 * (11 / 12) * 11) / 100, 2);
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

      const { mapItem } = tableProps("SalesInvoiceItems");
      const rows = [
        { id: 1, quantity: 1, price: 1000, tax: { rate: 11 } },
        { id: 2, quantity: 1, price: 1000, tax: { rate: 11 } },
      ];
      const result = mapItem({ item: rows[0], dataTable: rows, index: 0 });

      // Total basic 2000, discount 10% dari net_total (2000) = 200, dialokasikan
      // pro-rata 50/50 -> tiap baris basic_amount turun 100 dari gross 1000.
      expect(result.discount_amount).toBeCloseTo(100, 2);
    });

    it("faktor DPP dan tarif berasal dari versi aturan server, bukan 11/12 tetap (Requirement 12.8)", () => {
      formPageState = makeFormPageState({ data: { items: [] } });
      render(<Form />);

      const { mapItem } = tableProps("SalesInvoiceItems");
      const item = {
        id: 1,
        quantity: 1,
        price: 1000,
        tax: { id: "tax-half", rate: 999 },
      };
      const result = mapItem({ item, dataTable: [item], index: 0 });

      // versi tax-half: faktor 1/2, tarif 10 (tarif master 999 diabaikan): dpp 500, pajak 50.
      expect(result.dpp_amount).toBeCloseTo(500, 5);
      expect(result.tax_amount).toBeCloseTo(50, 5);
    });

    it("baris tanpa pajak tidak punya angka DPP dan pajak", () => {
      formPageState = makeFormPageState({ data: { items: [] } });
      render(<Form />);

      const { mapItem } = tableProps("SalesInvoiceItems");
      const item = { id: 1, quantity: 1, price: 1000, tax: null };
      const result = mapItem({ item, dataTable: [item], index: 0 });

      expect(result.dpp_amount).toBe(0);
      expect(result.tax_amount).toBe(0);
      expect(result.withholding_amount).toBe(0);
    });

    it("pajak withholding tidak menambah pajak dan dihitung sebagai pemotongan terpisah", () => {
      formPageState = makeFormPageState({ data: { items: [] } });
      render(<Form />);

      const { mapItem } = tableProps("SalesInvoiceItems");
      const item = {
        id: 1,
        quantity: 1,
        price: 1000,
        tax: { id: "tax-pph", rate: 2 },
      };
      const result = mapItem({ item, dataTable: [item], index: 0 });

      expect(result.tax_amount).toBe(0);
      expect(result.withholding_amount).toBeCloseTo(20, 5);
    });

    it("meneruskan value={data.items} dan valueBefore={dataBefore.items} apa adanya ke FormTable", () => {
      const items = [{ id: 1, quantity: 1 }];
      const dataBefore = { items: [{ id: 1, quantity: 2 }] };
      formPageState = makeFormPageState({ data: { items }, dataBefore });
      render(<Form />);

      const props = tableProps("SalesInvoiceItems");
      expect(props.value).toBe(items);
      expect(props.valueBefore).toBe(dataBefore.items);
      expect(props.name).toBe("SalesInvoiceItems");
    });
  });

  describe("kolom item: SalesOrderItemLinkModel filter & carry-over field", () => {
    it("menampilkan Total Harga bruto dan DPP sebagai kolom read-only", () => {
      formPageState = makeFormPageState({
        data: {
          currency: { code: "idr" },
          items: [{ id: 1, tax: { id: "tax-ppn" } }],
        },
      });
      render(<Form />);

      const itemColumns = formTablePropsSpy.mock.calls[0][0].columns;
      const grossAmountColumn = itemColumns.find(
        (column) => column.name === "gross_amount",
      );
      const dppAmountColumn = itemColumns.find(
        (column) => column.name === "dpp_amount",
      );

      expect(grossAmountColumn).toMatchObject({
        titleTrans: "finances.salesInvoice.columns.gross_amount",
        readOnly: true,
        show: true,
      });
      expect(dppAmountColumn).toMatchObject({
        titleTrans: "finances.salesInvoice.columns.dpp_amount",
        readOnly: true,
        show: true,
      });

      const grossAmountInput = grossAmountColumn.cell({
        dataRow: { quantity: 2, price: 500 },
        attributes: {},
      });
      const dppAmountInput = dppAmountColumn.cell({
        data: 825,
        dataRow: { tax: { id: "tax-ppn" } },
        attributes: {},
      });

      expect(grossAmountInput.props.value).toBe(1000);
      expect(grossAmountInput.props.readOnly).toBe(true);
      expect(dppAmountInput.props.value).toBe(825);
      expect(dppAmountInput.props.readOnly).toBe(true);
    });

    it("memilih sales_order_item pada baris item mengisi unit/conversion_factor/quantity/price/tax/description", () => {
      formPageState = makeFormPageState({
        data: { items: [{ id: 1 }], sales_order: { id: 9 } },
      });
      render(<Form />);

      const itemColumns = tableProps("SalesInvoiceItems").columns;
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

      const itemColumns = tableProps("SalesInvoiceItems").columns;
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

  // --------------------------------------------------------------------
  // Spec delivery-note-sales-invoice-off-source-items: satu tabel Items, kolom item
  // multi-model (baris SO utama + sub model ItemVariant dan Asset bebas)
  // --------------------------------------------------------------------
  describe("kolom item multi-model (spec delivery-note-sales-invoice-off-source-items)", () => {
    const ITEMS_TABLE = "SalesInvoiceItems";
    const ASSET_MODEL = "App\\Models\\Asset\\Asset";
    const VARIANT_MODEL = "App\\Models\\Inventory\\ItemVariant";

    const columnOf = (name) =>
      tableProps(ITEMS_TABLE).columns.find((c) => c.name === name);
    const cellOf = (name, dataRow = {}, setRow = vi.fn()) => {
      const cell = columnOf(name).cell({
        dataRow,
        data: undefined,
        setData: setRow,
        attributes: {},
      });
      // Sel pajak dibungkus <div> bersama pesan galat baris; ambil pemilihnya.
      return cell.type === "div" ? cell.props.children[0] : cell;
    };
    const renderWith = (data = {}) => {
      formPageState = makeFormPageState({
        data: { items: [], sales_order: { id: 9 }, ...data },
      });
      render(<Form />);
    };

    it("tanpa izin manage_off_source_items: sub model ItemVariant/Asset tidak ditawarkan", () => {
      globalThis.__canOffSource = false;
      try {
        renderWith();

        expect(cellOf("item").props.subModels).toBeUndefined();
      } finally {
        globalThis.__canOffSource = undefined;
      }
    });

    it("hanya satu FormTable (tidak ada section/tabel Asset Items)", () => {
      renderWith();

      expect(tableProps(ITEMS_TABLE).name).toBe(ITEMS_TABLE);
      expect(tableProps("SalesInvoiceAssetItems")).toBeUndefined();
      expect(screen.queryByText("asset.assetItems.title")).toBeNull();
    });

    it("kolom item: utama baris SO + sub model ItemVariant dan Asset; filter tidak lagi membedakan asset_id", () => {
      renderWith();

      const cell = cellOf("item");

      expect(cell.props.mainLabel).toBe(
        "finances.salesInvoice.columns.item.group_source",
      );
      expect(cell.props.subModels).toEqual([
        expect.objectContaining({
          model: VARIANT_MODEL,
          filters: { "item.is_fixed_asset": false },
        }),
        expect.objectContaining({
          model: ASSET_MODEL,
          filters: { status: { jsonContains: ["active"] } },
        }),
      ]);
      expect(cell.props.filters).toEqual({ sales_order_id: 9 });
    });

    it("memilih opsi baris SO ber-asset_id mengisi asset_id/asset dan mengosongkan unit", () => {
      renderWith();
      const setRow = vi.fn();

      cellOf("item", { id: 1 }, setRow).props.onValueChange({
        id: "so-item-1",
        thisModel: "App\\Models\\Sales\\SalesOrderItem",
        asset_id: "asset-1",
        asset: { id: "asset-1", name: "Asset A" },
        unbilled_quantity: 1,
        price: 5000,
      });

      expect(setRow).toHaveBeenCalledWith(
        expect.objectContaining({
          sales_order_item: expect.objectContaining({ id: "so-item-1" }),
          asset_id: "asset-1",
          asset: { id: "asset-1", name: "Asset A" },
          unit: null,
          conversion_factor: 1,
          quantity: 1,
          price: 5000,
        }),
      );
    });

    it("memilih opsi Asset bebas: sumber SO dikosongkan, tanpa unit, qty 1, harga/pajak dikosongkan", () => {
      renderWith();
      const setRow = vi.fn();
      const asset = { id: "asset-9", thisModel: ASSET_MODEL };

      cellOf("item", { id: 1 }, setRow).props.onValueChange(asset);

      expect(setRow).toHaveBeenCalledWith({
        sales_order_item: null,
        item: null,
        asset,
        asset_id: "asset-9",
        unit: null,
        conversion_factor: 1,
        quantity: 1,
        price: undefined,
        taxes: [],
        tax: null,
        description: undefined,
      });
    });

    it("memilih opsi ItemVariant bebas: sumber SO dikosongkan, unit default varian, qty 1", () => {
      renderWith();
      const setRow = vi.fn();
      const variant = {
        id: "v1",
        thisModel: VARIANT_MODEL,
        default_uom: { id: "u1", conversion_factor: 2 },
      };

      cellOf("item", { id: 1 }, setRow).props.onValueChange(variant);

      expect(setRow).toHaveBeenCalledWith({
        sales_order_item: null,
        item: variant,
        asset: null,
        asset_id: null,
        unit: variant.default_uom,
        conversion_factor: 2,
        quantity: 1,
        price: undefined,
        taxes: [],
        tax: null,
        tax_rate: undefined,
        description: undefined,
      });
    });

    it("nilai kolom dan navigasi mengikuti jenis baris", () => {
      renderWith();

      expect(cellOf("item", { asset: { id: "a1" } }).props.value).toEqual({
        id: "a1",
      });
      expect(cellOf("item", { item: { id: "v1" } }).props.value).toEqual({
        id: "v1",
      });
      expect(
        cellOf("item", { sales_order_item: { id: 3 } }).props.value,
      ).toEqual({ id: 3 });
      expect(cellOf("item", { asset: { id: "a1" } }).props.as).toBe(
        "asset:asset_id",
      );
      expect(cellOf("item", { item: { id: "v1" } }).props.as).toBe(
        "item:item.item_id",
      );
    });

    it("unit nonaktif untuk baris asset; quantity/tax/price aktif untuk ketiga sumber; tax wajib", () => {
      renderWith();
      const assetRow = { asset: { id: "a1" }, asset_id: "a1" };
      const itemRow = { item: { id: "v1", item_id: "I1" } };

      expect(cellOf("unit", assetRow).props.disabled).toBe(true);
      expect(cellOf("unit", itemRow).props.disabled).toBe(false);
      for (const name of ["quantity", "taxes", "price"]) {
        expect(cellOf(name, {}).props.disabled).toBe(true);
        expect(cellOf(name, assetRow).props.disabled).toBe(false);
        expect(cellOf(name, itemRow).props.disabled).toBe(false);
        expect(
          cellOf(name, { sales_order_item: { id: 1 } }).props.disabled,
        ).toBe(false);
      }
      expect(columnOf("taxes").required).toBe(true);
    });

    it("net_amount, dpp_amount, dan tax_amount menjumlah semua baris items", () => {
      formPageState = makeFormPageState({
        data: {
          items: [
            {
              tax: { id: "tax-ppn" },
              basic_amount: 1000,
              discount_amount: 100,
              dpp_amount: 825,
              tax_amount: 99,
            },
            {
              tax: { id: "tax-ppn" },
              asset_id: "A1",
              basic_amount: 500,
              discount_amount: 0,
              dpp_amount: 458.33,
              tax_amount: 55,
            },
          ],
        },
      });
      render(<Form />);

      // net = (1000-100) + 500 = 1400; dpp = 825 + 458.33 = 1283.33; tax = 99 + 55 = 154
      expect(screen.getAllByDisplayValue("1400").length).toBeGreaterThan(0);
      expect(screen.getAllByDisplayValue("1283.33").length).toBeGreaterThan(0);
      expect(screen.getAllByDisplayValue("154").length).toBeGreaterThan(0);
    });

    it("mapItem mengalokasikan diskon pro-rata ke semua baris (baris asset ikut memikul)", () => {
      const ppn = { id: "tax-ppn", rate: 11 };
      const items = [
        { id: 1, quantity: 1, price: 1000, tax: ppn },
        { id: 2, quantity: 1, price: 1000, tax: ppn },
        { id: 3, asset_id: "A1", quantity: 1, price: 2000, tax: ppn },
        { id: 4, asset_id: "A2", quantity: 1, price: 6000, tax: ppn },
      ];
      formPageState = makeFormPageState({
        data: {
          items,
          discount_on: "net_total",
          discount_rate: 10,
          latestDiscountKey: "discount_rate",
        },
      });
      render(<Form />);

      // basis 10.000, diskon 1.000: baris asset ke-2 (6000) memikul 600
      const result = tableProps(ITEMS_TABLE).mapItem({
        item: items[3],
        dataTable: items,
        index: 3,
      });

      expect(result.discount_amount).toBeCloseTo(600, 2);
      expect(result.dpp_amount).toBeCloseTo(5400 * (11 / 12), 2);
    });

    it("rekalkulasi rental berlaku untuk baris asset di items (SO rent berisi aset)", () => {
      const setData = vi.fn();
      formPageState = makeFormPageState({
        setData,
        data: {
          sales_order: { is_rent: true },
          rental_cutoff_date: "2026-01-31T00:00:00.000Z",
          items: [
            {
              id: 1,
              asset_id: "A1",
              rental_status: "running",
              rental_shipped_date: "2026-01-01T00:00:00.000Z",
              rental_monthly_rate: 3000000,
              price: 0,
            },
          ],
        },
      });
      render(<Form />);

      const updater = setData.mock.calls[setData.mock.calls.length - 1][0];
      const result = updater(formPageState.data);

      expect(result.items[0].rental_duration_days).toBe(31);
      expect(result.items[0].price).toBeCloseTo(3100000, 5);
      expect("asset_items" in result).toBe(false);
    });

    describe("baris SO/retur tidak dipartisi", () => {
      const soPayload = () => ({
        id: 9,
        customer: { id: 1 },
        items: [
          {
            id: 100,
            item_id: "V1",
            asset_id: null,
            item: { id: "V1" },
            unbilled_quantity: 1,
            basic_amount: 10,
            tax_amount: 0,
          },
          {
            id: 101,
            item_id: null,
            asset_id: "A1",
            asset: { id: "A1", name: "Asset A" },
            unbilled_quantity: 1,
            basic_amount: 20,
            tax_amount: 0,
          },
        ],
        payment_schedules: [],
      });

      it("memilih SO memasukkan baris biasa dan ber-asset_id ke satu items", async () => {
        const user = userEvent.setup({ delay: null });
        const setData = vi.fn();
        formPageState = makeFormPageState({ setData, data: { items: [] } });
        globalThis.__linkModelPayloads["sales-order-link"] = soPayload();

        render(<Form />);
        getDataModelMock.mockClear();
        await user.click(screen.getByTestId("sales-order-link"));

        await waitFor(() => expect(setData).toHaveBeenCalledTimes(1));
        expect(getDataModelMock).not.toHaveBeenCalled();

        const selected = setData.mock.calls[0][0]({ items: [] });
        expect(selected.items.map((row) => row.sales_order_item.id)).toEqual([
          100, 101,
        ]);
        expect(selected.items[1].asset_id).toBe("A1");
        expect("asset_items" in selected).toBe(false);
      });

      it("retur invoice memasukkan semua baris ke satu items", async () => {
        const user = userEvent.setup({ delay: null });
        const setData = vi.fn();
        formPageState = makeFormPageState({
          setData,
          data: { items: [], is_return: true },
        });
        globalThis.__linkModelPayloads["sales-invoice-link"] = {
          id: 200,
          sales_order: { id: 9 },
          items: [
            {
              id: 300,
              item_id: "V1",
              asset_id: null,
              item: { id: "V1" },
              price: 1,
            },
            {
              id: 301,
              item_id: null,
              asset_id: "A1",
              asset: { id: "A1" },
              price: 2,
            },
          ],
        };

        render(<Form />);
        getDataModelMock.mockClear();
        await user.click(screen.getByTestId("sales-invoice-link"));
        await waitFor(() => expect(setData).toHaveBeenCalledTimes(1));
        expect(getDataModelMock).not.toHaveBeenCalled();

        const moved = setData.mock.calls[0][0]({ items: [] });

        expect(moved.items.map((row) => row.return_against_item_id)).toEqual([
          300, 301,
        ]);
        expect("asset_items" in moved).toBe(false);
      });
    });
  });

  describe("kontrak lookup (with = relasi, fields = kolom)", () => {
    it("lookup Sales Order meminta items.asset_id sebagai kolom, bukan relasi", () => {
      render(<Form />);

      const props = globalThis.__linkModelProps["sales-order-link"];

      expect(props.with).toContain("items.asset");
      expect(props.with).not.toContain("items.asset_id");
      expect(props.fields).toContain("items.asset_id");
    });

    it("tidak ada lookup yang memakai nama kolom *_id sebagai relasi di with", () => {
      render(<Form />);

      const columnLikeRelations = Object.entries(globalThis.__linkModelProps)
        .flatMap(([testId, props]) =>
          (props.with ?? []).map((path) => [testId, path]),
        )
        .filter(([, path]) => path.split(".").pop().endsWith("_id"));

      expect(columnLikeRelations).toEqual([]);
    });
  });

  describe("tampilan DPP mengikuti faktor versi aturan pajak baris (Requirement 12.8)", () => {
    const dppColumn = () =>
      formTablePropsSpy.mock.calls
        .at(-1)[0]
        .columns.find((column) => column.name === "dpp_amount");

    it("kolom dan ringkasan DPP disembunyikan bila semua baris tanpa pajak atau berfaktor 1/1", () => {
      formPageState = makeFormPageState({
        data: {
          items: [
            { id: 1, basic_amount: 1000, dpp_amount: 1000, tax: null },
            {
              id: 2,
              basic_amount: 500,
              dpp_amount: 500,
              tax: { id: "tax-flat" },
            },
          ],
        },
      });
      render(<Form />);

      expect(dppColumn().show).toBe(false);
      expect(
        screen.queryByText(/finances\.salesInvoice\.columns\.dpp_amount/),
      ).not.toBeInTheDocument();
    });

    it("sel DPP kosong untuk baris tanpa pajak dan terisi untuk baris berfaktor selain 1/1", () => {
      formPageState = makeFormPageState({
        data: {
          items: [
            { id: 1, basic_amount: 1000, dpp_amount: 1000, tax: null },
            {
              id: 2,
              basic_amount: 1000,
              dpp_amount: 916.67,
              tax: { id: "tax-ppn" },
            },
          ],
        },
      });
      render(<Form />);

      expect(dppColumn().show).toBe(true);
      expect(
        dppColumn().cell({
          data: 1000,
          dataRow: { tax: null },
          attributes: {},
        }),
      ).toBeNull();
      expect(
        dppColumn().cell({
          data: 916.67,
          dataRow: { tax: { id: "tax-ppn" } },
          attributes: {},
        }).props.value,
      ).toBe(916.67);
    });

    it("ringkasan DPP hanya menjumlah baris berfaktor selain 1/1 dan total dikurangi pajak potong", () => {
      formPageState = makeFormPageState({
        data: {
          items: [
            {
              id: 1,
              basic_amount: 1000,
              dpp_amount: 1000,
              tax_amount: 0,
              withholding_amount: 20,
              tax: { id: "tax-pph" },
            },
            {
              id: 2,
              basic_amount: 1200,
              dpp_amount: 1100,
              tax_amount: 121,
              tax: { id: "tax-ppn" },
            },
          ],
        },
      });
      render(<Form />);

      // DPP hanya baris PPN (1100), bukan 1000 baris PPh berfaktor 1/1.
      expect(screen.getAllByDisplayValue("1100").length).toBeGreaterThan(0);
      // total = (1000 + 1200) + 121 - 20 = 2301
      expect(screen.getAllByDisplayValue("2301").length).toBeGreaterThan(0);
      // pemotongan tampil terpisah
      expect(screen.getAllByDisplayValue("20").length).toBeGreaterThan(0);
    });
  });

  describe("banyak pajak per baris (spek finance-multi-tax-per-item, Requirement 10)", () => {
    // Satu baris jasa: PPN 12% (DPP 11/12, kategori PPN) + PPh 23 2% (potong, DPP 1/1).
    const PPN12 = {
      id: "tax-ppn",
      name: "PPN 12%",
      rate: 12,
      category: "ppn_standard",
    };
    const PPH23 = {
      id: "tax-pph",
      name: "PPh 23",
      rate: 2,
      category: "pph_23",
    };
    const MULTI_VERSIONS = [
      {
        id: "ver-ppn12",
        tax_id: "tax-ppn",
        status: "active",
        effective_from: "2000-01-01",
        effective_to: null,
        rate: 12,
        dpp_numerator: 11,
        dpp_denominator: 12,
        behavior: "additive",
      },
      {
        id: "ver-pph23",
        tax_id: "tax-pph",
        status: "active",
        effective_from: "2000-01-01",
        effective_to: null,
        rate: 2,
        dpp_numerator: 1,
        dpp_denominator: 1,
        behavior: "withholding",
      },
    ];
    const serviceLine = {
      id: 1,
      quantity: 1,
      price: 1000000,
      taxes: [PPN12, PPH23],
    };
    const mount = (data = {}) => {
      usePageMock.mockReturnValue({
        props: {
          preferences: { default_currency_id: "idr" },
          taxRuleVersions: MULTI_VERSIONS,
        },
      });
      formPageState = makeFormPageState({ data: { items: [], ...data } });
      render(<Form />);
    };
    const taxColumn = () =>
      tableProps("SalesInvoiceItems").columns.find((c) => c.name === "taxes");

    it("mapItem: PPN 12% (DPP 11/12) + PPh 23 2% potong -> dpp, pajak penambah, dan potongan agregat", () => {
      mount();
      const { mapItem } = tableProps("SalesInvoiceItems");
      const result = mapItem({
        item: serviceLine,
        dataTable: [serviceLine],
        index: 0,
      });

      expect(result.discount_amount).toBe(0);
      // DPP = DPP pajak berkategori PPN (11/12 x 1.000.000).
      expect(result.dpp_amount).toBeCloseTo(1000000 * (11 / 12), 2);
      // Pajak penambah = DPP x 12% = 110.000; PPh 23 = 1.000.000 x 1/1 x 2% = 20.000 (potong).
      expect(result.tax_amount).toBeCloseTo(110000, 2);
      expect(result.withholding_amount).toBeCloseTo(20000, 2);
      expect(result.tax_lines.map((line) => line.name)).toEqual([
        "PPN 12%",
        "PPh 23",
      ]);
    });

    it("mapItem: satu pajak (bentuk lama `tax`) memberi angka identik dengan `taxes` berisi satu pajak", () => {
      mount();
      const { mapItem } = tableProps("SalesInvoiceItems");
      const legacy = { id: 1, quantity: 2, price: 500, tax: PPN12 };
      const multi = { id: 1, quantity: 2, price: 500, taxes: [PPN12] };
      const a = mapItem({ item: legacy, dataTable: [legacy], index: 0 });
      const b = mapItem({ item: multi, dataTable: [multi], index: 0 });

      expect(b.tax_amount).toBe(a.tax_amount);
      expect(b.dpp_amount).toBe(a.dpp_amount);
      expect(b.withholding_amount).toBe(a.withholding_amount);
    });

    it("mapItem: diskon dokumen grand_total memakai jumlah tarif penambah baris", () => {
      mount({
        discount_on: "grand_total",
        discount_rate: 0,
        discount_amount: 100000,
        latestDiscountKey: "discount_amount",
      });
      const { mapItem } = tableProps("SalesInvoiceItems");
      const result = mapItem({
        item: serviceLine,
        dataTable: [serviceLine],
        index: 0,
      });

      // gross = 1.000.000 + 110.000 (PPh potong tidak ikut basis); reduksi = 100.000 / (1 + 0,12).
      expect(result.discount_amount).toBeCloseTo(100000 / 1.12, 2);
    });

    it("kolom pajak: TaxLinkModel multiple menerima array pajak dan menulis taxes + Pajak Utama", () => {
      mount();
      const setRow = vi.fn();
      const cell = taxColumn().cell({
        dataRow: serviceLine,
        data: undefined,
        setData: setRow,
        attributes: { required: true },
      });
      const picker = cell.props.children[0];

      expect(picker.props.multiple).toBe(true);
      expect(picker.props.value).toEqual([PPN12, PPH23]);

      picker.props.onValueChange([PPH23, PPN12]);
      expect(setRow).toHaveBeenCalledWith({
        taxes: [PPH23, PPN12],
        tax: PPH23,
        tax_rate: 2,
      });

      picker.props.onValueChange([]);
      expect(setRow).toHaveBeenLastCalledWith({
        taxes: [],
        tax: null,
        tax_rate: 0,
      });
    });

    it("kolom pajak: baris lama yang hanya punya `tax` tampil sebagai satu chip", () => {
      mount();
      const cell = taxColumn().cell({
        dataRow: { id: 1, tax: PPN12 },
        data: undefined,
        setData: vi.fn(),
        attributes: {},
      });

      expect(cell.props.children[0].props.value).toEqual([PPN12]);
    });

    it("galat server items.N.taxes dan items.N.taxes.M tampil pada sel pajak baris", () => {
      formPageState = makeFormPageState({
        data: { items: [serviceLine] },
        errors: { "items.0.taxes": "Hanya satu PPN." },
      });
      render(<Form />);
      const cell = taxColumn().cell(
        {
          dataRow: serviceLine,
          data: undefined,
          setData: vi.fn(),
          attributes: {},
        },
        0,
      );
      expect(cell.props.children[1].props.message).toBe("Hanya satu PPN.");

      formPageState = makeFormPageState({
        data: { items: [serviceLine] },
        errors: { "items.0.taxes.1": "Pajak tanpa versi aturan." },
      });
      render(<Form />);
      const nested = tableProps("SalesInvoiceItems")
        .columns.find((c) => c.name === "taxes")
        .cell(
          {
            dataRow: serviceLine,
            data: undefined,
            setData: vi.fn(),
            attributes: {},
          },
          0,
        );
      expect(nested.props.children[1].props.message).toBe(
        "Pajak tanpa versi aturan.",
      );
    });

    it("kolom DPP tampil bila salah satu pajak penambah berfaktor selain 1/1 dan nilainya dpp_amount item", () => {
      mount({
        items: [{ ...serviceLine, dpp_amount: 916666.67, tax_amount: 110000 }],
      });
      const dpp = tableProps("SalesInvoiceItems").columns.find(
        (c) => c.name === "dpp_amount",
      );

      expect(dpp.show).toBe(true);
      expect(
        dpp.cell({
          data: 916666.67,
          dataRow: serviceLine,
          attributes: {},
        }).props.value,
      ).toBe(916666.67);
    });

    it("kolom DPP tersembunyi bila satu-satunya pajak berfaktor adalah pajak potong", () => {
      mount({
        items: [{ id: 1, quantity: 1, price: 1000, taxes: [PPH23] }],
      });
      const dpp = tableProps("SalesInvoiceItems").columns.find(
        (c) => c.name === "dpp_amount",
      );

      expect(dpp.show).toBe(false);
    });

    it("ringkasan per pajak tampil bila ada lebih dari satu pajak (nama, tarif, jumlah)", () => {
      const { mapItem } = (() => {
        mount();
        return tableProps("SalesInvoiceItems");
      })();
      const row = mapItem({
        item: serviceLine,
        dataTable: [serviceLine],
        index: 0,
      });
      cleanup();
      mount({ items: [row] });

      const rows = screen.getAllByTestId("tax-summary-row");
      expect(rows).toHaveLength(2);
      expect(rows[0]).toHaveTextContent("PPN 12% (12%)");
      expect(rows[1]).toHaveTextContent("PPh 23 (2%)");
      expect(within(rows[0]).getByDisplayValue("110000")).toBeInTheDocument();
    });

    it("memilih baris SO menyalin seluruh pajak baris sumber ke `taxes` (Pajak Utama = pertama)", () => {
      mount({ sales_order: { id: 9 }, items: [{ id: 1 }] });
      const itemCol = tableProps("SalesInvoiceItems").columns.find(
        (c) => c.name === "item",
      );
      const setRow = vi.fn();
      itemCol
        .cell({ dataRow: { id: 1 }, setData: setRow, attributes: {} })
        .props.onValueChange({
          id: 500,
          unbilled_quantity: 1,
          price: 1000,
          taxes: [PPN12, PPH23],
          tax: PPN12,
        });

      expect(setRow).toHaveBeenCalledWith(
        expect.objectContaining({ taxes: [PPN12, PPH23], tax: PPN12 }),
      );
    });

    it("baris SO yang hanya punya `tax` (SO satu pajak) menjadi `taxes` berisi satu pajak", () => {
      mount({ sales_order: { id: 9 }, items: [{ id: 1 }] });
      const itemCol = tableProps("SalesInvoiceItems").columns.find(
        (c) => c.name === "item",
      );
      const setRow = vi.fn();
      itemCol
        .cell({ dataRow: { id: 1 }, setData: setRow, attributes: {} })
        .props.onValueChange({ id: 500, tax: PPN12 });

      expect(setRow).toHaveBeenCalledWith(
        expect.objectContaining({ taxes: [PPN12], tax: PPN12 }),
      );
    });
  });
});
