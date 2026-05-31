# Requirements Document

## Introduction

This feature improves how variable labels are resolved in the GrapeJS-based Print Template Editor canvas during sync (editor load). Currently, `buildLabelMap()` in `variableDropUtils.js` only uses `dataTableColumns` to resolve labels, but `dataTableColumns` doesn't always contain nested columns due to lazy loading. The backend already provides a `columns` prop (from `RelationTrackerService::validateRelations()` with `withColumns: true`) that contains columns keyed by model class for all models used by the template. This feature introduces `columns` (modelColumns) as the primary label resolution source during sync, while preserving `dataTableColumns` for drag/drop operations.

## Glossary

- **Editor**: The GrapeJS-based Print Template Editor canvas page
- **Sync**: The process of updating component display labels when the editor loads (via `syncVariableComponentDisplay` and `syncRelationsTableHeaders`)
- **Drop**: The drag-and-drop operation from the VariableManager panel onto the canvas
- **modelColumns**: The `columns` prop object keyed by model class (e.g., `"App\\Models\\Sales\\SalesOrder"`) containing column definitions for all models used by the template, provided by `RelationTrackerService::validateRelations()`
- **dataTableColumns**: The flat array of column definitions used by the VariableManager panel for drag-and-drop, which may not contain nested/lazy-loaded columns
- **titleTrans**: A translation key attribute stored on GrapeJS components (`gjsSubGrid`, `gjsRelationsTable`) that serves as a fallback label source and gets updated during sync
- **resolveLabel**: The function in `variableTokenUtils.js` that resolves a dot-notation path to a display label using the modelColumns structure
- **modelDoc**: The root model class string (e.g., `"App\\Models\\Sales\\SalesOrder"`) identifying the document model for the current template
- **variableDropListener**: The function in `variableDropUtils.js` that registers all drag-drop handlers and sync logic on the GrapeJS editor instance

## Requirements

### Requirement 1: Pass modelColumns and modelDoc to variableDropListener

**User Story:** As a developer, I want `variableDropListener` to receive the `columns` prop and `modelDoc` string, so that sync functions can use modelColumns for label resolution.

#### Acceptance Criteria

1. THE variableDropListener function SHALL accept `columns` (modelColumns object, keyed by model class string) and `modelDoc` (root model class string) as additional properties in its options parameter alongside the existing `t`, `locale`, `dataTableColumns`, and `docInfo` properties
2. WHEN the Editor page initializes the GrapeJS editor, THE Editor SHALL pass the `columns` prop (received as an Inertia page prop) and `printTemplate.model` as `modelDoc` to the variableDropListener options object
3. THE Editor SHALL continue passing `dataTableColumns` and `docInfo` to variableDropListener without modification to their values or structure
4. IF the `columns` prop is undefined or null at the time of the variableDropListener call, THEN THE variableDropListener SHALL initialize without error and internal sync functions SHALL skip modelColumns-based label resolution
5. IF `printTemplate.model` is undefined or null at the time of the variableDropListener call, THEN THE variableDropListener SHALL initialize without error and pass null as `modelDoc` to downstream sync functions

### Requirement 2: Resolve labels from modelColumns during sync of single-variable components

**User Story:** As a template editor user, I want variable labels on the canvas to display correctly after editor load, so that I can see accurate translated labels even for nested/lazy-loaded columns.

#### Acceptance Criteria

1. WHEN `syncVariableComponentDisplay` processes a `gjsSubGrid` component, THE Sync_Logic SHALL call `resolveLabel(labelKey, columns, modelDoc, t)` where `labelKey` is the `data-label-key` attribute value from the component's label child element, before attempting any fallback resolution
2. WHEN `resolveLabel` returns a value that differs from the `labelKey` input, THE Sync_Logic SHALL update the content of the `[data-label-key]` span element within the component to display the resolved label
3. WHEN `resolveLabel` returns a value that differs from the `labelKey` input, THE Sync_Logic SHALL update the `titleTrans` attribute on the `gjsSubGrid` component with the `titleTrans` property from the leaf column found during path traversal in modelColumns
4. WHEN `resolveLabel` fails to resolve a label (returns the `labelKey` unchanged or throws an error) AND the component has a non-empty `titleTrans` attribute, THE Sync_Logic SHALL display `t(titleTrans)` as the label, where `t()` is the i18n translation function
5. WHEN `resolveLabel` fails AND no `titleTrans` attribute exists on the component (null, undefined, or empty string), THE Sync_Logic SHALL fall back to resolving the label from the `buildLabelMap()` lookup using `dataTableColumns`, matching against the `data-label-key` value and then the `data-variable` attribute value
6. WHEN `resolveLabel` fails AND `titleTrans` exists but `t(titleTrans)` returns the translation key unchanged (no translation found), THE Sync_Logic SHALL treat the translated key as the display label without falling back to `buildLabelMap()`

### Requirement 3: Resolve labels from modelColumns during sync of relations table headers

**User Story:** As a template editor user, I want relations table column headers to display correctly after editor load, so that table headers show accurate translated labels for all columns including nested ones.

