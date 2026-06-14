# Implementation Plan: Editor Label Resolution

## Overview

Enhance the GrapeJS Print Template Editor's label resolution during sync (editor load) by introducing `modelColumns` as the primary label source with a 3-step fallback chain: `resolveLabel` → `titleTrans` → `buildLabelMap`. Drop operations remain unchanged.

## Tasks

- [x] 1. Enhance resolveLabel and add resolveLabelWithMeta in variableTokenUtils.js
  - [x] 1.1 Add null-safety guards to existing `resolveLabel` function
    - Add early return for null/undefined `path` or `columns` parameters
    - Add null checks for `modelDoc` when path starts with "doc."
    - Add null checks for model key lookup and column entry lookup at each path segment
    - Handle case where column has null `type` property gracefully
    - Handle case where all label properties (`title`, `titleTrans`, `name`) are null
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

  - [x] 1.2 Implement `resolveLabelWithMeta` function in variableTokenUtils.js
    - Create new exported function that returns `{ label: string, titleTrans: string|null }`
    - Implement same path traversal logic as `resolveLabel` with identical null-safety guards
    - Track and return the `titleTrans` property from the leaf column found during traversal
    - Return `{ label: path, titleTrans: null }` on any resolution failure
    - _Requirements: 2.1, 2.3, 3.1, 3.3_

  - [x] 1.3 Write property tests for resolveLabel robustness (Property 1)
    - **Property 1: resolveLabel returns original path when required context is missing**
    - Use fast-check to generate arbitrary path strings with null/undefined columns/modelDoc
    - Verify original path is always returned without throwing
    - **Validates: Requirements 6.1, 6.4**

  - [x] 1.4 Write property tests for resolveLabel non-existent keys (Property 2)
    - **Property 2: resolveLabel returns original path for non-existent keys**
    - Use fast-check to generate paths with non-existent model/column keys
    - Verify original path is always returned without throwing
    - **Validates: Requirements 6.2, 6.5**

  - [x] 1.5 Write property tests for resolveLabel label priority chain (Property 3)
    - **Property 3: resolveLabel uses label priority chain for leaf columns**
    - Use fast-check to generate valid paths with columns having various combinations of title/titleTrans/name
    - Verify priority chain: `col.title` → `t(col.titleTrans)` → `col.name`
    - **Validates: Requirements 6.3**

- [x] 2. Checkpoint - Ensure resolveLabel tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Update variableDropListener signature and sync functions
  - [x] 3.1 Modify `variableDropListener` to accept `columns` and `modelDoc` options
    - Add `columns = null` and `modelDoc = null` to the destructured options parameter
    - Import `resolveLabelWithMeta` from `./variableTokenUtils`
    - Ensure no error when `columns` or `modelDoc` is null/undefined
    - _Requirements: 1.1, 1.4, 1.5_

  - [x] 3.2 Update `syncVariableComponentDisplay` with 3-step fallback chain
    - Step 1: Call `resolveLabelWithMeta(labelKey, columns, modelDoc, t)` when columns and modelDoc are available
    - Step 2: If Step 1 fails (label === labelKey), read `data-title-trans` attribute from component and display `t(storedTitleTrans)`
    - Step 3: If Step 2 fails, fall back to `buildLabelMap()` lookup using `labelKey` then `variablePath`
    - Step 4: Final fallback — strip prefix and use last segment
    - When Step 1 succeeds, update `data-title-trans` attribute on the component with resolved `titleTrans`
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 4.5_

  - [x] 3.3 Update `syncRelationsTableHeaders` with 3-step fallback chain
    - Step 1: Call `resolveLabelWithMeta(labelKey, columns, modelDoc, t)` for each header cell with `data-label-key`
    - Step 2: If Step 1 fails, read `data-title-trans` attribute from header cell and display `t(storedTitleTrans)`
    - Step 3: If Step 2 fails, fall back to `buildLabelMap()` then `getColumnLabel()` from columnsConfig
    - When Step 1 succeeds, update `data-title-trans` attribute on the header cell
    - Skip cells without `data-label-key` attribute
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 4.2, 4.5_

  - [x] 3.4 Store `data-title-trans` on drop in `canvas:dragdata` handler
    - When a single variable is dropped, include `data-title-trans: payload.titleTrans` in the gjsSubGrid attributes if `payload.titleTrans` is non-empty
    - Omit the attribute if `payload.titleTrans` is null/undefined/empty
    - Do NOT reference `resolveLabel` or `columns` during drop operations
    - _Requirements: 4.3, 4.4, 5.1, 5.2, 5.4_

  - [x] 3.5 Write property test for sync updating content and titleTrans (Property 4)
    - **Property 4: Successful modelColumns resolution updates component content and titleTrans**
    - Mock gjsSubGrid components with modelColumns that resolve successfully
    - Verify both label content and `data-title-trans` attribute are updated
    - **Validates: Requirements 2.2, 2.3, 4.5**

  - [x] 3.6 Write property test for table header sync (Property 5)
    - **Property 5: Successful modelColumns resolution updates table header content and titleTrans**
    - Mock gjsRelationsTable header cells with modelColumns that resolve successfully
    - Verify both cell content and `data-title-trans` attribute are updated
    - **Validates: Requirements 3.2, 3.3**

- [x] 4. Checkpoint - Ensure sync logic tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Update Editor.jsx to pass columns and modelDoc props
  - [x] 5.1 Destructure `columns` from page props and pass to variableDropListener
    - Add `columns` to the destructured props of the `PrintTemplate` component
    - Pass `columns` and `modelDoc: printTemplate?.model` to the `variableDropListener` options object
    - Ensure `dataTableColumns` and `docInfo` continue to be passed without modification
    - _Requirements: 1.2, 1.3, 5.3_

  - [x] 5.2 Write unit test verifying Editor passes columns and modelDoc
    - Verify `columns` prop is forwarded to variableDropListener
    - Verify `printTemplate.model` is passed as `modelDoc`
    - Verify existing props (`dataTableColumns`, `docInfo`) remain unchanged
    - _Requirements: 1.2, 1.3_

- [x] 6. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties using fast-check
- Unit tests validate specific examples and edge cases
- Drop operations are intentionally NOT modified beyond storing `titleTrans` — label resolution during drop continues using `payload.displayLabel` from `dataTableColumns`
- The `resolveLabel` function is a pure function making it ideal for property-based testing

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2"] },
    { "id": 2, "tasks": ["1.3", "1.4", "1.5"] },
    { "id": 3, "tasks": ["3.1"] },
    { "id": 4, "tasks": ["3.2", "3.3", "3.4"] },
    { "id": 5, "tasks": ["3.5", "3.6", "5.1"] },
    { "id": 6, "tasks": ["5.2"] }
  ]
}
```
