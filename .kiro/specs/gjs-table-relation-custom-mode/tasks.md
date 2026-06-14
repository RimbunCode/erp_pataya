# Implementation Plan: Custom Mode for gjsRelationsTable

## Overview

This plan implements Custom Mode for the `gjsRelationsTable` component in the Print Template Editor. The implementation follows a bottom-up approach: pure utility functions first, then the GrapesJS model extension, followed by React UI components, and finally integration wiring. Each step builds on the previous, ensuring no orphaned code.

## Tasks

- [x] 1. Implement core utility functions
  - [x] 1.1 Create `customModeUtils.js` with column filtering and header row management functions
    - Create `resources/js/Pages/Core/PrintTemplate/utils/customModeUtils.js`
    - Implement `filterRelationColumns(dataTableColumns, relationName)` — filters columns to include basic types and single-relation types, excluding many-relation (type `"relations"`) columns
    - Implement `canAddHeaderRow(currentRowCount)` — returns true if count < 5
    - Implement `canRemoveHeaderRow(currentRowCount)` — returns true if count > 1
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 3.3_

  - [x] 1.2 Write property test for column filtering (Property 1)
    - **Property 1: Column Filtering Correctness**
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4**
    - Create `resources/js/Pages/Core/PrintTemplate/utils/customModeUtils.property.test.js`
    - Generate random column arrays with mixed types (basic, relation, relations)
    - Assert: all basic columns included, all single-relation columns included, all many-relation columns excluded

  - [x] 1.3 Write property test for header row count invariant (Property 2)
    - **Property 2: Header Row Count Invariant**
    - **Validates: Requirements 3.1, 3.2, 3.3**
    - Add to `customModeUtils.property.test.js`
    - Generate random sequences of add/remove operations
    - Assert: row count always remains between 1 and 5 inclusive

  - [x] 1.4 Implement span validation and overlap detection functions
    - Add to `customModeUtils.js`
    - Implement `validateSpan(grid, rowIndex, colIndex, colspan, rowspan)` — validates bounds and overlap
    - Implement `detectOverlap(grid, rowIndex, colIndex, colspan, rowspan, excludeSelf)` — checks if spanned cells conflict with occupied cells
    - _Requirements: 3.4, 3.5, 3.6_

  - [x] 1.5 Write property test for span validation (Property 3)
    - **Property 3: Span Validation and Overlap Detection**
    - **Validates: Requirements 3.4, 3.5, 3.6**
    - Add to `customModeUtils.property.test.js`
    - Generate random grid configurations with various span values
    - Assert: valid spans are within bounds AND do not overlap; invalid spans are rejected

  - [x] 1.6 Implement body section validation functions
    - Add to `customModeUtils.js`
    - Implement `isValidBodyDropTarget(component)` — returns true only for direct `<td>` cells in body
    - Implement `canAddBodyRow(currentRowCount)` — always returns false (body limited to 1 row)
    - Implement `canApplyBodySpan(colspan, rowspan)` — always returns false (no grouping in body)
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

  - [x] 1.7 Write property test for body section invariant (Property 4)
    - **Property 4: Body Section Structural Invariant**
    - **Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5**
    - Add to `customModeUtils.property.test.js`
    - Generate random body operation attempts (add row, apply span, delete row)
    - Assert: body always has exactly 1 row, no colspan/rowspan > 1 permitted

  - [x] 1.8 Write property test for drop target validation (Property 5)
    - **Property 5: Drop Target Validation**
    - **Validates: Requirements 4.5, 6.2**
    - Add to `customModeUtils.property.test.js`
    - Generate random component type mocks (th, td, table, div, nested subgrid)
    - Assert: only direct `<th>` or `<td>` cells within header/body accept drops

