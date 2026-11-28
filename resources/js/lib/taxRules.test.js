import { describe, expect, it } from "vitest";
import { allocateDiscount } from "./discountAllocation";
import {
  dppSourceOf,
  resolveTaxRule,
  rulesOf,
  showsDppOf,
  taxesOfRow,
  toDay,
} from "./taxRules";

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

describe("toDay", () => {
  it("mengambil bagian tanggal string server tanpa konversi zona (tidak bergeser ke UTC)", () => {
    expect(toDay("2026-07-01")).toBe("2026-07-01");
    expect(toDay("2026-07-01T00:30:00+07:00")).toBe("2026-07-01");
    expect(toDay("2026-06-30T23:59:59-05:00")).toBe("2026-06-30");
    expect(toDay("2026-07-01 00:00:00")).toBe("2026-07-01");
  });

  it("objek Date memakai komponen lokal dan kosong menjadi hari ini", () => {
    expect(toDay(new Date(2026, 6, 1, 0, 30))).toBe("2026-07-01");
    expect(toDay(null)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(toDay("bukan tanggal")).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("resolveTaxRule memilih versi menurut hari tanpa pergeseran zona", () => {
    const versions = [version({ id: "new", effective_from: "2026-07-01" })];
    expect(
      resolveTaxRule(versions, "tax-1", "2026-07-01T00:30:00+07:00")?.versionId,
    ).toBe("new");
    expect(
      resolveTaxRule(versions, "tax-1", "2026-06-30T23:59:59+07:00"),
    ).toBeNull();
  });
});

describe("pajak majemuk per baris (rulesOf, showsDppOf, dppSourceOf)", () => {
  const ppn = {
    id: "tax-ppn",
    name: "PPN 12%",
    rate: 12,
    category: "ppn_standard",
  };
  const pph = { id: "tax-pph", name: "PPh 23", rate: 2, category: "pph_23" };
  const versions = [
    version({ id: "v-ppn", tax_id: "tax-ppn", rate: 12 }),
    version({
      id: "v-pph",
      tax_id: "tax-pph",
      rate: 2,
      dpp_numerator: 1,
      dpp_denominator: 1,
      behavior: "withholding",
    }),
  ];

  it("taxesOfRow: taxes menang, lalu tax tunggal, lalu tax_id; kosong = []", () => {
    expect(taxesOfRow({ taxes: [ppn, pph], tax: pph })).toEqual([ppn, pph]);
    expect(taxesOfRow({ taxes: [], tax: pph })).toEqual([pph]);
    expect(taxesOfRow({ tax_id: "tax-x" })).toEqual([{ id: "tax-x" }]);
    expect(taxesOfRow({})).toEqual([]);
    expect(taxesOfRow(null)).toEqual([]);
  });

  it("rulesOf me-resolve versi aturan PER pajak, urutan pilihan terjaga", () => {
    const entries = rulesOf({ taxes: [ppn, pph] }, versions, "2026-07-01");

    expect(entries.map((e) => e.taxId)).toEqual(["tax-ppn", "tax-pph"]);
    expect(entries[0].rule).toMatchObject({
      rate: 12,
      additive: true,
      showsDpp: true,
    });
    expect(entries[1].rule).toMatchObject({
      rate: 2,
      additive: false,
      showsDpp: false,
    });
  });

  it("rulesOf memakai versi tersimpan pada pivot tiap pajak (dokumen yang sudah disimpan)", () => {
    const old = version({ id: "old", status: "retired", rate: 11 });
    const entries = rulesOf(
      {
        taxes: [{ ...ppn, id: "tax-1", pivot: { tax_rule_version_id: "old" } }],
      },
      [old, version({ id: "new", effective_from: "2026-07-01", rate: 12 })],
      "2026-07-02",
    );

    expect(entries[0].rule?.versionId).toBe("old");
    expect(entries[0].rule?.rate).toBe(11);
  });

  it("rulesOf bentuk lama: tax_rule_version_id baris dipakai untuk pajak tunggal", () => {
    const old = version({ id: "old", status: "retired", rate: 11 });
    const entries = rulesOf(
      { tax: { id: "tax-1" }, tax_rule_version_id: "old" },
      [old, version({ id: "new", effective_from: "2026-07-01" })],
      "2026-07-02",
    );

    expect(entries).toHaveLength(1);
    expect(entries[0].rule?.versionId).toBe("old");
  });

  it("pajak tanpa versi berlaku memberi rule null; baris tanpa pajak memberi daftar kosong", () => {
    expect(
      rulesOf({ taxes: [{ id: "tidak-ada" }] }, versions, "2026-07-01")[0].rule,
    ).toBeNull();
    expect(rulesOf({}, versions, "2026-07-01")).toEqual([]);
  });

  it("showsDppOf: hanya bila SALAH SATU pajak penambah berfaktor selain 1/1", () => {
    const date = "2026-07-01";
    expect(showsDppOf(rulesOf({ taxes: [ppn, pph] }, versions, date))).toBe(
      true,
    );
    expect(showsDppOf(rulesOf({ taxes: [pph] }, versions, date))).toBe(false);
    expect(showsDppOf(rulesOf({ taxes: [{ id: "x" }] }, versions, date))).toBe(
      false,
    );
    expect(showsDppOf([])).toBe(false);
  });

  it("dppSourceOf: PPN pertama, lalu penambah pertama, lalu pajak pertama", () => {
    const date = "2026-07-01";
    const other = { id: "tax-other", name: "Lain", category: "other" };
    const allVersions = [
      ...versions,
      version({
        id: "v-other",
        tax_id: "tax-other",
        rate: 5,
        dpp_numerator: 1,
        dpp_denominator: 1,
      }),
    ];
    const sourceOf = (taxes) =>
      dppSourceOf(rulesOf({ taxes }, allVersions, date))?.taxId;

    // PPN menang walau bukan elemen pertama.
    expect(sourceOf([other, ppn])).toBe("tax-ppn");
    // Tanpa PPN: penambah pertama (PPh potong dilewati).
    expect(sourceOf([pph, other])).toBe("tax-other");
    // Hanya pajak potong: pajak pertama.
    expect(sourceOf([pph])).toBe("tax-pph");
    expect(dppSourceOf([])).toBeNull();
  });
});
