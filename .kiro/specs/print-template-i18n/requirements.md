# Requirements Document

## Introduction

Replace all hardcoded content strings in the PrintTemplate directory with multi-language support using the `useLaravelReactI18n` hook. The project already uses `laravel-react-i18n` extensively with the pattern `const { t } = useLaravelReactI18n()` and translation keys under the `core.printTemplate.*` namespace. This feature ensures all user-facing strings in the PrintTemplate editor are translatable, supporting both Indonesian (id) and English (en) locales.

## Glossary

- **Translation_System**: The `laravel-react-i18n` package providing the `useLaravelReactI18n` hook and `t()` function for translating strings in React components
- **Translation_Key**: A dot-notation string (e.g., `core.printTemplate.editor.save`) that maps to a localized string in PHP translation files
- **Translation_File**: PHP files located at `lang/{locale}/core/printTemplate.php` containing key-value pairs for translations
- **PrintTemplate_Editor**: The GrapesJS-based template editor located in `resources/js/Pages/Core/PrintTemplate/`
- **Hardcoded_String**: A user-facing string literal directly embedded in JSX/JavaScript code without translation support

## Requirements

### Requirement 1: Add i18n hook to MobileEditor

**User Story:** As a developer, I want all user-facing strings in MobileEditor.jsx to use translation keys, so that the mobile editor interface supports multiple languages.

#### Acceptance Criteria

1. WHEN MobileEditor.jsx is rendered, THE Translation_System SHALL provide translated strings for "Save", "Preview", "Undo", "Redo" button labels
2. WHEN MobileEditor.jsx is rendered, THE Translation_System SHALL provide translated strings for "Editor Mobile" heading and its description text
3. WHEN no text component is selected, THE Translation_System SHALL provide a translated empty state message
4. WHEN a text component is selected, THE Translation_System SHALL provide translated labels for "Text", "Font Size (px)", "Color", "Alignment"
5. THE Translation_System SHALL provide translated aria-labels for alignment buttons ("Align Left", "Align Center", "Align Right", "Align Justify")

### Requirement 2: Add i18n hook to TopBar

**User Story:** As a developer, I want all user-facing strings in TopBar.jsx to use translation keys, so that the toolbar supports multiple languages.

#### Acceptance Criteria

1. WHEN TopBar.jsx is rendered, THE Translation_System SHALL provide translated strings for "Save", "Undo", "Redo", "Preview", "Outline", "Code" button labels

### Requirement 3: Add i18n hook to SaveStatusBadge

**User Story:** As a developer, I want all user-facing strings in SaveStatusBadge.jsx to use translation keys, so that save status indicators and toast messages support multiple languages.

#### Acceptance Criteria

1. WHEN the save status changes, THE Translation_System SHALL provide translated labels for "Saving...", "Not Saved", "Save Error", "Saved", "Ready"
2. WHEN relative time is displayed, THE Translation_System SHALL provide translated time strings for "baru saja" (just now), "m lalu" (minutes ago), "j lalu" (hours ago)
3. WHEN a save succeeds, THE Translation_System SHALL provide a translated success toast message
4. WHEN a save fails, THE Translation_System SHALL provide a translated error toast message

### Requirement 4: Internationalize PreviewModal strings

**User Story:** As a developer, I want all hardcoded strings in PreviewModal.jsx to use translation keys, so that the preview dialog supports multiple languages.

#### Acceptance Criteria

