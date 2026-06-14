# Implementation Plan: Print Template Refactoring

## Overview

Refactoring modul PrintTemplate untuk mengeliminasi duplikasi kode, memecah file besar menjadi modul-modul kecil yang maintainable, dan menambahkan komentar Bahasa Indonesia. Pendekatan implementasi bersifat bottom-up: mulai dari leaf modules (Level 0) tanpa dependensi internal, lalu naik ke level yang lebih tinggi. Setiap langkah memastikan tidak ada circular dependency dan semua existing tests tetap passing.

## Tasks

- [x] 1. Create leaf utility modules (Level 0 - no internal imports)
  - [x] 1.1 Create `utils/gridConstants.js` with grid/subgrid CSS constants
    - Create file `resources/js/Pages/Core/PrintTemplate/utils/gridConstants.js`
    - Export `GRID_CLASS`, `SUBGRID_CLASS`, `GRID_RULE_STYLE`, `SUBGRID_RULE_STYLE` with `Object.freeze()` on style objects
    - Add JSDoc header and inline comments in Bahasa Indonesia
    - _Requirements: 11.1, 7.1, 7.2_

  - [x] 1.2 Create `utils/editorHelpers.js` with pure helper functions
    - Create file `resources/js/Pages/Core/PrintTemplate/utils/editorHelpers.js`
    - Extract `clampSidebarWidth`, `resolveTemplateUnitCode`, `parseNumericValue`, `validateHandlebarTemplate` from `Editor.jsx`
    - Add JSDoc header and function-level comments in Bahasa Indonesia
    - _Requirements: 5.4, 7.1, 7.2, 7.3_

  - [x] 1.3 Export `escapeRegExp` from `utils/cssUtils.js` and remove duplicate from `utils/manualCssRuleUtils.js`
    - Verify `escapeRegExp` is already exported from `utils/cssUtils.js` (add export if not)
    - Remove local `escapeRegExp` definition from `utils/manualCssRuleUtils.js`
    - Add `import { escapeRegExp } from "./cssUtils"` to `manualCssRuleUtils.js`
    - Add/update Bahasa Indonesia comments
    - _Requirements: 4.1, 4.2, 4.3, 7.1_

  - [x] 1.4 Write property test for `escapeRegExp` round-trip safety
    - **Property 4: escapeRegExp round-trip safety**
    - Create/update `utils/cssUtils.property.test.js` with test verifying `new RegExp(escapeRegExp(input)).test(input) === true` for any string input
    - Use fast-check with minimum 100 iterations
    - **Validates: Requirements 4.4**

- [x] 2. Create Level 1 utility modules (imports from Level 0 only)
  - [x] 2.1 Export `normalizePropertyId` from `utils/styleManagerUtils.js` and update `CustomStyleManager.jsx`
    - Ensure `normalizePropertyId` is exported as named export from `utils/styleManagerUtils.js`
    - Remove local `normalizePropertyId` definition from `Components/CustomStyleManager.jsx`
    - Add `import { normalizePropertyId } from "../utils/styleManagerUtils"` to `CustomStyleManager.jsx`
    - Add/update Bahasa Indonesia comments
    - _Requirements: 3.1, 3.2, 3.3, 7.1_

  - [x] 2.2 Write property test for `normalizePropertyId` idempotence
    - **Property 3: normalizePropertyId idempotence and correctness**
    - Create/update `utils/styleManagerUtils.property.test.js` with test verifying idempotence: `normalizePropertyId(normalizePropertyId(x)) === normalizePropertyId(x)`
    - Verify output equals `String(input ?? "").trim().toLowerCase()`
    - Use fast-check with minimum 100 iterations
    - **Validates: Requirements 3.4**

  - [x] 2.3 Create `utils/variableEncodingUtils.js` with encoding/escaping functions
    - Create file `resources/js/Pages/Core/PrintTemplate/utils/variableEncodingUtils.js`
    - Extract `encodeTokenToBase64`, `escapeAttributeValue`, `simplifyInlineDisplayToken` from `Components/VariableItem.jsx`
    - Add JSDoc header and function-level comments in Bahasa Indonesia
    - _Requirements: 6.2, 7.1, 7.2, 7.3_

- [x] 3. Checkpoint - Verify Level 0-1 modules
  - Ensure all existing tests pass (`npm run test` or relevant test commands), ask the user if questions arise.

