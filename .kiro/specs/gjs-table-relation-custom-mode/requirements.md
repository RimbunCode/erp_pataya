# Requirements Document

## Introduction

This feature adds a Custom Mode to the `gjsRelationsTable` component in the Print Template Editor. Custom Mode provides a dedicated editor for fine-grained control over table header and body layout, including custom row grouping in headers, drag-and-drop variable insertion, static HTML content, and per-component CSS styling. The mode operates with a dedicated VariableItem panel scoped to the selected relation's columns, replacing the standard column management panel.

## Glossary

- **Custom_Mode_Editor**: The dedicated editing interface activated on a gjsRelationsTable component that replaces the standard column management panel with a custom layout editor for header and body sections.
- **gjsRelationsTable**: A GrapesJS component type representing a relation table (e.g., `items`, `payments`) in the Print Template Editor canvas.
- **VariableItem**: A draggable UI element representing a single column from a relation, used for inserting variable tokens into table cells via drag-and-drop or click.
- **Column_Management_Panel**: The existing panel in TokenConfigurationManager that allows toggling column visibility, reordering, and adding/removing columns for a gjsRelationsTable in standard mode.
- **Header_Section**: The `<thead>` portion of the gjsRelationsTable where column headers, grouping, and custom rows are defined.
- **Body_Section**: The `<tbody>` portion of the gjsRelationsTable containing a single template row used for iteration over relation data.
- **Relation_Columns**: The set of columns belonging to the relation bound to a gjsRelationsTable (e.g., columns from the `items` relation), including basic columns and single-relation (nested) columns but excluding many-relations.
- **handleInsert**: The programmatic insertion mechanism that inserts a variable token into the currently selected component on the canvas when a VariableItem is clicked.
- **Static_HTML_Content**: Raw HTML content inserted into a table cell via the StaticHTMLComponent modal editor.
- **Cell_CSS**: Custom CSS styles applied to individual components within a table cell using the GrapesJS style manager.

## Requirements

### Requirement 1: Custom Mode Activation

**User Story:** As a template designer, I want to switch a gjsRelationsTable to Custom Mode, so that I can have full control over the table header and body layout.

#### Acceptance Criteria

1. WHEN a gjsRelationsTable component is selected AND the user triggers the Custom Mode toggle, THE Custom_Mode_Editor SHALL display an alert modal that warns the user that switching to Custom Mode will disable the Column_Management_Panel and that column visibility, ordering, and add/remove operations will no longer be available for that table.
2. WHEN the user clicks the confirm button in the alert modal, THE Custom_Mode_Editor SHALL activate Custom Mode on the selected gjsRelationsTable component and preserve the existing table header and body structure as the initial editable layout.
3. WHEN the user clicks the cancel button or closes the alert modal without confirming, THE Custom_Mode_Editor SHALL keep the gjsRelationsTable in standard mode without any changes to its state or content.
4. WHILE a gjsRelationsTable is in Custom Mode, THE Column_Management_Panel SHALL be hidden for that component and SHALL NOT respond to any column management interactions for that table.
5. WHEN Custom Mode is activated, THE gjsRelationsTable SHALL store a component-level property indicating Custom Mode is active, persisted as part of the GrapesJS project data so that it survives save and page reload.
6. WHEN a gjsRelationsTable with the Custom Mode property set to active is selected, THE Custom_Mode_Editor SHALL display the Custom Mode interface immediately without requiring the user to re-activate or re-confirm.
7. WHEN the user triggers the deactivation of Custom Mode on a gjsRelationsTable currently in Custom Mode, THE Custom_Mode_Editor SHALL display an alert modal warning that reverting to standard mode will discard custom header and body layout and regenerate the table from the Column_Management_Panel configuration.
8. WHEN the user confirms the deactivation alert modal, THE Custom_Mode_Editor SHALL remove the Custom Mode property from the gjsRelationsTable, regenerate the table structure from the current columnsConfig, and re-enable the Column_Management_Panel for that component.

### Requirement 2: Custom Mode Variable Panel

**User Story:** As a template designer, I want to see only the relation-specific columns in the variable panel when editing a Custom Mode table, so that I can insert the correct variables into cells.

#### Acceptance Criteria

