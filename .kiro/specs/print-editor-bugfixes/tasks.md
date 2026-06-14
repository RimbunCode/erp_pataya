# Implementation Plan

## Overview

This task list implements fixes for 4 bugs in the GrapesJS-based Print Template Editor: drag-and-drop failure, missing CSS default template, incorrect CSS kebab-case normalization, and missing Ctrl+S shortcut in modals. The workflow follows the bug condition methodology: explore bugs first with failing tests, write preservation tests, implement fixes, then verify.

## Tasks

- [x] 1. Write bug condition exploration tests
  - **Property 1: Bug Condition** - Print Editor Drag/Drop, CSS Default, Kebab-Case, and Ctrl+S Bugs
  - **CRITICAL**: These tests MUST FAIL on unfixed code - failure confirms the bugs exist
  - **DO NOT attempt to fix the tests or the code when they fail**
  - **NOTE**: These tests encode the expected behavior - they will validate the fixes when they pass after implementation
  - **GOAL**: Surface counterexamples that demonstrate the bugs exist
  - **Scoped PBT Approach**: For CSS kebab-case bug, scope property to camelCase inputs (e.g., `backgroundColor`, `fontSize`). For CSS default template, scope to empty CSS with selected component. For Ctrl+S, scope to keydown events with ctrlKey/metaKey + "s" inside modals.
  - Test `parseCssDeclarations("backgroundColor: red;")` — expect `{ "background-color": "red" }` but unfixed code returns `{ "backgroundcolor": "red" }` (Bug Condition: `isBugCondition_CSSFormat`)
  - Test `parseCssDeclarations("fontSize: 14px; marginTop: 10px;")` — expect kebab-case keys but unfixed code lowercases without hyphens
  - Test CSS default template: when `cssDraft=""` and `selectedComponent.getId()="i7k2"`, expect `#i7k2{ }` but unfixed code returns empty string (Bug Condition: `isBugCondition_CSSDefault`)
  - Test Ctrl+S in CSSEditorModal: simulate `{ctrlKey: true, key: "s"}` keydown — expect `handleSave` called and `preventDefault` invoked, but unfixed code does nothing (Bug Condition: `isBugCondition_CtrlS`)
  - Test Ctrl+S in StaticHTMLComponent: simulate `{ctrlKey: true, key: "s"}` keydown — expect `handleSave` called and `preventDefault` invoked, but unfixed code does nothing
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests FAIL (this is correct - it proves the bugs exist)
  - Document counterexamples found: `parseCssDeclarations("backgroundColor: red;")` → `{ "backgroundcolor": "red" }`, empty CSS modal, Ctrl+S not intercepted
  - Mark task complete when tests are written, run, and failures are documented
  - _Requirements: 1.1, 1.3, 1.4, 1.5, 1.6_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Existing CSS Parsing, Cached CSS Display, Click-to-Insert, and Cancel Behavior
  - **IMPORTANT**: Follow observation-first methodology
  - Observe: `parseCssDeclarations("font-size: 12px;")` returns `{ "font-size": "12px" }` on unfixed code (valid kebab-case preserved)
  - Observe: `parseCssDeclarations("background-color: red; margin-top: 10px;")` returns `{ "background-color": "red", "margin-top": "10px" }` on unfixed code
  - Observe: `parseCssDeclarations("color: blue;")` returns `{ "color": "blue" }` on unfixed code (single-word property preserved)
  - Observe: When `cssByComponentRef` has cached CSS for a component, modal shows that cached CSS (not default template)
  - Observe: Click on VariableItem inserts variable into selected component via click-to-insert mechanism
  - Observe: Global Ctrl+S outside modals triggers `core:save-template` command
  - Write property-based test: for all valid kebab-case CSS property names, `parseCssDeclarations` preserves them unchanged (Preservation: `NOT isBugCondition_CSSFormat`)
  - Write property-based test: for all CSS modal opens where existing CSS is cached, modal displays cached CSS (Preservation: `NOT isBugCondition_CSSDefault`)
  - Verify tests pass on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

- [x] 3. Fix for Drag and Drop from Block panel and VariableItem panel
  - [x] 3.1 Fix Block Drag Integration in CustomBlockManager.jsx
    - Remove native `draggable` attribute and React `onDragStart`/`onDragEnd` handlers from block items
    - Use `onMouseDown` to initiate GrapesJS's internal block drag via `dragStart(block, event)` from `BlocksProvider`
    - Use `onMouseUp` or document-level listener to call `dragStop(false)` when drag ends
    - Ensure GrapesJS sorter system controls the entire drag lifecycle
    - _Bug_Condition: isBugCondition_DragDrop(X) where X.source = BlockPanel AND X.target = Canvas_
    - _Expected_Behavior: result.componentInserted = true AND result.positionCorrect = true_
    - _Preservation: Click-to-insert on blocks must continue to work, mobile mode restrictions remain_
    - _Requirements: 2.1, 3.6_

  - [x] 3.2 Fix Variable Drag Integration in VariableItem.jsx
    - Replace sole reliance on native HTML5 `dataTransfer.setData()` with GrapesJS-compatible drag coordination
    - Use `onMouseDown` to start a GrapesJS-compatible drag operation or ensure `canvas:dragdata` event is properly triggered
    - Maintain the `variable/json` payload for the `canvas:dragdata` event listener to consume
    - Ensure click-to-insert behavior is NOT affected (distinguish click from drag via movement threshold)
    - _Bug_Condition: isBugCondition_DragDrop(X) where X.source = VariableItemPanel AND X.target = Canvas_
    - _Expected_Behavior: result.componentInserted = true AND result.positionCorrect = true_
    - _Preservation: Click on VariableItem must continue to insert variable via click-to-insert mechanism_
    - _Requirements: 2.2, 3.1_

