import { describe, it, expect } from "vitest";
import * as fc from "fast-check";

import { cleanNumber } from "./cleanNumber";
import { formatNumber, formatTyping, normalizeSign } from "./formatNumber";
import { parseNumberFormat } from "./parseNumberFormat";
import { resolveCurrencyInput } from "./useCurrency";

describe("parseNumberFormat", () => {
  it("parses US format #,###.##", () => {
    expect(parseNumberFormat("#,###.##")).toEqual({
      groupSeparator: ",",
      decimalSeparator: ".",
      decimalScale: 2,
    });
  });

  it("parses EU format #.###,##", () => {
    expect(parseNumberFormat("#.###,##")).toEqual({
      groupSeparator: ".",
      decimalSeparator: ",",
      decimalScale: 2,
    });
  });

  it("parses Swiss format #'###.##", () => {
    expect(parseNumberFormat("#'###.##")).toEqual({
      groupSeparator: "'",
      decimalSeparator: ".",
      decimalScale: 2,
    });
  });

  it("returns decimalScale 0 when no decimal part", () => {
    expect(parseNumberFormat("#,###")).toEqual({
      groupSeparator: ",",
      decimalSeparator: ".",
      decimalScale: 0,
    });
  });

  it("returns empty groupSeparator when no group", () => {
    expect(parseNumberFormat("###.##")).toEqual({
      groupSeparator: "",
      decimalSeparator: ".",
      decimalScale: 2,
    });
  });

  it("supports 0 placeholders (#.##0,00)", () => {
    expect(parseNumberFormat("#.##0,00")).toEqual({
      groupSeparator: ".",
      decimalSeparator: ",",
      decimalScale: 2,
    });
  });

  it("parses plain integer pattern ### as scale 0, no group", () => {
    expect(parseNumberFormat("###")).toEqual({
      groupSeparator: "",
      decimalSeparator: ".",
      decimalScale: 0,
    });
  });

  it.each([[""], [null], [undefined], ["abc"]])(
    "falls back for invalid/empty pattern %s",
    (input) => {
      expect(parseNumberFormat(input)).toEqual({
        groupSeparator: ",",
        decimalSeparator: ".",
        decimalScale: 2,
      });
    },
  );
});

describe("formatNumber", () => {
  it("formats with group separator and scale", () => {
    expect(formatNumber(1234567.5, { decimalScale: 2 })).toBe("1,234,567.50");
  });

  it("rounds half-up at .5", () => {
    expect(formatNumber(2.5, { decimalScale: 0 })).toBe("3");
  });

  it("rounds half-up despite float error (1.005 -> 1.01)", () => {
    expect(formatNumber(1.005, { decimalScale: 2 })).toBe("1.01");
  });

  it("rounds down below half (1.004 -> 1.00)", () => {
    expect(formatNumber(1.004, { decimalScale: 2 })).toBe("1.00");
  });

  it("handles negative when allowed", () => {
    expect(formatNumber(-1234.5, { decimalScale: 2 })).toBe("-1,234.50");
  });

  it("drops sign when allowNegativeValue is false", () => {
    expect(
      formatNumber(-1234.5, { decimalScale: 2, allowNegativeValue: false }),
    ).toBe("1,234.50");
  });

  it("formats zero", () => {
    expect(formatNumber(0, { decimalScale: 2 })).toBe("0.00");
  });

  it("scale 0 produces no decimal part", () => {
    expect(formatNumber(1234.9, { decimalScale: 0 })).toBe("1,235");
  });

  it("applies prefix and suffix", () => {
    expect(
      formatNumber(1000, { decimalScale: 2, prefix: "$", suffix: " USD" }),
    ).toBe("$1,000.00 USD");
  });

  it("numberFormat overrides separators and scale (EU)", () => {
    expect(formatNumber(1234567.891, { numberFormat: "#.###,##" })).toBe(
      "1.234.567,89",
    );
  });

  it("returns empty string for empty/NaN", () => {
    expect(formatNumber("", { decimalScale: 2 })).toBe("");
    expect(formatNumber(null, { decimalScale: 2 })).toBe("");
    expect(formatNumber(undefined, { decimalScale: 2 })).toBe("");
    expect(formatNumber(NaN, { decimalScale: 2 })).toBe("");
  });

  it("formats large numbers without scientific notation", () => {
    expect(formatNumber(1e20, { decimalScale: 0 })).not.toMatch(/e/i);
  });

  it("does not return NaN for very large numbers (beyond MAX_SAFE_INTEGER)", () => {
    const out = formatNumber("234234234234234234", { decimalScale: 2 });
    expect(out).not.toMatch(/nan/i);
    expect(out).not.toBe("");
  });
});