- [x] 4. Create Level 2 utility modules (imports from Level 0-1)
  - [x] 4.1 Create `utils/variableTokenUtils.js` with token formatting functions
    - Create file `resources/js/Pages/Core/PrintTemplate/utils/variableTokenUtils.js`
    - Extract `formatColumnValue`, `getFormattedHandlebarToken`, `isFormattableType`, `resolveExampleValue`, `getHandlebarToken`, `getDisplayLabel` from `Components/VariableItem.jsx`
    - Add JSDoc header and function-level comments in Bahasa Indonesia
    - _Requirements: 6.1, 7.1, 7.2, 7.3_

  - [x] 4.2 Create `utils/variableInsertUtils.js` with token building and insertion functions
    - Create file `resources/js/Pages/Core/PrintTemplate/utils/variableInsertUtils.js`
    - Extract `buildVariableToken`, `getSimplifiedTokenDisplay`, `buildVariableDragPayload`, `tryInsertInlineVariableToken` from `Editor.jsx` and `Components/VariableItem.jsx`
    - Consolidate duplicate `buildVariableToken` into single definition
    - Import dependencies from `variableEncodingUtils`, `tokenConfigHelpers`, `cssUtils` as needed
    - Add JSDoc header and function-level comments in Bahasa Indonesia
    - _Requirements: 1.1, 1.3, 2.1, 2.3, 6.3, 7.1, 7.2, 7.3_

  - [x] 4.3 Write property test for `buildVariableToken` output correctness
    - **Property 1: buildVariableToken output correctness**
    - Create `utils/variableInsertUtils.property.test.js` with test verifying token output rules for all variableType/parentType combinations
    - Use fast-check with minimum 100 iterations
    - **Validates: Requirements 1.1, 1.4**

  - [x] 4.4 Write property test for `getSimplifiedTokenDisplay` simplification correctness
    - **Property 2: getSimplifiedTokenDisplay simplification correctness**
    - Add test to `utils/variableInsertUtils.property.test.js` verifying simplification rules for empty tokens with `doc.` prefix and tokens with `formatCurrency`/`formatNumber`
    - Use fast-check with minimum 100 iterations
    - **Validates: Requirements 2.4, 2.5**

  - [x] 4.5 Create `utils/templateExportUtils.js` with template extraction functions
    - Create file `resources/js/Pages/Core/PrintTemplate/utils/templateExportUtils.js`
    - Extract `stripEditorOnlyWrapperStyles`, `getCurrentTemplateFromEditor` from `Editor.jsx`
    - Import from `templateFormatUtils` and `cssUtils` as needed
    - Add JSDoc header and function-level comments in Bahasa Indonesia
    - _Requirements: 5.3, 7.1, 7.2_

- [x] 5. Create Level 3 utility modules (imports from Level 0-2)
  - [x] 5.1 Create `utils/variableDropUtils.js` with drag-and-drop listener
    - Create file `resources/js/Pages/Core/PrintTemplate/utils/variableDropUtils.js`
    - Extract `variableDropListener` and its internal helpers from `Editor.jsx`
    - Import from `variableInsertUtils`, `gridConstants`, `tokenConfigHelpers`
    - Add JSDoc header and function-level comments in Bahasa Indonesia
    - _Requirements: 5.1, 7.1, 7.2, 7.3_

  - [x] 5.2 Create `utils/letterheadPreviewUtils.js` with letterhead preview function
    - Create file `resources/js/Pages/Core/PrintTemplate/utils/letterheadPreviewUtils.js`
    - Extract `mountLetterheadPreview` from `Editor.jsx`
    - Add JSDoc header and function-level comments in Bahasa Indonesia
    - _Requirements: 5.2, 7.1, 7.2_

- [x] 6. Checkpoint - Verify all utility modules
  - Ensure all existing tests pass, ask the user if questions arise.

- [x] 7. Refactor page components to use new utility modules
  - [x] 7.1 Refactor `Editor.jsx` to import from new utility modules
    - Remove all extracted function definitions from `Editor.jsx`
    - Add named imports from `editorHelpers`, `variableDropUtils`, `letterheadPreviewUtils`, `templateExportUtils`, `gridConstants`
    - Verify no circular dependencies exist
    - Update/add Bahasa Indonesia comments on hooks and complex handlers
    - _Requirements: 5.5, 5.6, 8.1, 8.2, 8.3, 8.4, 9.1, 9.3_

  - [x] 7.2 Refactor `Components/VariableItem.jsx` to import from new utility modules
    - Remove all extracted function definitions from `VariableItem.jsx`
    - Add named imports from `variableTokenUtils`, `variableEncodingUtils`, `variableInsertUtils`, `gridConstants`
    - Remove duplicate `buildVariableToken` and `getSimplifiedTokenDisplay` definitions
    - Remove duplicate `GRID_CLASS`, `SUBGRID_CLASS`, `GRID_RULE_STYLE`, `SUBGRID_RULE_STYLE` definitions
    - Add re-export of `buildVariableDragPayload` from `VariableItem.jsx` for backward compatibility
    - Update/add Bahasa Indonesia comments on component, hooks, and handlers
    - _Requirements: 1.2, 1.3, 2.2, 2.3, 6.4, 8.1, 8.2, 8.3, 8.4, 9.2, 9.4, 11.2, 11.3_

  - [x] 7.3 Update `Components/CustomStyleManager.jsx` with Bahasa Indonesia comments
    - Add/update JSDoc header and inline comments in Bahasa Indonesia
    - Verify `normalizePropertyId` import is working correctly (from task 2.1)
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

