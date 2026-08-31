import { formatNumber as formatFullNumber } from "@/Components/NumberInput/formatNumber";

/**
 * Satu sumber format angka bersama (Chart + NumberCard) — pure function,
 * TANPA dependency React/hook, supaya testable tanpa render komponen.
 *
 * Mode "full" TIDAK reimplement format sendiri — delegasi ke `formatNumber`
 * milik `NumberInput` (spec `number-input`), yang SUDAH jadi sumber tunggal
 * "angka penuh" di seluruh app (Table2, PrintTemplate) via pattern company
 * `preferences.default_number_format` (mis. `#.###,##`) — BUKAN locale
 * lang app. Ditemukan setelah sesi awal salah bikin implementasi baru
 * (toLocaleString) tanpa cek dulu apa sudah ada; lihat design.md.
 *
 * Mode "compact" TETAP baru — tidak ada equivalent-nya di codebase ini
 * (`NumberInput/formatNumber` tidak punya konsep notasi singkat sama
 * sekali). Locale-nya ikut lang AKTIF APP (`currentLocale()`), karena
 * kata singkatan ("jt"/"rb" vs "K"/"M") itu soal bahasa — beda sumbu dari
 * pattern pemisah desimal yang diatur company.
 * @param {number|string|null|undefined} value
 * @param {object} [options]
 * @param {boolean} [options.full] true = angka penuh, false/undefined = compact
 * @param {string} [options.locale] locale utk mode compact, mis. "id"/"en" dari currentLocale()
 * @param {string} [options.numberFormat] pattern utk mode full, mis. "#.###,##" dari preferences.default_number_format
 * @returns {string}
 */
export function formatNumber(value, { full = false, locale, numberFormat } = {}) {
  const num = Number(value ?? 0);
  return full
    ? formatFullNumber(num, { numberFormat })
    : Intl.NumberFormat(locale, { notation: "compact", maximumFractionDigits: 1 }).format(num);
}
