import React, { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import InventorySettings from "./InventorySettings";

vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({ t: (key) => key }),
}));
vi.mock("./ModuleSettingsPage", () => ({
  default: function ModuleSettingsPageStub({ tabs, children, setting }) {
    const [data, setDataState] = useState(setting);
    const setData = (key, value) =>
      setDataState((prev) => ({ ...prev, [key]: value }));

    return (
      <main>
        {tabs.map((tab) => (
          <section key={tab.value} aria-label={tab.value}>
            {children({ data, setData, disabled: false, tab: tab.value })}
          </section>
        ))}
      </main>
    );
  },
}));
vi.mock("@/Components/FormInput", () => ({
  default: ({ name, children }) => (
    <div data-testid={`field-${name}`}>{children}</div>
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
        data-testid="warehouse-picker"
        data-global-branch={String(!!includeGlobalBranch)}
      >
        {value?.name ?? "none"}
      </div>
    </div>
  ),
}));

describe("InventorySettings", () => {
  it("renders the global default warehouse selector", () => {
    render(<InventorySettings setting={{ default_warehouse_id: null }} />);

    expect(
      screen.getByTestId("field-default_warehouse_id"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("warehouse-picker")).toBeInTheDocument();
  });

  it("does not warn about an unavailable reference after picking a new warehouse before saving", async () => {
    render(<InventorySettings setting={{ default_warehouse_id: null }} />);

    await userEvent.click(screen.getByText("pick-warehouse"));

    expect(screen.getByTestId("warehouse-picker")).toHaveTextContent(
      "Gudang Baru",
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("requests warehouses including other branches", () => {
    render(<InventorySettings setting={{ default_warehouse_id: null }} />);

    expect(screen.getByTestId("warehouse-picker")).toHaveAttribute(
      "data-global-branch",
      "true",
    );
  });

  it("does not warn when the saved warehouse is resolved", () => {
    render(
      <InventorySettings
        setting={{ default_warehouse_id: "wh-1" }}
        defaultWarehouse={{ id: "wh-1", name: "Gudang Satu" }}
      />,
    );

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("warns when the saved warehouse reference can no longer be resolved", () => {
    render(<InventorySettings setting={{ default_warehouse_id: "wh-gone" }} />);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "inventory.setting.reference_unavailable",
    );
  });
});
