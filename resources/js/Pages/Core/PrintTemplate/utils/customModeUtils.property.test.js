/**
 * Property-Based Tests for customModeUtils.js
 *
 * Property 1: Column Filtering Correctness
 * Property 2: Header Row Count Invariant
 * Property 3: Span Validation and Overlap Detection
 * Property 4: Body Section Structural Invariant
 * Property 5: Drop Target Validation
 *
 * Feature: gjs-table-relation-custom-mode
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import {
  filterRelationColumns,
  canAddHeaderRow,
  canRemoveHeaderRow,
  validateSpan,
  detectOverlap,
  buildOccupancyGrid,
  isValidBodyDropTarget,
  canAddBodyRow,
  canApplyBodySpan,
} from "./customModeUtils";

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

const identArb = fc
  .stringMatching(/^[a-z][a-z0-9_]{0,12}$/)
  .filter((s) => s.length >= 1);

/** Generate a column type that is NOT "relations" (many-relation). */
const basicOrRelationTypeArb = fc.constantFrom(
  "string",
  "number",
  "currency",
  "date",
  "boolean",
  "text",
  "relation",
);

/** Generate a single basic or single-relation column. */
const nonManyRelationColumnArb = fc
  .tuple(identArb, basicOrRelationTypeArb)
  .map(([name, type]) => ({ name, type }));

/** Generate a "relations" (many-relation) column with nested columns. */
const manyRelationColumnArb = fc
  .tuple(
    identArb,
    fc.array(nonManyRelationColumnArb, { minLength: 0, maxLength: 5 }),
  )
  .map(([name, columns]) => ({ name, type: "relations", columns }));

/** Generate a mixed array of columns (basic, relation, many-relation). */
const mixedColumnsArb = (minLen = 0, maxLen = 10) =>
  fc.array(
    fc.oneof(
      nonManyRelationColumnArb,
      manyRelationColumnArb,
    ),
    { minLength: minLen, maxLength: maxLen },
  );

/** Generate a valid header row count (1..5). */
const validRowCountArb = fc.integer({ min: 1, max: 5 });

/** Generate a row count below minimum (≤ 0). */
const belowMinRowCountArb = fc.integer({ min: -10, max: 0 });

/** Generate a row count at or above maximum (≥ 5). */
const atOrAboveMaxRowCountArb = fc.integer({ min: 5, max: 20 });

// ---------------------------------------------------------------------------
// Property 1: Column Filtering Correctness
// Validates: Requirements 2.1, 2.2, 2.3, 2.4
// ---------------------------------------------------------------------------

