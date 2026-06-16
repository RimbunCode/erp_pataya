import { generateRandom } from "./utils";
import { formatNumber } from "@/Components/NumberInput/formatNumber";
import {
  serializeCustomModeHeader,
  serializeCustomModeBody,
} from "../Pages/Core/PrintTemplate/utils/customModeUtils";

// Format angka gaya Indonesia (locale "id"): pemisah ribuan "." dan desimal ",".
const ID_GROUP_SEPARATOR = ".";
const ID_DECIMAL_SEPARATOR = ",";

/**
 * Resolves a dot-notation path on an object to get the value.
 * e.g., resolveValue(obj, "customer.name") => obj.customer.name
 * @param {object} obj - The data object to resolve from
 * @param {string} path - Dot-notation path
 * @returns {*} The resolved value or undefined
 */
function resolveValue(obj, path) {
  if (!obj || !path) return undefined;
  const parts = path.split(".");
  let current = obj;
  for (const part of parts) {
    if (current == null) return undefined;
    current = current[part];
  }
  return current;
}

/**
 * Evaluates a Handlebar-style expression against a data row for canvas preview.
 * Supports arithmetic helpers: multiply, subtract, add, divide.
 *
 * Examples:
 *   "{{multiply this.quantity this.price}}" => row.quantity * row.price
 *   "{{subtract this.total this.discount}}" => row.total - row.discount
 *   "{{add this.subtotal this.tax}}" => row.subtotal + row.tax
 *   "{{divide this.total this.quantity}}" => row.total / row.quantity
 *
 * Requirements: 3.15 - Support calculated columns with inline expressions
 * @param {string} expression - The Handlebar expression string
 * @param {object} row - The data row to evaluate against
 * @returns {number|null} The calculated result or null if evaluation fails
 */
function evaluateExpression(expression, row) {
  if (!expression || !row) return null;

  // Match pattern: {{helperName arg1 arg2}}
  const match = expression.match(
    /\{\{\s*(multiply|subtract|add|divide)\s+this\.(\w[\w.]*)\s+this\.(\w[\w.]*)\s*\}\}/,
  );

  if (!match) return null;

  const [, helper, fieldA, fieldB] = match;
  const a = parseFloat(resolveValue(row, fieldA));
  const b = parseFloat(resolveValue(row, fieldB));

  if (isNaN(a) || isNaN(b)) return null;

  switch (helper) {
    case "multiply":
      return a * b;
    case "subtract":
      return a - b;
    case "add":
      return a + b;
    case "divide":
      return b === 0 ? 0 : a / b;
    default:
      return null;
  }
}

/**
 * Format a cell value based on the column type from DataTableColumns configuration.
 *
 * Supports:
 * - "currency" type: formats with currency symbol using formatNumber utility
 * - "numeric" / "number" type: formats with decimal places using formatNumber utility
 *
 * Requirements: 3.10 - Apply formatting settings from DataTableColumns configuration
 * @param {number|string|null} value - The value to format
 * @param {object} column - The column definition from DataTableColumns
 * @returns {string} The formatted value or original string
 */
function formatCellValue(value, column) {
  if (value == null || value === "") return "-";

  const type = column?.type;
  const decimalScale = column?.decimalScale ?? column?.formatOptions?.decimals;

  if (type === "currency") {
    try {
      const decimals = typeof decimalScale === "number" ? decimalScale : 2;
      const symbol = column?.symbol ?? column?.currency?.symbol ?? "Rp";
      const formatted = formatNumber(value, {
        groupSeparator: ID_GROUP_SEPARATOR,
        decimalSeparator: ID_DECIMAL_SEPARATOR,
        decimalScale: decimals,
        prefix: `${symbol} `,
      });
      return formatted === "" ? String(value) : formatted;
    } catch {
      return String(value);
    }
  }

  if (type === "numeric" || type === "number") {
    try {
      const numericValue =
        typeof value === "string" ? parseFloat(value) : Number(value);
      if (isNaN(numericValue)) return String(value);

      const decimals = typeof decimalScale === "number" ? decimalScale : 0;
      const formatted = formatNumber(numericValue, {
        groupSeparator: ID_GROUP_SEPARATOR,
        decimalSeparator: ID_DECIMAL_SEPARATOR,
        decimalScale: decimals,
      });
      return formatted === "" ? String(value) : formatted;
    } catch {
      return String(value);
    }
  }

  return String(value);
}

