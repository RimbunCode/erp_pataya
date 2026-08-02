/**
 * Unit test untuk resolveCanUpdate (logic murni di balik hook useCanUpdate).
 * Task 9.5 (spec can-update-field-permission).
 *
 * Validates: Requirements 5.2, 5.3, 5.5
 */

import { describe, it, expect } from "vitest";
import { resolveCanUpdate } from "./useCanUpdate";

describe("resolveCanUpdate", () => {
  it("returns true when field absent from canUpdate map", () => {
    const ctx = { defaultData: { canUpdate: { customer: true } } };

    expect(resolveCanUpdate("warehouse", null, ctx)).toBe(true);
  });

  it("returns true when canUpdate map absent entirely", () => {
    const ctx = { defaultData: {} };

    expect(resolveCanUpdate("customer", null, ctx)).toBe(true);
  });

  it("returns false for all fields when disabledOn is true (short-circuit)", () => {
    const ctx = {
      defaultData: { disabledOn: true, canUpdate: { customer: true } },
    };

    expect(resolveCanUpdate("customer", null, ctx)).toBe(false);
  });

  it("returns false for all fields when propDisabled is true (short-circuit)", () => {
    const ctx = {
      disabled: true,
      defaultData: { canUpdate: { customer: true } },
    };

    expect(resolveCanUpdate("customer", null, ctx)).toBe(false);
  });

  it("reads field value from defaultData.canUpdate for root-level field", () => {
    const ctx = { defaultData: { canUpdate: { customer: false } } };

    expect(resolveCanUpdate("customer", null, ctx)).toBe(false);
  });

  it("returns boolean canUpdate as-is when it is a blanket bool", () => {
    const ctx = { defaultData: { canUpdate: false } };

    expect(resolveCanUpdate("customer", null, ctx)).toBe(false);
  });

  it("reads field value from row.canUpdate when row is given, not defaultData", () => {
    const ctx = { defaultData: { canUpdate: { qty: true } } };
    const row = { canUpdate: { qty: false } };

    expect(resolveCanUpdate("qty", row, ctx)).toBe(false);
  });

  it("returns true when row.canUpdate is absent (relation value was bool, not array/closure)", () => {
    const ctx = { defaultData: {} };
    const row = { id: "item-1" };

    expect(resolveCanUpdate("qty", row, ctx)).toBe(true);
  });

  it("returns false when disabledOn true even with row given", () => {
    const ctx = { defaultData: { disabledOn: true } };
    const row = { canUpdate: { qty: true } };

    expect(resolveCanUpdate("qty", row, ctx)).toBe(false);
  });

  it("returns true when ctx is undefined (no FormPageProvider ancestor)", () => {
    expect(resolveCanUpdate("customer", null, undefined)).toBe(true);
  });
});
