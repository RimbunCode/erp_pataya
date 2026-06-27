/**
 * Property-Based Tests for Custom Mode serialization in gjsRelationsTable
 *
 * Property 6: Custom Mode toHTML Serialization Structure
 * Property 7: Custom Mode Content Serialization Fidelity
 * Property 8: Custom Mode Persistence Round-Trip
 *
 * Feature: gjs-table-relation-custom-mode
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import {
  serializeCustomModeHeader,
  serializeCustomModeBody,
} from "../Pages/Core/PrintTemplate/utils/customModeUtils";

// ---------------------------------------------------------------------------
// Helpers to build GrapesJS component mocks
// ---------------------------------------------------------------------------

/**
 * Creates a mock GrapesJS component with minimal required methods.
 * @param {object} opts
 * @param {string} opts.tagName
 * @param {string} [opts.content]
 * @param {object} [opts.attributes]
 * @param {object} [opts.style]
 * @param {Array} [opts.children]
 */
function mockComponent({
  tagName = "td",
  content = "",
  attributes = {},
  style = {},
  children = [],
} = {}) {
  return {
    get: (key) => {
      if (key === "tagName") return tagName;
      if (key === "content") return content;
      return undefined;
    },
    getTagName: () => tagName,
    getAttributes: () => attributes,
    getStyle: () => style,
    components: () => children,
  };
}

function mockCell(
  tagName,
  { children = [], colspan, rowspan, style = {} } = {},
) {
  const attributes = {};
  if (colspan !== undefined) attributes.colspan = colspan;
  if (rowspan !== undefined) attributes.rowspan = rowspan;

  return mockComponent({ tagName, attributes, style, children });
}

function mockRow(cells, style = {}) {
  return mockComponent({ tagName: "tr", style, children: cells });
}

function mockThead(rows) {
  return mockComponent({ tagName: "thead", children: rows });
}

function mockTbody(rows) {
  return mockComponent({ tagName: "tbody", children: rows });
}

function mockTokenSpan(token) {
  return mockComponent({
    tagName: "span",
    attributes: { "data-token": token },
    content: token,
  });
}

function _mockTextNode(text) {
  return mockComponent({ tagName: "span", content: text });
}

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

const identArb = fc
  .stringMatching(/^[a-z][a-z0-9_]{0,12}$/)
  .filter((s) => s.length >= 1);

const relationNameArb = identArb;

/** Generate a basic column name (no dots). */
const colNameArb = identArb;

/** Generate a "basic" body token like {{this.colName}}. */
const basicBodyTokenArb = colNameArb.map((col) => `{{this.${col}}}`);

/** Generate a "relation" body token like {{relation this.colName}}. */
const relationBodyTokenArb = colNameArb.map(
  (col) => `{{relation this.${col}}}`,
);

/** Generate either a basic or relation body token. */
const bodyTokenArb = fc.oneof(basicBodyTokenArb, relationBodyTokenArb);

// ---------------------------------------------------------------------------
// Property 6: Custom Mode toHTML Serialization Structure
// Validates: Requirements 7.1, 7.2, 7.3, 7.6
// ---------------------------------------------------------------------------

