import { format } from "date-fns";

// 2 Januari 2000 jatuh pada hari Minggu: dipakai sebagai jangkar supaya indeks
// 0..6 sama dengan urutan `weekdays` pada DEFAULT_DATE_SELECTOR_I18N.
const SUNDAY_ANCHOR = 2;

/**
 * Label kalender `DatetimePicker` yang mengikuti bahasa aplikasi. Hasilnya
 * menimpa sebagian `DEFAULT_DATE_SELECTOR_I18N` (ui/date-selector.jsx): nama
 * bulan & hari dari locale date-fns, tombol footer dari `core.form.*`.
 * Murni (tidak menyimpan state module-level) agar reaktif ke locale aktif.
 * @param {object} root0
 * @param {(key: string) => string} root0.t
 * @param {object} root0.dateLocale locale date-fns (`getLocaleDate`)
 * @returns {{goToToday: string, now: string, months: string[], monthsShort: string[], weekdays: string[], weekdaysShort: string[]}}
 */
export function buildDatetimePickerI18n({ t, dateLocale }) {
  const label = (date, pattern) =>
    format(date, pattern, { locale: dateLocale });
  const range = (length, build) => Array.from({ length }, (_, i) => build(i));

  return {
    goToToday: t("core.form.today"),
    now: t("core.form.now"),
    months: range(12, (i) => label(new Date(2000, i, 1), "MMMM")),
    monthsShort: range(12, (i) => label(new Date(2000, i, 1), "MMM")),
    weekdays: range(7, (i) =>
      label(new Date(2000, 0, SUNDAY_ANCHOR + i), "EEEE"),
    ),
    weekdaysShort: range(7, (i) =>
      label(new Date(2000, 0, SUNDAY_ANCHOR + i), "EEEEEE"),
    ),
  };
}