- [x] 4. Fix for Manual CSS modal default template and kebab-case normalization
  - [x] 4.1 Provide Default CSS Template in CustomStyleManager.jsx
    - When opening CSS modal (`setCssModalOpen(true)`), compute `initialCSS` value
    - If `cssDraft` is empty and `selectedComponent` exists and `isBodyNode` is false, generate `#<componentId>{ }` as default
    - Pass computed value to `CSSEditorModal` as `initialCSS` instead of raw `cssDraft`
    - When `cssByComponentRef` has cached CSS, continue showing cached CSS (not default template)
    - _Bug_Condition: isBugCondition_CSSDefault(X) where X.selectedNode != null AND X.existingCSS = ""_
    - _Expected_Behavior: result.initialContent = "#" + X.selectedNode.id + "{ }"_
    - _Preservation: Existing cached CSS display must remain unchanged_
    - _Requirements: 2.3, 3.3_

  - [x] 4.2 Add camelCase to Kebab-Case Conversion in cssUtils.js
    - Add `toKebabCase(property)` helper: `property.replace(/[A-Z]/g, m => '-' + m.toLowerCase())`
    - Modify `parseCssDeclarations()` to apply `toKebabCase()` before `.toLowerCase()` on property names
    - Export `toKebabCase` for use in tests
    - Ensure already-valid kebab-case properties pass through unchanged
    - _Bug_Condition: isBugCondition_CSSFormat(X) where X.contains(uppercase) OR X.format = camelCase_
    - _Expected_Behavior: result = toKebabCase(X) AND NOT result.contains(uppercase)_
    - _Preservation: Valid kebab-case properties like "font-size", "background-color" must be unchanged_
    - _Requirements: 2.4, 3.4_

- [x] 5. Fix for Ctrl+S keyboard shortcut in modals
  - [x] 5.1 Add Ctrl+S Shortcut to CSSEditorModal.jsx
    - Add `onKeyDown` handler on the `DialogContent` wrapper (or existing `div` wrapping `MonacoCSSEditor`)
    - Intercept `(e.ctrlKey || e.metaKey) && e.key === 's'`
    - Call `e.preventDefault()` and `e.stopPropagation()` to prevent browser default
    - Invoke `handleSave()` to save and close the modal
    - Ensure `/` key prevention for Monaco editor still works
    - _Bug_Condition: isBugCondition_CtrlS(X) where X.context = CSSEditorModal_
    - _Expected_Behavior: result.saved = true AND result.modalClosed = true AND X.defaultPrevented = true_
    - _Preservation: "/" key prevention must continue to stop GrapesJS command palette propagation_
    - _Requirements: 2.5, 3.7_

  - [x] 5.2 Add Ctrl+S Shortcut to StaticHTMLComponent.jsx
    - Add `onKeyDown` handler on the `DialogContent` wrapper
    - Intercept `(e.ctrlKey || e.metaKey) && e.key === 's'`
    - Call `e.preventDefault()` and `e.stopPropagation()` to prevent browser default
    - Invoke `handleSave()` to save and close the modal
    - Ensure `/` key prevention for Monaco editor still works
    - _Bug_Condition: isBugCondition_CtrlS(X) where X.context = StaticHTMLModal_
    - _Expected_Behavior: result.saved = true AND result.modalClosed = true AND X.defaultPrevented = true_
    - _Preservation: "/" key prevention must continue to stop GrapesJS command palette propagation_
    - _Requirements: 2.6, 3.7_

  - [x] 5.3 Verify bug condition exploration tests now pass
    - **Property 1: Expected Behavior** - All Bug Conditions Resolved
    - **IMPORTANT**: Re-run the SAME tests from task 1 - do NOT write new tests
    - The tests from task 1 encode the expected behavior for CSS kebab-case, CSS default template, and Ctrl+S
    - When these tests pass, it confirms the expected behavior is satisfied
    - Run bug condition exploration tests from step 1
    - **EXPECTED OUTCOME**: Tests PASS (confirms bugs are fixed)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

  - [x] 5.4 Verify preservation tests still pass
    - **Property 2: Preservation** - No Regressions in Existing Behavior
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run preservation property tests from step 2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm all tests still pass after fix (no regressions)
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

- [x] 6. Checkpoint - Ensure all tests pass
  - Run full test suite to verify all bug condition tests pass and all preservation tests pass
  - Verify no regressions in existing functionality
  - Ensure all 4 bugs are resolved: drag-and-drop works, CSS default template shows, kebab-case normalization works, Ctrl+S saves in modals
  - Ask the user if questions arise

## Task Dependency Graph

```json
{
  "waves": [["1"], ["2"], ["3", "4", "5"], ["6"]]
}
```

Tasks must be executed in order: exploration tests (1) before preservation tests (2), both before implementation (3, 4, 5 in parallel), and checkpoint (6) last.

## Notes

- Bug condition exploration tests (task 1) are expected to FAIL on unfixed code — this confirms the bugs exist
- Preservation tests (task 2) are expected to PASS on unfixed code — this captures baseline behavior
- After implementation (tasks 3-5), exploration tests should PASS and preservation tests should still PASS
- The CSS kebab-case fix is the most testable with property-based testing due to its pure function nature
- Drag-and-drop fixes require integration testing with GrapesJS editor instance
