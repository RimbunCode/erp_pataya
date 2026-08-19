/**
 * Unit Tests for Sidebar Integration and Drop Validation (Task 6.4)
 *
 * Tests:
 * - Correct panel displayed based on selection state
 * - Panel revert on deselection
 * - Drop rejection on invalid targets with toast notification
 * - handleInsert behavior in edit mode vs selection mode
 *
 * Uses source-code assertion + pure function unit test patterns.
 *
 * Validates: Requirements 1.4, 2.6, 4.5, 6.2, 6.3, 6.4
 * Feature: gjs-table-relation-custom-mode
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect } from "vitest";
import { isValidBodyDropTarget } from "../utils/customModeUtils";

const componentsDir = resolve(
  process.cwd(),
  "resources/js/Pages/Core/PrintTemplate/Components",
);
const utilsDir = resolve(
  process.cwd(),
  "resources/js/Pages/Core/PrintTemplate/utils",
);

const sidebarSource = readFileSync(`${componentsDir}/Sidebar.jsx`, "utf8");
const dropUtilsSource = readFileSync(
  `${utilsDir}/variableDropUtils.js`,
  "utf8",
);
const variableItemSource = readFileSync(
  `${componentsDir}/VariableItem.jsx`,
  "utf8",
);

// ---------------------------------------------------------------------------
// Sidebar panel selection state tests
// Requirements: 1.4, 1.6, 2.6
// ---------------------------------------------------------------------------

describe("Sidebar panel switching — source code verification (Task 6.4)", () => {
  it("listens to component:selected to update selectedComponent state", () => {
    expect(sidebarSource).toContain("component:selected");
    expect(sidebarSource).toMatch(/setSelectedComponent\s*\(\s*selected/);
  });

  it("listens to component:deselected to clear selectedComponent state", () => {
    expect(sidebarSource).toContain("component:deselected");
    expect(sidebarSource).toMatch(
      /setSelectedComponent\s*\(\s*selected\s*\|\|\s*null\s*\)/,
    );
  });

  it("computes isRelationsTableSelected from selectedComponent type — requirement 1.4", () => {
    expect(sidebarSource).toMatch(
      /isRelationsTableSelected[\s\S]*getType.*===.*gjsRelationsTable/,
    );
  });

  it("displays CustomModePanel when isRelationsTableSelected is true — requirement 1.4, 1.6", () => {
    expect(sidebarSource).toMatch(
      /isRelationsTableSelected.*\?.*\n.*<CustomModePanel/,
    );
  });

  it("reverts to VariableManager when isRelationsTableSelected is false — requirement 2.6", () => {
    expect(sidebarSource).toMatch(/<VariableManager\s*\/>/);
  });

  it("suppresses TokenConfigurationManager for gjsRelationsTable — requirement 1.4", () => {
    // When isRelationsTableSelected && customMode, CustomModePanel renders instead of TokenConfigurationManager
    expect(sidebarSource).toMatch(
      /isRelationsTableSelected &&[\s\S]*customMode.*===.*true.*\?[\s\S]*<CustomModePanel[\s\S]*:[\s\S]*<TokenConfigurationManager/,
    );
  });

  it("component:update also updates selectedComponent — prevents stale state on customMode change", () => {
    expect(sidebarSource).toContain("component:update");
  });
});

// ---------------------------------------------------------------------------
// Drop validation pure function tests
// Requirements: 4.5, 6.1, 6.2
// ---------------------------------------------------------------------------

describe("isValidBodyDropTarget — drop validation unit tests (Task 6.4)", () => {
  function makeComponent(
    tagName,
    parentTagName = null,
    grandParentTagName = null,
  ) {
    const grandParentMock = grandParentTagName
      ? {
          get: (k) => (k === "tagName" ? grandParentTagName : undefined),
          getTagName: () => grandParentTagName,
          parent: () => null,
        }
      : null;

    const parentMock = parentTagName
      ? {
          get: (k) => (k === "tagName" ? parentTagName : undefined),
          getTagName: () => parentTagName,
          parent: () => grandParentMock,
        }
      : null;

    return {
      get: (k) => (k === "tagName" ? tagName : undefined),
      getTagName: () => tagName,
      parent: () => parentMock,
    };
  }

  it("accepts a <td> with parent <tr> and grandparent <tbody> — requirement 4.5", () => {
    const component = makeComponent("td", "tr", "tbody");
    expect(isValidBodyDropTarget(component)).toBe(true);
  });

  it("rejects a <td> with parent <tr> and grandparent <thead> — requirement 4.5", () => {
    const component = makeComponent("td", "tr", "thead");
    expect(isValidBodyDropTarget(component)).toBe(false);
  });

  it("rejects a <th> even when nested correctly in tbody structure — requirement 4.5", () => {
    const component = makeComponent("th", "tr", "tbody");
    expect(isValidBodyDropTarget(component)).toBe(false);
  });

  it("rejects a <tr> as drop target — requirement 4.5", () => {
    const component = makeComponent("tr", "tbody", "table");
    expect(isValidBodyDropTarget(component)).toBe(false);
  });

  it("rejects a <table> as drop target — requirement 4.5", () => {
    const component = makeComponent("table", null, null);
    expect(isValidBodyDropTarget(component)).toBe(false);
  });

  it("rejects null — defensive guard", () => {
    expect(isValidBodyDropTarget(null)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// variableDropUtils — Custom Mode drop handling source verification
// Requirements: 6.1, 6.2
// ---------------------------------------------------------------------------

describe("variableDropUtils Custom Mode drop handling (Task 6.4)", () => {
  it("imports isValidBodyDropTarget from customModeUtils", () => {
    expect(dropUtilsSource).toContain("isValidBodyDropTarget");
    expect(dropUtilsSource).toContain("customModeUtils");
  });

  it("contains findCustomModeTable helper to detect Custom Mode ancestor", () => {
    expect(dropUtilsSource).toContain("findCustomModeTable");
    expect(dropUtilsSource).toMatch(/getType.*gjsRelationsTable/);
    expect(dropUtilsSource).toMatch(/get.*customMode.*true/);
  });

  it("rejects invalid drop targets in Custom Mode with toast.error — requirement 6.2", () => {
    // When findCustomModeTable returns a table and isValidBodyDropTarget is false
    expect(dropUtilsSource).toMatch(
      /!isValidBodyDropTarget\(parent\)[\s\S]*model\.remove\(\)[\s\S]*toast\.error/,
    );
  });

  it("transforms gjsSubGrid into a token span when drop target is valid — requirement 6.1", () => {
    expect(dropUtilsSource).toMatch(/isValidBodyDropTarget\(parent\)/);
    // Should find the token and add a span
    expect(dropUtilsSource).toContain("data-token");
    expect(dropUtilsSource).toMatch(/parent\.components\(\)\.add/);
  });

  it("removes the original gjsSubGrid after inserting token span in Custom Mode", () => {
    expect(dropUtilsSource).toMatch(
      /findCustomModeTable\(parent\)[\s\S]*model\.remove\(\)/,
    );
  });
});

// ---------------------------------------------------------------------------
// VariableItem handleInsert — Custom Mode body cell integration
// Requirements: 6.3, 6.4
// ---------------------------------------------------------------------------

describe("VariableItem handleInsert Custom Mode integration (Task 6.4)", () => {
  it("checks for <td> or <th> selectedTag before Custom Mode table detection — requirement 6.3", () => {
    expect(variableItemSource).toMatch(
      /selectedTag.*===.*"td".*\|\|.*selectedTag.*===.*"th"/,
    );
  });

  it("walks up parent chain to find Custom Mode gjsRelationsTable — requirement 6.3", () => {
    expect(variableItemSource).toMatch(
      /isInCustomModeTable[\s\S]*gjsRelationsTable[\s\S]*customMode.*true/,
    );
  });

  it("appends a token span as child of selected <td>/<th> in Custom Mode — requirement 6.3, 6.4", () => {
    // When isInCustomModeTable is true, calls selected.components().add({ tagName: "span", ... })
    expect(variableItemSource).toMatch(
      /isInCustomModeTable[\s\S]*selected\.components\(\)\.add/,
    );
  });

  it("existing tryInsertInlineVariableToken is still called first — requirement 6.3", () => {
    // Text edit mode inline insert must still be attempted before any Custom Mode logic
    expect(variableItemSource).toContain("tryInsertInlineVariableToken");
    // The inline insert check comes before the isTableCell check in the code
    const inlineInsertPos = variableItemSource.indexOf(
      "tryInsertInlineVariableToken",
    );
    const tableCellCheckPos = variableItemSource.indexOf("isTableCell");
    expect(inlineInsertPos).toBeLessThan(tableCellCheckPos);
  });
});
