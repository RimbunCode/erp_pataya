import * as React from "react";

import { cn } from "@/lib/utils";

const Textarea = React.forwardRef(
  ({ className, rows, onValueChange, onChange, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          rows == 1 && "min-h-8",
          rows == 2 && "min-h-16",
          rows >= 2 && "min-h-[80px]",
          "focus:border-0! flex overflow-y-auto w-full rounded-md border border-input bg-muted px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className,
        )}
        onChange={(e) => {
          onValueChange?.(e.target.value);
          onChange?.(e);
        }}
        ref={ref}
        rows={rows}
        {...props}
      />
    );
  },
);
Textarea.displayName = "Textarea";

export { Textarea };
