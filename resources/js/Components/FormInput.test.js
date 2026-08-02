/**
 * Unit tests untuk FormInput.resolveDiffValue (auto-inject valueBefore).
 * Task 3.3 (spec value-before-optimization).
 *
 * Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5
 * Feature: value-before-optimization
 */

import { describe, it, expect } from "vitest";
import { resolveDiffValue } from "./FormInput";

describe("resolveDiffValue", () => {
  it("mode edit normal (dataBefore kosong/{}) -> undefined, tidak ada auto-inject", () => {
    expect(
      resolveDiffValue({ name: "customer", dataBefore: {}, ignoreDiff: false }),
    ).toBeUndefined();
  });

  it("dataBefore undefined -> undefined", () => {
    expect(
      resolveDiffValue({
        name: "customer",
        dataBefore: undefined,
        ignoreDiff: false,
      }),
    ).toBeUndefined();
  });

  it("dataBefore berisi + name match -> mengembalikan dataBefore[name]", () => {
    const dataBefore = { customer: { id: 1, name: "Budi" } };
    expect(
      resolveDiffValue({ name: "customer", dataBefore, ignoreDiff: false }),
    ).toBe(dataBefore.customer);
  });

  it("ignoreDiff=true -> undefined meski dataBefore berisi", () => {
    const dataBefore = { customer: { id: 1, name: "Budi" } };
    expect(
      resolveDiffValue({ name: "customer", dataBefore, ignoreDiff: true }),
    ).toBeUndefined();
  });

  it("name tidak match key mana pun -> undefined, tidak error", () => {
    const dataBefore = { customer: { id: 1 } };
    expect(
      resolveDiffValue({
        name: "unknown_field",
        dataBefore,
        ignoreDiff: false,
      }),
    ).toBeUndefined();
  });

  it("name kosong/undefined -> undefined, tidak error", () => {
    const dataBefore = { customer: { id: 1 } };
    expect(
      resolveDiffValue({ name: undefined, dataBefore, ignoreDiff: false }),
    ).toBeUndefined();
    expect(
      resolveDiffValue({ name: "", dataBefore, ignoreDiff: false }),
    ).toBeUndefined();
  });

  it("key ada tapi value-nya null -> mengembalikan null (bukan undefined), tetap dianggap 'ada nilai before'", () => {
    const dataBefore = { customer: null };
    expect(
      resolveDiffValue({ name: "customer", dataBefore, ignoreDiff: false }),
    ).toBeNull();
  });
});