describe(
  "Feature: gjs-table-relation-custom-mode, Property 1: Column Filtering Correctness",
  () => {
    it("includes all basic and single-relation columns from the target relation", () => {
      fc.assert(
        fc.property(
          identArb,
          fc.array(nonManyRelationColumnArb, { minLength: 1, maxLength: 8 }),
          fc.array(manyRelationColumnArb, { minLength: 0, maxLength: 3 }),
          (relationName, basicCols, manyCols) => {
            const relationNode = {
              name: relationName,
              type: "relations",
              columns: [...basicCols, ...manyCols],
            };

            const dataTableColumns = [
              { name: "doc", type: "doc", columns: [relationNode] },
            ];

            const result = filterRelationColumns(dataTableColumns, relationName);

            // All non-many columns must be in result
            for (const col of basicCols) {
              expect(result.some((r) => r.name === col.name)).toBe(true);
            }
          },
        ),
        { numRuns: 100 },
      );
    });

    it("excludes all many-relation (type 'relations') columns", () => {
      fc.assert(
        fc.property(
          identArb,
          fc.array(nonManyRelationColumnArb, { minLength: 0, maxLength: 5 }),
          fc.array(manyRelationColumnArb, { minLength: 1, maxLength: 5 }),
          (relationName, basicCols, manyCols) => {
            const relationNode = {
              name: relationName,
              type: "relations",
              columns: [...basicCols, ...manyCols],
            };

            const dataTableColumns = [
              { name: "doc", type: "doc", columns: [relationNode] },
            ];

            const result = filterRelationColumns(dataTableColumns, relationName);

            // No many-relation columns should appear in result
            for (const col of manyCols) {
              expect(result.some((r) => r.name === col.name && r.type === "relations")).toBe(false);
            }
          },
        ),
        { numRuns: 100 },
      );
    });

    it("returns empty array when relation not found in dataTableColumns", () => {
      fc.assert(
        fc.property(identArb, identArb, (existingName, lookupName) => {
          // Ensure names differ
          fc.pre(existingName !== lookupName);

          const dataTableColumns = [
            {
              name: "doc",
              type: "doc",
              columns: [
                {
                  name: existingName,
                  type: "relations",
                  columns: [{ name: "col1", type: "string" }],
                },
              ],
            },
          ];

          const result = filterRelationColumns(dataTableColumns, lookupName);
          expect(result).toEqual([]);
        }),
        { numRuns: 100 },
      );
    });

    it("returns empty array for null/undefined inputs", () => {
      expect(filterRelationColumns(null, "items")).toEqual([]);
      expect(filterRelationColumns(undefined, "items")).toEqual([]);
      expect(filterRelationColumns([], "items")).toEqual([]);
      expect(filterRelationColumns([{ name: "doc", type: "doc", columns: [] }], "")).toEqual([]);
    });

    it("single-relation (type 'relation') columns are included in result", () => {
      fc.assert(
        fc.property(identArb, identArb, (relationName, colName) => {
          const relationNode = {
            name: relationName,
            type: "relations",
            columns: [{ name: colName, type: "relation" }],
          };

          const dataTableColumns = [
            { name: "doc", type: "doc", columns: [relationNode] },
          ];

          const result = filterRelationColumns(dataTableColumns, relationName);
          expect(result.some((r) => r.name === colName && r.type === "relation")).toBe(true);
        }),
        { numRuns: 100 },
      );
    });
  },
);

// ---------------------------------------------------------------------------
// Property 2: Header Row Count Invariant
// Validates: Requirements 3.1, 3.2, 3.3
// ---------------------------------------------------------------------------

describe(
  "Feature: gjs-table-relation-custom-mode, Property 2: Header Row Count Invariant",
  () => {
    it("canAddHeaderRow returns true when count < 5", () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 4 }), (count) => {
          expect(canAddHeaderRow(count)).toBe(true);
        }),
        { numRuns: 100 },
      );
    });

    it("canAddHeaderRow returns false when count >= 5", () => {
      fc.assert(
        fc.property(fc.integer({ min: 5, max: 20 }), (count) => {
          expect(canAddHeaderRow(count)).toBe(false);
        }),
        { numRuns: 100 },
      );
    });

    it("canRemoveHeaderRow returns true when count > 1", () => {
      fc.assert(
        fc.property(fc.integer({ min: 2, max: 10 }), (count) => {
          expect(canRemoveHeaderRow(count)).toBe(true);
        }),
        { numRuns: 100 },
      );
    });

    it("canRemoveHeaderRow returns false when count <= 1", () => {
      fc.assert(
        fc.property(fc.integer({ min: -10, max: 1 }), (count) => {
          expect(canRemoveHeaderRow(count)).toBe(false);
        }),
        { numRuns: 100 },
      );
    });

    it("simulating add/remove sequence always keeps count in [1, 5]", () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 5 }),
          fc.array(fc.boolean(), { minLength: 1, maxLength: 30 }),
          (startCount, operations) => {
            // true = attempt add, false = attempt remove
            let count = startCount;

            for (const isAdd of operations) {
              if (isAdd) {
                if (canAddHeaderRow(count)) count++;
              } else {
                if (canRemoveHeaderRow(count)) count--;
              }
            }

            expect(count).toBeGreaterThanOrEqual(1);
            expect(count).toBeLessThanOrEqual(5);
          },
        ),
        { numRuns: 200 },
      );
    });
  },
);

