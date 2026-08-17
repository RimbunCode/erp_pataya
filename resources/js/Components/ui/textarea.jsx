import * as React from "react";

import { cn } from "@/lib/utils";
import { DIFF_HIGHLIGHT, isChanged } from "@/lib/diffUtils";
import StrikethroughDiff from "@/Components/StrikethroughDiff";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/Components/ui/tooltip";

const Textarea = React.forwardRef(
  (
    { className, rows, value, valueBefore, onValueChange, onChange, ...props },
    ref,
  ) => {
    const changed = valueBefore !== undefined && isChanged(valueBefore, value);
    const textarea = (
      <textarea
        className={cn(
          rows == 1 && "min-h-8",
          rows == 2 && "min-h-16",
          rows >= 2 && "min-h-[80px]",
          "focus:border-0! flex overflow-y-auto w-full rounded-md border border-input bg-muted px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          changed && DIFF_HIGHLIGHT,
          className,
        )}
        onChange={(e) => {
          onValueChange?.(e.target.value);
          onChange?.(e);
        }}
        value={value ?? ""}
        ref={ref}
        rows={rows}
        {...props}
      />
    );

    if (valueBefore === undefined) {
      return textarea;
    }

    return (
      <Tooltip>
        <TooltipTrigger asChild>{textarea}</TooltipTrigger>
        {changed && (
          <TooltipContent side="top" align="start" className="max-w-sm">
            <StrikethroughDiff
              oldText={valueBefore ?? ""}
              newText={value ?? ""}
            />
          </TooltipContent>
        )}
      </Tooltip>
    );
  },
);
Textarea.displayName = "Textarea";

export { Textarea };
