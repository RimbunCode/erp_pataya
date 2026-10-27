import React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import DefaultRulesSettings, {
  duplicateRuleItem,
} from "./DefaultRulesSettings";

const requests = vi.hoisted(() => ({
  put: vi.fn(),
  post: vi.fn(),
  setData: vi.fn(),
}));

vi.mock("@inertiajs/react", () => ({
  router: { put: requests.put },
  useHttp: () => ({
    setData: requests.setData,
    put: requests.put,
    post: requests.post,
    processing: false,
    errors: {},
  }),
}));

vi.mock("@/Components/FormTable", () => ({
  default: ({
    name,
    label,
    columns,
    value = [],
    onValueChange,
    disabled,
    defaultValueRow = {},
    keyItem = "id",
  }) => {
    const rows = [
      ...value,
      { ...defaultValueRow, [keyItem]: `draft-${name}-${value.length}` },
    ];

    return (
      <section
        role="region"
        data-testid={`form-table-${name}`}
        aria-label={label}
        data-default-value-row={JSON.stringify(defaultValueRow)}
      >
        <button
          type="button"
          disabled={disabled}
          onClick={() =>
            onValueChange([
              ...value,
              { ...defaultValueRow, [keyItem]: `added-${value.length}` },
            ])
          }
        >
          Add {name}
        </button>
        {rows.map((row, index) => (
          <div key={row.__row_key ?? `empty-${index}`}>
            {columns.map((column) => (
              <div key={column.name}>
                {column.cell(
                  {
                    data: row[column.name],
                    dataRow: row,
                    index,
                    attributes: {
                      name: column.name,
                      className: "formtable-cell",
                      readOnly: disabled,
                    },
                    setData: (field, nextValue) => {
                      const changes =
                        typeof field === "object"
                          ? field
                          : { [field]: nextValue };
                      const nextRows = value.map((currentRow, rowIndex) =>
                        rowIndex === index
                          ? { ...currentRow, ...changes }
                          : currentRow,
                      );
                      if (index === value.length) {
                        nextRows.push({
                          ...defaultValueRow,
                          [keyItem]: `draft-${name}-${value.length}`,
                          ...changes,
                        });
                      }
                      onValueChange(nextRows);
                    },
                  },
                  index,
                )}
              </div>
            ))}
          </div>
        ))}
      </section>
    );
  },
}));

vi.mock("@/Components/Select", () => ({
  default: ({
    id,
    "aria-label": ariaLabel,
    value,
    onValueChange,
    options = [],
    readOnly,
    disabled,
    className,
  }) => (
    <select
      id={id}
      aria-label={ariaLabel}
      value={value ?? ""}
      disabled={disabled || readOnly}
      className={className}
      onChange={(event) => onValueChange(event.target.value || undefined)}
    >
      <option value="" />
      {options.map((option) => {
        const normalized =
          typeof option === "object" ? option : { value: option };
        return (
          <option key={normalized.value} value={normalized.value}>
            {normalized.label ?? normalized.value}
          </option>
        );
      })}
    </select>
  ),
}));

vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({ t: (key) => key }),
}));

vi.mock("@/Pages/Inventory/Items/ItemLinkModel", () => ({
  default: ({ onValueChange, disabled }) => (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onValueChange({ id: "item-1", name: "Widget" })}
    >
      Choose item
    </button>
  ),
}));

vi.mock("@/Pages/Finances/Taxes/TaxLinkModel", () => ({
  default: ({
    value,
    onValueChange,
    placeholder,
    readOnly,
    disabled,
    className,
    name,
  }) => (
    <input
      data-testid="tax-link-model"
      aria-label={name ?? placeholder}
      placeholder={placeholder}
      value={value?.name ?? ""}
      disabled={readOnly || disabled}
      className={className}
      onChange={(event) =>
        onValueChange({ id: event.target.value, name: event.target.value })
      }
    />
  ),
}));

vi.mock("@/Pages/Inventory/Warehouses/WarehouseLinkModel", () => ({
  default: ({
    value,
    onValueChange,
    placeholder,
    readOnly,
    disabled,
    className,
    name,
  }) => (
    <input
      data-testid="warehouse-link-model"
      aria-label={name ?? placeholder}
      placeholder={placeholder}
      value={value?.name ?? ""}
      disabled={readOnly || disabled}
      className={className}
      onChange={(event) =>
        onValueChange({ id: event.target.value, name: event.target.value })
      }
    />
  ),
}));

