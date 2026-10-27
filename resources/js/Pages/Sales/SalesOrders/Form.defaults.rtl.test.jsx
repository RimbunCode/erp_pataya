import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useCallback, useState } from "react";

// Integrasi default modul pada Sales Order dengan FormTable ASLI (tidak di-mock):
// FormTable menggabungkan `defaultValueRow` ke SEMUA baris, jadi test ini
// membuktikan baris hasil konversi dari dokumen sumber tidak ikut mendapat
// pajak/gudang default (Req 2.2), sedangkan baris manual baru terisi.

const stableT = (key) => key;
vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({ t: stableT }),
}));

window.route = (name) => name;

const usePageMock = vi.fn();
vi.mock("@inertiajs/react", () => ({
  usePage: () => usePageMock(),
}));

const axiosPost = vi.fn();
vi.mock("axios", () => ({
  default: { post: (...args) => axiosPost(...args) },
}));

vi.mock("@/Pages/Core/FormPage", async () => {
  const React = await import("react");
  const ctx = React.createContext();
  return {
    FormPageContent: ({ title, children }) => (
      <section>
        {title && <h3>{title}</h3>}
        {children}
      </section>
    ),
    FormChildren: ({ children }) => <div>{children}</div>,
    useFormPage: () => React.useContext(ctx),
    useFormPageMeta: () => null,
    FormPageContext: ctx,
  };
});
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
vi.mock("@/Pages/Sales/Customers/CustomerLinkModel", () => ({
  default: () => <div />,
}));
vi.mock("@/Pages/Settings/Branches/BranchLinkModel", () => ({
  default: () => <div />,
}));
vi.mock("@/Pages/Core/CurrencyLinkModel", () => ({ default: () => <div /> }));
vi.mock("./SalesOrderLinkModel", () => ({ default: () => <div /> }));
vi.mock("@/Components/LinkModel", () => ({ default: () => <div /> }));
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
vi.mock("@/Pages/Inventory/Warehouses/WarehouseLinkModel", () => ({
  default: ({ name, value }) => (
    <span data-testid={name ? `cell-${name}` : "header-warehouse"}>
      {value?.name ?? "none"}
    </span>
  ),
}));
vi.mock("@/Pages/Finances/Taxes/TaxLinkModel", () => ({
  default: ({ value, required }) => (
    <input
      data-testid="cell-tax"
      required={!!required}
      value={value?.name ?? ""}
      onChange={() => {}}
    />
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
vi.mock("@/Pages/Inventory/Items/ItemUnitLinkModel", () => ({
  default: () => <span />,
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

import { FormPageContext } from "@/Pages/Core/FormPage";
import Form from "./Form";

const moduleTax = { id: "tax-module", name: "PPN", rate: 11 };
const moduleWarehouse = { id: "wh-module", name: "Gudang Modul" };
const stockItem = { id: "item-source", is_stock_item: true };

function FormState({ initial, stateRef, children }) {
  const [data, setDataState] = useState(initial.data);
  const setData = useCallback((arg, value) => {
    setDataState((prev) => {
      if (typeof arg === "function") return arg(prev);
      if (typeof arg === "string") return { ...prev, [arg]: value };
      return arg;
    });
  }, []);
  stateRef.data = data;

  return (
    <FormPageContext.Provider
      value={{
        data,
        setData,
        defaultData: initial.defaultData ?? {},
        disabled: false,
        isCreate: initial.isCreate ?? true,
        errors: initial.errors ?? {},
      }}
    >
      {children}
    </FormPageContext.Provider>
  );
}

function renderCreateForm({ items, defaultData, errors, isCreate = true }) {
  const stateRef = {};
  render(
    <FormState
      initial={{
        data: { date: new Date(), items },
        defaultData,
        errors,
        isCreate,
      }}
      stateRef={stateRef}
    >
      <form data-testid="doc-form">
        <Form />
      </form>
    </FormState>,
  );
  return stateRef;
}

const editFirstRowQuantity = () =>
  fireEvent.change(screen.getAllByTestId("number-quantity")[0], {
    target: { value: "5" },
  });

let resolvedItems = {};

const resolveCalls = () =>
  axiosPost.mock.calls.filter(([url]) => url === "/defaults/resolve");

describe("Sales Order Form dengan FormTable asli: default modul", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    usePageMock.mockReturnValue({
      props: {
        preferences: { default_currency_id: "idr" },
        loadFrom: null,
        defaults: { tax: moduleTax, warehouse: moduleWarehouse },
      },
    });
    resolvedItems = {};
    axiosPost.mockImplementation((url) =>
      Promise.resolve({
        data: url === "/defaults/resolve" ? { items: resolvedItems } : {},
      }),
    );
  });

  it("baris hasil konversi Quotation tetap tanpa pajak dan gudang default setelah diedit", async () => {
    const sourceRow = {
      id: "src-1",
      item: stockItem,
      quantity: 2,
      price: 1000,
    };
    const stateRef = renderCreateForm({
      items: [sourceRow],
      defaultData: {
        referenceable_type: "App\\Models\\CRM\\Quotation",
        items: [{ id: "src-1" }],
      },
    });

    editFirstRowQuantity();

    await waitFor(() => expect(stateRef.data.items[0].quantity).toBe(5));
    const row = stateRef.data.items[0];
    expect(row.tax).toBeUndefined();
    expect(row.source_warehouse).toBeUndefined();
    expect(screen.getAllByTestId("cell-source_warehouse")[0]).toHaveTextContent(
      "none",
    );
    expect(resolveCalls()).toHaveLength(0);
  });

  it("baris dari dokumen sumber per-baris (referenceable_id) tidak ikut menerima pajak default", async () => {
    const stateRef = renderCreateForm({
      items: [
        {
          id: "src-1",
          item: stockItem,
          quantity: 1,
          referenceable_type: "App\\Models\\Service\\WorkOrderItem",
          referenceable_id: 7,
        },
      ],
      defaultData: {},
    });

    editFirstRowQuantity();

    await waitFor(() => expect(stateRef.data.items[0].quantity).toBe(5));
    expect(stateRef.data.items[0].tax).toBeUndefined();
    expect(stateRef.data.items[0].source_warehouse).toBeUndefined();
  });

  it("baris manual baru terisi pajak dan gudang default, baris sumber tidak berubah", async () => {
    const sourceRow = {
      id: "src-1",
      item: stockItem,
      quantity: 2,
      price: 1000,
    };
    const stateRef = renderCreateForm({
      items: [sourceRow],
      defaultData: {
        referenceable_type: "App\\Models\\CRM\\Quotation",
        items: [{ id: "src-1" }],
      },
    });

    await userEvent.click(screen.getByTestId("item-empty"));

    await waitFor(() => expect(stateRef.data.items).toHaveLength(2));
    const [source, manual] = stateRef.data.items;
    expect(manual.item.id).toBe("item-manual");
    expect(manual.tax).toEqual(moduleTax);
    expect(manual.tax_rate).toBe(11);
    expect(manual.source_warehouse).toEqual(moduleWarehouse);
    expect(source.tax).toBeUndefined();
    expect(source.source_warehouse).toBeUndefined();
    await waitFor(() => expect(resolveCalls()).toHaveLength(1));
    expect(resolveCalls()[0][1]).toEqual({
      document_type: "sales_order",
      items: [{ item_id: "item-manual" }],
    });
  });
  describe("pajak wajib pada baris (kecuali tax_optional)", () => {
    const sourceRow = {
      id: "src-1",
      item: stockItem,
      quantity: 2,
      price: 1000,
    };
    const sourceCreate = () =>
      renderCreateForm({
        items: [sourceRow],
        defaultData: {
          referenceable_type: "App\\Models\\CRM\\Quotation",
          items: [{ id: "src-1" }],
        },
      });

    it("baris manual yang di-resolve tax_optional:false dan kosong ditandai wajib dan memblokir submit", async () => {
      resolvedItems = {
        "item-manual": {
          tax_ids: [],
          taxes: [],
          tax_optional: false,
          warehouse_id: null,
        },
      };
      const stateRef = sourceCreate();

      await userEvent.click(screen.getByTestId("item-empty"));
      await waitFor(() => expect(resolveCalls()).toHaveLength(1));
      await waitFor(() => expect(stateRef.data.items[1]?.tax).toBeNull(), {
        timeout: 4000,
      });

      await waitFor(
        () => expect(screen.getAllByTestId("cell-tax")[1]).toBeRequired(),
        { timeout: 4000 },
      );
      expect(screen.getByTestId("doc-form").checkValidity()).toBe(false);
    });

    it("baris sumber yang belum pernah di-resolve tidak memblokir submit walau pajak kosong", () => {
      sourceCreate();

      const [sourceTax] = screen.getAllByTestId("cell-tax");
      expect(sourceTax).toHaveValue("");
      expect(sourceTax).not.toBeRequired();
      expect(screen.getByTestId("doc-form").checkValidity()).toBe(true);
    });

    it("baris pada mode edit tanpa pajak tidak memakai required native dan submit tidak diblokir", () => {
      renderCreateForm({
        isCreate: false,
        items: [sourceRow],
        defaultData: {},
      });

      const [tax] = screen.getAllByTestId("cell-tax");
      expect(tax).toHaveValue("");
      expect(tax).not.toBeRequired();
      expect(screen.getByTestId("doc-form").checkValidity()).toBe(true);
      expect(resolveCalls()).toHaveLength(0);
    });

    it("baris dengan tax_optional dari resolusi boleh kosong dan tidak ditandai wajib", async () => {
      resolvedItems = {
        "item-manual": {
          tax_ids: [],
          taxes: [],
          tax_optional: true,
          warehouse_id: null,
        },
      };
      const stateRef = sourceCreate();

      await userEvent.click(screen.getByTestId("item-empty"));

      await waitFor(() => expect(stateRef.data.items[1]?.tax).toBeNull(), {
        timeout: 4000,
      });
      await waitFor(
        () => expect(screen.getAllByTestId("cell-tax")[1]).not.toBeRequired(),
        { timeout: 4000 },
      );
      expect(screen.getAllByTestId("cell-tax")[1]).toHaveValue("");
      expect(screen.getByTestId("doc-form").checkValidity()).toBe(true);
    });

    it("menampilkan galat server items.N.tax.id pada sel pajak baris yang benar", () => {
      renderCreateForm({
        items: [sourceRow, { ...sourceRow, id: "src-2" }],
        defaultData: {},
        errors: { "items.1.tax.id": "Pajak wajib diisi." },
      });

      const message = screen.getByText("Pajak wajib diisi.");
      expect(screen.getAllByText("Pajak wajib diisi.")).toHaveLength(1);
      expect(message.previousElementSibling).toBe(
        screen.getAllByTestId("cell-tax")[1],
      );
    });
  });
});
