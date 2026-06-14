/**
 * Property-Based Tests for variableInsertUtils.js
 * Property 1: buildVariableToken output correctness
 * Property 2: getSimplifiedTokenDisplay simplification correctness
 *
 * Validates: Requirements 1.1, 1.4, 2.4, 2.5
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import {
  buildVariableToken,
  getSimplifiedTokenDisplay,
} from "./variableInsertUtils";
import { simplifyTokenDisplay } from "../Components/tokenConfigHelpers";

// --- Arbitraries ---

/**
 * Generate a valid keyName (alphanumeric with underscores, starts with letter).
 */
const keyNameArb = fc
  .stringMatching(/^[a-z][a-z0-9_]{0,15}$/)
  .filter((s) => s.length >= 1);

/**
 * Generate a valid path segment (identifier-like string).
 */
const pathSegmentArb = fc
  .stringMatching(/^[a-z][a-z0-9_]{0,10}$/)
  .filter((s) => s.length >= 1);

/**
 * Generate a valid variablePath (e.g., "doc.invoices.total" or "invoices.total").
 */
const variablePathArb = fc
  .tuple(fc.boolean(), fc.array(pathSegmentArb, { minLength: 1, maxLength: 4 }))
  .map(([hasDocPrefix, segments]) => {
    const path = segments.join(".");
    return hasDocPrefix ? `doc.${path}` : path;
  });

/** Generate variableType values. */
const variableTypeArb = fc.constantFrom(
  "company",
  "docInfo",
  "relation",
  "data",
  "column",
  "field",
  "custom",
);

/** Generate parentType values. */
const parentTypeArb = fc.constantFrom(
  "company",
  "docInfo",
  "relation",
  "data",
  "document",
  "root",
  "",
);

// --- Property 1: buildVariableToken output correctness ---

