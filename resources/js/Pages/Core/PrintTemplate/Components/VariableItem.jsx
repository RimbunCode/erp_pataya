import React from "react";
import { Collapsible, CollapsibleContent } from "@/Components/ui/collapsible";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/Components/ui/tooltip";
import { ChevronRight } from "lucide-react";
import { useEditor } from "@grapesjs/react";
import { cn } from "@/lib/utils";
import { formatValue } from "@/Components/CurrencyInput";
import { useLaravelReactI18n } from "laravel-react-i18n";
import axios from "axios";
import { simplifyTokenDisplay } from "./tokenConfigHelpers";
function buildVariableToken({
  variableType,
  parentType,
  variablePath,
  keyName,
}) {
  if (parentType === "preferences" || variableType === "preferences") {
    return `{{company.${keyName}}}`;
  }

  const normalizedPath = variablePath.startsWith("doc.")
    ? variablePath
    : `doc.${variablePath}`;

  if (variableType === "relation") {
    return `{{relation ${normalizedPath}}}`;
  }

  return `{{${normalizedPath}}}`;
}
/**
 * Format a value based on the column type and format options from DataTableColumns.
 *
 * Supports:
 * - "currency" type: formats with currency symbol using Intl.NumberFormat
 * - "numeric" / "number" type: formats with decimal places using Intl.NumberFormat
 *
 * Requirements: 1.9 - Apply formatting settings from DataTableColumns configuration
 * @param {number|string|null} value - The value to format
 * @param {object} column - The column definition from DataTableColumns
 * @returns {string} The formatted value or original string
 */
function formatColumnValue(value, column) {
  if (value == null || value === "") return "";

  const type = column?.type;
  const decimalScale = column?.decimalScale ?? column?.formatOptions?.decimals;
  const currency = column?.currency ?? column?.formatOptions?.currency ?? "IDR";

  if (type === "currency") {
    try {
      const numericValue =
        typeof value === "number" ? value.toString() : String(value);
      return formatValue({
        value: numericValue,
        intlConfig: {
          locale: "id",
          currency: currency,
        },
      });
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
      return formatValue({
        value: numericValue.toFixed(decimals),
        intlConfig: {
          locale: "id",
        },
        decimalScale: decimals,
      });
    } catch {
      return String(value);
    }
  }

  return String(value);
}

/**
 * Generate the Handlebar token for a variable, wrapping with formatting helpers
 * when the column type is currency or numeric/number.
 *
 * Requirements: 1.9 - Apply formatting when rendering on canvas
 * @param {object} variable - The variable/column definition
 * @param {string} fullKey - The full dot-notation key for the variable
 * @returns {string} The Handlebar token string (with outer {{ }})
 */
function getFormattedHandlebarToken(variable, fullKey) {
  const type = variable?.type;
  const normalizedDocPath = fullKey.startsWith("doc.")
    ? fullKey
    : `doc.${fullKey}`;

  if (variable.parentType === "preferences") {
    return `{{company.${variable.name}}}`;
  }

  if (variable.parentType === "docInfo" || type === "docInfo") {
    return `{{docInfo.${variable.name}}}`;
  }

  if (type === "relation") {
    return `{{relation ${normalizedDocPath}}}`;
  }

  if (type === "currency") {
    const currency =
      variable?.currency ?? variable?.formatOptions?.currency ?? "IDR";
    return `{{formatCurrency ${normalizedDocPath} "${currency}"}}`;
  }

  if (type === "numeric" || type === "number") {
    const decimals =
      variable?.decimalScale ?? variable?.formatOptions?.decimals ?? 0;
    return `{{formatNumber ${normalizedDocPath} ${decimals}}}`;
  }

  return `{{${normalizedDocPath}}}`;
}

/**
 * Check if a column type requires formatting.
 * @param {string} type - The column type from DataTableColumns
 * @returns {boolean} True if the type requires formatting
 */
function isFormattableType(type) {
  return type === "currency" || type === "numeric" || type === "number";
}

/**
 * Resolve a value from example data using a dot-notation path.
 * @param {object} exampleData - The example data object from the backend
 * @param {string} path - Dot-notation path (e.g., "customer_name", "customer.name")
 * @param {string} type - Variable type ("data", "preferences", "relation", etc.)
 * @returns {string|null} The resolved example value or null
 */
