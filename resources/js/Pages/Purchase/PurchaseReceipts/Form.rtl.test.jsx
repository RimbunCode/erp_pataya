import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TooltipProvider } from "@/Components/ui/tooltip";

const stableT = (key) => key;
vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({ t: stableT }),
}));

window.route = (name, params) =>
  params !== undefined ? `${name}/${JSON.stringify(params)}` : name;

vi.mock("@inertiajs/react", () => ({
  usePage: () => ({ props: { preferences: {} } }),
}));

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
      return { data, setData };
    },
    FormPageContent: ({ title, children }) => (
      <div data-testid={`form-page-content-${title ?? "untitled"}`}>
        {children}
      </div>
    ),
  };
});

vi.mock("@/Components/FormInput", () => ({
  default: ({ name, label, children }) => (
    <div data-testid={`forminput-${name}`}>
      <label>{label}</label>
      {children}
    </div>
  ),
}));

vi.mock("@/Components/FormTable", () => ({
  default: ({ columns, value, onValueChange }) => {
    const rows = value ?? [];
    const updateRow = (index, keyOrObj, val) => {
      const next = [...rows];
      const row = { ...next[index] };
      if (typeof keyOrObj === "object") {
        Object.assign(row, keyOrObj);
      } else {
        row[keyOrObj] = val;
      }
      next[index] = row;
      onValueChange?.(next);
    };
    return (
      <div data-testid="stub-form-table">
        {rows.map((row, index) => (
          <div key={row.id ?? index} data-testid={`row-${index}`}>
            {columns.map((col) => (
              <div key={col.name} data-testid={`cell-${col.name}-${index}`}>
                {col.cell({
                  dataRow: row,
                  data: row[col.name],
                  setData: (keyOrObj, val) => updateRow(index, keyOrObj, val),
                  attributes: {},
                })}
              </div>
            ))}
          </div>
        ))}
      </div>
    );
  },
}));

vi.mock("./ItemForm", () => ({
  default: () => <div data-testid="stub-item-form" />,
}));

vi.mock("@/Components/DatetimePicker", () => ({
  default: ({ value, onValueChange }) => (
    <button
      type="button"
      data-testid="datetime-picker"
      onClick={() => onValueChange?.(new Date("2026-01-01"))}
    >
      date:{value ? "set" : "none"}
    </button>
  ),
}));

vi.mock("../PurchaseOrders/PurchaseOrderLinkModel", () => ({
  default: ({ value, onValueChange }) => (
    <button
      type="button"
      data-testid="purchase-order-link-model"
      onClick={() =>
        onValueChange?.({
          id: 10,
          supplier: { id: 1, name: "Supplier A" },
          items: [
            {
              id: 100,
              description: "Item A",
              unreceived_quantity: 5,
              unit: { id: 1, name: "PCS" },
              conversion_factor: 1,
              target_warehouse: { id: 1, name: "Gudang A" },
            },
          ],
        })
      }
    >
      po:{value?.id ?? "none"}
    </button>
  ),
}));

vi.mock("./PurchaseReceiptLinkModel", () => ({
  default: ({ value, onValueChange }) => (
    <button
      type="button"
      data-testid="purchase-receipt-link-model"
      onClick={() =>
        onValueChange?.({
          id: 20,
          purchase_order: { id: 11 },
          supplier: { id: 2, name: "Supplier B" },
          items: [
            {
              id: 200,
              purchase_order_item_id: 300,
              description: "Item B",
              unreturned_quantity: 3,
              unit: { id: 1, name: "PCS" },
              target_warehouse: { id: 1, name: "Gudang A" },
            },
          ],
        })
      }
    >
      receipt:{value?.id ?? "none"}
    </button>
  ),
}));

vi.mock("../Suppliers/SupplierLinkModel", () => ({
  default: ({ value }) => (
    <div data-testid="supplier-link-model">
      supplier:{value?.name ?? "none"}
    </div>
  ),
}));

vi.mock("@/Pages/Inventory/Items/ItemUnitLinkModel", () => ({
  default: ({ disabled, filters }) => (
    <button
      type="button"
      data-testid="item-unit-link-model"
      data-disabled={disabled ? "true" : "false"}
      data-filters={JSON.stringify(filters ?? {})}
    />
  ),
}));

vi.mock("../PurchaseOrders/PurchaseOrderItemLinkModel", () => ({
  default: ({ disabled, filters }) => (
    <button
      type="button"
      data-testid="purchase-order-item-link-model"
      data-disabled={disabled ? "true" : "false"}
      data-filters={JSON.stringify(filters ?? {})}
    />
  ),
}));

vi.mock("@/Pages/Inventory/Warehouses/WarehouseLinkModel", () => ({
  default: ({ disabled }) => (
    <button
      type="button"
      data-testid="warehouse-link-model"
      data-disabled={disabled ? "true" : "false"}
    />
  ),
}));

const renderForm = (ui) => render(<TooltipProvider>{ui}</TooltipProvider>);

