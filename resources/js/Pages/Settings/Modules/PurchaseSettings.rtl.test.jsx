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
    const [data, setDataState] = React.useState(setting);
    const setData = (key, value) =>
      setDataState((previous) => ({ ...previous, [key]: value }));

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
                data,
                setData,
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
  default: function DefaultRulesSettingsMock({
    itemTypeOptions,
    taxDocumentTypes,
  }) {
    const [itemType, setItemType] = React.useState("");

    return (
      <div
        data-testid="default-rules-tab"
        data-item-types={JSON.stringify(itemTypeOptions)}
        data-tax-document-types={JSON.stringify(taxDocumentTypes)}
      >
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
  default: ({ value, includeGlobalBranch, onValueChange }) => (
    <div>
      <button
        type="button"
        onClick={() => onValueChange({ id: "wh-new", name: "Gudang Baru" })}
      >
        pick-warehouse
      </button>
      <div
        data-testid="warehouse-picker"
        data-global-branch={String(!!includeGlobalBranch)}
      >
        {value?.name ?? "none"}
      </div>
    </div>
  ),
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
  describe("default warehouse picker is global", () => {
    it("requests warehouses including other branches", () => {
      render(<PurchaseSettings setting={{}} />);

      expect(screen.getByTestId("warehouse-picker")).toHaveAttribute(
        "data-global-branch",
        "true",
      );
    });

    it("shows a saved warehouse from another branch without an unavailable warning", () => {
      render(
        <PurchaseSettings
          setting={{ default_target_warehouse_id: "wh-b" }}
          defaultTargetWarehouse={{ id: "wh-b", name: "Gudang Cabang B" }}
        />,
      );

      expect(screen.getByTestId("warehouse-picker")).toHaveTextContent(
        "Gudang Cabang B",
      );
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("does not warn after picking a new warehouse before saving", () => {
      render(<PurchaseSettings setting={{}} />);

      fireEvent.click(screen.getByText("pick-warehouse"));

      expect(screen.getByTestId("warehouse-picker")).toHaveTextContent(
        "Gudang Baru",
      );
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("still warns when the saved warehouse cannot be resolved", () => {
      render(
        <PurchaseSettings setting={{ default_target_warehouse_id: "gone" }} />,
      );

      expect(screen.getByRole("alert")).toHaveTextContent(
        "purchase.setting.reference_unavailable",
      );
    });
  });
  it("forwards item type options and tax document types to the rules tab", () => {
    const itemTypeOptions = [{ value: "inventory", label: "Inventaris" }];
    const taxDocumentTypes = ["purchase_order", "purchase_invoice"];
    render(
      <PurchaseSettings
        setting={{}}
        itemTypeOptions={itemTypeOptions}
        taxDocumentTypes={taxDocumentTypes}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "default_rules" }));

    const tab = screen.getByTestId("default-rules-tab");
    expect(tab).toHaveAttribute(
      "data-item-types",
      JSON.stringify(itemTypeOptions),
    );
    expect(tab).toHaveAttribute(
      "data-tax-document-types",
      JSON.stringify(taxDocumentTypes),
    );
  });
});
