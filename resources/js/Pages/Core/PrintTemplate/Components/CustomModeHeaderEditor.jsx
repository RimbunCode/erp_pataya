import React, { useCallback, useMemo, useState } from "react";
import { useLaravelReactI18n } from "laravel-react-i18n";
import { useEditor } from "@grapesjs/react";
import { gooeyToast as toast } from "@/lib/gooeyToast";
import {
  PlusIcon,
  Trash2Icon,
  ChevronUpIcon,
  ChevronDownIcon,
} from "lucide-react";
import { Button } from "@/Components/ui/button";
import NumberInput from "@/Components/NumberInput";
import { Label } from "@/Components/ui/label";
import {
  canAddHeaderRow,
  canRemoveHeaderRow,
  validateSpan,
  computeVisualColIndex,
} from "../utils/customModeUtils";

function getHeaderCellRows(thead) {
  const rows = [];
  if (!thead) return rows;
  thead.components().forEach((row) => {
    if ((row.get("tagName") || "").toLowerCase() === "tr") {
      rows.push(
        row
          .components()
          .filter((cell) => (cell.get("tagName") || "").toLowerCase() === "th"),
      );
    }
  });
  return rows;
}

function buildHeaderGridFromRows(rows) {
  const totalRows = rows.length;
  const totalColumns = rows[0]?.length || 1;
  const gridRows = [];

  rows.forEach((row, rIdx) => {
    const rowCells = [];
    row.forEach((cell, cIdx) => {
      const attrs = cell.getAttributes?.() || {};
      rowCells.push({
        rowIndex: rIdx,
        colIndex: computeVisualColIndex(rows, rIdx, cIdx),
        colspan: parseInt(attrs.colspan || "1", 10),
        rowspan: parseInt(attrs.rowspan || "1", 10),
      });
    });
    gridRows.push(rowCells);
  });

  return { totalRows, totalColumns, rows: gridRows };
}

/**
 * Editor for managing header rows, colspan/rowspan configuration in Custom Mode.
 * @param {object} props
 * @param {object} props.tableComponent - GrapesJS gjsRelationsTable component
 */