describe("Property 1: buildVariableToken output correctness", () => {
  /**
   * **Validates: Requirements 1.1, 1.4**
   *
   * For any valid combination of {variableType, parentType, variablePath, keyName},
   * the buildVariableToken function SHALL produce a token string that follows these rules:
   * - If parentType === "company" or variableType === "company", output is {{company.<keyName>}}
   * - If parentType === "docInfo" or variableType === "docInfo", output is {{docInfo.<keyName>}}
   * - If variableType === "relation", output is {{relation <normalizedPath>}} where normalizedPath starts with doc.
   * - Otherwise, output is {{<normalizedPath>}} where normalizedPath starts with doc.
   */
  it("company variableType produces {{company.<keyName>}} token", () => {
    fc.assert(
      fc.property(
        fc.constant("company"),
        parentTypeArb,
        variablePathArb,
        keyNameArb,
        (variableType, parentType, variablePath, keyName) => {
          const result = buildVariableToken({
            variableType,
            parentType,
            variablePath,
            keyName,
          });
          expect(result).toBe(`{{company.${keyName}}}`);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("company parentType produces {{company.<keyName>}} token", () => {
    fc.assert(
      fc.property(
        variableTypeArb.filter((t) => t !== "company"),
        fc.constant("company"),
        variablePathArb,
        keyNameArb,
        (variableType, parentType, variablePath, keyName) => {
          const result = buildVariableToken({
            variableType,
            parentType,
            variablePath,
            keyName,
          });
          expect(result).toBe(`{{company.${keyName}}}`);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("docInfo variableType produces {{docInfo.<keyName>}} token", () => {
    fc.assert(
      fc.property(
        fc.constant("docInfo"),
        parentTypeArb.filter((t) => t !== "company"),
        variablePathArb,
        keyNameArb,
        (variableType, parentType, variablePath, keyName) => {
          const result = buildVariableToken({
            variableType,
            parentType,
            variablePath,
            keyName,
          });
          expect(result).toBe(`{{docInfo.${keyName}}}`);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("docInfo parentType produces {{docInfo.<keyName>}} token", () => {
    fc.assert(
      fc.property(
        variableTypeArb.filter((t) => t !== "company" && t !== "docInfo"),
        fc.constant("docInfo"),
        variablePathArb,
        keyNameArb,
        (variableType, parentType, variablePath, keyName) => {
          const result = buildVariableToken({
            variableType,
            parentType,
            variablePath,
            keyName,
          });
          expect(result).toBe(`{{docInfo.${keyName}}}`);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("relation variableType produces {{relation <normalizedPath>}} with doc. prefix", () => {
    fc.assert(
      fc.property(
        fc.constant("relation"),
        parentTypeArb.filter((t) => t !== "company" && t !== "docInfo"),
        variablePathArb,
        keyNameArb,
        (variableType, parentType, variablePath, keyName) => {
          const result = buildVariableToken({
            variableType,
            parentType,
            variablePath,
            keyName,
          });
          const normalizedPath = variablePath.startsWith("doc.")
            ? variablePath
            : `doc.${variablePath}`;
          expect(result).toBe(`{{relation ${normalizedPath}}}`);
          expect(result).toMatch(/^\{\{relation doc\..+\}\}$/);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("default type produces {{<normalizedPath>}} with doc. prefix", () => {
    fc.assert(
      fc.property(
        variableTypeArb.filter(
          (t) => t !== "company" && t !== "docInfo" && t !== "relation",
        ),
        parentTypeArb.filter((t) => t !== "company" && t !== "docInfo"),
        variablePathArb,
        keyNameArb,
        (variableType, parentType, variablePath, keyName) => {
          const result = buildVariableToken({
            variableType,
            parentType,
            variablePath,
            keyName,
          });
          const normalizedPath = variablePath.startsWith("doc.")
            ? variablePath
            : `doc.${variablePath}`;
          expect(result).toBe(`{{${normalizedPath}}}`);
          expect(result).toMatch(/^\{\{doc\..+\}\}$/);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("all outputs are wrapped in double curly braces", () => {
    fc.assert(
      fc.property(
        variableTypeArb,
        parentTypeArb,
        variablePathArb,
        keyNameArb,
        (variableType, parentType, variablePath, keyName) => {
          const result = buildVariableToken({
            variableType,
            parentType,
            variablePath,
            keyName,
          });
          expect(result.startsWith("{{")).toBe(true);
          expect(result.endsWith("}}")).toBe(true);
          const inner = result.slice(2, -2);
          expect(inner.length).toBeGreaterThan(0);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("company/docInfo priority: company check takes precedence over docInfo", () => {
    fc.assert(
      fc.property(variablePathArb, keyNameArb, (variablePath, keyName) => {
        const result = buildVariableToken({
          variableType: "docInfo",
          parentType: "company",
          variablePath,
          keyName,
        });
        expect(result).toBe(`{{company.${keyName}}}`);
      }),
      { numRuns: 100 },
    );
  });
});

// --- Property 2: getSimplifiedTokenDisplay simplification correctness ---

/**
 * **Validates: Requirements 2.4, 2.5**
 */
describe("Property 2: getSimplifiedTokenDisplay simplification correctness", () => {
  const fieldNameArb = fc
    .stringMatching(/^[a-z][a-z0-9_]{0,20}$/)
    .filter((s) => s.length >= 1);

  const nestedPathArb = fc
    .array(fieldNameArb, { minLength: 1, maxLength: 3 })
    .map((parts) => parts.join("."));

  describe("empty token with doc. prefix variablePath", () => {
    it("returns {{<path without doc. prefix>}} when token is empty and variablePath starts with doc.", () => {
      fc.assert(
        fc.property(nestedPathArb, (path) => {
          const variablePath = `doc.${path}`;
          const result = getSimplifiedTokenDisplay("", variablePath);
          expect(result).toBe(`{{${path}}}`);
        }),
        { numRuns: 100 },
      );
    });

    it("returns {{<variablePath>}} as-is when token is empty and variablePath does NOT start with doc.", () => {
      fc.assert(
        fc.property(nestedPathArb, (path) => {
          const variablePath = path.startsWith("doc.") ? path.slice(4) : path;
          const result = getSimplifiedTokenDisplay("", variablePath);
          expect(result).toBe(`{{${variablePath}}}`);
        }),
        { numRuns: 100 },
      );
    });

    it("returns empty string when both token and variablePath are empty", () => {
      const result = getSimplifiedTokenDisplay("", "");
      expect(result).toBe("");
    });
  });

  describe("token with formatCurrency or formatNumber", () => {
    const formatFnArb = fc.constantFrom("formatCurrency", "formatNumber");

    it("returns {{<field>}} when token contains formatCurrency/formatNumber doc.<field>", () => {
      fc.assert(
        fc.property(formatFnArb, fieldNameArb, (formatFn, field) => {
          const token = `{{${formatFn} doc.${field}}}`;
          const result = getSimplifiedTokenDisplay(token, "");
          expect(result).toBe(`{{${field}}}`);
        }),
        { numRuns: 100 },
      );
    });

    it("returns {{<nested.field>}} when token contains formatCurrency/formatNumber with nested path", () => {
      fc.assert(
        fc.property(formatFnArb, nestedPathArb, (formatFn, path) => {
          const token = `{{${formatFn} doc.${path}}}`;
          const result = getSimplifiedTokenDisplay(token, "");
          expect(result).toBe(`{{${path}}}`);
        }),
        { numRuns: 100 },
      );
    });
  });

  describe("delegation to simplifyTokenDisplay for other tokens", () => {
    it("delegates to simplifyTokenDisplay for non-empty tokens without formatCurrency/formatNumber", () => {
      fc.assert(
        fc.property(nestedPathArb, (path) => {
          const token = `{{doc.${path}}}`;
          const result = getSimplifiedTokenDisplay(token, "");
          const expected = simplifyTokenDisplay(token);
          expect(result).toBe(expected);
        }),
        { numRuns: 100 },
      );
    });

    it("delegates relation tokens to simplifyTokenDisplay", () => {
      fc.assert(
        fc.property(nestedPathArb, (path) => {
          const token = `{{relation doc.${path}}}`;
          const result = getSimplifiedTokenDisplay(token, "");
          const expected = simplifyTokenDisplay(token);
          expect(result).toBe(expected);
        }),
        { numRuns: 100 },
      );
    });
  });
});
