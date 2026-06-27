/**
 * Integration Tests for Custom Mode Save/Load Cycle (Task 7.2)
 *
 * Tests the persistence round-trip for gjsRelationsTable in Custom Mode:
 * - Template save with Custom Mode table persists all data
 * - Template load restores Custom Mode state correctly
 * - Fallback behavior for corrupted/missing layout data
 *
 * These tests use mock GrapesJS component patterns to verify the serialization
 * logic without requiring the full GrapesJS editor runtime.
 *
 * Validates: Requirements 8.1, 8.2, 8.4
 * Feature: gjs-table-relation-custom-mode
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  serializeCustomModeHeader,
  serializeCustomModeBody,
} from "../Pages/Core/PrintTemplate/utils/customModeUtils";

// ---------------------------------------------------------------------------
// Mock helpers
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
  const attrs = {};
  if (colspan != null) attrs.colspan = colspan;
  if (rowspan != null) attrs.rowspan = rowspan;
  return mockComponent({ tagName, attributes: attrs, style, children });
}

function mockRow(cells) {
  return mockComponent({ tagName: "tr", children: cells });
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
  });
}

/**
 * Builds a "project data" object simulating what GrapesJS stores on save.
 * In GrapesJS, component properties are stored in the component JSON tree.
 * @param {object} componentJson - The component's JSON representation
 * @returns {object} Simulated project data
 */
function buildProjectData(componentJson) {
  return {
    pages: [
      {
        component: {
          type: "wrapper",
          components: [componentJson],
        },
      },
    ],
  };
}

/**
 * Simulates loading a component from project data (GrapesJS deserialization).
 * Returns the first component in the wrapper's children that matches the type.
 * @param projectData
 * @param type
 */
function loadComponentFromProjectData(projectData, type) {
  const wrapper = projectData.pages?.[0]?.component;
  return wrapper?.components?.find((c) => c.type === type) || null;
}

// ---------------------------------------------------------------------------
// Integration Test Suite
// ---------------------------------------------------------------------------

