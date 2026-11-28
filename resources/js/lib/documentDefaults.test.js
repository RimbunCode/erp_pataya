import { describe, expect, it } from "vitest";
import {
  applyResolvedToNewLine,
  applyToNewLine,
  defaultTaxesOf,
  paymentTemplateToSchedule,
  taxPatch,
  taxRowError,
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

  it("sets tax_rate from the filled tax even when the row carried tax_rate 0", () => {
    const defaults = { tax: { id: "tax-1", rate: 11 } };

    expect(
      applyToNewLine({ item: {}, tax: null, tax_rate: 0 }, {}, defaults),
    ).toMatchObject({ tax: defaults.tax, tax_rate: 11 });
    expect(
      applyToNewLine({ item: {}, tax_rate: 0 }, {}, { tax: { id: "t0" } }),
    ).toMatchObject({ tax: { id: "t0" }, tax_rate: 0 });
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

describe("document defaults -- pajak majemuk (multiTax) dan galat pajak baris", () => {
  const ppn = { id: "ppn", rate: 12 };
  const pph = { id: "pph", rate: 2 };

  it("taxRowError membaca items.N.taxes, items.N.taxes.M, dan bentuk satu pajak lama", () => {
    expect(taxRowError({ "items.1.taxes": "dobel" }, 1)).toBe("dobel");
    expect(taxRowError({ "items.1.taxes.0.id": "tanpa versi" }, 1)).toBe(
      "tanpa versi",
    );
    expect(taxRowError({ "items.1.tax.id": "lama" }, 1)).toBe("lama");
    expect(taxRowError({ "items.2.taxes": "baris lain" }, 1)).toBeNull();
    expect(taxRowError(undefined, 0)).toBeNull();
  });

  it("defaultTaxesOf: taxes bila terisi, selain itu tax tunggal, selain itu kosong", () => {
    expect(defaultTaxesOf({ taxes: [ppn, pph], tax: pph })).toEqual([ppn, pph]);
    expect(defaultTaxesOf({ tax: ppn })).toEqual([ppn]);
    expect(defaultTaxesOf({ taxes: [] })).toEqual([]);
    expect(defaultTaxesOf(null)).toEqual([]);
  });

  it("taxPatch: taxes + Pajak Utama (pertama) + tax_rate bila diminta", () => {
    expect(taxPatch([ppn, pph])).toEqual({
      taxes: [ppn, pph],
      tax: ppn,
      tax_rate: 12,
    });
    expect(taxPatch([], false)).toEqual({ taxes: [], tax: null });
  });

  it("multiTax: baris baru mendapat default pajak sebagai array (fallback ke tax tunggal)", () => {
    const line = { id: "row-1" };
    expect(
      applyToNewLine(line, null, { taxes: [ppn, pph] }, { multiTax: true }),
    ).toMatchObject({ taxes: [ppn, pph], tax: ppn, tax_rate: 12 });
    expect(
      applyToNewLine(line, null, { tax: ppn }, { multiTax: true }),
    ).toMatchObject({ taxes: [ppn], tax: ppn });
  });

  it("multiTax: baris yang sudah berpajak atau pajaknya diedit manual tidak ditimpa", () => {
    const withTax = { id: "row-1", taxes: [pph] };
    expect(
      applyToNewLine(withTax, null, { taxes: [ppn] }, { multiTax: true }),
    ).toEqual(withTax);
    expect(
      applyToNewLine(
        { id: "row-2" },
        null,
        { taxes: [ppn] },
        { multiTax: true, isFieldEdited: () => true },
      ),
    ).toEqual({ id: "row-2" });
  });

  it("tanpa multiTax perilaku lama tetap: hanya tax tunggal, tanpa kunci taxes", () => {
    const next = applyToNewLine(
      { id: "row-1" },
      null,
      { tax: ppn, taxes: [ppn, pph] },
      {},
    );
    expect(next).toEqual({ id: "row-1", tax: ppn, tax_rate: 12 });
  });

  it("applyResolvedToNewLine multiTax: hasil resolver berupa banyak pajak menggantikan default modul", () => {
    const item = { id: "item-1" };
    const line = { id: "row-1", item, taxes: [ppn], tax: ppn };
    const next = applyResolvedToNewLine(
      line,
      item,
      { taxes: [ppn, pph] },
      { tax: ppn },
      { multiTax: true },
    );
    expect(next).toMatchObject({ taxes: [ppn, pph], tax: ppn });
  });

  it("applyResolvedToNewLine multiTax: pilihan pengguna (pajak beda dari default modul) dipertahankan", () => {
    const item = { id: "item-1" };
    const line = { id: "row-1", item, taxes: [pph], tax: pph };
    const next = applyResolvedToNewLine(
      line,
      item,
      { taxes: [ppn] },
      { tax: ppn },
      { multiTax: true },
    );
    expect(next.taxes).toEqual([pph]);
  });

  it("applyResolvedToNewLine multiTax: hasil tanpa pajak mengosongkan default modul", () => {
    const item = { id: "item-1" };
    const line = { id: "row-1", item, taxes: [ppn], tax: ppn };
    const next = applyResolvedToNewLine(
      line,
      item,
      { taxes: [] },
      { tax: ppn },
      { multiTax: true },
    );
    expect(next).toMatchObject({ taxes: [], tax: null, tax_rate: 0 });
  });
});
