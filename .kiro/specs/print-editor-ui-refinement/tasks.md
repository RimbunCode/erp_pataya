# Implementation Plan: Print Editor UI Refinement

## Overview

This plan implements 16 UI/UX refinements to the GrapeJS-based Print Template Editor. All changes are frontend-only (React/TypeScript components within the Inertia.js application). The implementation is organized to build foundational components first, then integrate them into the existing editor architecture, and finally wire everything together.

## Tasks

- [x] 1. Install dependencies and set up Monaco Editor
  - [x] 1.1 Install @monaco-editor/react package
    - Run `npm install @monaco-editor/react`
    - Verify the package installs correctly and is compatible with React 19
    - _Requirements: 4.1, 13.1_

- [x] 2. Implement Monaco Editor wrapper components
  - [x] 2.1 Create MonacoHTMLEditor component
    - Create `resources/js/Pages/Core/PrintTemplate/Components/MonacoHTMLEditor.jsx`
    - Configure HTML language mode with syntax highlighting
    - Enable line numbers and code folding
    - Enable basic HTML tag/attribute autocomplete
    - Disable minimap for compact view
    - Accept `value`, `onChange`, `height`, `readOnly` props
    - _Requirements: 4.1, 4.2, 4.3, 4.5_

  - [x] 2.2 Create MonacoCSSEditor component
    - Create `resources/js/Pages/Core/PrintTemplate/Components/MonacoCSSEditor.jsx`
    - Configure CSS language mode with syntax highlighting
    - Enable CSS property/value autocomplete
    - Implement `onValidationChange` callback for exposing validation state
    - Add debounced (500ms) onChange that only fires for valid CSS
    - Track `componentId` to preserve CSS when switching components
    - Display inline error indicators via Monaco markers for invalid syntax
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6_

- [x] 3. Implement SaveStatusBadge component
  - [x] 3.1 Create SaveStatusBadge component
    - Create `resources/js/Pages/Core/PrintTemplate/Components/SaveStatusBadge.jsx`
    - Implement state machine: idle → dirty → saving → saved → error
    - Listen to editor events: `update`, `template:save-start`, `template:save-finish`, `template:save-error`, `storage:end:store`
    - Display "Not Saved" badge (amber) when dirty
    - Display "Saving..." badge with spinner (blue) when saving
    - Display "Saved" badge with relative time (green) when saved
    - Display "Save Error" badge (red) on error
    - Show toast notifications on save success and error
    - _Requirements: 14.1, 14.2, 14.3, 14.5, 14.6, 14.7_

  - [x] 3.2 Integrate SaveStatusBadge into TopBar
    - Modify `resources/js/Pages/Core/PrintTemplate/Components/TopBar.jsx`
    - Render SaveStatusBadge after the command buttons (save, undo, redo)
    - _Requirements: 14.4_

- [x] 4. Checkpoint - Verify base components
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Implement Token Configuration tab
  - [x] 5.1 Create TokenConfigurationManager component
    - Create `resources/js/Pages/Core/PrintTemplate/Components/TokenConfigurationManager.jsx`
    - Extract token configuration logic from existing VariableManager
    - Display "Konfigurasi Token" section with selected component token details and editing form
    - Implement unified "Token di Canvas" accordion listing both variable tokens and relation table tokens
    - Listen to `component:selected`, `component:deselected`, `component:update`, `component:add`, `component:remove` events
    - When a token item is clicked, call `editor.select(config.component)` to select and scroll to the canvas node
    - Implement nested select dropdowns for Label Key, Handlebar Token, and Relation Path fields (populated from `dataTableColumns`)
    - Include column management controls (show/hide, ordering) for relation table tokens
    - _Requirements: 1.2, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 1.10_

  - [x] 5.2 Simplify VariableManager component
    - Modify `resources/js/Pages/Core/PrintTemplate/Components/VariableManager.jsx`
    - Remove "Konfigurasi Token" section entirely
    - Remove "Token di Canvas" listing
    - Remove "Token Tabel Relasi" listing
    - Keep only: heading + variable list (draggable items)
    - Result: clean, focused variable panel for drag & drop and click-to-insert
    - _Requirements: 1.3_

  - [x] 5.3 Add Token Configuration tab to Sidebar
    - Modify `resources/js/Pages/Core/PrintTemplate/Components/Sidebar.jsx`
    - Add new "Token" tab with appropriate icon (KeyRound or similar)
    - Render TokenConfigurationManager in the new tab
    - Tab order: Style, Layer, Blocks, Variables, Token, Inspector
    - _Requirements: 1.1_

