import { describe, it, expect } from "vitest";
import { highlightMatch } from "./highlightMatch";

describe("highlightMatch", () => {
  it("tanpa search, kembalikan teks apa adanya (string, bukan array)", () => {
    expect(highlightMatch("Purchase Order", "")).toBe("Purchase Order");
    expect(highlightMatch("Purchase Order", undefined)).toBe("Purchase Order");
  });

  it("satu kata cocok, dibungkus <mark> case-insensitive", () => {
    const result = highlightMatch("Purchase Order", "order");
    expect(result).toHaveLength(2);
    expect(result[0]).toBe("Purchase ");
    expect(result[1].type).toBe("mark");
    expect(result[1].props.children).toBe("Order");
  });

  it("multi-kata search, tiap kata yang cocok dibungkus <mark> terpisah", () => {
    const result = highlightMatch("Purchase Order Item", "purchase item");
    const markedTexts = result
      .filter((part) => typeof part !== "string")
      .map((part) => part.props.children);
    expect(markedTexts).toEqual(["Purchase", "Item"]);
  });

  it("karakter spesial regex di search (. + * dll) tidak error, dicocokkan literal", () => {
    expect(() => highlightMatch("A.B+C", "a.b+c")).not.toThrow();
    const result = highlightMatch("A.B+C", "a.b+c");
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("mark");
    expect(result[0].props.children).toBe("A.B+C");
  });

  it("tidak ada yang cocok, kembalikan array 1 elemen teks utuh tanpa <mark>", () => {
    const result = highlightMatch("Purchase Order", "xyz");
    expect(result).toEqual(["Purchase Order"]);
  });

  it("text null/undefined tidak crash, dianggap string kosong", () => {
    expect(highlightMatch(null, "")).toBe("");
    expect(highlightMatch(undefined, "abc")).toEqual([]);
  });
});
