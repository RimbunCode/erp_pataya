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

window.route = (name, params) =>
  params !== undefined ? `${name}/${JSON.stringify(params)}` : name;

let formPageSeed = {};
vi.mock("@/Pages/Core/FormPage", async () => {
  const React = await import("react");
  return {
    useFormPage: (defaultValue) => {
      const [data, setDataState] = React.useState({
        ...defaultValue,
        ...formPageSeed,
      });
      const setData = (keyOrFn, val) => {
        if (typeof keyOrFn === "function") {
          setDataState((prev) => keyOrFn(prev));
        } else if (typeof keyOrFn === "string") {
          setDataState((prev) => ({ ...prev, [keyOrFn]: val }));
        } else {
          setDataState((prev) => ({ ...prev, ...keyOrFn }));
        }
      };
      return { data, setData, disabled: false };
    },
    FormPageContent: ({ children }) => <div>{children}</div>,
  };
});

vi.mock("@/Components/FormInput", () => ({
  default: ({ name, label, readOnly, children }) => (
    <div
      data-testid={`forminput-${name ?? label}`}
      data-readonly={readOnly ? "true" : "false"}
    >
      <label>{label}</label>
      {children}
    </div>
  ),
}));

vi.mock("@/Components/DatetimePicker", () => ({
  default: () => <div data-testid="datetime-picker" />,
}));

vi.mock("@/Pages/Sales/Customers/CustomerLinkModel", () => ({
  default: ({ value }) => (
    <div data-testid="customer-link-model">
      customer:{value?.name ?? "none"}
    </div>
  ),
}));

vi.mock("@/Pages/CRM/Opportunities/OpportunityLinkModel", () => ({
  default: ({ value, disabled }) => (
    <button
      type="button"
      data-testid="opportunity-link-model"
      data-disabled={disabled ? "true" : "false"}
    >
      opportunity:{value?.name ?? "none"}
    </button>
  ),
}));

vi.mock("@/Components/LinkModel", () => ({
  default: ({ value, model }) => (
    <div data-testid="reference-link-model" data-model={model}>
      ref:{value?.name ?? "none"}
    </div>
  ),
}));

vi.mock("./QuotationItems", () => ({
  default: ({ value }) => (
    <div data-testid="quotation-items">items:{(value ?? []).length}</div>
  ),
}));

const renderForm = (ui) => render(<TooltipProvider>{ui}</TooltipProvider>);

import Form from "./Form";

describe("CRM Quotations Form", () => {
  beforeEach(() => {
    formPageSeed = {};
    usePageMock.mockReturnValue({ props: { preferences: {} } });
  });

  it("amount dihitung dari sum quantity*price seluruh items", () => {
    formPageSeed = {
      items: [
        { quantity: 2, price: 100 },
        { quantity: 3, price: 50 },
      ],
    };
    renderForm(<Form />);

    const amountInput = screen
      .getByTestId(`forminput-crm.quotation.columns.amount`)
      .querySelector("input");
    expect(amountInput).toHaveValue("350.00");
  });

  it("amount 0 saat items kosong", () => {
    formPageSeed = { items: [] };
    renderForm(<Form />);

    const amountInput = screen
      .getByTestId(`forminput-crm.quotation.columns.amount`)
      .querySelector("input");
    expect(amountInput).toHaveValue("0.00");
  });

  it("opportunity TIDAK disabled saat tidak ada referenceable", () => {
    formPageSeed = { referenceable: null };
    renderForm(<Form />);

    expect(screen.getByTestId("opportunity-link-model")).toHaveAttribute(
      "data-disabled",
      "false",
    );
  });

  it("opportunity disabled ketika ada referenceable (carry-over dari dokumen lain)", () => {
    formPageSeed = {
      referenceable: { id: 1, name: "SO-001" },
      referenceable_type: "App\\Models\\Sales\\SalesOrder",
    };
    renderForm(<Form />);

    expect(screen.getByTestId("opportunity-link-model")).toHaveAttribute(
      "data-disabled",
      "true",
    );
  });

  it("field reference_to TIDAK dirender saat tidak ada referenceable", () => {
    formPageSeed = { referenceable: null };
    renderForm(<Form />);

    expect(
      screen.queryByTestId("reference-link-model"),
    ).not.toBeInTheDocument();
  });

  it("field reference_to dirender read-only saat ada referenceable", () => {
    formPageSeed = {
      referenceable: { id: 1, name: "SO-001" },
      referenceable_type: "App\\Models\\Sales\\SalesOrder",
    };
    renderForm(<Form />);

    const refModel = screen.getByTestId("reference-link-model");
    expect(refModel).toHaveTextContent("ref:SO-001");
    expect(refModel).toHaveAttribute(
      "data-model",
      "App\\Models\\Sales\\SalesOrder",
    );
  });

  it("QuotationItems menerima data.items dan readOnly dari disabled form", () => {
    formPageSeed = { items: [{ quantity: 1, price: 1 }] };
    renderForm(<Form />);

    expect(screen.getByTestId("quotation-items")).toHaveTextContent("items:1");
  });

  it("memilih customer menampilkan value terkini", () => {
    formPageSeed = { customer: { name: "PT ABC" } };
    renderForm(<Form />);

    expect(screen.getByTestId("customer-link-model")).toHaveTextContent(
      "customer:PT ABC",
    );
  });
});