- [x] 6. Implement Style tab enhancements
  - [x] 6.1 Simplify CustomStyleManager - filter irrelevant properties
    - Modify `resources/js/Pages/Core/PrintTemplate/Components/CustomStyleManager.jsx`
    - Filter out: Font Family, Text Shadow, Box Shadow, Transition, Transform properties
    - Retain all other relevant print template properties (font size, color, margin, padding, border, alignment, etc.)
    - Improve property labels and grouping (typography, spacing, borders, layout)
    - Add visual indicator (dot/highlight) for properties with non-default values
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 7.1, 7.2, 7.3, 7.4_

  - [x] 6.2 Create GridLayoutControls component
    - Create `resources/js/Pages/Core/PrintTemplate/Components/GridLayoutControls.jsx`
    - Add column button (appends new column to `grid-template-columns`)
    - Remove column button per column
    - Width/size input per column (e.g., `1fr`, `max-content`, `200px`)
    - Layout properties: `justify-content`, `align-content`, `justify-items`, `align-items`, `column-gap`, `row-gap`
    - Update component CSS in real-time
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 12.1, 12.3, 12.4_

  - [x] 6.3 Create FlexLayoutControls component
    - Create `resources/js/Pages/Core/PrintTemplate/Components/FlexLayoutControls.jsx`
    - Layout properties: `justify-content`, `align-content`, `align-items`, `gap` (row-gap, column-gap)
    - Select dropdowns for alignment values (flex-start, center, flex-end, space-between, space-around, stretch)
    - Number input with unit selector for gap values
    - _Requirements: 12.2, 12.3, 12.4_

  - [x] 6.4 Integrate layout controls and Monaco CSS into Style tab
    - Modify `resources/js/Pages/Core/PrintTemplate/Components/CustomStyleManager.jsx`
    - Add dedicated "Layout" section at the top when grid/flex component is selected
    - Render GridLayoutControls or FlexLayoutControls based on component display type
    - Render MonacoCSSEditor at the bottom of the Style tab
    - Apply valid CSS from Monaco editor to selected component (debounced)
    - _Requirements: 12.5, 13.5_

  - [x] 6.5 Implement conditional Style tab hiding for Static HTML
    - Modify `resources/js/Pages/Core/PrintTemplate/Components/Sidebar.jsx`
    - Hide Style tab when a `staticHTML` component is selected
    - If Style tab is active and staticHTML is selected, auto-switch to Variables tab
    - Show Style tab normally when non-staticHTML or no node is selected
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

- [x] 7. Checkpoint - Verify sidebar and style enhancements
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Implement canvas enhancements
  - [x] 8.1 Add Bootstrap CSS injection to canvas and preview
    - Modify `resources/js/Pages/Core/PrintTemplate/Editor.jsx`
    - In the `onEditor` callback after editor loads, inject Bootstrap CSS link into the canvas iframe `<head>`
    - Use CDN: `https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css`
    - Ensure Bootstrap is scoped to canvas iframe only (never in main app frame)
    - Modify `resources/js/Pages/Core/PrintTemplate/Components/PreviewModal.jsx` to also load Bootstrap CSS in preview
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [x] 8.2 Add editor-only node spacing styles to canvas
    - Modify `resources/js/Pages/Core/PrintTemplate/Editor.jsx`
    - Inject spacing styles into canvas iframe: padding, margin, min-height on `[data-gjs-type]` elements
    - Add hover outline effect for better component identification
    - Ensure these styles are NEVER included in `toHTML()` or `getCss()` output
    - _Requirements: 9.1, 9.2, 9.3, 9.4_

  - [x] 8.3 Implement token display simplification in canvas
    - Modify `resources/js/Pages/Core/PrintTemplate/Editor.jsx` (or component type definitions)
    - Override canvas rendering of variable components to show simplified tokens
    - Strip `{{label "..."}}` → show translated label text
    - Strip `{{doc.xxx}}` → show `{{xxx}}` (remove "doc." prefix)
    - Strip `{{doc.customer.name}}` → show `{{customer.name}}`
    - Ensure `toHTML()` still outputs correct Handlebar syntax
    - Apply same simplification to relation table headers
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

  - [x] 8.4 Implement variable value component wrapper
    - Modify variable component creation logic in Editor.jsx
    - Wrap the value portion of variable nodes in a non-editable component wrapper
    - Set `editable: false` and `contenteditable: "false"` on the wrapper
    - Keep the `<p>` tag label text editable with GrapeJS text editing tool
    - Ensure correct Handlebar syntax is preserved in `toHTML()` output
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6_

