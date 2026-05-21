# Implementation Plan: Print Template Editor Enhancement

## Overview

This implementation plan converts the print template editor enhancement design into actionable coding tasks. The feature enhances the GrapeJS-based print template editor with improved drag & drop functionality, example data preview, unified label helpers, relation tracking for optimized loading, mobile support, and security features.

## Tasks

- [x] 1. Database infrastructure and migrations
  - [x] 1.1 Create migration to add `used_relations` column to `print_templates` table
    - Add JSON column `used_relations` after `template` column
    - Set nullable and default to null
    - _Requirements: 11.6_

  - [x] 1.2 Create migration to add `is_example` column to relevant model tables
    - Add boolean column `is_example` with default false
    - Add index on `is_example` column for query performance
    - **IMPORTANT CONSTRAINT**: Only apply to models that use the DataTable trait (not all models).
    - add column using `initPermissions()`, check is existing, if not then add column, if already then nothing action
    - Apply to all models used in print templates (invoices, customers, products, orders, etc.)
    - _Requirements: 8.1_

  - [x] 1.3 Update PrintTemplate model with new casts and methods
    - Add `used_relations` to casts array as 'array'
    - Implement `getUsedRelations()` method
    - Implement `setUsedRelationsFromTemplate()` method
    - _Requirements: 11.6, 11.7_

- [x] 2. Backend services - Core infrastructure
  - [x] 2.1 Create HasExampleData trait
    - Implement `scopeExampleData()` method for query filtering
    - Implement `isExampleData()` method
    - Implement `markAsExample()` method
    - _Requirements: 8.1_

  - [x] 2.2 Create RelationTrackerService
    - Implement `extractRelations()` method to scan template for relation paths
    - Implement `extractRelationsFromHTML()` method
    - Implement `parseHandlebarTokens()` protected method for token parsing
    - Implement `normalizeRelations()` method to remove duplicates and sort
    - Implement `validateRelations()` method to check relations exist on model
    - Implement `getRelationDepth()` protected method
    - Support patterns: `{{relation doc.relationName}}`, `{{#each relationName}}`, dot notation
    - Handle nested relations up to 3 levels deep
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.8, 11.11, 11.12_

  - [x] 2.3 Create ExampleDataService
    - Implement `getExampleData()` method to query models with `is_example = true`
    - Implement `getExampleDataWithRelations()` method with eager loading from relations array
    - Implement `getExampleDataForTemplate()` method using template's used_relations
    - Implement `hasExampleData()` method
    - Implement `generateExampleData()` method
    - Add caching for performance
    - Validate relations exist before loading
    - _Requirements: 8.4, 8.5, 8.6, 9.3, 11.9_

  - [x] 2.4 Create LabelHelperService
    - Implement `getLabel()` method to retrieve field labels from DataTableColumns config
    - Implement `getLabels()` method for multiple fields
    - Implement `resolveFieldPath()` protected method for nested paths
    - Support locale parameter for translations
    - _Requirements: 2.9, 2.10_

- [x] 3. Backend services - Template processing
  - [x] 3.1 Enhance TemplateParserService
    - Inject RelationTrackerService in constructor
    - Implement `parse()` method for GrapeJS components to JSON
    - Implement `extractTokens()` method
    - Implement `validate()` method for template structure
    - Implement `extractRelations()` method using RelationTrackerService
    - Implement `parseWithRelations()` method returning template and used_relations
    - Preserve all component attributes including data-\* attributes
    - _Requirements: 10.1, 10.5, 11.7_

  - [x] 3.2 Create TemplateSerializerService
    - Implement `serialize()` method to reconstruct GrapeJS components from JSON
    - Implement `prettyPrint()` method for HTML formatting with indentation
    - Implement `toHTML()` method to generate HTML from template
    - Implement `toCSS()` method to generate CSS from template
    - _Requirements: 10.2, 10.3_

  - [x] 3.3 Create HTMLSanitizerService and SanitizationResult class
    - Implement `sanitize()` method returning SanitizationResult
    - Implement `isSafe()` method
    - Implement `getRemovedElements()` method
    - Use whitelist approach for allowed tags (div, span, p, h1-h6, table, tr, td, th, ul, ol, li, a, img, strong, em, br)
    - Use whitelist for allowed attributes (class, id, style, href, src, alt, title)
    - Block dangerous tags (script, iframe, object, embed, form, input, button)
    - Block dangerous attributes (onclick, onerror, onload, on\*, javascript:)
    - Validate URLs in href and src attributes
    - _Requirements: 6.3, 6.4, 6.5, 6.6_