function resolveExampleValue(exampleData, path, type) {
  if (!exampleData || !path) return null;

  // For preferences, look in preferences object
  if (type === "preferences") {
    const preferences = exampleData?.preferences;
    if (preferences && preferences[path] !== undefined) {
      return String(preferences[path]);
    }
    return null;
  }

  // For regular data, traverse the example data object
  const parts = path.split(".");
  let current = exampleData;

  for (const part of parts) {
    if (current == null || typeof current !== "object") return null;
    current = current[part];
  }

  if (current == null) return null;
  if (typeof current === "object") return JSON.stringify(current);
  return String(current);
}

/**
 * Get the Handlebar token string for a variable.
 * @param variable
 */
function getHandlebarToken(variable) {
  const normalizedDocPath = variable.name.startsWith("doc.")
    ? variable.name
    : `doc.${variable.name}`;

  if (variable.parentType === "preferences") {
    return `{{company.${variable.name}}}`;
  }
  if (variable.parentType === "docInfo" || variable.type === "docInfo") {
    return `{{docInfo.${variable.name}}}`;
  }
  if (variable.type === "relation") {
    return `{{relation ${normalizedDocPath}}}`;
  }
  if (variable.type == "relations") {
    return `{{#each ${normalizedDocPath}}}...{{/each}}`;
  }
  return `{{${normalizedDocPath}}}`;
}

/**
 * Get the display label for a variable using translation or title.
 * @param variable
 * @param t
 */
function getDisplayLabel(variable, t) {
  return (
    variable.title ||
    (variable.titleTrans ? t(variable.titleTrans) : null) ||
    variable.name
  );
}

function encodeTokenToBase64(token) {
  if (!token || typeof window === "undefined") {
    return "";
  }

  try {
    const bytes = new TextEncoder().encode(token);
    const binary = String.fromCharCode(...bytes);
    return window.btoa(binary);
  } catch {
    return "";
  }
}

