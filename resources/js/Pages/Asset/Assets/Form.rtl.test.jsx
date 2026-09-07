import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { TooltipProvider } from "@/Components/ui/tooltip";
import userEvent from "@testing-library/user-event";

// Form.jsx (Asset/Assets) adalah form master data Asset (aset tetap
// perusahaan). Logic UNIK yang jadi fokus test ini (bukan komponen anak yang
// sudah ada test sendiri):
// - Computed value: total_asset_cost (Input disabled) = gross_purchase_amount
//   + additional_asset_cost, dihitung ulang tiap render (bukan tersimpan di
//   data).
// - Conditional visibility: ownership_supplier hanya muncul saat
//   ownership_type === "supplier"; ownership_customer hanya saat
//   ownership_type === "customer"; keduanya required=true saat tampil.
// - Conditional visibility: 4 field depresiasi (depreciation_method,
//   frequency_of_depreciation, total_number_of_depreciations,
//   expected_value_after_useful_life) hanya muncul saat
//   calculate_depreciation checkbox true.
// - Default value non-persisted: asset_type default "existing_asset",
//   ownership_type default "company", asset_quantity default 1 -- ini
//   FALLBACK tampilan (?? di JSX), bukan disetel ke data oleh Form sendiri.
// - asset_type & item selalu disabled (readonly fields, di-set oleh backend).
//
// Semua komponen anak yang sudah punya test sendiri di-stub: FormInput,
// Select, NumberInput, DatetimePicker, dan semua *LinkModel
// (AssetCategoryLinkModel, AssetLocationLinkModel, CustomerLinkModel,
// ItemLinkModel, SupplierLinkModel, UserLinkModel), serta
// FormPageContent/useFormPage (dari @/Pages/Core/FormPage). FormCheckbox
// (ui/checkbox) TIDAK distub -- simple wrapper yang hanya bergantung pada
// useFormPage (sudah dimock), dan justru lewat dia-lah interaksi checkbox
// calculate_depreciation / insurance_comprehensive diuji. Input (ui/input)
// juga TIDAK distub -- dipakai langsung utk asset_name dan total_asset_cost
// (computed display). DatetimePicker WAJIB distub -- versi asli manggil
// usePage() (butuh Inertia context yang tidak di-provide test ini).

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