- [x] 4. Backend controllers and API endpoints
  - [x] 4.1 Enhance PrintTemplateController editor endpoint
    - Update GET `/settings/printTemplates/{id}/editor` to include example data
    - Use ExampleDataService to get example data with relations
    - Return printTemplate, dataTableColumns, exampleData, preferences
    - _Requirements: 7.1, 7.8, 9.3_

  - [x] 4.2 Enhance PrintTemplateController store/update methods
    - Extract relations using TemplateParserService on save
    - Store used_relations array in database
    - Return used_relations in response
    - _Requirements: 11.7, 11.13_

  - [x] 4.3 Create preview endpoint in PrintTemplateController
    - Implement POST `/settings/printTemplates/{id}/preview`
    - Accept template object in request
    - Use ExampleDataService to get example data with relations from template
    - Compile template with Handlebar engine
    - Return rendered HTML, CSS, and warnings
    - _Requirements: 9.2, 9.3, 9.4, 9.7, 9.9_

  - [x] 4.4 Create HTML sanitization API endpoint
    - Implement POST `/api/html/sanitize`
    - Accept HTML string in request
    - Use HTMLSanitizerService to sanitize
    - Return sanitizedHTML, warnings, removedTags, removedAttributes
    - _Requirements: 6.3, 6.7_

  - [x] 4.5 Update PrintTemplateController for optimized relation loading
    - Modify preview/print methods to use used_relations array for eager loading
    - Validate relations exist before loading
    - _Requirements: 11.9, 11.10, 11.15_

- [x] 5. Database seeders for example data
  - [x] 5.1 Create ExampleDataSeeder
    - Generate realistic example data for each Model used in print templates
    - Set `is_example = true` for all generated records
    - Include all necessary relations and nested data structures
    - Generate realistic currency and number values demonstrating formatting
    - Maintain referential integrity for related models
    - Cover common use cases and edge cases
    - Support multiple example records per Model
    - _Requirements: 8.2, 8.3, 8.7, 8.8, 8.9, 8.10_

- [x] 6. Checkpoint - Backend infrastructure complete
  - Ensure all migrations run successfully
  - Ensure all backend tests pass
  - Verify example data seeder generates data correctly
  - Ask the user if questions arise

- [x] 7. Frontend - Handlebar helpers and utilities
  - [x] 7.1 Enhance initHandlebar.js with unified label helper
    - Register `label` helper for field label retrieval from DataTableColumns
    - Replace separate `infoColumns` and `trans` helpers with unified `label` helper
    - Support locale parameter
    - _Requirements: 2.9, 2.10, 3.4_

  - [x] 7.2 Enhance initHandlebar.js with formatting helpers
    - Register `formatDate` helper with format parameter
    - Register `formatCurrency` helper with currency parameter
    - Register `formatNumber` helper with decimals parameter
    - Register `uppercase` helper
    - Validate parameter types and provide error messages
    - _Requirements: 2.11, 2.12_

  - [x] 7.3 Create htmlSanitizer.js utility
    - Implement client-side HTML sanitization matching backend rules
    - Call backend `/api/html/sanitize` endpoint for validation
    - Return sanitized HTML and warnings
    - _Requirements: 6.3, 6.4, 6.5, 6.6_

