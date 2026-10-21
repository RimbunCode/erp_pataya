import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import InventorySettings from "./InventorySettings";

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
vi.mock("@/Pages/Inventory/Warehouses/WarehouseLinkModel", () => ({
  default: () => <div data-testid="warehouse-picker" />,
}));

describe("InventorySettings", () => {
  it("renders the global default warehouse selector", () => {
    render(<InventorySettings setting={{ default_warehouse_id: null }} />);

    expect(screen.getByTestId("field-default_warehouse_id")).toBeInTheDocument();
    expect(screen.getByTestId("warehouse-picker")).toBeInTheDocument();
  });
});
