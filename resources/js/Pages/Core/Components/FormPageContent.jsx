import { cn } from "@/lib/utils";
import { forwardRef } from "react";

export default forwardRef(function FormPageContent(
  { children, className },
  ref,
) {
  return (
    <div ref={ref} className={cn(className, "px-4 py-4 !mt-0")}>
      {children}
    </div>
  );
});
