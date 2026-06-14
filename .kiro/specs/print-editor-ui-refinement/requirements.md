# Requirements Document

## Introduction

Dokumen ini menjelaskan serangkaian perbaikan UI/UX pada Print Template Editor (berbasis GrapeJS) dalam aplikasi Laravel + Inertia React. Perbaikan ini bertujuan meningkatkan usability, keterbacaan canvas, dan pengalaman editing secara keseluruhan. Fitur ini merupakan iterasi lanjutan dari spec `print-template-editor-enhancement` yang sudah selesai diimplementasikan.

## Glossary

- **PrintTemplate_Editor**: Komponen editor template cetak berbasis GrapeJS yang memungkinkan pengguna membuat dan mengedit template dokumen cetak
- **Canvas**: Area kerja visual dalam GrapeJS tempat pengguna menyusun template secara visual
- **Sidebar**: Panel samping kanan yang berisi tab-tab (Style, Layer, Blocks, Variables, Inspector) untuk konfigurasi komponen
- **Token_Configuration**: Panel konfigurasi yang menampilkan dan mengelola Handlebar token untuk variabel dan tabel relasi di canvas
- **Style_Tab**: Tab di Sidebar yang menampilkan pengaturan CSS/style untuk komponen yang dipilih
- **Monaco_Editor**: Code editor dari Microsoft (digunakan di VS Code) yang menyediakan syntax highlighting, autocomplete, dan fitur editing kode lainnya
- **Static_HTML_Component**: Komponen GrapeJS yang memungkinkan pengguna memasukkan HTML kustom dengan sanitasi keamanan
- **Bootstrap_CSS**: Library CSS Bootstrap yang digunakan khusus untuk styling canvas dan preview area, bukan untuk keseluruhan aplikasi
- **Preview_Modal**: Modal yang menampilkan hasil render template menggunakan example data
- **Variable_Node**: Komponen di canvas yang merepresentasikan variabel dokumen dengan struktur label dan value
- **Handlebar_Token**: Sintaks template Handlebar (contoh: `{{doc.company_name}}`, `{{label "company_name"}}`) yang digunakan untuk data dinamis
- **Paper_Size**: Konfigurasi ukuran kertas (width, height, unit) yang tersimpan di print template
- **Grid_Component**: Komponen GrapeJS yang menggunakan CSS Grid layout untuk menyusun konten dalam kolom dan baris
- **Flex_Component**: Komponen GrapeJS yang menggunakan CSS Flexbox layout untuk menyusun konten secara fleksibel
- **CSS_Parser**: Modul validasi yang menganalisis sintaks CSS yang ditulis pengguna dan mendeteksi error
- **Save_Status_Badge**: Indikator visual berupa badge yang menampilkan status penyimpanan template (not saved, saving, saved)
- **Inline_Variable_Node**: Token variabel yang disisipkan langsung ke dalam text component sebagai protected node yang tidak dapat diedit secara langsung oleh pengguna

## Requirements

### Requirement 1: Move Token Configuration to Dedicated Tab

**User Story:** Sebagai pengguna editor, saya ingin konfigurasi token dan daftar token di canvas berada di tab terpisah yang dedicated, sehingga tab Variables lebih bersih dan fokus pada drag & drop variabel saja.

#### Acceptance Criteria

1. THE Sidebar SHALL provide a dedicated tab for Token_Configuration separate from the Variables tab
2. WHEN the Token_Configuration tab is opened, THE Sidebar SHALL display "Konfigurasi Token" section and a unified list of all tokens in canvas (both variable tokens and relation table tokens) within a single accordion component
3. THE Variables tab SHALL only contain the list of draggable document variables without any token configuration or token listing sections
4. WHEN a variable component is selected on THE Canvas, THE Token_Configuration tab SHALL display the selected component token details and editing form
5. THE Token_Configuration accordion SHALL combine variable tokens and relation table tokens into one unified "Token di Canvas" list
6. WHEN a token item in the "Token di Canvas" list is clicked, THE Canvas SHALL activate and select the corresponding node so the user can see which component the token belongs to
7. THE "Label Key" field in token configuration SHALL use a nested select (dropdown) populated from the available variable list to prevent typos
8. THE "Handlebar Token" field in token configuration SHALL use a nested select (dropdown) populated from the available variable list to prevent typos
9. THE "Relation Path" field for relation table tokens SHALL use a nested select (dropdown) populated from the available variable list to prevent typos
10. THE Token_Configuration for relation table tokens SHALL include column management controls (show/hide columns, column ordering) integrated within the same section as the relation path configuration

### Requirement 2: Bootstrap CSS for Canvas and Preview