vi.mock("@/Pages/Inventory/Categories/CategoryLinkModel", () => ({
  default: ({
    value,
    onValueChange,
    placeholder,
    readOnly,
    disabled,
    className,
    name,
  }) => (
    <input
      data-testid="category-link-model"
      aria-label={name ?? placeholder}
      placeholder={placeholder}
      value={value?.name ?? ""}
      disabled={readOnly || disabled}
      className={className}
      onChange={(event) =>
        onValueChange({ id: event.target.value, name: event.target.value })
      }
    />
  ),
}));

const itemTypeOptions = [
  { value: "inventory", label: "Inventaris" },
  { value: "vehicle", label: "Kendaraan" },
  { value: "service", label: "Jasa/Layanan" },
];

describe("DefaultRulesSettings RTL", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requests.put.mockResolvedValue({});
    requests.post.mockResolvedValue({
      items: { "item-1": { tax_ids: ["tax-1"], warehouse_id: "warehouse-1" } },
    });
  });

  it("registers the save action with its parent and hides its own save button", async () => {
    const registerSaveHandler = vi.fn();
    render(
      <DefaultRulesSettings
        moduleKey="purchase"
        registerSaveHandler={registerSaveHandler}
      />,
    );

    await waitFor(() =>
      expect(registerSaveHandler).toHaveBeenCalledWith(
        expect.any(Function),
        expect.objectContaining({ onSuccess: expect.any(Function) }),
        false,
      ),
    );
    expect(
      screen.queryByRole("button", { name: "purchase.setting.rules.save" }),
    ).not.toBeInTheDocument();
  });

  it("keeps the draft base version when refreshed props provide a newer version", () => {
    const registerSaveHandler = vi.fn();
    const props = {
      moduleKey: "purchase",
      defaultRulesVersion: "version-a",
      defaultTaxRules: [{ id: "tax-rule", item_type: "goods", priority: 0 }],
      registerSaveHandler,
    };
    const { rerender } = render(<DefaultRulesSettings {...props} />);
    fireEvent.change(screen.getAllByRole("spinbutton")[0], {
      target: { value: "3" },
    });
    rerender(
      <DefaultRulesSettings {...props} defaultRulesVersion="version-b" />,
    );

    const prepareSave = registerSaveHandler.mock.calls.at(-1)[0];
    expect(prepareSave().rules_version).toBe("version-a");
  });

  it("refreshes clean rule data and its version together", async () => {
    const registerSaveHandler = vi.fn();
    const { rerender } = render(
      <DefaultRulesSettings
        moduleKey="purchase"
        defaultRulesVersion="version-a"
        defaultTaxRules={[{ id: "old-rule", item_type: "goods", priority: 0 }]}
        registerSaveHandler={registerSaveHandler}
      />,
    );
    rerender(
      <DefaultRulesSettings
        moduleKey="purchase"
        defaultRulesVersion="version-b"
        defaultTaxRules={[{ id: "new-rule", item_type: "asset", priority: 0 }]}
        registerSaveHandler={registerSaveHandler}
      />,
    );
    fireEvent.change(screen.getAllByRole("spinbutton")[0], {
      target: { value: "3" },
    });

    await waitFor(() => {
      const payload = registerSaveHandler.mock.calls.at(-1)[0]();
      expect(payload.rules_version).toBe("version-b");
      expect(payload.tax_rules[0].item_type).toBe("asset");
    });
  });

  it.each(["tax", "warehouse"])(
    "reports %s draft edits and reverting to its saved value to the parent",
    (kind) => {
      const registerSaveHandler = vi.fn();
      const { unmount } = render(
        <DefaultRulesSettings
          moduleKey="purchase"
          defaultTaxRules={[
            { id: "tax-rule", item_type: "goods", priority: 0 },
          ]}
          defaultWarehouseRules={[
            {
              id: "warehouse-rule",
              item_type: "goods",
              warehouse_id: "warehouse",
              priority: 0,
            },
          ]}
          registerSaveHandler={registerSaveHandler}
        />,
      );
      expect(registerSaveHandler.mock.calls.at(-1)[2]).toBe(false);
      const table = screen.getByTestId(
        `form-table-Default${kind === "tax" ? "Tax" : "Warehouse"}Rules`,
      );
      const priority = within(table).getAllByRole("spinbutton")[0];
      fireEvent.change(priority, { target: { value: "3" } });
      expect(registerSaveHandler.mock.calls.at(-1)[2]).toBe(true);
      fireEvent.change(priority, { target: { value: "0" } });
      expect(registerSaveHandler.mock.calls.at(-1)[2]).toBe(false);
      unmount();
      expect(registerSaveHandler).toHaveBeenLastCalledWith(null);
    },
  );

  it("removes persisted identity when FormTable duplicates a saved rule", () => {
    const savedRule = {
      id: "saved-rule",
      __row_key: "saved-rule",
      item_type: "goods",
    };
    const mappedRule = duplicateRuleItem(savedRule);

    expect(mappedRule).not.toHaveProperty("id");
    expect(mappedRule).not.toHaveProperty("__row_key");
    expect(mappedRule.item_type).toBe(savedRule.item_type);
  });

  it("renders editable tax and warehouse rules with only supplied active references", () => {
    render(
      <DefaultRulesSettings
        moduleKey="purchase"
        activeTaxes={[{ id: "tax-1", name: "Active Tax" }]}
        activeWarehouses={[{ id: "warehouse-1", name: "Active Warehouse" }]}
        defaultTaxRules={[
          {
            id: "rule-1",
            item_type: "goods",
            tax_id: "inactive-tax",
            tax: { id: "inactive-tax", name: "Inactive Tax" },
          },
        ]}
      />,
    );

    expect(
      screen.getByTestId("form-table-DefaultTaxRules"),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("form-table-DefaultWarehouseRules"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("form-table-DefaultTaxRules")).toHaveAttribute(
      "data-default-value-row",
      '{"priority":0}',
    );

    expect(
      screen.getByRole("region", { name: "purchase.setting.rules.tax.title" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("region", {
        name: "purchase.setting.rules.warehouse.title",
      }),
    ).toBeInTheDocument();
    const documentTypeFields = within(
      screen.getByTestId("form-table-DefaultTaxRules"),
    ).getAllByRole("combobox", {
      name: "purchase.setting.rules.columns.document_type",
    });
    expect(new Set(documentTypeFields.map((field) => field.id)).size).toBe(
      documentTypeFields.length,
    );
    expect(screen.getAllByTestId("tax-link-model")[0]).toHaveValue(
      "Inactive Tax",
    );
    expect(screen.getAllByRole("alert")).toHaveLength(1);
    expect(screen.getAllByRole("alert")[0]).toHaveTextContent(
      "purchase.setting.rules.reference_unavailable",
    );
  });

  it("limits warehouse rule document types to forms with warehouse defaults", async () => {
    const registerSaveHandler = vi.fn();
    render(
      <DefaultRulesSettings
        moduleKey="purchase"
        defaultWarehouseRules={[
          {
            id: "unsupported-rule",
            document_type: "purchase_invoice",
            item_type: "goods",
            warehouse_id: "warehouse-1",
          },
        ]}
        registerSaveHandler={registerSaveHandler}
      />,
    );

    const warehouseTypeSelect = within(
      screen.getByTestId("form-table-DefaultWarehouseRules"),
    ).getAllByRole("combobox", {
      name: "purchase.setting.rules.columns.document_type",
    })[0];
    expect(warehouseTypeSelect).toBeInTheDocument();
    const prepareSave = registerSaveHandler.mock.calls.at(-1)[0];
    act(() => {
      expect(prepareSave()).toBe(false);
    });
    await waitFor(() =>
      expect(screen.getAllByRole("alert").at(-1)).toHaveTextContent(
        "purchase.setting.rules.validation.warehouse_document_type",
      ),
    );
  });

  it("exposes the current validation message to the parent save handler", () => {
    const registerSaveHandler = vi.fn();
    render(
      <DefaultRulesSettings
        moduleKey="purchase"
        defaultWarehouseRules={[
          {
            id: "unsupported-rule",
            document_type: "purchase_invoice",
            item_type: "goods",
            warehouse_id: "warehouse-1",
          },
        ]}
        registerSaveHandler={registerSaveHandler}
      />,
    );

    const [, callbacks] = registerSaveHandler.mock.calls.at(-1);
    expect(callbacks.getValidationMessage()).toBe(
      "purchase.setting.rules.validation.warehouse_document_type",
    );
  });

  it("offers item types from the server as a dropdown with an unrestricted option", () => {
    render(
      <DefaultRulesSettings
        moduleKey="purchase"
        itemTypeOptions={itemTypeOptions}
      />,
    );

    expect(
      screen.queryByRole("textbox", {
        name: "purchase.setting.rules.columns.item_type",
      }),
    ).not.toBeInTheDocument();
    const select = screen.getAllByRole("combobox", {
      name: "purchase.setting.rules.columns.item_type",
    })[0];
    expect(
      within(select)
        .getAllByRole("option")
        .map((option) => [option.value, option.textContent]),
    ).toEqual([
      ["", ""],
      ["", "purchase.setting.rules.any"],
      ["inventory", "Inventaris"],
      ["vehicle", "Kendaraan"],
      ["service", "Jasa/Layanan"],
    ]);
  });

  it("keeps a saved item type that is not in the options visible", () => {
    render(
      <DefaultRulesSettings
        moduleKey="purchase"
        itemTypeOptions={itemTypeOptions}
        defaultTaxRules={[{ id: "legacy", item_type: "goods", priority: 0 }]}
      />,
    );

    const select = screen.getAllByRole("combobox", {
      name: "purchase.setting.rules.columns.item_type",
    })[0];
    expect(select).toHaveValue("goods");
    expect(
      within(select).getByRole("option", {
        name: "purchase.setting.rules.unavailable_value (goods)",
      }),
    ).toBeInTheDocument();
  });

  it("limits tax rule document types to the server list while warehouse rules stay unchanged", () => {
    render(
      <DefaultRulesSettings
        moduleKey="purchase"
        taxDocumentTypes={["purchase_order", "purchase_invoice"]}
      />,
    );
    const optionValues = (table) =>
      within(
        within(table).getAllByRole("combobox", {
          name: "purchase.setting.rules.columns.document_type",
        })[0],
      )
        .getAllByRole("option")
        .map((option) => option.value)
        .filter(Boolean);

    expect(
      optionValues(screen.getByTestId("form-table-DefaultTaxRules")),
    ).toEqual(["purchase_order", "purchase_invoice"]);
    expect(
      optionValues(screen.getByTestId("form-table-DefaultWarehouseRules")),
    ).toEqual(["purchase_order", "purchase_receipt"]);
  });

  it("shows server validation errors on the rule row and field that caused them", async () => {
    const registerSaveHandler = vi.fn();
    render(
      <DefaultRulesSettings
        moduleKey="sales"
        itemTypeOptions={itemTypeOptions}
        defaultTaxRules={[
          { id: "tax-0", item_type: "inventory", priority: 0 },
          { id: "tax-1", item_type: "vehicle", priority: 0 },
        ]}
        defaultWarehouseRules={[
          { id: "wh-0", item_type: "service", warehouse_id: "w", priority: 0 },
        ]}
        registerSaveHandler={registerSaveHandler}
      />,
    );
    const [, callbacks] = registerSaveHandler.mock.calls.at(-1);

    await act(async () => {
      callbacks.onError({
        "tax_rules.1.item_type": "Tipe barang tidak sah",
        "tax_rules.0.document_type": "Jenis dokumen tidak sah",
        "warehouse_rules.0.item_type": "Tipe barang gudang tidak sah",
      });
    });

    const taxTable = screen.getByTestId("form-table-DefaultTaxRules");
    const warehouseTable = screen.getByTestId(
      "form-table-DefaultWarehouseRules",
    );
    const combobox = (table, name, index) =>
      within(table).getAllByRole("combobox", {
        name: `sales.setting.rules.columns.${name}`,
      })[index];
    expect(
      within(taxTable).getByText("Tipe barang tidak sah")
        .previousElementSibling,
    ).toBe(combobox(taxTable, "item_type", 1));
    expect(
      within(taxTable).getByText("Jenis dokumen tidak sah")
        .previousElementSibling,
    ).toBe(combobox(taxTable, "document_type", 0));
    expect(
      within(warehouseTable).getByText("Tipe barang gudang tidak sah")
        .previousElementSibling,
    ).toBe(combobox(warehouseTable, "item_type", 0));
    expect(
      within(taxTable).queryByText("Tipe barang gudang tidak sah"),
    ).not.toBeInTheDocument();
  });

  it("preserves FormTable cell classes in custom rule controls", () => {
    render(<DefaultRulesSettings moduleKey="purchase" />);

    expect(
      screen.getAllByRole("combobox", {
        name: "purchase.setting.rules.columns.item_type",
      })[0],
    ).toHaveClass("formtable-cell");
    expect(
      screen.getAllByRole("combobox", {
        name: "purchase.setting.rules.columns.document_type",
      })[0],
    ).toHaveClass("formtable-cell");
  });

  it("submits both rule collections to the module endpoint", async () => {
    const user = userEvent.setup();
    render(
      <DefaultRulesSettings
        moduleKey="purchase"
        itemTypeOptions={itemTypeOptions}
      />,
    );

    await user.selectOptions(
      screen.getAllByRole("combobox", {
        name: "purchase.setting.rules.columns.item_type",
      })[0],
      "inventory",
    );
    await user.click(
      screen.getByRole("button", { name: "purchase.setting.rules.save" }),
    );

    await waitFor(() =>
      expect(requests.put).toHaveBeenCalledWith(
        "/settings/modules/purchase/default-rules",
        {
          tax_rules: [
            expect.objectContaining({
              item_type: "inventory",
              tax_id: null,
              is_stock_item: null,
            }),
          ],
          warehouse_rules: [],
        },
        expect.objectContaining({
          preserveScroll: true,
          onSuccess: expect.any(Function),
          onError: expect.any(Function),
        }),
      ),
    );
    expect(requests.put.mock.calls[0][1].tax_rules[0]).not.toHaveProperty("id");
  });

  it("stores LinkModel selections as relation IDs in the API payload", async () => {
    const user = userEvent.setup();
    render(
      <DefaultRulesSettings
        moduleKey="purchase"
        itemTypeOptions={itemTypeOptions}
      />,
    );

    await user.selectOptions(
      screen.getAllByRole("combobox", {
        name: "purchase.setting.rules.columns.item_type",
      })[0],
      "inventory",
    );
    await user.type(
      screen.getAllByTestId("category-link-model")[0],
      "category-2",
    );
    await user.type(screen.getAllByTestId("tax-link-model")[0], "tax-2");
    const warehouseTable = screen.getByTestId(
      "form-table-DefaultWarehouseRules",
    );
    await user.selectOptions(
      within(warehouseTable).getAllByRole("combobox", {
        name: "purchase.setting.rules.columns.item_type",
      })[0],
      "vehicle",
    );
    await user.type(
      within(warehouseTable).getAllByTestId("warehouse-link-model")[0],
      "warehouse-2",
    );
    await user.click(
      screen.getByRole("button", { name: "purchase.setting.rules.save" }),
    );

    await waitFor(() => expect(requests.put).toHaveBeenCalledTimes(1));
    expect(requests.put.mock.calls[0][1].tax_rules[0]).toMatchObject({
      item_type: "inventory",
      tax_id: "tax-2",
      item_category_id: "category-2",
    });
    expect(requests.put.mock.calls[0][1].tax_rules[0]).not.toHaveProperty(
      "tax",
    );
    expect(requests.put.mock.calls[0][1].tax_rules[0]).not.toHaveProperty(
      "item_category",
    );
    expect(requests.put.mock.calls[0][1].warehouse_rules[0]).toMatchObject({
      item_type: "vehicle",
      warehouse_id: "warehouse-2",
    });
    expect(requests.put.mock.calls[0][1].warehouse_rules[0]).not.toHaveProperty(
      "warehouse",
    );
  });

  it("rejects duplicate condition sets before saving", async () => {
    const user = userEvent.setup();
    render(
      <DefaultRulesSettings
        moduleKey="sales"
        itemTypeOptions={itemTypeOptions}
      />,
    );

    await user.selectOptions(
      screen.getAllByRole("combobox", {
        name: "sales.setting.rules.columns.item_type",
      })[0],
      "inventory",
    );
    await user.selectOptions(
      screen.getAllByRole("combobox", {
        name: "sales.setting.rules.columns.item_type",
      })[1],
      "inventory",
    );
    await user.click(
      screen.getByRole("button", { name: "sales.setting.rules.save" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "sales.setting.rules.validation.duplicate",
    );
    expect(requests.put).not.toHaveBeenCalled();
  });

  it("keeps a new wildcard stock condition distinct from a non-stock condition", async () => {
    const user = userEvent.setup();
    render(<DefaultRulesSettings moduleKey="sales" />);
    const table = screen.getByTestId("form-table-DefaultTaxRules");
    await user.selectOptions(
      within(table).getAllByRole("combobox", {
        name: "sales.setting.rules.columns.document_type",
      })[0],
      "sales_invoice",
    );
    await user.selectOptions(
      within(table).getAllByRole("combobox", {
        name: "sales.setting.rules.columns.document_type",
      })[1],
      "sales_invoice",
    );
    await user.selectOptions(
      within(table).getAllByRole("combobox", {
        name: "sales.setting.rules.columns.is_stock_item",
      })[1],
      "false",
    );
    await user.click(
      screen.getByRole("button", { name: "sales.setting.rules.save" }),
    );
    expect(requests.put).toHaveBeenCalledOnce();
    expect(
      requests.put.mock.calls[0][1].tax_rules.map((rule) => rule.is_stock_item),
    ).toEqual([null, false]);
  });

  it.each([
    ["onNetworkError", true],
    ["onHttpException", true],
    ["onFinish", false],
  ])(
    "handles the registered parent save after %s and allows retry",
    (callback, failed) => {
      const registerSaveHandler = vi.fn();
      render(
        <DefaultRulesSettings
          moduleKey="sales"
          registerSaveHandler={registerSaveHandler}
        />,
      );
      const [preparePayload, callbacks] = registerSaveHandler.mock.calls.at(-1);
      expect(preparePayload()).toEqual({ tax_rules: [], warehouse_rules: [] });
      act(() => {
        callbacks[callback]?.();
        callbacks.onFinish();
      });
      if (failed) {
        expect(screen.getByRole("alert")).toHaveTextContent(
          "sales.setting.rules.save_failed",
        );
      } else {
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      }
      expect(preparePayload()).toEqual({ tax_rules: [], warehouse_rules: [] });
    },
  );

  it.each(["success", "error"])(
    "locks all controls until a pending save finishes with %s and preserves the draft",
    async (outcome) => {
      const user = userEvent.setup();
      let pendingSave;
      requests.put.mockImplementation((_url, _data, options) => {
        pendingSave = options;
        options.onStart();
      });
      render(
        <DefaultRulesSettings
          moduleKey="sales"
          itemTypeOptions={itemTypeOptions}
          categories={[{ id: "category-1", name: "Goods" }]}
          activeTaxes={[{ id: "tax-1", name: "Tax" }]}
          activeWarehouses={[{ id: "warehouse-1", name: "Warehouse" }]}
          defaultTaxRules={[
            { id: "rule-1", item_type: "inventory", tax_id: null },
          ]}
          defaultWarehouseRules={[
            {
              id: "rule-2",
              item_type: "inventory",
              warehouse_id: "warehouse-1",
            },
          ]}
        />,
      );
      const taxTable = screen.getByTestId("form-table-DefaultTaxRules");
      const warehouseTable = screen.getByTestId(
        "form-table-DefaultWarehouseRules",
      );
      const itemTypeSelect = (table) =>
        within(table).getAllByRole("combobox", {
          name: "sales.setting.rules.columns.item_type",
        })[0];
      const taxItemType = itemTypeSelect(taxTable);
      const warehouseItemType = itemTypeSelect(warehouseTable);
      await user.selectOptions(taxItemType, "service");
      await user.selectOptions(warehouseItemType, "vehicle");
      await user.click(
        screen.getByRole("button", { name: "sales.setting.rules.save" }),
      );

      for (const control of screen
        .getAllByRole("textbox")
        .concat(
          screen.getAllByRole("combobox"),
          screen.getAllByRole("spinbutton"),
          screen.getAllByRole("button"),
        )) {
        expect(control).toBeDisabled();
      }
      await user.selectOptions(taxItemType, "inventory");
      await user.selectOptions(warehouseItemType, "inventory");
      await user.click(
        within(taxTable).getByRole("button", { name: "Add DefaultTaxRules" }),
      );
      await user.click(
        within(warehouseTable).getByRole("button", {
          name: "Add DefaultWarehouseRules",
        }),
      );
      expect(taxItemType).toHaveValue("service");
      expect(warehouseItemType).toHaveValue("vehicle");
      expect(requests.put).toHaveBeenCalledTimes(1);
      const submitted = requests.put.mock.calls[0][1];
      expect(submitted.tax_rules).toHaveLength(1);
      expect(submitted.tax_rules[0]).toMatchObject({
        item_type: "service",
        tax_id: null,
      });
      expect(submitted.warehouse_rules).toHaveLength(1);
      expect(submitted.warehouse_rules[0]).toMatchObject({
        item_type: "vehicle",
      });

      await act(async () => {
        if (outcome === "success") {
          pendingSave.onSuccess({
            props: {
              defaultTaxRules: submitted.tax_rules,
              defaultWarehouseRules: submitted.warehouse_rules,
            },
          });
        } else {
          pendingSave.onError({ tax_rules: "Save failed" });
        }
        pendingSave.onFinish();
      });

      expect(itemTypeSelect(taxTable)).toHaveValue("service");
      expect(itemTypeSelect(warehouseTable)).toHaveValue("vehicle");
      expect(within(taxTable).getAllByTestId("tax-link-model")[0]).toHaveValue(
        "",
      );
      for (const control of screen
        .getAllByRole("textbox")
        .concat(
          screen.getAllByRole("combobox"),
          screen.getAllByRole("spinbutton"),
          screen.getAllByRole("button"),
        )) {
        expect(control).toBeEnabled();
      }
      await user.selectOptions(itemTypeSelect(taxTable), "vehicle");
      expect(itemTypeSelect(taxTable)).toHaveValue("vehicle");
    },
  );

  it("previews the selected item through the defaults resolver", async () => {
    const user = userEvent.setup();
    render(<DefaultRulesSettings moduleKey="sales" />);

    fireEvent.change(
      screen.getByRole("combobox", {
        name: "sales.setting.rules.preview_document_type",
      }),
      {
        target: { value: "sales_order" },
      },
    );
    await user.click(screen.getByRole("button", { name: "Choose item" }));
    await user.click(
      screen.getByRole("button", { name: "sales.setting.rules.preview" }),
    );

    await waitFor(() =>
      expect(requests.post).toHaveBeenCalledWith("/defaults/resolve"),
    );
    expect(requests.post).toHaveBeenCalledTimes(1);
    expect(
      screen.getByText("sales.setting.rules.preview_tax: tax-1"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("sales.setting.rules.preview_warehouse: warehouse-1"),
    ).toBeInTheDocument();
  });

  it("ignores a preview result after its document type changes", async () => {
    const user = userEvent.setup();
    let resolvePreview;
    requests.post.mockReturnValueOnce(
      new Promise((resolve) => {
        resolvePreview = resolve;
      }),
    );
    render(<DefaultRulesSettings moduleKey="sales" />);

    const documentTypeSelect = screen.getByRole("combobox", {
      name: "sales.setting.rules.preview_document_type",
    });
    fireEvent.change(documentTypeSelect, {
      target: { value: "sales_order" },
    });
    await user.click(screen.getByRole("button", { name: "Choose item" }));
    await user.click(
      screen.getByRole("button", { name: "sales.setting.rules.preview" }),
    );

    fireEvent.change(documentTypeSelect, {
      target: { value: "delivery_note" },
    });
    await act(async () => {
      resolvePreview({
        items: {
          "item-1": { tax_ids: ["old-tax"], warehouse_id: "old-warehouse" },
        },
      });
    });

    expect(
      screen.queryByText("sales.setting.rules.preview_tax: old-tax"),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