#### Acceptance Criteria

1. WHEN `syncRelationsTableHeaders` processes header cells of a `gjsRelationsTable` that have a `data-label-key` attribute, THE Sync_Logic SHALL attempt to resolve each column label using `resolveLabel(labelKey, columns, modelDoc, t)` where `labelKey` is the value of the cell's `data-label-key` attribute
2. WHEN `resolveLabel` returns a value that differs from the input `labelKey`, THE Sync_Logic SHALL update the header cell content with the resolved label
3. WHEN `resolveLabel` returns a value that differs from the input `labelKey`, THE Sync_Logic SHALL update the `titleTrans` attribute on the header cell component with the `titleTrans` value from the matching column definition in modelColumns
4. WHEN `resolveLabel` returns a value equal to the input `labelKey` (indicating resolution failure), THE Sync_Logic SHALL translate the existing `titleTrans` attribute stored on the header cell component using `t()` and use the translated value as the display label
5. WHEN `resolveLabel` returns a value equal to the input `labelKey` AND no `titleTrans` attribute exists on the header cell, THE Sync_Logic SHALL fall back to the existing `buildLabelMap()` lookup by `data-label-key`, then to `getColumnLabel()` using the cell's `columnsConfig` entry matched by `name` attribute
6. WHEN a header cell does not have a `data-label-key` attribute, THE Sync_Logic SHALL skip that cell without attempting label resolution

### Requirement 4: Preserve titleTrans attribute on components

**User Story:** As a developer, I want `titleTrans` to be preserved as an attribute on `gjsSubGrid` and `gjsRelationsTable` components, so that it serves as a reliable fallback when modelColumns data is unavailable.

#### Acceptance Criteria

1. THE gjsSubGrid component type SHALL include `titleTrans` in its serialized attributes so that the value persists across editor save/load cycles without requiring re-resolution from modelColumns
2. THE gjsRelationsTable header cell (`<th>`) components SHALL include `titleTrans` in their serialized attributes so that the value persists across editor save/load cycles without requiring re-resolution from modelColumns
3. WHEN a variable is dropped onto the canvas (during drop/insert) and the dropped variable's column definition contains a non-empty `titleTrans` property, THE Drop_Handler SHALL store that `titleTrans` value as an attribute on the created component
4. IF a variable is dropped onto the canvas and the dropped variable's column definition does not contain a `titleTrans` property (null, undefined, or empty string), THEN THE Drop_Handler SHALL omit the `titleTrans` attribute from the created component without blocking the drop operation
5. WHEN sync updates a component label successfully from modelColumns, THE Sync_Logic SHALL write the `titleTrans` property value from the matched column in modelColumns back to the component attribute, overwriting any previously stored value

### Requirement 5: No changes to drop/insert behavior

**User Story:** As a template editor user, I want drag-and-drop from the VariableManager panel to continue working as before, so that existing drop functionality is not disrupted.

#### Acceptance Criteria

1. WHEN a variable is dragged from the VariableManager panel and dropped onto the canvas, THE Drop_Handler SHALL resolve the display label from the drag payload's `displayLabel` property (sourced from `dataTableColumns` in the VariableManager panel), falling back to `payload.name` if `displayLabel` is absent
2. THE Drop_Handler SHALL NOT reference or invoke `resolveLabel` or the modelColumns (`columns` prop) for label resolution during drop operations
3. WHEN a relations-type variable is dragged from the VariableManager panel and dropped onto the canvas, THE Drop_Handler SHALL build the relations table using column definitions from the drag payload's `columns` array (sourced from `dataTableColumns`) without referencing modelColumns
4. THE variableDropListener `canvas:dragdata` event handler SHALL continue to read variable data exclusively from the `dataTransfer` payload (via `variable/json` or `text/plain` MIME types) and SHALL NOT call `buildLabelMap()` or `resolveLabel` during the drop operation

### Requirement 6: resolveLabel function robustness

**User Story:** As a developer, I want `resolveLabel` to handle edge cases gracefully, so that the sync process does not break when encountering unexpected data.

#### Acceptance Criteria

1. IF `columns` parameter is null or undefined, THEN THE resolveLabel function SHALL return the original path string without throwing an error
2. IF a model key derived from `modelDoc` does not exist in the `columns` object, OR a column entry within a model does not exist for a path segment, THEN THE resolveLabel function SHALL return the original path string without throwing an error
3. IF a column in the path traversal has a null or undefined `type` property, THEN THE resolveLabel function SHALL return the best available label using the priority order: `col.title` → `t(col.titleTrans)` → `col.name`, without throwing an error
4. IF `modelDoc` parameter is null or undefined and the path starts with "doc.", OR if the model key derived from `modelDoc` does not exist in `columns`, THEN THE resolveLabel function SHALL return the original path string without throwing an error
5. IF a column exists in the path traversal but ALL label properties (`title`, `titleTrans`, `name`) are null or undefined, THEN THE resolveLabel function SHALL return the original path string without throwing an error