describe("formatTyping", () => {
  it("groups integer part while typing (US)", () => {
    expect(
      formatTyping("1234567", { groupSeparator: ",", decimalSeparator: "." }),
    ).toBe("1,234,567");
  });

  it("keeps trailing decimal separator while typing", () => {
    expect(
      formatTyping("123.", { groupSeparator: ",", decimalSeparator: "." }),
    ).toBe("123.");
  });

  it("does NOT round — preserves over-scale decimals", () => {
    expect(
      formatTyping("1.999", { groupSeparator: ",", decimalSeparator: "." }),
    ).toBe("1.999");
  });

  it("preserves trailing zeros while typing", () => {
    expect(
      formatTyping("1234.50", { groupSeparator: ",", decimalSeparator: "." }),
    ).toBe("1,234.50");
  });

  it("uses EU separators", () => {
    expect(
      formatTyping("1234567.89", {
        groupSeparator: ".",
        decimalSeparator: ",",
      }),
    ).toBe("1.234.567,89");
  });

  it("keeps negative sign", () => {
    expect(
      formatTyping("-1234", { groupSeparator: ",", decimalSeparator: "." }),
    ).toBe("-1,234");
  });

  it("handles lone minus while typing", () => {
    expect(
      formatTyping("-", { groupSeparator: ",", decimalSeparator: "." }),
    ).toBe("-");
  });

  it("keeps negative with decimals", () => {
    expect(
      formatTyping("-1234.5", { groupSeparator: ",", decimalSeparator: "." }),
    ).toBe("-1,234.5");
  });

  it("applies prefix and suffix", () => {
    expect(
      formatTyping("1234.5", {
        groupSeparator: ",",
        decimalSeparator: ".",
        prefix: "$",
        suffix: " USD",
      }),
    ).toBe("$1,234.5 USD");
  });

  it("returns empty for empty input", () => {
    expect(formatTyping("", {})).toBe("");
    expect(formatTyping(null, {})).toBe("");
  });

  it("strips leading zeros on the integer part", () => {
    const opt = { groupSeparator: ",", decimalSeparator: "." };
    expect(formatTyping("007", opt)).toBe("7");
    expect(formatTyping("00", opt)).toBe("0");
    expect(formatTyping("0", opt)).toBe("0");
    expect(formatTyping("000123", opt)).toBe("123");
  });

  it("keeps single zero before decimal separator", () => {
    const opt = { groupSeparator: ",", decimalSeparator: "." };
    expect(formatTyping("0.5", opt)).toBe("0.5");
    expect(formatTyping("0.", opt)).toBe("0.");
    expect(formatTyping("000.5", opt)).toBe("0.5");
  });

  it("strips leading zeros while keeping negative sign", () => {
    expect(
      formatTyping("-007", { groupSeparator: ",", decimalSeparator: "." }),
    ).toBe("-7");
  });
});

describe("normalizeSign", () => {
  it("moves a trailing minus to the front", () => {
    expect(normalizeSign("5-")).toBe("-5");
  });

  it("moves a mid-string minus to the front", () => {
    expect(normalizeSign("12-3")).toBe("-123");
  });

  it("collapses multiple minus signs into one at the front", () => {
    expect(normalizeSign("-1-2-")).toBe("-12");
  });

  it("keeps a leading minus", () => {
    expect(normalizeSign("-123")).toBe("-123");
  });

  it("keeps positive untouched", () => {
    expect(normalizeSign("123")).toBe("123");
  });

  it("strips all minus when negatives disallowed", () => {
    expect(normalizeSign("-12-3", false)).toBe("123");
  });

  it("keeps lone minus", () => {
    expect(normalizeSign("-")).toBe("-");
  });

  it("handles empty input", () => {
    expect(normalizeSign("")).toBe("");
  });
});

