import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";

// Integrasi default modul pada Purchase Order dengan FormTable ASLI (tidak di-mock):
// baris hasil konversi dari dokumen sumber (PR/WorkOrder, memakai
// referenceable_id) tidak boleh ikut mendapat pajak/gudang default, sedangkan
// baris manual baru terisi.

const stableT = (key) => key;
vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({ t: stableT }),
}));

const usePageMock = vi.fn();
vi.mock("@inertiajs/react", () => ({
  usePage: () => usePageMock(),
}));

const axiosPost = vi.fn();
vi.mock("axios", () => ({
  default: { post: (...args) => axiosPost(...args) },
}));

vi.mock("@/Pages/Core/FormPage", () => ({
  FormPageContent: ({ title, children }) => (
    <section>
      {title && <h3>{title}</h3>}
      {children}
    </section>
  ),
  FormChildren: ({ children }) => <div>{children}</div>,
  useFormPage: () => undefined,
  useFormPageMeta: () => null,
}));
vi.mock("@/Hooks/useCanUpdate", () => ({ default: () => true }));
vi.mock("@/Hooks/use-mobile", () => ({ useIsMobile: () => false }));
vi.mock("@/Components/ui/tooltip", () => ({
  Tooltip: ({ children }) => <>{children}</>,
  TooltipTrigger: ({ children }) => <>{children}</>,
  TooltipContent: () => null,
  TooltipProvider: ({ children }) => <>{children}</>,
}));

vi.mock("@/Components/SelectModel", () => ({
  default: () => null,
  loadFromModel: vi.fn(),
}));
vi.mock("@/Pages/Core/CurrencyLinkModel", () => ({ default: () => <div /> }));
vi.mock("../Suppliers/SupplierLinkModel", () => ({ default: () => <div /> }));
vi.mock("@/Pages/Inventory/Items/ItemBarcode", () => ({
  default: () => <div />,
}));
vi.mock("@/Components/DatetimePicker", () => ({ default: () => <div /> }));
vi.mock("./ItemForm", () => ({ default: () => <div /> }));
vi.mock("@/Pages/Finances/Components/AdditionalDiscount", () => ({
  default: () => <div />,
}));
vi.mock("@/Pages/Finances/Components/PaymentSchedule", () => ({
  default: () => <div />,
}));
vi.mock("@/Pages/Inventory/Items/ItemUnitLinkModel", () => ({
  default: () => <span />,
}));
vi.mock("@/Pages/Finances/Taxes/TaxLinkModel", () => ({
  default: () => <span />,
}));
vi.mock("@/Pages/Inventory/Warehouses/WarehouseLinkModel", () => ({
  default: ({ name, value }) => (
    <span data-testid={name ? `cell-${name}` : "header-warehouse"}>
      {value?.name ?? "none"}
    </span>
  ),
}));
vi.mock("@/Pages/Inventory/Items/ItemVariantLinkModel", () => ({
  default: ({ value, onValueChange }) => (
    <button
      type="button"
      data-testid={`item-${value?.id ?? "empty"}`}
      onClick={() =>
        onValueChange({
          id: "item-manual",
          is_stock_item: true,
          default_uom: { id: "u-default", conversion_factor: 1 },
        })
      }
    />
  ),
}));
vi.mock("@/Components/NumberInput", () => ({
  default: ({ name, value, onValueChange }) => (
    <input
      data-testid={name ? `number-${name}` : undefined}
      value={value ?? ""}
      onChange={(event) => onValueChange?.(Number(event.target.value))}
    />
  ),
}));

import { PurchaseOrderFields } from "./Form";

const moduleTax = { id: "tax-module", name: "PPN", rate: 11 };
const moduleWarehouse = { id: "wh-module", name: "Gudang Modul" };
const stockItem = { id: "item-source", is_stock_item: true };

let latest;

function Harness({ items }) {
  const [data, setData] = useState({ date: new Date(), items });
  latest = data;
  const update = (arg, value) =>
    setData((prev) => {
      if (typeof arg === "function") return arg(prev);
      if (typeof arg === "string") return { ...prev, [arg]: value };
      return arg;
    });

  return (
    <PurchaseOrderFields
      data={data}
      setData={update}
      defaultData={{}}
      disabled={false}
      isCreate
    />
  );
}

const resolveCalls = () =>
  axiosPost.mock.calls.filter(([url]) => url === "/defaults/resolve");

describe("Purchase Order Form dengan FormTable asli: default modul", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    usePageMock.mockReturnValue({
      props: {
        preferences: { default_currency_id: "idr" },
        loadFrom: null,
        defaults: { tax: moduleTax, warehouse: moduleWarehouse },
      },
    });
    axiosPost.mockResolvedValue({ data: { items: {} } });
  });

  it("baris hasil konversi dari sumber tetap tanpa pajak dan gudang default", async () => {
    render(
      <Harness
        items={[
          {
            id: "src-1",
            item: stockItem,
            quantity: 3,
            rate: 100,
            referenceable_type: "App\\Models\\Purchase\\PurchaseRequest",
            referenceable_id: 5,
          },
        ]}
      />,
    );

    fireEvent.change(screen.getAllByTestId("number-quantity")[0], {
      target: { value: "4" },
    });

    await waitFor(() => expect(latest.items[0].quantity).toBe(4));
    expect(latest.items[0].tax).toBeUndefined();
    expect(latest.items[0].tax_rate).toBeUndefined();
    expect(latest.items[0].target_warehouse).toBeUndefined();
    expect(resolveCalls()).toHaveLength(0);
  });

  it("baris manual baru terisi pajak dan gudang default tanpa mengubah baris sumber", async () => {
    render(
      <Harness
        items={[
          {
            id: "src-1",
            item: stockItem,
            quantity: 3,
            rate: 100,
            referenceable_type: "App\\Models\\Purchase\\PurchaseRequest",
            referenceable_id: 5,
          },
        ]}
      />,
    );

    await userEvent.click(screen.getByTestId("item-empty"));

    await waitFor(() => expect(latest.items).toHaveLength(2));
    const [source, manual] = latest.items;
    expect(manual.tax).toEqual(moduleTax);
    expect(manual.tax_rate).toBe(11);
    expect(manual.target_warehouse).toEqual(moduleWarehouse);
    expect(source.tax).toBeUndefined();
    expect(source.target_warehouse).toBeUndefined();
    await waitFor(() => expect(resolveCalls()).toHaveLength(1));
    expect(resolveCalls()[0][1]).toEqual({
      document_type: "purchase_order",
      items: [{ item_id: "item-manual" }],
    });
  });
});
