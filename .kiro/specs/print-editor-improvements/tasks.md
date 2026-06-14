# Implementation Plan: Print Editor Improvements

## Overview

This plan implements a comprehensive set of improvements to the GrapesJS-based Print Template Editor. Tasks are organized to build foundational utilities first, then layer UI components, backend changes, and integration wiring. The stack is React 19 + Inertia.js v2 frontend with Laravel 12 backend.

## Tasks

- [x] 1. Backend: Controller and i18n setup
  - [x] 1.1 Add preferences and docInfo props to Controller print() method
    - Modify `app/Http/Controllers/Controller.php` `print()` method
    - Fetch all company preferences via `Preference::pluck('value', 'key')->toArray()` wrapped in try/catch
    - Build `docInfo` object with `name` field from the model's `keyBreadcrumb` or `name` attribute
    - Pass `preferences` and `docInfo` as props in `Inertia::render()`
    - _Requirements: 14.1, 14.2, 14.3_

  - [x] 1.2 Write PHPUnit feature tests for Controller print() preferences and docInfo
    - Test that `preferences` prop is present and contains correct key-value data
    - Test that `docInfo` prop contains document name
    - Test graceful handling when preferences fetch fails (returns empty array)
    - _Requirements: 14.1, 14.2, 14.3_

  - [x] 1.3 Add i18n translation keys for editor UI
    - Add editor translation keys to `lang/en/core/printTemplate.php`
    - Add editor translation keys to `lang/id/core/printTemplate.php`
    - Include all keys defined in design: tab labels, token config labels, class manager, etc.
    - _Requirements: 23.1, 23.2_

- [x] 2. Utility functions: Token formatting, tree building, and CSS parsing
  - [x] 2.1 Implement buildTreeOptions helper function
    - Create/update utility file for token configuration helpers
    - Build tree-structured options from flat `dataTableColumns` with `label`, `value`, `children` properties
    - Preserve parent-child hierarchy and nesting depth
    - _Requirements: 6.1, 6.2, 6.3, 6.5_

  - [x] 2.2 Write property test for buildTreeOptions (Property 2)
    - **Property 2: Tree structure building preserves parent-child hierarchy**
    - **Validates: Requirements 6.5**

  - [x] 2.3 Implement filterTokenOptions helper function
    - Filter options to show only "data", "preferences", and "relation" (singular) types
    - Exclude all "relations" (many) nodes and their descendant children
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

  - [x] 2.4 Write property test for filterTokenOptions (Property 4)
    - **Property 4: Token option filtering excludes relations and their children**
    - **Validates: Requirements 8.1, 8.2, 8.3, 8.4**

  - [x] 2.5 Implement filterRelationPathOptions helper function
    - Mark "relations" nodes as selectable (disabled=false)
    - Mark "relation" nodes as disabled (non-selectable parents for navigation)
    - Prune "relation" nodes that have no "relations" descendants
    - Construct full dot-notation path for nested selections
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

  - [x] 2.6 Write property tests for filterRelationPathOptions (Properties 7, 8, 9)
    - **Property 7: RelationPath option filtering**
    - **Property 8: Relation node pruning hides nodes without relations descendants**
    - **Property 9: Nested relation full path construction**
    - **Validates: Requirements 10.1, 10.2, 10.4, 10.5**

  - [x] 2.7 Implement token label formatting and generation functions
    - Format token labels as `{{field_name}}` without path prefixes
    - Generate `{{relation doc.<name>}}` format for singular relation tokens, auto-prepending "doc." if missing
    - Implement token display simplification: strip `relation doc.`, `docInfo.`, `doc.` prefixes for canvas preview
    - _Requirements: 7.1, 7.2, 7.3, 9.1, 9.4, 12.1, 12.3, 15.5_

  - [x] 2.8 Write property tests for token formatting (Properties 3, 5, 6, 10)
    - **Property 3: Token label formatting**
    - **Property 5: Relation token generation with path normalization**
    - **Property 6: Token display simplification**
    - **Property 10: DocInfo token generation**
    - **Validates: Requirements 7.1, 7.2, 7.3, 9.1, 9.4, 9.3, 12.1, 12.3, 15.4, 15.5**

  - [x] 2.9 Implement getColumnLabel with locale-aware fallback chain
    - Accept optional locale parameter
    - Resolve `titleTrans` with correct language, fallback to `title`, then `name`
    - Never return undefined/empty when at least one field is present
    - _Requirements: 3.1, 3.3_

  - [x] 2.10 Write property test for getColumnLabel (Property 1)
    - **Property 1: Column label resolution follows fallback chain**
    - **Validates: Requirements 3.1, 3.3**

  - [x] 2.11 Implement CSS declaration parsing and merging utilities
    - Parse semicolon-separated `property: value;` declarations
    - Validate CSS syntax (detect missing colons, missing values)
    - Merge manual CSS with visual panel styles (manual takes precedence for overlapping properties)
    - Handle cleanup: removing manual CSS preserves visual panel styles
    - Handle body node CSS: prevent double-wrapping in `body{}`
    - _Requirements: 21.1, 21.2, 21.3, 21.4, 21.5, 22.2, 22.3_

  - [x] 2.12 Write property tests for CSS utilities (Properties 13, 14, 15, 16, 17)
    - **Property 13: CSS declaration parsing round-trip**
    - **Property 14: Invalid CSS declaration detection**
    - **Property 15: Style merging with manual CSS precedence**
    - **Property 16: Manual CSS cleanup preserves visual panel styles**
    - **Property 17: Body node CSS prevents double-wrapping**
    - **Validates: Requirements 21.1, 21.2, 21.3, 21.4, 21.5, 22.2, 22.3**