- [x] 8. Frontend - Enhanced VariableItem component
  - [x] 8.1 Enhance VariableItem component with example data support
    - Update component to display example data values in canvas instead of Handlebar tokens
    - Show Handlebar token in tooltip on hover
    - Support labelLang and value configuration from DataTableColumns
    - Create formatted component with label and example data value on drop
    - Display in grid layout with label on left and example value on right
    - _Requirements: 1.1, 1.2, 1.4, 1.5, 1.6, 1.7_

  - [x] 8.2 Add relation support to VariableItem component
    - Support nestedColumns structure for single relations
    - Support relationsTable structure for many relations
    - Implement collapsible behavior for nested columns
    - Lazy load relation columns via API
    - _Requirements: 1.10, 1.11_

  - [x] 8.3 Add formatting support to VariableItem component
    - Apply currency formatting from DataTableColumns configuration
    - Apply number formatting from DataTableColumns configuration
    - _Requirements: 1.9_

- [x] 9. Frontend - Enhanced TableRelation component
  - [x] 9.1 Enhance TableRelation component with example data preview
    - Render table with header and example data rows from ExampleDataService
    - Display example data values in cells, not Handlebar tokens
    - Use unified label helper for column headers
    - Generate proper Handlebar tokens with `{{#each}}` iteration
    - Support `{{relation columnName}}` syntax for relation columns
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

  - [x] 9.2 Add nested relation support to TableRelation component
    - Support nestedColumns for single relations within table cells
    - Support relationsTable structure for many relations
    - _Requirements: 3.8, 3.9_

  - [x] 9.3 Add formatting and styling to TableRelation component
    - Apply currency/number formatting from DataTableColumns configuration
    - Add proper styling with borders, padding, alternating row colors
    - _Requirements: 3.10, 3.11_

  - [x] 9.4 Add column management to TableRelation component
    - Support column ordering based on order property in DataTableColumns
    - Implement drag-and-drop reordering in inspector panel
    - Allow show/hide columns through inspector panel with immediate preview update
    - Support calculated columns with inline expressions
    - _Requirements: 3.12, 3.13, 3.15_

  - [x] 9.5 Update gjsRelationsTable.js with enhanced token generation
    - Update to use unified label helper for consistent structure
    - Generate tokens in format: `<table>{{#each items}}<tr><td>{{label "fieldPath"}}</td><td>{{this.value}}</td></tr>{{/each}}</table>`
    - _Requirements: 3.14_

  - [x] 9.6 Update DataTableColumns configuration for relationsTable
    - Review and update configuration to align with latest application requirements
    - Ensure data structure changes are reflected
    - _Requirements: 3.16_

- [x] 10. Frontend - New StaticHTMLComponent
  - [x] 10.1 Create StaticHTMLComponent with code editor
    - Create component with code editor modal for HTML input
    - Implement real-time sanitization preview
    - Display warnings for removed content
    - Add visual indicator in canvas for custom HTML blocks
    - Call htmlSanitizer utility for validation
    - _Requirements: 6.1, 6.2, 6.7, 6.8_

  - [x] 10.2 Add StaticHTMLInspector to Sidebar
    - Create inspector panel for StaticHTMLComponent
    - Allow editing HTML through inspector
    - Show sanitization warnings
    - _Requirements: 6.1, 6.2_

- [x] 11. Frontend - PreviewModal component
  - [x] 11.1 Create PreviewModal component
    - Create full-screen modal for rendered template display
    - Fetch example data from backend using template's used_relations
    - Compile template with Handlebar engine
    - Display rendered output matching final print dimensions
    - Show rendering errors and warnings
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.8_

  - [x] 11.2 Add preview controls to PreviewModal
    - Add Close button to return to editor
    - Add Print button
    - Add Export PDF button
    - _Requirements: 9.6, 9.10_

  - [x] 11.3 Add table relation support to PreviewModal
    - Render TableRelation components with multiple example rows
    - _Requirements: 9.9_

  - [x] 11.4 Add missing data handling to PreviewModal
    - Display clear message when example data is not available
    - _Requirements: 9.11_

- [x] 12. Frontend - Sidebar enhancements
  - [x] 12.1 Create VariableManager component for Sidebar
    - Display list of available variables from DataTableColumns
    - Show Handlebar token configuration for selected VariableItem
    - Update token configuration when VariableItem is selected on canvas
    - _Requirements: 1.3, 1.8_

  - [x] 12.2 Update Sidebar to manage Handlebar tokens
    - Display Handlebar token configuration for each component
    - Allow editing token configuration through Sidebar
    - _Requirements: 1.3, 1.8, 3.3_