/**
 * Normalisasi key titleTrans agar hanya string non-kosong yang disimpan.
 * @param {unknown} value
 * @returns {string|null}
 */
function resolveTitleTransKey(value) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

/**
 * Escape nilai atribut HTML agar aman dimasukkan ke string template.
 * @param {string} value
 * @returns {string}
 */
function escapeHtmlAttribute(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Gets the label for a column using a locale-aware fallback chain.
 *
 * Resolution order:
 * 1. `titleTrans` — resolved via the translation function `t` with the given locale.
 *    If the translation returns a non-empty string different from the key itself,
 *    it is used.
 * 2. `title` — used as-is when available and non-empty.
 * 3. `name` — final fallback, always present on valid column definitions.
 *
 * Guarantees: never returns undefined or empty string when at least one of
 * `titleTrans`, `title`, or `name` is present on the column object.
 * @param {object} col - Column definition with name, title, titleTrans
 * @param {Function} t - Translation function (e.g., `t` from useLaravelReactI18n)
 * @param {string} [locale] - Optional locale code (e.g., "en", "id") for translation resolution
 * @returns {string} The resolved label
 */
function getColumnLabel(col, t, locale) {
  if (!col || typeof col !== "object") {
    return "";
  }

  // 1. Try titleTrans with locale-aware translation
  if (col.titleTrans && typeof t === "function") {
    const translated = locale
      ? t(col.titleTrans, {}, locale)
      : t(col.titleTrans);
    if (translated && translated !== col.titleTrans) {
      return translated;
    }
  }

  // 2. Fallback to title
  if (col.title && typeof col.title === "string" && col.title.trim()) {
    return col.title;
  }

  // 3. Final fallback to name
  if (col.name && typeof col.name === "string" && col.name.trim()) {
    return col.name;
  }

  // Safety: return empty string only if column has no usable fields
  return col.titleTrans || col.title || col.name || "";
}

/**
 * Builds the canvas-visible table components using example data.
 * Displays actual data values in cells for accurate preview.
 * @param {object} options
 * @param {Array} options.columns - Column definitions (filtered & sorted)
 * @param {string} options.relationName - The relation name for constructing label/token paths
 * @param {Array|null} options.exampleData - Array of example data rows for this relation
 * @param {Function} options.t - Translation function
 * @param {Function} options.genId - ID generator function
 * @param {string} [options.locale] - Optional locale code (e.g., "en", "id") for header translation
 * @returns {Array} GrapeJS component definitions for thead and tbody
 */
function buildExampleDataTable({
  columns,
  relationName = "",
  exampleData,
  t,
  genId,
  locale,
}) {
  // Ensure relation name has "doc." prefix for label path construction
  const labelRelationPrefix = relationName.startsWith("doc.")
    ? relationName
    : relationName
      ? `doc.${relationName}`
      : "";

  // Build thead with labels from unified label helper
  const theadComponents = [
    {
      tagName: "th",
      content: "#",
      selectable: false,
      droppable: false,
      layerable: false,
      editable: false,
      draggable: false,
      attributes: {
        "data-id": genId("cell"),
        class: "border border-gray-400 px-2 py-1 text-left bg-gray-100",
      },
    },
    ...columns.map((col) => {
      const labelKey = `${labelRelationPrefix}.${col.name}`;
      const titleTransKey = resolveTitleTransKey(col.titleTrans);

      return {
        tagName: "th",
        content: getColumnLabel(col, t, locale),
        selectable: false,
        droppable: false,
        layerable: false,
        editable: false,
        draggable: false,
        attributes: {
          "data-id": genId("cell"),
          "data-label-key": labelKey,
          ...(titleTransKey ? { "data-title-trans": titleTransKey } : {}),
          name: col.name,
          class: "border border-gray-400 px-2 py-1 text-left bg-gray-100",
        },
      };
    }),
  ];

  // Build tbody with example data rows
  const rows = [];
  const dataRows = Array.isArray(exampleData) ? exampleData : [];

  if (dataRows.length > 0) {
    dataRows.forEach((row, idx) => {
      const isEvenRow = idx % 2 === 1;
      const rowBgClass = isEvenRow ? " bg-gray-50" : "";

      rows.push({
        tagName: "tr",
        selectable: false,
        droppable: false,
        layerable: false,
        editable: false,
        draggable: false,
        components: [
          {
            tagName: "td",
            content: String(idx + 1),
            selectable: false,
            droppable: false,
            layerable: false,
            editable: false,
            draggable: false,
            attributes: {
              "data-id": genId("cell"),
              class:
                "border border-gray-300 px-2 py-1 text-center" + rowBgClass,
            },
          },
          ...columns.map((col) => {
            // Resolve the value from example data
            let value;
            let displayValue;

            if (col.expression) {
              // Calculated column: evaluate expression from example data
              // Supports expressions like "{{multiply this.quantity this.price}}"
              // Requirements: 3.15
              value = evaluateExpression(col.expression, row);
              displayValue = formatCellValue(value, col);
            } else {
              value = resolveValue(row, col.name);
              // Apply currency/number formatting from DataTableColumns (Requirement 3.10)
              displayValue = formatCellValue(value, col);
            }

            // Right-align currency and number columns
            const alignClass =
              col.type === "currency" ||
              col.type === "numeric" ||
              col.type === "number"
                ? " text-right"
                : "";

            // Build data-token for body cells
            const cellToken = col.expression
              ? col.expression
              : `{{${col.type === "relation" ? "relation " : ""}this.${col.name}}}`;

            return {
              tagName: "td",
              content: displayValue,
              selectable: false,
              droppable: false,
              layerable: false,
              editable: false,
              draggable: false,
              attributes: {
                "data-id": genId("cell"),
                "data-token": cellToken,
                name: col.name,
                class:
                  "border border-gray-300 px-2 py-1" + alignClass + rowBgClass,
              },
            };
          }),
        ],
      });
    });
  } else {
    // Fallback: show a single placeholder row when no example data
    rows.push({
      tagName: "tr",
      selectable: false,
      droppable: false,
      layerable: false,
      editable: false,
      draggable: false,
      components: [
        {
          tagName: "td",
          content: "1",
          selectable: false,
          droppable: false,
          layerable: false,
          editable: false,
          draggable: false,
          attributes: {
            "data-id": genId("cell"),
            class: "border border-gray-300 px-2 py-1",
          },
        },
        ...columns.map((col) => ({
          tagName: "td",
          content: `[${col.name}]`,
          selectable: false,
          droppable: false,
          layerable: false,
          editable: false,
          draggable: false,
          attributes: {
            "data-id": genId("cell"),
            "data-token": col.expression
              ? col.expression
              : `{{${col.type === "relation" ? "relation " : ""}this.${col.name}}}`,
            name: col.name,
            class: "border border-gray-300 px-2 py-1",
          },
        })),
      ],
    });
  }

  return [
    {
      type: "tableHead",
      tagName: "thead",
      selectable: false,
      droppable: false,
      layerable: false,
      editable: false,
      draggable: false,
      components: [
        {
          tagName: "tr",
          selectable: false,
          droppable: false,
          layerable: false,
          editable: false,
          draggable: false,
          components: theadComponents,
        },
      ],
    },
    {
      tagName: "tbody",
      selectable: false,
      droppable: false,
      layerable: false,
      editable: false,
      draggable: false,
      components: rows,
    },
  ];
}

/**
 * Generates the Handlebar token structure for the table HTML output.
 * This is used when serializing the template for actual rendering.
 *
 * Token format (Requirement 3.14):
 * <table><tbody>{{#each doc.items}}<tr><td>{{label "fieldPath"}}</td><td>{{this.value}}</td></tr>{{/each}}</tbody></table>
 *
 * Uses:
 * - Unified `label` helper (inline) for column headers
 * - `{{#each doc.relationName}}` for row iteration
 * - `{{this.columnName}}` for simple columns
 * - `{{relation this.columnName}}` for relation columns
 * @param {object} options
 * @param {Array} options.columns - Column definitions
 * @param {string} options.relationName - The relation name
 * @param {Function} options.genId - ID generator function
 * @returns {Array} GrapeJS component definitions with Handlebar tokens
 */
function buildHandlebarTokenTable({ columns, relationName, genId }) {
  const relationTarget = relationName.startsWith("doc.")
    ? relationName
    : relationName
      ? `doc.${relationName}`
      : relationName;

  // Ensure relation name has "doc." prefix for label path construction
  const labelRelationPrefix = relationName.startsWith("doc.")
    ? relationName
    : relationName
      ? `doc.${relationName}`
      : "";

  return [
    {
      type: "tableHead",
      tagName: "thead",
      selectable: false,
      droppable: false,
      layerable: false,
      editable: false,
      draggable: false,
      components: [
        {
          tagName: "tr",
          selectable: false,
          droppable: false,
          layerable: false,
          editable: false,
          draggable: false,
          components: [
            {
              tagName: "th",
              content: "#",
              selectable: false,
              droppable: false,
              layerable: false,
              editable: false,
              draggable: false,
              attributes: {
                "data-id": genId("cell"),
                class: "border border-gray-400 px-2 py-1 text-left bg-gray-100",
              },
            },
            ...columns.map((col) => {
              const labelKey = `${labelRelationPrefix}.${col.name}`;
              const token = `{{label "${labelKey}"}}`;
              const titleTransKey = resolveTitleTransKey(col.titleTrans);

              return {
                tagName: "th",
                content: token,
                selectable: false,
                droppable: false,
                layerable: false,
                editable: false,
                draggable: false,
                attributes: {
                  "data-id": genId("cell"),
                  "data-label-key": labelKey,
                  ...(titleTransKey
                    ? { "data-title-trans": titleTransKey }
                    : {}),
                  name: col.name,
                  class:
                    "border border-gray-400 px-2 py-1 text-left bg-gray-100",
                },
              };
            }),
          ],
        },
      ],
    },
    {
      tagName: "tbody",
      selectable: false,
      droppable: false,
      layerable: false,
      editable: false,
      draggable: false,
      components: [
        {
          type: "html-comment",
          attributes: { text: `{{#each ${relationTarget}}}` },
        },
        {
          tagName: "tr",
          selectable: false,
          droppable: false,
          layerable: false,
          editable: false,
          draggable: false,
          components: [
            {
              tagName: "td",
              content: "{{idx}}",
              selectable: false,
              droppable: false,
              layerable: false,
              editable: false,
              draggable: false,
              attributes: {
                "data-id": genId("cell"),
                class: "border border-gray-300 px-2 py-1",
              },
            },
            ...columns.map((col) => {
              const cellToken = col.expression
                ? col.expression
                : `{{${col.type === "relation" ? "relation " : ""}this.${col.name}}}`;

              return {
                tagName: "td",
                content: cellToken,
                selectable: false,
                droppable: false,
                layerable: false,
                editable: false,
                draggable: false,
                attributes: {
                  "data-id": genId("cell"),
                  "data-token": cellToken,
                  name: col.name,
                  class: "border border-gray-300 px-2 py-1",
                },
              };
            }),
          ],
        },
        {
          type: "html-comment",
          attributes: { text: `{{/each}}` },
        },
      ],
    },
  ];
}

export {
  buildExampleDataTable,
  buildHandlebarTokenTable,
  evaluateExpression,
  formatCellValue,
  getColumnLabel,
  resolveValue,
};

export default function gjsRelationsTable(editor) {
  const genId = (prefix = "g") => `${prefix}-${generateRandom(8)}`;

  editor.Components.addType("html-comment", {
    model: {
      defaults: {
        droppable: false,
        draggable: false,
        editable: false,
        selectable: false,
        layerable: false,
        attributes: {
          text: "default comment",
          class: "gjs-html-comment",
        },
        styles: `
          .gjs-html-comment{
            display:none !important;
          }
        `,
      },
      toHTML() {
        const comment = this.getAttributes().text || "";
        return comment;
      },
    },
  });

  // 3️⃣ Definisi tipe gjsRelationsTable
  editor.Components.addType("gjsRelationsTable", {
    model: {
      defaults: {
        tagName: "table",
        attributes: { class: "table table-bordered w-100" },
        droppable: false,
        traits: [],
        customMode: false,
      },
      init() {
        this.listenTo(this, "change:selectedColumns", this.updateColumns);
        this.listenTo(this, "change:columnOrder", this.updateColumns);
        this.listenTo(this, "change:customMode", this.onCustomModeChange);

        // On load: if customMode is active but children are missing, emit error event
        // Deferred so the component tree is fully populated before checking
        if (this.get("customMode") === true) {
          window.setTimeout(() => {
            if (this.components().length === 0) {
              this.trigger("customMode:layoutRestoreError");
            }
          }, 0);
        }
      },
      onCustomModeChange() {
        const isCustomMode = this.get("customMode");
        const components = this.components();
        const relationName = this.getAttributes()?.["data-relations"] || "";

        // Convert components to be editable/selectable if entering Custom Mode
        const updateComponentAccess = (comp) => {
          comp.set({
            selectable: true,
            droppable: true,
            editable: true,
            draggable: false, // Table structure shouldn't be moved around
          });
          comp.components().forEach(updateComponentAccess);
        };

        // Convert existing cells to Custom Mode format when entering Custom Mode
        const convertCellToCustomMode = (cell) => {
          // Make cell editable (it will contain editable text + non-editable token spans)
          cell.set({ editable: true });

          const attrs = cell.getAttributes() || {};

          // Check for data-label-key (header) or data-token (body)
          const labelKey = attrs["data-label-key"];
          const tokenValue = attrs["data-token"];

          // If cell has label or token data, convert content to non-editable span
          if (labelKey || tokenValue) {
            const currentContent = cell.get("content") || "";
            const cellTag = (cell.get("tagName") || "").toLowerCase();
            const relationPrefix = relationName
              ? `doc.${relationName}.`
              : "doc.";
            const normalizedTokenValue = labelKey
              ? ""
              : (() => {
                  const tokenInner = tokenValue
                    .trim()
                    .replace(/^\{\{\s*/, "")
                    .replace(/\s*\}\}$/, "");
                  if (cellTag !== "td") return tokenValue;
                  if (
                    tokenInner.startsWith("this.") ||
                    tokenInner.startsWith("relation this.")
                  ) {
                    return tokenValue;
                  }
                  if (tokenInner.startsWith("relation ")) {
                    const path = tokenInner.slice("relation ".length);
                    if (path.startsWith(relationPrefix)) {
                      return `{{relation this.${path.slice(relationPrefix.length)}}}`;
                    }
                  }
                  if (tokenInner.startsWith(relationPrefix)) {
                    return `{{this.${tokenInner.slice(relationPrefix.length)}}}`;
                  }
                  return tokenValue;
                })();
            const displayValue = labelKey
              ? currentContent || labelKey.split(".").pop() || labelKey
              : (() => {
                  const tokenInner = normalizedTokenValue
                    .trim()
                    .replace(/^\{\{\s*/, "")
                    .replace(/\s*\}\}$/, "");
                  if (tokenInner.startsWith("relation this.")) {
                    return `[${tokenInner.slice("relation this.".length)}]`;
                  }
                  if (tokenInner.startsWith("this.")) {
                    return `[${tokenInner.slice("this.".length)}]`;
                  }
                  if (tokenInner.startsWith("relation doc.")) {
                    return `{{${tokenInner.slice("relation doc.".length)}}}`;
                  }
                  if (tokenInner.startsWith("doc.")) {
                    return `{{${tokenInner.slice("doc.".length)}}}`;
                  }
                  return normalizedTokenValue;
                })();

            // Clear current content and add non-editable span child
            cell.components().reset();
            cell.components().add({
              type: "text",
              tagName: "span",
              selectable: false,
              editable: false,
              draggable: false,
              attributes: {
                ...(labelKey
                  ? { "data-label-key": labelKey }
                  : { "data-token": normalizedTokenValue }),
                title: labelKey
                  ? `{{label "${labelKey}"}}`
                  : normalizedTokenValue,
                contenteditable: "false",
              },
              content: displayValue,
            });
          }
        };

        if (isCustomMode) {
          updateComponentAccess(this);
          // Special: table itself and sections should not be editable text nodes
          this.set({ editable: false });
          components.forEach((c) => c.set({ editable: false }));

          // Find and convert all header and body cells to Custom Mode format
          const thead = this.components().find(
            (c) => (c.get("tagName") || "").toLowerCase() === "thead",
          );
          const tbody = this.components().find(
            (c) => (c.get("tagName") || "").toLowerCase() === "tbody",
          );

          if (thead) {
            thead.components().forEach((row) => {
              if (row.get("tagName") === "tr") {
                row.components().forEach((cell) => {
                  if (cell.get("tagName") === "th") {
                    convertCellToCustomMode(cell);
                  }
                });
              }
            });
          }

          if (tbody) {
            tbody.components().forEach((row) => {
              if (row.get("tagName") === "tr") {
                row.components().forEach((cell) => {
                  if (cell.get("tagName") === "td") {
                    convertCellToCustomMode(cell);
                  }
                });
              }
            });
          }
        }
      },
      updateColumns() {
        const selected = this.get("selectedColumns") || [];
        const order = this.get("columnOrder") || [];
        const columns = order.filter((col) => selected.includes(col));

        const thead = this.components().find(
          (c) => c.get("tagName") === "thead",
        );
        if (!thead) return;

        const tr = thead.components().at(0);
        tr.components().reset(
          columns.map((col) => ({
            tagName: "th",
            content: col,
            attributes: {
              "data-id": genId("cell"),
              class: "border border-gray-400 px-2 py-1 text-left bg-gray-100",
            },
          })),
        );
      },
      /**
       * Override toHTML to generate proper Handlebar token structure
       * for the actual template output (not the canvas preview).
       *
       * The canvas shows example data for visual preview,
       * but the serialized HTML uses Handlebar tokens for rendering.
       *
       * Token format:
       * <table>
       *   <thead>
       *     <tr>
       *       <td>{{label "fieldPath"}}</td>
       *     </tr>
       *   </thead>
       *   <tbody>
       *   {{#each doc.items}}
       *     <tr>
       *       <td>{{this.value}}</td>
       *     </tr>
       *   {{/each}}
       *   </tbody>
       * </table>
       *
       * Uses:
       * - Unified `label` helper for column headers (inline, not block)
       * - {{label "relationName.columnName"}}
       * - `{{#each doc.relationName}}` for row iteration
       * - `{{this.columnName}}` for simple columns
       * - `{{relation this.columnName}}` for relation columns
       */
      /**
       * Serializes the table when Custom Mode is active.
       * Uses serializeCustomModeHeader/Body from customModeUtils to build
       * the Handlebar-token HTML from the live GrapesJS component tree.
       * Outputs data-custom-mode="true" as a marker attribute.
       */
      toCustomModeHTML() {
        const attrs = this.getAttributes();
        const relationName = attrs["data-relations"] || "";

        const theadComponents = this.components().filter(
          (c) => (c.get("tagName") || "").toLowerCase() === "thead",
        );
        const tbodyComponents = this.components().filter(
          (c) => (c.get("tagName") || "").toLowerCase() === "tbody",
        );
        const thead = theadComponents.length > 0 ? theadComponents[0] : null;
        const tbody = tbodyComponents.length > 0 ? tbodyComponents[0] : null;

        const headerHtml = serializeCustomModeHeader(thead, relationName);
        const bodyHtml = serializeCustomModeBody(tbody, relationName);

        return `<table class="table table-bordered w-100" data-relations="${relationName}" data-custom-mode="true">${headerHtml}${bodyHtml}</table>`;
      },

      toHTML() {
        // Custom Mode: delegate to dedicated serializer
        if (this.get("customMode") === true) {
          return this.toCustomModeHTML();
        }

        const attrs = this.getAttributes();
        const relationName = attrs["data-relations"] || "";
        const relationTarget = relationName.startsWith("doc.")
          ? relationName
          : relationName
            ? `doc.${relationName}`
            : relationName;
        const columnsData = this.get("columnsConfig") || [];

        // If no columnsConfig stored, fall back to default behavior
        if (!columnsData.length) {
          return this.constructor.__super__.toHTML.call(this);
        }

        const visibleColumns = columnsData
          .filter((col) => col.show)
          .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

        // Ensure relation name has "doc." prefix for label path
        const labelRelationPrefix = relationName.startsWith("doc.")
          ? relationName
          : relationName
            ? `doc.${relationName}`
            : "";

        // Generate the Handlebar token table HTML using unified label helper
        let html = `<table class="table table-bordered w-100" data-relations="${relationName}">`;

        // Header row uses {{label "doc.relationName.fieldPath"}} for consistent translated labels
        html += `<thead>`;
        html += `<tr>`;
        html += `<th>#</th>`;
        for (const col of visibleColumns) {
          const titleTransKey = resolveTitleTransKey(col.titleTrans);
          const titleTransAttr = titleTransKey
            ? ` data-title-trans="${escapeHtmlAttribute(titleTransKey)}"`
            : "";
          html += `<th${titleTransAttr}>{{label "${labelRelationPrefix}.${col.name}"}}</th>`;
        }
        html += `</tr>`;
        html += `</thead>`;

        // Body rows use {{#each}} iteration with {{this.value}} access
        // Supports calculated columns with inline expressions (Requirement 3.15)
        // e.g., {{multiply this.quantity this.price}}, {{subtract this.total this.discount}}
        html += `<tbody>`;
        html += `{{#each ${relationTarget}}}`;
        html += `<tr>`;
        html += `<td style="text-align:center">{{idx}}</td>`;
        for (const col of visibleColumns) {
          const alignStyle =
            col.type === "currency" ||
            col.type === "numeric" ||
            col.type === "number"
              ? ' style="text-align:right"'
              : "";

          let cellContent;
          if (col.expression) {
            // Calculated column: use inline expression as-is
            // Expression format: "{{multiply this.quantity this.price}}"
            cellContent = col.expression;
          } else {
            const tokenPrefix = col.type === "relation" ? "relation " : "";
            cellContent = `{{${tokenPrefix}this.${col.name}}}`;
          }

          html += `<td${alignStyle}>${cellContent}</td>`;
        }
        html += `</tr>`;
        html += `{{/each}}`;
        html += `</tbody>`;
        html += `</table>`;

        return html;
      },
    },
  });
}
