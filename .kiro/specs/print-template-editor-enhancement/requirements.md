# Requirements Document

## Introduction

Dokumen ini menjelaskan peningkatan fitur PrintTemplate Editor yang menggunakan GrapeJS dalam aplikasi Laravel dengan Inertia React. Peningkatan ini bertujuan untuk meningkatkan pengalaman pengguna dalam mengedit template cetak dengan fokus pada drag & drop variabel, token Handlebar yang lebih baik, dukungan relasi tabel, UI/UX yang konsisten, dukungan mobile, dan komponen HTML statis yang aman.

## Glossary

- **PrintTemplate_Editor**: Komponen editor template cetak berbasis GrapeJS yang memungkinkan pengguna membuat dan mengedit template dokumen cetak
- **VariableItem**: Komponen yang merepresentasikan variabel data yang dapat di-drag dan di-drop ke dalam kanvas editor, mendukung nestedColumns untuk single relations dan relationsTable untuk many relations
- **Canvas**: Area kerja visual dalam GrapeJS tempat pengguna menyusun template, menampilkan example data tanpa Handlebar tokens untuk tampilan yang lebih bersih
- **Handlebar_Token**: Sintaks template Handlebar ({{variable}}) yang digunakan untuk menampilkan data dinamis, dikonfigurasi dan dikelola melalui Sidebar
- **TableRelation**: Komponen yang merepresentasikan data relasi tabel yang dapat ditampilkan dalam format tabel
- **Sidebar**: Panel samping yang berisi daftar variabel, blok, layer, pengaturan style, dan konfigurasi Handlebar token
- **Static_HTML_Component**: Komponen HTML kustom yang dapat ditambahkan pengguna dengan sanitasi keamanan
- **Mobile_Editor**: Versi editor yang dioptimalkan untuk perangkat mobile dengan fitur terbatas
- **Sanitizer**: Mekanisme pembersihan HTML untuk mencegah XSS dan injection attacks
- **DataTableColumns**: Konfigurasi sumber untuk semua field definitions yang digunakan dalam template, termasuk formatting untuk currency dan number types
- **Label_Helper**: Helper Handlebar tunggal yang digunakan untuk mendapatkan label field berdasarkan bahasa dari dataTableColumns configuration
- **Example_Data_System**: Sistem yang mengelola data contoh untuk preview template, menggunakan kolom penanda (is_example) pada setiap tabel untuk mengidentifikasi data contoh
- **Preview_Modal**: Modal atau view yang menampilkan hasil render template menggunakan example data dari database
- **Database_Seeder**: Seeder yang menghasilkan data contoh realistis untuk setiap Model dalam aplikasi
- **Relation_Tracker**: Sistem yang melacak semua relasi yang digunakan dalam template dan menyimpannya dalam array untuk optimasi loading
- **Used_Relations**: Kolom JSON dalam tabel print_templates yang menyimpan array path relasi yang digunakan dalam template

## Requirements

### Requirement 1: VariableItem Drag & Drop Enhancement

**User Story:** Sebagai pengguna editor, saya ingin drag & drop variabel yang lebih intuitif dengan tampilan preview yang jelas di kanvas menggunakan example data, sehingga saya dapat dengan mudah memahami bagaimana variabel akan ditampilkan dalam hasil akhir tanpa melihat Handlebar token di kanvas.

#### Acceptance Criteria

1. WHEN a VariableItem is dragged to THE Canvas, THE PrintTemplate_Editor SHALL display a visual preview with example data from the Example_Data_System
2. THE Canvas SHALL display example data values only, not Handlebar tokens, for a cleaner visual appearance
3. THE Sidebar SHALL manage and display Handlebar token configuration for each VariableItem
4. THE VariableItem SHALL support labelLang and value configuration from DataTableColumns
5. WHEN a VariableItem is dropped on THE Canvas, THE PrintTemplate_Editor SHALL create a formatted component with label and example data value
6. THE Canvas SHALL display VariableItem components in a grid layout with label on the left and example value on the right
7. WHEN a user hovers over a VariableItem in THE Sidebar, THE PrintTemplate_Editor SHALL show a tooltip with the variable name and Handlebar token
8. WHEN a user selects a VariableItem on THE Canvas, THE Sidebar SHALL display the corresponding Handlebar token configuration
9. WHEN a VariableItem has type currency or number in DataTableColumns, THE PrintTemplate_Editor SHALL apply the formatting settings defined in DataTableColumns configuration
10. WHEN a VariableItem represents a single relation with nestedColumns, THE PrintTemplate_Editor SHALL support nestedColumns structure for accessing nested properties
11. WHEN a VariableItem represents a many relation, THE PrintTemplate_Editor SHALL use relationsTable structure instead of nestedColumns