- [x] 13. Frontend - TopBar enhancements
  - [x] 13.1 Add Preview button to TopBar
    - Add Preview button with icon
    - Open PreviewModal on click
    - Display keyboard shortcut in tooltip
    - _Requirements: 4.6, 9.1_

  - [x] 13.2 Ensure TopBar has consistent actions
    - Verify save, undo, redo actions are present
    - Add keyboard shortcuts to tooltips
    - _Requirements: 4.6_

- [x] 14. Frontend - UI/UX consistency
  - [x] 14.1 Apply design system components to editor
    - Use same buttons, inputs, tabs as other pages
    - Apply consistent spacing, typography, color scheme
    - _Requirements: 4.1, 4.2_

  - [x] 14.2 Add dark mode support to editor
    - Implement dark mode with proper contrast
    - Ensure readability in dark mode
    - _Requirements: 4.3_

  - [x] 14.3 Add visual feedback to editor controls
    - Implement hover states for all interactive elements
    - Implement active states
    - Add loading indicators for async operations
    - _Requirements: 4.4_

  - [x] 14.4 Add clear labels and icons to editor
    - Ensure all tools have clear labels
    - Add appropriate icons for actions
    - _Requirements: 4.5_

- [x] 15. Frontend - Canvas preview accuracy
  - [x] 15.1 Enhance Canvas to display example data
    - Render components with example data from ExampleDataService
    - Display example data values only, not Handlebar tokens
    - _Requirements: 7.1, 7.2_

  - [x] 15.2 Add letterhead support to Canvas
    - Display letterhead preview at top when template uses letterhead
    - Prevent letterhead from being edited
    - _Requirements: 7.3_

  - [x] 15.3 Ensure Canvas matches print output styling
    - Apply same CSS styles as final print output
    - Display page dimensions matching configured print template
    - Load and display specified fonts accurately
    - Render table borders, spacing, alignment matching final output
    - _Requirements: 7.4, 7.5, 7.6, 7.7_

- [x] 16. Frontend - MobileEditor component
  - [x] 16.1 Create MobileEditor component with simplified interface
    - Create touch-optimized interface for mobile devices (< 768px)
    - Allow text editing by tapping components
    - Create basic style panel for font size, color, alignment
    - _Requirements: 5.1, 5.2, 5.3_

  - [x] 16.2 Disable advanced features on mobile
    - Disable drag & drop functionality
    - Disable structural changes (adding/removing blocks, changing layout)
    - Display informative messages for desktop-only features
    - _Requirements: 5.4, 5.5, 5.6_

  - [x] 16.3 Ensure responsive layout for mobile
    - Adapt layout to different mobile screen sizes
    - Optimize for tablet (768px - 1024px) with touch optimization
    - _Requirements: 5.7_

- [x] 17. Frontend - Handlebar token structure improvements
  - [x] 17.1 Implement consistent token formatting
    - Generate tokens with consistent formatting and indentation
    - Use `{{doc.variableName}}` for simple variables
    - Use `{{relation relationName}}` for relation variables
    - Use `{{company.variableName}}` for preferences with proper escaping
    - Use dot notation for nested objects
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [x] 17.2 Implement array iteration and conditional tokens
    - Support `{{#each arrayName}}` and `{{/each}}` blocks with proper indentation
    - Support `{{#if condition}}` and `{{/if}}` blocks
    - Support `{{#unless condition}}` and `{{/unless}}` blocks
    - _Requirements: 2.6, 2.7, 2.8_

  - [x] 17.3 Add token validation
    - Validate Handlebar token syntax before saving template
    - Display specific error messages for malformed tokens
    - Validate parameter types for helper functions
    - _Requirements: 2.12, 2.13_

  - [x] 17.4 Ensure proper nesting and formatting
    - Maintain proper nesting structure with correct indentation
    - Use formatting settings from DataTableColumns for currency/number variables
    - _Requirements: 2.14, 2.15_

