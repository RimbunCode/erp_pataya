import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { TooltipProvider } from "@/Components/ui/tooltip";
import userEvent from "@testing-library/user-event";

// Form.jsx (Finances/Accounts) adalah form master data Account (chart of
// accounts hierarkis). Logic UNIK yang jadi fokus test ini (bukan komponen
// anak yang sudah ada test sendiri):
// - Cascade: pilih parent_account (AccountLinkModel) meng-set root_type,
//   report_type, balance_type sekaligus dari field parent yang dipilih.
// - Filter AccountLinkModel: is_group=true & id.not=data.id (parent harus
//   grup, dan tidak bisa memilih diri sendiri sebagai parent).
// - accountTypes[data.root_type] -- opsi Select account_type berubah sesuai
//   root_type terpilih (asset/liability/equity/income/expense).
// - Gating readOnly/disabled berdasar data.have_transactions & data.is_group:
//   parent_account & account_type readOnly saat have_transactions=true;
//   is_group checkbox disabled saat have_transactions=true;
//   account_type FormInput disabled saat is_group=true.
// - root_type/report_type ditampilkan sbg Input disabled, teks dari t() atau
//   string kosong bila belum ada value.
// - tax_rate (NumberInput) hanya dirender saat account_type === "tax".
//
// Semua komponen anak yang sudah punya test sendiri di-stub: FormInput,
// Select, NumberInput, AccountLinkModel, dan FormPageContent/useFormPage
// (dari @/Pages/Core/FormPage). FormCheckbox (ui/checkbox) TIDAK distub --
// dia simple wrapper yang hanya bergantung pada useFormPage (sudah dimock),
// dan justru lewat dia-lah interaksi checkbox is_group/is_disabled diuji.
// Input (ui/input) juga TIDAK distub -- dipakai langsung utk account_number,
// account_name, root_type (disabled display), report_type (disabled display).

const stableT = (key) => key;
vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({ t: stableT }),
}));

// useFormPage dipakai Form.jsx sendiri (data/setData) DAN FormCheckbox
// (ui/checkbox, untuk `disabled`). Diimplementasikan via React Context asli
// (bukan vi.fn statis) supaya reaktif terhadap setData di dalam test.
import React, { createContext, useContext, useState } from "react";
const FakeFormPageContext = createContext();
vi.mock("@/Pages/Core/FormPage", () => ({
  useFormPage: (...args) => {
    const ctx = useContext(FakeFormPageContext);
    return typeof ctx === "function" ? ctx(...args) : ctx;
  },
  FormPageContent: ({ title, children }) => (
    <section aria-label={title}>{children}</section>
  ),
}));

vi.mock("@/Components/FormInput", () => ({
  default: ({ label, name, required, readOnly, disabled, error, children }) => (
    <div
      data-testid={`forminput-${name ?? label ?? ""}`}
      data-required={required ? "true" : "false"}
      data-readonly={readOnly ? "true" : "false"}
      data-disabled={disabled ? "true" : "false"}
    >
      <label>{label}</label>
      {error ? <span data-testid="forminput-error">{error}</span> : null}
      {children}
    </div>
  ),
}));

// Prefix "opt:" pada text option supaya gampang dibedakan dari teks lain.
vi.mock("@/Components/Select", () => ({
  default: ({ value, onValueChange, options, disabled }) => (
    <select
      data-testid="select"
      disabled={disabled}
      value={value ?? ""}
      onChange={(e) => onValueChange?.(e.target.value)}
    >
      <option value="" />
      {(options ?? []).map((opt) =>
        typeof opt === "string" ? (
          <option key={opt} value={opt}>
            opt:{opt}
          </option>
        ) : (
          <option key={opt.value} value={opt.value}>
            opt:{opt.label}
          </option>
        ),
      )}
    </select>
  ),
}));

vi.mock("@/Components/NumberInput", () => ({
  default: ({ value, onValueChange, suffix }) => (
    <input
      data-testid="number-input-tax_rate"
      data-suffix={suffix}
      value={value ?? ""}
      onChange={(e) => onValueChange?.(e.target.value)}
    />
  ),
}));