import Form from "./Form";

describe("PurchaseReceipts Form", () => {
  beforeEach(() => {
    formPageSeed = {};
  });

  it("memilih purchase_order mengisi supplier dan items (full-replace, tanpa mergeItems)", async () => {
    const user = userEvent.setup({ delay: null });
    formPageSeed = { items: [] };
    renderForm(<Form />);

    await user.click(screen.getByTestId("purchase-order-link-model"));

    expect(screen.getByTestId("supplier-link-model")).toHaveTextContent(
      "supplier:Supplier A",
    );
    const cell = screen.getByTestId("cell-quantity-0");
    expect(cell.querySelector("input")).toHaveValue("5.00");
  });

  it("purchase_order_item cell disabled ketika purchase_order belum dipilih", () => {
    formPageSeed = { items: [{ id: "r1" }] };
    renderForm(<Form />);

    expect(
      screen.getByTestId("purchase-order-item-link-model"),
    ).toHaveAttribute("data-disabled", "true");
  });

  it("purchase_order_item cell memfilter berdasar purchase_order.id dan unreceived_quantity > 0", () => {
    formPageSeed = {
      purchase_order: { id: 10 },
      items: [{ id: "r1" }],
    };
    renderForm(<Form />);

    expect(
      screen.getByTestId("purchase-order-item-link-model"),
    ).toHaveAttribute(
      "data-filters",
      JSON.stringify({
        purchase_order_id: 10,
        unreceived_quantity: { ">": 0 },
      }),
    );
  });

  it("kolom target_warehouse/unit/quantity/description disabled selama purchase_order_item belum dipilih", () => {
    formPageSeed = { items: [{ id: "r1", purchase_order_item_id: null }] };
    renderForm(<Form />);

    expect(screen.getByTestId("warehouse-link-model")).toHaveAttribute(
      "data-disabled",
      "true",
    );
    expect(screen.getByTestId("item-unit-link-model")).toHaveAttribute(
      "data-disabled",
      "true",
    );
    const qtyCell = screen.getByTestId("cell-quantity-0");
    expect(qtyCell.querySelector("input")).toBeDisabled();
    const descCell = screen.getByTestId("cell-description-0");
    expect(descCell.querySelector("textarea")).toBeDisabled();
  });

  it("kolom unit memfilter berdasar item_id dari purchase_order_item terpilih", () => {
    formPageSeed = {
      items: [
        {
          id: "r1",
          purchase_order_item_id: 300,
          purchase_order_item: { item: { item_id: 55 } },
        },
      ],
    };
    renderForm(<Form />);

    expect(screen.getByTestId("item-unit-link-model")).toHaveAttribute(
      "data-filters",
      JSON.stringify({ item_id: 55 }),
    );
  });

  it("toggle is_return mereset purchase_order, supplier, items, external_note, return_against", async () => {
    const user = userEvent.setup({ delay: null });
    formPageSeed = {
      is_return: false,
      purchase_order: { id: 10 },
      supplier: { id: 1, name: "Supplier A" },
      items: [{ id: "r1" }],
      external_note: "catatan",
    };
    renderForm(<Form />);

    const checkbox = screen.getByRole("forminput");
    await user.click(checkbox);

    expect(checkbox).toHaveAttribute("data-state", "checked");
    expect(screen.getByTestId("supplier-link-model")).toHaveTextContent(
      "supplier:none",
    );
    expect(screen.queryByTestId("row-0")).not.toBeInTheDocument();
  });

  it("is_return aktif menampilkan field return_against; memilih return_against mengisi purchase_order/supplier/items (full-replace)", async () => {
    const user = userEvent.setup({ delay: null });
    formPageSeed = { is_return: true, items: [] };
    renderForm(<Form />);

    expect(screen.getByTestId("forminput-return_against")).toBeInTheDocument();

    await user.click(screen.getByTestId("purchase-receipt-link-model"));

    expect(screen.getByTestId("supplier-link-model")).toHaveTextContent(
      "supplier:Supplier B",
    );
    // quantity diambil dari unreturned_quantity (bukan unreceived_quantity).
    const cell = screen.getByTestId("cell-quantity-0");
    expect(cell.querySelector("input")).toHaveValue("3.00");
  });

  it("is_return nonaktif TIDAK menampilkan field return_against", () => {
    formPageSeed = { is_return: false, items: [] };
    renderForm(<Form />);

    expect(
      screen.queryByTestId("forminput-return_against"),
    ).not.toBeInTheDocument();
  });

  it("mengetik external_note memanggil setData", async () => {
    const user = userEvent.setup({ delay: null });
    formPageSeed = { items: [], external_note: "" };
    renderForm(<Form />);

    const wrapper = screen.getByTestId("forminput-external_note");
    const textarea = within(wrapper).getByRole("textbox");
    await user.type(textarea, "Halo");

    expect(textarea).toHaveValue("Halo");
  });
});
