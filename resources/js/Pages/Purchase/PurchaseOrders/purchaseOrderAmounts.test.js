import { describe, expect, it } from "vitest";
import { calculatePurchaseOrderAmounts } from "./purchaseOrderAmounts";

const PPN12 = {
  id: "tax-ppn",
  name: "PPN 12%",
  rate: 12,
  category: "ppn_standard",
};
const PPH23 = { id: "tax-pph", name: "PPh 23", rate: 2, category: "pph_23" };
const VERSIONS = [
  {
    id: "ver-ppn12",
    tax_id: "tax-ppn",
    status: "active",
    effective_from: "2000-01-01",
    effective_to: null,
    rate: 12,
    dpp_numerator: 11,
    dpp_denominator: 12,
    behavior: "additive",
  },
  {
    id: "ver-pph23",
    tax_id: "tax-pph",
    status: "active",
    effective_from: "2000-01-01",
    effective_to: null,
    rate: 2,
    dpp_numerator: 1,
    dpp_denominator: 1,
    behavior: "withholding",
  },
];

describe("calculatePurchaseOrderAmounts", () => {
  it("bentuk satu pajak lama (tax.rate) tetap sama", () => {
    const result = calculatePurchaseOrderAmounts({
      items: [{ item: { id: 1 }, quantity: 2, rate: 1000, tax: { rate: 10 } }],
    });

    expect(result.net_amount).toBe(2000);
    expect(result.tax_amount).toBe(200);
    expect(result.withholding_amount).toBe(0);
    expect(result.amount).toBe(2200);
  });

  it("banyak pajak: penambah memakai faktor DPP, pajak potong tidak menambah total", () => {
    const result = calculatePurchaseOrderAmounts(
      {
        date: new Date("2026-01-01"),
        items: [
          {
            item: { id: 1 },
            quantity: 1,
            rate: 1000000,
            taxes: [PPN12, PPH23],
          },
        ],
      },
      VERSIONS,
    );

    expect(result.tax_amount).toBeCloseTo(110000, 2);
    expect(result.withholding_amount).toBeCloseTo(20000, 2);
    expect(result.amount).toBeCloseTo(1110000, 2);
    expect(result.rawTaxAmount).toBeCloseTo(110000, 2);
  });
});
