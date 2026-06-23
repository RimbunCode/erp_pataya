import {
  getDataModel,
  getFromLocalStorage,
  saveToLocalStorage,
} from "@/lib/utils";

const CACHE_PREFIX = "currency:";
const CACHE_EXPIRY_DAYS = 7;

/**
 * Resolusi konfigurasi currency (saat ini hanya `symbol`) berdasarkan code,
 * dengan cache di localStorage.
 *
 * Catatan: `number_format` currency TIDAK dipakai untuk formatting — format
 * angka bersumber tunggal dari preference `default_number_format`. Fungsi ini
 * hanya menarik symbol untuk dijadikan prefix.
 * @param {string|undefined|null} code `"default"` | `<currency code>` | null
 * @param {string} [defaultCode] dipakai saat `code === "default"`
 * @returns {Promise<{ symbol: string|null }|null>}
 */
export async function getCurrencyConfig(code, defaultCode) {
  const resolvedCode = code === "default" ? defaultCode : code;

  if (!resolvedCode) {
    return null;
  }

  const cacheKey = `${CACHE_PREFIX}${resolvedCode}`;
  const cached = getFromLocalStorage(cacheKey);
  if (cached) {
    return { symbol: cached.symbol ?? null };
  }

  let row = null;
  try {
    row = await getDataModel(
      "App\\Models\\Core\\Currency",
      { code: resolvedCode },
      { limit: 1 },
    );
  } catch {
    return null;
  }

  if (!row) {
    return null;
  }

  const config = { symbol: row.symbol ?? null };
  saveToLocalStorage(cacheKey, config, CACHE_EXPIRY_DAYS);

  return config;
}