### Requirement 2: Handlebar Token Structure Improvement

**User Story:** Sebagai developer, saya ingin token Handlebar yang lebih rapi dan terstruktur dengan helper yang unified untuk label retrieval, sehingga template lebih mudah dibaca, di-maintain, dan tidak ada redefinisi helper yang serupa.

#### Acceptance Criteria

1. THE PrintTemplate_Editor SHALL generate Handlebar tokens with consistent formatting and indentation
2. WHEN a simple variable is used, THE Handlebar_Token SHALL use the format {{doc.variableName}} for direct property access (example: {{doc.customerName}}, {{doc.invoiceNumber}}, {{doc.totalAmount}})
3. WHEN a relation variable is used, THE Handlebar_Token SHALL use the format {{relation relationName}} for accessing related model properties (example: {{relation doc.customer}}, {{relation doc.product}}, {{relation doc.warehouse}})
4. WHEN a preferences variable is used, THE Handlebar_Token SHALL use the format {{company.variableName}} with proper escaping for company settings (example: {{company.companyName}}, {{company.address}}, {{company.phone}})
5. WHEN nested objects are accessed, THE Handlebar_Token SHALL use dot notation for property traversal (example: {{customer.address.street}}, {{order.shipping.method}}, {{product.category.name}})
6. WHEN arrays are iterated, THE Handlebar_Token SHALL use {{#each arrayName}} and {{/each}} blocks with proper indentation (example: {{#each items}} {{this.name}} {{/each}})
7. THE PrintTemplate_Editor SHALL support conditional rendering using {{#if condition}} and {{/if}} blocks (example: {{#if isPaid}} Paid {{/if}}, {{#if customer.isVip}} VIP Customer {{/if}})
8. THE PrintTemplate_Editor SHALL support negative conditionals using {{#unless condition}} and {{/unless}} blocks (example: {{#unless isShipped}} Pending Shipment {{/unless}})
9. THE PrintTemplate_Editor SHALL provide a unified Label_Helper for retrieving field labels from DataTableColumns based on language, replacing the separate infoColumns and trans helpers
10. THE Label_Helper SHALL accept a field path and return the translated label from DataTableColumns configuration (example: {{label "customer.name"}}, {{label "items.product"}})
11. THE PrintTemplate_Editor SHALL provide helper functions for common formatting including {{formatDate date "DD/MM/YYYY"}}, {{formatCurrency amount "IDR"}}, {{formatNumber value decimals}}, and {{uppercase text}}
12. WHEN helper functions are used, THE Handlebar_Token SHALL validate parameter types and provide clear error messages for invalid usage
13. THE PrintTemplate_Editor SHALL validate Handlebar token syntax before saving the template and display specific error messages for malformed tokens
14. WHEN nested variables are used, THE Handlebar_Token SHALL maintain proper nesting structure with correct indentation levels for readability
15. WHEN formatting currency or number variables, THE Handlebar_Token SHALL use the formatting settings defined in DataTableColumns configuration for that field type

### Requirement 3: TableRelation Architecture Enhancement

**User Story:** Sebagai pengguna editor, saya ingin tabel relasi yang ditampilkan di kanvas mendekati hasil nyata dengan format token yang jelas, dukungan iterasi data, dan konfigurasi kolom yang dapat diperbarui sesuai kebutuhan terbaru, sehingga saya dapat melihat preview yang akurat sebelum mencetak.

#### Acceptance Criteria

1. WHEN a TableRelation is dropped on THE Canvas, THE PrintTemplate_Editor SHALL render a table with header and example data rows from the Example_Data_System
2. THE Canvas SHALL display example data values in table cells, not Handlebar tokens, for a cleaner visual appearance
3. THE Sidebar SHALL manage and display Handlebar token configuration for TableRelation columns
4. THE TableRelation SHALL display column headers using the unified Label_Helper to retrieve translated labels from DataTableColumns configuration
5. THE TableRelation SHALL generate Handlebar tokens using {{#each}} for row iteration combined with the unified Label_Helper for column labels
6. WHEN a TableRelation contains relation columns, THE Handlebar_Token SHALL use {{relation columnName}} syntax within table cells (example: `<td>{{relation product.name}}</td>`, `<td>{{relation category.title}}</td>`)
7. WHEN iterating table rows, THE TableRelation SHALL use {{#each tableName}} and {{/each}} blocks with proper row structure (example: `{{#each orderItems}} <tr><td>{{this.productName}}</td><td>{{this.quantity}}</td></tr> {{/each}}`)
8. THE TableRelation SHALL support nested iteration for related data within table cells using nestedColumns for single relations (example: `{{#each items}} <td>{{this.customer.name}}</td> {{/each}}`)
9. WHEN a TableRelation represents many relations, THE TableRelation SHALL use relationsTable structure instead of nestedColumns
10. WHEN formatting data in table cells with currency or number type, THE TableRelation SHALL apply the formatting settings defined in DataTableColumns configuration for that field
11. THE Canvas SHALL display TableRelation with proper styling including borders, padding, and alternating row colors for better readability
12. THE TableRelation SHALL support column ordering based on the order property in DataTableColumns configuration with drag-and-drop reordering in the inspector panel
13. WHEN a TableRelation is selected, THE PrintTemplate_Editor SHALL allow users to show/hide columns through the inspector panel with immediate preview update
14. THE TableRelation SHALL generate table tokens with the format `<table>{{#each items}}<tr><td>{{label "fieldPath"}}</td><td>{{this.value}}</td></tr>{{/each}}</table>` using the unified Label_Helper for consistent structure
15. WHEN a table contains calculated columns, THE Handlebar_Token SHALL support inline expressions (example: `<td>{{multiply this.quantity this.price}}</td>`, `<td>{{subtract this.total this.discount}}</td>`)
16. THE DataTableColumns configuration for relationsTable SHALL be updated to align with the latest application requirements and data structure changes

### Requirement 4: UI/UX Editor Consistency

**User Story:** Sebagai pengguna, saya ingin editor dengan tampilan yang konsisten dengan halaman lain dalam aplikasi, sehingga saya merasa familiar dan nyaman menggunakannya.

#### Acceptance Criteria

1. THE PrintTemplate_Editor SHALL use the same design system components (buttons, inputs, tabs) as other pages in the application
2. THE Sidebar SHALL use consistent spacing, typography, and color scheme matching the application theme
3. THE PrintTemplate_Editor SHALL support dark mode with proper contrast and readability
4. WHEN a user interacts with editor controls, THE PrintTemplate_Editor SHALL provide visual feedback (hover states, active states, loading indicators)
5. THE PrintTemplate_Editor SHALL display clear labels and icons for all tools and actions
6. THE TopBar SHALL contain commonly used actions (save, undo, redo, preview) with keyboard shortcuts displayed in tooltips

### Requirement 5: Mobile Support with Limited Features

**User Story:** Sebagai pengguna mobile, saya ingin dapat mengedit teks dan style template dari perangkat mobile, sehingga saya dapat melakukan perubahan sederhana tanpa membuka laptop.

#### Acceptance Criteria

1. WHEN accessed from a mobile device, THE Mobile_Editor SHALL display a simplified interface optimized for touch interaction
2. THE Mobile_Editor SHALL allow text editing by tapping on text components
3. THE Mobile_Editor SHALL allow basic style changes (font size, color, alignment) through a mobile-friendly style panel
4. THE Mobile_Editor SHALL disable drag & drop functionality for adding new components
5. THE Mobile_Editor SHALL disable structural changes (adding/removing blocks, changing layout)
6. WHEN a user attempts a disabled action on mobile, THE Mobile_Editor SHALL display a message indicating the feature is only available on desktop
7. THE Mobile_Editor SHALL maintain responsive layout that adapts to different mobile screen sizes

### Requirement 6: Static HTML Component with Security

**User Story:** Sebagai pengguna advanced, saya ingin dapat menambahkan komponen HTML kustom untuk kebutuhan khusus, sehingga saya memiliki fleksibilitas lebih dalam desain template.

#### Acceptance Criteria

1. THE PrintTemplate_Editor SHALL provide a Static_HTML_Component block in the blocks panel
2. WHEN a Static_HTML_Component is added, THE PrintTemplate_Editor SHALL display a code editor modal for HTML input
3. THE Sanitizer SHALL remove dangerous tags (script, iframe, object, embed, form) from user-provided HTML
4. THE Sanitizer SHALL remove dangerous attributes (onclick, onerror, onload, javascript:) from all HTML elements
5. THE Sanitizer SHALL allow safe HTML tags (div, span, p, h1-h6, table, tr, td, th, ul, ol, li, a, img, strong, em)
6. THE Sanitizer SHALL allow safe attributes (class, id, style, href, src, alt, title) with proper validation
7. WHEN sanitization removes content, THE PrintTemplate_Editor SHALL display a warning message listing what was removed
8. THE Static_HTML_Component SHALL render the sanitized HTML in THE Canvas with a visual indicator showing it's a custom HTML block

### Requirement 7: Canvas Preview Accuracy

**User Story:** Sebagai pengguna editor, saya ingin tampilan di kanvas hampir sama dengan hasil cetak nyata menggunakan example data dari database, sehingga saya tidak perlu trial-and-error berkali-kali.

#### Acceptance Criteria

1. THE Canvas SHALL render components with example data from the Example_Data_System that represents the actual data structure
2. THE Canvas SHALL display example data values only, not Handlebar tokens, for a cleaner visual appearance
3. WHEN a template uses letterhead, THE Canvas SHALL display the letterhead preview at the top without allowing it to be edited
4. THE Canvas SHALL apply the same CSS styles that will be used in the final print output
5. THE Canvas SHALL display page dimensions matching the configured print template width and unit
6. WHEN fonts are specified in the template, THE Canvas SHALL load and display those fonts accurately
7. THE Canvas SHALL render table borders, spacing, and alignment matching the final output
8. THE Example_Data_System SHALL retrieve example data from database tables using the is_example column marker

### Requirement 8: Example Data Infrastructure

**User Story:** Sebagai sistem, saya perlu mengelola data contoh yang realistis untuk preview template, sehingga pengguna dapat melihat tampilan yang akurat tanpa menggunakan data produksi.

#### Acceptance Criteria

1. THE Example_Data_System SHALL add an is_example column to each relevant database table to identify example data rows
2. THE Database_Seeder SHALL generate realistic example data for each Model in the application
3. WHEN generating example data, THE Database_Seeder SHALL set the is_example column to true for all example rows
4. THE Example_Data_System SHALL provide a method to retrieve example data for any Model by filtering rows where is_example is true
5. THE Example_Data_System SHALL ensure example data includes all necessary relations and nested data structures
6. WHEN example data is used in THE Canvas, THE PrintTemplate_Editor SHALL display it in the same format as real data would appear
7. THE Example_Data_System SHALL support multiple example records per Model to demonstrate different data scenarios
8. WHEN a Model has currency or number fields, THE Database_Seeder SHALL generate realistic values that demonstrate proper formatting
9. THE Example_Data_System SHALL ensure example data for related Models maintains referential integrity
10. THE Database_Seeder SHALL generate example data that covers common use cases and edge cases for each Model

### Requirement 9: Preview Button Feature

**User Story:** Sebagai pengguna editor, saya ingin melihat preview hasil render template dengan data contoh yang sebenarnya, sehingga saya dapat memverifikasi tampilan akhir sebelum menyimpan atau mencetak.

#### Acceptance Criteria

1. THE PrintTemplate_Editor SHALL provide a Preview button in the TopBar
2. WHEN the Preview button is clicked, THE PrintTemplate_Editor SHALL open a Preview_Modal displaying the rendered template
3. THE Preview_Modal SHALL render the template using example data from the Example_Data_System
4. THE Preview_Modal SHALL apply all Handlebar token transformations to show the actual output
5. THE Preview_Modal SHALL display the rendered output in a format matching the final print dimensions
6. THE Preview_Modal SHALL include a Close button to return to the editor
7. WHEN rendering the preview, THE PrintTemplate_Editor SHALL use the same rendering engine that will be used for actual printing
8. THE Preview_Modal SHALL display any rendering errors or missing data warnings to the user
9. WHEN a template contains TableRelation components, THE Preview_Modal SHALL render them with multiple example rows from the Example_Data_System
10. THE Preview_Modal SHALL support printing or exporting the preview as PDF for verification purposes
11. WHEN example data is not available for a Model, THE Preview_Modal SHALL display a clear message indicating missing example data

### Requirement 10: Parser and Serializer for Template Data

**User Story:** Sebagai sistem, saya perlu parse dan serialize data template dengan benar, sehingga template dapat disimpan dan dimuat kembali tanpa kehilangan informasi.

#### Acceptance Criteria

1. WHEN a template is saved, THE Template_Parser SHALL parse the GrapeJS component tree into a JSON structure
2. WHEN a template is loaded, THE Template_Serializer SHALL reconstruct the GrapeJS component tree from the JSON structure
3. THE Template_Pretty_Printer SHALL format the template HTML with proper indentation and line breaks for readability
4. FOR ALL valid template objects, parsing then printing then parsing SHALL produce an equivalent object (round-trip property)
5. THE Template_Parser SHALL preserve all component attributes including data-relations, data-id, and custom properties
6. WHEN a template contains Handlebar tokens, THE Template_Parser SHALL preserve the exact token syntax without modification

### Requirement 11: Relation Tracking and Optimized Loading

**User Story:** Sebagai sistem, saya perlu melacak semua relasi yang digunakan dalam template dan menyimpannya dalam kolom array di database, sehingga saat preview atau print, controller dapat memuat hanya relasi yang diperlukan tanpa over-loading data.

#### Acceptance Criteria

1. THE PrintTemplate_Editor SHALL track all relations used in the Canvas during template editing
2. WHEN a VariableItem with relation type is added to THE Canvas, THE Relation_Tracker SHALL add the relation path to the tracked relations array
3. WHEN a VariableItem with nested relation is added, THE Relation_Tracker SHALL add both the parent relation and nested relation paths (example: "customer", "customer.address")
4. WHEN a TableRelation with relation columns is added, THE Relation_Tracker SHALL add all relation paths from the table columns (example: "items", "items.product", "items.unit")
5. WHEN a relation is accessed through dot notation, THE Relation_Tracker SHALL add the complete relation path (example: "amended_from", "amended_from.customer")
6. THE PrintTemplate Model SHALL have a used_relations column of type JSON to store the array of relation paths
7. WHEN a template is saved, THE Template_Parser SHALL extract all unique relation paths from the template and store them in the used_relations column
8. THE Relation_Tracker SHALL support nested relations up to 3 levels deep (example: "order.customer.address")
9. WHEN loading a template for preview, THE PrintTemplateController SHALL use the used_relations array to eager load only the necessary relations
10. WHEN loading a template for printing, THE PrintTemplateController SHALL use the used_relations array to eager load only the necessary relations
11. THE Relation_Tracker SHALL automatically detect relations from Handlebar tokens including {{relation doc.relationName}}, {{#each relationName}}, and dot notation access
12. WHEN a relation is removed from THE Canvas, THE Relation_Tracker SHALL update the used_relations array to remove unused relation paths
13. THE used_relations array SHALL contain unique relation paths without duplicates
14. WHEN a template has no relations, THE used_relations column SHALL store an empty array
15. THE PrintTemplateController SHALL validate that all relations in used_relations array exist on the model before attempting to load them
