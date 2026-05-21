/**
 * Property-Based Tests for cssUtils.js
 * Properties 13, 14, 15, 16, 17
 *
 * Validates: Requirements 21.1, 21.2, 21.3, 21.4, 21.5, 22.2, 22.3
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import {
  parseCssDeclarations,
  serializeCssDeclarations,
  validateCssDeclarations,
  mergeCssStyles,
  cleanupManualCss,
  preventBodyDoubleWrap,
} from "./cssUtils";

// --- Arbitraries ---

/**
 * Generate a valid CSS property name (lowercase, hyphenated).
 */
const cssPropertyArb = fc.constantFrom(
  "color",
  "font-size",
  "margin",
  "padding",
  "border",
  "background-color",
  "display",
  "width",
  "height",
  "text-align",
  "line-height",
  "font-weight",
  "opacity",
  "overflow",
  "position",
  "top",
  "left",
  "right",
  "bottom",
  "z-index",
);

/**
 * Generate a valid CSS value (no semicolons or colons to avoid ambiguity).
 */
const cssValueArb = fc.constantFrom(
  "red",
  "blue",
  "green",
  "10px",
  "20px",
  "1em",
  "2rem",
  "100%",
  "auto",
  "none",
  "block",
  "inline",
  "flex",
  "grid",
  "bold",
  "normal",
  "center",
  "left",
  "right",
  "0",
  "1",
  "inherit",
  "initial",
  "solid 1px black",
  "0 0 10px rgba(0,0,0,0.5)",
);

/**
 * Generate a single valid CSS declaration pair (property + value).
 */
const cssDeclarationPairArb = fc.record({
  property: cssPropertyArb,
  value: cssValueArb,
});

/**
 * Generate an array of unique CSS declaration pairs (unique by property).
 */
const uniqueDeclarationPairsArb = fc.uniqueArray(cssDeclarationPairArb, {
  minLength: 1,
  maxLength: 8,
  comparator: (a, b) => a.property === b.property,
});

/**
 * Generate a valid CSS declaration string from pairs.
 */
const validCssTextArb = uniqueDeclarationPairsArb.map((pairs) =>
  pairs.map((p) => `${p.property}: ${p.value}`).join("; "),
);

/**
 * Generate a style object (Record<string, string>).
 */
const styleObjectArb = fc
  .uniqueArray(cssDeclarationPairArb, {
    minLength: 1,
    maxLength: 6,
    comparator: (a, b) => a.property === b.property,
  })
  .map((pairs) => Object.fromEntries(pairs.map((p) => [p.property, p.value])));

// --- Property 13: CSS declaration parsing round-trip ---

describe("Property 13: CSS declaration parsing round-trip", () => {
  /**
   * **Validates: Requirements 21.1, 21.2**
   *
   * For any valid CSS declaration string (semicolon-separated `property: value;` pairs),
   * parsing with `parseCssDeclarations` and then serializing back to text SHALL produce
   * an equivalent set of property-value pairs (all pairs are preserved).
   */
  it("parse then serialize produces equivalent pairs", () => {
    fc.assert(
      fc.property(uniqueDeclarationPairsArb, (pairs) => {
        // Build a CSS text from the pairs
        const cssText = pairs
          .map((p) => `${p.property}: ${p.value}`)
          .join("; ");

        // Parse the CSS text
        const parsed = parseCssDeclarations(cssText);

        // Verify all original pairs are preserved in the parsed result
        for (const { property, value } of pairs) {
          expect(parsed[property]).toBe(value);
        }

        // Verify the count matches (no extra properties)
        expect(Object.keys(parsed).length).toBe(pairs.length);

        // Serialize back and re-parse to verify round-trip
        const serialized = serializeCssDeclarations(parsed);
        const reParsed = parseCssDeclarations(serialized);

        // The re-parsed result should equal the first parse
        expect(reParsed).toEqual(parsed);
      }),
      { numRuns: 150 },
    );
  });

  it("serialized output can always be re-parsed to the same object", () => {
    fc.assert(
      fc.property(styleObjectArb, (styleObj) => {
        const serialized = serializeCssDeclarations(styleObj);
        const parsed = parseCssDeclarations(serialized);

        // Every key-value in the original should be in the parsed result
        for (const [key, value] of Object.entries(styleObj)) {
          expect(parsed[key]).toBe(value);
        }
        expect(Object.keys(parsed).length).toBe(Object.keys(styleObj).length);
      }),
      { numRuns: 150 },
    );
  });
});

// --- Property 14: Invalid CSS declaration detection ---

