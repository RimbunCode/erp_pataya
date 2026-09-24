// columnSearch — fungsi murni: aturan kolom mana yang bisa dicari lewat Search
// Bar TANPA dialog/menu operator (spec datatable2-advanced-search, revisi 2).
// Operator SELALU diturunkan dari tipe kolom -- user cukup pilih kolom, ketik/
// pilih nilai, Enter:
//
//   list     kolom ber-opsi / boolean   -> daftar nilai inline, `=` (merge -> `in`)
//   text     string                     -> `matches`
//   number   number / currency          -> `=`
//   relation relation (punya anak string)-> `matches` di kolom anak (name/code/...)
//   date     date / datetime            -> preset periode inline, `in_period`
//
// Tipe lain (json, mixed, relations, image, time, ...) tidak ditawarkan; user
// tetap bisa memakainya lewat "Builder lanjutan".

import { columnHasOptions } from "../Filter/operators";
import { isMetaAppendColumn } from "@/lib/utils";
import { resolveColumn } from "../Filter/filterValidation";

// Urutan preferensi kolom anak relasi yang dicari (mis. `customer` -> `name`).
const RELATION_LABEL_PREFERENCE = ["name", "code", "title"];

/**
 * Kolom anak (string) yang dicari untuk kolom relasi -- prefer name/code/
 * title, selain itu anak string pertama. `null` bila relasi tak punya anak
 * string yang bisa dicari (kolom itu lalu tidak ditawarkan).
 * @param {object} column kolom relasi (getColumns()) -- `columns` = anak-anaknya
 * @returns {object|null} kolom anak (`name` sudah dotted, mis. "category.name")
 */
export const relationLabelColumn = (column) => {
  const children = Object.values(column?.columns ?? {}).filter(
    (c) =>
      c &&
      c.type === "string" &&
      c.searchable !== false &&
      !c.hidden &&
      !c.ignore,
  );
  if (children.length === 0) return null;
  for (const preferred of RELATION_LABEL_PREFERENCE) {
    const found = children.find(
      (c) => String(c.name).split(".").pop() === preferred,
    );
    if (found) return found;
  }
  return children[0];
};

/**
 * Resolve kolom by key (dotted untuk relasi) TERMASUK bentuk peta DataTable2:
 * anak relasi di `getColumns()` berkunci & bernama dotted PENUH
 * ("category.name"), sedangkan `resolveColumn` (filterValidation) mencari
 * segmen relatif ("name") sehingga gagal utk bentuk itu.
 * @param {object|Array<object>} columns peta/array kolom
 * @param {string} key mis. "code" atau "category.name"
 * @returns {object|null}
 */
export const resolveColumnPath = (columns, key) => {
  const direct = resolveColumn(columns, key);
  if (direct) return direct;
  const segments = String(key ?? "").split(".");
  if (segments.length < 2) return null;
  let node = resolveColumn(columns, segments[0]);
  for (let i = 1; i < segments.length && node; i++) {
    const full = segments.slice(0, i + 1).join(".");
    const kids = node.columns ?? {};
    node =
      (!Array.isArray(kids) && kids[full]) ||
      Object.values(kids).find((c) => c?.name === full) ||
      null;
  }
  return node;
};

/**
 * Mode nilai untuk sebuah kolom, atau `null` bila tipenya tak didukung.
 *
 * Kolom relasi SELALU `"relation"` (bukan digate oleh `relationLabelColumn`)
 * -- backend TIDAK pernah mengirim anak kolom relasi pre-populated
 * (`getColumns()` selalu balikin `columns: []` utk tipe relation, terverifikasi
 * lewat tinker). Anak kolom (utk resolusi label/`buildLeafFromText`) di-fetch
 * LAZY oleh pemanggil (SearchBar, pola sama dgn `FilterItem2.fetchRelationColumns`)
 * saat kolom relasi ini benar-benar dipilih, BUKAN di sini -- modul ini murni,
 * tanpa I/O. Caller wajib memastikan kolom sudah "ter-hydrate" (`.columns`
 * terisi) sebelum memanggil `buildLeafFromText` utk kolom bertipe relation.
 * @param {object} column
 * @returns {"list"|"text"|"number"|"relation"|"date"|null}
 */
export const resolveValueMode = (column) => {
  if (!column) return null;
  if (column.type === "boolean" || columnHasOptions(column)) return "list";
  if (column.type === "string") return "text";
  if (column.type === "number" || column.type === "currency") return "number";
  if (column.type === "date" || column.type === "datetime") return "date";
  if (column.type === "relation") return column.related ? "relation" : null;
  return null;
};

/**
 * Judul kolom yang tampil ke user.
 * @param {object} column
 * @param {(key: string) => string} t
 * @returns {string}
 */
export const columnTitle = (column, t) =>
  column?.title ?? (column?.titleTrans ? t(column.titleTrans) : column?.name);