vi.mock("@/Components/DatetimePicker", () => ({
  default: ({ value, onValueChange }) => (
    <input
      data-testid="datetime-picker"
      type="text"
      value={value ?? ""}
      onChange={(e) => onValueChange?.(e.target.value)}
    />
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

// onValueChange mengirim number (bukan string mentah e.target.value) supaya
// perhitungan total_asset_cost (penjumlahan) di Form.jsx tidak jadi
// concatenation string -- ini menyerupai kontrak NumberInput asli yang
// mengirim value numerik lewat onValueChange.
vi.mock("@/Components/NumberInput", () => ({
  default: ({ value, onValueChange, decimalScale }) => (
    <input
      data-testid="number-input"
      data-decimal-scale={decimalScale}
      value={value ?? ""}
      onChange={(e) => {
        const raw = e.target.value;
        onValueChange?.(raw === "" ? "" : Number(raw));
      }}
    />
  ),
}));

// Semua LinkModel di-stub sederhana: menampilkan value (via label field yang
// relevan) dan tombol untuk memicu onValueChange dengan objek dummy.
function makeLinkModelStub(testId, labelField, dummyValue) {
  return {
    default: ({ value, onValueChange, disabled }) => (
      <div data-testid={testId} data-disabled={disabled ? "true" : "false"}>
        <input
          data-testid={`${testId}-input`}
          value={value?.[labelField] ?? ""}
          readOnly
        />
        <button type="button" onClick={() => onValueChange?.(dummyValue)}>
          pilih-{testId}
        </button>
        <button type="button" onClick={() => onValueChange?.(null)}>
          clear-{testId}
        </button>
      </div>
    ),
  };
}

vi.mock("@/Pages/Asset/Categories/AssetCategoryLinkModel", () =>
  makeLinkModelStub("asset-category-link", "name", {
    id: 1,
    name: "Elektronik",
  }),
);
vi.mock("@/Pages/Asset/Locations/AssetLocationLinkModel", () =>
  makeLinkModelStub("asset-location-link", "name", {
    id: 2,
    name: "Gudang A",
  }),
);
vi.mock("@/Pages/Sales/Customers/CustomerLinkModel", () =>
  makeLinkModelStub("customer-link", "name", { id: 3, name: "PT Pelanggan" }),
);
vi.mock("@/Pages/Inventory/Items/ItemLinkModel", () =>
  makeLinkModelStub("item-link", "name", { id: 4, name: "Laptop" }),
);
vi.mock("@/Pages/Purchase/Suppliers/SupplierLinkModel", () =>
  makeLinkModelStub("supplier-link", "name", { id: 5, name: "CV Pemasok" }),
);
vi.mock("@/Pages/Users/ManageUsers/UserLinkModel", () =>
  makeLinkModelStub("user-link", "name", { id: 6, name: "Budi" }),
);

window.route = (name, params) =>
  params !== undefined ? `${name}/${JSON.stringify(params)}` : name;

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
 * computed value & conditional visibility bisa diverifikasi lewat re-render.
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

describe("Form (Asset/Assets)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("identity section: field dasar", () => {
    it("mengetik asset_name memanggil setData dan merefleksikan value baru", async () => {
      const user = userEvent.setup({ delay: null });
      renderForm({ initialData: { asset_name: "" } });

      const wrapper = screen.getByTestId("forminput-asset_name");
      const input = within(wrapper).getByRole("textbox");
      await user.type(input, "Laptop Dell");

      expect(input).toHaveValue("Laptop Dell");
    });

    it("asset_name, asset_category, asset_location required=true", () => {
      renderForm({ initialData: {} });

      expect(screen.getByTestId("forminput-asset_name")).toHaveAttribute(
        "data-required",
        "true",
      );
      expect(screen.getByTestId("forminput-asset_category")).toHaveAttribute(
        "data-required",
        "true",
      );
      expect(screen.getByTestId("forminput-asset_location")).toHaveAttribute(
        "data-required",
        "true",
      );
    });

    it("memilih asset_category via AssetCategoryLinkModel memanggil setData", async () => {
      const user = userEvent.setup({ delay: null });
      renderForm({ initialData: {} });

      await user.click(screen.getByText("pilih-asset-category-link"));

      expect(screen.getByTestId("asset-category-link-input")).toHaveValue(
        "Elektronik",
      );
    });

    it("memilih asset_location via AssetLocationLinkModel memanggil setData", async () => {
      const user = userEvent.setup({ delay: null });
      renderForm({ initialData: {} });

      await user.click(screen.getByText("pilih-asset-location-link"));

      expect(screen.getByTestId("asset-location-link-input")).toHaveValue(
        "Gudang A",
      );
    });

    it("asset_type default 'existing_asset' saat data kosong, dan selalu disabled", () => {
      renderForm({ initialData: {} });

      const wrapper = screen.getByTestId("forminput-asset_type");
      const select = within(wrapper).getByTestId("select");
      expect(select).toHaveValue("existing_asset");
      expect(select).toBeDisabled();
    });

    it("item LinkModel selalu disabled", () => {
      renderForm({ initialData: {} });

      expect(screen.getByTestId("item-link")).toHaveAttribute(
        "data-disabled",
        "true",
      );
    });

    it("asset_quantity default 1 saat data kosong", () => {
      renderForm({ initialData: {} });

      const wrapper = screen.getByTestId("forminput-asset_quantity");
      const numberInput = within(wrapper).getByTestId("number-input");
      expect(numberInput).toHaveValue("1");
      expect(numberInput).toHaveAttribute("data-decimal-scale", "0");
    });

    it("asset_quantity terisi menampilkan value dari data (bukan default)", () => {
      renderForm({ initialData: { asset_quantity: 5 } });

      const wrapper = screen.getByTestId("forminput-asset_quantity");
      const numberInput = within(wrapper).getByTestId("number-input");
      expect(numberInput).toHaveValue("5");
    });

    it("memilih custodian via UserLinkModel memanggil setData", async () => {
      const user = userEvent.setup({ delay: null });
      renderForm({ initialData: {} });

      await user.click(screen.getByText("pilih-user-link"));

      expect(screen.getByTestId("user-link-input")).toHaveValue("Budi");
    });
  });

  describe("ownership section: conditional field berdasar ownership_type", () => {
    it("ownership_type default 'company' saat data kosong", () => {
      renderForm({ initialData: {} });

      const wrapper = screen.getByTestId("forminput-ownership_type");
      const select = within(wrapper).getByTestId("select");
      expect(select).toHaveValue("company");
    });

    it("ownership_type='company': ownership_supplier dan ownership_customer TIDAK dirender", () => {
      renderForm({ initialData: { ownership_type: "company" } });

      expect(
        screen.queryByTestId("forminput-ownership_supplier"),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByTestId("forminput-ownership_customer"),
      ).not.toBeInTheDocument();
    });

    it("ownership_type='supplier': ownership_supplier dirender (required), ownership_customer tidak", () => {
      renderForm({ initialData: { ownership_type: "supplier" } });

      const supplierWrapper = screen.getByTestId(
        "forminput-ownership_supplier",
      );
      expect(supplierWrapper).toHaveAttribute("data-required", "true");
      expect(screen.getByTestId("supplier-link")).toBeInTheDocument();
      expect(
        screen.queryByTestId("forminput-ownership_customer"),
      ).not.toBeInTheDocument();
    });

    it("ownership_type='customer': ownership_customer dirender (required), ownership_supplier tidak", () => {
      renderForm({ initialData: { ownership_type: "customer" } });

      const customerWrapper = screen.getByTestId(
        "forminput-ownership_customer",
      );
      expect(customerWrapper).toHaveAttribute("data-required", "true");
      expect(screen.getByTestId("customer-link")).toBeInTheDocument();
      expect(
        screen.queryByTestId("forminput-ownership_supplier"),
      ).not.toBeInTheDocument();
    });

    it("mengubah ownership_type dari 'supplier' ke 'customer' menukar field yang dirender", async () => {
      const user = userEvent.setup({ delay: null });
      renderForm({ initialData: { ownership_type: "supplier" } });

      expect(screen.getByTestId("supplier-link")).toBeInTheDocument();

      const wrapper = screen.getByTestId("forminput-ownership_type");
      const select = within(wrapper).getByTestId("select");
      await user.selectOptions(select, "customer");

      expect(screen.queryByTestId("supplier-link")).not.toBeInTheDocument();
      expect(screen.getByTestId("customer-link")).toBeInTheDocument();
    });

    it("memilih ownership_supplier via SupplierLinkModel memanggil setData", async () => {
      const user = userEvent.setup({ delay: null });
      renderForm({ initialData: { ownership_type: "supplier" } });

      await user.click(screen.getByText("pilih-supplier-link"));

      expect(screen.getByTestId("supplier-link-input")).toHaveValue(
        "CV Pemasok",
      );
    });

    it("memilih ownership_customer via CustomerLinkModel memanggil setData", async () => {
      const user = userEvent.setup({ delay: null });
      renderForm({ initialData: { ownership_type: "customer" } });

      await user.click(screen.getByText("pilih-customer-link"));

      expect(screen.getByTestId("customer-link-input")).toHaveValue(
        "PT Pelanggan",
      );
    });
  });

  describe("purchase section: computed total_asset_cost", () => {
    it("total_asset_cost = gross_purchase_amount + additional_asset_cost, keduanya kosong -> 0", () => {
      renderForm({ initialData: {} });

      const wrapper = screen.getByTestId("forminput-total_asset_cost");
      const input = within(wrapper).getByDisplayValue("0");
      expect(input).toBeInTheDocument();
      expect(input).toBeDisabled();
    });

    it("total_asset_cost terhitung benar dari nilai data awal", () => {
      renderForm({
        initialData: {
          gross_purchase_amount: 1000000,
          additional_asset_cost: 50000,
        },
      });

      const wrapper = screen.getByTestId("forminput-total_asset_cost");
      expect(within(wrapper).getByDisplayValue("1050000")).toBeInTheDocument();
    });

    it("mengubah gross_purchase_amount memperbarui total_asset_cost secara reaktif", async () => {
      const user = userEvent.setup({ delay: null });
      renderForm({
        initialData: { gross_purchase_amount: 0, additional_asset_cost: 100 },
      });

      const grossWrapper = screen.getByTestId(
        "forminput-gross_purchase_amount",
      );
      const grossInput = within(grossWrapper).getByTestId("number-input");
      await user.clear(grossInput);
      await user.type(grossInput, "900");

      const totalWrapper = screen.getByTestId("forminput-total_asset_cost");
      expect(
        within(totalWrapper).getByDisplayValue("1000"),
      ).toBeInTheDocument();
    });

    it("mengubah additional_asset_cost memperbarui total_asset_cost secara reaktif", async () => {
      const user = userEvent.setup({ delay: null });
      renderForm({
        initialData: { gross_purchase_amount: 500, additional_asset_cost: 0 },
      });

      const additionalWrapper = screen.getByTestId(
        "forminput-additional_asset_cost",
      );
      const additionalInput =
        within(additionalWrapper).getByTestId("number-input");
      await user.clear(additionalInput);
      await user.type(additionalInput, "250");

      const totalWrapper = screen.getByTestId("forminput-total_asset_cost");
      expect(within(totalWrapper).getByDisplayValue("750")).toBeInTheDocument();
    });
  });

  describe("purchase section: calculate_depreciation checkbox & field kondisional", () => {
    it("calculate_depreciation default unchecked, field depresiasi tidak dirender", () => {
      renderForm({ initialData: {} });

      // 2 checkbox forminput selalu dirender: calculate_depreciation
      // (section purchase, index 0) lalu insurance_comprehensive (section
      // insurance, index 1).
      const checkbox = screen.getAllByRole("forminput")[0];
      expect(checkbox).toHaveAttribute("data-state", "unchecked");
      expect(
        screen.queryByTestId("forminput-depreciation_method"),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByTestId("forminput-frequency_of_depreciation"),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByTestId("forminput-total_number_of_depreciations"),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByTestId("forminput-expected_value_after_useful_life"),
      ).not.toBeInTheDocument();
    });

    it("mencentang calculate_depreciation menampilkan ke-4 field depresiasi", async () => {
      const user = userEvent.setup({ delay: null });
      renderForm({ initialData: { calculate_depreciation: false } });

      const checkbox = screen.getAllByRole("forminput")[0];
      await user.click(checkbox);

      expect(checkbox).toHaveAttribute("data-state", "checked");
      expect(
        screen.getByTestId("forminput-depreciation_method"),
      ).toBeInTheDocument();
      expect(
        screen.getByTestId("forminput-frequency_of_depreciation"),
      ).toBeInTheDocument();
      expect(
        screen.getByTestId("forminput-total_number_of_depreciations"),
      ).toBeInTheDocument();
      expect(
        screen.getByTestId("forminput-expected_value_after_useful_life"),
      ).toBeInTheDocument();
    });

    it("calculate_depreciation=true sejak awal: field depresiasi langsung dirender", () => {
      renderForm({ initialData: { calculate_depreciation: true } });

      expect(
        screen.getByTestId("forminput-depreciation_method"),
      ).toBeInTheDocument();
    });

    it("depreciation_method Select berisi 4 opsi metode depresiasi", () => {
      renderForm({ initialData: { calculate_depreciation: true } });

      const wrapper = screen.getByTestId("forminput-depreciation_method");
      const select = within(wrapper).getByTestId("select");
      expect(within(select).getByText("opt:straight_line")).toBeInTheDocument();
      expect(
        within(select).getByText("opt:double_declining_balance"),
      ).toBeInTheDocument();
      expect(
        within(select).getByText("opt:written_down_value"),
      ).toBeInTheDocument();
      expect(within(select).getByText("opt:manual")).toBeInTheDocument();
    });

    it("mengubah frequency_of_depreciation memanggil setData dan merefleksikan value baru", async () => {
      const user = userEvent.setup({ delay: null });
      renderForm({
        initialData: {
          calculate_depreciation: true,
          frequency_of_depreciation: "",
        },
      });

      const wrapper = screen.getByTestId("forminput-frequency_of_depreciation");
      const numberInput = within(wrapper).getByTestId("number-input");
      await user.type(numberInput, "12");

      expect(numberInput).toHaveValue("12");
    });

    it("expected_value_after_useful_life default 0 saat calculate_depreciation true tapi belum diisi", () => {
      renderForm({ initialData: { calculate_depreciation: true } });

      const wrapper = screen.getByTestId(
        "forminput-expected_value_after_useful_life",
      );
      const numberInput = within(wrapper).getByTestId("number-input");
      expect(numberInput).toHaveValue("0");
    });
  });

  describe("insurance section", () => {
    it("mengetik insurance_policy_number memanggil setData dan merefleksikan value baru", async () => {
      const user = userEvent.setup({ delay: null });
      renderForm({ initialData: { insurance_policy_number: "" } });

      const wrapper = screen.getByTestId("forminput-insurance_policy_number");
      const input = within(wrapper).getByRole("textbox");
      await user.type(input, "POL-001");

      expect(input).toHaveValue("POL-001");
    });

    it("mengetik insurance_insurer memanggil setData dan merefleksikan value baru", async () => {
      const user = userEvent.setup({ delay: null });
      renderForm({ initialData: { insurance_insurer: "" } });

      const wrapper = screen.getByTestId("forminput-insurance_insurer");
      const input = within(wrapper).getByRole("textbox");
      await user.type(input, "Askrindo");

      expect(input).toHaveValue("Askrindo");
    });

    it("insurance_comprehensive checkbox toggle via setData", async () => {
      const user = userEvent.setup({ delay: null });
      renderForm({ initialData: { insurance_comprehensive: false } });

      // Ada 1 checkbox forminput lain (calculate_depreciation) yang dirender
      // lebih dulu di section purchase; ambil checkbox terakhir untuk
      // insurance_comprehensive.
      const checkboxes = screen.getAllByRole("forminput");
      const insuranceCheckbox = checkboxes[checkboxes.length - 1];
      expect(insuranceCheckbox).toHaveAttribute("data-state", "unchecked");

      await user.click(insuranceCheckbox);

      expect(insuranceCheckbox).toHaveAttribute("data-state", "checked");
    });

    it("mengubah insurance_insured_value memanggil setData dan merefleksikan value baru", async () => {
      const user = userEvent.setup({ delay: null });
      renderForm({ initialData: { insurance_insured_value: "" } });

      const wrapper = screen.getByTestId("forminput-insurance_insured_value");
      const numberInput = within(wrapper).getByTestId("number-input");
      await user.type(numberInput, "5000000");

      expect(numberInput).toHaveValue("5000000");
    });
  });
});
