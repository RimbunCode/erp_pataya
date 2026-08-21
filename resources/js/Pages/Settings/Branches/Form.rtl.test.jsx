import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { TooltipProvider } from "@/Components/ui/tooltip";
import userEvent from "@testing-library/user-event";

// Form.jsx (Settings/Branches) adalah halaman form master data Branch (cabang
// perusahaan). Logic UNIK yang jadi fokus test ini (bukan komponen anak yang
// sudah ada test sendiri):
// - Judul section address berubah "address" <-> "shipping_address" tergantung
//   data?.branchable_type (branch biasa vs branch milik entitas lain, mis.
//   supplier/customer)
// - Section billing_address hanya dirender jika data?.branchable_type truthy
// - Field billing_street/city/state/zip/country hanya dirender jika
//   data?.billing_address === "separate"
// - Binding controlled input code/name/is_disabled/shipping_* langsung ke
//   data/setData dari useFormPage
//
// Semua komponen anak yang sudah punya test sendiri di-stub: FormInput,
// Select, CountryLinkModel (wrapper tipis di atas LinkModel yang sudah
// punya test sendiri). FormCheckbox (ui/checkbox) TIDAK distub -- dia simple
// wrapper yang hanya bergantung pada useFormPage (sudah dimock via context
// fake), dan justru lewat dia-lah interaksi checkbox is_disabled diuji.

const stableT = (key) => key;
vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({ t: stableT }),
}));

// useFormPage diimplementasikan via React Context asli (bukan vi.fn statis)
// supaya reaktif terhadap setData di dalam test -- mengikuti pola wajib untuk
// komponen memo() dengan useFormPage dari Context (lihat
// Users/ManageUsers/Form.rtl.test.jsx). FormPageContent/FormPageContentTitle
// distub jadi elemen sederhana yang tetap merender children & title supaya
// bisa diverifikasi lewat teks.
import React, { createContext, useContext, useState } from "react";
const FakeFormPageContext = createContext();
vi.mock("@/Pages/Core/FormPage", () => ({
  useFormPage: (...args) => {
    const ctx = useContext(FakeFormPageContext);
    return typeof ctx === "function" ? ctx(...args) : ctx;
  },
  FormPageContent: ({ title, children }) => (
    <section aria-label={title}>
      <h2>{title}</h2>
      {children}
    </section>
  ),
  FormPageContentTitle: ({ children, className }) => (
    <div className={className}>{children}</div>
  ),
}));

vi.mock("@/Components/FormInput", () => ({
  default: ({ label, name, children }) => (
    <div data-testid={`forminput-${name ?? label ?? ""}`}>
      <label>{label}</label>
      {children}
    </div>
  ),
}));

