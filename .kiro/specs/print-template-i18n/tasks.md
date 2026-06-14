# Implementation Plan: Print Template i18n

## Overview

Replace all hardcoded user-facing strings in 14 PrintTemplate components with `t()` calls from `useLaravelReactI18n`, and create/update translation PHP files for both English and Indonesian locales. The implementation starts with the translation files (so keys are available), then updates components in batches grouped by complexity.

## Tasks

- [x] 1. Create translation files with all new keys
  - [x] 1.1 Create/update English translation file `lang/en/core/printTemplate.php`
    - Add all new translation keys under the `editor` array with English values
    - Include keys for all 14 components as defined in the design document
    - Ensure keys follow snake_case naming and `core.printTemplate.editor.*` namespace
    - _Requirements: 15.1, 15.3_

  - [x] 1.2 Create/update Indonesian translation file `lang/id/core/printTemplate.php`
    - Add all new translation keys under the `editor` array with Indonesian values
    - Mirror the exact same key structure as the English file
    - Use proper Indonesian translations for all values
    - _Requirements: 15.2, 15.3, 15.4_

  - [x] 1.3 Write translation key parity test
    - **Property 1: Translation key parity across locales**
    - **Validates: Requirements 15.4**
    - Write a PHPUnit test that parses both locale files and asserts identical key structures

- [x] 2. Add i18n hook to components that need fresh import (batch 1: simple components)
  - [x] 2.1 Internationalize FlexLayoutControls.jsx
    - Import `useLaravelReactI18n` and destructure `t`
    - Replace hardcoded labels: "Justify Content", "Align Content", "Align Items", "Column Gap", "Row Gap"
    - _Requirements: 7.1, 7.2_

  - [x] 2.2 Internationalize GridLayoutControls.jsx
    - Import `useLaravelReactI18n` and destructure `t`
    - Replace hardcoded labels: "Grid Columns", "+ Kolom", "Hapus", "Justify Content", "Align Content", "Justify Items", "Align Items", "Column Gap", "Row Gap"
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

  - [x] 2.3 Internationalize CustomSelectorManager.jsx
    - Import `useLaravelReactI18n` and destructure `t`
    - Replace hardcoded strings: "Selectors", "Select a component", "Selected:", "None"
    - _Requirements: 6.1, 6.2, 6.3_

  - [x] 2.4 Internationalize StaticHTMLInspector.jsx
    - Import `useLaravelReactI18n` and destructure `t`
    - Replace hardcoded strings: heading, empty state, "Edit HTML", "Raw HTML", sanitization warning title, "Sanitized Preview", no HTML stored message
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7_

- [x] 3. Add i18n hook to components that need fresh import (batch 2: complex components)
  - [x] 3.1 Internationalize StaticHTMLComponent.jsx
    - Import `useLaravelReactI18n` and destructure `t`
    - Replace hardcoded strings: dialog title, description, "Input HTML", "Preview (Sanitized)", preview placeholder, security warning title, "Cancel", "Save HTML"
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

  - [x] 3.2 Internationalize TopBar.jsx
    - Import `useLaravelReactI18n` and destructure `t`
    - Replace hardcoded button labels: "Save", "Undo", "Redo", "Preview", "Outline", "Code"
    - _Requirements: 2.1_

  - [x] 3.3 Internationalize MobileEditor.jsx
    - Import `useLaravelReactI18n` and destructure `t`
    - Replace hardcoded strings: "Save", "Preview", "Undo", "Redo", heading, description, empty state, "Text", "Font Size (px)", "Color", "Alignment", alignment aria-labels
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

  - [x] 3.4 Internationalize SaveStatusBadge.jsx
    - Import `useLaravelReactI18n` and destructure `t`
    - Replace status labels: "Saving...", "Not Saved", "Save Error", "Saved", "Ready"
    - Refactor `formatRelativeTime` to accept `t` as parameter
    - Replace relative time strings with `t()` calls using `:count` parameter
    - Replace toast messages with `t()` calls
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 4. Checkpoint - Verify fresh import components
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Update components that already have the hook
  - [x] 5.1 Internationalize remaining strings in CustomStyleManager.jsx
    - Replace hardcoded strings: "Layout" heading, no style properties message, "No manual CSS applied."
    - _Requirements: 5.1, 5.2, 5.3_

  - [x] 5.2 Internationalize remaining strings in CSSEditorModal.jsx
    - Replace hardcoded strings: "CSS Syntax Error", "Invalid CSS declaration", protected selector title and description
    - _Requirements: 11.1, 11.2, 11.3_

  - [x] 5.3 Internationalize remaining strings in VariableManager.jsx
    - Replace hardcoded strings: "Variabel Dokumen" heading, "Tidak ada variabel tersedia." empty state
    - _Requirements: 12.1, 12.2_

  - [x] 5.4 Internationalize remaining strings in VariableItem.jsx
    - Replace hardcoded strings: column load error, "Contoh:" label, relations tooltip, relation tooltip, loading columns text
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5_

  - [x] 5.5 Internationalize remaining strings in TokenConfigurationManager.jsx
    - Replace hardcoded string: "Memuat kolom terbaru..." loading text
    - _Requirements: 14.1_

  - [x] 5.6 Internationalize remaining strings in PreviewModal.jsx
    - Replace hardcoded strings: dialog title, description, loading message, error title, warnings title, relation summary title/suffix, missing data title/message/buttons, footer buttons, popup blocked message, success/error toasts, template invalid message, iframe title
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9, 4.10, 4.11, 4.12_

- [x] 6. Final checkpoint - Build verification and full validation
  - Run `npm run build` to ensure no import errors or missing dependencies
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Translation files are created first so keys are available when components are updated
- Components are batched by complexity: simple label replacements first, then components with conditional logic or special handling (SaveStatusBadge)
- Components already using the hook are grouped separately since they only need string replacements without import changes
- The `formatRelativeTime` refactor in SaveStatusBadge is the most complex change — it requires passing `t` as a parameter to the utility function

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["1.3", "2.1", "2.2", "2.3", "2.4"] },
    { "id": 2, "tasks": ["3.1", "3.2", "3.3", "3.4"] },
    { "id": 3, "tasks": ["5.1", "5.2", "5.3", "5.4", "5.5", "5.6"] }
  ]
}
```
