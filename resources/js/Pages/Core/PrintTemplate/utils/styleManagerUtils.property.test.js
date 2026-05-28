import { describe, expect, it } from "vitest";
import * as fc from "fast-check";
import {
  STYLE_MANAGER_UNIT_OPTIONS,
  combineValueUnit,
  mapSectorsToSections,
  normalizePropertyId,
  parseValueAndUnit,
} from "./styleManagerUtils";

function createMockProperty(id) {
  return {
    getId: () => id,
    getType: () => "text",
  };
}

function createMockSector(properties) {
  return {
    getProperties: () => properties,
  };
}

const numericStringArb = fc.oneof(
  fc.integer({ min: -10000, max: 10000 }).map(String),
  fc
    .tuple(
      fc.integer({ min: -10000, max: 10000 }),
      fc.integer({ min: 0, max: 9999 }),
    )
    .map(([whole, fraction]) => `${whole}.${fraction}`),
);

const unitArb = fc.constantFrom(
  ...STYLE_MANAGER_UNIT_OPTIONS.filter((unit) => unit !== "auto"),
);

describe("Property 1: Value-Unit Round Trip", () => {
  it("parse + combine keeps equivalent css value for recognized units", () => {
    fc.assert(
      fc.property(numericStringArb, unitArb, (numericValue, unit) => {
        const cssValue = `${numericValue}${unit}`;
        const parsed = parseValueAndUnit(cssValue);
        const recombined = combineValueUnit(parsed.numericValue, parsed.unit);

        expect(recombined).toBe(cssValue);
      }),
      { numRuns: 150 },
    );
  });

  it("numeric-only values default to px", () => {
    fc.assert(
      fc.property(numericStringArb, (numericValue) => {
        const parsed = parseValueAndUnit(numericValue);

        expect(parsed.unit).toBe("px");
        expect(combineValueUnit(parsed.numericValue, parsed.unit)).toBe(
          `${numericValue}px`,
        );
      }),
      { numRuns: 120 },
    );
  });
});

describe("Property 2: Section Mapping Completeness", () => {
  const knownPropertyIds = [
    "width",
    "height",
    "margin",
    "padding",
    "font-size",
    "font-style",
    "text-align",
    "text-decoration",
    "background-color",
    "background-image",
    "border",
    "border-color",
    "box-shadow",
    "line-height",
    "opacity",
  ];

  const propertyIdArb = fc.oneof(
    fc.constantFrom(...knownPropertyIds),
    fc.stringMatching(/^[a-z][a-z0-9-]{2,16}$/),
  );

  it("every input property appears in exactly one output section", () => {
    fc.assert(
      fc.property(
        fc.array(propertyIdArb, { minLength: 1, maxLength: 60 }),
        (propertyIds) => {
          const properties = propertyIds.map((id) => createMockProperty(id));
          const sections = mapSectorsToSections([createMockSector(properties)]);
          const flattened = Object.values(sections).flatMap(
            (section) => section.properties,
          );

          expect(flattened.length).toBe(properties.length);
          expect(new Set(flattened).size).toBe(properties.length);

          for (const property of properties) {
            expect(flattened.includes(property)).toBe(true);
          }
        },
      ),
      { numRuns: 120 },
    );
  });
});

/**
 * Property 3: normalizePropertyId idempotence and correctness
 * **Validates: Requirements 3.4**
 */
describe("Property 3: normalizePropertyId idempotence and correctness", () => {
  const inputArb = fc.oneof(
    fc.string(),
    fc.constant(null),
    fc.constant(undefined),
    fc.constant(""),
    fc.constant("   "),
    fc.stringMatching(/^[\s]*[A-Za-z0-9-]+[\s]*$/),
  );

  it("normalizePropertyId is idempotent: applying it twice yields the same result as once", () => {
    fc.assert(
      fc.property(inputArb, (input) => {
        const once = normalizePropertyId(input);
        const twice = normalizePropertyId(once);

        expect(twice).toBe(once);
      }),
      { numRuns: 100 },
    );
  });

  it("normalizePropertyId output equals String(input ?? '').trim().toLowerCase()", () => {
    fc.assert(
      fc.property(inputArb, (input) => {
        const result = normalizePropertyId(input);
        const expected = String(input ?? "")
          .trim()
          .toLowerCase();

        expect(result).toBe(expected);
      }),
      { numRuns: 100 },
    );
  });
});