describe("Feature: gjs-table-relation-custom-mode, Property 6: Custom Mode toHTML Serialization Structure", () => {
  it("serializeCustomModeHeader outputs exactly N <tr> elements for N header rows", () => {
    fc.assert(
      fc.property(
        relationNameArb,
        fc.integer({ min: 1, max: 5 }),
        fc.integer({ min: 1, max: 8 }),
        (relationName, numRows, numCols) => {
          const rows = Array.from({ length: numRows }, () => {
            const cells = Array.from({ length: numCols }, () => mockCell("th"));
            return mockRow(cells);
          });

          const thead = mockThead(rows);
          const html = serializeCustomModeHeader(thead, relationName);

          // Count <tr> occurrences in output
          const trCount = (html.match(/<tr/g) || []).length;
          expect(trCount).toBe(numRows);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("serializeCustomModeHeader wraps output in <thead>...</thead>", () => {
    fc.assert(
      fc.property(relationNameArb, (relationName) => {
        const thead = mockThead([mockRow([mockCell("th")])]);
        const html = serializeCustomModeHeader(thead, relationName);

        expect(html).toMatch(/^<thead>/);
        expect(html).toMatch(/<\/thead>$/);
      }),
      { numRuns: 100 },
    );
  });

  it("serializeCustomModeBody wraps body row with {{#each doc.<relation>}} / {{/each}}", () => {
    fc.assert(
      fc.property(relationNameArb, colNameArb, (relationName, colName) => {
        const bodyRow = mockRow([
          mockCell("td", { children: [mockTokenSpan(`{{this.${colName}}}`)] }),
        ]);
        const tbody = mockTbody([bodyRow]);
        const html = serializeCustomModeBody(tbody, relationName);

        const expectedEach = `{{#each doc.${relationName}}}`;
        expect(html).toContain(expectedEach);
        expect(html).toContain("{{/each}}");

        // {{#each}} must come before <tr> and {{/each}} must come after </tr>
        const eachPos = html.indexOf(expectedEach);
        const trPos = html.indexOf("<tr");
        const trEndPos = html.lastIndexOf("</tr>");
        const eachEndPos = html.indexOf("{{/each}}");

        expect(eachPos).toBeLessThan(trPos);
        expect(trEndPos).toBeLessThan(eachEndPos);
      }),
      { numRuns: 100 },
    );
  });

  it("serializeCustomModeBody wraps in <tbody>...</tbody>", () => {
    fc.assert(
      fc.property(relationNameArb, (relationName) => {
        const tbody = mockTbody([mockRow([mockCell("td")])]);
        const html = serializeCustomModeBody(tbody, relationName);

        expect(html).toMatch(/^<tbody>/);
        expect(html).toMatch(/<\/tbody>$/);
      }),
      { numRuns: 100 },
    );
  });

  it("serializeCustomModeBody preserves {{this.<col>}} tokens verbatim", () => {
    fc.assert(
      fc.property(relationNameArb, colNameArb, (relationName, colName) => {
        const token = `{{this.${colName}}}`;
        const bodyRow = mockRow([
          mockCell("td", { children: [mockTokenSpan(token)] }),
        ]);
        const tbody = mockTbody([bodyRow]);
        const html = serializeCustomModeBody(tbody, relationName);

        expect(html).toContain(token);
      }),
      { numRuns: 100 },
    );
  });

  it("serializeCustomModeBody preserves {{relation this.<col>}} tokens verbatim", () => {
    fc.assert(
      fc.property(relationNameArb, colNameArb, (relationName, colName) => {
        const token = `{{relation this.${colName}}}`;
        const bodyRow = mockRow([
          mockCell("td", { children: [mockTokenSpan(token)] }),
        ]);
        const tbody = mockTbody([bodyRow]);
        const html = serializeCustomModeBody(tbody, relationName);

        expect(html).toContain(token);
      }),
      { numRuns: 100 },
    );
  });

  it("colspan and rowspan attributes are preserved in serialized <th> output", () => {
    fc.assert(
      fc.property(
        relationNameArb,
        fc.integer({ min: 2, max: 5 }),
        fc.integer({ min: 2, max: 5 }),
        (relationName, colspan, rowspan) => {
          const cell = mockCell("th", { colspan, rowspan });
          const thead = mockThead([mockRow([cell])]);
          const html = serializeCustomModeHeader(thead, relationName);

          expect(html).toContain(`colspan="${colspan}"`);
          expect(html).toContain(`rowspan="${rowspan}"`);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("relation name without doc. prefix gets doc. added in #each wrapper", () => {
    fc.assert(
      fc.property(
        identArb.filter((n) => !n.startsWith("doc.")),
        (relationName) => {
          const tbody = mockTbody([mockRow([mockCell("td")])]);
          const html = serializeCustomModeBody(tbody, relationName);

          expect(html).toContain(`{{#each doc.${relationName}}}`);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("relation name already with doc. prefix is not doubled", () => {
    fc.assert(
      fc.property(identArb, (name) => {
        const tbody = mockTbody([mockRow([mockCell("td")])]);
        const html = serializeCustomModeBody(tbody, `doc.${name}`);

        expect(html).toContain(`{{#each doc.${name}}}`);
        expect(html).not.toContain("{{#each doc.doc.");
      }),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 7: Custom Mode Content Serialization Fidelity
// Validates: Requirements 7.4, 7.5, 7.7
// ---------------------------------------------------------------------------

describe("Feature: gjs-table-relation-custom-mode, Property 7: Custom Mode Content Serialization Fidelity", () => {
  it("inline CSS styles are serialized as style attributes on cells", () => {
    fc.assert(
      fc.property(
        relationNameArb,
        fc.record({
          "text-align": fc.constantFrom("left", "center", "right"),
          "font-weight": fc.constantFrom("bold", "normal"),
        }),
        (relationName, style) => {
          const cell = mockCell("th", { style });
          const thead = mockThead([mockRow([cell])]);
          const html = serializeCustomModeHeader(thead, relationName);

          expect(html).toContain("style=");
          for (const [prop, val] of Object.entries(style)) {
            expect(html).toContain(`${prop}:${val}`);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it("cells without styles produce no style attribute", () => {
    fc.assert(
      fc.property(relationNameArb, (relationName) => {
        const cell = mockCell("th", { style: {} });
        const thead = mockThead([mockRow([cell])]);
        const html = serializeCustomModeHeader(thead, relationName);

        // No style attr when style object is empty
        expect(html).not.toContain('style="');
      }),
      { numRuns: 100 },
    );
  });

  it("multiple children in a body cell are all present in output (DOM order)", () => {
    fc.assert(
      fc.property(
        relationNameArb,
        fc.array(colNameArb, { minLength: 2, maxLength: 5 }),
        (relationName, colNames) => {
          const children = colNames.map((col) =>
            mockTokenSpan(`{{this.${col}}}`),
          );
          const bodyRow = mockRow([mockCell("td", { children })]);
          const tbody = mockTbody([bodyRow]);
          const html = serializeCustomModeBody(tbody, relationName);

          // All tokens must appear in html
          for (const col of colNames) {
            expect(html).toContain(`{{this.${col}}}`);
          }

          // Verify DOM order is preserved (each token appears before the next)
          let lastPos = 0;
          for (const col of colNames) {
            const pos = html.indexOf(`{{this.${col}}}`, lastPos);
            expect(pos).toBeGreaterThanOrEqual(lastPos);
            lastPos = pos;
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it("null/undefined thead returns empty thead tag", () => {
    expect(serializeCustomModeHeader(null, "items")).toBe("<thead></thead>");
    expect(serializeCustomModeHeader(undefined, "items")).toBe(
      "<thead></thead>",
    );
  });

  it("null/undefined tbody returns empty tbody tag", () => {
    expect(serializeCustomModeBody(null, "items")).toBe("<tbody></tbody>");
    expect(serializeCustomModeBody(undefined, "items")).toBe("<tbody></tbody>");
  });
});

// ---------------------------------------------------------------------------
// Property 8: Custom Mode Persistence Round-Trip
// This property verifies that the serialized HTML can be parsed back to
// equivalent structure — specifically that key tokens and structure survive.
// Validates: Requirements 1.5, 8.1, 8.2
// ---------------------------------------------------------------------------

describe("Feature: gjs-table-relation-custom-mode, Property 8: Custom Mode Persistence Round-Trip", () => {
  it("serialized body always contains exactly one <tr> block per row", () => {
    fc.assert(
      fc.property(
        relationNameArb,
        fc.integer({ min: 1, max: 5 }),
        (relationName, numCols) => {
          const cells = Array.from({ length: numCols }, () => mockCell("td"));
          const tbody = mockTbody([mockRow(cells)]);
          const html = serializeCustomModeBody(tbody, relationName);

          const trCount = (html.match(/<tr/g) || []).length;
          expect(trCount).toBe(1);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("serialized header row count matches input row count", () => {
    fc.assert(
      fc.property(
        relationNameArb,
        fc.integer({ min: 1, max: 5 }),
        (relationName, numRows) => {
          const rows = Array.from({ length: numRows }, () =>
            mockRow([mockCell("th")]),
          );
          const thead = mockThead(rows);
          const html = serializeCustomModeHeader(thead, relationName);

          const trCount = (html.match(/<tr/g) || []).length;
          expect(trCount).toBe(numRows);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("every body token in input appears in serialized output", () => {
    fc.assert(
      fc.property(
        relationNameArb,
        fc.array(bodyTokenArb, { minLength: 1, maxLength: 6 }),
        (relationName, tokens) => {
          const cells = tokens.map((token) =>
            mockCell("td", { children: [mockTokenSpan(token)] }),
          );
          const tbody = mockTbody([mockRow(cells)]);
          const html = serializeCustomModeBody(tbody, relationName);

          for (const token of tokens) {
            expect(html).toContain(token);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
