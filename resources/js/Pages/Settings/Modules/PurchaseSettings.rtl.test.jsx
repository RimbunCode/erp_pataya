import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import PurchaseSettings from "./PurchaseSettings";

vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({ t: (key) => key }),
}));
vi.mock("./ModuleSettingsPage", () => ({
  default: ({ tabs, children, setting }) => (
    <main>
      {tabs.map((tab) => (
        <section key={tab.value} aria-label={tab.value}>
          {children({ data: setting, setData: vi.fn(), disabled: false, tab: tab.value })}
        </section>
      ))}
    </main>
  ),
}));
vi.mock("@/Components/FormInput", () => ({
  default: ({ name, children }) => <div data-testid={`field-${name}`}>{children}</div>,
}));
vi.mock("@/Components/NumberInput", () => ({ default: () => <input /> }));
vi.mock("@/Pages/Finances/Taxes/TaxLinkModel", () => ({ default: () => <div data-testid="tax-picker" /> }));
vi.mock("@/Pages/Inventory/Warehouses/WarehouseLinkModel", () => ({ default: () => <div data-testid="warehouse-picker" /> }));
vi.mock("@/Pages/Finances/PaymentTermTemplate/PaymentTermTemplateLinkModel", () => ({ default: () => <div data-testid="payment-term-picker" /> }));

describe("PurchaseSettings", () => {
  it("renders default selectors and transaction tolerances on separate tabs", () => {
    render(<PurchaseSettings setting={{}} />);

    expect(screen.getByRole("region", { name: "default" })).toContainElement(screen.getByTestId("field-default_tax_id"));
    expect(screen.getByTestId("field-default_target_warehouse_id")).toBeInTheDocument();
    expect(screen.getByTestId("field-default_payment_term_template_id")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "transaction" })).toContainElement(screen.getByTestId("field-over_receipt_tolerance_percent"));
    expect(screen.getByTestId("field-over_billing_tolerance_percent")).toBeInTheDocument();
    expect(screen.getByText("purchase.setting.over_receipt_tolerance_help")).toBeInTheDocument();
    expect(screen.getByText("purchase.setting.over_billing_tolerance_help")).toBeInTheDocument();
    expect(screen.getByTestId("field-rate_change_action")).toBeInTheDocument();
  });
});
