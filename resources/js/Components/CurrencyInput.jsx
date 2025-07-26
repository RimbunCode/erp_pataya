import React, { forwardRef } from "react";

import CurrencyInputOri from "react-currency-input-field";
import { cn } from "@/lib/utils";
import { usePage } from "@inertiajs/react";

export default forwardRef(function CurrencyInput(
  { className, value, ...props },
  ref,
) {
  const { lang } = usePage().props;
  return (
    <CurrencyInputOri
      ref={ref}
      intlConfig={{ locale: lang == "id" ? "id-ID" : "en-US" }}
      value={Number.isNaN(value) ? "" : (value ?? "")}
      decimalsLimit={6}
      placeholder="0.00"
      className={cn(
        "text-right focus:!border-0 flex h-8 w-full rounded-md border border-input bg-muted px-3 py-2 text-base ring-offset-background  placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        className,
      )}
      {...props}
    />
  );
});
