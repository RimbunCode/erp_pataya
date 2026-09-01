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

  it("menampilkan created_at via DatetimePicker", () => {
    formPageSeed = { created_at: "2026-01-01T00:00:00Z" };
    renderForm(<Form />);

    expect(screen.getByTestId("datetime-picker")).toBeInTheDocument();
  });
});