describe("cleanNumber", () => {
  it("strips US group separators and prefix", () => {
    expect(
      cleanNumber("$1,234,567.89", {
        groupSeparator: ",",
        decimalSeparator: ".",
        prefix: "$",
      }),
    ).toBe("1234567.89");
  });

  it("strips EU separators and normalizes decimal", () => {
    expect(
      cleanNumber("1.234.567,89", {
        groupSeparator: ".",
        decimalSeparator: ",",
      }),
    ).toBe("1234567.89");
  });

  it("preserves negative sign", () => {
    expect(
      cleanNumber("-1,234.50", { groupSeparator: ",", decimalSeparator: "." }),
    ).toBe("-1234.50");
  });

  it("strips suffix", () => {
    expect(
      cleanNumber("1,000.00 USD", {
        groupSeparator: ",",
        decimalSeparator: ".",
        suffix: " USD",
      }),
    ).toBe("1000.00");
  });

  it("returns empty when no digits", () => {
    expect(cleanNumber("", {})).toBe("");
    expect(cleanNumber("-", {})).toBe("");
    expect(cleanNumber(null, {})).toBe("");
  });
});

describe("resolveCurrencyInput", () => {
  it("string code -> fetch by that code", () => {
    expect(resolveCurrencyInput("usd")).toEqual({ kind: "fetch", code: "usd" });
  });

  it('"default" string -> fetch by "default" (resolved later by getCurrencyConfig)', () => {
    expect(resolveCurrencyInput("default")).toEqual({
      kind: "fetch",
      code: "default",
    });
  });

  it("object with symbol -> use symbol directly, no fetch", () => {
    expect(
      resolveCurrencyInput({ code: "usd", symbol: "$", name: "US Dollar" }),
    ).toEqual({ kind: "symbol", symbol: "$" });
  });

  it("object without symbol -> fallback fetch by object.code", () => {
    expect(resolveCurrencyInput({ code: "idr", name: "Rupiah" })).toEqual({
      kind: "fetch",
      code: "idr",
    });
  });

  it("object with empty/null symbol -> fallback fetch by object.code", () => {
    expect(resolveCurrencyInput({ code: "idr", symbol: "" })).toEqual({
      kind: "fetch",
      code: "idr",
    });
    expect(resolveCurrencyInput({ code: "idr", symbol: null })).toEqual({
      kind: "fetch",
      code: "idr",
    });
  });

  it("null/undefined/empty -> none (no symbol, no fetch)", () => {
    expect(resolveCurrencyInput(null)).toEqual({ kind: "none" });
    expect(resolveCurrencyInput(undefined)).toEqual({ kind: "none" });
    expect(resolveCurrencyInput("")).toEqual({ kind: "none" });
  });

  it("object without symbol AND without code -> none", () => {
    expect(resolveCurrencyInput({ name: "x" })).toEqual({ kind: "none" });
  });
});

describe("formatNumber <-> cleanNumber round-trip (property)", () => {
  it("cleanNumber(formatNumber(x)) parses back to x within scale", () => {
    fc.assert(
      fc.property(
        // Domain uang realistis: integer "unit terkecil" lalu dibagi 100,
        // menghindari subnormal/presisi biner ekstrem yang bukan input nyata.
        fc.integer({ min: -1_000_000_000_00, max: 1_000_000_000_00 }),
        fc.constantFrom("#,###.##", "#.###,##", "#'###.##", "#,###"),
        (cents, numberFormat) => {
          const x = cents / 100;
          const { groupSeparator, decimalSeparator, decimalScale } =
            parseNumberFormat(numberFormat);

          const formatted = formatNumber(x, { numberFormat });
          const cleaned = cleanNumber(formatted, {
            groupSeparator,
            decimalSeparator,
          });
          const back = parseFloat(cleaned);

          // Nilai yang diharapkan: x dibulatkan ke decimalScale (round half-up).
          const factor = Math.pow(10, decimalScale);
          const expected =
            (Math.round(Math.abs(x) * factor) / factor) * (x < 0 ? -1 : 1);

          // Toleransi setengah unit terkecil pada skala tsb.
          const tolerance = decimalScale === 0 ? 0.5 : 1 / factor;
          expect(Math.abs(back - expected)).toBeLessThanOrEqual(tolerance);
        },
      ),
      { numRuns: 500 },
    );
  });
});
