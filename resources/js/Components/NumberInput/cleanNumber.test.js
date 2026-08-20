import { describe, expect, it } from "vitest";
import { cleanNumber } from "./cleanNumber";

describe("cleanNumber", () => {
  it("membersihkan group separator default (koma)", () => {
    expect(cleanNumber("1,234,567")).toBe("1234567");
  });

  it("mempertahankan decimal separator default (titik)", () => {
    expect(cleanNumber("1,234.56")).toBe("1234.56");
  });

  it("menormalkan decimal separator custom (koma) menjadi titik", () => {
    expect(
      cleanNumber("1.234,56", { groupSeparator: ".", decimalSeparator: "," }),
    ).toBe("1234.56");
  });

  it("membuang prefix dan suffix", () => {
    expect(cleanNumber("$1,000.00 USD", { prefix: "$", suffix: " USD" })).toBe(
      "1000.00",
    );
  });

  it("mempertahankan tanda minus", () => {
    expect(cleanNumber("-1,234.56")).toBe("-1234.56");
  });

  it("null/undefined menghasilkan string kosong", () => {
    expect(cleanNumber(null)).toBe("");
    expect(cleanNumber(undefined)).toBe("");
  });

  it("string tanpa digit menghasilkan string kosong", () => {
    expect(cleanNumber("abc")).toBe("");
  });

  it("hanya mengambil titik desimal pertama saat ada ganda", () => {
    expect(cleanNumber("1.2.3", { groupSeparator: "" })).toBe("1.23");
  });
});
