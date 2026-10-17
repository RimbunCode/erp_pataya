import usePermission from "@/Hooks/usePermission";
import { getValueObject } from "@/lib/utils";

/**
 * Menentukan tautan navigasi ke sebuah record, memakai aturan yang sama dengan
 * `isLink` dan kolom `type: 'relation'` di `Cell` (Table2).
 *
 * - Tanpa `to`: tautan ke record baris itu sendiri (`route` + `primaryKey`,
 *   izin `can("read")`), aturan `isLink`. Tanpa `column.route`, fallback ke
 *   `row.route + ".show"` dan primaryKey `id`.
 * - Dengan `to` (path ke relasi, mis. "customer" atau "items.0"): tautan ke
 *   record relasi itu (`disabledNavigation`, `signedRouteKey`, `forceNavigation`,
 *   izin `canGlobal`), aturan kolom `relation`.
 *
 * Mengembalikan `null` bila izin/route tidak terpenuhi sehingga pemanggil
 * merender isi tanpa `<a>`.
 * @param {object} row baris data
 * @param {object} [options]
 * @param {string} [options.to] path relasi di `row`; kosong = record baris
 * @param {object} [options.column] konfigurasi kolom (`route`, `primaryKey`, `disabledNavigation`, `signedRouteKey`, `forceNavigation`)
 * @param {boolean} [options.requireColumnRoute] jalur `Cell`: `column.route` wajib ada
 *   (isLink / kolom relasi existing, perilaku lama). Tag template melonggarkannya:
 *   `route` milik record (`row.route` / `value.route`) cukup.
 * @param {boolean} [options.enabled] false = lewati komputasi (hook izin tetap dipanggil)
 * @returns {{ href: string }|null}
 */
export default function useRecordLink(
  row,
  { to, column, requireColumnRoute = false, enabled = true } = {},
) {
  const { can, canGlobal } = usePermission(row?.thisModel);
  const route = column?.route;
  const primaryKey = column?.primaryKey;

  if (!enabled) {
    return null;
  }

  if (!to) {
    if (!can("read", { user_id: row?.created_by_id })) {
      return null;
    }
    // `column.route` selalu menang (jalur `isLink` Cell tak berubah). Di luar
    // konteks kolom (kartu mobile, chip, ...) baris data DataTable membawa
    // `row.route` (nama resource, tanpa ".show") dan `id`.
    if (route) {
      return { href: window.route(route ?? "", row?.[primaryKey] ?? "") };
    }
    if (!requireColumnRoute && row?.route) {
      return {
        href: window.route(`${row.route}.show`, row?.[primaryKey ?? "id"] ?? ""),
      };
    }

    return null;
  }

  const value = getValueObject(row, to);
  if (value == null || typeof value !== "object") {
    return null;
  }
  if (requireColumnRoute ? !route : !(route || value.route)) {
    return null;
  }
  if (column?.disabledNavigation) {
    return null;
  }
  if (
    !(
      column?.signedRouteKey ||
      column?.forceNavigation ||
      canGlobal(value?.thisModel, "read", { user_id: value?.created_by_id })
    )
  ) {
    return null;
  }

  return {
    href:
      value[column?.signedRouteKey] ??
      window.route(
        value?.route ? `${value.route}.show` : (route ?? ""),
        value?.[primaryKey] ?? "",
      ),
  };
}
