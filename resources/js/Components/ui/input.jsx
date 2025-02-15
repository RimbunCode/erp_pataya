import * as React from "react";

import { useEffect, useImperativeHandle, useRef } from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef(
  ({ className, isFocused = false, type, ...props }, ref) => {
    const localRef = useRef(null);

    useImperativeHandle(ref, () => ({
      focus: () => localRef.current?.focus(),
    }));

    useEffect(() => {
      if (isFocused) {
        localRef.current?.focus();
      }
    }, [isFocused]);
    return (
      <input
        type={type}
        className={cn(
          "focus:!border-0 flex h-8 w-full rounded-md border border-input bg-muted px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className,
        )}
        ref={localRef}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
