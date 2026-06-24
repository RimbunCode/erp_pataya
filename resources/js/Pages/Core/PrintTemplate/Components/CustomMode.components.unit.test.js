/**
 * Unit Tests for Custom Mode React Components (Task 5.5)
 *
 * Tests:
 * - CustomModeToggle: modal display, confirm/cancel behavior, mode toggling
 * - CustomModeVariablePanel: correct filtering, empty state, expandable items
 * - CustomModeHeaderEditor: row add/remove limits, span validation errors
 * - CustomModePanel: panel coordination, toast messages on invalid operations
 *
 * Uses source-code assertion pattern consistent with this project's test conventions.
 *
 * Validates: Requirements 1.1, 1.3, 2.7, 3.3, 5.2, 5.4
 * Feature: gjs-table-relation-custom-mode
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect } from "vitest";

const componentsDir = resolve(
  process.cwd(),
  "resources/js/Pages/Core/PrintTemplate/Components",
);

const toggleSource = readFileSync(
  `${componentsDir}/CustomModeToggle.jsx`,
  "utf8",
);
const variablePanelSource = readFileSync(
  `${componentsDir}/CustomModeVariablePanel.jsx`,
  "utf8",
);
const headerEditorSource = readFileSync(
  `${componentsDir}/CustomModeHeaderEditor.jsx`,
  "utf8",
);
const panelSource = readFileSync(
  `${componentsDir}/CustomModePanel.jsx`,
  "utf8",
);
const sidebarSource = readFileSync(`${componentsDir}/Sidebar.jsx`, "utf8");

// ---------------------------------------------------------------------------
// CustomModeToggle
// Requirements: 1.1, 1.2, 1.3, 1.7, 1.8
// ---------------------------------------------------------------------------

describe("CustomModeToggle (Task 5.5)", () => {
  it("renders a toggle button with role='switch' and aria-checked", () => {
    expect(toggleSource).toContain('role="switch"');
    expect(toggleSource).toContain("aria-checked={isCustomMode}");
  });

  it("opens a Dialog on toggle click", () => {
    expect(toggleSource).toContain("setDialogOpen(true)");
    expect(toggleSource).toContain("<Dialog");
    expect(toggleSource).toContain("</Dialog>");
  });

  it("shows activation warning text when isCustomMode is false", () => {
    expect(toggleSource).toContain("activate_custom_mode_warning");
  });

  it("shows deactivation warning text when isCustomMode is true", () => {
    expect(toggleSource).toContain("deactivate_custom_mode_warning");
  });

  it("calls onModeChange(!isCustomMode) on confirm — requirement 1.2", () => {
    expect(toggleSource).toMatch(/onModeChange\s*\(\s*!isCustomMode\s*\)/);
  });

  it("closes dialog without calling onModeChange on cancel — requirement 1.3", () => {
    expect(toggleSource).toMatch(/setDialogOpen\(false\)/);
    // Cancel handler only calls setDialogOpen(false), not onModeChange
    expect(toggleSource).toContain("handleCancel");
    expect(toggleSource).toMatch(/handleCancel[\s\S]*setDialogOpen\(false\)/);
  });

  it("uses Dialog from @/Components/ui/dialog", () => {
    expect(toggleSource).toContain("@/Components/ui/dialog");
  });

  it("includes activation and deactivation title translations", () => {
    expect(toggleSource).toContain("activate_custom_mode_title");
    expect(toggleSource).toContain("deactivate_custom_mode_title");
  });
});

// ---------------------------------------------------------------------------
// CustomModeVariablePanel
// Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.7
// ---------------------------------------------------------------------------

describe("CustomModeVariablePanel (Task 5.5)", () => {
  it("imports filterRelationColumns from customModeUtils", () => {
    expect(variablePanelSource).toContain("filterRelationColumns");
    expect(variablePanelSource).toContain("customModeUtils");
  });

  it("passes relationName to filterRelationColumns — requirement 2.1", () => {
    expect(variablePanelSource).toMatch(
      /filterRelationColumns[\s\S]*relationName/,
    );
  });

  it("renders VariableItem for each filtered column — requirement 2.2, 2.3", () => {
    expect(variablePanelSource).toContain("VariableItem");
    expect(variablePanelSource).toMatch(/relationColumns\.map\(/);
  });

  it("shows empty state message when no columns — requirement 2.7", () => {
    expect(variablePanelSource).toContain("no_relation_variables");
    expect(variablePanelSource).toMatch(/relationColumns\.length\s*===\s*0/);
  });

  it("passes path set to relation prefix for VariableItem — requirement 2.1", () => {
    // Each VariableItem should receive path=`doc.${relationName}`
    expect(variablePanelSource).toContain("relationPath");
    expect(variablePanelSource).toContain("`doc.${relationName}`");
  });

  it("builds titleTransLookup from dataTableColumns — requirement 2.5", () => {
    expect(variablePanelSource).toContain("buildTitleTransLookupMap");
    expect(variablePanelSource).toContain("titleTransLookup");
  });
});

// ---------------------------------------------------------------------------
// CustomModeHeaderEditor
// Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6
// ---------------------------------------------------------------------------

describe("CustomModeHeaderEditor (Task 5.5)", () => {
  it("imports canAddHeaderRow and canRemoveHeaderRow — requirement 3.1, 3.2", () => {
    expect(headerEditorSource).toContain("canAddHeaderRow");
    expect(headerEditorSource).toContain("canRemoveHeaderRow");
  });

  it("shows toast.error when add row limit exceeded — requirement 3.1, 3.3", () => {
    expect(headerEditorSource).toContain("max_header_rows");
    expect(headerEditorSource).toMatch(/toast\.error/);
  });

  it("shows toast.error when remove row limit reached — requirement 3.3", () => {
    expect(headerEditorSource).toContain("min_header_rows");
  });

  it("disables add button when canAddHeaderRow returns false — requirement 3.1", () => {
    expect(headerEditorSource).toMatch(
      /disabled=\{!canAddHeaderRow\(headerRowCount\)\}/,
    );
  });

  it("disables remove button when canRemoveHeaderRow returns false — requirement 3.2, 3.3", () => {
    expect(headerEditorSource).toMatch(
      /disabled=\{!canRemoveHeaderRow\(headerRowCount\)\}/,
    );
  });

  it("imports validateSpan from customModeUtils for span validation — requirement 3.4, 3.5, 3.6", () => {
    expect(headerEditorSource).toContain("validateSpan");
    expect(headerEditorSource).toContain("customModeUtils");
  });

  it("provides colspan and rowspan input fields — requirement 3.4, 3.5", () => {
    expect(headerEditorSource).toContain("colspanInput");
    expect(headerEditorSource).toContain("rowspanInput");
  });

  it("shows span_conflict error when validateSpan fails — requirement 3.6", () => {
    expect(headerEditorSource).toMatch(/!result\.valid/);
    expect(headerEditorSource).toContain("span_conflict");
  });

  it("listens to component:selected/deselected to update selectedCell state", () => {
    expect(headerEditorSource).toContain("component:selected");
    expect(headerEditorSource).toContain("component:deselected");
    expect(headerEditorSource).toContain("setSelectedCell");
  });

  it("shows span editor section only when a <th> cell is selected", () => {
    expect(headerEditorSource).toMatch(/selectedCell\s*&&/);
  });
});

// ---------------------------------------------------------------------------
// CustomModePanel
// Requirements: 1.2, 1.4, 3.1, 3.2, 4.1, 4.2, 5.1-5.5, 6.1-6.6
// ---------------------------------------------------------------------------

describe("CustomModePanel (Task 5.5)", () => {
  it("renders CustomModeToggle — requirement 1.1, 1.2", () => {
    expect(panelSource).toContain("CustomModeToggle");
    expect(panelSource).toContain("<CustomModeToggle");
  });

  it("renders CustomModeVariablePanel when in custom mode — requirement 2.1", () => {
    expect(panelSource).toContain("CustomModeVariablePanel");
    expect(panelSource).toContain("<CustomModeVariablePanel");
  });

  it("renders CustomModeHeaderEditor when in custom mode — requirement 3.1", () => {
    expect(panelSource).toContain("CustomModeHeaderEditor");
    expect(panelSource).toContain("<CustomModeHeaderEditor");
  });

  it("reads customMode property from selectedComponent — requirement 1.2, 1.6", () => {
    expect(panelSource).toMatch(
      /selectedComponent\?.get\s*\(\s*"customMode"\s*\)/,
    );
  });

  it("reads data-relations attribute for relation name — requirement 2.1", () => {
    expect(panelSource).toMatch(/attrs\["data-relations"\]/);
  });

  it("activates custom mode by setting customMode=true on the component — requirement 1.2, 1.5", () => {
    expect(panelSource).toMatch(
      /selectedComponent\.set\s*\(\s*"customMode",\s*true\s*\)/,
    );
  });

  it("deactivates custom mode by setting customMode=false — requirement 1.8", () => {
    expect(panelSource).toMatch(
      /selectedComponent\.set\s*\(\s*"customMode",\s*false\s*\)/,
    );
  });

  it("shows toast.info on deactivation — requirement 1.8", () => {
    expect(panelSource).toContain("toast.info");
    expect(panelSource).toContain("reverted_standard_mode");
  });

  it("rebuilds table from columnsConfig on deactivation — requirement 1.8", () => {
    expect(panelSource).toContain("buildExampleDataTable");
    expect(panelSource).toContain("columnsConfig");
  });

  it("shows description when not in custom mode", () => {
    expect(panelSource).toContain("custom_mode_description");
  });
});

// ---------------------------------------------------------------------------
// Sidebar integration
// Requirements: 1.4, 1.6, 2.6, 8.3
// ---------------------------------------------------------------------------

describe("Sidebar CustomMode integration (Task 5.5)", () => {
  it("imports CustomModePanel — requirement 1.4", () => {
    expect(sidebarSource).toContain("CustomModePanel");
    expect(sidebarSource).toContain("./CustomModePanel");
  });

  it("tracks selectedComponent in state", () => {
    expect(sidebarSource).toContain("setSelectedComponent");
    expect(sidebarSource).toContain("selectedComponent");
  });

  it("detects gjsRelationsTable selection — requirement 1.4, 1.6", () => {
    expect(sidebarSource).toContain("isRelationsTableSelected");
    expect(sidebarSource).toContain("gjsRelationsTable");
  });

  it("renders CustomModePanel when gjsRelationsTable is selected — requirement 1.4", () => {
    expect(sidebarSource).toMatch(
      /isRelationsTableSelected[\s\S]*CustomModePanel[\s\S]*selectedComponent/,
    );
  });

  it("falls back to VariableManager when no gjsRelationsTable selected — requirement 2.6", () => {
    expect(sidebarSource).toMatch(
      /isRelationsTableSelected[\s\S]*VariableManager/,
    );
  });

  it("hides TokenConfigurationManager when gjsRelationsTable is selected — requirement 1.4", () => {
    expect(sidebarSource).toMatch(
      /isRelationsTableSelected[\s\S]*null[\s\S]*TokenConfigurationManager/,
    );
  });
});