**User Story:** Sebagai pengguna editor, saya ingin canvas dan preview menggunakan Bootstrap CSS library, sehingga komponen di canvas memiliki styling yang konsisten dan familiar untuk dokumen cetak.

#### Acceptance Criteria

1. THE Canvas SHALL load Bootstrap CSS library within the GrapeJS iframe for styling components inside the canvas area
2. THE Preview_Modal SHALL load Bootstrap CSS library for rendering the preview output
3. THE PrintTemplate_Editor SHALL NOT load Bootstrap CSS in the main application frame to avoid conflicts with Tailwind CSS
4. WHEN Bootstrap CSS is loaded in THE Canvas, THE PrintTemplate_Editor SHALL scope the Bootstrap styles to only affect canvas content
5. THE Canvas SHALL use Bootstrap CSS classes for layout and typography styling of template components

### Requirement 3: Fix Preview Dimensions

**User Story:** Sebagai pengguna editor, saya ingin preview menampilkan dimensi yang sesuai dengan pengaturan paper size template, sehingga saya dapat melihat hasil cetak yang akurat.

#### Acceptance Criteria

1. THE Preview_Modal SHALL set the preview width to match the paper size width configured in the print template settings
2. THE Preview_Modal SHALL set the preview height to match the paper size height configured in the print template settings
3. THE Preview_Modal SHALL scale the preview to fit within the available screen size without horizontal scrolling
4. WHEN the print template is configured as a letter_head document, THE Preview_Modal SHALL set the preview height to fit the content dynamically instead of using fixed paper height
5. WHEN the print template is configured as a letter_head document, THE Preview_Modal SHALL set the preview width to match A4 paper size (210mm)
6. THE Preview_Modal SHALL apply the configured unit (mm, cm, in) from the print template when calculating preview dimensions

### Requirement 4: Monaco Editor for Static HTML Component

**User Story:** Sebagai pengguna advanced, saya ingin code editor yang lebih powerful dengan syntax highlighting dan autocomplete untuk mengedit Static HTML, sehingga pengalaman editing kode lebih nyaman dan produktif.

#### Acceptance Criteria

1. WHEN a Static_HTML_Component is opened for editing, THE PrintTemplate_Editor SHALL display Monaco_Editor as the code editor instead of a plain textarea
2. THE Monaco_Editor SHALL provide HTML syntax highlighting for the Static HTML editing experience
3. THE Monaco_Editor SHALL provide basic autocomplete for HTML tags and attributes
4. THE Monaco_Editor SHALL maintain the same save and cancel workflow as the current implementation
5. THE Monaco_Editor SHALL display line numbers and support code folding for better readability

### Requirement 5: Hide Style Tab for Static HTML Component

**User Story:** Sebagai pengguna editor, saya tidak ingin melihat Style tab ketika Static HTML component dipilih, karena styling untuk komponen tersebut dikelola langsung melalui kode HTML-nya.

#### Acceptance Criteria

1. WHEN the active selected node on THE Canvas is a Static_HTML_Component, THE Sidebar SHALL hide the Style tab entirely
2. WHEN a non-Static_HTML_Component node is selected, THE Sidebar SHALL display the Style tab as normal
3. WHEN no node is selected on THE Canvas, THE Sidebar SHALL display the Style tab as normal
4. IF the Style tab is currently active and a Static_HTML_Component is selected, THEN THE Sidebar SHALL automatically switch to another available tab

### Requirement 6: Simplify Style Tab

**User Story:** Sebagai pengguna editor, saya ingin Style tab yang lebih sederhana tanpa pengaturan yang jarang digunakan untuk template cetak, sehingga saya dapat fokus pada pengaturan style yang relevan.

#### Acceptance Criteria

1. THE Style_Tab SHALL NOT display the Font Family property in the style settings
2. THE Style_Tab SHALL NOT display the Text Shadow property in the style settings
3. THE Style_Tab SHALL NOT display the Box Shadow property in the style settings
4. THE Style_Tab SHALL NOT display the Transition property in the style settings
5. THE Style_Tab SHALL NOT display the Transform property in the style settings
6. THE Style_Tab SHALL retain all other style properties that are relevant for print template editing (font size, color, margin, padding, border, alignment, etc.)

### Requirement 7: Improve Style Tab UI

**User Story:** Sebagai pengguna editor, saya ingin tampilan Style tab yang lebih rapi dan mudah digunakan, sehingga pengaturan style lebih intuitif.

#### Acceptance Criteria

1. THE Style_Tab SHALL display style properties with clear labels and consistent spacing between sections
2. THE Style_Tab SHALL group related style properties logically (typography, spacing, borders, layout)
3. THE Style_Tab SHALL use appropriate input controls for each property type (color picker for colors, number input with unit for dimensions, select for predefined values)
4. WHEN a style property has a value set, THE Style_Tab SHALL provide a clear visual indicator distinguishing it from properties with default values

