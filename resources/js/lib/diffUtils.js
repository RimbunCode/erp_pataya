import { convertTemplateLink } from "@/lib/linkModelUtils";
import { isEqual } from "lodash";

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2})?)?/;

/**
 * Normalisasi nilai untuk perbandingan before/after lintas tipe:
 * Date/ISO string -> timestamp, model (punya templateLink) -> label,
 * angka/string numerik -> number, sisanya nilai asli.
 * @param {unknown} v
 * @returns {unknown}
 */
const normalize = (v) => {
  if (v == null || v === "") return null;
  if (v instanceof Date) return v.getTime();
  if (typeof v === "string" && ISO_DATE_RE.test(v)) {
    const t = new Date(v).getTime();
    if (!Number.isNaN(t)) return t;
  }
  if (typeof v === "object" && v.templateLink) return convertTemplateLink(v);
  if (typeof v === "number") return v;
  if (typeof v === "string" && v.trim() !== "" && !isNaN(v)) return Number(v);
  return v;
};

/**
 * True jika `before` dan `after` berbeda secara semantik (bukan referensi).
 * @param {unknown} before
 * @param {unknown} after
 * @returns {boolean}
 */
export const isChanged = (before, after) => {
  const a = normalize(before);
  const b = normalize(after);
  if (a == null && b == null) return false;
  if (typeof a === "object" || typeof b === "object") return !isEqual(a, b);
  return a !== b;
};

export const DIFF_HIGHLIGHT = "bg-yellow-200 dark:bg-yellow-900";
export const DIFF_ADDED = "bg-green-100 dark:bg-green-900/40";
export const DIFF_REMOVED = "bg-red-100 dark:bg-red-900/40";
// text-decoration diwariskan ke descendant (beda dari background) — cukup
// ditaruh di row wrapper (bukan overlay) supaya semua teks anak tercoret.
export const DIFF_REMOVED_TEXT = "line-through";
