import { describe, expect, it } from "vitest";
import { formatNumber, normalizeSign, formatTyping } from "./formatNumber";

describe("formatNumber", () => {
  it("memformat angka dengan group separator default", () => {
    expect(formatNumber(1234567)).toBe("1,234,567");
  });

  it("membulatkan ke decimalScale dengan round half-up (1.005 -> 1.01)", () => {
    expect(formatNumber(1.005, { decimalScale: 2 })).toBe("1.01");
  });

  it("menambahkan prefix dan suffix", () => {
    expect(formatNumber(1000, { decimalScale: 2, prefix: "$" })).toBe(
      "$1,000.00",
    );
  });

  it("numberFormat meng-override group/decimal/scale", () => {
    expect(formatNumber(1234567.891, { numberFormat: "#.###,##" })).toBe(
      "1.234.567,89",
    );
  });

  it("value kosong/null/undefined/NaN menghasilkan string kosong", () => {
    expect(formatNumber("")).toBe("");
    expect(formatNumber(null)).toBe("");
    expect(formatNumber(undefined)).toBe("");
    expect(formatNumber(NaN)).toBe("");
  });

  it("angka negatif diberi tanda minus di depan prefix hanya bila allowNegativeValue", () => {
    expect(formatNumber(-500, { decimalScale: 0 })).toBe("-500");
    expect(formatNumber(-500, { decimalScale: 0, allowNegativeValue: false })).toBe(
      "500",
    );
  });

  it("tanpa decimalScale, desimal dipertahankan apa adanya", () => {
    expect(formatNumber(1.5)).toBe("1.5");
    expect(formatNumber(1)).toBe("1");
  });
});

describe("normalizeSign", () => {
  it("mempertahankan satu minus di posisi paling depan", () => {
    expect(normalizeSign("12-3")).toBe("-123");
    expect(normalizeSign("5-")).toBe("-5");
    expect(normalizeSign("-5")).toBe("-5");
  });

  it("membuang semua minus bila allowNegative=false", () => {
    expect(normalizeSign("-5", false)).toBe("5");
  });

  it("string kosong/non-string dikembalikan apa adanya", () => {
    expect(normalizeSign("")).toBe("");
    expect(normalizeSign(null)).toBe("");
  });
});

describe("formatTyping", () => {
  it("menyisipkan group separator tanpa membulatkan desimal", () => {
    expect(formatTyping("1234567")).toBe("1,234,567");
  });

  it("mempertahankan titik trailing saat mengetik ('1.')", () => {
    expect(formatTyping("1.")).toBe("1.");
  });

  it("mempertahankan trailing zero pada fraction ('1.50')", () => {
    expect(formatTyping("1.50")).toBe("1.50");
  });

  it("membuang leading zero berlebih ('007' -> '7')", () => {
    expect(formatTyping("007")).toBe("7");
  });

  it("mempertahankan zero tunggal ('0')", () => {
    expect(formatTyping("0")).toBe("0");
  });

  it("mempertahankan tanda minus di depan", () => {
    expect(formatTyping("-1234")).toBe("-1,234");
  });

  it("string kosong/null/undefined menghasilkan string kosong", () => {
    expect(formatTyping("")).toBe("");
    expect(formatTyping(null)).toBe("");
    expect(formatTyping(undefined)).toBe("");
  });
});