1. WHEN PreviewModal is opened, THE Translation_System SHALL provide translated strings for the dialog title "Preview Template" and description
2. WHEN preview is loading, THE Translation_System SHALL provide a translated loading message
3. WHEN preview rendering fails, THE Translation_System SHALL provide a translated error title "Gagal merender preview"
4. WHEN warnings are present, THE Translation_System SHALL provide a translated "Warnings" alert title
5. WHEN relation summary is shown, THE Translation_System SHALL provide translated text for "Ringkasan Table Relation" title and "baris data contoh" suffix
6. WHEN example data is missing, THE Translation_System SHALL provide translated strings for the "Data Contoh Tidak Tersedia" title, warning message, and "Generate Example Data" / "Membuat Data..." button labels
7. WHEN footer buttons are rendered, THE Translation_System SHALL provide translated labels for "Close", "Print", "Export PDF"
8. WHEN popup is blocked, THE Translation_System SHALL provide a translated error message
9. WHEN example data generation succeeds, THE Translation_System SHALL provide a translated success message
10. WHEN example data generation fails, THE Translation_System SHALL provide a translated error message
11. WHEN template is invalid for preview, THE Translation_System SHALL provide a translated error message
12. THE Translation_System SHALL provide a translated title for the preview iframe

### Requirement 5: Internationalize CustomStyleManager remaining strings

**User Story:** As a developer, I want the remaining hardcoded strings in CustomStyleManager.jsx to use translation keys, so that the style panel is fully translated.

#### Acceptance Criteria

1. WHEN layout controls are shown, THE Translation_System SHALL provide a translated "Layout" section heading
2. WHEN no style properties are available, THE Translation_System SHALL provide a translated empty state message
3. WHEN no manual CSS is applied, THE Translation_System SHALL provide a translated "No manual CSS applied." message

### Requirement 6: Add i18n hook to CustomSelectorManager

**User Story:** As a developer, I want all user-facing strings in CustomSelectorManager.jsx to use translation keys, so that the selector panel supports multiple languages.

#### Acceptance Criteria

1. WHEN CustomSelectorManager is rendered, THE Translation_System SHALL provide a translated "Selectors" heading
2. WHEN no component is selected, THE Translation_System SHALL provide a translated "Select a component" placeholder
3. WHEN a component is selected, THE Translation_System SHALL provide translated "Selected:" and "None" labels

### Requirement 7: Add i18n hook to FlexLayoutControls

**User Story:** As a developer, I want all user-facing strings in FlexLayoutControls.jsx to use translation keys, so that flex layout labels support multiple languages.

#### Acceptance Criteria

1. WHEN FlexLayoutControls is rendered, THE Translation_System SHALL provide translated labels for "Justify Content", "Align Content", "Align Items"
2. WHEN FlexLayoutControls is rendered, THE Translation_System SHALL provide translated labels for "Column Gap", "Row Gap"

### Requirement 8: Add i18n hook to GridLayoutControls

**User Story:** As a developer, I want all user-facing strings in GridLayoutControls.jsx to use translation keys, so that grid layout labels support multiple languages.

#### Acceptance Criteria

1. WHEN GridLayoutControls is rendered, THE Translation_System SHALL provide a translated "Grid Columns" heading
2. WHEN GridLayoutControls is rendered, THE Translation_System SHALL provide translated labels for "+ Kolom" button and "Hapus" button
3. WHEN GridLayoutControls is rendered, THE Translation_System SHALL provide translated labels for "Justify Content", "Align Content", "Justify Items", "Align Items"
4. WHEN GridLayoutControls is rendered, THE Translation_System SHALL provide translated labels for "Column Gap", "Row Gap"

### Requirement 9: Add i18n hook to StaticHTMLComponent

**User Story:** As a developer, I want all user-facing strings in StaticHTMLComponent.jsx to use translation keys, so that the HTML editor dialog supports multiple languages.

#### Acceptance Criteria

1. WHEN StaticHTMLComponent dialog is opened, THE Translation_System SHALL provide translated strings for "Custom HTML Editor" title and description
2. WHEN the editor is rendered, THE Translation_System SHALL provide translated labels for "Input HTML" and "Preview (Sanitized)"
3. WHEN no preview is available, THE Translation_System SHALL provide a translated placeholder "Preview akan muncul di sini..."
4. WHEN security warnings are shown, THE Translation_System SHALL provide a translated "Peringatan Keamanan" title
5. WHEN footer buttons are rendered, THE Translation_System SHALL provide translated labels for "Batal" and "Simpan HTML"

### Requirement 10: Add i18n hook to StaticHTMLInspector