function CustomModeHeaderEditor({ tableComponent }) {
  const editor = useEditor();
  const { t } = useLaravelReactI18n();
  const [selectedCell, setSelectedCell] = useState(null);
  const [colspanInput, setColspanInput] = useState("1");
  const [rowspanInput, setRowspanInput] = useState("1");

  const thead = useMemo(() => {
    if (!tableComponent) return null;
    return tableComponent
      .components()
      .find((c) => (c.get("tagName") || "").toLowerCase() === "thead");
  }, [tableComponent]);

  const headerRows = useMemo(() => {
    if (!thead) return [];
    const rows = [];
    thead.components().forEach((row) => rows.push(row));
    return rows;
  }, [thead]);

  const headerRowCount = headerRows.length;

  const handleAddRow = useCallback(() => {
    if (!thead) return;

    if (!canAddHeaderRow(headerRowCount)) {
      toast.error(
        t(
          "core.printTemplate.editor.max_header_rows",
          {},
          "Maximum 5 header rows allowed",
        ),
      );
      return;
    }

    // Determine number of columns from first row
    const firstRow = thead.components().at(0);
    const colCount = firstRow ? firstRow.components().length : 1;

    const newCells = Array.from({ length: colCount }, () => ({
      tagName: "th",
      content: "",
      selectable: true,
      droppable: true,
      editable: true,
      attributes: {
        class: "border border-gray-400 px-2 py-1 text-left bg-gray-100",
      },
    }));

    thead.components().add({
      tagName: "tr",
      selectable: false,
      droppable: false,
      layerable: false,
      editable: false,
      draggable: false,
      components: newCells,
    });

    editor.trigger("update");
  }, [editor, headerRowCount, thead, t]);

  const handleRemoveRow = useCallback(
    (rowIndex) => {
      if (!thead) return;

      if (!canRemoveHeaderRow(headerRowCount)) {
        toast.error(
          t(
            "core.printTemplate.editor.min_header_rows",
            {},
            "At least one header row is required",
          ),
        );
        return;
      }

      const row = thead.components().at(rowIndex);
      if (row) {
        row.remove();
        editor.trigger("update");
      }
    },
    [editor, headerRowCount, thead, t],
  );

  const handleMoveRowUp = useCallback(
    (rowIndex) => {
      if (!thead || rowIndex === 0) return;

      const rows = thead.components();
      const currentRow = rows.at(rowIndex);
      const previousRow = rows.at(rowIndex - 1);

      if (!currentRow || !previousRow) return;

      // Swap by removing and re-adding at correct positions
      currentRow.remove();
      thead.components().add(currentRow, { at: rowIndex - 1 });
      editor.trigger("update");
    },
    [editor, thead],
  );

  const handleMoveRowDown = useCallback(
    (rowIndex) => {
      if (!thead || rowIndex >= headerRowCount - 1) return;

      const rows = thead.components();
      const currentRow = rows.at(rowIndex);

      if (!currentRow) return;

      // Remove and re-add at next position
      currentRow.remove();
      thead.components().add(currentRow, { at: rowIndex + 1 });
      editor.trigger("update");
    },
    [editor, headerRowCount, thead],
  );

  const handleApplySpan = useCallback(() => {
    if (!selectedCell || !thead) return;

    const colspan = parseInt(colspanInput, 10);
    const rowspan = parseInt(rowspanInput, 10);

    if (isNaN(colspan) || isNaN(rowspan)) {
      toast.error(
        t("core.printTemplate.editor.invalid_span", {}, "Invalid span values"),
      );
      return;
    }

    // Find the cell position in the grid
    const rows = getHeaderCellRows(thead);
    let cellRowIndex = -1;
    let _cellColIndex = -1;
    let cellVisualColIndex = -1;

    rows.forEach((row, rIdx) => {
      row.forEach((cell, cIdx) => {
        if (cell === selectedCell) {
          cellRowIndex = rIdx;
          _cellColIndex = cIdx;
          cellVisualColIndex = computeVisualColIndex(rows, rIdx, cIdx);
        }
      });
    });

    if (cellRowIndex === -1) return;

    // Build HeaderGrid for validation
    const headerGrid = buildHeaderGridFromRows(rows);

    const result = validateSpan(
      headerGrid,
      cellRowIndex,
      cellVisualColIndex,
      colspan,
      rowspan,
    );

    if (!result.valid) {
      let errorMessage = "";
      if (result.errorCode === "colspan_out_of_bounds") {
        errorMessage = t(
          "core.printTemplate.editor.colspan_out_of_bounds",
          { max: result.params.max },
          `Colspan must be between 1 and ${result.params.max}`,
        );
      } else if (result.errorCode === "rowspan_out_of_bounds") {
        errorMessage = t(
          "core.printTemplate.editor.rowspan_out_of_bounds",
          { max: result.params.max },
          `Rowspan must be between 1 and ${result.params.max}`,
        );
      } else if (result.errorCode === "span_exceeds_width") {
        errorMessage = t(
          "core.printTemplate.editor.span_exceeds_width",
          {},
          "Cell span exceeds grid width",
        );
      } else if (result.errorCode === "span_exceeds_height") {
        errorMessage = t(
          "core.printTemplate.editor.span_exceeds_height",
          {},
          "Cell span exceeds grid height",
        );
      } else {
        errorMessage = t(
          "core.printTemplate.editor.span_conflict",
          {},
          "Cell span conflicts with existing cells",
        );
      }
      toast.error(errorMessage);
      return;
    }

    // Apply the span to the cell
    const currentAttrs = { ...(selectedCell.getAttributes() || {}) };
    if (colspan > 1) {
      currentAttrs.colspan = colspan;
    } else {
      delete currentAttrs.colspan;
    }
    if (rowspan > 1) {
      currentAttrs.rowspan = rowspan;
    } else {
      delete currentAttrs.rowspan;
    }
    selectedCell.setAttributes(currentAttrs);
    editor.trigger("update");
    toast.success(
      t("core.printTemplate.editor.span_applied", {}, "Span applied"),
    );
  }, [
    colspanInput,
    editor,
    headerRowCount,
    rowspanInput,
    selectedCell,
    thead,
    t,
  ]);

  // Listen for cell selection on canvas to update the selected cell state
  React.useEffect(() => {
    if (!editor) return;

    const onSelected = () => {
      const selected = editor.getSelected();
      if (!selected) {
        setSelectedCell(null);
        return;
      }

      const tag = (selected.get("tagName") || "").toLowerCase();
      if (tag === "th") {
        setSelectedCell(selected);
        const attrs = selected.getAttributes() || {};
        setColspanInput(String(attrs.colspan || 1));
        setRowspanInput(String(attrs.rowspan || 1));
      } else {
        setSelectedCell(null);
      }
    };

    editor.on("component:selected", onSelected);
    editor.on("component:deselected", onSelected);
    return () => {
      editor.off("component:selected", onSelected);
      editor.off("component:deselected", onSelected);
    };
  }, [editor]);

  return (
    <div className="space-y-3 p-3">
      {/* Header row management */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">
          {t("core.printTemplate.editor.header_rows", {}, "Header Rows")}:{" "}
          <span className="text-foreground font-semibold">
            {headerRowCount}
          </span>
          <span className="text-muted-foreground"> / 5</span>
        </span>
        <div className="flex gap-1">
          <Button
            size="sm"
            variant="outline"
            className="h-7 px-2 text-xs"
            onClick={handleAddRow}
            disabled={!canAddHeaderRow(headerRowCount)}
          >
            <PlusIcon className="h-3 w-3 mr-1" />
            {t("core.printTemplate.editor.add_row", {}, "Add Row")}
          </Button>
        </div>
      </div>

      {/* Row list with remove buttons */}
      <div className="space-y-1">
        {headerRows.map((_, idx) => (
          <div
            key={idx}
            className="flex items-center justify-between rounded-md border px-2 py-1"
          >
            <span className="text-xs text-muted-foreground">
              {t("core.printTemplate.editor.row", {}, "Row")} {idx + 1}
            </span>
            <div className="flex gap-1">
              <Button
                size="sm"
                variant="ghost"
                className="h-6 w-6 p-0"
                onClick={() => handleMoveRowUp(idx)}
                disabled={idx === 0}
                title={t("core.printTemplate.editor.move_up", {}, "Move Up")}
              >
                <ChevronUpIcon className="h-3 w-3" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 w-6 p-0"
                onClick={() => handleMoveRowDown(idx)}
                disabled={idx >= headerRowCount - 1}
                title={t(
                  "core.printTemplate.editor.move_down",
                  {},
                  "Move Down",
                )}
              >
                <ChevronDownIcon className="h-3 w-3" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 w-6 p-0 text-destructive hover:bg-destructive/10"
                onClick={() => handleRemoveRow(idx)}
                disabled={!canRemoveHeaderRow(headerRowCount)}
                title={t(
                  "core.printTemplate.editor.remove_row",
                  {},
                  "Remove Row",
                )}
              >
                <Trash2Icon className="h-3 w-3" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Colspan/Rowspan editor — shown when a <th> is selected */}
      {selectedCell && (
        <div className="space-y-2 rounded-md border p-2">
          <p className="text-xs font-medium text-muted-foreground">
            {t(
              "core.printTemplate.editor.cell_span",
              {},
              "Cell Span (selected header cell)",
            )}
          </p>
          <div className="flex gap-2">
            <div className="flex-1 space-y-1">
              <Label className="text-xs">
                {t("core.printTemplate.editor.colspan", {}, "Colspan")}
              </Label>
              <NumberInput
                allowDecimals={false}
                decimalScale={0}
                min={1}
                value={colspanInput}
                onValueChange={(val) => setColspanInput(val)}
                className="h-7 text-xs text-left"
              />
            </div>
            <div className="flex-1 space-y-1">
              <Label className="text-xs">
                {t("core.printTemplate.editor.rowspan", {}, "Rowspan")}
              </Label>
              <NumberInput
                allowDecimals={false}
                decimalScale={0}
                min={1}
                value={rowspanInput}
                onValueChange={(val) => setRowspanInput(val)}
                className="h-7 text-xs text-left"
              />
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="w-full h-7 text-xs"
            onClick={handleApplySpan}
          >
            {t("core.printTemplate.editor.apply_span", {}, "Apply Span")}
          </Button>
        </div>
      )}
    </div>
  );
}

export default CustomModeHeaderEditor;