// AccountLinkModel dipakai utk parent_account. Stub sederhana yang tetap
// meneruskan value/onValueChange/filters/disabledAddButton supaya bisa
// diverifikasi lewat data-* attribute (filters di-JSON.stringify).
vi.mock("./AccountLinkModel", () => ({
  default: ({
    value,
    onValueChange,
    filters,
    disabledAddButton,
    placeholder,
  }) => (
    <div>
      <input
        data-testid="account-link-model"
        data-filters={JSON.stringify(filters)}
        data-disabled-add-button={disabledAddButton ? "true" : "false"}
        placeholder={placeholder}
        value={value?.account_name ?? ""}
        readOnly
      />
      <button
        type="button"
        onClick={() =>
          onValueChange?.({
            id: 99,
            account_name: "Kas Induk",
            root_type: "asset",
            report_type: "balance_sheet",
            balance_type: "debit",
          })
        }
      >
        pilih-parent
      </button>
      <button type="button" onClick={() => onValueChange?.(null)}>
        clear-parent
      </button>
    </div>
  ),
}));

window.route = (name, params) =>
  params ? `${name}/${JSON.stringify(params)}` : name;

import Form from "./Form";

function FormPageProviderFake({ value, children }) {
  return (
    <FakeFormPageContext.Provider value={value}>
      {children}
    </FakeFormPageContext.Provider>
  );
}

/**
 * Render Form dengan state data terkelola (setData asli, reaktif) supaya
 * cascade parent_account -> root_type/report_type/balance_type bisa
 * diverifikasi lewat re-render.
 * @param root0
 * @param root0.initialData
 * @param root0.disabled
 */
function renderForm({ initialData = {}, disabled = false } = {}) {
  function Wrapper() {
    const [data, setDataState] = useState(initialData);
    const setData = (key, val) => {
      if (typeof key === "function") {
        setDataState((prev) => key(prev));
      } else if (typeof key === "object") {
        setDataState((prev) => ({ ...prev, ...key }));
      } else {
        setDataState((prev) => ({ ...prev, [key]: val }));
      }
    };
    return (
      <FormPageProviderFake value={{ data, setData, disabled }}>
        <Form />
      </FormPageProviderFake>
    );
  }

  return render(
    <TooltipProvider>
      <Wrapper />
    </TooltipProvider>,
  );
}