function escapeAttributeValue(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function simplifyInlineDisplayToken(fullKey = "", token = "") {
  // If we have the full token, use the canonical simplifyTokenDisplay
  if (token) {
    return simplifyTokenDisplay(token);
  }
  return `{{${fullKey.replace(/^doc\./, "")}}}`;
}

export function buildVariableDragPayload({
  variable,
  nestedColumns,
  formattedExampleValue,
  exampleValue,
  displayLabel,
  fullKey,
}) {
  return {
    ...variable,
    columns: nestedColumns,
    exampleValue: formattedExampleValue ?? exampleValue,
    displayLabel,
    fullKey,
    formattedToken: getFormattedHandlebarToken(variable, fullKey),
  };
}

function tryInsertInlineVariableToken(
  editor,
  selectedComponent,
  token,
  fullKey,
) {
  if (!editor || !selectedComponent || !token) {
    return false;
  }

  const isTextComponent = selectedComponent.is?.("text");
  const isTextEditingActive = editor.Commands?.isActive?.(
    "core:component-text",
  );

  if (!isTextComponent || !isTextEditingActive) {
    return false;
  }

  const iframeDocument = editor.Canvas.getDocument?.();
  if (!iframeDocument?.execCommand) {
    return false;
  }

  const inlinePath = fullKey.replace(/^doc\./, "");
  const displayToken = simplifyInlineDisplayToken(fullKey, token);
  const encodedToken = encodeTokenToBase64(token);
  const inlineHtml = `<span data-variable-inline="${escapeAttributeValue(inlinePath)}" data-variable-path="${escapeAttributeValue(inlinePath)}" data-token="${escapeAttributeValue(token)}" data-token-b64="${escapeAttributeValue(encodedToken)}" contenteditable="false" class="inline-variable-token">${escapeAttributeValue(displayToken)}</span>`;

  iframeDocument.execCommand("insertHTML", false, inlineHtml);
  selectedComponent.trigger("change:content");
  editor.trigger("update");

  return true;
}

/**
 * VariableItem Component (Enhanced)
 *
 * Draggable component representing a data variable with support for:
 * - Example data display in canvas instead of Handlebar tokens
 * - Tooltip showing Handlebar token on hover in Sidebar
 * - labelLang and value configuration from DataTableColumns
 * - Grid layout with label on left and example value on right when dropped
 * - Nested columns for single relations
 * - relationsTable structure for many relations
 *
 * Requirements: 1.1, 1.2, 1.4, 1.5, 1.6, 1.7
 * @param root0
 * @param root0.path
 * @param root0.exampleData
 */
function VariableItem({ path = "", exampleData = null, ...variable }) {
  const editor = useEditor();
  const { t } = useLaravelReactI18n();
  const fullKey = path ? `${path}.${variable.name}` : variable.name;
  const hasInlineColumns =
    Array.isArray(variable.columns) && variable.columns.length > 0;
  const relationModel = variable.related ?? null;
  const canFetchColumns =
    variable.typeRelation == "basic" && Boolean(relationModel);
  const isRelation =
    (variable.type === "relation" ||
      variable.type === "relations" ||
      variable.type === "data" ||
      variable.type === "preferences") &&
    (hasInlineColumns || canFetchColumns);

  const [nestedColumns, setNestedColumns] = React.useState(
    hasInlineColumns ? variable.columns : [],
  );
  const [isLoadingColumns, setIsLoadingColumns] = React.useState(false);
  const [hasFetchedColumns, setHasFetchedColumns] =
    React.useState(hasInlineColumns);
  const [columnsError, setColumnsError] = React.useState(null);
  const [isOpen, setIsOpen] = React.useState(false);

  // Resolve example value for this variable
  const exampleValue = React.useMemo(() => {
    const rawValue = resolveExampleValue(
      exampleData,
      fullKey,
      variable.parentType || variable.type,
    );
    return rawValue;
  }, [exampleData, fullKey, variable.parentType, variable.type]);

  // Format the example value based on column type (Requirements: 1.9)
  const formattedExampleValue = React.useMemo(() => {
    if (exampleValue == null) return null;
    if (isFormattableType(variable.type)) {
      return formatColumnValue(exampleValue, variable);
    }
    return exampleValue;
  }, [exampleValue, variable]);

  // Get the Handlebar token for tooltip display
  const handlebarToken = React.useMemo(() => {
    return getHandlebarToken({ ...variable, name: fullKey });
  }, [variable, fullKey]);

  // Get display label
  const displayLabel = React.useMemo(() => {
    return getDisplayLabel(variable, t);
  }, [variable, t]);

  const fetchColumns = React.useCallback(async () => {
    if (!canFetchColumns || isLoadingColumns || hasFetchedColumns) {
      return;
    }

    setIsLoadingColumns(true);
    setColumnsError(null);

    try {
      const response = await axios.get(
        window.route("model.columns", { model: relationModel }),
      );

      setNestedColumns(response?.data?.columns ?? []);
      setHasFetchedColumns(true);
    } catch (error) {
      console.error(error);
      setColumnsError("Gagal memuat kolom.");
    } finally {
      setIsLoadingColumns(false);
    }
  }, [canFetchColumns, hasFetchedColumns, isLoadingColumns, relationModel]);

  const handleOpenChange = React.useCallback(
    async (open) => {
      setIsOpen(open);

      if (!open) {
        return;
      }

      if (!hasInlineColumns) {
        await fetchColumns();
      }
    },
    [fetchColumns, hasInlineColumns],
  );

  const toggleOpenState = async (event) => {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    await handleOpenChange(!isOpen);
  };

  /**
   * Insert variable into the canvas.
   * Creates a formatted component with label on left and example data value on right.
   * The actual template output still uses proper Handlebar tokens.
   * For currency/number types, uses formatCurrency/formatNumber helpers.
   *
   * Requirements: 1.5, 1.6, 1.9 - Grid layout with label, example value, and formatting
   */
  const handleInsert = () => {
    if (!editor) return;

    const selected = editor.getSelected();
    // Use formatted token for currency/number types (Requirement 1.9)
    const token = getFormattedHandlebarToken(variable, fullKey);

    if (tryInsertInlineVariableToken(editor, selected, token, fullKey)) {
      return;
    }
    const getSimplifiedTokenDisplay = (token, variablePath = "") => {
      if (!token) {
        return variablePath ? `{{${variablePath.replace(/^doc\./, "")}}}` : "";
      }

      const formattedTokenMatch = token.match(
        /\{\{\s*format(?:Currency|Number)\s+doc\.([^\s}]+)/,
      );
      if (formattedTokenMatch?.[1]) {
        return `{{${formattedTokenMatch[1]}}}`;
      }

      return simplifyTokenDisplay(token);
    };
    const payload = buildVariableDragPayload({
      variable,
      nestedColumns,
      formattedExampleValue,
      exampleValue,
      displayLabel,
      fullKey,
    });
    const varPath = payload.fullKey || payload.name;
    const SUBGRID_CLASS = "gjs-subgrid";
    const SUBGRID_RULE_STYLE = {
      display: "grid",
      "grid-template-columns": "subgrid",
      gap: "8px",
      "grid-column": "1 / -1",
      padding: "0px",
    };
    const getComponentType = (component) =>
      component?.getType?.() || component?.get?.("type") || "";
    const isGridComponent = (component) => {
      const type = getComponentType(component);
      return (
        type === "gjsGrid" ||
        type === "grid" ||
        component?.is?.("gjsGrid") ||
        component?.is?.("grid")
      );
    };
    const isSubGridComponent = (component) => {
      const type = getComponentType(component);
      return (
        type === "gjsSubGrid" ||
        type === "subGrid" ||
        component?.is?.("gjsSubGrid") ||
        component?.is?.("subGrid")
      );
    };
    const resolveParentGridComponent = (component) => {
      let current = component;
      while (current) {
        if (isGridComponent(current)) {
          return current;
        }
        current = current.parent?.() || null;
      }
      return null;
    };

    const tokenValue =
      payload.formattedToken ||
      buildVariableToken({
        variableType: payload.type,
        parentType: payload.parentType,
        variablePath: varPath,
        keyName: payload.name,
      });
    const simplifiedToken = getSimplifiedTokenDisplay(
      payload.formattedToken ||
        buildVariableToken({
          variableType: payload.type,
          parentType: payload.parentType,
          variablePath: varPath,
          keyName: payload.name,
        }),
      varPath,
    );
    if (selected && selected.is("text")) {
      selected.components().add({
        type: "text",
        tagName: "span",
        selectable: true,
        editable: false,
        draggable: false,
        attributes: {
          "data-token": tokenValue,
          title: tokenValue,
          contenteditable: "false",
        },
        content: simplifiedToken,
      });
    } else if (
      selected &&
      (isSubGridComponent(selected) || isGridComponent(selected))
    ) {
      const gridTarget = isGridComponent(selected)
        ? selected
        : resolveParentGridComponent(selected.parent?.() || null);

      if (gridTarget) {
        const subGridType = editor.DomComponents?.getType?.("gjsSubGrid")
          ? "gjsSubGrid"
          : "subGrid";
        const subGridComponentDefinition = {
          type: subGridType,
          classes: [SUBGRID_CLASS],
          attributes: {
            "data-variable": varPath,
            "data-variable-type": payload.parentType || payload.type || "data",
            class: SUBGRID_CLASS,
          },
          styles: `
          .${SUBGRID_CLASS} {
            display: ${SUBGRID_RULE_STYLE.display};
            grid-template-columns: ${SUBGRID_RULE_STYLE["grid-template-columns"]};
            gap: ${SUBGRID_RULE_STYLE.gap};
            grid-column: ${SUBGRID_RULE_STYLE["grid-column"]};
            padding: ${SUBGRID_RULE_STYLE.padding};
          }
        `,
          components: [
            {
              type: "text",
              tagName: "p",
              draggable: false,
              content: payload.displayLabel || payload.name,
              attributes: {
                "data-label-key": payload.name,
                title: `{{label "${payload.name}"}}`,
              },
              components: [
                [
                  {
                    type: "text",
                    tagName: "span",
                    selectable: true,
                    editable: false,
                    draggable: false,
                    attributes: {
                      "data-label-key": payload.name,
                      title: payload.name,
                      contenteditable: "false",
                    },
                    content: payload.displayLabel || payload.name,
                  },
                ],
              ],
            },
            {
              type: "text",
              tagName: "p",
              editable: true,
              draggable: false,
              components: [
                {
                  type: "textnode",
                  content: ": ",
                },
                {
                  type: "text",
                  tagName: "span",
                  selectable: true,
                  editable: false,
                  draggable: false,
                  attributes: {
                    "data-token":
                      payload.formattedToken ||
                      buildVariableToken({
                        variableType: payload.type,
                        parentType: payload.parentType,
                        variablePath: varPath,
                        keyName: payload.name,
                      }),
                    title:
                      payload.formattedToken ||
                      buildVariableToken({
                        variableType: payload.type,
                        parentType: payload.parentType,
                        variablePath: varPath,
                        keyName: payload.name,
                      }),
                    contenteditable: "false",
                  },
                  content: getSimplifiedTokenDisplay(
                    payload.formattedToken ||
                      buildVariableToken({
                        variableType: payload.type,
                        parentType: payload.parentType,
                        variablePath: varPath,
                        keyName: payload.name,
                      }),
                    varPath,
                  ),
                },
              ],
            },
          ],
        };
        const addedComponent = gridTarget
          .components()
          .add(subGridComponentDefinition);
        if (Array.isArray(addedComponent)) {
          editor.select(addedComponent[0] || gridTarget);
        } else {
          editor.select(addedComponent || gridTarget);
        }
        return;
      }
    } else {
      editor.addComponents({
        type: "text",
        tagName: "p",
        components: [
          {
            type: "text",
            tagName: "span",
            selectable: true,
            editable: false,
            draggable: false,
            attributes: {
              "data-token": tokenValue,
              title: tokenValue,
              contenteditable: "false",
            },
            content: simplifiedToken,
          },
        ],
      });
    }
  };

  const canDrag = variable.type !== "data" && variable.type !== "preferences";
  const didDragRef = React.useRef(false);

  /**
   * Handle drag start - passes variable data including example data and formatting
   * info for canvas display. The canvas will show formatted example data values
   * while the template stores Handlebar tokens with formatting helpers.
   *
   * Requirements: 1.1, 1.2, 1.9 - Display formatted example data in canvas
   * @param e
   */
  const handleDragStart = (e) => {
    if (!canDrag) {
      return;
    }

    didDragRef.current = true;

    const payload = buildVariableDragPayload({
      variable,
      nestedColumns,
      formattedExampleValue,
      exampleValue,
      displayLabel,
      fullKey,
    });
    const serializedPayload = JSON.stringify(payload);

    e.dataTransfer.effectAllowed = "copy";
    e.dataTransfer.dropEffect = "copy";
    e.dataTransfer.setData("variable/json", serializedPayload);
    // Cross-frame fallback: some browsers require a generic MIME type.
    e.dataTransfer.setData("text/plain", serializedPayload);
  };

  const handleDragEnd = () => {
    window.setTimeout(() => {
      didDragRef.current = false;
    }, 0);
  };

  const handleItemClick = () => {
    if (didDragRef.current) {
      return;
    }

    if (
      variable.type === "relations" ||
      variable.type === "data" ||
      variable.type === "preferences"
    ) {
      return;
    }

    handleInsert();
  };

  // Non-relation item with tooltip showing Handlebar token
  if (!isRelation || variable.typeRelation == "morph") {
    if (variable.type == "relations") return null;
    return (
      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              className="flex flex-col px-2 py-1 border rounded-md hover:bg-muted cursor-pointer transition-colors mt-1"
              draggable={canDrag}
              onClick={handleItemClick}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <span className="text-sm font-medium">{displayLabel}</span>
              {/* Show formatted example value if available, otherwise show token */}
              {!(
                variable.type === "data" || variable.type === "preferences"
              ) && (
                <span className="text-xs text-muted-foreground truncate">
                  {formattedExampleValue ? (
                    <span className="text-emerald-600 dark:text-emerald-400">
                      {formattedExampleValue}
                    </span>
                  ) : (
                    <code>{handlebarToken}</code>
                  )}
                </span>
              )}
            </div>
          </TooltipTrigger>
          {/* Requirement 1.7: Show Handlebar token in tooltip on hover */}
          {!(variable.type === "data" || variable.type === "preferences") && (
            <TooltipContent side="left" className="max-w-xs">
              <div className="space-y-1">
                <p className="font-medium text-xs">{displayLabel}</p>
                <code className="text-xs block bg-muted px-1.5 py-0.5 rounded">
                  {isFormattableType(variable.type)
                    ? getFormattedHandlebarToken(variable, fullKey)
                    : handlebarToken}
                </code>
                {formattedExampleValue && (
                  <p className="text-xs text-muted-foreground">
                    Contoh:{" "}
                    <span className="text-emerald-600">
                      {formattedExampleValue}
                    </span>
                  </p>
                )}
              </div>
            </TooltipContent>
          )}
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Requirement 13.1, 13.2, 13.3: Hide nested columns for "relations" type,
  // keep collapsible for "relation", "data", and "preferences" types.
  // "relations" items remain draggable to create relation tables.
  const isRelationsMany = variable.type === "relations";

  // Relation item with collapsible nested columns
  return (
    <Collapsible className="mt-1" open={isOpen} onOpenChange={handleOpenChange}>
      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              className={cn(
                "flex w-full items-stretch rounded-md border transition-colors",
                "hover:bg-muted",
              )}
            >
              {/* Hide chevron for "relations" (many) type - Requirement 13.1 */}
              {!isRelationsMany && (
                <button
                  type="button"
                  onClick={toggleOpenState}
                  className={cn(
                    "flex h-10 w-9 items-center justify-center rounded-l-md border-r border-border/60",
                    "text-muted-foreground transition-colors hover:text-foreground",
                  )}
                >
                  <ChevronRight
                    className={cn(
                      "h-4 w-4 transition-transform duration-200",
                      isOpen && "rotate-90",
                    )}
                  />
                </button>
              )}

              <button
                type="button"
                draggable={canDrag}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                onClick={handleItemClick}
                className={cn(
                  "flex min-w-0 flex-1 flex-col justify-center px-2 py-1 text-left",
                  isRelationsMany && "rounded-l-md",
                )}
              >
                <span className="truncate text-sm font-medium">
                  {displayLabel}
                </span>
                {!(
                  variable.type === "data" || variable.type === "preferences"
                ) && (
                  <span className="truncate text-xs text-muted-foreground">
                    <code>{handlebarToken}</code>
                  </span>
                )}
              </button>
            </div>
          </TooltipTrigger>
          {/* Requirement 1.7: Tooltip with token info for relations */}
          {!(variable.type === "data" || variable.type === "preferences") && (
            <TooltipContent side="left" className="max-w-xs">
              <div className="space-y-1">
                <p className="font-medium text-xs">{displayLabel}</p>
                <code className="text-xs block bg-muted px-1.5 py-0.5 rounded">
                  {handlebarToken}
                </code>
                <p className="text-xs text-muted-foreground">
                  {variable.type === "relations"
                    ? "Tabel relasi (drag untuk membuat tabel)"
                    : "Relasi (klik untuk expand)"}
                </p>
              </div>
            </TooltipContent>
          )}
        </Tooltip>
      </TooltipProvider>

      {/* Hide CollapsibleContent for "relations" (many) type - Requirement 13.1 */}
      {/* Keep collapsible for "relation", "data", "preferences" - Requirement 13.2 */}
      {!isRelationsMany && (
        <CollapsibleContent className="pl-4 mt-1 border-l border-muted-foreground/25">
          {isLoadingColumns && (
            <p className="px-2 py-1 text-xs text-muted-foreground">
              Memuat kolom...
            </p>
          )}

          {columnsError && (
            <p className="px-2 py-1 text-xs text-destructive">{columnsError}</p>
          )}

          {nestedColumns.map((sub) => {
            const parentType =
              variable.type === "data" || variable.type === "preferences"
                ? variable.type
                : variable.parentType;

            return (
              <VariableItem
                key={`${fullKey}.${sub.name}`}
                path={
                  variable.type === "data" || variable.type === "preferences"
                    ? ""
                    : fullKey
                }
                parentType={parentType}
                exampleData={exampleData}
                {...sub}
              />
            );
          })}
        </CollapsibleContent>
      )}
    </Collapsible>
  );
}

export default VariableItem;