- [x] 8. Remove console.log statements and dead code
  - [x] 8.1 Remove all active `console.log` statements from PrintTemplate module
    - Search and remove `console.log` from all files in `Pages/Core/PrintTemplate/` and subdirectories
    - Preserve all `console.error` statements inside `catch` blocks
    - Remove commented-out `console.log` dead code blocks
    - _Requirements: 12.1, 12.2, 12.3_

- [x] 9. Verify backward compatibility and build
  - [x] 9.1 Ensure re-exports for external consumers
    - Verify `buildVariableDragPayload` is re-exported from `VariableItem.jsx`
    - Check for any other external consumers importing from refactored files
    - Add re-exports where needed to maintain public API
    - _Requirements: 10.1, 10.3_

  - [x] 9.2 Run build verification
    - Run `npm run build` and verify no errors
    - Verify no circular dependency warnings from Vite
    - _Requirements: 10.2, 5.6_

  - [x] 9.3 Write unit tests for `editorHelpers`
    - Create `utils/editorHelpers.test.js`
    - Test `clampSidebarWidth` bounds, `resolveTemplateUnitCode` defaults, `parseNumericValue` edge cases, `validateHandlebarTemplate` patterns
    - _Requirements: 5.4, 10.1_

  - [x] 9.4 Write unit tests for `variableTokenUtils`
    - Create `utils/variableTokenUtils.test.js`
    - Test `formatColumnValue` currency/number formatting, `getFormattedHandlebarToken` all variable types
    - _Requirements: 6.1, 10.1_

  - [x] 9.5 Write unit tests for `variableEncodingUtils`
    - Create `utils/variableEncodingUtils.test.js`
    - Test `encodeTokenToBase64`, `escapeAttributeValue` special characters, `simplifyInlineDisplayToken`
    - _Requirements: 6.2, 10.1_

  - [x] 9.6 Write unit tests for `templateExportUtils`
    - Create `utils/templateExportUtils.test.js`
    - Test `stripEditorOnlyWrapperStyles` regex patterns, `getCurrentTemplateFromEditor` fallback behavior
    - _Requirements: 5.3, 10.1_

  - [x] 9.7 Write unit test for `gridConstants`
    - Create `utils/gridConstants.test.js`
    - Verify constant values match expected values and objects are frozen
    - _Requirements: 11.1_

- [x] 10. Final checkpoint - Run all existing tests
  - Run all existing tests to verify no regressions: `Editor.gridCssFix.test.js`, `Editor.property.test.js`, `cssUtils.property.test.js`, `cssUtils.test.js`, `styleManagerUtils.property.test.js`, `styleManagerUtils.test.js`, `templateFormatUtils.test.js`, `canvasSelectionUtils.test.js`, `tokenConfigHelpers.property.test.js`, `CustomStyleManager.manualCss.test.js`
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- Implementation follows bottom-up dependency order (Level 0 → Level 3 → Page components)
- All new files use Bahasa Indonesia comments following the JSDoc format specified in the design
- Backward compatibility is maintained through re-exports where external consumers exist

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "1.3"] },
    { "id": 1, "tasks": ["1.4", "2.1", "2.3"] },
    { "id": 2, "tasks": ["2.2", "4.1", "4.5"] },
    { "id": 3, "tasks": ["4.2"] },
    { "id": 4, "tasks": ["4.3", "4.4", "5.1", "5.2"] },
    { "id": 5, "tasks": ["7.1", "7.2", "7.3"] },
    { "id": 6, "tasks": ["8.1"] },
    { "id": 7, "tasks": ["9.1", "9.2"] },
    { "id": 8, "tasks": ["9.3", "9.4", "9.5", "9.6", "9.7"] }
  ]
}
```
