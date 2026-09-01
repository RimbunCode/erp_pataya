/**
 * Unit test untuk numberFormat.js — pure function, tanpa render komponen.
 * Requirements: chart-compact-number-display 2.1, 2.2, 3.1, 3.2, 4.2
 */

import { describe, it, expect } from "vitest";
import { formatNumber } from "./numberFormat";

describe("formatNumber", () => {
  it("full=true delegasi ke NumberInput/formatNumber via pattern numberFormat", () => {
    expect(
      formatNumber(1234567, { full: true, numberFormat: "#,###.##" }),
    ).toBe("1,234,567.00");
  });

  it("full=true pattern id (#.###,##) menghasilkan pemisah beda dari pattern en", () => {
    expect(
      formatNumber(1234567, { full: true, numberFormat: "#.###,##" }),
    ).toBe("1.234.567,00");
    expect(
      formatNumber(1234567, { full: true, numberFormat: "#,###.##" }),
    ).toBe("1,234,567.00");
  });

  it("full=true tanpa numberFormat pakai default groupSeparator NumberInput/formatNumber sendiri (desimal dipertahankan apa adanya, tidak dipaksa 2 digit)", () => {
    expect(formatNumber(1234567, { full: true })).toBe("1,234,567");
  });

  it("full=false (default) menampilkan notasi compact", () => {
    expect(formatNumber(1234567, { locale: "en" })).toBe("1.2M");
  });

  it("locale id vs en menghasilkan notasi compact berbeda untuk angka yang sama", () => {
    // ICU pakai non-breaking space ( ) antara angka & unit utk locale id.
    expect(formatNumber(1234567, { locale: "id" })).toBe("1,2 jt");
    expect(formatNumber(1234567, { locale: "en" })).toBe("1.2M");
  });

  it("value null/undefined diperlakukan sebagai 0, bukan crash/NaN (compact)", () => {
    expect(formatNumber(null, { locale: "en" })).toBe("0");
    expect(formatNumber(undefined, { locale: "en" })).toBe("0");
  });

  it("value null/undefined diperlakukan sebagai 0, bukan crash/NaN (full)", () => {
    expect(formatNumber(null, { full: true, numberFormat: "#,###.##" })).toBe(
      "0.00",
    );
  });

  it("value string numerik tetap diformat benar", () => {
    expect(
      formatNumber("1234567", { full: true, numberFormat: "#,###.##" }),
    ).toBe("1,234,567.00");
  });
});
