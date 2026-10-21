import { describe, expect, it } from "vitest";
import { applyToNewLine, paymentTemplateToSchedule } from "./documentDefaults";

describe("document defaults", () => {
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
});
