/**
 * Token Configuration Helper Utilities
 * Provides tree-building, filtering, and formatting functions for the
 * TokenConfigurationManager's NestedSelect components.
 * @module tokenConfigHelpers
 */

/**
 * Build a tree-structured options array from flat `dataTableColumns` for use
 * with the NestedSelect component.
 * Each node in the output has:
 * - `label`: display text (from titleTrans, title, or name)
 * - `value`: dot-notation path identifier
 * - `type`: the column type (data, preferences, relation, relations, etc.)
 * - `children`: recursively built sub-options (empty array if leaf node)
 * Top-level groups (type "data", "preferences") are treated as category
 * containers — their own children are promoted with paths relative to the
 * group. Relation/relations nodes build paths using dot-notation nesting.
 * @param {Array} columns - The dataTableColumns array (top-level or nested)
 * @param {string} path - Current dot-notation path prefix
 * @param {string} parentType - The inherited type from the parent node
 * @returns {Array} Tree-structured options compatible with NestedSelect
 */
export function buildTreeOptions(columns, path = "", parentType = "data") {
  if (!Array.isArray(columns) || columns.length === 0) {
    return [];
  }

  const options = [];

  for (const column of columns) {
    if (!column || typeof column !== "object") {
      continue;
    }

    const name = column.name || "";
    const columnType = column.type || "";

    // Determine the effective type for this node.
    // Relation types ("relation", "relations") are preserved as-is.
    // Other types inherit from the parent context.
    const isRelationType =
      columnType === "relation" || columnType === "relations";
    const type = isRelationType ? columnType : parentType || "data";

    // Top-level category containers (data, preferences) — promote their children
    // directly without creating a path segment for the container itself.
    if (
      (columnType === "data" || columnType === "preferences") &&
      path === "" &&
      Array.isArray(column.columns) &&
      column.columns.length > 0
    ) {
      const children = buildTreeOptions(column.columns, "", columnType);
      options.push(...children);
      continue;
    }

    // Skip columns without a name (can't build a meaningful path)
    if (!name) {
      continue;
    }

    // Build the full dot-notation path for this node
    const fullPath = path ? `${path}.${name}` : name;

    // Determine the display label: prefer title, fallback to name
    const label = column.title || column.titleTrans || name;

    // Recursively build children from nested columns.
    // Children of relation/relations nodes inherit that type context.
    const childParentType = isRelationType ? columnType : type;
    const children =
      Array.isArray(column.columns) && column.columns.length > 0
        ? buildTreeOptions(column.columns, fullPath, childParentType)
        : [];

    options.push({
      label,
      value: fullPath,
      type,
      children,
    });
  }

  return options;
}

/**
 * Format a token option's label for display in the NestedSelect dropdown.
 * Produces `{{field_name}}` format without path prefixes or arrow separators.
 * Extracts the last segment of a dot-notation path for display.
 * @param {object} option - A tree option node with `value` (dot-notation path) and `label`
 * @returns {string} Formatted token label, e.g., "{{date}}", "{{code}}"
 */
export function formatTokenLabel(option) {
  if (!option || typeof option !== "object") {
    return "{{}}";
  }

  const value = option.value || option.label || "";
  if (!value) {
    return "{{}}";
  }

  // Extract the last segment of the dot-notation path
  const segments = value.split(".");
  const fieldName = segments[segments.length - 1];

  return `{{${fieldName}}}`;
}

/**
 * Generate a relation token in the format `{{relation doc.<name>}}`.
 * Auto-prepends "doc." if the input path doesn't already start with "doc.".
 * @param {string} name - The relation name or path (e.g., "branch" or "doc.branch")
 * @returns {string} Formatted relation token, e.g., "{{relation doc.branch}}"
 */
export function generateRelationToken(name) {
  if (!name || typeof name !== "string") {
    return "{{relation doc.}}";
  }

  const trimmed = name.trim();
  if (!trimmed) {
    return "{{relation doc.}}";
  }

  // Auto-prepend "doc." if not already present
  const path = trimmed.startsWith("doc.") ? trimmed : `doc.${trimmed}`;

  return `{{relation ${path}}}`;
}

/**
 * Simplify a token for canvas display by stripping known prefixes.
 * - `{{relation doc.branch}}` → `{{branch}}`
 * - `{{docInfo.name}}` → `{{name}}`
 * - `{{doc.date}}` → `{{date}}`
 * - `{{relation doc.customer.address}}` → `{{customer.address}}`
 * Handles nested dot-notation paths correctly by only removing the first
 * known prefix segment.
 * @param {string} token - The full token string including `{{` and `}}`
 * @returns {string} Simplified token for canvas preview
 */
