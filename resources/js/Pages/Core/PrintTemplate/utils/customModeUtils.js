/**
 * Utility functions for Custom Mode of gjsRelationsTable components.
 * Handles column filtering, header row management, span validation,
 * body section constraints, and serialization helpers.
 * @module customModeUtils
 */

/**
 * Finds the relation entry in the dataTableColumns tree by relation name,
 * then filters its columns to exclude many-relation (type "relations") columns.
 * Includes basic columns (non-relation types) and single-relation (type "relation") columns.
 *
 * The search traverses: top-level doc group → nested "relations"/"relation" children
 * matching the given relationName.
 *
 * @param {Array} dataTableColumns - Full column tree from page props
 * @param {string} relationName - The relation name to scope to (e.g., "items")
 * @returns {Array} Filtered columns for the relation (excluding many-relation type)
 */
export function filterRelationColumns(dataTableColumns, relationName) {
  if (!Array.isArray(dataTableColumns) || !relationName) {
    return [];
  }

  /**
   * Recursively search for a column node with matching name and type "relations" or "relation"
   * that represents our target relation table.
   */
  function findRelation(columns) {
    for (const col of columns) {
      if (!col || typeof col !== "object") continue;

      if (col.name === relationName && col.type === "relations") {
        return col;
      }

      if (Array.isArray(col.columns) && col.columns.length > 0) {
        const found = findRelation(col.columns);
        if (found) return found;
      }
    }
    return null;
  }

  const relationNode = findRelation(dataTableColumns);
  if (!relationNode || !Array.isArray(relationNode.columns)) {
    return [];
  }

  // Exclude many-relation (type "relations") columns, include everything else
  return relationNode.columns.filter((col) => col?.type !== "relations");
}

/**
 * Returns true if a new header row can be added (maximum 5 rows).
 *
 * @param {number} currentRowCount - Current number of header rows
 * @returns {boolean}
 */
export function canAddHeaderRow(currentRowCount) {
  return typeof currentRowCount === "number" && currentRowCount < 5;
}

/**
 * Returns true if a header row can be removed (minimum 1 row must remain).
 *
 * @param {number} currentRowCount - Current number of header rows
 * @returns {boolean}
 */
export function canRemoveHeaderRow(currentRowCount) {
  return typeof currentRowCount === "number" && currentRowCount > 1;
}

/**
 * Checks whether the proposed span for a cell at (rowIndex, colIndex) overlaps
 * with any other occupied cell in the header grid, excluding the cell itself.
 *
 * A cell occupies positions from (rowIndex, colIndex) to
 * (rowIndex + rowspan - 1, colIndex + colspan - 1).
 *
 * @param {object[][]} grid - 2D occupancy grid where each truthy entry means occupied
 * @param {number} rowIndex - Zero-based row index of the cell
 * @param {number} colIndex - Zero-based column index of the cell
 * @param {number} colspan - Number of columns the cell spans
 * @param {number} rowspan - Number of rows the cell spans
 * @param {boolean} [excludeSelf=false] - If true, the cell's own current span is excluded
 *   from the occupied check (used when updating an existing cell's span)
 * @returns {boolean} True if any overlapping occupied cell is detected
 */