vi.mock("@/Components/Select", () => ({
  // Prefix "opt:" pada text option supaya tidak bentrok dengan getByText di
  // luar <select>.
  default: ({ value, onValueChange, options, placeholder }) => (
    <select
      data-testid="select-billing_address"
      aria-label={placeholder}
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

vi.mock("@/Pages/Core/CountryLinkModel", () => ({
  // CountryLinkModel adalah wrapper tipis di atas LinkModel (sudah punya test
  // sendiri) -- distub sebagai input teks sederhana yang mengoper value/
  // onValueChange, dibedakan lewat data-testid dari placeholder unik yang
  // dioper Form.jsx (shipping vs billing sama-sama pakai
  // "core.branch.columns.country.placeholder", jadi differensiasi sebenarnya
  // dilakukan lewat FormInput pembungkus via within()).
  default: ({ value, onValueChange, placeholder }) => (
    <input
      data-testid="country-link-model"
      aria-label={placeholder}
      value={value ?? ""}
      onChange={(e) => onValueChange?.(e.target.value)}
    />
  ),
}));

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
 * interaksi checkbox/select/conditional rendering bisa diverifikasi lewat
 * re-render.
 */
function renderForm({ initialData = {} } = {}) {
  function Wrapper() {
    const [data, setDataState] = useState(initialData);
    const setData = (key, val) => {
      if (typeof key === "object") {
        setDataState((prev) => ({ ...prev, ...key }));
      } else {
        setDataState((prev) => ({ ...prev, [key]: val }));
      }
    };
    return (
      <FormPageProviderFake value={{ data, setData, disabled: false }}>
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

describe("Form (Settings/Branches)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("field detail cabang: code, name, is_disabled", () => {
    it("input code & name terikat ke data.code/data.name", () => {
      renderForm({ initialData: { code: "BR01", name: "Cabang Utama" } });

      expect(screen.getByDisplayValue("BR01")).toBeInTheDocument();
      expect(screen.getByDisplayValue("Cabang Utama")).toBeInTheDocument();
    });

    it("input code & name fallback ke string kosong saat data undefined", () => {
      renderForm({ initialData: {} });

      const codeWrapper = screen.getByTestId("forminput-code");
      const nameWrapper = screen.getByTestId("forminput-name");
      expect(within(codeWrapper).getByRole("textbox")).toHaveValue("");
      expect(within(nameWrapper).getByRole("textbox")).toHaveValue("");
    });

    it("mengetik di input code memanggil setData('code', ...)", async () => {
      const user = userEvent.setup({ delay: null });
      renderForm({ initialData: { code: "" } });

      const codeWrapper = screen.getByTestId("forminput-code");
      const input = within(codeWrapper).getByRole("textbox");
      await user.type(input, "X");

      expect(input).toHaveValue("X");
    });

    it("checkbox is_disabled unchecked secara default, klik akan checked", async () => {
      const user = userEvent.setup({ delay: null });
      renderForm({ initialData: { is_disabled: false } });

      const checkbox = screen.getByRole("forminput");
      expect(checkbox).toHaveAttribute("data-state", "unchecked");

      await user.click(checkbox);

      expect(checkbox).toHaveAttribute("data-state", "checked");
    });

    it("checkbox is_disabled tercentang saat data.is_disabled true, klik akan unchecked", async () => {
      const user = userEvent.setup({ delay: null });
      renderForm({ initialData: { is_disabled: true } });

      const checkbox = screen.getByRole("forminput");
      expect(checkbox).toHaveAttribute("data-state", "checked");

      await user.click(checkbox);

      expect(checkbox).toHaveAttribute("data-state", "unchecked");
    });
  });

  describe("judul section address: tergantung data.branchable_type", () => {
    it("branchable_type kosong: judul section pakai 'core.branch.columns.address'", () => {
      renderForm({ initialData: {} });

      expect(
        screen.getByText("core.branch.columns.address"),
      ).toBeInTheDocument();
      expect(
        screen.queryByText("core.branch.columns.shipping_address"),
      ).not.toBeInTheDocument();
    });

    it("branchable_type terisi: judul section pakai 'core.branch.columns.shipping_address'", () => {
      renderForm({
        initialData: { branchable_type: "App\\Models\\Purchase\\Supplier" },
      });

      expect(
        screen.getByText("core.branch.columns.shipping_address"),
      ).toBeInTheDocument();
      expect(
        screen.queryByText("core.branch.columns.address"),
      ).not.toBeInTheDocument();
    });
  });

  describe("field shipping address", () => {
    it("shipping_street/city/state/zip_code/country terikat ke data & memanggil setData saat diubah", async () => {
      const user = userEvent.setup({ delay: null });
      renderForm({
        initialData: {
          shipping_street: "Jl. Merdeka",
          shipping_city: "Jakarta",
          shipping_state: "DKI",
          shipping_zip_code: "12345",
          shipping_country: "ID",
        },
      });

      expect(screen.getByDisplayValue("Jl. Merdeka")).toBeInTheDocument();
      expect(screen.getByDisplayValue("Jakarta")).toBeInTheDocument();
      expect(screen.getByDisplayValue("DKI")).toBeInTheDocument();
      expect(screen.getByDisplayValue("12345")).toBeInTheDocument();
      expect(screen.getByDisplayValue("ID")).toBeInTheDocument();

      const cityWrapper = screen.getByTestId("forminput-shipping_city");
      const cityInput = within(cityWrapper).getByRole("textbox");
      await user.clear(cityInput);
      await user.type(cityInput, "Bandung");

      expect(cityInput).toHaveValue("Bandung");
    });

    it("shipping_country fallback ke string kosong saat data.shipping_country undefined", () => {
      renderForm({ initialData: {} });

      const countryWrapper = screen.getByTestId(
        "forminput-shipping_country",
      );
      const countryInput = within(countryWrapper).getByTestId(
        "country-link-model",
      );
      expect(countryInput).toHaveValue("");
    });
  });

  describe("section billing address: hanya muncul jika branchable_type ada", () => {
    it("branchable_type kosong: section billing_address TIDAK dirender", () => {
      renderForm({ initialData: {} });

      expect(
        screen.queryByText("core.branch.columns.billing_address"),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByTestId("select-billing_address"),
      ).not.toBeInTheDocument();
    });

    it("branchable_type terisi: section billing_address dirender dengan Select", () => {
      renderForm({
        initialData: { branchable_type: "App\\Models\\Purchase\\Supplier" },
      });

      // Judul "billing_address" muncul 2x: sekali sbg title FormPageContent
      // (stub <h2>), sekali lagi sbg <h1> dalam FormPageContentTitle (custom
      // header dgn Select di sampingnya) -- keduanya berasal dari Form.jsx.
      expect(
        screen.getAllByText("core.branch.columns.billing_address").length,
      ).toBeGreaterThanOrEqual(2);
      expect(screen.getByTestId("select-billing_address")).toBeInTheDocument();
    });

    it("field billing_street/city/state/zip_code/country TIDAK dirender saat billing_address bukan 'separate'", () => {
      renderForm({
        initialData: {
          branchable_type: "App\\Models\\Purchase\\Supplier",
          billing_address: "same_main",
        },
      });

      expect(
        screen.queryByTestId("forminput-billing_street"),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByTestId("forminput-billing_city"),
      ).not.toBeInTheDocument();
    });

    it("field billing_street/city/state/zip_code/country DIRENDER saat billing_address === 'separate'", () => {
      renderForm({
        initialData: {
          branchable_type: "App\\Models\\Purchase\\Supplier",
          billing_address: "separate",
          billing_street: "Jl. Sudirman",
          billing_city: "Surabaya",
        },
      });

      expect(
        screen.getByTestId("forminput-billing_street"),
      ).toBeInTheDocument();
      expect(screen.getByTestId("forminput-billing_city")).toBeInTheDocument();
      expect(screen.getByTestId("forminput-billing_state")).toBeInTheDocument();
      expect(
        screen.getByTestId("forminput-billing_zip_code"),
      ).toBeInTheDocument();
      expect(
        screen.getByTestId("forminput-billing_country"),
      ).toBeInTheDocument();
      expect(screen.getByDisplayValue("Jl. Sudirman")).toBeInTheDocument();
      expect(screen.getByDisplayValue("Surabaya")).toBeInTheDocument();
    });

    it("memilih opsi 'separate' pada Select billing_address memanggil setData dan memunculkan field billing", async () => {
      const user = userEvent.setup({ delay: null });
      renderForm({
        initialData: {
          branchable_type: "App\\Models\\Purchase\\Supplier",
          billing_address: "same_main",
        },
      });

      expect(
        screen.queryByTestId("forminput-billing_street"),
      ).not.toBeInTheDocument();

      const select = screen.getByTestId("select-billing_address");
      await user.selectOptions(select, "separate");

      expect(select).toHaveValue("separate");
      expect(
        screen.getByTestId("forminput-billing_street"),
      ).toBeInTheDocument();
    });

    it("billing_country: setData terpanggil saat CountryLinkModel berubah (scoped via forminput-billing_country)", async () => {
      const user = userEvent.setup({ delay: null });
      renderForm({
        initialData: {
          branchable_type: "App\\Models\\Purchase\\Supplier",
          billing_address: "separate",
          billing_country: "",
        },
      });

      const countryWrapper = screen.getByTestId(
        "forminput-billing_country",
      );
      const countryInput = within(countryWrapper).getByTestId(
        "country-link-model",
      );
      await user.type(countryInput, "ID");

      expect(countryInput).toHaveValue("ID");
    });
  });
});
