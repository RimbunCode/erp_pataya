/**
 * Komponen VariableItem - Menampilkan item variabel yang dapat di-drag ke canvas editor.
 * Mendukung tampilan data contoh, tooltip token Handlebar, format mata uang/angka,
 * layout grid dengan label dan nilai, serta kolom nested untuk relasi.
 *
 * @module VariableItem
 * @param {object} props
 * @param {string} props.path - Path parent dalam notasi dot
 * @param {object|null} props.exampleData - Data contoh dari backend untuk preview
 * @param {string} props.name - Nama variabel
 * @param {string} props.type - Tipe variabel (relation, relations, doc, docInfo, company, dll)
 * @param {string} [props.parentType] - Tipe parent variabel
 * @param {Array} [props.columns] - Kolom-kolom nested untuk relasi
 * @param {string} [props.related] - Model relasi untuk fetch kolom
 * @param {string} [props.typeRelation] - Tipe relasi (basic, morph)
 */
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
import { useLaravelReactI18n } from "laravel-react-i18n";
import axios from "axios";
import {
  formatColumnValue,
  getFormattedHandlebarToken,
  isFormattableType,
  resolveExampleValue,
  getHandlebarToken,
  getDisplayLabel,
} from "../utils/variableTokenUtils";
import {
  buildVariableToken,
  getSimplifiedTokenDisplay,
  buildVariableDragPayload,
  tryInsertInlineVariableToken,
} from "../utils/variableInsertUtils";
import { SUBGRID_CLASS, SUBGRID_RULE_STYLE } from "../utils/gridConstants";

// Re-export untuk backward compatibility - consumer eksternal yang mengimport dari VariableItem.jsx
export { buildVariableDragPayload } from "../utils/variableInsertUtils";

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
      variable.type === "doc" ||
      variable.type === "docInfo" ||
      variable.type === "company") &&
    (hasInlineColumns || canFetchColumns);

  const [nestedColumns, setNestedColumns] = React.useState(
    hasInlineColumns ? variable.columns : [],
  );
  const [isLoadingColumns, setIsLoadingColumns] = React.useState(false);
  const [hasFetchedColumns, setHasFetchedColumns] =
    React.useState(hasInlineColumns);
  const [columnsError, setColumnsError] = React.useState(null);
  const [isOpen, setIsOpen] = React.useState(false);

  // Menghitung nilai contoh dari exampleData berdasarkan fullKey dan tipe variabel
  const exampleValue = React.useMemo(() => {
    const rawValue = resolveExampleValue(
      exampleData,
      fullKey,
      variable.parentType || variable.type,
    );
    return rawValue;
  }, [exampleData, fullKey, variable.parentType, variable.type]);

  // Memformat nilai contoh berdasarkan tipe kolom (currency/number) - Requirements: 1.9
  const formattedExampleValue = React.useMemo(() => {
    if (exampleValue == null) return null;
    if (isFormattableType(variable.type)) {
      return formatColumnValue(exampleValue, variable);
    }
    return exampleValue;
  }, [exampleValue, variable]);

  // Menghasilkan token Handlebar untuk ditampilkan di tooltip
  const handlebarToken = React.useMemo(() => {
    return getHandlebarToken({ ...variable, name: fullKey });
  }, [variable, fullKey]);

  // Mengambil label tampilan variabel menggunakan terjemahan atau title
  const displayLabel = React.useMemo(() => {
    return getDisplayLabel(variable, t);
  }, [variable, t]);

  // Mengambil kolom nested dari API saat relasi di-expand - dipicu oleh canFetchColumns, hasFetchedColumns, relationModel
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

  // Menangani perubahan state buka/tutup collapsible - memicu fetch kolom jika belum ada
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
   * Menyisipkan variabel ke canvas editor.
   * Alur eksekusi:
   * 1. Coba sisipkan inline jika komponen teks sedang diedit
   * 2. Jika komponen grid/subgrid dipilih, buat baris subgrid baru
   * 3. Jika komponen teks biasa dipilih, tambahkan span token
   * 4. Fallback: tambahkan paragraf baru dengan token
   *
   * Efek samping: memodifikasi canvas editor dan memicu event update
   */
  const handleInsert = () => {
    if (!editor) return;

    const selected = editor.getSelected();
    // Gunakan token terformat untuk tipe currency/number (Requirement 1.9)
    const token = getFormattedHandlebarToken(variable, fullKey);

    // Coba sisipkan inline terlebih dahulu
    if (tryInsertInlineVariableToken(editor, selected, token, fullKey)) {
      return;
    }

    const payload = buildVariableDragPayload({
      variable,
      nestedColumns,
      formattedExampleValue,
      exampleValue,
      displayLabel,
      fullKey,
    });
    const varPath = payload.fullKey || payload.name;

    // Helper lokal untuk menentukan tipe komponen di canvas
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

    // Jika komponen teks biasa dipilih, tambahkan span token ke dalamnya
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
      // Jika komponen grid/subgrid dipilih, buat baris subgrid baru dengan label dan nilai
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
      // Fallback: tambahkan paragraf baru dengan span token
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
   * Menangani event drag start - mengirim data variabel termasuk data contoh
   * dan informasi format ke canvas. Canvas akan menampilkan data contoh terformat
   * sementara template menyimpan token Handlebar dengan helper format.
   *
   * Efek samping: mengatur dataTransfer dengan payload JSON variabel
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
    // Fallback cross-frame: beberapa browser memerlukan MIME type generik
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
      variable.type === "doc" ||
      variable.type === "docInfo" ||
      variable.type === "company"
    ) {
      return;
    }

    handleInsert();
  };

  // Item non-relasi dengan tooltip menampilkan token Handlebar
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
              {/* Tampilkan nilai contoh terformat jika tersedia, jika tidak tampilkan token */}
              {!(
                variable.type === "doc" ||
                variable.type === "docInfo" ||
                variable.type === "company"
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
          {/* Requirement 1.7: Tampilkan token Handlebar di tooltip saat hover */}
          {!(
            variable.type === "doc" ||
            variable.type === "docInfo" ||
            variable.type === "company"
          ) && (
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

  // Requirement 13.1, 13.2, 13.3: Sembunyikan kolom nested untuk tipe "relations",
  // pertahankan collapsible untuk "relation", "data", dan "preferences".
  const isRelationsMany = variable.type === "relations";

  // Item relasi dengan kolom nested yang bisa di-collapse
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
              {/* Sembunyikan chevron untuk tipe "relations" (many) - Requirement 13.1 */}
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
                  variable.type === "doc" ||
                  variable.type === "docInfo" ||
                  variable.type === "company"
                ) && (
                  <span className="truncate text-xs text-muted-foreground">
                    <code>{handlebarToken}</code>
                  </span>
                )}
              </button>
            </div>
          </TooltipTrigger>
          {/* Requirement 1.7: Tooltip dengan info token untuk relasi */}
          {!(
            variable.type === "doc" ||
            variable.type === "docInfo" ||
            variable.type === "company"
          ) && (
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

      {/* Sembunyikan CollapsibleContent untuk tipe "relations" (many) - Requirement 13.1 */}
      {/* Pertahankan collapsible untuk "relation", "data", "preferences" - Requirement 13.2 */}
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
              variable.type === "doc" ||
              variable.type === "docInfo" ||
              variable.type === "company"
                ? variable.type
                : variable.parentType;

            return (
              <VariableItem
                key={`${fullKey}.${sub.name}`}
                path={
                  variable.type === "doc" ||
                  variable.type === "docInfo" ||
                  variable.type === "company"
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
