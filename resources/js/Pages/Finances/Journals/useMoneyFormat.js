import { formatNumber } from "@/Components/NumberInput/formatNumber";
import { parseNumberFormat } from "@/Components/NumberInput/parseNumberFormat";
import { usePage } from "@inertiajs/react";

/**
 * Pembuat fungsi format nominal jurnal: pemisah ribuan/desimal mengikuti
 * `preferences.default_number_format`, jumlah desimal mengikuti minor unit mata
 * uang dasar jurnal (bukan skala pola format). Menerima angka maupun string
 * `decimal(20,4)` dari MySQL ("1000.0000").
 * @param {number} minorUnit jumlah desimal mata uang dasar jurnal
 * @returns {(value: number|string|null|undefined) => string}
 */
export default function useMoneyFormat(minorUnit = 2) {
  const preferences = usePage().props?.preferences ?? {};
  const { groupSeparator, decimalSeparator } = parseNumberFormat(
    preferences.default_number_format,
  );

  return (value) =>
    formatNumber(value, {
      groupSeparator,
      decimalSeparator,
      decimalScale: minorUnit,
    });
}