export function simplifyTokenDisplay(token) {
  if (!token || typeof token !== "string") {
    return token || "";
  }

  const trimmed = token.trim();

  // Match token pattern: {{ ... }}
  const match = trimmed.match(/^\{\{\s*(.*?)\s*\}\}$/);
  if (!match) {
    return trimmed;
  }

  let inner = match[1];

  // Strip "relation doc." prefix (e.g., "relation doc.branch" → "branch")
  if (inner.startsWith("relation doc.")) {
    inner = inner.slice("relation doc.".length);
    return `{{${inner}}}`;
  }

  // Strip "relation " prefix without "doc." (edge case)
  if (inner.startsWith("relation ")) {
    inner = inner.slice("relation ".length);
    // If what remains starts with "doc.", strip that too
    if (inner.startsWith("doc.")) {
      inner = inner.slice("doc.".length);
    }
    return `{{${inner}}}`;
  }

  // Strip "docInfo." prefix (e.g., "docInfo.name" → "name")
  if (inner.startsWith("docInfo.")) {
    inner = inner.slice("docInfo.".length);
    return `{{${inner}}}`;
  }

  // Strip "doc." prefix (e.g., "doc.date" → "date")
  if (inner.startsWith("doc.")) {
    inner = inner.slice("doc.".length);
    return `{{${inner}}}`;
  }

  return trimmed;
}

/**
 * Generate a docInfo token in the format `{{docInfo.<field_name>}}`.
 * @param {string} fieldName - The docInfo field name (e.g., "name")
 * @returns {string} Formatted docInfo token, e.g., "{{docInfo.name}}"
 */
export function generateDocInfoToken(fieldName) {
  if (!fieldName || typeof fieldName !== "string") {
    return "{{docInfo.}}";
  }

  const trimmed = fieldName.trim();
  if (!trimmed) {
    return "{{docInfo.}}";
  }

  return `{{docInfo.${trimmed}}}`;
}

/**
 * Check whether a tree node has at least one descendant (at any depth) whose
 * own `type` field is "relations". This uses the `type` stored on each node
 * by `buildTreeOptions`.
 * @param {object} node - A tree option node
 * @returns {boolean}
 */
function hasRelationsDescendant(node) {
  if (!node || !Array.isArray(node.children)) {
    return false;
  }

  for (const child of node.children) {
    if (!child || typeof child !== "object") {
      continue;
    }
    if (child.type === "relations") {
      return true;
    }
    if (child.type === "relation" && hasRelationsDescendant(child)) {
      return true;
    }
  }

  return false;
}

/**
 * Filter a tree-structured options array for the relationPath field.
 * - Marks "relations" nodes as selectable (disabled=false)
 * - Marks "relation" nodes as disabled (non-selectable navigation parents)
 * - Prunes "relation" nodes that have no "relations" descendants at any depth
 * - Removes nodes of type "data" and "preferences" (not relevant for relation path)
 * - Preserves the full dot-notation path in the `value` field for nested selections
 *
 * "relations" nodes are leaf selection targets — their children (data columns)
 * are not shown since they represent table columns, not nested relation paths.
 * @param {Array} options - Tree-structured options (output of buildTreeOptions)
 * @returns {Array} Filtered tree suitable for the relationPath NestedSelect
 */
export function filterRelationPathOptions(options) {
  if (!Array.isArray(options) || options.length === 0) {
    return [];
  }

  const filtered = [];

  for (const option of options) {
    if (!option || typeof option !== "object") {
      continue;
    }

    const type = option.type || "";

    // "relations" nodes are selectable targets (leaf for relation path selection)
    if (type === "relations") {
      filtered.push({
        ...option,
        disabled: false,
        children: [],
      });
      continue;
    }

    // "relation" nodes serve as navigation parents — only keep them if they
    // have at least one direct or nested "relations" child
    if (type === "relation") {
      if (!hasRelationsDescendant(option)) {
        continue;
      }

      const children = Array.isArray(option.children)
        ? filterRelationPathOptions(option.children)
        : [];

      // Double-check: if filtering removed all children, prune this node
      if (children.length === 0) {
        continue;
      }

      filtered.push({
        ...option,
        disabled: true,
        children,
      });
      continue;
    }

    // Remove nodes of type "data", "preferences", or any other non-relation type
    // They are not relevant for relation path selection
  }

  return filtered;
}

/**
 * Filter a tree-structured options array to exclude "relations" (many) nodes
 * and all their descendant children.
 * Keeps only nodes of type "data", "preferences", and "relation" (singular).
 * Recursively filters children of retained nodes to ensure no "relations"
 * nodes exist at any depth.
 * @param {Array} options - Tree-structured options (output of buildTreeOptions)
 * @returns {Array} Filtered tree with "relations" nodes and their descendants removed
 */
export function filterTokenOptions(options) {
  if (!Array.isArray(options) || options.length === 0) {
    return [];
  }

  const filtered = [];

  for (const option of options) {
    if (!option || typeof option !== "object") {
      continue;
    }

    // Exclude nodes with type "relations" — this also drops all their descendants
    if (option.type === "relations") {
      continue;
    }

    // Recursively filter children of retained nodes
    const children = Array.isArray(option.children)
      ? filterTokenOptions(option.children)
      : [];

    filtered.push({
      ...option,
      children,
    });
  }

  return filtered;
}
