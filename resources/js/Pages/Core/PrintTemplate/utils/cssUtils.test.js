import { describe, it, expect } from "vitest";
import {
  buildComponentSelectorTokens,
  filterCssRulesByComponentTokens,
  parseCssDeclarations,
  selectorIncludesComponentToken,
  selectorMatchesComponentTokens,
  serializeCssDeclarations,
  splitSelectorList,
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

  it("parses declaration blocks with selector syntax", () => {
    const result = parseCssDeclarations(
      "#invoice .total-row { color: red; font-size: 14px; }",
    );
    expect(result).toEqual({
      "#invoice .total-row": { color: "red", "font-size": "14px" },
    });
  });

  it("parses multiple selector blocks into selector map", () => {
    const result = parseCssDeclarations(
      "body{background-color:red;color:black} #c123{margin:2px; color:black; }",
    );
    expect(result).toEqual({
      body: { "background-color": "red", color: "black" },
      "#c123": { margin: "2px", color: "black" },
    });
  });

  it("can force rule blocks to return flat declaration map", () => {
    const result = parseCssDeclarations(
      "#invoice .total-row { color: red; font-size: 14px; }",
      { mode: "declarations" },
    );
    expect(result).toEqual({ color: "red", "font-size": "14px" });
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

  it("returns valid for standard CSS rule block syntax", () => {
    const result = validateCssDeclarations(
      "#invoice .item-row > td { color: red; font-size: 12px; }",
    );
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.validDeclarations).toEqual({
      color: "red",
      "font-size": "12px",
    });
  });

  it("supports selector list with id and class", () => {
    const result = validateCssDeclarations(
      "#invoice, .invoice-preview { margin: 0; padding: 8px; }",
    );
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.validDeclarations).toEqual({ margin: "0", padding: "8px" });
  });

  it("detects invalid selector syntax in rule blocks", () => {
    const result = validateCssDeclarations("#invoice > { color: red; }");
    expect(result.isValid).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].reason).toBe("invalid_selector");
  });

  it("detects missing closing brace in rule blocks", () => {
    const result = validateCssDeclarations("#invoice { color: red;");
    expect(result.isValid).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].reason).toBe("missing_brace");
  });

  it("still validates declarations inside selector blocks", () => {
    const result = validateCssDeclarations(
      "#invoice { color red; margin: 10px; }",
    );
    expect(result.isValid).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].reason).toBe("missing_colon");
    expect(result.validDeclarations).toEqual({ margin: "10px" });
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

  it("flattens selector map result when merging string rule blocks", () => {
    const visual = { color: "blue", margin: "10px" };
    const manual = "#invoice { color: red; padding: 8px; }";
    const result = mergeCssStyles(visual, manual);
    expect(result).toEqual({ color: "red", margin: "10px", padding: "8px" });
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

describe("splitSelectorList", () => {
  it("splits simple selector list", () => {
    expect(splitSelectorList(".a, .b, #c")).toEqual([".a", ".b", "#c"]);
  });

  it("does not split commas inside attribute or pseudo params", () => {
    expect(
      splitSelectorList(
        '[data-label="a,b"], .card:is(.warn, .info), button[type="submit"]',
      ),
    ).toEqual([
      '[data-label="a,b"]',
      ".card:is(.warn, .info)",
      'button[type="submit"]',
    ]);
  });
});

describe("buildComponentSelectorTokens", () => {
  it("builds tag, id, class, and attribute tokens", () => {
    expect(
      buildComponentSelectorTokens({
        id: "print-btn",
        tagName: "button",
        classes: ["card", "alert"],
        attributes: { type: "submit", "data-role": "primary" },
        selectorsString: ".card.alert",
      }),
    ).toEqual(
      expect.arrayContaining([
        "button",
        "#print-btn",
        ".card",
        ".alert",
        "[type]",
        '[type="submit"]',
        "[data-role]",
        '[data-role="primary"]',
        ".card.alert",
      ]),
    );
  });
});

describe("selectorIncludesComponentToken", () => {
  it("matches class and id with token boundaries", () => {
    expect(selectorIncludesComponentToken(".card > button", ".card")).toBe(
      true,
    );
    expect(selectorIncludesComponentToken(".card-alert", ".card")).toBe(false);
    expect(selectorIncludesComponentToken("section #main", "#main")).toBe(true);
  });

  it("matches tag and attribute selectors", () => {
    expect(selectorIncludesComponentToken(".card > button", "button")).toBe(
      true,
    );
    expect(
      selectorIncludesComponentToken('input[type="submit"]', "[type]"),
    ).toBe(true);
    expect(
      selectorIncludesComponentToken('input[type="submit"]', '[type="submit"]'),
    ).toBe(true);
  });
});

describe("selectorMatchesComponentTokens", () => {
  it("matches selectors with combinators and selector list", () => {
    const componentTokens = ["button", ".alert"];
    expect(
      selectorMatchesComponentTokens(
        ".card > button, .unknown",
        componentTokens,
      ),
    ).toBe(true);
    expect(
      selectorMatchesComponentTokens(
        "button .alert, .unknown",
        componentTokens,
      ),
    ).toBe(true);
    expect(selectorMatchesComponentTokens(".foo .bar", componentTokens)).toBe(
      false,
    );
  });
});

describe("filterCssRulesByComponentTokens", () => {
  it("filters rules using component tokens", () => {
    const cssRules = [
      { selectors: ".card > button", style: { color: "red" } },
      { selectors: "button .alert", style: { margin: "8px" } },
      { selectors: ".unrelated", style: { padding: "4px" } },
    ];

    expect(
      filterCssRulesByComponentTokens(cssRules, ["button", ".alert"]),
    ).toEqual([
      { selectors: ".card > button", style: { color: "red" } },
      { selectors: "button .alert", style: { margin: "8px" } },
    ]);
  });
});