describe("Form (Finances/Accounts)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("filter AccountLinkModel (parent_account)", () => {
    it("filters is_group=true dan id.not=data.id (tidak bisa pilih diri sendiri)", () => {
      renderForm({ initialData: { id: 7 } });

      const linkModel = screen.getByTestId("account-link-model");
      const filters = JSON.parse(linkModel.dataset.filters);

      expect(filters).toEqual({
        is_group: true,
        id: { not: 7 },
      });
    });

    it("disabledAddButton selalu true", () => {
      renderForm({ initialData: {} });

      const linkModel = screen.getByTestId("account-link-model");
      expect(linkModel.dataset.disabledAddButton).toBe("true");
    });
  });

  describe("cascade: pilih parent_account meng-set root_type/report_type/balance_type", () => {
    it("klik pilih-parent menyalin root_type, report_type, balance_type dari account terpilih", async () => {
      const user = userEvent.setup({ delay: null });
      renderForm({ initialData: { id: 1 } });

      await user.click(screen.getByText("pilih-parent"));

      // root_type & report_type ditampilkan via Input disabled dengan value
      // hasil t(`...options.${value}`) -- karena t stub adalah identity,
      // valuenya adalah key terjemahan itu sendiri.
      expect(
        screen.getByDisplayValue(
          "finances.account.columns.root_type.options.asset",
        ),
      ).toBeInTheDocument();
      expect(
        screen.getByDisplayValue(
          "finances.account.columns.report_type.options.balance_sheet",
        ),
      ).toBeInTheDocument();

      // balance_type via Select stub -- cari yang berada di forminput
      // balance_type supaya tidak ambigu dgn select account_type.
      const balanceTypeWrapper = screen.getByTestId("forminput-balance_type");
      const selectBalanceType =
        within(balanceTypeWrapper).getByTestId("select");
      expect(selectBalanceType).toHaveValue("debit");
    });

    it("parent_account value ikut ter-set (bukan hanya field turunan)", async () => {
      const user = userEvent.setup({ delay: null });
      renderForm({ initialData: { id: 1 } });

      await user.click(screen.getByText("pilih-parent"));

      expect(screen.getByDisplayValue("Kas Induk")).toBeInTheDocument();
    });

    it("clear parent_account (onValueChange null) mengosongkan root_type/report_type/balance_type", async () => {
      const user = userEvent.setup({ delay: null });
      renderForm({
        initialData: {
          id: 1,
          parent_account: { id: 99, account_name: "Kas Induk" },
          root_type: "asset",
          report_type: "balance_sheet",
          balance_type: "debit",
        },
      });

      await user.click(screen.getByText("clear-parent"));

      // root_type/report_type Input menampilkan string kosong saat falsy.
      const rootTypeWrapper = screen.getByTestId("forminput-root_type");
      const rootTypeInput = within(rootTypeWrapper).getByRole("textbox");
      expect(rootTypeInput).toHaveValue("");

      const reportTypeWrapper = screen.getByTestId("forminput-report_type");
      const reportTypeInput = within(reportTypeWrapper).getByRole("textbox");
      expect(reportTypeInput).toHaveValue("");

      const balanceTypeWrapper = screen.getByTestId("forminput-balance_type");
      const selectBalanceType =
        within(balanceTypeWrapper).getByTestId("select");
      expect(selectBalanceType).toHaveValue("");
    });
  });

  describe("accountTypes[root_type]: opsi account_type dinamis sesuai root_type", () => {
    it("root_type belum ada: opsi account_type kosong", () => {
      renderForm({ initialData: {} });

      const accountTypeWrapper = screen.getByTestId("forminput-account_type");
      const select = within(accountTypeWrapper).getByTestId("select");
      // hanya opsi placeholder kosong
      expect(within(select).getAllByRole("option")).toHaveLength(1);
    });

    it("root_type=asset: opsi account_type berisi daftar tipe asset (mis. bank, cash, fixed_asset)", () => {
      renderForm({ initialData: { root_type: "asset" } });

      const accountTypeWrapper = screen.getByTestId("forminput-account_type");
      const select = within(accountTypeWrapper).getByTestId("select");
      expect(within(select).getByText("opt:bank")).toBeInTheDocument();
      expect(within(select).getByText("opt:cash")).toBeInTheDocument();
      expect(within(select).getByText("opt:fixed_asset")).toBeInTheDocument();
      // opsi khusus liability tidak boleh muncul
      expect(within(select).queryByText("opt:payable")).not.toBeInTheDocument();
    });

    it("root_type=liability: opsi account_type berisi daftar tipe liability (mis. payable)", () => {
      renderForm({ initialData: { root_type: "liability" } });

      const accountTypeWrapper = screen.getByTestId("forminput-account_type");
      const select = within(accountTypeWrapper).getByTestId("select");
      expect(within(select).getByText("opt:payable")).toBeInTheDocument();
      expect(within(select).queryByText("opt:bank")).not.toBeInTheDocument();
    });

    it("root_type=expense: opsi account_type berisi daftar tipe expense (mis. expense_account)", () => {
      renderForm({ initialData: { root_type: "expense" } });

      const accountTypeWrapper = screen.getByTestId("forminput-account_type");
      const select = within(accountTypeWrapper).getByTestId("select");
      expect(
        within(select).getByText("opt:expense_account"),
      ).toBeInTheDocument();
    });
  });

  describe("gating readOnly/disabled berdasar have_transactions & is_group", () => {
    it("have_transactions=true: parent_account & account_type FormInput readOnly, is_group checkbox disabled", () => {
      renderForm({
        initialData: { have_transactions: true, root_type: "asset" },
      });

      expect(screen.getByTestId("forminput-parent_account")).toHaveAttribute(
        "data-readonly",
        "true",
      );
      expect(screen.getByTestId("forminput-account_type")).toHaveAttribute(
        "data-readonly",
        "true",
      );

      const isGroupCheckbox = screen.getAllByRole("forminput")[0];
      expect(isGroupCheckbox).toHaveAttribute("disabled");
    });

    it("have_transactions=false: parent_account & account_type FormInput TIDAK readOnly, is_group checkbox TIDAK disabled", () => {
      renderForm({
        initialData: { have_transactions: false, root_type: "asset" },
      });

      expect(screen.getByTestId("forminput-parent_account")).toHaveAttribute(
        "data-readonly",
        "false",
      );
      expect(screen.getByTestId("forminput-account_type")).toHaveAttribute(
        "data-readonly",
        "false",
      );

      const isGroupCheckbox = screen.getAllByRole("forminput")[0];
      expect(isGroupCheckbox).not.toHaveAttribute("disabled");
    });

    it("is_group=true: FormInput account_type disabled", () => {
      renderForm({ initialData: { is_group: true } });

      expect(screen.getByTestId("forminput-account_type")).toHaveAttribute(
        "data-disabled",
        "true",
      );
    });

    it("is_group=false: FormInput account_type TIDAK disabled", () => {
      renderForm({ initialData: { is_group: false } });

      expect(screen.getByTestId("forminput-account_type")).toHaveAttribute(
        "data-disabled",
        "false",
      );
    });
  });

  describe("checkbox is_group & is_disabled: toggle via setData", () => {
    it("mencentang is_group meng-set data.is_group=true (checkbox jadi checked)", async () => {
      const user = userEvent.setup({ delay: null });
      renderForm({ initialData: { is_group: false } });

      const checkboxes = screen.getAllByRole("forminput");
      // urutan render: is_group lalu is_disabled
      const isGroupCheckbox = checkboxes[0];
      expect(isGroupCheckbox).toHaveAttribute("data-state", "unchecked");

      await user.click(isGroupCheckbox);

      expect(isGroupCheckbox).toHaveAttribute("data-state", "checked");
    });

    it("mencentang is_disabled meng-set data.is_disabled=true (checkbox jadi checked)", async () => {
      const user = userEvent.setup({ delay: null });
      renderForm({ initialData: { is_disabled: false } });

      const checkboxes = screen.getAllByRole("forminput");
      const isDisabledCheckbox = checkboxes[1];
      expect(isDisabledCheckbox).toHaveAttribute("data-state", "unchecked");

      await user.click(isDisabledCheckbox);

      expect(isDisabledCheckbox).toHaveAttribute("data-state", "checked");
    });
  });

  describe("root_type / report_type: display Input disabled dengan terjemahan", () => {
    it("root_type kosong: Input menampilkan string kosong", () => {
      renderForm({ initialData: {} });

      const rootTypeWrapper = screen.getByTestId("forminput-root_type");
      const input = within(rootTypeWrapper).getByRole("textbox");
      expect(input).toHaveValue("");
    });

    it("root_type terisi: Input menampilkan hasil t() dengan key sesuai root_type", () => {
      renderForm({ initialData: { root_type: "income" } });

      const rootTypeWrapper = screen.getByTestId("forminput-root_type");
      const input = within(rootTypeWrapper).getByRole("textbox");
      expect(input).toHaveValue(
        "finances.account.columns.root_type.options.income",
      );
    });

    it("report_type terisi: Input menampilkan hasil t() dengan key sesuai report_type", () => {
      renderForm({ initialData: { report_type: "profit_and_loss" } });

      const reportTypeWrapper = screen.getByTestId("forminput-report_type");
      const input = within(reportTypeWrapper).getByRole("textbox");
      expect(input).toHaveValue(
        "finances.account.columns.report_type.options.profit_and_loss",
      );
    });
  });

  describe("tax_rate: field conditional berdasar account_type", () => {
    it("account_type != 'tax': field tax_rate TIDAK dirender", () => {
      renderForm({ initialData: { account_type: "bank" } });

      expect(
        screen.queryByTestId("forminput-tax_rate"),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByTestId("number-input-tax_rate"),
      ).not.toBeInTheDocument();
    });

    it("account_type == 'tax': field tax_rate dirender dengan suffix '%'", () => {
      renderForm({ initialData: { account_type: "tax" } });

      expect(screen.getByTestId("forminput-tax_rate")).toBeInTheDocument();
      const numberInput = screen.getByTestId("number-input-tax_rate");
      expect(numberInput).toHaveAttribute("data-suffix", "%");
    });

    it("mengubah nilai tax_rate memanggil setData('tax_rate', val)", async () => {
      const user = userEvent.setup({ delay: null });
      renderForm({ initialData: { account_type: "tax", tax_rate: "" } });

      const numberInput = screen.getByTestId("number-input-tax_rate");
      await user.type(numberInput, "5");

      expect(numberInput).toHaveValue("5");
    });
  });

  describe("input account_number & account_name", () => {
    it("mengetik account_number memanggil setData dan merefleksikan value baru", async () => {
      const user = userEvent.setup({ delay: null });
      renderForm({ initialData: { account_number: "" } });

      const wrapper = screen.getByTestId("forminput-account_number");
      const input = within(wrapper).getByRole("textbox");
      await user.type(input, "100");

      expect(input).toHaveValue("100");
    });

    it("mengetik account_name memanggil setData dan merefleksikan value baru", async () => {
      const user = userEvent.setup({ delay: null });
      renderForm({ initialData: { account_name: "" } });

      const wrapper = screen.getByTestId("forminput-account_name");
      const input = within(wrapper).getByRole("textbox");
      await user.type(input, "Kas");

      expect(input).toHaveValue("Kas");
    });
  });
});
