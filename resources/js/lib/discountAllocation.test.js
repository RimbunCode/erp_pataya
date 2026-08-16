/**
 * Unit test untuk discountAllocation.js -- replikasi JS dari
 * App\Services\Finances\DocumentDiscountCalculator (PHP). Case sama persis
 * dengan tests/Unit/DocumentDiscountCalculatorTest.php supaya kedua sisi
 * (FE preview vs BE persisted) dibuktikan identik.
 *
 * Feature: dpp-discount-and-tax-compliance
 */

import { describe, it, expect } from "vitest";
import {
  allocateDiscount,
  BASIS_NET_TOTAL,
  BASIS_GRAND_TOTAL,
} from "./discountAllocation";

const fixtureLines = () => [
  { basic_amount: 10 * 100000, tax_rate: 11 },
  { basic_amount: 5 * 200000, tax_rate: 10 },
];

const sumBasic = (result) =>
  Math.round(result.reduce((a, l) => a + l.basic_amount, 0) * 100) / 100;
const sumTax = (result) =>
  Math.round(result.reduce((a, l) => a + l.tax_amount, 0) * 100) / 100;
const sumTotal = (result) =>
  Math.round(result.reduce((a, l) => a + l.amount, 0) * 100) / 100;

function assertInvariants(result) {
  const dpp = sumBasic(result);
  const tax = sumTax(result);
  const total = sumTotal(result);
  expect(total).toBeCloseTo(dpp + tax, 2);
  result.forEach((line) => {
    expect(line.amount).toBeCloseTo(line.basic_amount + line.tax_amount, 2);
  });
}

describe("allocateDiscount - Case A: no discount", () => {
  it("basis tetap penuh, tidak ada perubahan", () => {
    const result = allocateDiscount(fixtureLines(), null, 0, 0);
    expect(sumBasic(result)).toBeCloseTo(2000000, 2);
    expect(sumTax(result)).toBeCloseTo(210000, 2);
    expect(sumTotal(result)).toBeCloseTo(2210000, 2);
    assertInvariants(result);
  });
});

describe("allocateDiscount - Case B: 10% on net_total", () => {
  it("DPP dan pajak turun sesuai proporsi", () => {
    const result = allocateDiscount(
      fixtureLines(),
      BASIS_NET_TOTAL,
      10,
      0,
      "discount_rate",
    );
    expect(sumBasic(result)).toBeCloseTo(1800000, 2);
    expect(sumTax(result)).toBeCloseTo(189000, 2);
    expect(sumTotal(result)).toBeCloseTo(1989000, 2);
    assertInvariants(result);
  });
});

describe("allocateDiscount - Case C: 10% on grand_total", () => {
  it("gross-down menghasilkan DPP/pajak sama dengan Case B", () => {
    const result = allocateDiscount(
      fixtureLines(),
      BASIS_GRAND_TOTAL,
      10,
      0,
      "discount_rate",
    );
    expect(sumBasic(result)).toBeCloseTo(1800000, 2);
    expect(sumTax(result)).toBeCloseTo(189000, 2);
    expect(sumTotal(result)).toBeCloseTo(1989000, 2);
    assertInvariants(result);
  });
});

describe("allocateDiscount - linearity Case B vs C", () => {
  it("Total sama untuk diskon persentase", () => {
    const b = allocateDiscount(
      fixtureLines(),
      BASIS_NET_TOTAL,
      10,
      0,
      "discount_rate",
    );
    const c = allocateDiscount(
      fixtureLines(),
      BASIS_GRAND_TOTAL,
      10,
      0,
      "discount_rate",
    );
    expect(sumTotal(b)).toBeCloseTo(sumTotal(c), 2);
  });
});

describe("allocateDiscount - Case D: fixed 200000 on net_total", () => {
  it("sama dengan Case B", () => {
    const result = allocateDiscount(
      fixtureLines(),
      BASIS_NET_TOTAL,
      0,
      200000,
      "discount_amount",
    );
    expect(sumBasic(result)).toBeCloseTo(1800000, 2);
    expect(sumTax(result)).toBeCloseTo(189000, 2);
    expect(sumTotal(result)).toBeCloseTo(1989000, 2);
  });
});

describe("allocateDiscount - Case E: fixed 221000 on grand_total", () => {
  it("sama dengan Case B/C", () => {
    const result = allocateDiscount(
      fixtureLines(),
      BASIS_GRAND_TOTAL,
      0,
      221000,
      "discount_amount",
    );
    expect(sumBasic(result)).toBeCloseTo(1800000, 2);
    expect(sumTax(result)).toBeCloseTo(189000, 2);
    expect(sumTotal(result)).toBeCloseTo(1989000, 2);
  });
});

describe("allocateDiscount - Case F: 100% discount on net_total", () => {
  it("DPP dan pajak jadi 0, tanpa nilai negatif", () => {
    const result = allocateDiscount(
      fixtureLines(),
      BASIS_NET_TOTAL,
      100,
      0,
      "discount_rate",
    );
    expect(sumBasic(result)).toBeCloseTo(0, 2);
    expect(sumTax(result)).toBeCloseTo(0, 2);
    expect(sumTotal(result)).toBeCloseTo(0, 2);
    result.forEach((line) => {
      expect(line.basic_amount).toBeGreaterThanOrEqual(0);
      expect(line.tax_amount).toBeGreaterThanOrEqual(0);
    });
  });
});

describe("allocateDiscount - discount exceeding basis", () => {
  it("diskon di-clamp ke basis, tidak menghasilkan basis negatif", () => {
    const result = allocateDiscount(
      fixtureLines(),
      BASIS_NET_TOTAL,
      0,
      5000000,
      "discount_amount",
    );
    expect(sumBasic(result)).toBeCloseTo(0, 2);
    result.forEach((line) => {
      expect(line.basic_amount).toBeGreaterThanOrEqual(0);
    });
  });
});

describe("allocateDiscount - rounding residual on uneven split", () => {
  it("33% pada 3 baris tetap menjaga invarian", () => {
    const lines = [
      { basic_amount: 100000, tax_rate: 11 },
      { basic_amount: 100000, tax_rate: 11 },
      { basic_amount: 100000, tax_rate: 11 },
    ];
    const result = allocateDiscount(
      lines,
      BASIS_NET_TOTAL,
      33,
      0,
      "discount_rate",
    );
    expect(sumBasic(result)).toBeCloseTo(201000, 2);
    assertInvariants(result);
  });
});

describe("allocateDiscount - zero basic_amount lines", () => {
  it("tidak divide-by-zero", () => {
    const lines = [
      { basic_amount: 0, tax_rate: 11 },
      { basic_amount: 0, tax_rate: 11 },
    ];
    const result = allocateDiscount(
      lines,
      BASIS_NET_TOTAL,
      10,
      0,
      "discount_rate",
    );
    expect(sumBasic(result)).toBeCloseTo(0, 2);
    expect(sumTax(result)).toBeCloseTo(0, 2);
  });
});

describe("allocateDiscount - discount_on null", () => {
  it("lines dikembalikan tanpa perubahan", () => {
    const result = allocateDiscount(
      fixtureLines(),
      null,
      10,
      500000,
      "discount_rate",
    );
    expect(sumBasic(result)).toBeCloseTo(2000000, 2);
    expect(sumTax(result)).toBeCloseTo(210000, 2);
  });
});