- [x] 2. Implement serialization utilities
  - [x] 2.1 Implement `serializeCustomModeHeader` and `serializeCustomModeBody` functions
    - Add to `customModeUtils.js`
    - `serializeCustomModeHeader(theadComponent, relationName)` — serializes header rows with `{{label "doc.<relation>.<col>"}}` tokens, preserves colspan/rowspan, inline styles, and static HTML
    - `serializeCustomModeBody(tbodyComponent, relationName)` — wraps body row with `{{#each doc.<relation>}}` / `{{/each}}`, renders tokens as `{{this.<col>}}` or `{{relation this.<col>}}`
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7_

  - [x] 2.2 Write property test for serialization structure (Property 6)
    - **Property 6: Custom Mode toHTML Serialization Structure**
    - **Validates: Requirements 7.1, 7.2, 7.3, 7.6**
    - Create `resources/js/lib/gjsRelationsTable.customMode.property.test.js`
    - Generate random table configurations with N header rows and M body columns
    - Assert: correct number of `<tr>` in thead, colspan/rowspan preserved, correct token syntax for header and body

  - [x] 2.3 Write property test for content serialization fidelity (Property 7)
    - **Property 7: Custom Mode Content Serialization Fidelity**
    - **Validates: Requirements 7.4, 7.5, 7.7**
    - Add to `gjsRelationsTable.customMode.property.test.js`
    - Generate random cell contents (tokens, static HTML, CSS styles)
    - Assert: static HTML verbatim, CSS as inline style attributes, DOM order preserved

- [x] 3. Checkpoint - Ensure all utility tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Extend gjsRelationsTable plugin with Custom Mode support
  - [x] 4.1 Add `customMode` property and `toCustomModeHTML()` method to gjsRelationsTable model
    - Modify `resources/js/lib/gjsRelationsTable.js`
    - Add `customMode: false` to component defaults
    - Override `toHTML()` to branch on `customMode` flag
    - Implement `toCustomModeHTML()` using `serializeCustomModeHeader` and `serializeCustomModeBody` from customModeUtils
    - Add `data-custom-mode="true"` attribute to serialized output when in Custom Mode
    - _Requirements: 1.5, 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 8.1_

  - [x] 4.2 Write property test for persistence round-trip (Property 8)
    - **Property 8: Custom Mode Persistence Round-Trip**
    - **Validates: Requirements 1.5, 8.1, 8.2**
    - Add to `gjsRelationsTable.customMode.property.test.js`
    - Generate random Custom Mode configurations (flag, header rows, body content, styles, tokens)
    - Assert: serialize to project data and deserialize back produces equivalent component tree

  - [x] 4.3 Write unit tests for gjsRelationsTable Custom Mode toHTML
    - Add to `gjsRelationsTable.customMode.property.test.js` or create a separate unit test file
    - Test standard mode still works unchanged
    - Test Custom Mode serialization with single header row
    - Test Custom Mode serialization with multi-row headers and colspan/rowspan
    - Test body wrapping with `{{#each}}` / `{{/each}}`
    - Test relation column tokens use `{{relation this.<col>}}` syntax
    - _Requirements: 7.1, 7.2, 7.3, 7.6_

- [x] 5. Implement Custom Mode React components
  - [x] 5.1 Create `CustomModeToggle.jsx` component
    - Create `resources/js/Pages/Core/PrintTemplate/Components/CustomModeToggle.jsx`
    - Render toggle button showing current mode state
    - Show confirmation alert modal on activation (warns about disabling column management)
    - Show deactivation alert modal (warns about discarding custom layout)
    - Call `onModeChange` callback after user confirms
    - On deactivation confirm: remove Custom Mode property, regenerate table from columnsConfig
    - _Requirements: 1.1, 1.2, 1.3, 1.7, 1.8_

  - [x] 5.2 Create `CustomModeVariablePanel.jsx` component
    - Create `resources/js/Pages/Core/PrintTemplate/Components/CustomModeVariablePanel.jsx`
    - Use `filterRelationColumns` to scope VariableItem list to bound relation
    - Render VariableItem components for each filtered column
    - Support expandable single-relation items with lazy-loading of nested columns
    - Display empty-state message when no displayable columns exist
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.7_

  - [x] 5.3 Create `CustomModeHeaderEditor.jsx` component
    - Create `resources/js/Pages/Core/PrintTemplate/Components/CustomModeHeaderEditor.jsx`
    - Display current header row count with add/remove buttons
    - Enforce 1–5 row limits using `canAddHeaderRow` / `canRemoveHeaderRow`
    - Provide colspan/rowspan input fields for selected header cells
    - Validate span configurations using `validateSpan` and show error messages
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

  - [x] 5.4 Create `CustomModePanel.jsx` container component
    - Create `resources/js/Pages/Core/PrintTemplate/Components/CustomModePanel.jsx`
    - Coordinate CustomModeToggle, CustomModeVariablePanel, and CustomModeHeaderEditor
    - Manage header row add/remove operations on the GrapesJS component tree
    - Handle variable insertion via drag-and-drop and click (handleInsert)
    - Enforce body section constraints (single row, no colspan/rowspan)
    - Show toast error messages for invalid operations
    - _Requirements: 1.2, 1.4, 3.1, 3.2, 4.1, 4.2, 5.1, 5.2, 5.3, 5.4, 5.5, 6.1, 6.3, 6.4, 6.5, 6.6_

  - [x] 5.5 Write unit tests for Custom Mode React components
    - Test CustomModeToggle: modal display, confirm/cancel behavior, mode toggling
    - Test CustomModeVariablePanel: correct filtering, empty state, expandable items
    - Test CustomModeHeaderEditor: row add/remove limits, span validation errors
    - Test CustomModePanel: panel coordination, toast messages on invalid operations
    - _Requirements: 1.1, 1.3, 2.7, 3.3, 5.2, 5.4_

