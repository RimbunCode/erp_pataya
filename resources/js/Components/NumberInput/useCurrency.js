import { useEffect, useState } from "react";

import { getCurrencyConfig } from "./getCurrencyConfig";
import { usePage } from "@inertiajs/react";

/**
 * Hook tipis di atas getCurrencyConfig: meresolusi symbol currency berdasarkan
 * code, dengan penanganan race condition saat code berubah.
 * @param {string|undefined|null} currencyCode `"default"` | `<code>` | null
 * @returns {{ symbol: string|null, loading: boolean }}
 */
export function useCurrency(currencyCode) {
  const { default_currency_id } = usePage().props.preferences ?? {};
  const [state, setState] = useState({ symbol: null, loading: false });

  useEffect(() => {
    if (!currencyCode) {
      setState({ symbol: null, loading: false });
      return;
    }

    let ignore = false;
    setState((prev) => ({ ...prev, loading: true }));

    getCurrencyConfig(currencyCode, default_currency_id)
      .then((config) => {
        if (ignore) return;
        setState({ symbol: config?.symbol ?? null, loading: false });
      })
      .catch(() => {
        if (ignore) return;
        setState({ symbol: null, loading: false });
      });

    return () => {
      ignore = true;
    };
  }, [currencyCode, default_currency_id]);

  return state;
}