**User Story:** As a developer, I want all user-facing strings in StaticHTMLInspector.jsx to use translation keys, so that the HTML inspector panel supports multiple languages.

#### Acceptance Criteria

1. WHEN StaticHTMLInspector is rendered, THE Translation_System SHALL provide a translated "Static HTML Inspector" heading
2. WHEN no component is selected, THE Translation_System SHALL provide a translated empty state message
3. WHEN a component is selected, THE Translation_System SHALL provide a translated "Edit HTML" button label
4. WHEN raw HTML is displayed, THE Translation_System SHALL provide a translated "Raw HTML" label
5. WHEN sanitization warnings are shown, THE Translation_System SHALL provide a translated "Peringatan Sanitasi" title
6. WHEN sanitized preview is shown, THE Translation_System SHALL provide a translated "Sanitized Preview" label
7. WHEN no HTML is stored, THE Translation_System SHALL provide a translated empty state message

### Requirement 11: Internationalize CSSEditorModal remaining strings

**User Story:** As a developer, I want the remaining hardcoded strings in CSSEditorModal.jsx to use translation keys, so that the CSS editor is fully translated.

#### Acceptance Criteria

1. WHEN CSS syntax errors are displayed, THE Translation_System SHALL provide a translated "CSS Syntax Error" heading
2. WHEN an invalid CSS declaration is found, THE Translation_System SHALL provide a translated "Invalid CSS declaration" fallback message
3. WHEN protected selectors are detected, THE Translation_System SHALL provide translated strings for the "Protected selector terdeteksi" title and its description

### Requirement 12: Internationalize VariableManager remaining strings

**User Story:** As a developer, I want the remaining hardcoded strings in VariableManager.jsx to use translation keys, so that the variable panel is fully translated.

#### Acceptance Criteria

1. WHEN VariableManager is rendered, THE Translation_System SHALL provide a translated "Variabel Dokumen" heading
2. WHEN no variables are available, THE Translation_System SHALL provide a translated "Tidak ada variabel tersedia." empty state message

### Requirement 13: Internationalize VariableItem remaining strings

**User Story:** As a developer, I want the remaining hardcoded strings in VariableItem.jsx to use translation keys, so that variable items are fully translated.

#### Acceptance Criteria

1. WHEN column loading fails, THE Translation_System SHALL provide a translated "Gagal memuat kolom." error message
2. WHEN a tooltip is shown for a variable, THE Translation_System SHALL provide a translated "Contoh:" label
3. WHEN a tooltip is shown for a relations type, THE Translation_System SHALL provide a translated "Tabel relasi (drag untuk membuat tabel)" text
4. WHEN a tooltip is shown for a relation type, THE Translation_System SHALL provide a translated "Relasi (klik untuk expand)" text
5. WHEN columns are loading, THE Translation_System SHALL provide a translated "Memuat kolom..." loading text

### Requirement 14: Internationalize TokenConfigurationManager remaining strings

**User Story:** As a developer, I want the remaining hardcoded strings in TokenConfigurationManager.jsx to use translation keys, so that the token configuration panel is fully translated.

#### Acceptance Criteria

1. WHEN columns are being refreshed, THE Translation_System SHALL provide a translated "Memuat kolom terbaru..." loading text

### Requirement 15: Create translation entries in PHP files

**User Story:** As a developer, I want all new translation keys to be defined in both `lang/en/core/printTemplate.php` and `lang/id/core/printTemplate.php`, so that translations are available for both supported locales.

#### Acceptance Criteria

1. THE Translation_File for English locale SHALL contain all new translation keys with English values under the `editor` array
2. THE Translation_File for Indonesian locale SHALL contain all new translation keys with Indonesian values under the `editor` array
3. THE Translation_System SHALL use the namespace `core.printTemplate.editor.*` for all editor-related translation keys
4. FOR ALL new translation keys, THE Translation_File SHALL define the key in both `lang/en/core/printTemplate.php` and `lang/id/core/printTemplate.php`