### Requirement 8: Fix Token Display in Canvas

**User Story:** Sebagai pengguna editor, saya ingin canvas menampilkan token dalam format yang disederhanakan dan mudah dibaca, bukan sintaks Handlebar mentah yang panjang, sehingga saya dapat memahami konten template secara visual.

#### Acceptance Criteria

1. THE Canvas SHALL NOT display raw Handlebar syntax (contoh: `{{label "company_name"}}`, `{{doc.company_name}}`) as visible text in variable components
2. WHEN a variable component contains a label token like `{{label "company_name"}}`, THE Canvas SHALL display the translated label text (contoh: "Company Name" atau "Nama Perusahaan")
3. WHEN a variable component contains a value token like `{{doc.company_name}}`, THE Canvas SHALL display a simplified token format by stripping the "doc." prefix (contoh: `{{doc.company_name}}` ditampilkan sebagai `{{company_name}}`)
4. WHEN a variable component contains a nested value token like `{{doc.customer.name}}`, THE Canvas SHALL display the simplified token format by stripping only the "doc." prefix (contoh: `{{doc.customer.name}}` ditampilkan sebagai `{{customer.name}}`)
5. WHEN a relation table contains header tokens, THE Canvas SHALL display the relation table headers using the simplified token format with the "doc." prefix stripped

### Requirement 9: Add Canvas Node Spacing

**User Story:** Sebagai pengguna editor, saya ingin setiap node di canvas memiliki jarak (padding/margin) yang cukup, sehingga lebih mudah untuk memilih dan mengelola komponen secara visual.

#### Acceptance Criteria

1. THE Canvas SHALL apply visual spacing (padding or margin) to each editable node to make selection easier
2. THE Canvas spacing SHALL only be visible in the editor view and SHALL NOT affect the final print output
3. THE Canvas spacing SHALL provide enough room for users to click and select individual components without accidentally selecting adjacent components
4. WHEN the template is saved or exported, THE PrintTemplate_Editor SHALL NOT include the editor-only spacing in the output HTML or CSS

### Requirement 10: Wrap Variable Value in Component Wrapper

**User Story:** Sebagai pengguna editor, saya ingin bagian value dari variabel dibungkus dalam component wrapper tambahan, sehingga value tidak mudah termodifikasi secara tidak sengaja dan style dapat diterapkan secara terpisah pada bagian value.

#### Acceptance Criteria

1. WHEN a variable node is created on THE Canvas, THE PrintTemplate_Editor SHALL wrap the value portion (`{{doc.variable_name}}`) in an additional component wrapper element
2. THE value wrapper component SHALL prevent accidental modification of the token value by users during visual editing
3. THE value wrapper component SHALL allow style settings to be applied separately to the value portion of the variable
4. THE `<p>` tag content containing the label text SHALL remain editable with the GrapeJS text editing tool
5. THE value wrapper component SHALL preserve the correct Handlebar token in the final HTML output when the template is saved
6. WHEN the variable node structure is exported to HTML, THE PrintTemplate_Editor SHALL generate the correct Handlebar syntax (contoh: `<p>: {{doc.company_name}}</p>`) regardless of the wrapper

### Requirement 11: Grid Component Simplified Settings

**User Story:** Sebagai pengguna editor, saya ingin pengaturan grid component yang sederhana di Style tab, sehingga saya dapat dengan mudah menambah/menghapus kolom dan mengatur ukuran kolom tanpa harus menulis CSS secara manual.

#### Acceptance Criteria

1. WHEN a grid component is selected on THE Canvas, THE Style_Tab SHALL display simplified grid settings controls
2. THE Style_Tab grid settings SHALL provide controls to add new columns to the grid component
3. THE Style_Tab grid settings SHALL provide controls to remove existing columns from the grid component
4. THE Style_Tab grid settings SHALL provide a size/width setting for each individual column in the grid component
5. WHEN a column width is changed via the grid settings, THE PrintTemplate_Editor SHALL update the grid component CSS accordingly on the Canvas

### Requirement 12: Grid and Flex Layout Properties

**User Story:** Sebagai pengguna editor, saya ingin pengaturan layout properties yang spesifik untuk grid dan flex component di Style tab, sehingga saya dapat mengatur alignment dan spacing konten dengan mudah.

#### Acceptance Criteria