1. WHILE a gjsRelationsTable is in Custom Mode and is selected on the canvas, THE Custom_Mode_Editor SHALL display a VariableItem list containing only the Relation_Columns of the bound relation, replacing the default document-level variable list.
2. WHILE a gjsRelationsTable is in Custom Mode and is selected, THE Custom_Mode_Editor SHALL include all columns of type other than "relation" and "relations" (basic columns) from the bound relation in the VariableItem list.
3. WHILE a gjsRelationsTable is in Custom Mode and is selected, THE Custom_Mode_Editor SHALL include columns of type "relation" (single-relation/belongsTo) from the bound relation in the VariableItem list, rendered as expandable items with nested sub-columns.
4. WHILE a gjsRelationsTable is in Custom Mode and is selected, THE Custom_Mode_Editor SHALL exclude columns of type "relations" (many-relation/hasMany/belongsToMany) from the VariableItem list.
5. WHEN the bound relation has fetchable nested columns via the model API (typeRelation is "basic" and a related model exists), THE Custom_Mode_Editor SHALL support lazy-loading of nested columns on expand, consistent with existing VariableItem behavior.
6. WHEN the user deselects the Custom Mode gjsRelationsTable or selects a non-Custom-Mode component, THE Custom_Mode_Editor SHALL revert the variable panel to the default document-level variable list.
7. IF the bound relation has zero displayable columns (no basic or single-relation columns after filtering), THEN THE Custom_Mode_Editor SHALL display an empty-state message indicating no variables are available for the bound relation.

### Requirement 3: Header Customization - Row Management

**User Story:** As a template designer, I want to add custom rows to the table header, so that I can create multi-row headers with grouped columns.

#### Acceptance Criteria

1. WHILE a gjsRelationsTable is in Custom Mode, THE Custom_Mode_Editor SHALL allow adding new rows to the Header_Section up to a maximum of 5 header rows.
2. WHILE a gjsRelationsTable is in Custom Mode, THE Custom_Mode_Editor SHALL allow removing custom rows from the Header_Section, provided at least 1 header row remains.
3. IF the user attempts to remove the last remaining header row, THEN THE Custom_Mode_Editor SHALL prevent the removal and display an error message indicating that at least one header row is required.
4. WHILE a gjsRelationsTable is in Custom Mode, THE Custom_Mode_Editor SHALL allow setting colspan on a header cell with a value between 1 and the total number of columns in that row.
5. WHILE a gjsRelationsTable is in Custom Mode, THE Custom_Mode_Editor SHALL allow setting rowspan on a header cell with a value between 1 and the total number of rows in the Header_Section.
6. IF a colspan or rowspan configuration would cause cells to overlap with other occupied cells in the Header_Section, THEN THE Custom_Mode_Editor SHALL prevent the configuration and display an error message indicating the conflict.

### Requirement 4: Header Customization - Content Insertion

**User Story:** As a template designer, I want to insert variable tokens and static HTML into header cells, so that I can create dynamic and richly formatted column headers.

#### Acceptance Criteria

1. WHILE a gjsRelationsTable is in Custom Mode, THE Custom_Mode_Editor SHALL allow drag-and-drop of VariableItem components into Header_Section cells, rendering the dropped token as a non-editable span element with `data-token` and `data-label-key` attributes visible within the cell.
2. WHILE a gjsRelationsTable is in Custom Mode, WHEN a user clicks a VariableItem in the variable panel while a Header_Section cell is selected, THE Custom_Mode_Editor SHALL insert the corresponding variable token into that Header_Section cell using the handleInsert mechanism, appending the token as a span element within the cell content.
3. WHILE a gjsRelationsTable is in Custom Mode, THE Custom_Mode_Editor SHALL allow inserting Static_HTML_Content into Header_Section cells, replacing or appending to the existing cell content based on the current selection within the cell.
4. WHILE a gjsRelationsTable is in Custom Mode, THE Custom_Mode_Editor SHALL allow applying Cell_CSS via the GrapesJS style manager to each selectable component within a Header_Section cell, and the applied styles SHALL persist in the serialized HTML output produced by toHTML().
5. WHILE a gjsRelationsTable is in Custom Mode, IF a VariableItem is dropped or inserted into a target that is not a Header_Section cell, THEN THE Custom_Mode_Editor SHALL reject the insertion and leave the header content unchanged.
6. WHILE a gjsRelationsTable is in Custom Mode, THE Custom_Mode_Editor SHALL preserve all inserted variable tokens and Static_HTML_Content in Header_Section cells when the component's toHTML() method serializes the template output, rendering variable tokens in their Handlebar syntax (e.g., `{{doc.fieldName}}`).

### Requirement 5: Body Customization - Structure Constraints

**User Story:** As a template designer, I want the body section to enforce a single-row template constraint, so that the iteration logic remains valid for rendering.

#### Acceptance Criteria

1. THE Custom_Mode_Editor SHALL enforce a maximum of one row in the Body_Section.
2. IF the user attempts to add a second row to the Body_Section via any method (toolbar action, context menu, keyboard shortcut, or paste operation containing multiple rows), THEN THE Custom_Mode_Editor SHALL prevent the addition and display an error message indicating that the Body_Section is limited to a single template row.
3. THE Custom_Mode_Editor SHALL prevent column grouping (colspan/rowspan) in the Body_Section.
4. IF the user attempts to apply column grouping in the Body_Section via any method (cell merge action, property panel, or paste operation containing merged cells), THEN THE Custom_Mode_Editor SHALL prevent the operation and display an error message indicating that column grouping is not permitted in the Body_Section.
5. IF the user attempts to delete the existing row in the Body_Section, THEN THE Custom_Mode_Editor SHALL prevent the deletion and display an error message indicating that the Body_Section must contain exactly one template row.