- [x] 9. Implement preview dimension fixes
  - [x] 9.1 Fix PreviewModal dimensions to match paper size
    - Modify `resources/js/Pages/Core/PrintTemplate/Components/PreviewModal.jsx`
    - Set preview width from `printTemplate.width` + `printTemplate.unit`
    - Set preview height from `printTemplate.height` + `printTemplate.unit`
    - Apply CSS `transform: scale()` to fit within viewport without horizontal scrolling
    - For `is_letter_head` templates: use A4 width (210mm), dynamic height (fit content)
    - Apply configured unit (mm, cm, in) from print template settings
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

- [x] 10. Implement Static HTML Monaco Editor integration
  - [x] 10.1 Replace textarea with MonacoHTMLEditor in StaticHTMLComponent
    - Modify `resources/js/Pages/Core/PrintTemplate/Components/StaticHTMLComponent.jsx`
    - Replace `<textarea>` with `<MonacoHTMLEditor>` component
    - Maintain same save/cancel workflow
    - Keep sanitization preview panel alongside Monaco editor
    - _Requirements: 4.1, 4.4_

- [x] 11. Implement Variable Item UX improvements
  - [x] 11.1 Separate action and collapsible trigger in VariableItem
    - Modify `resources/js/Pages/Core/PrintTemplate/Components/VariableItem.jsx`
    - For items with nested children: render two distinct interactive areas
    - Left area: chevron icon button that toggles collapse (does NOT insert)
    - Right area: variable name/label that triggers insert/drag action
    - Clicking variable name inserts without expanding/collapsing children
    - Clicking chevron toggles children visibility without inserting
    - _Requirements: 16.1, 16.2, 16.3, 16.4, 16.5_

  - [x] 11.2 Implement inline variable insertion in text components
    - Modify `resources/js/Pages/Core/PrintTemplate/Components/VariableItem.jsx`
    - When a text component is in RTE (Rich Text Editor) mode, clicking a variable item inserts an inline protected token at cursor position
    - Insert a non-editable span with `contenteditable="false"` and `data-variable-inline` attribute
    - Display using simplified token format (strip "doc." prefix)
    - Ensure inline variable appears in Token Configuration "Token di Canvas" list
    - Ensure correct Handlebar syntax in `toHTML()` output
    - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5, 15.6_

- [x] 12. Final checkpoint - Ensure all components work together
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- All changes are frontend-only — no backend/database modifications needed
- Bootstrap CSS is scoped to canvas iframe and preview modal only, never in the main app frame
- Editor-only spacing styles are excluded from `toHTML()` and `getCss()` output
- Token display simplification is visual-only in canvas; `toHTML()` preserves correct Handlebar syntax
- Monaco Editor provides syntax highlighting, autocomplete, and error indicators for both HTML and CSS editing
- The existing save/autosave mechanism is leveraged for save status tracking via editor events
- Property-based testing is not applicable for this UI-focused feature; use example-based unit tests and integration tests

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["2.1", "2.2", "3.1"] },
    { "id": 2, "tasks": ["3.2", "5.1", "5.2"] },
    { "id": 3, "tasks": ["5.3", "6.1", "6.2", "6.3"] },
    { "id": 4, "tasks": ["6.4", "6.5", "8.1", "8.2"] },
    { "id": 5, "tasks": ["8.3", "8.4", "9.1", "10.1"] },
    { "id": 6, "tasks": ["11.1", "11.2"] }
  ]
}
```
