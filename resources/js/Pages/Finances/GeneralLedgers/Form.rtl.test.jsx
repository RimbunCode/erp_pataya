import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { TooltipProvider } from "@/Components/ui/tooltip";

const stableT = (key) => key;
vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({ t: stableT }),
}));

const usePageMock = vi.fn();
vi.mock("@inertiajs/react", () => ({
  usePage: () => usePageMock(),
}));

let formPageSeed = {};
vi.mock("@/Pages/Core/FormPage", () => ({
  useFormPage: () => ({ data: formPageSeed }),
  FormPageContent: ({ children }) => <div>{children}</div>,
}));

vi.mock("@/Components/FormInput", () => ({
  default: ({ name, label, children }) => (
    <div data-testid={`forminput-${name}`}>
      <label>{label}</label>
      {children}
    </div>
  ),
}));

vi.mock("../Accounts/AccountLinkModel", () => ({
  default: ({ value }) => (
    <div data-testid="account-link-model">account:{value?.name ?? "none"}</div>
  ),
}));

vi.mock("@/Components/DatetimePicker", () => ({
  default: () => <div data-testid="datetime-picker" />,
}));

const renderForm = (ui) => render(<TooltipProvider>{ui}</TooltipProvider>);

import Form from "./Form";

describe("Finances GeneralLedgers Form", () => {
  beforeEach(() => {
    formPageSeed = {};
    usePageMock.mockReturnValue({ props: { preferences: {} } });
  });

  it("menampilkan account & against_account dari data (read-only, tanpa AccountLinkModel[0-1] ambigu karena testid unik per instance stub)", () => {
    formPageSeed = {
      account: { name: "Kas" },
      against_account: { name: "Piutang" },
    };
    renderForm(<Form />);

    const models = screen.getAllByTestId("account-link-model");
    expect(models[0]).toHaveTextContent("account:Kas");
    expect(models[1]).toHaveTextContent("account:Piutang");
  });

  it("menampilkan debit/credit sebagai NumberInput read-only", () => {
    formPageSeed = { debit: 100000, credit: 0 };
    renderForm(<Form />);

    const debitInput = screen
      .getByTestId("forminput-debit")
      .querySelector("input");
    expect(debitInput).toHaveValue("100,000.00");
    expect(debitInput).toHaveAttribute("readonly");
  });

  it("debit/credit berupa string decimal (kolom decimal(20,4)) tetap diformat sebagai angka", () => {
    formPageSeed = { debit: "100000.0000", credit: "2500.5000" };
    renderForm(<Form />);

    expect(
      screen.getByTestId("forminput-debit").querySelector("input"),
    ).toHaveValue("100,000.00");
    expect(
      screen.getByTestId("forminput-credit").querySelector("input"),
    ).toHaveValue("2,500.50");
  });

  it("menampilkan created_at via DatetimePicker", () => {
    formPageSeed = { created_at: "2026-01-01T00:00:00Z" };
    renderForm(<Form />);

    expect(screen.getByTestId("datetime-picker")).toBeInTheDocument();
  });
  it("against_account null tanpa id (jurnal 3 baris atau lebih): menampilkan label Beberapa akun, bukan pilihan akun", () => {
    formPageSeed = {
      account: { name: "Kas" },
      against_account: null,
      against_account_id: null,
    };
    renderForm(<Form />);

    const field = screen.getByTestId("forminput-against_account");
    expect(field.querySelector("input")).toHaveValue(
      "finances.generalLedger.columns.multiple_accounts",
    );
    expect(field.querySelector("input")).toHaveAttribute("readonly");
    expect(screen.getAllByTestId("account-link-model")).toHaveLength(1);
  });

  it("against_account_id terisi tetapi relasi tidak termuat: tetap memakai pilihan akun (data legacy)", () => {
    formPageSeed = { against_account: null, against_account_id: "a2" };
    renderForm(<Form />);

    expect(screen.getAllByTestId("account-link-model")).toHaveLength(2);
  });
});
