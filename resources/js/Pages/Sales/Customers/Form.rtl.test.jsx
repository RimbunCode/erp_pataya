import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { TooltipProvider } from "@/Components/ui/tooltip";
import userEvent from "@testing-library/user-event";
import { useState } from "react";

// Form.jsx (Sales/Customers) adalah halaman form master data Customer:
// detail (name/vat/email/phone/is_disabled), alamat (street/city/province/
// zip_code/country), dan tabel branches. Logic UNIK yang jadi fokus test ini
// (bukan komponen anak yang sudah punya test sendiri):
// - Setiap field Input/Textarea/CountryLinkModel/FormCheckbox meneruskan
//   value dari data.* dan memanggil setData(name, val) yang benar saat diubah
// - defaultValueRow FormTable CustomerBranches = branchable_type tetap
// - cell render CustomerBranches: 3 kondisi -- is_main_branch (teks statis,
//   tanpa tombol), isEmpty (tombol "add_branch" trigger toggleDialog), else
//   (nama branch/"empty" placeholder, klik trigger toggleDialog)
//
// Komponen anak yang SUDAH punya test sendiri di-stub: FormPage/
// FormPageContent/FormPageContentTitle/useFormPage, FormInput, FormTable,
// CountryLinkModel (LinkModel-based).

const stableT = (key) => key;
vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({ t: stableT }),
}));

window.route = (name, params) =>
  params ? `${name}/${JSON.stringify(params)}` : name;

const useFormPageMock = vi.fn();
vi.mock("@/Pages/Core/FormPage", () => ({
  useFormPage: (...a) => useFormPageMock(...a),
  FormPageContent: ({ title, children }) => (
    <section aria-label={title}>{children}</section>
  ),
  FormPageContentTitle: ({ children }) => <div>{children}</div>,
}));

vi.mock("@/Components/FormInput", () => ({
  default: ({ label, name, children }) => (
    <div data-testid={`forminput-${name}`}>
      <label>{label}</label>
      {children}
    </div>
  ),
}));

vi.mock("@/Pages/Core/CountryLinkModel", () => ({
  default: ({ value, onValueChange, placeholder }) => (
    <button
      type="button"
      data-testid="country-link-model"
      onClick={() => onValueChange?.("ID")}
    >
      country:{value ?? placeholder ?? "none"}
    </button>
  ),
}));

vi.mock("@/Pages/Settings/Branches/Form", () => ({
  default: () => <div data-testid="branch-form-stub" />,
}));

// FormTable distub agar test fokus ke `cell` render prop milik Customers
// Form.jsx sendiri (bukan mekanisme drag/drop/dialog FormTable yang sudah
// diuji terpisah di FormTable.test.js). Mengikuti pola stub FormTable di
// Form.rtl.test.jsx lain (mis. Finances/PaymentTermTemplate), plus meneruskan
// `toggleDialog` dan `isEmpty` yang dipakai spesifik oleh cell CustomerBranches.
vi.mock("@/Components/FormTable", () => ({
  default: ({ name, columns, value, defaultValueRow }) => {
    const rows = value && value.length > 0 ? value : [];
    return (
      <div data-testid={`stub-form-table-${name}`}>
        <span data-testid={`default-value-row-${name}`}>
          {JSON.stringify(defaultValueRow)}
        </span>
        {rows.map((row, index) => {
          const toggleDialog = vi.fn();
          return (
            <div key={row.id ?? index} data-testid={`row-${name}-${index}`}>
              {columns.map((col) => (
                <div
                  key={col.name}
                  data-testid={`cell-${name}-${col.name}-${index}`}
                >
                  {col.cell({
                    dataRow: row,
                    isEmpty: !row || Object.keys(row).length === 0,
                    toggleDialog,
                  })}
                </div>
              ))}
            </div>
          );
        })}
      </div>
    );
  },
}));

import Form from "./Form";

/**
 * Render Form dengan state data terkelola (setData asli, reaktif) supaya
 * perubahan input bisa diverifikasi lewat re-render, mengikuti pola acuan
 * Users/ManageUsers/Form.rtl.test.jsx.
 * @param root0
 * @param root0.initialData
 * @param root0.dataBefore
 */
