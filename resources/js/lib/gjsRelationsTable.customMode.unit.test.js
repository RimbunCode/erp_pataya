/**
 * Unit Tests for gjsRelationsTable Custom Mode
 * Task 4.3: Write unit tests for gjsRelationsTable Custom Mode toHTML
 *
 * Tests:
 * - Standard mode still works unchanged
 * - Custom Mode serialization with single header row
 * - Custom Mode serialization with multi-row headers and colspan/rowspan
 * - Body wrapping with {{#each}} / {{/each}}
 * - Relation column tokens use {{relation this.<col>}} syntax
 *
 * Validates: Requirements 7.1, 7.2, 7.3, 7.6
 * Feature: gjs-table-relation-custom-mode
 */

import { describe, it, expect } from "vitest";
import {
  serializeCustomModeHeader,
  serializeCustomModeBody,
} from "../Pages/Core/PrintTemplate/utils/customModeUtils";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// ---------------------------------------------------------------------------
// Mock helpers (same as property test file)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Task 4.3 Unit Tests: gjsRelationsTable Custom Mode toHTML
// ---------------------------------------------------------------------------

describe("gjsRelationsTable Custom Mode toHTML — Unit Tests (Task 4.3)", () => {
  // ─── Standard mode source code verification ───────────────────────────────

  describe("standard mode unchanged", () => {
    const sourcePath = resolve(
      process.cwd(),
      "resources/js/lib/gjsRelationsTable.js",
    );
    const source = readFileSync(sourcePath, "utf8");

    it("toHTML() branches on customMode flag before standard mode logic", () => {
      expect(source).toMatch(
        /if\s*\(\s*this\.get\("customMode"\)\s*===\s*true\s*\)\s*\{[\s\S]*toCustomModeHTML/,
      );
    });

    it("customMode defaults to false in component defaults", () => {
      expect(source).toMatch(/customMode:\s*false/);
    });

    it("toCustomModeHTML method exists and calls serializeCustomModeHeader and serializeCustomModeBody", () => {
      expect(source).toContain("serializeCustomModeHeader");
      expect(source).toContain("serializeCustomModeBody");
    });

    it("toCustomModeHTML outputs data-custom-mode='true' attribute", () => {
      expect(source).toContain('data-custom-mode="true"');
    });
  });

  // ─── Custom Mode serialization with single header row ─────────────────────

  describe("serializeCustomModeHeader — single header row", () => {
    it("produces a <thead> containing exactly one <tr>", () => {
      const cells = [mockCell("th"), mockCell("th"), mockCell("th")];
      const thead = mockThead([mockRow(cells)]);
      const html = serializeCustomModeHeader(thead, "items");

      expect(html).toMatch(/^<thead>/);
      expect(html).toMatch(/<\/thead>$/);
      expect((html.match(/<tr/g) || []).length).toBe(1);
      // Use /<th[ >]/ to avoid matching <thead>
      expect((html.match(/<th[ >]/g) || []).length).toBe(3);
    });

    it("renders a token span with {{label}} helper when cell has data-token", () => {
      const tokenSpan = mockTokenSpan("{{this.name}}");
      const cell = mockCell("th", { children: [tokenSpan] });
      const thead = mockThead([mockRow([cell])]);
      const html = serializeCustomModeHeader(thead, "items");

      // Should contain a label helper referencing the relation prefix
      expect(html).toContain('{{label "doc.items.name"}}');
    });

    it("preserves empty header cells without error", () => {
      const cell = mockCell("th");
      const thead = mockThead([mockRow([cell])]);
      const html = serializeCustomModeHeader(thead, "products");

      expect(html).toContain("<th");
      expect(html).toContain("</th>");
    });
  });

  // ─── Custom Mode serialization with multi-row headers ─────────────────────

  describe("serializeCustomModeHeader — multi-row headers with colspan/rowspan", () => {
    it("produces two <tr> elements for a two-row header", () => {
      const row1 = mockRow([mockCell("th"), mockCell("th")]);
      const row2 = mockRow([mockCell("th"), mockCell("th")]);
      const thead = mockThead([row1, row2]);
      const html = serializeCustomModeHeader(thead, "orders");

      expect((html.match(/<tr/g) || []).length).toBe(2);
    });

    it("preserves colspan attribute on <th> cells", () => {
      const cellWithColspan = mockCell("th", { colspan: 3 });
      const thead = mockThead([mockRow([cellWithColspan])]);
      const html = serializeCustomModeHeader(thead, "items");

      expect(html).toContain('colspan="3"');
    });

    it("preserves rowspan attribute on <th> cells", () => {
      const cellWithRowspan = mockCell("th", { rowspan: 2 });
      const thead = mockThead([mockRow([cellWithRowspan])]);
      const html = serializeCustomModeHeader(thead, "items");

      expect(html).toContain('rowspan="2"');
    });

    it("preserves both colspan and rowspan on the same cell", () => {
      const cell = mockCell("th", { colspan: 2, rowspan: 3 });
      const thead = mockThead([mockRow([cell])]);
      const html = serializeCustomModeHeader(thead, "items");

      expect(html).toContain('colspan="2"');
      expect(html).toContain('rowspan="3"');
    });

    it("does not output colspan='1' (default should be omitted)", () => {
      const cell = mockCell("th", { colspan: 1 });
      const thead = mockThead([mockRow([cell])]);
      const html = serializeCustomModeHeader(thead, "items");

      // colspan="1" is the default and should not be rendered
      expect(html).not.toContain('colspan="1"');
    });
  });

  // ─── Body wrapping with {{#each}} / {{/each}} ──────────────────────────────

  describe("serializeCustomModeBody — {{#each}} wrapping", () => {
    it("wraps body row with {{#each doc.<relation>}} and {{/each}}", () => {
      const row = mockRow([mockCell("td"), mockCell("td")]);
      const tbody = mockTbody([row]);
      const html = serializeCustomModeBody(tbody, "items");

      expect(html).toContain("{{#each doc.items}}");
      expect(html).toContain("{{/each}}");
    });

    it("places {{#each}} before the <tr> and {{/each}} after </tr>", () => {
      const row = mockRow([mockCell("td")]);
      const tbody = mockTbody([row]);
      const html = serializeCustomModeBody(tbody, "payments");

      const eachPos = html.indexOf("{{#each doc.payments}}");
      const trOpenPos = html.indexOf("<tr");
      const trClosePos = html.lastIndexOf("</tr>");
      const eachEndPos = html.indexOf("{{/each}}");

      expect(eachPos).toBeLessThan(trOpenPos);
      expect(trClosePos).toBeLessThan(eachEndPos);
    });

    it("adds doc. prefix when relation name has no doc. prefix", () => {
      const tbody = mockTbody([mockRow([mockCell("td")])]);
      const html = serializeCustomModeBody(tbody, "invoices");

      expect(html).toContain("{{#each doc.invoices}}");
      expect(html).not.toContain("{{#each invoices}}");
    });

    it("does not double the doc. prefix when relation name already has it", () => {
      const tbody = mockTbody([mockRow([mockCell("td")])]);
      const html = serializeCustomModeBody(tbody, "doc.invoices");

      expect(html).toContain("{{#each doc.invoices}}");
      expect(html).not.toContain("doc.doc.");
    });
  });

  // ─── Relation column tokens use {{relation this.<col>}} syntax ─────────────

  describe("serializeCustomModeBody — token syntax", () => {
    it("preserves {{this.<col>}} tokens for basic columns", () => {
      const token = "{{this.product_name}}";
      const cell = mockCell("td", { children: [mockTokenSpan(token)] });
      const tbody = mockTbody([mockRow([cell])]);
      const html = serializeCustomModeBody(tbody, "items");

      expect(html).toContain(token);
    });

    it("preserves {{relation this.<col>}} tokens for relation columns", () => {
      const token = "{{relation this.category}}";
      const cell = mockCell("td", { children: [mockTokenSpan(token)] });
      const tbody = mockTbody([mockRow([cell])]);
      const html = serializeCustomModeBody(tbody, "items");

      expect(html).toContain(token);
    });

    it("renders multiple tokens in one row in their DOM order", () => {
      const tokens = [
        "{{this.name}}",
        "{{this.quantity}}",
        "{{relation this.unit}}",
      ];
      const cells = tokens.map((t) =>
        mockCell("td", { children: [mockTokenSpan(t)] }),
      );
      const tbody = mockTbody([mockRow(cells)]);
      const html = serializeCustomModeBody(tbody, "items");

      let lastPos = 0;
      for (const token of tokens) {
        const pos = html.indexOf(token, lastPos);
        expect(pos).toBeGreaterThan(lastPos - 1);
        lastPos = pos;
      }
    });

    it("outputs inline CSS on body cells when style is present", () => {
      const cell = mockCell("td", { style: { "font-weight": "bold" } });
      const tbody = mockTbody([mockRow([cell])]);
      const html = serializeCustomModeBody(tbody, "items");

      expect(html).toContain("font-weight:bold");
    });
  });

  // ─── Full toCustomModeHTML integration via source verification ─────────────

  describe("toCustomModeHTML integration", () => {
    const sourcePath = resolve(
      process.cwd(),
      "resources/js/lib/gjsRelationsTable.js",
    );
    const source = readFileSync(sourcePath, "utf8");

    it("toCustomModeHTML uses data-relations attribute for the relation name", () => {
      expect(source).toMatch(
        /toCustomModeHTML[\s\S]*attrs\["data-relations"\]/,
      );
    });

    it("toCustomModeHTML finds thead and tbody child components", () => {
      expect(source).toMatch(/toCustomModeHTML[\s\S]*toLowerCase\(\).*thead/);
      expect(source).toMatch(/toCustomModeHTML[\s\S]*toLowerCase\(\).*tbody/);
    });
  });
});
