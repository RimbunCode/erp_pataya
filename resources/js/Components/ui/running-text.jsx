import * as React from "react";

import { Slot as SlotPrimitive } from "@radix-ui/react-slot";
import { cn } from "@/lib/utils";

const RunningText = React.forwardRef(
  ({ asChild = false, className, children, ...props }, ref) => {
    const Component = asChild ? SlotPrimitive : "div";

    return (
      <Component ref={ref} className={cn("running-text", className)} {...props}>
        {children}
      </Component>
    );
  },
);
RunningText.displayName = "RunningText";

function RunningTextContent({ text, className }) {
  return (
    <span className={cn("running-text-track gap-8", className)}>
      <span>{text}</span>
    </span>
  );
}

export { RunningText, RunningTextContent };