describe("Property 14: Invalid CSS declaration detection", () => {
  /**
   * **Validates: Requirements 21.3**
   *
   * For any CSS declaration string containing entries with missing colons or missing values,
   * the CSS validator SHALL flag those entries as errors while correctly parsing any valid
   * declarations in the same input.
   */
  it("missing colons are flagged as errors", () => {
    fc.assert(
      fc.property(
        cssPropertyArb,
        cssValueArb,
        cssPropertyArb,
        (validProp, validValue, invalidProp) => {
          // Build a string with one valid and one invalid (missing colon) declaration
          const cssText = `${validProp}: ${validValue}; ${invalidProp} missing_value_no_colon`;

          const result = validateCssDeclarations(cssText);

          // Should not be fully valid
          expect(result.isValid).toBe(false);

          // Should have at least one error with reason "missing_colon"
          const colonErrors = result.errors.filter(
            (e) => e.reason === "missing_colon",
          );
          expect(colonErrors.length).toBeGreaterThanOrEqual(1);

          // The valid declaration should still be parsed
          expect(result.validDeclarations[validProp]).toBe(validValue);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("missing values are flagged as errors", () => {
    fc.assert(
      fc.property(
        cssPropertyArb,
        cssValueArb,
        cssPropertyArb,
        (validProp, validValue, emptyValueProp) => {
          // Ensure the two properties are different to avoid overwrite
          fc.pre(validProp !== emptyValueProp);

          // Build a string with one valid and one invalid (missing value) declaration
          const cssText = `${validProp}: ${validValue}; ${emptyValueProp}:`;

          const result = validateCssDeclarations(cssText);

          // Should not be fully valid
          expect(result.isValid).toBe(false);

          // Should have at least one error with reason "missing_value"
          const valueErrors = result.errors.filter(
            (e) => e.reason === "missing_value",
          );
          expect(valueErrors.length).toBeGreaterThanOrEqual(1);

          // The valid declaration should still be parsed
          expect(result.validDeclarations[validProp]).toBe(validValue);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("fully valid declarations produce no errors", () => {
    fc.assert(
      fc.property(validCssTextArb, (cssText) => {
        const result = validateCssDeclarations(cssText);

        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
        expect(Object.keys(result.validDeclarations).length).toBeGreaterThan(0);
      }),
      { numRuns: 100 },
    );
  });
});

// --- Property 15: Style merging with manual CSS precedence ---

describe("Property 15: Style merging with manual CSS precedence", () => {
  /**
   * **Validates: Requirements 21.4**
   *
   * For any existing visual style object and for any manual CSS declaration set,
   * merging them SHALL produce a combined style where manual CSS values override
   * visual style values for overlapping properties, and non-overlapping properties
   * from both sources are preserved.
   */
  it("manual CSS values override visual for overlapping properties", () => {
    fc.assert(
      fc.property(
        styleObjectArb,
        styleObjectArb,
        (visualStyles, manualStyles) => {
          const merged = mergeCssStyles(visualStyles, manualStyles);

          // For overlapping keys, manual value should win
          for (const [key, value] of Object.entries(manualStyles)) {
            expect(merged[key]).toBe(value);
          }

          // For non-overlapping visual keys, visual value should be preserved
          for (const [key, value] of Object.entries(visualStyles)) {
            if (!(key in manualStyles)) {
              expect(merged[key]).toBe(value);
            }
          }
        },
      ),
      { numRuns: 150 },
    );
  });

  it("all properties from both sources are present in merged result", () => {
    fc.assert(
      fc.property(
        styleObjectArb,
        styleObjectArb,
        (visualStyles, manualStyles) => {
          const merged = mergeCssStyles(visualStyles, manualStyles);

          // All keys from both sources should be in the merged result
          const allKeys = new Set([
            ...Object.keys(visualStyles),
            ...Object.keys(manualStyles),
          ]);

          expect(Object.keys(merged).length).toBe(allKeys.size);

          for (const key of allKeys) {
            expect(key in merged).toBe(true);
          }
        },
      ),
      { numRuns: 150 },
    );
  });

  it("merging with string manual CSS produces same result as object", () => {
    fc.assert(
      fc.property(
        styleObjectArb,
        uniqueDeclarationPairsArb,
        (visualStyles, manualPairs) => {
          // Build manual CSS as string
          const manualCssText = manualPairs
            .map((p) => `${p.property}: ${p.value}`)
            .join("; ");

          // Build manual CSS as object
          const manualCssObj = Object.fromEntries(
            manualPairs.map((p) => [p.property, p.value]),
          );

          const mergedFromString = mergeCssStyles(visualStyles, manualCssText);
          const mergedFromObject = mergeCssStyles(visualStyles, manualCssObj);

          expect(mergedFromString).toEqual(mergedFromObject);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// --- Property 16: Manual CSS cleanup preserves visual panel styles ---

describe("Property 16: Manual CSS cleanup preserves visual panel styles", () => {
  /**
   * **Validates: Requirements 21.5**
   *
   * For any component with both visual panel styles and manual CSS applied,
   * clearing all manual CSS text SHALL remove only the properties that were
   * previously applied via manual CSS, leaving all visual panel properties unchanged.
   */
  it("cleanup removes only manual keys, preserving visual styles", () => {
    fc.assert(
      fc.property(
        styleObjectArb,
        styleObjectArb,
        (visualStyles, manualStyles) => {
          // Merge visual + manual to get combined styles
          const combined = mergeCssStyles(visualStyles, manualStyles);
          const manualKeys = Object.keys(manualStyles);

          // Cleanup manual CSS
          const cleaned = cleanupManualCss(combined, manualKeys);

          // All visual-only keys should be preserved with their values
          for (const [key, value] of Object.entries(visualStyles)) {
            if (!manualKeys.includes(key)) {
              expect(cleaned[key]).toBe(value);
            }
          }

          // No manual-only keys should remain
          for (const key of manualKeys) {
            if (!(key in visualStyles)) {
              expect(key in cleaned).toBe(false);
            }
          }
        },
      ),
      { numRuns: 150 },
    );
  });

  it("cleanup with empty manual keys returns all combined styles", () => {
    fc.assert(
      fc.property(styleObjectArb, (combinedStyles) => {
        const cleaned = cleanupManualCss(combinedStyles, []);

        // All properties should be preserved
        expect(cleaned).toEqual(combinedStyles);

        // Should be a new object (not same reference)
        expect(cleaned).not.toBe(combinedStyles);
      }),
      { numRuns: 100 },
    );
  });

  it("cleanup never introduces new properties", () => {
    fc.assert(
      fc.property(
        styleObjectArb,
        fc.array(cssPropertyArb, { minLength: 1, maxLength: 5 }),
        (combinedStyles, manualKeys) => {
          const cleaned = cleanupManualCss(combinedStyles, manualKeys);

          // Every key in cleaned must exist in the original combined styles
          for (const key of Object.keys(cleaned)) {
            expect(key in combinedStyles).toBe(true);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

// --- Property 17: Body node CSS prevents double-wrapping ---

describe("Property 17: Body node CSS prevents double-wrapping", () => {
  /**
   * **Validates: Requirements 22.2, 22.3**
   *
   * For any CSS text saved on the body node, the stored/exported CSS SHALL never
   * contain nested `body{body{...}}` patterns. If the input already contains a
   * `body{}` wrapper, it SHALL not be wrapped again.
   */
  it("output never contains nested body{body{...}} pattern", () => {
    fc.assert(
      fc.property(validCssTextArb, (cssContent) => {
        // Test with single body wrapper
        const wrapped = `body { ${cssContent} }`;
        const result = preventBodyDoubleWrap(wrapped);

        // Result should never contain body{body{
        expect(result).not.toMatch(/body\s*\{[^}]*body\s*\{/i);
      }),
      { numRuns: 100 },
    );
  });

  it("double-wrapped body CSS is fully unwrapped", () => {
    fc.assert(
      fc.property(validCssTextArb, (cssContent) => {
        // Test with double body wrapper
        const doubleWrapped = `body { body { ${cssContent} } }`;
        const result = preventBodyDoubleWrap(doubleWrapped);

        // Result should not start with body{
        expect(result).not.toMatch(/^\s*body\s*\{/i);

        // The content should be preserved (trimmed)
        expect(result).toBe(cssContent.trim());
      }),
      { numRuns: 100 },
    );
  });

  it("plain CSS without body wrapper passes through unchanged", () => {
    fc.assert(
      fc.property(validCssTextArb, (cssContent) => {
        // Plain CSS without body wrapper
        const result = preventBodyDoubleWrap(cssContent);

        // Should be the same content (trimmed)
        expect(result).toBe(cssContent.trim());
      }),
      { numRuns: 100 },
    );
  });

  it("applying preventBodyDoubleWrap twice is idempotent", () => {
    fc.assert(
      fc.property(
        fc.oneof(
          validCssTextArb,
          validCssTextArb.map((css) => `body { ${css} }`),
          validCssTextArb.map((css) => `body { body { ${css} } }`),
        ),
        (cssInput) => {
          const first = preventBodyDoubleWrap(cssInput);
          const second = preventBodyDoubleWrap(first);

          // Applying twice should give the same result
          expect(second).toBe(first);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("deeply nested body wrappers are fully unwrapped", () => {
    fc.assert(
      fc.property(
        validCssTextArb,
        fc.integer({ min: 2, max: 5 }),
        (cssContent, depth) => {
          // Build deeply nested body wrappers
          let wrapped = cssContent;
          for (let i = 0; i < depth; i++) {
            wrapped = `body { ${wrapped} }`;
          }

          const result = preventBodyDoubleWrap(wrapped);

          // Result should never start with body{
          expect(result).not.toMatch(/^\s*body\s*\{/i);
        },
      ),
      { numRuns: 100 },
    );
  });
});