- [x] 3. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. StaticHTMLComponent: Bug fix and modal resize
  - [x] 4.1 Fix slash command propagation in CustomHTML Editor
    - Add `event.stopPropagation()` on keydown for "/" key within the Monaco editor container
    - Ensure "/" character is inserted normally into editor content
    - _Requirements: 1.1, 1.2_

  - [x] 4.2 Resize CustomHTML Editor modal
    - Set modal max-width to `--breakpoint-xl` (Tailwind `max-w-xl`)
    - Set minimum height of 400px for code editor and preview areas
    - Constrain modal max-height to `92svh`
    - _Requirements: 2.1, 2.2, 2.3_

- [x] 5. VariableManager and VariableItem updates
  - [x] 5.1 Add docInfo group to VariableManager
    - Add "docInfo" group to variable list sourced from `usePage().props.docInfo`
    - Display docInfo items as draggable variables generating `{{docInfo.<field>}}` tokens
    - Show docInfo group on all printTemplate types (letter_head and document)
    - Use `t()` from `useLaravelReactI18n` for group label
    - _Requirements: 15.1, 15.2, 15.3, 15.4_

  - [x] 5.2 Hide nested columns for "relations" type in VariableItem
    - For items with `type === "relations"`: hide expand/collapse chevron and CollapsibleContent
    - Keep collapsible behavior for "relation", "data", and "preferences" types
    - Ensure "relations" items remain draggable to create relation tables
    - _Requirements: 13.1, 13.2, 13.3_

- [x] 6. TokenConfigurationManager refactor
  - [x] 6.1 Replace Select with NestedSelect for labelKey, token, and relationPath fields
    - Use `NestedSelect` component with tree-structured options from `buildTreeOptions`
    - Apply `filterTokenOptions` for token field
    - Apply `filterRelationPathOptions` for relationPath field
    - Format token labels using `formatTokenLabel` ({{field_name}} format)
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 7.1, 7.2, 7.3_

  - [x] 6.2 Implement token filtering and relation token generation
    - Exclude "relations" type and children from token dropdown
    - Show "relation" (singular) items with `{{relation doc.<name>}}` format generation
    - Display simplified `{{name}}` format on canvas preview
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 9.1, 9.3, 9.4_

  - [x] 6.3 Implement active-only relation table display
    - Show only the selected relation table's configuration in the Token panel
    - Display info message when no relation table is selected on canvas
    - Update panel when selection changes between relation tables
    - _Requirements: 5.1, 5.2, 5.3_

  - [x] 6.4 Move column configuration from Inspector to Token panel
    - Add column show/hide and reorder UI to the Token Tabel Relasi card
    - Display empty state when relation table has no configured columns
    - Handle case where all columns are hidden (render empty table)
    - _Requirements: 4.1, 4.3, 4.4, 4.5_

  - [x] 6.5 Implement relation token detection in Token di Canvas list
    - Detect `{{relation doc.<name>}}` format in component `data-token` attributes
    - Display detected relation tokens in the "Token di Canvas" list
    - Allow configuration form display and token update on "Terapkan Konfigurasi"
    - Handle unknown relation paths gracefully
    - _Requirements: 11.1, 11.2, 11.3, 11.4_

  - [x] 6.6 Implement token preview simplification on canvas
    - Display `{{relation doc.<name>}}` as `{{<name>}}` on canvas
    - Display `{{docInfo.<field>}}` as `{{<field>}}` on canvas
    - Preserve original token in `data-token` attribute for export
    - Handle nested paths (e.g., `{{relation doc.customer.address}}` → `{{customer.address}}`)
    - _Requirements: 12.1, 12.2, 12.3, 15.5_

- [x] 7. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. gjsRelationsTable plugin updates
  - [x] 8.1 Add Bootstrap classes to relation table component
    - Update component defaults to use `table table-bordered w-100` classes
    - Update `toHTML()` to output `<table class="table table-bordered w-100" ...>`
    - _Requirements: 19.1, 19.2, 19.3_

  - [x] 8.2 Write property test for relation table HTML export (Property 12)
    - **Property 12: Relation table HTML export includes Bootstrap classes**
    - **Validates: Requirements 19.3**

  - [x] 8.3 Implement locale-aware column headers
    - Accept `locale` parameter in `buildExampleDataTable` and `getColumnLabel`
    - Resolve `titleTrans` with active language from `printTemplate.default_language`
    - Update headers when language changes without page reload
    - _Requirements: 3.1, 3.2, 3.3_

