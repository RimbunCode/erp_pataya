import { describe, expect, it } from "vitest";
import { columnTypeCategory, isColumnRef, makeColumnRef } from "./columnRef";

describe("columnTypeCategory", () => {
  it("mengelompokkan number/currency ke 'numeric'", () => {
    expect(columnTypeCategory("number")).toBe("numeric");
    expect(columnTypeCategory("currency")).toBe("numeric");
  });

  it("mengelompokkan date/datetime ke 'date'", () => {
    expect(columnTypeCategory("date")).toBe("date");
    expect(columnTypeCategory("datetime")).toBe("date");
  });

  it("mengelompokkan relation/relations ke 'relation'", () => {
    expect(columnTypeCategory("relation")).toBe("relation");
    expect(columnTypeCategory("relations")).toBe("relation");
  });

  it("mengelompokkan formStatus/formStatuses ke 'status'", () => {
    expect(columnTypeCategory("formStatus")).toBe("status");
    expect(columnTypeCategory("formStatuses")).toBe("status");
  });

  it("mengembalikan type apa adanya untuk tipe lain", () => {
    expect(columnTypeCategory("string")).toBe("string");
    expect(columnTypeCategory("boolean")).toBe("boolean");
  });
});

describe("isColumnRef", () => {
  it("true untuk value dengan kind='column'", () => {
    expect(isColumnRef({ kind: "column", ref: "field_a" })).toBe(true);
  });

  it("false untuk value biasa (string/number/object lain)", () => {
    expect(isColumnRef("text")).toBe(false);
    expect(isColumnRef(123)).toBe(false);
    expect(isColumnRef({ kind: "other" })).toBe(false);
  });

  it("false untuk null/undefined", () => {
    expect(isColumnRef(null)).toBe(false);
    expect(isColumnRef(undefined)).toBe(false);
  });
});

describe("makeColumnRef", () => {
  it("membungkus ref string menjadi value column-ref", () => {
    expect(makeColumnRef("field_a")).toEqual({
      kind: "column",
      ref: "field_a",
    });
  });

  it("membungkus ref array menjadi value column-ref", () => {
    expect(makeColumnRef(["a", "b"])).toEqual({
      kind: "column",
      ref: ["a", "b"],
    });
  });
});
