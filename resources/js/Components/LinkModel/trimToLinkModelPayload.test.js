/**
 * Unit tests untuk trimToLinkModelPayload.
 * Task 3.2 (spec linkmodel-advanced-search).
 *
 * Property 2 (design.md): payload seleksi Advance Search Dialog SELALU
 * subset dari {structural} ∪ templateLinkColumnNames ∪ fields, dan SELALU
 * superset dari templateLinkColumnNames (kolom templateLink tak pernah
 * hilang walau tak disebut di `fields`).
 *
 * Validates: Requirements 7.1, 7.2, 7.3
 */

import { describe, it, expect } from "vitest";
import { trimToLinkModelPayload } from "./trimToLinkModelPayload";

const row = {
  id: 1,
  route: "items",
  canDelete: true,
  canUpdate: true,
  keyModel: "App\\Models\\Inventory\\Item",
  appendStatus: [],
  thisModel: "App\\Models\\Inventory\\Item",
  templateLink: "ITM-001",
  disabledOn: null,
  code: "ITM-001",
  name: "Widget",
  price: 15000,
  stock_uom: "pcs",
  valuation_rate: 9999, // non-linkable-non-fields -- HARUS terbuang
};

describe("trimToLinkModelPayload", () => {
  it("fields kosong -- hanya kolom struktural + templateLink yang ikut", () => {
    const result = trimToLinkModelPayload(row, {
      fields: [],
      templateLinkColumnNames: ["code", "name"],
    });

    expect(result).toEqual({
      id: 1,
      route: "items",
      canDelete: true,
      canUpdate: true,
      keyModel: "App\\Models\\Inventory\\Item",
      appendStatus: [],
      thisModel: "App\\Models\\Inventory\\Item",
      templateLink: "ITM-001",
      disabledOn: null,
      code: "ITM-001",
      name: "Widget",
    });
  });

  it("fields sebagian -- kolom itu ikut, kolom linkable lain yang tak diminta tetap terbuang", () => {
    const result = trimToLinkModelPayload(row, {
      fields: ["price"],
      templateLinkColumnNames: ["code"],
    });

    expect(result.price).toBe(15000);
    expect(result).not.toHaveProperty("stock_uom");
    expect(result).not.toHaveProperty("valuation_rate");
  });

  it("kolom templateLink SELALU ikut walau tidak disebut di fields", () => {
    const result = trimToLinkModelPayload(row, {
      fields: ["price"],
      templateLinkColumnNames: ["code", "name"],
    });

    expect(result.code).toBe("ITM-001");
    expect(result.name).toBe("Widget");
  });

  it("kolom non-linkable-non-fields (mis. valuation_rate) selalu terbuang", () => {
    const result = trimToLinkModelPayload(row, {
      fields: ["price", "stock_uom"],
      templateLinkColumnNames: ["code"],
    });

    expect(result).not.toHaveProperty("valuation_rate");
  });

  it("fields/templateLinkColumnNames diomit -- degradasi ke kolom struktural saja", () => {
    const result = trimToLinkModelPayload(row, {});

    expect(result).toEqual({
      id: 1,
      route: "items",
      canDelete: true,
      canUpdate: true,
      keyModel: "App\\Models\\Inventory\\Item",
      appendStatus: [],
      thisModel: "App\\Models\\Inventory\\Item",
      templateLink: "ITM-001",
      disabledOn: null,
    });
  });

  it("row null/undefined dikembalikan apa adanya (guard)", () => {
    expect(trimToLinkModelPayload(null, { fields: ["price"] })).toBeNull();
    expect(trimToLinkModelPayload(undefined)).toBeUndefined();
  });
});
