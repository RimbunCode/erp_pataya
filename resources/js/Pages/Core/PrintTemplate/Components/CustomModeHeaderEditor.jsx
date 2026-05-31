import React, { useCallback, useMemo, useState } from "react";
import { useLaravelReactI18n } from "laravel-react-i18n";
import { useEditor } from "@grapesjs/react";
import { toast } from "sonner";
import { PlusIcon, Trash2Icon } from "lucide-react";
import { Button } from "@/Components/ui/button";
import { Input } from "@/Components/ui/input";
import { Label } from "@/Components/ui/label";
import {
  canAddHeaderRow,
  canRemoveHeaderRow,
  validateSpan,
  buildOccupancyGrid,
} from "../utils/customModeUtils";

/**
 * Editor for managing header rows, colspan/rowspan configuration in Custom Mode.
 *
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
    return tableComponent.components().find(
      (c) => (c.get("tagName") || "").toLowerCase() === "thead",
    );
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

  const handleApplySpan = useCallback(() => {
    if (!selectedCell || !thead) return;

    const colspan = parseInt(colspanInput, 10);
    const rowspan = parseInt(rowspanInput, 10);

    if (isNaN(colspan) || isNaN(rowspan)) {
      toast.error(t("core.printTemplate.editor.invalid_span", {}, "Invalid span values"));
      return;
    }

    // Find the cell position in the grid
    let cellRowIndex = -1;
    let cellColIndex = -1;

    thead.components().forEach((row, rIdx) => {
      row.components().forEach((cell, cIdx) => {
        if (cell === selectedCell) {
          cellRowIndex = rIdx;
          cellColIndex = cIdx;
        }
      });
    });

    if (cellRowIndex === -1) return;

    // Build HeaderGrid for validation
    const totalRows = headerRowCount;
    const totalColumns = thead.components().at(0)?.components()?.length || 1;
    const gridRows = [];

    thead.components().forEach((row, rIdx) => {
      const rowCells = [];
      row.components().forEach((cell, cIdx) => {
        rowCells.push({
          rowIndex: rIdx,
          colIndex: cIdx,
          colspan: parseInt(cell.getAttributes()?.colspan || "1", 10),
          rowspan: parseInt(cell.getAttributes()?.rowspan || "1", 10),
        });
      });
      gridRows.push(rowCells);
    });

    const headerGrid = { totalRows, totalColumns, rows: gridRows };

    const result = validateSpan(
      headerGrid,
      cellRowIndex,
      cellColIndex,
      colspan,
      rowspan,
    );

    if (!result.valid) {
      toast.error(result.error || t("core.printTemplate.editor.span_conflict", {}, "Cell span conflicts with existing cells"));
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
    toast.success(t("core.printTemplate.editor.span_applied", {}, "Span applied"));
  }, [colspanInput, editor, headerRowCount, rowspanInput, selectedCell, thead, t]);

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
          <span className="text-foreground font-semibold">{headerRowCount}</span>
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
            <Button
              size="sm"
              variant="ghost"
              className="h-6 w-6 p-0 text-destructive hover:bg-destructive/10"
              onClick={() => handleRemoveRow(idx)}
              disabled={!canRemoveHeaderRow(headerRowCount)}
            >
              <Trash2Icon className="h-3 w-3" />
            </Button>
          </div>
        ))}
      </div>

      {/* Colspan/Rowspan editor — shown when a <th> is selected */}
      {selectedCell && (
        <div className="space-y-2 rounded-md border p-2">
          <p className="text-xs font-medium text-muted-foreground">
            {t("core.printTemplate.editor.cell_span", {}, "Cell Span (selected header cell)")}
          </p>
          <div className="flex gap-2">
            <div className="flex-1 space-y-1">
              <Label className="text-xs">
                {t("core.printTemplate.editor.colspan", {}, "Colspan")}
              </Label>
              <Input
                type="number"
                min={1}
                value={colspanInput}
                onChange={(e) => setColspanInput(e.target.value)}
                className="h-7 text-xs"
              />
            </div>
            <div className="flex-1 space-y-1">
              <Label className="text-xs">
                {t("core.printTemplate.editor.rowspan", {}, "Rowspan")}
              </Label>
              <Input
                type="number"
                min={1}
                value={rowspanInput}
                onChange={(e) => setRowspanInput(e.target.value)}
                className="h-7 text-xs"
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
