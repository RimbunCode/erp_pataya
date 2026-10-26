import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import PurchaseSettings from "./PurchaseSettings";

vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({ t: (key) => key }),
}));
vi.mock("./ModuleSettingsPage", () => ({
  default: function ModuleSettingsPageMock({ tabs, children, setting }) {
    const [activeTab, setActiveTab] = React.useState(tabs[0].value);

    return (
      <main>
        {tabs.map((tab) => (
          <button key={tab.value} onClick={() => setActiveTab(tab.value)}>
            {tab.value}
          </button>
        ))}
        {tabs
          .filter((tab) => tab.forceMount || tab.value === activeTab)
          .map((tab) => (
            <section
              key={tab.value}
              aria-label={tab.value}
              hidden={tab.value !== activeTab}
            >
              {children({
                data: setting,
                setData: vi.fn(),
                disabled: false,
                tab: tab.value,
              })}
            </section>
          ))}
      </main>
    );
  },
}));
vi.mock("./DefaultRulesSettings", () => ({
  default: function DefaultRulesSettingsMock() {
    const [itemType, setItemType] = React.useState("");

    return (
      <div data-testid="default-rules-tab">
        <input
          aria-label="rule item type"
          value={itemType}
          onChange={(event) => setItemType(event.target.value)}
        />
      </div>
    );
  },
}));
vi.mock("@/Components/FormInput", () => ({
  default: ({ name, children }) => (
    <div data-testid={`field-${name}`}>{children}</div>
  ),
}));
vi.mock("@/Components/NumberInput", () => ({ default: () => <input /> }));
vi.mock("@/Pages/Finances/Taxes/TaxLinkModel", () => ({
  default: () => <div data-testid="tax-picker" />,
}));
vi.mock("@/Pages/Inventory/Warehouses/WarehouseLinkModel", () => ({
  default: () => <div data-testid="warehouse-picker" />,
}));
vi.mock(
  "@/Pages/Finances/PaymentTermTemplate/PaymentTermTemplateLinkModel",
  () => ({ default: () => <div data-testid="payment-term-picker" /> }),
);

describe("PurchaseSettings", () => {
  it("renders default selectors and transaction tolerances on separate tabs", () => {
    render(<PurchaseSettings setting={{}} />);

    expect(screen.getByRole("region", { name: "default" })).toContainElement(
      screen.getByTestId("field-default_tax_id"),
    );
    expect(
      screen.getByTestId("field-default_target_warehouse_id"),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("field-default_payment_term_template_id"),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "transaction" }));
    expect(
      screen.getByRole("region", { name: "transaction" }),
    ).toContainElement(
      screen.getByTestId("field-over_receipt_tolerance_percent"),
    );
    expect(
      screen.getByTestId("field-over_billing_tolerance_percent"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("purchase.setting.over_receipt_tolerance_help"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("purchase.setting.over_billing_tolerance_help"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("field-rate_change_action")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "default_rules" }));
    expect(
      screen.getByRole("region", { name: "default_rules" }),
    ).toContainElement(screen.getByTestId("default-rules-tab"));
  });

  it("preserves rule drafts when switching tabs and saving module settings", async () => {
    const user = (await import("@testing-library/user-event")).default.setup();
    const props = {
      setting: {},
      defaultTaxRules: [],
      defaultWarehouseRules: [],
    };
    const { rerender } = render(<PurchaseSettings {...props} />);

    await user.click(screen.getByRole("button", { name: "default_rules" }));
    await user.type(
      screen.getByRole("textbox", { name: "rule item type" }),
      "goods",
    );
    await user.click(screen.getByRole("button", { name: "default" }));
    rerender(
      <PurchaseSettings
        {...props}
        setting={{ over_billing_tolerance_percent: 5 }}
      />,
    );
    await user.click(screen.getByRole("button", { name: "default_rules" }));

    expect(screen.getByRole("textbox", { name: "rule item type" })).toHaveValue(
      "goods",
    );
  });
});
