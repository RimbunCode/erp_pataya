// groupDisplay — fungsi murni utk menampilkan deskriptor grup (spec
// datatable2-group-tree, Requirement 15). Dipakai header desktop & kartu mobile.

import { formatNumber } from "@/Components/NumberInput/formatNumber";

const safeParse = (text) => {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};

/**
 * Nilai yang dilempar ke <GroupLabel> utk sebuah deskriptor grup
 * `{key, raw, count, aggregates, label?}` pada level `level` (`groupMeta.levels[i]`):
 * - relation -> `label` (objek relasi utuh, dari baris sampel backend)
 * - boolean -> boolean asli (`key` 'true'/'false'; SQL mentah 0/1 tak dipakai)
 * - formStatuses -> array status (`key` = JSON ringkas)
 * - lainnya -> `raw` (string / kunci bucket date / batas bawah bucket number)
 * Grup NULL (`key` 'null') -> null (GroupLabel menampilkan "Tanpa Nilai").
 * @param {{key: string, raw: *, label?: *}} item
 * @param {{type?: string}} level
 */
export const groupLabelValue = (item, level) => {
  if (item.key === "null") return null;
  switch (level?.type) {
    case "relation":
      return item.label ?? null;
    case "boolean":
      return item.key === "true";
    case "formStatuses":
      return safeParse(item.key);
    default:
      return item.raw;
  }
};

/**
 * Format nilai agregat memakai opsi kolomnya (sama dgn sel `number`/`currency`
 * di Cell): numberFormat kolom -> preferences.default_number_format, simbol mata
 * uang utk `currency`. `null` (semua nilai NULL) -> string kosong.
 * @param {number|null|undefined} value
 * @param {object} column node kolom (type, numberFormat, decimalScale, currencyCode, ...)
 * @param {object} [preferences] `usePage().props.preferences`
 */
export const formatAggregate = (value, column, preferences) => {
  if (value === null || value === undefined || value === "") return "";

  let prefix = "";
  if (column?.type === "currency") {
    const symbol =
      typeof column.currencyCode === "object"
        ? column.currencyCode?.symbol
        : null;
    prefix = symbol ? `${symbol} ` : "";
  }
  const formatted = formatNumber(value, {
    numberFormat: column?.numberFormat ?? preferences?.default_number_format,
    decimalScale: column?.decimalScale,
    groupSeparator: column?.groupSeparator,
    decimalSeparator: column?.decimalSeparator,
    prefix,
  });

  return formatted === "" ? String(value) : formatted;
};

/**
 * Bagi kolom tampil utk baris header grup desktop (tabel = CSS grid, semua `td`
 * grid item langsung): `leading` = kolom pemilih/aksi di depan; `labelSpan` =
 * lebar sel label (mencakup leading + semua kolom SEBELUM kolom agregat
 * pertama); `trailing` = kolom sisa yg masing-masing dapat 1 sel (agregat atau
 * kosong). Tanpa kolom agregat tampil -> label span PENUH, `trailing` kosong.
 * @param {Array<{name: string}>} showedColumns kolom tampil berurutan
 * @param {Array<{column: string}>} aggregates `groupMeta.aggregates`
 * @param {number} leading jumlah kolom di depan (selectable + actions)
 */
export const splitHeaderColumns = (showedColumns, aggregates, leading) => {
  const aggregated = new Set((aggregates ?? []).map((a) => a.column));
  const firstIndex = showedColumns.findIndex((col) => aggregated.has(col.name));

  if (firstIndex === -1) {
    return {
      labelSpan: leading + showedColumns.length,
      trailing: [],
    };
  }
  // Minimal 1 (span 0 tak valid di CSS grid): bila kolom agregat pertama juga
  // kolom PERTAMA tabel & tak ada kolom pemilih/aksi, sel label menempati
  // kolom itu -- agregat kolom tsb tak tampil (sama spt Odoo).
  const labelSpan = Math.max(1, leading + firstIndex);
  return {
    labelSpan,
    trailing: showedColumns.slice(labelSpan - leading),
  };
};