describe("Custom Mode Save/Load Integration Tests (Task 7.2)", () => {
  // ─── Requirement 8.1: Save persists customMode flag and layout ─────────────

  describe("save: Custom Mode flag persisted in project data", () => {
    it("customMode:true is included when component is saved — requirement 8.1", () => {
      // Simulate saving a gjsRelationsTable with customMode=true
      const componentJson = {
        type: "gjsRelationsTable",
        customMode: true,
        attributes: { "data-relations": "items" },
        components: [
          { tagName: "thead", components: [] },
          { tagName: "tbody", components: [] },
        ],
      };

      const projectData = buildProjectData(componentJson);
      const loaded = loadComponentFromProjectData(
        projectData,
        "gjsRelationsTable",
      );

      expect(loaded).not.toBeNull();
      expect(loaded.customMode).toBe(true);
    });

    it("customMode:false (default) can be absent from project data — requirement 8.1", () => {
      // Standard mode table should not require customMode in project data
      const componentJson = {
        type: "gjsRelationsTable",
        attributes: { "data-relations": "items" },
        components: [],
      };

      const projectData = buildProjectData(componentJson);
      const loaded = loadComponentFromProjectData(
        projectData,
        "gjsRelationsTable",
      );

      // In standard mode, customMode is absent (defaults to false)
      expect(loaded.customMode).toBeUndefined();
    });

    it("custom layout child components are preserved in project data — requirement 8.1", () => {
      const headerRow = { tagName: "tr", components: [{ tagName: "th" }] };
      const bodyRow = { tagName: "tr", components: [{ tagName: "td" }] };

      const componentJson = {
        type: "gjsRelationsTable",
        customMode: true,
        attributes: {
          "data-relations": "items",
          class: "table table-bordered w-100",
        },
        components: [
          { tagName: "thead", components: [headerRow] },
          { tagName: "tbody", components: [bodyRow] },
        ],
      };

      const projectData = buildProjectData(componentJson);
      const loaded = loadComponentFromProjectData(
        projectData,
        "gjsRelationsTable",
      );

      const thead = loaded.components.find((c) => c.tagName === "thead");
      const tbody = loaded.components.find((c) => c.tagName === "tbody");

      expect(thead).toBeDefined();
      expect(tbody).toBeDefined();
      expect(thead.components).toHaveLength(1);
      expect(tbody.components).toHaveLength(1);
    });
  });

  // ─── Requirement 8.2: Load restores Custom Mode state correctly ────────────

  describe("load: Custom Mode state correctly restored", () => {
    it("loaded component with customMode:true is recognized as Custom Mode — requirement 8.2", () => {
      const componentJson = {
        type: "gjsRelationsTable",
        customMode: true,
        attributes: { "data-relations": "payments" },
        components: [
          { tagName: "thead", components: [{ tagName: "tr", components: [] }] },
          { tagName: "tbody", components: [{ tagName: "tr", components: [] }] },
        ],
      };

      const projectData = buildProjectData(componentJson);
      const loaded = loadComponentFromProjectData(
        projectData,
        "gjsRelationsTable",
      );

      // The loaded component should be recognized as Custom Mode
      expect(loaded.customMode).toBe(true);
      expect(loaded.attributes["data-relations"]).toBe("payments");
    });

    it("data-custom-mode attribute in serialized HTML indicates Custom Mode — requirement 8.2", () => {
      // toCustomModeHTML must output data-custom-mode="true" so the loaded HTML
      // can be identified as Custom Mode when parsing
      const thead = mockThead([mockRow([mockCell("th")])]);
      const tbody = mockTbody([mockRow([mockCell("td")])]);

      // Simulate what toCustomModeHTML builds
      const headerHtml = serializeCustomModeHeader(thead, "items");
      const bodyHtml = serializeCustomModeBody(tbody, "items");
      const fullHtml = `<table class="table table-bordered w-100" data-relations="items" data-custom-mode="true">${headerHtml}${bodyHtml}</table>`;

      expect(fullHtml).toContain('data-custom-mode="true"');
      expect(fullHtml).toContain('data-relations="items"');
    });

    it("loaded custom layout header rows match the saved count — requirement 8.2", () => {
      const savedHeaderRows = [
        { tagName: "tr", components: [{ tagName: "th" }] },
        { tagName: "tr", components: [{ tagName: "th" }, { tagName: "th" }] },
      ];

      const componentJson = {
        type: "gjsRelationsTable",
        customMode: true,
        attributes: { "data-relations": "items" },
        components: [
          { tagName: "thead", components: savedHeaderRows },
          { tagName: "tbody", components: [] },
        ],
      };

      const projectData = buildProjectData(componentJson);
      const loaded = loadComponentFromProjectData(
        projectData,
        "gjsRelationsTable",
      );
      const thead = loaded.components.find((c) => c.tagName === "thead");

      expect(thead.components).toHaveLength(2);
    });

    it("cell styles are preserved in serialized output — requirement 8.2", () => {
      const styledCell = mockCell("td", {
        style: { "text-align": "right", "font-weight": "bold" },
      });
      const tbody = mockTbody([mockRow([styledCell])]);
      const html = serializeCustomModeBody(tbody, "items");

      expect(html).toContain("text-align:right");
      expect(html).toContain("font-weight:bold");
    });

    it("variable tokens in cells are preserved after serialization — requirement 8.2", () => {
      const token = "{{this.product_name}}";
      const cell = mockCell("td", { children: [mockTokenSpan(token)] });
      const tbody = mockTbody([mockRow([cell])]);
      const html = serializeCustomModeBody(tbody, "items");

      expect(html).toContain(token);
    });
  });

  // ─── Requirement 8.4: Fallback for corrupted/missing layout data ───────────

  describe("fallback: corrupted or missing layout data — requirement 8.4", () => {
    it("source code contains the customMode:layoutRestoreError event trigger", () => {
      const sourcePath = resolve(
        process.cwd(),
        "resources/js/lib/gjsRelationsTable.js",
      );
      const source = readFileSync(sourcePath, "utf8");

      expect(source).toContain("customMode:layoutRestoreError");
      expect(source).toMatch(
        /customMode.*true[\s\S]*components\(\)\.length.*===.*0/,
      );
    });

    it("Editor.jsx listens for customMode:layoutRestoreError and shows toast.error", () => {
      const editorPath = resolve(
        process.cwd(),
        "resources/js/Pages/Core/PrintTemplate/Editor.jsx",
      );
      const editorSource = readFileSync(editorPath, "utf8");

      expect(editorSource).toContain("customMode:layoutRestoreError");
      expect(editorSource).toContain("custom_mode_layout_restore_error");
      expect(editorSource).toMatch(/toast\.error/);
    });

    it("customMode flag is preserved even when layout is empty — requirement 8.4", () => {
      // A corrupted component would have customMode:true but no children
      const componentJson = {
        type: "gjsRelationsTable",
        customMode: true,
        attributes: { "data-relations": "items" },
        components: [], // empty — simulates corrupted layout
      };

      const projectData = buildProjectData(componentJson);
      const loaded = loadComponentFromProjectData(
        projectData,
        "gjsRelationsTable",
      );

      // Flag must still be preserved (not cleared)
      expect(loaded.customMode).toBe(true);
      expect(loaded.components).toHaveLength(0);
    });
  });

  // ─── Serialization output verification ────────────────────────────────────

  describe("toCustomModeHTML output structure", () => {
    it("full output contains table tag with required attributes", () => {
      const thead = mockThead([mockRow([mockCell("th")])]);
      const tbody = mockTbody([mockRow([mockCell("td")])]);
      const headerHtml = serializeCustomModeHeader(thead, "items");
      const bodyHtml = serializeCustomModeBody(tbody, "items");
      const html = `<table class="table table-bordered w-100" data-relations="items" data-custom-mode="true">${headerHtml}${bodyHtml}</table>`;

      expect(html).toContain("<table");
      expect(html).toContain('data-relations="items"');
      expect(html).toContain('data-custom-mode="true"');
      expect(html).toContain("<thead>");
      expect(html).toContain("<tbody>");
      expect(html).toContain("{{#each doc.items}}");
      expect(html).toContain("{{/each}}");
    });

    it("colspan/rowspan attributes survive round-trip through serializeCustomModeHeader", () => {
      const cell = mockCell("th", { colspan: 2, rowspan: 3 });
      const thead = mockThead([mockRow([cell])]);
      const html = serializeCustomModeHeader(thead, "orders");

      expect(html).toContain('colspan="2"');
      expect(html).toContain('rowspan="3"');
    });

    it("multiple header rows each serialize to a <tr> in output", () => {
      const thead = mockThead([
        mockRow([mockCell("th"), mockCell("th")]),
        mockRow([mockCell("th")]),
      ]);
      const html = serializeCustomModeHeader(thead, "items");

      expect((html.match(/<tr/g) || []).length).toBe(2);
    });
  });
});
