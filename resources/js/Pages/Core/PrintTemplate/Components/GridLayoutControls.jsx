import React, { useEffect, useMemo, useState } from "react";
import { Button } from "@/Components/ui/button";
import { Input } from "@/Components/ui/input";

const alignmentOptions = [
  "normal",
  "start",
  "end",
  "center",
  "stretch",
  "space-between",
  "space-around",
  "space-evenly",
];

function splitTrackList(trackList) {
  if (!trackList || typeof trackList !== "string") {
    return ["1fr"];
  }

  const parts = [];
  let buffer = "";
  let parenthesisDepth = 0;

  for (const char of trackList.trim()) {
    if (char === "(") {
      parenthesisDepth += 1;
      buffer += char;
      continue;
    }

    if (char === ")") {
      parenthesisDepth = Math.max(0, parenthesisDepth - 1);
      buffer += char;
      continue;
    }

    if (char === " " && parenthesisDepth === 0) {
      const trimmed = buffer.trim();
      if (trimmed) {
        parts.push(trimmed);
      }
      buffer = "";
      continue;
    }

    buffer += char;
  }

  const tail = buffer.trim();
  if (tail) {
    parts.push(tail);
  }

  return parts.length ? parts : ["1fr"];
}

function GridLayoutControls({ component }) {
  const [columns, setColumns] = useState(["1fr"]);

  useEffect(() => {
    const style = component?.getStyle?.() || {};
    setColumns(splitTrackList(style["grid-template-columns"]));
  }, [component]);

  const componentStyle = useMemo(
    () => component?.getStyle?.() || {},
    [component],
  );

  const updateStyle = (property, value) => {
    if (!component) {
      return;
    }

    const nextStyle = {
      ...component.getStyle(),
      [property]: value,
    };

    component.setStyle(nextStyle);
  };

  const updateColumns = (nextColumns) => {
    setColumns(nextColumns);
    updateStyle("grid-template-columns", nextColumns.join(" "));
  };

  return (
    <div className="space-y-3 rounded-md border border-border/60 bg-background p-3">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Grid Columns
          </p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            onClick={() => updateColumns([...columns, "1fr"])}
          >
            + Kolom
          </Button>
        </div>
        <div className="space-y-2">
          {columns.map((column, index) => (
            <div key={`${index}-${column}`} className="flex items-center gap-2">
              <Input
                value={column}
                onChange={(event) => {
                  const nextColumns = [...columns];
                  nextColumns[index] = event.target.value || "1fr";
                  updateColumns(nextColumns);
                }}
                className="h-8 text-xs font-mono"
                placeholder="1fr"
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 px-2 text-xs"
                disabled={columns.length <= 1}
                onClick={() => {
                  const nextColumns = columns.filter(
                    (_, columnIndex) => columnIndex !== index,
                  );
                  updateColumns(nextColumns.length ? nextColumns : ["1fr"]);
                }}
              >
                Hapus
              </Button>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {[
          ["justify-content", "Justify Content"],
          ["align-content", "Align Content"],
          ["justify-items", "Justify Items"],
          ["align-items", "Align Items"],
        ].map(([property, label]) => (
          <label key={property} className="space-y-1">
            <span className="text-[11px] font-medium text-muted-foreground">
              {label}
            </span>
            <select
              value={componentStyle[property] || "normal"}
              onChange={(event) => updateStyle(property, event.target.value)}
              className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
            >
              {alignmentOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="space-y-1">
          <span className="text-[11px] font-medium text-muted-foreground">
            Column Gap
          </span>
          <Input
            value={componentStyle["column-gap"] || ""}
            onChange={(event) => updateStyle("column-gap", event.target.value)}
            className="h-8 text-xs"
            placeholder="12px"
          />
        </label>
        <label className="space-y-1">
          <span className="text-[11px] font-medium text-muted-foreground">
            Row Gap
          </span>
          <Input
            value={componentStyle["row-gap"] || ""}
            onChange={(event) => updateStyle("row-gap", event.target.value)}
            className="h-8 text-xs"
            placeholder="8px"
          />
        </label>
      </div>
    </div>
  );
}

export default GridLayoutControls;