- [x] 9. CustomStyleManager and CSSEditorModal
  - [x] 9.1 Hide background properties in StyleManager
    - Add `background-image`, `background-repeat`, `background-position`, `background-size`, `background-attachment` to `HIDDEN_PROPERTY_IDS`
    - Keep `background-color` visible
    - _Requirements: 16.1, 16.2_

  - [x] 9.2 Add CSS class management section
    - Display current classes as badges on selected component
    - Allow adding new classes via input field
    - Allow removing classes via badge delete button
    - Hide/disable when no component is selected
    - _Requirements: 18.1, 18.2, 18.3, 18.4_

  - [x] 9.3 Create CSSEditorModal component
    - Create new `CSSEditorModal.jsx` with Monaco editor
    - Show read-only CSS summary in Style tab with "Edit" button
    - Implement open/close behavior with draft persistence per component
    - Validate CSS syntax on save, show error indicators for invalid CSS
    - Discard changes on cancel/close without save
    - _Requirements: 20.1, 20.2, 20.3, 20.4, 20.5, 20.6_

  - [x] 9.4 Implement CSS declaration format parsing and application
    - Accept `property: value;` format without selectors/braces
    - Parse and apply CSS properties to selected component
    - Merge with visual panel styles (manual CSS takes precedence)
    - Handle cleanup when manual CSS is cleared
    - _Requirements: 21.1, 21.2, 21.4, 21.5_

  - [x] 9.5 Handle body node CSS editing
    - Allow full CSS with selectors when body node is selected
    - Prevent double-wrapping in `body{}`
    - Export clean CSS without nested body wrappers
    - _Requirements: 22.1, 22.2, 22.3_

- [x] 10. Editor.jsx: Block replacement and integration
  - [x] 10.1 Remove old column blocks and add multi-function container block
    - Remove `column1`, `column2`, `column3`, `column3-7` from blocks array
    - Register new "multiContainer" component type with configurable HTML tag trait
    - Add tag select trait with options: div, section, article, aside, header, footer, main, nav, span
    - Ensure tag change preserves child components
    - _Requirements: 17.1, 17.2, 17.3, 17.4, 17.5_

  - [x] 10.2 Write property test for tag change preserving children (Property 11)
    - **Property 11: Tag change preserves child components**
    - **Validates: Requirements 17.4**

  - [x] 10.3 Wire docInfo prop and integrate i18n across editor
    - Accept `docInfo` prop from backend and pass to template context
    - Replace all hardcoded UI strings with `t()` from `useLaravelReactI18n`
    - Ensure language change re-renders all UI text
    - _Requirements: 14.4, 15.3, 23.1, 23.2, 23.3, 23.4_

- [x] 11. Sidebar and Inspector cleanup
  - [x] 11.1 Remove RelationsInspector from Inspector tab
    - Remove `RelationsInspector` import and rendering from Sidebar Inspector tab
    - Keep `StaticHTMLInspector` in the Inspector tab
    - _Requirements: 4.2_

- [x] 12. Print preview cleanup
  - [x] 12.1 Hide Static HTML Wrapper editor styles in print and export
    - In print preview mode: hide `border: 2px dashed #6366f1` on `.gjs-static-html-wrapper`
    - In print preview mode: set `content: none` and `display: none` on `::before` pseudo-element
    - In HTML/CSS export: exclude editor-only wrapper styles
    - Preserve editor styles in normal canvas editing mode
    - _Requirements: 24.1, 24.2, 24.3, 24.4_

- [x] 13. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The frontend uses React 19 + Inertia.js v2 with GrapesJS; the backend is Laravel 12 with PHP 8.4
- All UI strings must use `useLaravelReactI18n` hook's `t()` function
- Use `fast-check` library for property-based tests

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.3", "2.1", "2.9", "2.11"] },
    { "id": 1, "tasks": ["1.2", "2.2", "2.3", "2.5", "2.7", "2.10"] },
    { "id": 2, "tasks": ["2.4", "2.6", "2.8", "2.12", "4.1", "4.2"] },
    { "id": 3, "tasks": ["5.1", "5.2", "8.1", "8.3", "9.1"] },
    { "id": 4, "tasks": ["6.1", "6.2", "6.3", "8.2", "9.2", "9.3"] },
    { "id": 5, "tasks": ["6.4", "6.5", "6.6", "9.4", "9.5"] },
    { "id": 6, "tasks": ["10.1", "10.3", "11.1"] },
    { "id": 7, "tasks": ["10.2", "12.1"] }
  ]
}
```
