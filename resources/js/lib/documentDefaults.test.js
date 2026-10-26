import { describe, expect, it } from "vitest";
import {
  applyResolvedToNewLine,
  applyToNewLine,
  paymentTemplateToSchedule,
} from "./documentDefaults";

describe("document defaults", () => {
  it("preserves cleared fields in synchronous defaults for a replacement item", () => {
    const item = { id: "replacement", is_stock_item: true };
    const line = {
      id: "row-1",
      item,
      tax: null,
      tax_rate: 0,
      target_warehouse: null,
    };
    expect(
      applyToNewLine(
        line,
        item,
        {
          tax: { id: "module-tax", rate: 11 },
          warehouse: { id: "module-warehouse" },
        },
        {
          warehouseField: "target_warehouse",
          isFieldEdited: (rowId, field) =>
            rowId === "row-1" && ["tax", "target_warehouse"].includes(field),
        },
      ),
    ).toEqual(line);
  });

  it("fills only empty tax and warehouse on manual stock rows", () => {
    const defaults = {
      tax: { id: "tax-1", rate: 11 },
      warehouse: { id: "warehouse-1" },
    };
    const item = { is_stock_item: true };

    expect(
      applyToNewLine({ item, tax: null }, item, defaults, {
        warehouseField: "target_warehouse",
      }),
    ).toMatchObject({
      tax: defaults.tax,
      tax_rate: 11,
      target_warehouse: defaults.warehouse,
    });
  });

  it("does not override selected values, source rows, or warehouses for non-stock items", () => {
    const defaults = {
      tax: { id: "default-tax", rate: 11 },
      warehouse: { id: "default-warehouse" },
    };
    const existingTax = { id: "existing-tax", rate: 5 };
    const selectedWarehouse = { id: "selected-warehouse" };

    expect(
      applyToNewLine(
        { tax: existingTax, target_warehouse: selectedWarehouse },
        { is_stock_item: true },
        defaults,
        { warehouseField: "target_warehouse" },
      ),
    ).toMatchObject({ tax: existingTax, target_warehouse: selectedWarehouse });
    expect(
      applyToNewLine(
        { referenceable_id: "source-1" },
        { is_stock_item: true },
        defaults,
        { warehouseField: "target_warehouse" },
      ),
    ).toEqual({ referenceable_id: "source-1" });
    expect(
      applyToNewLine({}, { is_stock_item: false }, defaults, {
        warehouseField: "target_warehouse",
      }),
    ).not.toHaveProperty("target_warehouse");
  });

  it("converts a payment term template into schedule rows", () => {
    const date = new Date("2026-01-01T00:00:00.000Z");
    const result = paymentTemplateToSchedule(
      {
        items: [
          {
            due_date_based_on: "weeks_after_invoice_week",
            credit_period: 2,
            invoice_portion: 100,
            discount_type: "percentage",
            discount: 2,
            payment_method: { id: "method-1" },
          },
        ],
      },
      date,
    );

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      due_date: new Date("2026-01-15T00:00:00.000Z"),
      invoice_portion: 100,
      discount_type: "percentage",
      discount: 2,
      payment_method: { id: "method-1" },
    });
    expect(result[0].id).toBeTruthy();
    expect(result[0].discount_date).toEqual(result[0].due_date);
  });

  it("applies resolved defaults without replacing edited or source values", () => {
    const moduleDefaults = {
      tax: { id: "module-tax", rate: 11 },
      warehouse: { id: "module-warehouse" },
    };
    const resolvedDefaults = {
      tax: { id: "conditional-tax", rate: 5 },
      warehouse: { id: "conditional-warehouse" },
    };
    const line = {
      id: "row-1",
      tax: moduleDefaults.tax,
      tax_rate: 11,
      source_warehouse: moduleDefaults.warehouse,
    };

    expect(
      applyResolvedToNewLine(
        line,
        { is_stock_item: true },
        resolvedDefaults,
        moduleDefaults,
        { warehouseField: "source_warehouse" },
      ),
    ).toMatchObject({
      tax: resolvedDefaults.tax,
      tax_rate: 5,
      source_warehouse: resolvedDefaults.warehouse,
    });
    expect(
      applyResolvedToNewLine(
        line,
        { is_stock_item: true },
        resolvedDefaults,
        moduleDefaults,
        {
          warehouseField: "source_warehouse",
          isFieldEdited: (_rowId, field) =>
            field === "tax" || field === "source_warehouse",
        },
      ),
    ).toEqual(line);
    expect(
      applyResolvedToNewLine(
        { ...line, purchase_order_item: { id: "source-1" } },
        { is_stock_item: true },
        resolvedDefaults,
        moduleDefaults,
        { warehouseField: "source_warehouse" },
      ),
    ).toEqual({ ...line, purchase_order_item: { id: "source-1" } });
  });

  it("supports an explicit no-tax resolution and never assigns a warehouse to non-stock items", () => {
    const moduleDefaults = {
      tax: { id: "module-tax", rate: 11 },
      warehouse: { id: "module-warehouse" },
    };

    expect(
      applyResolvedToNewLine(
        { id: "row-2", tax: moduleDefaults.tax, tax_rate: 11 },
        { is_stock_item: false },
        { tax: null, warehouse: { id: "wrong-warehouse" } },
        moduleDefaults,
        { warehouseField: "source_warehouse" },
      ),
    ).toMatchObject({ tax: null, tax_rate: 0 });
  });

  it("does not restore the module tax after a resolved no-tax rule", () => {
    const line = { tax: null, tax_rate: 0 };
    const defaults = { tax: { id: "module-tax", rate: 11 } };

    expect(
      applyToNewLine(line, { is_stock_item: true }, defaults, {
        skipTaxDefault: true,
      }),
    ).toEqual(line);
  });

  it("does not restore a manually cleared warehouse", () => {
    const line = { source_warehouse: null };
    const defaults = { warehouse: { id: "module-warehouse" } };

    expect(
      applyToNewLine(line, { is_stock_item: true }, defaults, {
        warehouseField: "source_warehouse",
        skipWarehouseDefault: true,
      }),
    ).toEqual(line);
  });

  it("ignores a late resolution after the row item has changed", () => {
    const line = {
      id: "row-3",
      item: { id: "item-new" },
      tax: null,
    };

    expect(
      applyResolvedToNewLine(
        line,
        { id: "item-old", is_stock_item: true },
        { tax: { id: "stale-tax", rate: 11 } },
        {},
      ),
    ).toEqual(line);
  });

  it("ignores a late resolution after the row item is cleared", () => {
    const line = { id: "row-4", item: null, tax: null };

    expect(
      applyResolvedToNewLine(
        line,
        { id: "item-old", is_stock_item: true },
        { tax: { id: "stale-tax", rate: 11 }, warehouse: { id: "stale" } },
        {},
        { warehouseField: "source_warehouse" },
      ),
    ).toEqual(line);
  });
});
