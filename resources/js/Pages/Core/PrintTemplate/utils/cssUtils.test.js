import { describe, it, expect } from "vitest";
import {
  parseCssDeclarations,
  serializeCssDeclarations,
  validateCssDeclarations,
  mergeCssStyles,
  cleanupManualCss,
  preventBodyDoubleWrap,
} from "./cssUtils";

describe("parseCssDeclarations", () => {
  it("parses simple property-value pairs", () => {
    const result = parseCssDeclarations("color: red; font-size: 12px;");
    expect(result).toEqual({ color: "red", "font-size": "12px" });
  });

  it("handles values containing colons (e.g., URLs)", () => {
    const result = parseCssDeclarations(
      "background: url(http://example.com/img.png);",
    );
    expect(result).toEqual({
      background: "url(http://example.com/img.png)",
    });
  });

  it("handles extra whitespace", () => {
    const result = parseCssDeclarations(
      "  color :  red  ;   margin :  10px  ;  ",
    );
    expect(result).toEqual({ color: "red", margin: "10px" });
  });

  it("skips declarations with missing colons", () => {
    const result = parseCssDeclarations(
      "color: red; invalid-entry; margin: 5px;",
    );
    expect(result).toEqual({ color: "red", margin: "5px" });
  });

  it("skips declarations with missing values", () => {
    const result = parseCssDeclarations("color:; margin: 10px;");
    expect(result).toEqual({ margin: "10px" });
  });

  it("returns empty object for empty input", () => {
    expect(parseCssDeclarations("")).toEqual({});
    expect(parseCssDeclarations(null)).toEqual({});
    expect(parseCssDeclarations(undefined)).toEqual({});
  });

  it("normalizes property names to lowercase", () => {
    const result = parseCssDeclarations("Color: red; FONT-SIZE: 12px;");
    expect(result).toEqual({ color: "red", "font-size": "12px" });
  });

  it("handles trailing semicolons gracefully", () => {
    const result = parseCssDeclarations("color: red;;;");
    expect(result).toEqual({ color: "red" });
  });

  it("last value wins for duplicate properties", () => {
    const result = parseCssDeclarations("color: red; color: blue;");
    expect(result).toEqual({ color: "blue" });
  });
});

describe("serializeCssDeclarations", () => {
  it("serializes a style object to CSS text", () => {
    const result = serializeCssDeclarations({
      color: "red",
      "font-size": "12px",
    });
    expect(result).toBe("color: red; font-size: 12px;");
  });

  it("filters out empty/null/undefined values", () => {
    const result = serializeCssDeclarations({
      color: "red",
      margin: "",
      padding: null,
      border: undefined,
    });
    expect(result).toBe("color: red;");
  });

  it("returns empty string for empty object", () => {
    expect(serializeCssDeclarations({})).toBe("");
  });
});

describe("validateCssDeclarations", () => {
  it("returns valid for correct CSS", () => {
    const result = validateCssDeclarations("color: red; font-size: 12px;");
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.validDeclarations).toEqual({
      color: "red",
      "font-size": "12px",
    });
  });

  it("detects missing colon", () => {
    const result = validateCssDeclarations("color red; font-size: 12px;");
    expect(result.isValid).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].reason).toBe("missing_colon");
    expect(result.errors[0].declaration).toBe("color red");
    expect(result.validDeclarations).toEqual({ "font-size": "12px" });
  });

  it("detects missing value", () => {
    const result = validateCssDeclarations("color:; margin: 10px;");
    expect(result.isValid).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].reason).toBe("missing_value");
    expect(result.validDeclarations).toEqual({ margin: "10px" });
  });

  it("detects missing property name", () => {
    const result = validateCssDeclarations(": red; margin: 10px;");
    expect(result.isValid).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].reason).toBe("missing_property");
    expect(result.validDeclarations).toEqual({ margin: "10px" });
  });

  it("detects multiple errors", () => {
    const result = validateCssDeclarations("color red; font-size:; : blue;");
    expect(result.isValid).toBe(false);
    expect(result.errors).toHaveLength(3);
    expect(result.errors[0].reason).toBe("missing_colon");
    expect(result.errors[1].reason).toBe("missing_value");
    expect(result.errors[2].reason).toBe("missing_property");
  });

  it("returns valid for empty input", () => {
    const result = validateCssDeclarations("");
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});

