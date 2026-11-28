import { describe, expect, it } from "vitest";
import {
  allocationLine,
  previewInvoiceLine,
  previewInvoiceLines,
  summarizeTaxLines,
} from "./invoiceTaxPreview";
import { rulesOf } from "./taxRules";

const version = (overrides) => ({
  status: "active",
  effective_from: "2000-01-01",
  effective_to: null,
  ...overrides,
});
const versions = [
  version({
    id: "v-ppn",
    tax_id: "ppn",
    rate: 12,
    dpp_numerator: 11,
    dpp_denominator: 12,
    behavior: "additive",
  }),
  version({
    id: "v-pph",
    tax_id: "pph",
    rate: 2,
    dpp_numerator: 1,
    dpp_denominator: 1,
    behavior: "withholding",
  }),
  version({
    id: "v-ppnbm",
    tax_id: "ppnbm",
    rate: 10,
    dpp_numerator: 1,
    dpp_denominator: 1,
    behavior: "additive",
  }),
];
const PPN = { id: "ppn", name: "PPN 12%", rate: 12, category: "ppn_standard" };
const PPH = { id: "pph", name: "PPh 23", rate: 2, category: "pph_23" };
const PPNBM = { id: "ppnbm", name: "Pajak Lain", rate: 10, category: "other" };
const entries = (row) => rulesOf(row, versions, "2026-07-01");

describe("allocationLine", () => {
  it("0 atau 1 pajak memakai bentuk satu pajak lama; 2+ pajak memakai taxes", () => {
    expect(allocationLine(1000, entries({}))).toEqual({
      basic_amount: 1000,
      tax_rate: 0,
      dpp_factor: 1,
      additive: true,
    });
    expect(allocationLine(1000, entries({ taxes: [PPN] }))).toMatchObject({
      tax_rate: 12,
      dpp_factor: 11 / 12,
      additive: true,
    });
    const many = allocationLine(1000, entries({ taxes: [PPN, PPH] }));
    expect(many.taxes).toEqual([
      { rate: 12, dpp_factor: 11 / 12, additive: true },
      { rate: 2, dpp_factor: 1, additive: false },
    ]);
  });

  it("pajak tanpa versi aturan memakai tarif master pajak sebagai cadangan (bentuk lama)", () => {
    const line = allocationLine(
      1000,
      entries({ taxes: [{ id: "x", rate: 7 }] }),
    );
    expect(line.tax_rate).toBe(7);
    expect(line.dpp_factor).toBe(1);
  });
});

describe("previewInvoiceLine(s)", () => {
  const gross = [1_000_000];

  it("PPN 12% DPP 11/12 + PPh 23 2% potong: dpp dari PPN, pajak penambah, potongan", () => {
    const preview = previewInvoiceLine({
      grossAmounts: gross,
      entriesList: [entries({ taxes: [PPN, PPH] })],
      index: 0,
      discount: {},
    });

    expect(preview.discount_amount).toBe(0);
    expect(preview.dpp_amount).toBeCloseTo(916_666.67, 1);
    expect(preview.tax_amount).toBeCloseTo(110_000, 2);
    expect(preview.withholding_amount).toBeCloseTo(20_000, 2);
    expect(preview.tax_lines.map((l) => l.tax_amount.toFixed(0))).toEqual([
      "110000",
      "20000",
    ]);
  });

  it("dpp_amount mengikuti PPN walau PPN bukan pajak pertama", () => {
    const preview = previewInvoiceLine({
      grossAmounts: gross,
      entriesList: [entries({ taxes: [PPNBM, PPN] })],
      index: 0,
      discount: {},
    });

    expect(preview.dpp_amount).toBeCloseTo(916_666.67, 1);
    // Dua pajak penambah: 100.000 + 110.000.
    expect(preview.tax_amount).toBeCloseTo(210_000, 2);
  });

  it("satu pajak: identik dengan hasil bentuk lama (paritas dengan jalur tanpa taxes)", () => {
    const a = previewInvoiceLine({
      grossAmounts: [1000],
      entriesList: [entries({ taxes: [PPN] })],
      index: 0,
      discount: {},
    });
    const b = previewInvoiceLine({
      grossAmounts: [1000],
      entriesList: [entries({ tax: PPN })],
      index: 0,
      discount: {},
    });

    expect(a).toEqual(b);
  });

  it("baris tanpa pajak bernilai nol; diskon dokumen net_total dibagi pro-rata", () => {
    const previews = previewInvoiceLines({
      grossAmounts: [1000, 3000],
      entriesList: [entries({}), entries({ taxes: [PPN] })],
      discount: { on: "net_total", amount: 400, latestKey: "discount_amount" },
    });

    expect(previews[0]).toMatchObject({
      dpp_amount: 0,
      tax_amount: 0,
      discount_amount: 100,
    });
    expect(previews[1].discount_amount).toBe(300);
    expect(previews[1].net_amount).toBe(2700);
  });
});

describe("summarizeTaxLines", () => {
  it("menjumlah per pajak lintas baris (nama, tarif, jumlah)", () => {
    const items = [
      {
        tax_lines: [
          {
            id: "ppn",
            name: "PPN 12%",
            rate: 12,
            additive: true,
            tax_amount: 100,
          },
        ],
      },
      {
        tax_lines: [
          {
            id: "ppn",
            name: "PPN 12%",
            rate: 12,
            additive: true,
            tax_amount: 50,
          },
          {
            id: "pph",
            name: "PPh 23",
            rate: 2,
            additive: false,
            tax_amount: 10,
          },
        ],
      },
      {},
    ];

    expect(summarizeTaxLines(items)).toEqual([
      { id: "ppn", name: "PPN 12%", rate: 12, additive: true, tax_amount: 150 },
      { id: "pph", name: "PPh 23", rate: 2, additive: false, tax_amount: 10 },
    ]);
    expect(summarizeTaxLines(undefined)).toEqual([]);
  });
});
