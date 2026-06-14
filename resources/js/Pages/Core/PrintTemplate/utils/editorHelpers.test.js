import { describe, it, expect } from "vitest";
import {
  clampSidebarWidth,
  resolveTemplateUnitCode,
  parseNumericValue,
  validateHandlebarTemplate,
  SIDEBAR_DEFAULT_WIDTH,
  SIDEBAR_MIN_WIDTH,
  SIDEBAR_MAX_WIDTH,
} from "./editorHelpers";

describe("clampSidebarWidth", () => {
  it("returns the value when within valid range", () => {
    expect(clampSidebarWidth(350)).toBe(350);
    expect(clampSidebarWidth(400)).toBe(400);
  });

  it("clamps to minimum when value is below min", () => {
    expect(clampSidebarWidth(100)).toBe(SIDEBAR_MIN_WIDTH);
    expect(clampSidebarWidth(279)).toBe(SIDEBAR_MIN_WIDTH);
  });

  it("clamps to maximum when value exceeds max", () => {
    expect(clampSidebarWidth(600)).toBe(SIDEBAR_MAX_WIDTH);
    expect(clampSidebarWidth(1000)).toBe(SIDEBAR_MAX_WIDTH);
  });

  it("returns exact boundary values at min and max", () => {
    expect(clampSidebarWidth(SIDEBAR_MIN_WIDTH)).toBe(SIDEBAR_MIN_WIDTH);
    expect(clampSidebarWidth(SIDEBAR_MAX_WIDTH)).toBe(SIDEBAR_MAX_WIDTH);
  });

  it("returns default width for non-finite or NaN values", () => {
    expect(clampSidebarWidth("abc")).toBe(SIDEBAR_DEFAULT_WIDTH);
    expect(clampSidebarWidth(NaN)).toBe(SIDEBAR_DEFAULT_WIDTH);
    expect(clampSidebarWidth(Infinity)).toBe(SIDEBAR_DEFAULT_WIDTH);
    expect(clampSidebarWidth(-Infinity)).toBe(SIDEBAR_DEFAULT_WIDTH);
    expect(clampSidebarWidth(undefined)).toBe(SIDEBAR_DEFAULT_WIDTH);
  });

  it("clamps null to minimum (Number(null) === 0)", () => {
    expect(clampSidebarWidth(null)).toBe(SIDEBAR_MIN_WIDTH);
  });

  it("clamps negative values to minimum", () => {
    expect(clampSidebarWidth(-100)).toBe(SIDEBAR_MIN_WIDTH);
    expect(clampSidebarWidth(-1)).toBe(SIDEBAR_MIN_WIDTH);
  });

  it("clamps zero to minimum", () => {
    expect(clampSidebarWidth(0)).toBe(SIDEBAR_MIN_WIDTH);
  });

  it("handles numeric strings by converting them", () => {
    expect(clampSidebarWidth("350")).toBe(350);
    expect(clampSidebarWidth("100")).toBe(SIDEBAR_MIN_WIDTH);
    expect(clampSidebarWidth("600")).toBe(SIDEBAR_MAX_WIDTH);
  });
});

describe("resolveTemplateUnitCode", () => {
  it("returns unit string when printTemplate.unit is a string", () => {
    expect(resolveTemplateUnitCode({ unit: "cm" })).toBe("cm");
    expect(resolveTemplateUnitCode({ unit: "in" })).toBe("in");
    expect(resolveTemplateUnitCode({ unit: "px" })).toBe("px");
  });

  it("returns unit code when printTemplate.unit is an object with code", () => {
    expect(resolveTemplateUnitCode({ unit: { code: "cm" } })).toBe("cm");
    expect(resolveTemplateUnitCode({ unit: { code: "in" } })).toBe("in");
  });

  it("returns 'mm' as default when printTemplate is null or undefined", () => {
    expect(resolveTemplateUnitCode(null)).toBe("mm");
    expect(resolveTemplateUnitCode(undefined)).toBe("mm");
  });

  it("returns 'mm' as default when unit is missing", () => {
    expect(resolveTemplateUnitCode({})).toBe("mm");
    expect(resolveTemplateUnitCode({ unit: undefined })).toBe("mm");
    expect(resolveTemplateUnitCode({ unit: null })).toBe("mm");
  });

  it("returns 'mm' as default when unit is empty string", () => {
    expect(resolveTemplateUnitCode({ unit: "" })).toBe("mm");
    expect(resolveTemplateUnitCode({ unit: "   " })).toBe("mm");
  });

  it("returns 'mm' when unit object has empty code", () => {
    expect(resolveTemplateUnitCode({ unit: { code: "" } })).toBe("mm");
    expect(resolveTemplateUnitCode({ unit: { code: "   " } })).toBe("mm");
  });

  it("trims whitespace from unit values", () => {
    expect(resolveTemplateUnitCode({ unit: "  cm  " })).toBe("cm");
    expect(resolveTemplateUnitCode({ unit: { code: "  in  " } })).toBe("in");
  });

  it("returns 'mm' when unit is a non-string, non-object type", () => {
    expect(resolveTemplateUnitCode({ unit: 123 })).toBe("mm");
    expect(resolveTemplateUnitCode({ unit: true })).toBe("mm");
  });
});

