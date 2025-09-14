import React, { forwardRef, useEffect, useRef, useState } from "react";

import CurrencyInputOri from "@/Components/CurrencyInput/index.esm";
import { cn } from "@/lib/utils";
import useDidMountEffect from "@/Hooks/useDidMountEffect";
import { useLaravelReactI18n } from "laravel-react-i18n";
import { usePage } from "@inertiajs/react";

/**
 * @typedef {import('@/Components/CurrencyInput/index.d.ts').CurrencyInputProps} CurrencyInputProps
 * @type {React.ForwardRefRenderFunction<CurrencyInputProps>}
 */
export default forwardRef(function CurrencyInput(
  { className, value, onValueChange, currencyCode, ...props },
  ref,
) {
  const { t, loading } = useLaravelReactI18n();
  const { default_currency_id } = usePage().props.preferences;
  const prevValueRef = useRef(value);
  const [data, setData] = useState({
    value: value?.toString() ?? "",
    values: { float: Number.isNaN(value) ? null : value },
  });

  // update if value changed from parent
  useDidMountEffect(() => {
    if (prevValueRef.current === value) return;
    prevValueRef.current = value;
    setData({
      value: value?.toString() ?? "",
      values: { float: Number.isNaN(value) ? null : value },
    });
  }, [value]);

  // update value parent
  useEffect(() => {
    if (!onValueChange) return;
    const float = data?.values?.float;
    if (prevValueRef.current === float) return;
    prevValueRef.current = float;
    onValueChange(float);
  }, [data, onValueChange]);
  return (
    <CurrencyInputOri
      ref={ref}
      intlConfig={{
        locale: loading ? undefined : t("lang.locale"),
        currency:
          currencyCode == "default"
            ? default_currency_id
            : !currencyCode
              ? undefined
              : currencyCode,
      }}
      value={data?.value ?? ""}
      onValueChange={(value, name, values) => setData({ value, name, values })}
      onKeyDown={(e) => {
        if (
          e.key == "Enter" ||
          e.altKey ||
          e.ctrlKey ||
          e.metaKey ||
          e.shiftKey
        ) {
          e.target.blur();
        }
      }}
      decimalsLimit={10}
      className={cn(
        "text-right focus:border-0! flex h-8 w-full rounded-md border border-input bg-muted px-3 py-2 text-base ring-offset-background  placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        className,
      )}
      {...props}
    />
  );
});