- [x] 18. Frontend - Error handling
  - [x] 18.1 Add drag & drop error handling
    - Handle invalid drop targets
    - Handle incompatible component types
    - Display error toasts for failed operations
    - _Requirements: 1.5_

  - [x] 18.2 Add template loading error handling
    - Handle corrupted template data
    - Handle network failures
    - Implement retry logic or fallback to empty template
    - _Requirements: 7.1_

  - [x] 18.3 Add sanitization warning dialogs
    - Show warning dialog when dangerous content is removed
    - List removed elements and attributes
    - _Requirements: 6.7_

  - [x] 18.4 Add example data missing handling
    - Show info dialog when example data is not available
    - Provide option to generate example data
    - _Requirements: 7.8, 9.11_

  - [x] 18.5 Add Handlebar compilation error handling
    - Catch and display Handlebar syntax errors
    - Highlight problematic tokens in editor
    - _Requirements: 2.13, 9.8_

- [x] 19. Integration and wiring
  - [x] 19.1 Wire backend services to controllers
    - Inject services into PrintTemplateController
    - Connect ExampleDataService to editor and preview endpoints
    - Connect RelationTrackerService to save operations
    - _Requirements: 8.4, 11.7, 11.9_

  - [x] 19.2 Wire frontend components to editor
    - Integrate VariableItem, TableRelation, StaticHTMLComponent into editor
    - Connect Sidebar components to canvas
    - Connect TopBar actions to editor state
    - _Requirements: 1.1, 3.1, 6.1_

  - [x] 19.3 Connect frontend to backend APIs
    - Wire editor to load template with example data
    - Wire save operation to extract and store relations
    - Wire preview button to preview endpoint
    - Wire HTML sanitization to sanitize endpoint
    - _Requirements: 7.1, 9.2, 11.7_

  - [x] 19.4 Integrate MobileEditor with responsive detection
    - Detect mobile devices and render MobileEditor
    - Ensure smooth transition between mobile and desktop views
    - _Requirements: 5.1_

- [ ] 20. Final checkpoint and testing
  - Run all backend tests to ensure services work correctly
  - Run frontend build to ensure no compilation errors
  - Test drag & drop functionality with example data
  - Test preview modal with various templates
  - Test mobile editor on different screen sizes
  - Test HTML sanitization with dangerous content
  - Verify relation tracking and optimized loading
  - Ensure all tests pass, ask the user if questions arise

- [ ] 21. Compose Commit All Changes
  - buat commit message yang relevan dan sesuai standar (mis. feat:..., fix:...)
  - pecah commit sesuai changes yang relevan

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Backend services should be completed before frontend components that depend on them
- Example data infrastructure is critical for preview functionality
- Relation tracking must be implemented before optimized loading can work
- Mobile editor is a separate component with limited features
- Security (HTML sanitization) is a high priority and should not be skipped

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["1.3", "2.1"] },
    { "id": 2, "tasks": ["2.2", "2.3", "2.4"] },
    { "id": 3, "tasks": ["3.1", "3.2", "3.3"] },
    { "id": 4, "tasks": ["4.1", "4.2", "4.3", "4.4"] },
    { "id": 5, "tasks": ["4.5", "5.1"] },
    { "id": 6, "tasks": ["7.1", "7.2", "7.3"] },
    { "id": 7, "tasks": ["8.1", "8.2", "8.3", "9.1", "9.2"] },
    { "id": 8, "tasks": ["9.3", "9.4", "9.5", "9.6", "10.1"] },
    { "id": 9, "tasks": ["10.2", "11.1", "12.1"] },
    { "id": 10, "tasks": ["11.2", "11.3", "11.4", "12.2", "13.1"] },
    { "id": 11, "tasks": ["13.2", "14.1", "14.2", "14.3", "14.4"] },
    { "id": 12, "tasks": ["15.1", "15.2", "15.3", "16.1"] },
    { "id": 13, "tasks": ["16.2", "16.3", "17.1", "17.2"] },
    { "id": 14, "tasks": ["17.3", "17.4", "18.1", "18.2"] },
    { "id": 15, "tasks": ["18.3", "18.4", "18.5"] },
    { "id": 16, "tasks": ["19.1", "19.2", "19.3", "19.4"] },
    { "id": 17, "tasks": ["20"] },
    { "id": 18, "tasks": ["21"] }
  ]
}
```
