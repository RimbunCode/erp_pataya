// searchSuggestions — fungsi murni: teks yang diketik user -> daftar saran
// terbagi 5 seksi berurutan (design.md §5.2; Requirement 3).

import { buildOptionList } from "./searchChips";
import { columnHasOptions } from "../Filter/operators";
import { isMetaAppendColumn } from "@/lib/utils";

// Sentinel "Tidak ada" pada `groupOptions` -- mirror `NO_GROUP_VALUE`
// (DataTable2.jsx:96). Didefinisikan lokal (bukan import dari Pages/) agar
// modul murni ini tidak bergantung ke komponen Page.
const NO_GROUP_VALUE = "__no_group__";

const SECTION_LIMITS = { text: 1, saved: 3, column: 5, value: 5, group: 3 };

const toArray = (value) => {
  if (!value) return [];
  return Array.isArray(value) ? value : Object.values(value);
};

/** Pemecah kata -- selaras `highlightMatch` (split `/\s+/`, case-insensitive). */
const wordsOf = (text) =>
  `${text ?? ""}`
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);

/** Item cocok bila SETIAP kata query muncul di label (case-insensitive). */
const matchesAllWords = (label, words) => {
  const lower = `${label ?? ""}`.toLowerCase();
  return words.every((w) => lower.includes(w));
};

/** Penyaringan kolom -- selaras `FilterItem2.jsx` (:55-70, :110-125). */
const isSearchableColumn = (col) =>
  Boolean(
    col &&
    col.searchable !== false &&
    !col.hidden &&
    !col.ignore &&
    !isMetaAppendColumn(col),
  );

const columnLabel = (col, t) => col.title ?? (col.titleTrans ? t(col.titleTrans) : col.name);

/**
 * Bangun saran dropdown Search Bar dari teks yang sedang diketik. Seksi
 * kosong tidak dikembalikan; teks kosong/whitespace -> `[]` (Requirement
 * 3.1-3.6).
 * @param {string} text
 * @param {object} root0
 * @param {object} [root0.columns] peta/array kolom (getColumns())
 * @param {string[]} [root0.searchColumns] hasil `resolveSearchColumns()`
 * @param {Array<object>} [root0.savedFilters] hasil `saved-filters.index`
 * @param {Array<{value:string, label:string}>} [root0.groupOptions]
 * @param {(key: string, params?: object) => string} root0.t
 * Item: `{ key, label, payload, prefix? }` -- needle highlight SELALU teks
 * ketikan (`highlightMatch(label.slice(prefix.length), text)`), bukan field
 * terpisah; `prefix` hanya ada di seksi `value`.
 * @returns {Array<{section: string, items: Array<object>}>}
 */
const buildSuggestions = (
  text,
  { columns, searchColumns, savedFilters, groupOptions, t } = {},
) => {
  const trimmed = `${text ?? ""}`.trim();
  if (!trimmed) return [];
  const words = wordsOf(trimmed);
  const matches = (label) => matchesAllWords(label, words);

  const sections = [];

  // 1. Teks bebas -- hanya bila ada kolom pencarian (Requirement 3.6, 5.5).
  if (Array.isArray(searchColumns) && searchColumns.length > 0) {
    sections.push({
      section: "text",
      items: [
        {
          key: "text",
          label: t("core.datatable.search.search_all", { text: trimmed }),
          payload: { text: trimmed },
        },
      ].slice(0, SECTION_LIMITS.text),
    });
  }

  // 2. Filter Tersimpan -- hanya bila host memberi `savedFilters`.
  if (Array.isArray(savedFilters)) {
    const items = savedFilters
      .map((saved) => {
        const label =
          saved?.name || t("core.datatable.filter.saved.untitled");
        if (!matches(label)) return null;
        return {
          key: `saved-${saved.id}`,
          label,
          payload: saved,
        };
      })
      .filter(Boolean)
      .slice(0, SECTION_LIMITS.saved);
    if (items.length > 0) sections.push({ section: "saved", items });
  }

  // 3. Kolom.
  const columnList = toArray(columns).filter(isSearchableColumn);
  const columnItems = columnList
    .map((col) => {
      const label = columnLabel(col, t);
      if (!matches(label)) return null;
      return {
        key: `column-${col.name}`,
        label,
        payload: { column: col.name },
      };
    })
    .filter(Boolean)
    .slice(0, SECTION_LIMITS.column);
  if (columnItems.length > 0) sections.push({ section: "column", items: columnItems });

  // 4. Nilai -- opsi kolom ber-opsi + boolean, cocok label opsi (BUKAN label
  // gabungan "Kolom: Label"). `prefix` ("Kolom: ") dirender polos oleh
  // komponen; hanya sisa label (bagian opsi) yang di-highlight dgn teks
  // ketikan (design.md §5.2 baris terakhir).
  const valueItems = [];
  for (const col of columnList) {
    const colLabel = columnLabel(col, t);
    if (columnHasOptions(col)) {
      for (const opt of buildOptionList(col, t)) {
        if (!matches(opt.label)) continue;
        valueItems.push({
          key: `value-${col.name}-${opt.value}`,
          label: `${colLabel}: ${opt.label}`,
          prefix: `${colLabel}: `,
          payload: { k: col.name, o: "=", v: opt.value },
        });
      }
    } else if (col.type === "boolean") {
      for (const boolValue of [true, false]) {
        const boolLabel = t(
          boolValue ? "core.datatable.yes" : "core.datatable.no",
        );
        if (!matches(boolLabel)) continue;
        valueItems.push({
          key: `value-${col.name}-${boolValue}`,
          label: `${colLabel}: ${boolLabel}`,
          prefix: `${colLabel}: `,
          payload: { k: col.name, o: "=", v: boolValue },
        });
      }
    }
  }
  if (valueItems.length > 0) {
    sections.push({ section: "value", items: valueItems.slice(0, SECTION_LIMITS.value) });
  }

  // 5. Kelompokkan -- hanya bila host memberi `groupOptions`.
  if (Array.isArray(groupOptions)) {
    const items = groupOptions
      .filter((opt) => opt.value !== NO_GROUP_VALUE)
      .map((opt) => {
        if (!matches(opt.label)) return null;
        return {
          key: `group-${opt.value}`,
          label: t("core.datatable.search.group_by_label", {
            column: opt.label,
          }),
          payload: { column: opt.value },
        };
      })
      .filter(Boolean)
      .slice(0, SECTION_LIMITS.group);
    if (items.length > 0) sections.push({ section: "group", items });
  }

  return sections;
};

export { buildSuggestions };
