/**
 * Unit tests untuk diffUtils (isChanged).
 * Task 1.2 (spec value-before-optimization).
 *
 * Validates: Requirements 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8
 * Feature: value-before-optimization
 */

import { describe, it, expect } from "vitest";
import { isChanged } from "./diffUtils";

describe("isChanged - model (templateLink)", () => {
  it("sama bila label hasil render template sama", () => {
    const a = { templateLink: ":name", name: "Budi" };
    const b = { templateLink: ":name", name: "Budi" };
    expect(isChanged(a, b)).toBe(false);
  });

  it("berbeda bila label hasil render template berbeda", () => {
    const a = { templateLink: ":name", name: "Budi" };
    const b = { templateLink: ":name", name: "Siti" };
    expect(isChanged(a, b)).toBe(true);
  });
});

describe("isChanged - tanggal", () => {
  it("Date vs Date, momen sama -> tidak berubah", () => {
    const a = new Date("2026-01-01T10:00:00Z");
    const b = new Date("2026-01-01T10:00:00Z");
    expect(isChanged(a, b)).toBe(false);
  });

  it("Date vs ISO string, momen sama -> tidak berubah", () => {
    const a = new Date("2026-01-01T10:00:00Z");
    const b = "2026-01-01T10:00:00Z";
    expect(isChanged(a, b)).toBe(false);
  });

  it("ISO string beda hari -> berubah", () => {
    expect(isChanged("2026-01-01", "2026-01-02")).toBe(true);
  });

  it("ISO string datetime beda jam -> berubah", () => {
    expect(isChanged("2026-01-01T10:00:00Z", "2026-01-01T11:00:00Z")).toBe(
      true,
    );
  });
});

describe("isChanged - angka", () => {
  it("number vs number sama -> tidak berubah", () => {
    expect(isChanged(5, 5)).toBe(false);
  });

  it("number vs numeric-string setara -> tidak berubah", () => {
    expect(isChanged(5, "5")).toBe(false);
  });

  it("number berbeda -> berubah", () => {
    expect(isChanged(5, 6)).toBe(true);
  });
});

describe("isChanged - string biasa", () => {
  it("string sama -> tidak berubah", () => {
    expect(isChanged("halo", "halo")).toBe(false);
  });

  it("string berbeda -> berubah", () => {
    expect(isChanged("halo", "dunia")).toBe(true);
  });
});

describe("isChanged - boolean", () => {
  it("boolean sama -> tidak berubah", () => {
    expect(isChanged(true, true)).toBe(false);
  });

  it("boolean berbeda -> berubah", () => {
    expect(isChanged(true, false)).toBe(true);
  });
});

describe("isChanged - nilai kosong", () => {
  it.each([
    [null, undefined],
    [undefined, ""],
    ["", null],
    [null, null],
    [undefined, undefined],
    ["", ""],
  ])("%s vs %s dianggap sama (tidak berubah)", (a, b) => {
    expect(isChanged(a, b)).toBe(false);
  });

  it("satu kosong satu berisi -> berubah", () => {
    expect(isChanged(null, "ada")).toBe(true);
    expect(isChanged("ada", undefined)).toBe(true);
    expect(isChanged("", 0)).toBe(true);
  });
});

describe("isChanged - array/object (deep-equality)", () => {
  it("array struktur sama -> tidak berubah", () => {
    expect(isChanged([1, 2, 3], [1, 2, 3])).toBe(false);
  });

  it("array struktur berbeda -> berubah", () => {
    expect(isChanged([1, 2, 3], [1, 2, 4])).toBe(true);
  });

  it("object biasa (tanpa templateLink) sama -> tidak berubah", () => {
    expect(isChanged({ a: 1, b: 2 }, { a: 1, b: 2 })).toBe(false);
  });

  it("object biasa berbeda -> berubah", () => {
    expect(isChanged({ a: 1 }, { a: 2 })).toBe(true);
  });
});