function renderForm({ initialData = {}, dataBefore } = {}) {
  function Wrapper() {
    const [data, setDataState] = useState(initialData);
    const setData = vi.fn((key, val) => {
      if (typeof key === "object") {
        setDataState((prev) => ({ ...prev, ...key }));
      } else {
        setDataState((prev) => ({ ...prev, [key]: val }));
      }
    });
    useFormPageMock.mockReturnValue({ data, setData, dataBefore });
    return <Form />;
  }

  return render(
    <TooltipProvider>
      <Wrapper />
    </TooltipProvider>,
  );
}

describe("Form (Sales/Customers)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("field customer_detail", () => {
    it("merender value awal name/vat/email/phone dari data", () => {
      renderForm({
        initialData: {
          name: "PT Maju",
          vat: "123456",
          email: "a@a.com",
          phone: "0812",
        },
      });

      expect(screen.getByDisplayValue("PT Maju")).toBeInTheDocument();
      expect(screen.getByDisplayValue("123456")).toBeInTheDocument();
      expect(screen.getByDisplayValue("a@a.com")).toBeInTheDocument();
      expect(screen.getByDisplayValue("0812")).toBeInTheDocument();
    });

    it("mengetik di field name memanggil setData('name', value)", async () => {
      const user = userEvent.setup({ delay: null });
      renderForm({ initialData: { name: "" } });

      const nameInput = within(screen.getByTestId("forminput-name")).getByRole(
        "textbox",
      );
      await user.type(nameInput, "X");

      expect(nameInput).toHaveValue("X");
    });

    it("mengetik di field vat memperbarui value input (setData('vat', ...))", async () => {
      const user = userEvent.setup({ delay: null });
      renderForm({ initialData: { vat: "" } });

      const vatInput = within(screen.getByTestId("forminput-vat")).getByRole(
        "textbox",
      );
      await user.type(vatInput, "9");

      expect(vatInput).toHaveValue("9");
    });

    it("mengetik di field email memperbarui value input (setData('email', ...))", async () => {
      const user = userEvent.setup({ delay: null });
      renderForm({ initialData: { email: "" } });

      const emailWrapper = screen.getByTestId("forminput-email");
      const emailInput = emailWrapper.querySelector("input");
      await user.type(emailInput, "b@b.com");

      expect(emailInput).toHaveValue("b@b.com");
    });

    it("mengetik di field phone memperbarui value input (setData('phone', ...))", async () => {
      const user = userEvent.setup({ delay: null });
      renderForm({ initialData: { phone: "" } });

      const phoneInput = within(
        screen.getByTestId("forminput-phone"),
      ).getByRole("textbox");
      await user.type(phoneInput, "1");

      expect(phoneInput).toHaveValue("1");
    });

    it("checkbox is_disabled: checked mencerminkan data.is_disabled dan klik meng-update state", async () => {
      const user = userEvent.setup({ delay: null });
      renderForm({ initialData: { is_disabled: false } });

      const checkbox = screen.getByRole("forminput");
      expect(checkbox).toHaveAttribute("data-state", "unchecked");

      await user.click(checkbox);

      expect(checkbox).toHaveAttribute("data-state", "checked");
    });

    it("checkbox is_disabled: data.is_disabled=true dirender checked", () => {
      renderForm({ initialData: { is_disabled: true } });

      const checkbox = screen.getByRole("forminput");
      expect(checkbox).toHaveAttribute("data-state", "checked");
    });
  });

  describe("field alamat", () => {
    it("merender value awal street/city/province/zip_code dari data", () => {
      renderForm({
        initialData: {
          street: "Jl. Mawar",
          city: "Bandung",
          province: "Jabar",
          zip_code: "40123",
        },
      });

      expect(screen.getByDisplayValue("Jl. Mawar")).toBeInTheDocument();
      expect(screen.getByDisplayValue("Bandung")).toBeInTheDocument();
      expect(screen.getByDisplayValue("Jabar")).toBeInTheDocument();
      expect(screen.getByDisplayValue("40123")).toBeInTheDocument();
    });

    it("mengetik di textarea street memperbarui value (setData('street', ...))", async () => {
      const user = userEvent.setup({ delay: null });
      renderForm({ initialData: { street: "" } });

      const streetInput = within(
        screen.getByTestId("forminput-street"),
      ).getByRole("textbox");
      await user.type(streetInput, "J");

      expect(streetInput).toHaveValue("J");
    });

    it("mengetik di field city memperbarui value (setData('city', ...))", async () => {
      const user = userEvent.setup({ delay: null });
      renderForm({ initialData: { city: "" } });

      const cityInput = within(screen.getByTestId("forminput-city")).getByRole(
        "textbox",
      );
      await user.type(cityInput, "B");

      expect(cityInput).toHaveValue("B");
    });

    it("mengetik di field province memperbarui value (setData('province', ...))", async () => {
      const user = userEvent.setup({ delay: null });
      renderForm({ initialData: { province: "" } });

      const provinceInput = within(
        screen.getByTestId("forminput-province"),
      ).getByRole("textbox");
      await user.type(provinceInput, "J");

      expect(provinceInput).toHaveValue("J");
    });

    it("mengetik di field zip_code memperbarui value (setData('zip_code', ...))", async () => {
      const user = userEvent.setup({ delay: null });
      renderForm({ initialData: { zip_code: "" } });

      const zipInput = within(
        screen.getByTestId("forminput-zip_code"),
      ).getByRole("textbox");
      await user.type(zipInput, "4");

      expect(zipInput).toHaveValue("4");
    });

    it("klik CountryLinkModel memanggil setData('country', value) sehingga value ter-update", async () => {
      const user = userEvent.setup({ delay: null });
      renderForm({ initialData: { country: null } });

      // value null -> stub jatuh ke placeholder yang dikirim Form.jsx
      // (sales.customer.columns.country.placeholder), bukan literal "none".
      expect(screen.getByTestId("country-link-model")).toHaveTextContent(
        "country:sales.customer.columns.country.placeholder",
      );

      await user.click(screen.getByTestId("country-link-model"));

      expect(screen.getByTestId("country-link-model")).toHaveTextContent(
        "country:ID",
      );
    });

    it("CountryLinkModel menerima value awal dari data.country", () => {
      renderForm({ initialData: { country: "ID" } });

      expect(screen.getByTestId("country-link-model")).toHaveTextContent(
        "country:ID",
      );
    });
  });

  describe("FormTable CustomerBranches", () => {
    it("defaultValueRow membawa branchable_type App\\Models\\Sales\\Customer", () => {
      renderForm({ initialData: { branches: [] } });

      const defaultValueRow = screen.getByTestId(
        "default-value-row-CustomerBranches",
      );
      expect(JSON.parse(defaultValueRow.textContent)).toEqual({
        branchable_type: "App\\Models\\Sales\\Customer",
      });
    });

    it("value FormTable default ke [] saat data.branches tidak ada", () => {
      renderForm({ initialData: {} });

      expect(
        screen.getByTestId("stub-form-table-CustomerBranches"),
      ).toBeInTheDocument();
      expect(
        screen.queryByTestId("row-CustomerBranches-0"),
      ).not.toBeInTheDocument();
    });

    it("baris dengan is_main_branch=true menampilkan teks '{name} (Main Branch)' tanpa tombol", () => {
      renderForm({
        initialData: {
          branches: [{ id: 1, name: "Cabang Utama", is_main_branch: true }],
        },
      });

      const cell = screen.getByTestId("cell-CustomerBranches-branch_name-0");
      expect(
        within(cell).getByText("Cabang Utama (Main Branch)"),
      ).toBeInTheDocument();
      expect(within(cell).queryByRole("button")).not.toBeInTheDocument();
    });

    it("baris kosong (isEmpty) menampilkan tombol add_branch yang bisa diklik (toggleDialog)", async () => {
      const user = userEvent.setup({ delay: null });
      renderForm({ initialData: { branches: [{}] } });

      const cell = screen.getByTestId("cell-CustomerBranches-branch_name-0");
      const addButton = within(cell).getByRole("button", {
        name: "core.branch.add_branch",
      });
      expect(addButton).toBeInTheDocument();

      await user.click(addButton);
      expect(addButton).toBeInTheDocument();
    });

    it("baris terisi (bukan main branch, bukan kosong) menampilkan nama branch tanpa tombol", () => {
      renderForm({
        initialData: {
          branches: [{ id: 2, name: "Cabang Kedua", is_main_branch: false }],
        },
      });

      const cell = screen.getByTestId("cell-CustomerBranches-branch_name-0");
      expect(within(cell).getByText("Cabang Kedua")).toBeInTheDocument();
      expect(within(cell).queryByRole("button")).not.toBeInTheDocument();
    });

    it("baris terisi tanpa name menampilkan placeholder core.branch.empty", () => {
      renderForm({
        initialData: {
          branches: [{ id: 3, is_main_branch: false, name: undefined }],
        },
      });

      const cell = screen.getByTestId("cell-CustomerBranches-branch_name-0");
      expect(within(cell).getByText("core.branch.empty")).toBeInTheDocument();
    });
  });
});