describe("mergeCssStyles", () => {
  it("merges visual and manual styles", () => {
    const visual = { color: "blue", margin: "10px" };
    const manual = "padding: 5px; border: 1px solid;";
    const result = mergeCssStyles(visual, manual);
    expect(result).toEqual({
      color: "blue",
      margin: "10px",
      padding: "5px",
      border: "1px solid",
    });
  });

  it("manual CSS takes precedence for overlapping properties", () => {
    const visual = { color: "blue", margin: "10px" };
    const manual = "color: red;";
    const result = mergeCssStyles(visual, manual);
    expect(result).toEqual({ color: "red", margin: "10px" });
  });

  it("preserves all non-overlapping properties from both sources", () => {
    const visual = { "font-size": "14px" };
    const manual = "padding: 8px;";
    const result = mergeCssStyles(visual, manual);
    expect(result).toEqual({ "font-size": "14px", padding: "8px" });
  });

  it("accepts pre-parsed manual CSS object", () => {
    const visual = { color: "blue" };
    const manual = { color: "red", padding: "5px" };
    const result = mergeCssStyles(visual, manual);
    expect(result).toEqual({ color: "red", padding: "5px" });
  });

  it("handles empty visual styles", () => {
    const result = mergeCssStyles({}, "color: red;");
    expect(result).toEqual({ color: "red" });
  });

  it("handles empty manual CSS", () => {
    const visual = { color: "blue" };
    const result = mergeCssStyles(visual, "");
    expect(result).toEqual({ color: "blue" });
  });
});

describe("cleanupManualCss", () => {
  it("removes only manual CSS keys from combined styles", () => {
    const combined = { color: "red", margin: "10px", padding: "5px" };
    const manualKeys = ["color", "padding"];
    const result = cleanupManualCss(combined, manualKeys);
    expect(result).toEqual({ margin: "10px" });
  });

  it("preserves all visual panel styles", () => {
    const combined = {
      "font-size": "14px",
      color: "red",
      margin: "10px",
    };
    const manualKeys = ["color"];
    const result = cleanupManualCss(combined, manualKeys);
    expect(result).toEqual({ "font-size": "14px", margin: "10px" });
  });

  it("handles empty manualCssKeys array", () => {
    const combined = { color: "red", margin: "10px" };
    const result = cleanupManualCss(combined, []);
    expect(result).toEqual({ color: "red", margin: "10px" });
  });

  it("handles case-insensitive key matching", () => {
    const combined = { Color: "red", margin: "10px" };
    const manualKeys = ["color"];
    const result = cleanupManualCss(combined, manualKeys);
    expect(result).toEqual({ margin: "10px" });
  });

  it("returns copy of combined styles when no keys match", () => {
    const combined = { color: "red" };
    const result = cleanupManualCss(combined, ["padding"]);
    expect(result).toEqual({ color: "red" });
    expect(result).not.toBe(combined); // Should be a new object
  });
});

describe("preventBodyDoubleWrap", () => {
  it("unwraps single body wrapper", () => {
    const result = preventBodyDoubleWrap("body { color: red; }");
    expect(result).toBe("color: red;");
  });

  it("unwraps nested body wrappers", () => {
    const result = preventBodyDoubleWrap("body { body { color: red; } }");
    expect(result).toBe("color: red;");
  });

  it("leaves plain declarations unchanged", () => {
    const result = preventBodyDoubleWrap("color: red; font-size: 12px;");
    expect(result).toBe("color: red; font-size: 12px;");
  });

  it("handles empty input", () => {
    expect(preventBodyDoubleWrap("")).toBe("");
    expect(preventBodyDoubleWrap(null)).toBe("");
    expect(preventBodyDoubleWrap(undefined)).toBe("");
  });

  it("handles body wrapper with extra whitespace", () => {
    const result = preventBodyDoubleWrap("  body  {  color: red;  }  ");
    expect(result).toBe("color: red;");
  });

  it("handles deeply nested body wrappers", () => {
    const result = preventBodyDoubleWrap(
      "body { body { body { color: red; } } }",
    );
    expect(result).toBe("color: red;");
  });

  it("preserves non-body selectors inside body", () => {
    const result = preventBodyDoubleWrap(
      "body { p { margin: 0; } h1 { font-size: 24px; } }",
    );
    expect(result).toBe("p { margin: 0; } h1 { font-size: 24px; }");
  });

  it("handles case-insensitive body selector", () => {
    const result = preventBodyDoubleWrap("BODY { color: red; }");
    expect(result).toBe("color: red;");
  });
});