/**
 * Apakah kolom boleh ditawarkan sebagai pencarian per-kolom di Search Bar
 * (saran "Kolom", daftar di Panel). Penyaringan SAMA dgn FilterItem2
 * (searchable / hidden / ignore / meta append) supaya daftar kolom yg bisa
 * dicari di sini PARITAS dgn Builder lanjutan -- termasuk kolom yg judulnya
 * belum diterjemahkan (FilterItem2 tetap menawarkannya, hanya labelnya jadi
 * key mentah; bug nyata dari verifikasi visual: `asset_category_id`/`id`/
 * `type` pada Item hilang dari daftar Kolom Search Bar padahal tetap muncul
 * di Filter lanjutan -- root cause-nya di `lang/*\/inventory/item.php` yg
 * belum punya entri utk kolom itu, BUKAN alasan utk menyembunyikannya di
 * sini saja), ditambah: tipe harus punya mode nilai (`resolveValueMode`),
 * hanya kolom level-atas.
 * @param {object} column
 * @param {(key: string) => string} [t]
 * @returns {boolean}
 */
export const isColumnSearchable = (column) =>
  Boolean(
    column &&
    column.searchable !== false &&
    !column.hidden &&
    !column.ignore &&
    !column.parentCol &&
    !isMetaAppendColumn(column) &&
    resolveValueMode(column) !== null,
  );

const pad2 = (n) => String(n).padStart(2, "0");
const isoDay = (d) =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

/**
 * Preset periode utk kolom tanggal (nilai `in_period` ABSOLUT -- format yang
 * sama dgn DateSelector/FilterEvaluator: `{period, operator:"is", ...}`;
 * tahun/bulan/tanggal dihitung dari `now` saat dipilih).
 * @param {Date} now
 * @param {(key: string) => string} t
 * @returns {Array<{key: string, label: string, value: object}>}
 */
export const buildDatePresets = (now, t) => {
  const year = now.getFullYear();
  const month = now.getMonth();
  const yesterday = new Date(year, month, now.getDate() - 1);
  const lastMonth = new Date(year, month - 1, 1);
  return [
    {
      key: "today",
      label: t("core.datatable.search.period.today"),
      value: { period: "day", operator: "is", startDate: isoDay(now) },
    },
    {
      key: "yesterday",
      label: t("core.datatable.search.period.yesterday"),
      value: { period: "day", operator: "is", startDate: isoDay(yesterday) },
    },
    {
      key: "this_month",
      label: t("core.datatable.search.period.this_month"),
      value: { period: "month", operator: "is", year, month },
    },
    {
      key: "last_month",
      label: t("core.datatable.search.period.last_month"),
      value: {
        period: "month",
        operator: "is",
        year: lastMonth.getFullYear(),
        month: lastMonth.getMonth(),
      },
    },
    {
      key: "this_year",
      label: t("core.datatable.search.period.this_year"),
      value: { period: "year", operator: "is", year },
    },
    {
      key: "last_year",
      label: t("core.datatable.search.period.last_year"),
      value: { period: "year", operator: "is", year: year - 1 },
    },
  ];
};

/**
 * Label ringkas & netral-bahasa utk nilai `in_period` (chip): day
 * `2026-09-21`, month `2026-09`, quarter `2026 Q3`, half-year `2026 H2`,
 * year `2026`. Rentang (between) -> `awal – akhir`.
 * @param {object} value nilai in_period
 * @returns {string}
 */
export const formatPeriodValue = (value) => {
  if (!value || typeof value !== "object" || !value.period) return "";
  const isRange =
    value.operator === "between" || value.operator === "not-between";
  const day = (iso) => `${iso ?? ""}`.slice(0, 10);
  const unit = (year, idx) => {
    if (value.period === "month") return `${year}-${pad2(Number(idx) + 1)}`;
    if (value.period === "quarter") return `${year} Q${Number(idx) + 1}`;
    if (value.period === "half-year") return `${year} H${Number(idx) + 1}`;
    return `${year}`;
  };

  if (value.period === "day") {
    return isRange && value.endDate
      ? `${day(value.startDate)} – ${day(value.endDate)}`
      : day(value.startDate);
  }
  if (isRange) {
    const start = value.rangeStart ?? {};
    const end = value.rangeEnd ?? {};
    return `${unit(start.year, start.value)} – ${unit(end.year, end.value)}`;
  }
  const idxKey = {
    month: "month",
    quarter: "quarter",
    "half-year": "halfYear",
  }[value.period];
  return unit(value.year, value[idxKey]);
};

/**
 * Bangun patch leaf `{k, o, v}` dari teks ketikan sesuai mode kolom. `null`
 * bila teks kosong / tak valid utk mode itu (mode `list`/`date` tidak lewat
 * sini -- nilainya dipilih dari daftar).
 * @param {object} column
 * @param {string} text
 * @returns {{k: string, o: string, v: *}|null}
 */
export const buildLeafFromText = (column, text) => {
  const trimmed = `${text ?? ""}`.trim();
  if (!trimmed) return null;
  const mode = resolveValueMode(column);
  if (mode === "text") return { k: column.name, o: "matches", v: trimmed };
  if (mode === "number") {
    const n = Number(trimmed);
    return Number.isNaN(n) ? null : { k: column.name, o: "=", v: n };
  }
  if (mode === "relation") {
    const labelColumn = relationLabelColumn(column);
    return labelColumn
      ? { k: labelColumn.name, o: "matches", v: trimmed }
      : null;
  }
  return null;
};
