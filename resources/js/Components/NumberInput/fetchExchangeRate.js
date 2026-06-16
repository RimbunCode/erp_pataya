/**
 * Fetch exchange rate from Frankfurter API.
 *
 * Endpoint: GET https://api.frankfurter.dev/v2/rate/{base}/{quote}
 *   Response: {"date":"2026-06-16","base":"USD","quote":"EUR","rate":0.8619}
 *   Error:    HTTP 400/404/422 with JSON {"message":"..."}
 *
 * When `options.quote` is omitted, falls back to:
 *   GET https://api.frankfurter.dev/v2/rates?base={base}
 *   Response: [{"date":..., "base":..., "quote":..., "rate":...}, ...]
 * @param {string} base - Base currency code (e.g. "USD")
 * @param {object} [options]
 * @param {string} [options.quote] - Quote/target currency code
 * @param {string} [options.date] - Historical date (YYYY-MM-DD)
 * @param {string} [options.providers] - Filter by provider key(s)
 * @returns {Promise<{ rate: number, base: string, quote: string, date: string }>}
 */
export async function fetchExchangeRate(base, options = {}) {
  const { quote, ...queryParams } = options;

  let url;
  if (quote) {
    url = `https://api.frankfurter.dev/v2/rate/${encodeURIComponent(base)}/${encodeURIComponent(quote)}`;
  } else {
    url = `https://api.frankfurter.dev/v2/rates?base=${encodeURIComponent(base)}`;
  }

  // Append extra query params (date, providers, etc.)
  const extra = new URLSearchParams(
    Object.fromEntries(
      Object.entries(queryParams).filter(([, v]) => v != null),
    ),
  );
  const extraStr = extra.toString();
  if (extraStr) {
    url += (url.includes("?") ? "&" : "?") + extraStr;
  }

  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(
      body?.message ?? `Exchange rate fetch failed: ${res.status}`,
    );
  }

  const data = await res.json();

  // /v2/rate/{base}/{quote} returns a single object
  if (!Array.isArray(data)) {
    return {
      rate: data.rate,
      base: data.base,
      quote: data.quote,
      date: data.date,
    };
  }

  // /v2/rates fallback returns an array — return the first entry
  const first = data[0];
  if (!first) throw new Error("No exchange rate data returned");
  return {
    rate: first.rate,
    base: first.base,
    quote: first.quote,
    date: first.date,
  };
}
