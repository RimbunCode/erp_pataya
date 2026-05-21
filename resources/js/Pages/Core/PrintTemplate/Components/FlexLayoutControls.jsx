import React, { useMemo } from "react";
import { Input } from "@/Components/ui/input";

const justifyOptions = [
  "flex-start",
  "center",
  "flex-end",
  "space-between",
  "space-around",
  "space-evenly",
];

const alignOptions = [
  "stretch",
  "flex-start",
  "center",
  "flex-end",
  "baseline",
];

function FlexLayoutControls({ component }) {
  const componentStyle = useMemo(
    () => component?.getStyle?.() || {},
    [component],
  );

  const updateStyle = (property, value) => {
    if (!component) {
      return;
    }

    component.setStyle({
      ...component.getStyle(),
      [property]: value,
    });
  };

  return (
    <div className="space-y-3 rounded-md border border-border/60 bg-background p-3">
      <div className="grid grid-cols-2 gap-2">
        <label className="space-y-1">
          <span className="text-[11px] font-medium text-muted-foreground">
            Justify Content
          </span>
          <select
            value={componentStyle["justify-content"] || "flex-start"}
            onChange={(event) =>
              updateStyle("justify-content", event.target.value)
            }
            className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
          >
            {justifyOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1">
          <span className="text-[11px] font-medium text-muted-foreground">
            Align Content
          </span>
          <select
            value={componentStyle["align-content"] || "stretch"}
            onChange={(event) =>
              updateStyle("align-content", event.target.value)
            }
            className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
          >
            {alignOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1">
          <span className="text-[11px] font-medium text-muted-foreground">
            Align Items
          </span>
          <select
            value={componentStyle["align-items"] || "stretch"}
            onChange={(event) => updateStyle("align-items", event.target.value)}
            className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
          >
            {alignOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
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

export default FlexLayoutControls;