- [x] 6. Integrate Custom Mode into Sidebar and Editor
  - [x] 6.1 Modify `Sidebar.jsx` to conditionally render CustomModePanel
    - Modify `resources/js/Pages/Core/PrintTemplate/Components/Sidebar.jsx`
    - Detect when selected component is a Custom Mode gjsRelationsTable
    - Render CustomModePanel instead of VariableManager and TokenConfigurationManager column panel
    - Revert to default panels when non-Custom-Mode component is selected
    - _Requirements: 1.4, 1.6, 2.6, 8.3_

  - [x] 6.2 Implement drop target validation for Custom Mode tables
    - Modify drag-and-drop handling in the editor to validate drop targets using `isValidBodyDropTarget`
    - Reject drops on invalid targets (nested subgrid, table itself, non-cell elements)
    - Show toast error on invalid drop and remove the dropped component
    - _Requirements: 4.5, 6.1, 6.2_

  - [x] 6.3 Implement handleInsert integration for Custom Mode body cells
    - Ensure handleInsert respects Custom Mode context
    - When text component is in edit mode: insert token inline at cursor position
    - When text component is selected (not editing): append token as span child
    - _Requirements: 6.3, 6.4_

  - [x] 6.4 Write unit tests for Sidebar integration and drop validation
    - Test correct panel displayed based on selection state
    - Test panel revert on deselection
    - Test drop rejection on invalid targets with toast notification
    - Test handleInsert behavior in edit mode vs selection mode
    - _Requirements: 1.4, 2.6, 4.5, 6.2_

- [x] 7. Implement persistence and load behavior
  - [x] 7.1 Ensure Custom Mode flag and layout persist on save/load
    - Verify `customMode` property is included in GrapesJS project data serialization
    - On load: restore Custom Mode flag and custom layout child components
    - On load with Custom Mode active: suppress column management panel, show Custom Mode panel
    - Implement fallback for corrupted/missing layout data (empty table with flag preserved, error toast)
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

  - [x] 7.2 Write integration tests for save/load cycle
    - Test template save with Custom Mode table persists all data
    - Test template load restores Custom Mode state correctly
    - Test fallback behavior for corrupted layout data
    - _Requirements: 8.1, 8.2, 8.4_

- [x] 8. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific UI interactions and edge cases
- The project uses Vitest with fast-check for property-based testing
- All React components use existing patterns from sibling files in the Components directory
- Toast notifications use the existing `sonner` integration
- Translations use `useLaravelReactI18n` consistent with existing components

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.3", "1.4", "1.6"] },
    { "id": 2, "tasks": ["1.5", "1.7", "1.8", "2.1"] },
    { "id": 3, "tasks": ["2.2", "2.3"] },
    { "id": 4, "tasks": ["4.1"] },
    { "id": 5, "tasks": ["4.2", "4.3", "5.1", "5.2", "5.3"] },
    { "id": 6, "tasks": ["5.4"] },
    { "id": 7, "tasks": ["5.5", "6.1", "6.2", "6.3"] },
    { "id": 8, "tasks": ["6.4", "7.1"] },
    { "id": 9, "tasks": ["7.2"] }
  ]
}
```