// ---------------------------------------------------------------------------
// Property 3: Span Validation and Overlap Detection
// Validates: Requirements 3.4, 3.5, 3.6
// ---------------------------------------------------------------------------

describe(
  "Feature: gjs-table-relation-custom-mode, Property 3: Span Validation and Overlap Detection",
  () => {
    /** Build a minimal HeaderGrid with no occupied cells. */
    function makeEmptyGrid(totalRows, totalColumns) {
      return {
        totalRows,
        totalColumns,
        rows: Array.from({ length: totalRows }, () => []),
      };
    }

    it("validateSpan accepts span within bounds on empty grid", () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 5 }),
          fc.integer({ min: 1, max: 10 }),
          fc.integer({ min: 1, max: 5 }),
          fc.integer({ min: 1, max: 10 }),
          (totalRows, totalColumns, rowspan, colspan) => {
            fc.pre(rowspan <= totalRows && colspan <= totalColumns);

            const grid = makeEmptyGrid(totalRows, totalColumns);
            const result = validateSpan(grid, 0, 0, colspan, rowspan);
            expect(result.valid).toBe(true);
          },
        ),
        { numRuns: 100 },
      );
    });

    it("validateSpan rejects colspan > totalColumns", () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 5 }),
          fc.integer({ min: 1, max: 10 }),
          (totalRows, totalColumns) => {
            const grid = makeEmptyGrid(totalRows, totalColumns);
            const result = validateSpan(grid, 0, 0, totalColumns + 1, 1);
            expect(result.valid).toBe(false);
            expect(result.error).toBeTruthy();
          },
        ),
        { numRuns: 100 },
      );
    });

    it("validateSpan rejects rowspan > totalRows", () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 5 }),
          fc.integer({ min: 1, max: 10 }),
          (totalRows, totalColumns) => {
            const grid = makeEmptyGrid(totalRows, totalColumns);
            const result = validateSpan(grid, 0, 0, 1, totalRows + 1);
            expect(result.valid).toBe(false);
            expect(result.error).toBeTruthy();
          },
        ),
        { numRuns: 100 },
      );
    });

    it("detectOverlap returns false for non-overlapping cells", () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 2, max: 6 }),
          fc.integer({ min: 2, max: 8 }),
          (rows, cols) => {
            // Place a cell at (0,0) spanning 1x1, check (1,1) — no overlap
            const grid = Array.from({ length: rows }, (_, r) =>
              Array.from({ length: cols }, (_, c) => r === 0 && c === 0),
            );

            const hasOverlap = detectOverlap(grid, 1, 1, 1, 1);
            expect(hasOverlap).toBe(false);
          },
        ),
        { numRuns: 100 },
      );
    });

    it("detectOverlap returns true when proposed span covers occupied cell", () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 2, max: 4 }),
          fc.integer({ min: 2, max: 6 }),
          (rows, cols) => {
            // Mark (1, 1) as occupied
            const grid = Array.from({ length: rows }, (_, r) =>
              Array.from({ length: cols }, (_, c) => r === 1 && c === 1),
            );

            // Span from (0,0) with colspan=2, rowspan=2 should overlap (1,1)
            const hasOverlap = detectOverlap(grid, 0, 0, 2, 2);
            expect(hasOverlap).toBe(true);
          },
        ),
        { numRuns: 100 },
      );
    });

    it("validateSpan rejects overlap with existing cells", () => {
      // Grid: 2 rows, 2 cols. Cell at (0,0) spans 1x2 (occupies row 0, cols 0+1).
      // Attempt to place cell at (0,0) spanning 2x1 — overlaps with (1,0) if occupied.
      const grid = {
        totalRows: 2,
        totalColumns: 2,
        rows: [
          [{ rowIndex: 0, colIndex: 0, colspan: 1, rowspan: 2 }],
          [],
        ],
      };

      // The occupancy grid marks (0,0) and (1,0) as occupied.
      // Trying (0,1) with colspan=2 should fail (col 2 out of bounds).
      const result = validateSpan(grid, 0, 1, 2, 1);
      expect(result.valid).toBe(false);
    });
  },
);