1. WHEN a grid component is selected on THE Canvas, THE Style_Tab SHALL display grid-specific layout properties (justify-content, align-content, justify-items, align-items, gap-x, gap-y)
2. WHEN a flex component is selected on THE Canvas, THE Style_Tab SHALL display flex-specific layout properties (justify-content, align-content, align-items, gap-x, gap-y)
3. THE Style_Tab layout properties SHALL use appropriate input controls (select dropdown for alignment values, number input with unit for gap values)
4. WHEN a layout property value is changed, THE PrintTemplate_Editor SHALL apply the corresponding CSS property to the selected component on the Canvas
5. THE Style_Tab SHALL display layout properties in a dedicated "Layout" section grouped separately from other style properties

### Requirement 13: Manual CSS Style Editor

**User Story:** Sebagai pengguna advanced, saya ingin area untuk menulis CSS style secara manual di Style tab menggunakan Monaco Editor, sehingga saya dapat menerapkan style kustom dengan syntax highlighting dan validasi yang sama seperti Static HTML editor.

#### Acceptance Criteria

1. THE Style_Tab SHALL provide a manual CSS style writing area using Monaco_Editor where users can type CSS properties directly
2. THE Monaco_Editor for CSS SHALL provide CSS syntax highlighting for the manual style editing experience
3. THE Monaco_Editor for CSS SHALL provide basic autocomplete for CSS properties and values
4. WHEN the CSS parser detects a syntax error, THE Monaco_Editor SHALL display an error indicator highlighting the invalid CSS syntax inline
5. WHEN valid CSS is written in the manual style area, THE PrintTemplate_Editor SHALL apply the CSS properties to the selected component on the Canvas
6. THE manual CSS style area SHALL preserve user-written CSS when switching between components and returning to the same component

### Requirement 15: Inline Variable Insertion in Text Component

**User Story:** Sebagai pengguna editor, saya ingin dapat menyisipkan variabel langsung ke dalam text component yang sedang aktif dengan mengklik item variabel di panel Variables, sehingga saya tidak perlu drag & drop dan variabel langsung terintegrasi dalam teks.

#### Acceptance Criteria

1. WHEN a text node is in active editing mode on THE Canvas and the user clicks a variable item in the Variables tab, THE PrintTemplate_Editor SHALL automatically insert the variable token inline at the current cursor position within the text component
2. THE inserted inline variable SHALL be rendered as a protected node (non-editable content) within the text component to prevent accidental modification of the token
3. THE inserted inline variable node SHALL be configurable via the Token_Configuration tab (same as standalone variable tokens)
4. THE inserted inline variable node SHALL appear in the "Token di Canvas" list in the Token_Configuration tab alongside other variable and relation table tokens
5. WHEN the text component is exported to HTML, THE PrintTemplate_Editor SHALL generate the correct Handlebar syntax for the inline variable token
6. THE inline variable node SHALL display using the simplified token format (stripping "doc." prefix) consistent with Requirement 8

### Requirement 16: Separate Variable Item Action and Collapsible Trigger

**User Story:** Sebagai pengguna editor, saya ingin tombol aksi variabel item (untuk insert/drag) dan tombol expand/collapse pada variabel nested dipisahkan secara visual dan fungsional, sehingga saya dapat mengklik variabel untuk menyisipkannya tanpa secara tidak sengaja membuka/menutup daftar child-nya.

#### Acceptance Criteria

1. WHEN a variable item in the Variables tab has nested children, THE Variables tab SHALL display the variable item button and the collapsible trigger as two separate interactive areas
2. THE variable item button area SHALL trigger the insert/drag action (inserting the variable into canvas or text component)
3. THE collapsible trigger area SHALL only expand or collapse the nested children list without triggering any insert/drag action
4. WHEN the user clicks the variable item button on a nested variable, THE PrintTemplate_Editor SHALL perform the insert action without expanding or collapsing the children
5. WHEN the user clicks the collapsible trigger on a nested variable, THE Variables tab SHALL toggle the visibility of the nested children without performing any insert action

### Requirement 14: Save Status Alerts and Indicators

**User Story:** Sebagai pengguna editor, saya ingin melihat status penyimpanan template secara jelas melalui alert dan badge indicator, sehingga saya selalu tahu apakah perubahan sudah tersimpan atau terjadi error.

#### Acceptance Criteria

1. IF an error occurs during the save process, THEN THE PrintTemplate_Editor SHALL display an alert notification informing the user about the save error
2. WHEN a manual save completes successfully, THE PrintTemplate_Editor SHALL display a success alert notification confirming the save
3. THE PrintTemplate_Editor SHALL display a status badge indicator showing the current save state (not saved, saving, saved)
4. THE save status badge SHALL be positioned on the same toolbar/card as the save, undo, and redo buttons
5. WHEN the template has unsaved changes, THE save status badge SHALL display a "not saved" state
6. WHILE the save process is in progress, THE save status badge SHALL display a "saving" state
7. WHEN the template was last saved within the past minute, THE save status badge SHALL display a "saved" state with relative time information
