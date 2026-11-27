import { describe, expect, it } from "vitest";
import { allocateDiscount } from "./discountAllocation";
import { resolveTaxRule } from "./taxRules";

const version = (overrides = {}) => ({
  id: "v1",
  tax_id: "tax-1",
  status: "active",
  effective_from: "2026-01-01",
  effective_to: null,
  rate: 12,
  dpp_numerator: 11,
  dpp_denominator: 12,
  behavior: "additive",
  ...overrides,
});

describe("resolveTaxRule", () => {
  it("memilih versi active yang berlaku pada tanggal dokumen (batas hari ikut)", () => {
    const versions = [
      version({ id: "old", effective_to: "2026-06-30", rate: 11 }),
      version({ id: "new", effective_from: "2026-07-01", rate: 12 }),
    ];

    expect(
      resolveTaxRule(versions, "tax-1", "2026-06-30T10:00:00Z")?.rate,
    ).toBe(11);
    expect(
      resolveTaxRule(versions, "tax-1", "2026-07-01T00:00:00Z")?.rate,
    ).toBe(12);
  });

  it("null untuk baris tanpa pajak atau pajak tanpa versi berlaku", () => {
    expect(resolveTaxRule([version()], null, "2026-07-01")).toBeNull();
    expect(resolveTaxRule([version()], "tax-x", "2026-07-01")).toBeNull();
    expect(resolveTaxRule([version()], "tax-1", "2025-12-31")).toBeNull();
  });

  it("memakai versi tersimpan pada baris (dokumen yang sudah disimpan) walau sudah retired", () => {
    const versions = [version({ id: "retired", status: "retired" })];

    expect(
      resolveTaxRule(versions, "tax-1", "2026-07-01", "retired")?.versionId,
    ).toBe("retired");
    // versi milik pajak lain diabaikan
    expect(
      resolveTaxRule(versions, "tax-2", "2026-07-01", "retired"),
    ).toBeNull();
  });

  it("DPP hanya ditampilkan bila faktor selain 1/1; faktor datang dari versi", () => {
    expect(resolveTaxRule([version()], "tax-1", "2026-07-01").showsDpp).toBe(
      true,
    );
    expect(
      resolveTaxRule(
        [version({ dpp_numerator: 1, dpp_denominator: 1 })],
        "tax-1",
        "2026-07-01",
      ).showsDpp,
    ).toBe(false);
    expect(
      resolveTaxRule(
        [version({ dpp_numerator: 3, dpp_denominator: 4 })],
        "tax-1",
        "2026-07-01",
      ).dppFactor,
    ).toBe(0.75);
  });

  it("withholding tidak additive", () => {
    expect(
      resolveTaxRule(
        [version({ behavior: "withholding" })],
        "tax-1",
        "2026-07-01",
      ).additive,
    ).toBe(false);
  });
});

describe("allocateDiscount dengan parameter per baris dari versi aturan", () => {
  it("dpp_factor per baris menimpa faktor global", () => {
    const [a, b] = allocateDiscount(
      [
        { basic_amount: 1000, tax_rate: 10, dpp_factor: 0.5 },
        { basic_amount: 1000, tax_rate: 10, dpp_factor: 1 },
      ],
      null,
      0,
      0,
      "discount_rate",
      11 / 12,
    );

    expect(a.tax_amount).toBeCloseTo(50, 5);
    expect(b.tax_amount).toBeCloseTo(100, 5);
  });

  it("pajak withholding (additive false) tidak menambah pajak maupun basis grand_total", () => {
    const [a] = allocateDiscount(
      [{ basic_amount: 1000, tax_rate: 2, dpp_factor: 1, additive: false }],
      "grand_total",
      0,
      100,
      "discount_amount",
    );

    expect(a.tax_amount).toBe(0);
    expect(a.basic_amount).toBeCloseTo(900, 5);
  });
});