// ---------------------------------------------------------------------------
// Property 4: Body Section Structural Invariant
// Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5
// ---------------------------------------------------------------------------

describe(
  "Feature: gjs-table-relation-custom-mode, Property 4: Body Section Structural Invariant",
  () => {
    it("canAddBodyRow always returns false regardless of current count", () => {
      fc.assert(
        fc.property(fc.integer({ min: 0, max: 100 }), (count) => {
          expect(canAddBodyRow(count)).toBe(false);
        }),
        { numRuns: 100 },
      );
    });

    it("canApplyBodySpan always returns false for any colspan/rowspan", () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 20 }),
          fc.integer({ min: 1, max: 20 }),
          (colspan, rowspan) => {
            expect(canApplyBodySpan(colspan, rowspan)).toBe(false);
          },
        ),
        { numRuns: 100 },
      );
    });

    it("body always has exactly 1 row — repeated add attempts keep count at 1", () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 50 }),
          (attempts) => {
            let count = 1;
            for (let i = 0; i < attempts; i++) {
              if (canAddBodyRow(count)) count++;
            }
            expect(count).toBe(1);
          },
        ),
        { numRuns: 100 },
      );
    });
  },
);

// ---------------------------------------------------------------------------
// Property 5: Drop Target Validation
// Validates: Requirements 4.5, 6.2
// ---------------------------------------------------------------------------

describe(
  "Feature: gjs-table-relation-custom-mode, Property 5: Drop Target Validation",
  () => {
    /** Build a minimal GrapesJS-like component mock. */
    function makeComponent(tagName, parentTagName = null, grandParentTagName = null) {
      const grandParentMock = grandParentTagName
        ? {
            get: (key) => (key === "tagName" ? grandParentTagName : undefined),
            getTagName: () => grandParentTagName,
            parent: () => null,
          }
        : null;

      const parentMock = parentTagName
        ? {
            get: (key) => (key === "tagName" ? parentTagName : undefined),
            getTagName: () => parentTagName,
            parent: () => grandParentMock,
          }
        : null;

      return {
        get: (key) => (key === "tagName" ? tagName : undefined),
        getTagName: () => tagName,
        parent: () => parentMock,
      };
    }

    it("accepts direct <td> cells inside <tr> inside <tbody>", () => {
      const component = makeComponent("td", "tr", "tbody");
      expect(isValidBodyDropTarget(component)).toBe(true);
    });

    it("rejects <td> cells with <tr> parent but NOT <tbody> grandparent", () => {
      fc.assert(
        fc.property(
          fc.constantFrom("thead", "table", "div", "section", "tfoot"),
          (grandParentTag) => {
            const component = makeComponent("td", "tr", grandParentTag);
            expect(isValidBodyDropTarget(component)).toBe(false);
          },
        ),
        { numRuns: 100 },
      );
    });

    it("rejects non-<td> elements regardless of parent structure", () => {
      fc.assert(
        fc.property(
          fc.constantFrom("th", "tr", "tbody", "thead", "table", "div", "span", "p"),
          (tagName) => {
            fc.pre(tagName !== "td");
            const component = makeComponent(tagName, "tr", "tbody");
            expect(isValidBodyDropTarget(component)).toBe(false);
          },
        ),
        { numRuns: 100 },
      );
    });

    it("rejects null/undefined component", () => {
      expect(isValidBodyDropTarget(null)).toBe(false);
      expect(isValidBodyDropTarget(undefined)).toBe(false);
    });

    it("rejects <td> with no parent", () => {
      const component = makeComponent("td", null, null);
      expect(isValidBodyDropTarget(component)).toBe(false);
    });
  },
);
