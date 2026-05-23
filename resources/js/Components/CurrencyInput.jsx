import CurrencyInputOri, {
  formatValue as formatValueOri,
} from "@/Components/CurrencyInput/index.esm";
import React, { forwardRef, useMemo, useRef, useState } from "react";

import { cn } from "@/lib/utils";
import useDidMountEffect from "@/Hooks/useDidMountEffect";
import { useLaravelReactI18n } from "laravel-react-i18n";
import { usePage } from "@inertiajs/react";

/**
 * @typedef {import('@/Components/CurrencyInput/index.d.ts').CurrencyInputProps} CurrencyInputProps
 * @type {React.ForwardRefRenderFunction<CurrencyInputProps>}
 */
export default forwardRef(function CurrencyInput(
  {
    className,
    value,
    onValueChange,
    currencyCode,
    decimalScale: _decimalScale,
    min,
    max,
    ...props
  },
  ref,
) {
  const { t, loading } = useLaravelReactI18n();
  const prevValueRef = useRef(value);
  const [data, setData] = useState({
    value: Number.isNaN(value) ? "" : (value?.toString() ?? ""),
    values: { float: Number.isNaN(value) ? null : value },
  });
  const [intlConfig, decimalScale] = useMemo(() => {
    const config = {
      locale: loading ? undefined : t("lang.locale"),
      currency: !currencyCode ? undefined : currencyCode,
    };
    try {
      const numberFormatter = config.locale
        ? new Intl.NumberFormat(config.locale, {
            ...(config.currency && {
              currency: config.currency,
              style: "currency",
            }),
          })
        : new Intl.NumberFormat();

      return [
        config,
        numberFormatter.formatToParts(value).find((x) => x.type == "fraction")
          ?.value.length ?? _decimalScale,
      ];
    } catch {
      return [
        {
          locale: loading ? undefined : t("lang.locale"),
        },
        _decimalScale,
      ];
    }
  }, [loading, currencyCode, _decimalScale]);

  const numberFormatter = useMemo(() => {
    const numberFormatter = new Intl.NumberFormat("en-US", {
      minimumFractionDigits: _decimalScale || props.fixedDecimalLength || 0,
      maximumFractionDigits:
        _decimalScale || props.fixedDecimalLength || props.decimalsLimit || 10,
    });
    return numberFormatter;
  }, [props, _decimalScale]);
  // update if value changed from parent
  useDidMountEffect(() => {
    if (prevValueRef.current == value) return;
    if (Number.isNaN(value)) {
      prevValueRef.current = value;
      setData({
        value: "",
        values: { float: null },
      });
    } else {
      if (max && value > max) {
        value = max;
      }
      if (min && value < min) {
        value = min;
      }
      prevValueRef.current = value;

      const valueFormatted = numberFormatter.format(value).replace(/,/g, "");
      setData({
        value: valueFormatted,
        values: { float: parseFloat(value) },
      });
    }
  }, [value]);

  // update value parent
  return (
    <CurrencyInputOri
      ref={ref}
      intlConfig={intlConfig}
      value={data?.value ?? ""}
      onValueChange={(value, _name, values) => {
        setData({
          value: value ?? "",
          values: values ?? { float: null, formatted: "", value: "" },
        });

        if (!onValueChange) return;
        const float = values?.float ?? null;
        if (Object.is(prevValueRef.current, float)) return;
        prevValueRef.current = float;
        onValueChange(float);
      }}
      onKeyDown={(e) => {
        if (e.key == "Escape") {
          e.target.blur();
        }
      }}
      decimalScale={decimalScale}
      decimalsLimit={10}
      min={min}
      max={max}
      className={cn(
        "text-right focus:border-0! flex h-8 w-full rounded-md border border-input bg-muted px-3 py-2 text-base ring-offset-background  placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        className,
      )}
      {...props}
    />
  );
});

/**
 * @typedef {import('@/Components/CurrencyInput/components/utils/formatValue.d.ts').FormatValueOptions} FormatValueOptions
 * @type {FormatValueOptions}
 */
export const formatValue = formatValueOri;