### Requirement 6: Body Customization - Content Insertion

**User Story:** As a template designer, I want to insert variable tokens and static HTML into body cells, so that I can define the template for each iterated row.

#### Acceptance Criteria

1. WHILE a gjsRelationsTable is in Custom Mode, WHEN a VariableItem component is dragged and dropped onto a Body_Section cell, THE Custom_Mode_Editor SHALL insert the variable token into that cell and select the newly inserted component.
2. IF a VariableItem is dropped onto an invalid target within the Body_Section (e.g., a nested subgrid component), THEN THE Custom_Mode_Editor SHALL reject the drop, remove the component, and display an error notification indicating the target is invalid.
3. WHILE a gjsRelationsTable is in Custom Mode, WHEN handleInsert is invoked and a text component within a Body_Section cell is actively being edited, THE Custom_Mode_Editor SHALL insert the VariableItem token inline at the current cursor position within that component.
4. WHILE a gjsRelationsTable is in Custom Mode, WHEN handleInsert is invoked and the selected component is a text component (not in edit mode) within a Body_Section cell, THE Custom_Mode_Editor SHALL append the VariableItem token as a span child of the selected component.
5. WHILE a gjsRelationsTable is in Custom Mode, THE Custom_Mode_Editor SHALL allow inserting Static_HTML_Content into Body_Section cells via the modal HTML editor, replacing the cell's existing content with the provided raw HTML.
6. WHILE a gjsRelationsTable is in Custom Mode, WHEN a component within a Body_Section cell is selected, THE Custom_Mode_Editor SHALL allow applying Cell_CSS to that component via the GrapesJS style manager, with the applied styles rendered immediately on the canvas.

### Requirement 7: Custom Mode HTML Serialization

**User Story:** As a template designer, I want the Custom Mode table to serialize correctly to Handlebar tokens, so that the template renders properly with real data.

#### Acceptance Criteria

1. WHEN a Custom Mode gjsRelationsTable is serialized via toHTML, THE gjsRelationsTable SHALL output each custom header row as defined by the user, rendering variable cells as `{{label "<labelRelationPrefix>.<columnName>"}}` tokens where `<labelRelationPrefix>` is the relation path prefixed with `doc.` (e.g., `doc.items`), and rendering cells without variable tokens as their literal content.
2. WHEN a Custom Mode gjsRelationsTable is serialized via toHTML, THE gjsRelationsTable SHALL place `{{#each doc.<relationName>}}` immediately before the body `<tr>` element and `{{/each}}` immediately after the closing `</tr>`, both as direct children of `<tbody>`.
3. WHEN a Custom Mode gjsRelationsTable is serialized via toHTML, THE gjsRelationsTable SHALL output body cell tokens using `{{this.<columnName>}}` for basic columns and `{{relation this.<columnName>}}` for relation columns.
4. WHEN a Custom Mode gjsRelationsTable contains Static_HTML_Content in cells, THE gjsRelationsTable SHALL output the static HTML verbatim in the serialized output at the same position within the cell's DOM order.
5. WHEN a Custom Mode gjsRelationsTable contains Cell_CSS, THE gjsRelationsTable SHALL serialize the custom styles as inline `style` attributes on the respective cell or component elements in the HTML output.
6. WHEN a Custom Mode gjsRelationsTable header uses colspan or rowspan, THE gjsRelationsTable SHALL preserve those attributes in the serialized `<th>` elements of the HTML output.
7. WHEN a Custom Mode gjsRelationsTable cell contains both variable tokens and Static_HTML_Content, THE gjsRelationsTable SHALL serialize all content in DOM order as it appears in the cell's component tree.

### Requirement 8: Custom Mode Persistence

**User Story:** As a template designer, I want my Custom Mode configuration to persist across save and reload, so that I do not lose my custom layout work.

#### Acceptance Criteria

1. WHEN the template is saved, THE gjsRelationsTable SHALL persist the Custom Mode flag as a component attribute and the custom layout structure (header rows, body row, cell contents, cell styles, and variable tokens) as child components within the GrapesJS project data JSON.
2. WHEN the template is loaded and the gjsRelationsTable component contains a Custom Mode flag set to true, THE gjsRelationsTable SHALL restore the full custom layout in the canvas such that the rendered table structure, cell contents, and applied styles match the state at the time of the last save.
3. WHEN a Custom Mode gjsRelationsTable is loaded, THE Custom_Mode_Editor SHALL restore the dedicated VariableItem panel scoped to the relation identified by the component's `data-relations` attribute, and SHALL suppress the standard column management panel.
4. IF a Custom Mode gjsRelationsTable is loaded but its custom layout child components are missing or cannot be parsed, THEN THE gjsRelationsTable SHALL fall back to rendering an empty table structure with the Custom Mode flag preserved, and SHALL display an error message indicating the layout could not be restored.
