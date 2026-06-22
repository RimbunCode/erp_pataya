import { useEffect, useState } from "react";

import { getCurrencyConfig } from "./getCurrencyConfig";
import { usePage } from "@inertiajs/react";

/**
 * @typedef {object} CurrencyData
 * @property {string} [code] kode currency (mis. `"idr"`)
 * @property {string|null} [symbol] symbol currency (mis. `"Rp"`)
 */

/**
 * @typedef {{ kind: "symbol", symbol: string }
 *   | { kind: "fetch", code: string }
 *   | { kind: "none" }} CurrencyResolution
 */

/**
 * Menentukan cara meresolusi symbol dari nilai `currencyCode` yang bisa berupa
 * string code ATAU object data currency. Pure & sinkron sehingga mudah diuji.
 *
 * - string non-kosong  -> `{ kind: "fetch", code }` (resolve via getCurrencyConfig)
 * - object dgn `symbol` -> `{ kind: "symbol", symbol }` (pakai langsung, tanpa fetch)
 * - object tanpa symbol -> `{ kind: "fetch", code }` (fallback fetch by code)
 * - null/undefined/""   -> `{ kind: "none" }` (tanpa symbol, tanpa fetch)
 * @param {string|CurrencyData|null|undefined} currencyCode
 * @returns {CurrencyResolution}
 */
export function resolveCurrencyInput(currencyCode) {
  if (!currencyCode) {
    return { kind: "none" };
  }

  if (typeof currencyCode === "string") {
    return { kind: "fetch", code: currencyCode };
  }

  if (typeof currencyCode === "object") {
    if (currencyCode.symbol) {
      return { kind: "symbol", symbol: currencyCode.symbol };
    }
    if (currencyCode.code) {
      return { kind: "fetch", code: currencyCode.code };
    }
  }

  return { kind: "none" };
}

/**
 * Hook tipis di atas getCurrencyConfig: meresolusi symbol currency berdasarkan
 * code ATAU object data currency, dengan penanganan race condition saat input
 * berubah.
 *
 * `currencyCode` menerima:
 * - string `"default"` | `<code>` -> di-resolve via getCurrencyConfig (cache)
 * - object `{ code, symbol }` dgn symbol terisi -> dipakai langsung tanpa fetch
 * - object tanpa symbol -> fallback fetch pakai `code`
 * - null/undefined -> symbol null
 * @param {string|CurrencyData|undefined|null} currencyCode
 * @returns {{ symbol: string|null, loading: boolean }}
 */
export function useCurrency(currencyCode) {
  const { default_currency_id } = usePage().props.preferences ?? {};
  const [state, setState] = useState({ symbol: null, loading: false });

  // Stabilkan dependency: object literal baru tiap render akan memicu effect
  // berulang, maka turunkan ke nilai primitif (kind/symbol/code).
  const resolution = resolveCurrencyInput(currencyCode);
  const resolutionKind = resolution.kind;
  const resolutionSymbol =
    resolution.kind === "symbol" ? resolution.symbol : null;
  const resolutionCode = resolution.kind === "fetch" ? resolution.code : null;

  useEffect(() => {
    if (resolutionKind === "none") {
      setState({ symbol: null, loading: false });
      return;
    }

    // Object dengan symbol: pakai langsung, sinkron, tanpa fetch.
    if (resolutionKind === "symbol") {
      setState({ symbol: resolutionSymbol, loading: false });
      return;
    }

    // Jalur fetch (string code, atau object tanpa symbol).
    let ignore = false;
    setState((prev) => ({ ...prev, loading: true }));

    getCurrencyConfig(resolutionCode, default_currency_id)
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
  }, [resolutionKind, resolutionSymbol, resolutionCode, default_currency_id]);

  return state;
}