export function detectOverlap(
  grid,
  rowIndex,
  colIndex,
  colspan,
  rowspan,
  excludeSelf = false,
) {
  if (!Array.isArray(grid)) return false;

  for (let r = rowIndex; r < rowIndex + rowspan; r++) {
    for (let c = colIndex; c < colIndex + colspan; c++) {
      // Skip origin cell when excludeSelf is set
      if (excludeSelf && r === rowIndex && c === colIndex) continue;

      if (grid[r]?.[c]) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Validates a proposed colspan/rowspan for a header cell.
 * Checks:
 * 1. Bounds: 1 ≤ colspan ≤ totalColumns, 1 ≤ rowspan ≤ totalRows
 * 2. Overlap: the spanned area does not intersect other occupied cells
 *
 * @param {object} headerGrid - HeaderGrid with rows, totalRows, totalColumns
 * @param {number} rowIndex - Zero-based row index of the cell
 * @param {number} colIndex - Zero-based column index of the cell
 * @param {number} colspan - Proposed colspan value
 * @param {number} rowspan - Proposed rowspan value
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateSpan(
  headerGrid,
  rowIndex,
  colIndex,
  colspan,
  rowspan,
) {
  const { totalRows = 1, totalColumns = 1, rows = [] } = headerGrid || {};

  if (colspan < 1 || colspan > totalColumns) {
    return {
      valid: false,
      error: `Colspan must be between 1 and ${totalColumns}`,
    };
  }

  if (rowspan < 1 || rowspan > totalRows) {
    return {
      valid: false,
      error: `Rowspan must be between 1 and ${totalRows}`,
    };
  }

  // Span must not extend beyond grid boundaries from the cell's position
  if (colIndex + colspan > totalColumns) {
    return {
      valid: false,
      error: `Cell span exceeds grid width (column ${colIndex} + colspan ${colspan} > ${totalColumns})`,
    };
  }

  if (rowIndex + rowspan > totalRows) {
    return {
      valid: false,
      error: `Cell span exceeds grid height (row ${rowIndex} + rowspan ${rowspan} > ${totalRows})`,
    };
  }

  // Build occupancy grid from existing rows, excluding the target cell itself
  const occupancy = buildOccupancyGrid(rows, totalRows, totalColumns);

  const hasOverlap = detectOverlap(
    occupancy,
    rowIndex,
    colIndex,
    colspan,
    rowspan,
    true,
  );

  if (hasOverlap) {
    return {
      valid: false,
      error: "Cell span conflicts with existing cells",
    };
  }

  return { valid: true };
}

/**
 * Builds a 2D boolean occupancy grid from the header rows.
 * Each position is true if it is occupied by some cell's span.
 *
 * @param {object[][]} rows - Array of row arrays of HeaderCell objects
 * @param {number} totalRows
 * @param {number} totalColumns
 * @returns {boolean[][]}
 */
export function buildOccupancyGrid(rows, totalRows, totalColumns) {
  const grid = Array.from({ length: totalRows }, () =>
    new Array(totalColumns).fill(false),
  );

  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    if (!Array.isArray(row)) continue;

    for (const cell of row) {
      if (!cell || typeof cell !== "object") continue;
      const cs = cell.colspan ?? 1;
      const rs = cell.rowspan ?? 1;
      const ci = cell.colIndex ?? 0;

      for (let dr = 0; dr < rs; dr++) {
        for (let dc = 0; dc < cs; dc++) {
          const gr = r + dr;
          const gc = ci + dc;
          if (gr < totalRows && gc < totalColumns) {
            grid[gr][gc] = true;
          }
        }
      }
    }
  }

  return grid;
}

/**
 * Returns whether a component is a valid drop target for VariableItem in Custom Mode body.
 * Only direct <td> cells within the body section are valid targets.
 *
 * @param {object} component - GrapesJS component
 * @returns {boolean}
 */
export function isValidBodyDropTarget(component) {
  if (!component) return false;

  const tagName = component.get?.("tagName") || component.getTagName?.() || "";
  if (tagName.toLowerCase() !== "td") return false;

  // Walk up to check parent is <tr> inside <tbody>
  const parent = component.parent?.();
  if (!parent) return false;

  const parentTag = parent.get?.("tagName") || parent.getTagName?.() || "";
  if (parentTag.toLowerCase() !== "tr") return false;

  const grandParent = parent.parent?.();
  if (!grandParent) return false;

  const grandParentTag =
    grandParent.get?.("tagName") || grandParent.getTagName?.() || "";
  return grandParentTag.toLowerCase() === "tbody";
}

/**
 * Returns whether a new row can be added to the body section.
 * Body is always limited to exactly one row.
 *
 * @param {number} currentRowCount - Current number of rows in body
 * @returns {boolean} Always false — body is limited to 1 row
 */
export function canAddBodyRow(currentRowCount) {
  void currentRowCount;
  return false;
}

/**
 * Returns whether colspan/rowspan can be applied to a body cell.
 * Column grouping is never permitted in the body section.
 *
 * @param {number} colspan
 * @param {number} rowspan
 * @returns {boolean} Always false — no grouping in body
 */
export function canApplyBodySpan(colspan, rowspan) {
  void colspan;
  void rowspan;
  return false;
}

/**
 * Serializes the <thead> of a Custom Mode gjsRelationsTable to an HTML string.
 * Variable tokens in header cells are rendered as {{label "doc.<relation>.<col>"}} tokens.
 * Colspan, rowspan, and inline styles are preserved.
 * Static HTML content is output verbatim.
 *
 * @param {object} theadComponent - GrapesJS thead component
 * @param {string} relationName - Relation name (e.g., "items")
 * @returns {string} Serialized <thead> HTML string
 */
export function serializeCustomModeHeader(theadComponent, relationName) {
  if (!theadComponent) return "<thead></thead>";

  const labelRelationPrefix = relationName.startsWith("doc.")
    ? relationName
    : relationName
      ? `doc.${relationName}`
      : "";

  const rows = theadComponent.components?.() || [];
  let html = "<thead>";

  rows.forEach((row) => {
    const rowAttrs = buildInlineStyleAttr(row);
    html += `<tr${rowAttrs}>`;

    const cells = row.components?.() || [];
    cells.forEach((cell) => {
      const cellTag = cell.get?.("tagName") || "th";
      const cellAttrs = buildCellAttributes(cell, labelRelationPrefix);
      const cellContent = serializeCellContent(cell, labelRelationPrefix);
      html += `<${cellTag}${cellAttrs}>${cellContent}</${cellTag}>`;
    });

    html += "</tr>";
  });

  html += "</thead>";
  return html;
}

/**
 * Serializes the <tbody> of a Custom Mode gjsRelationsTable to an HTML string.
 * The single body row is wrapped with {{#each doc.<relation>}} / {{/each}}.
 * Body cell tokens use {{this.<col>}} for basic columns and {{relation this.<col>}} for relation columns.
 *
 * @param {object} tbodyComponent - GrapesJS tbody component
 * @param {string} relationName - Relation name (e.g., "items")
 * @returns {string} Serialized <tbody> HTML string
 */
export function serializeCustomModeBody(tbodyComponent, relationName) {
  if (!tbodyComponent) return "<tbody></tbody>";

  const relationTarget = relationName.startsWith("doc.")
    ? relationName
    : relationName
      ? `doc.${relationName}`
      : relationName;

  const rows = tbodyComponent.components?.() || [];
  let html = "<tbody>";
  html += `{{#each ${relationTarget}}}`;

  rows.forEach((row) => {
    const rowAttrs = buildInlineStyleAttr(row);
    html += `<tr${rowAttrs}>`;

    const cells = row.components?.() || [];
    cells.forEach((cell) => {
      const cellTag = cell.get?.("tagName") || "td";
      const cellAttrs = buildCellAttributes(cell, "");
      const cellContent = serializeBodyCellContent(cell);
      html += `<${cellTag}${cellAttrs}>${cellContent}</${cellTag}>`;
    });

    html += "</tr>";
  });

  html += "{{/each}}";
  html += "</tbody>";
  return html;
}

/**
 * Builds inline style attribute string from a component's styles.
 *
 * @param {object} component - GrapesJS component
 * @returns {string} e.g. ' style="text-align:center"' or ""
 */
function buildInlineStyleAttr(component) {
  const style = component.getStyle?.();
  if (!style || typeof style !== "object") return "";

  const styleStr = Object.entries(style)
    .filter(([, v]) => v !== "" && v != null)
    .map(([k, v]) => `${k}:${v}`)
    .join(";");

  return styleStr ? ` style="${styleStr}"` : "";
}

/**
 * Builds the attribute string for a <th> or <td> cell, including colspan, rowspan, and style.
 *
 * @param {object} cell - GrapesJS cell component
 * @param {string} _labelPrefix - Unused here; kept for signature consistency
 * @returns {string}
 */
function buildCellAttributes(cell, _labelPrefix) {
  const attrs = cell.getAttributes?.() || {};
  let result = "";

  if (attrs.colspan && attrs.colspan !== "1" && attrs.colspan !== 1) {
    result += ` colspan="${attrs.colspan}"`;
  }
  if (attrs.rowspan && attrs.rowspan !== "1" && attrs.rowspan !== 1) {
    result += ` rowspan="${attrs.rowspan}"`;
  }

  const style = cell.getStyle?.();
  if (style && typeof style === "object") {
    const styleStr = Object.entries(style)
      .filter(([, v]) => v !== "" && v != null)
      .map(([k, v]) => `${k}:${v}`)
      .join(";");
    if (styleStr) result += ` style="${styleStr}"`;
  }

  return result;
}

/**
 * Serializes the content of a header cell, converting data-token spans to
 * {{label "..."}} tokens and outputting static HTML verbatim.
 *
 * @param {object} cell - GrapesJS cell component
 * @param {string} labelRelationPrefix - e.g. "doc.items"
 * @returns {string}
 */
function serializeCellContent(cell, labelRelationPrefix) {
  const children = cell.components?.();
  if (!children || children.length === 0) {
    return cell.get?.("content") || "";
  }

  let html = "";
  children.forEach((child) => {
    const attrs = child.getAttributes?.() || {};
    const token = attrs["data-token"] || "";

    if (token) {
      // Extract column name from token to build label helper
      // Tokens in header cells are stored as {{label "doc.items.colName"}}
      // or as raw token path in data-token
      const labelKey = extractColumnTokenPath(token, labelRelationPrefix);
      html += `<span>${labelKey}</span>`;
    } else if (attrs["data-static-html"] !== undefined) {
      html += child.get?.("content") || "";
    } else {
      const childTag = child.get?.("tagName");
      if (childTag) {
        const childAttrs = buildInlineStyleAttr(child);
        html += `<${childTag}${childAttrs}>${serializeCellContent(child, labelRelationPrefix)}</${childTag}>`;
      } else {
        html += child.get?.("content") || "";
      }
    }
  });

  return html;
}

/**
 * Serializes the content of a body cell, converting data-token spans to
 * {{this.<col>}} or {{relation this.<col>}} tokens.
 *
 * @param {object} cell - GrapesJS cell component
 * @returns {string}
 */
function serializeBodyCellContent(cell) {
  const children = cell.components?.();
  if (!children || children.length === 0) {
    return cell.get?.("content") || "";
  }

  let html = "";
  children.forEach((child) => {
    const attrs = child.getAttributes?.() || {};
    const token = attrs["data-token"] || "";

    if (token) {
      html += token;
    } else if (attrs["data-static-html"] !== undefined) {
      html += child.get?.("content") || "";
    } else {
      const childTag = child.get?.("tagName");
      if (childTag) {
        const childStyle = buildInlineStyleAttr(child);
        html += `<${childTag}${childStyle}>${serializeBodyCellContent(child)}</${childTag}>`;
      } else {
        html += child.get?.("content") || "";
      }
    }
  });

  return html;
}

/**
 * Extracts or constructs a label token path from a raw token string and prefix.
 * If the token already is a valid {{label "..."}} form, extract the key.
 * Otherwise build {{label "prefix.colName"}} from the token.
 *
 * @param {string} token - Raw token string, e.g. "{{label "doc.items.name"}}" or "{{this.name}}"
 * @param {string} labelRelationPrefix - e.g. "doc.items"
 * @returns {string} Full label helper string, e.g. {{label "doc.items.name"}}
 */
function extractColumnTokenPath(token, labelRelationPrefix) {
  if (!token) return "";

  // Already a label helper
  const labelMatch = token.match(/\{\{label\s+"([^"]+)"\}\}/);
  if (labelMatch) return token;

  // Extract column name from {{this.colName}} or {{relation this.colName}}
  const thisMatch = token.match(/\{\{(?:relation\s+)?this\.(\w[\w.]*)\}\}/);
  if (thisMatch) {
    const colName = thisMatch[1];
    const key = labelRelationPrefix ? `${labelRelationPrefix}.${colName}` : colName;
    return `{{label "${key}"}}`;
  }

  // Fallback: return as-is
  return token;
}
