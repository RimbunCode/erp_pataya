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

window.route = (name, id) => `${name}/${id}`;

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

vi.mock("@/Pages/Inventory/Items/ItemVariantLinkModel", () => ({
  default: ({ value }) => (
    <div data-testid="item-link-model">item:{value?.name ?? "none"}</div>
  ),
}));

vi.mock("@/Pages/Inventory/Items/ItemUnitLinkModel", () => ({
  default: ({ value }) => (
    <div data-testid="unit-link-model">unit:{value?.name ?? "none"}</div>
  ),
}));

vi.mock("@/Pages/Inventory/Warehouses/WarehouseLinkModel", () => ({
  default: ({ value }) => (
    <div data-testid="warehouse-link-model">
      warehouse:{value?.name ?? "none"}
    </div>
  ),
}));

vi.mock("@/Components/LinkModel", () => ({
  default: ({ value, customNavigation }) => (
    <div
      data-testid="reference-link-model"
      data-has-navigation={customNavigation ? "true" : "false"}
    >
      ref:{value?.name ?? "none"}
    </div>
  ),
}));

const renderForm = (ui) => render(<TooltipProvider>{ui}</TooltipProvider>);

import Form from "./Form";

describe("Inventory StockLedgers Form", () => {
  beforeEach(() => {
    formPageSeed = {};
    usePageMock.mockReturnValue({ props: { preferences: {} } });
  });

  it("menampilkan code sebagai input read-only", () => {
    formPageSeed = { code: "SLE-001" };
    renderForm(<Form />);

    const input = screen
      .getByTestId("forminput-code")
      .querySelector("input");
    expect(input).toHaveValue("SLE-001");
    expect(input).toHaveAttribute("readonly");
  });

  it("menampilkan item/unit/warehouse dari data", () => {
    formPageSeed = {
      item: { name: "Item A" },
      unit: { name: "PCS" },
      warehouse: { name: "Gudang A" },
    };
    renderForm(<Form />);

    expect(screen.getByTestId("item-link-model")).toHaveTextContent(
      "item:Item A",
    );
    expect(screen.getByTestId("unit-link-model")).toHaveTextContent(
      "unit:PCS",
    );
    expect(screen.getByTestId("warehouse-link-model")).toHaveTextContent(
      "warehouse:Gudang A",
    );
  });

  it("menampilkan quantity_change/valuation_rate/dst sebagai NumberInput read-only", () => {
    formPageSeed = { quantity_change: 10, valuation_rate: 5000 };
    renderForm(<Form />);

    const qtyInput = screen
      .getByTestId("forminput-quantity_change")
      .querySelector("input");
    expect(qtyInput).toHaveValue("10.00");
    expect(qtyInput).toHaveAttribute("readonly");
  });

  it("referenceable tanpa value: customNavigation undefined", () => {
    formPageSeed = { referenceable: null };
    renderForm(<Form />);

    expect(screen.getByTestId("reference-link-model")).toHaveAttribute(
      "data-has-navigation",
      "false",
    );
  });

  it("referenceable dengan value: customNavigation terisi (function)", () => {
    formPageSeed = {
      referenceable: { id: 1, name: "SO-001", route: "salesOrders" },
    };
    renderForm(<Form />);

    const refModel = screen.getByTestId("reference-link-model");
    expect(refModel).toHaveTextContent("ref:SO-001");
    expect(refModel).toHaveAttribute("data-has-navigation", "true");
  });
});
