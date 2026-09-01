import { describe, expect, it } from "vitest";
import { parseNumberFormat } from "./parseNumberFormat";

describe("parseNumberFormat", () => {
  it("fallback ke default untuk pattern kosong/invalid", () => {
    expect(parseNumberFormat("")).toEqual({
      groupSeparator: ",",
      decimalSeparator: ".",
      decimalScale: 2,
    });
    expect(parseNumberFormat(null)).toEqual({
      groupSeparator: ",",
      decimalSeparator: ".",
      decimalScale: 2,
    });
    expect(parseNumberFormat("abc")).toEqual({
      groupSeparator: ",",
      decimalSeparator: ".",
      decimalScale: 2,
    });
  });

  it("parse pola standar #,###.## (group koma, decimal titik, scale 2)", () => {
    expect(parseNumberFormat("#,###.##")).toEqual({
      groupSeparator: ",",
      decimalSeparator: ".",
      decimalScale: 2,
    });
  });

  it("parse pola Eropa #.###,## (group titik, decimal koma)", () => {
    expect(parseNumberFormat("#.###,##")).toEqual({
      groupSeparator: ".",
      decimalSeparator: ",",
      decimalScale: 2,
    });
  });

  it("parse pola tanpa desimal #,### (group koma, scale 0)", () => {
    expect(parseNumberFormat("#,###")).toEqual({
      groupSeparator: ",",
      decimalSeparator: ".",
      decimalScale: 0,
    });
  });

  it("parse pola integer murni # (tanpa separator, scale 0)", () => {
    expect(parseNumberFormat("#")).toEqual({
      groupSeparator: "",
      decimalSeparator: ".",
      decimalScale: 0,
    });
  });

  it("parse pola hanya desimal #.## (tanpa group)", () => {
    expect(parseNumberFormat("#.##")).toEqual({
      groupSeparator: "",
      decimalSeparator: ".",
      decimalScale: 2,
    });
  });

  it("parse separator custom (kutip) #'###.###", () => {
    expect(parseNumberFormat("#'###.###")).toEqual({
      groupSeparator: "'",
      decimalSeparator: ".",
      decimalScale: 3,
    });
  });
});