describe("parseNumericValue", () => {
  it("parses valid numeric values", () => {
    expect(parseNumericValue(42, 0)).toBe(42);
    expect(parseNumericValue(3.14, 0)).toBe(3.14);
    expect(parseNumericValue(-10, 0)).toBe(-10);
  });

  it("parses numeric strings", () => {
    expect(parseNumericValue("42", 0)).toBe(42);
    expect(parseNumericValue("3.14", 0)).toBe(3.14);
    expect(parseNumericValue("-10", 0)).toBe(-10);
  });

  it("returns fallback for non-numeric strings", () => {
    expect(parseNumericValue("abc", 99)).toBe(99);
    expect(parseNumericValue("12px", 0)).toBe(0);
  });

  it("treats empty string and null as 0 (Number coercion)", () => {
    // Number("") === 0 and Number(null) === 0, both are finite
    expect(parseNumericValue("", 5)).toBe(0);
    expect(parseNumericValue(null, 10)).toBe(0);
  });

  it("returns fallback for undefined", () => {
    expect(parseNumericValue(undefined, 20)).toBe(20);
  });

  it("returns fallback for NaN and Infinity", () => {
    expect(parseNumericValue(NaN, 7)).toBe(7);
    expect(parseNumericValue(Infinity, 8)).toBe(8);
    expect(parseNumericValue(-Infinity, 9)).toBe(9);
  });

  it("handles zero as a valid numeric value", () => {
    expect(parseNumericValue(0, 99)).toBe(0);
    expect(parseNumericValue("0", 99)).toBe(0);
  });

  it("returns the fallback value as-is (even if non-numeric)", () => {
    expect(parseNumericValue("abc", undefined)).toBe(undefined);
    expect(parseNumericValue("abc", null)).toBe(null);
  });
});

describe("validateHandlebarTemplate", () => {
  it("returns valid for correct Handlebar templates", () => {
    expect(validateHandlebarTemplate("{{name}}")).toEqual({
      valid: true,
      message: "",
    });
    expect(validateHandlebarTemplate("Hello {{user.name}}!")).toEqual({
      valid: true,
      message: "",
    });
    expect(validateHandlebarTemplate("{{#if active}}Yes{{/if}}")).toEqual({
      valid: true,
      message: "",
    });
  });

  it("returns valid for plain text without Handlebar syntax", () => {
    expect(validateHandlebarTemplate("Hello World")).toEqual({
      valid: true,
      message: "",
    });
  });

  it("returns valid for empty string", () => {
    expect(validateHandlebarTemplate("")).toEqual({
      valid: true,
      message: "",
    });
  });

  it("returns valid when called with no arguments", () => {
    expect(validateHandlebarTemplate()).toEqual({
      valid: true,
      message: "",
    });
  });

  it("returns invalid for unclosed block helpers", () => {
    const result = validateHandlebarTemplate("{{#if active}}Yes");
    expect(result.valid).toBe(false);
    expect(result.message).toBeTruthy();
  });

  it("returns invalid for mismatched block helpers", () => {
    const result = validateHandlebarTemplate("{{#if active}}Yes{{/each}}");
    expect(result.valid).toBe(false);
    expect(result.message).toBeTruthy();
  });

  it("returns invalid for malformed expressions", () => {
    const result = validateHandlebarTemplate("{{#}}");
    expect(result.valid).toBe(false);
    expect(result.message).toBeTruthy();
  });

  it("returns valid for templates with helpers", () => {
    expect(validateHandlebarTemplate("{{formatCurrency doc.amount}}")).toEqual({
      valid: true,
      message: "",
    });
  });

  it("returns valid for templates with each blocks", () => {
    expect(
      validateHandlebarTemplate("{{#each items}}{{this.name}}{{/each}}"),
    ).toEqual({ valid: true, message: "" });
  });

  it("handles null/undefined input gracefully", () => {
    expect(validateHandlebarTemplate(null)).toEqual({
      valid: true,
      message: "",
    });
    expect(validateHandlebarTemplate(undefined)).toEqual({
      valid: true,
      message: "",
    });
  });
});
