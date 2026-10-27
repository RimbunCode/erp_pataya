import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import SalesSettings from "./SalesSettings";

const putMock = vi.fn();
const translationMock = vi.hoisted(() =>
  vi.fn((key, fallback) => fallback || key),
);

vi.mock("@inertiajs/react", async (importOriginal) => ({
  ...(await importOriginal()),
  Head: ({ title }) => <title>{title}</title>,
  useForm: (initial) => {
    const [data, setDataState] = React.useState(initial);
    const setData = (key, value) =>
      setDataState((previous) => ({ ...previous, [key]: value }));

    return {
      data,
      setData,
      put: putMock,
      processing: false,
      isDirty: false,
      errors: {},
    };
  },
  usePage: () => ({
    props: {
      auth: { user: { id: "01TEST" } },
      flash: {},
      preferences: {},
    },
  }),
}));

vi.mock("@/Layouts/AppLayout", () => ({
  default: ({ children }) => <div data-testid="app-layout">{children}</div>,
}));

vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({
    t: translationMock,
  }),
}));

vi.mock("@/lib/gooeyToast", () => ({
  gooeyToast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("./DefaultRulesSettings", () => ({
  default: ({ itemTypeOptions, taxDocumentTypes }) => (
    <div
      data-testid="default-rules-tab"
      data-item-types={JSON.stringify(itemTypeOptions)}
      data-tax-document-types={JSON.stringify(taxDocumentTypes)}
    />
  ),
}));

vi.mock("@/Components/FormInput", () => ({
  default: ({ label, children }) => (
    <div data-testid="form-input">
      <label>{label}</label>
      {children}
    </div>
  ),
}));

vi.mock("@/Pages/Finances/Taxes/TaxLinkModel", () => ({
  default: ({ value, disabled, onValueChange }) => (
    <>
      <input
        data-testid="tax-link-model"
        value={value?.name || ""}
        disabled={disabled}
        onChange={() => {}}
      />
      <button
        type="button"
        onClick={() => onValueChange({ id: "01ACTIVE", name: "Active Tax" })}
      >
        Choose active tax
      </button>
    </>
  ),
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
        data-testid="warehouse-link-model"
        data-global-branch={String(!!includeGlobalBranch)}
      >
        {value?.name ?? "none"}
      </div>
    </div>
  ),
}));

vi.mock(
  "@/Pages/Finances/PaymentTermTemplate/PaymentTermTemplateLinkModel",
  () => ({
    default: () => <div data-testid="payment-term-template-link-model" />,
  }),
);

describe("SalesSettings RTL", () => {
  it("renders sales settings page with default tax and transaction controls", async () => {
    render(
      <SalesSettings
        setting={{
          default_tax_id: "01TAXID",
        }}
        canWrite={true}
      />,
    );

    expect(screen.getByTestId("sales-settings-form")).toBeInTheDocument();
    expect(screen.getByText("Sales Settings")).toBeInTheDocument();
    expect(translationMock).toHaveBeenCalledWith(
      "sales.setting.title",
      "Sales Settings",
    );
    expect(translationMock).toHaveBeenCalledWith(
      "sales.setting.default.title",
      "Default",
    );
    expect(translationMock).toHaveBeenCalledWith(
      "sales.setting.default_tax",
      "Default Tax",
    );
    expect(screen.getByTestId("tax-link-model")).toBeInTheDocument();
    expect(screen.getByTestId("tax-link-model")).not.toBeDisabled();
    await userEvent.click(screen.getByRole("tab", { name: "Transactions" }));
    expect(
      screen.getByText("sales.setting.rate_change_action"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("sales.setting.below_cost_action"),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole("tab", { name: "Default Rules" }));
    expect(screen.getByTestId("default-rules-tab")).toBeInTheDocument();
  });

  it("disables tax link model input when canWrite is false", () => {
    render(
      <SalesSettings
        setting={{
          default_tax_id: "01TAXID",
        }}
        canWrite={false}
      />,
    );

    expect(screen.getByTestId("tax-link-model")).toBeDisabled();
  });

  it("does not report a newly selected tax as unavailable", async () => {
    render(<SalesSettings setting={{}} canWrite />);

    await userEvent.click(
      screen.getByRole("button", { name: "Choose active tax" }),
    );

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
  describe("default source warehouse picker is global", () => {
    it("requests warehouses including other branches", () => {
      render(<SalesSettings setting={{}} canWrite />);

      expect(screen.getByTestId("warehouse-link-model")).toHaveAttribute(
        "data-global-branch",
        "true",
      );
    });

    it("shows a saved warehouse from another branch without an unavailable warning", () => {
      render(
        <SalesSettings
          setting={{ default_source_warehouse_id: "wh-b" }}
          defaultSourceWarehouse={{ id: "wh-b", name: "Gudang Cabang B" }}
          canWrite
        />,
      );

      expect(screen.getByTestId("warehouse-link-model")).toHaveTextContent(
        "Gudang Cabang B",
      );
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("does not warn after picking a new warehouse before saving", async () => {
      render(<SalesSettings setting={{}} canWrite />);

      await userEvent.click(screen.getByText("pick-warehouse"));

      expect(screen.getByTestId("warehouse-link-model")).toHaveTextContent(
        "Gudang Baru",
      );
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("still warns when the saved warehouse cannot be resolved", () => {
      render(
        <SalesSettings
          setting={{ default_source_warehouse_id: "gone" }}
          canWrite
        />,
      );

      expect(screen.getByRole("alert")).toHaveTextContent(
        "sales.setting.reference_unavailable",
      );
    });
  });
  it("forwards item type options and tax document types to the rules tab", async () => {
    const itemTypeOptions = [{ value: "service", label: "Jasa/Layanan" }];
    const taxDocumentTypes = ["sales_order", "sales_invoice", "quotation"];
    render(
      <SalesSettings
        setting={{}}
        canWrite
        itemTypeOptions={itemTypeOptions}
        taxDocumentTypes={taxDocumentTypes}
      />,
    );

    await userEvent.click(screen.getByRole("tab", { name: "Default Rules" }));

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
