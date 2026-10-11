// valueInputUtils — fungsi murni input nilai kolom yang dipakai BERSAMA oleh
// Search Bar atas (`SearchBar.jsx`) dan Sel Filter per kolom
// (`ColumnFilterCell.jsx`, spec datatable2-column-search-row, Requirement 10).
// Dipindah apa adanya dari kepala `SearchBar.jsx`; ditambah dua fungsi yang
// dulu tertanam di `openEditorForChip` (`canEditLeafInCell`,
// `buildEditorPrefill`) supaya kedua tempat TIDAK pernah berbeda pendapat
// soal "leaf ini bisa diedit lewat kotak nilai atau harus ke Builder".

import {
  MAX_DATE_VALUES,
  leafDatePeriods,
  leafToText,
  periodValueToText,
  resolveValueMode,
} from "./columnSearch";
import { buildOptionList } from "./searchChips";
import { convertTemplateLink } from "@/lib/linkModelUtils";
import { toLocalDateValue } from "../Filter/periodParsing";

// Warna chip berdasarkan PERAN, bukan urutan (revisi 9): filter tersimpan
// (sumber) = emas + ikon bintang, filter (leaf/search/advanced) = biru tanpa
// ikon, group = hijau + ikon tumpukan, nilai (chip di dalam kotak nilai) =
// secondary -- sama seperti Button variant="secondary".
export const CHIP_CLASS = {
  source:
    "bg-amber-500/20 text-amber-800 ring-1 ring-amber-500/40 dark:text-amber-300",
  filter: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  group: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  value: "bg-secondary text-secondary-foreground",
};
export const chipClass = (kind) => CHIP_CLASS[kind] ?? CHIP_CLASS.filter;

// Requirement 31: vmode yg dapat footer hint sintaks ketik. list/boolean ikut
// sejak feedback revisi 6 (Requirement 27.6): search box kini bisa diketik
// langsung (`a | b |`), bukan cuma centang.
// Revisi 8 (Requirement 40): opsi tetap "Diisi" / "Tidak diisi" (`set`/`!set`)
// di dropdown nilai SEMUA tipe kolom -- kunci di luar ruang nilai opsi.
export const SET_OPTIONS = [
  { key: "__set__", op: "set", labelKey: "core.datatable.filter.operator.set" },
  {
    key: "__not_set__",
    op: "!set",
    labelKey: "core.datatable.filter.operator.!set",
  },
];

// Revisi 6 (Requirement 27): kebalikan proses commit checkbox-multi -- dari
// leaf `=`/`in`/`!=`/`!in` existing, balikin array value/record yg tercentang
// (dipakai prefill `enterValueMode` saat EDIT chip list/boolean/relation).
// Leaf operator lain (mis. `matches`, `in_period`) -> [] (bukan multi-value).
export const leafCheckedList = (leaf) => {
  if (!leaf) return [];
  const { o, v } = leaf;
  if (o === "=" || o === "!=") return v === undefined ? [] : [v];
  // `has`/`!has` = padanan `in`/`!in` utk kolom formStatuses (Builder).
  if (o === "in" || o === "!in" || o === "has" || o === "!has") {
    return Array.isArray(v) ? v : v === undefined ? [] : [v];
  }
  return [];
};

// Leaf multi-value bernegasi (`!=`/`!in`) -> prefill teks search box diawali `!`.
export const leafExcluded = (leaf) =>
  leaf?.o === "!=" ||
  leaf?.o === "!in" ||
  leaf?.o === "!has" ||
  leaf?.o === "!in_period";

// Opsi list/boolean utk `column` -- SATU sumber utk daftar opsi DAN resolusi
// teks-ketik -> opsi (revisi 6 feedback, Requirement 27.6).
export const listOptionsFor = (column, t) =>
  column?.type === "boolean"
    ? [
        { value: true, label: t("core.datatable.yes") },
        { value: false, label: t("core.datatable.no") },
      ]
    : buildOptionList(column, t);

// Label record relation (sama persis yg dirender di daftar centang).
export const recordLabel = (record) =>
  convertTemplateLink(record, "") ||
  `${record.name ?? record.code ?? record.id}`;

// Pencocokan label ketikan <-> label opsi: tanpa beda huruf besar/kecil & spasi tepi.
export const sameLabel = (a, b) =>
  `${a}`.trim().toLowerCase() === `${b}`.trim().toLowerCase();

// Payload widget `DateSelector` -> bentuk leaf: tanggal jadi string LOKAL
// (kolom date membuang jam), sisanya apa adanya. Mode multi: `selections`
// (daftar periode "Pada") dinormalkan per item.
export const normalizeDatePayload = (next, isDatetime) => {
  const payload = { ...next };
  if (next.startDate) {
    payload.startDate = toLocalDateValue(next.startDate, { isDatetime });
  }
  if (next.endDate) {
    payload.endDate = toLocalDateValue(next.endDate, { isDatetime });
  }
  if (Array.isArray(next.selections)) {
    payload.selections = next.selections.map((s) =>
      normalizeDatePayload(s, isDatetime),
    );
  }
  return payload;
};

// Pesan pelanggaran daftar chip date (`mergeDatePeriods().error` / catatan
// turunan) -> teks i18n.
export const dateNoticeText = (kind, t) =>
  kind === "limit"
    ? t("core.datatable.search.date_limit", { max: MAX_DATE_VALUES })
    : t("core.datatable.search.date_multi_only_is");

// --- Keputusan "leaf ini bisa diedit lewat kotak nilai?" (Requirement 8.5-8.6)

// Operator yang bisa DIBENTUK ULANG lewat sintaks ketik / picker per mode
// nilai (terverifikasi dari `buildLeafFromText`, `buildChipsLeaf`,
// `buildListLeaf`, `buildDateChipsLeaf` & `pickSetOperator`). Operator di luar
// daftar (mis. `starts_with`, `=` pada string bebas, `!between`) tak punya
// sintaks -- mengeditnya lewat kotak nilai diam-diam MENGUBAH operator
// (pelajaran Requirement 25), jadi harus lewat Builder.
const EDITABLE_OPERATORS = {
  text: ["matches", "!matches", "in", "!in", "set", "!set"],
  number: [
    "=",
    "!=",
    ">",
    ">=",
    "<",
    "<=",
    "between",
    "in",
    "!in",
    "set",
    "!set",
  ],
  list: ["=", "!=", "in", "!in", "has", "!has", "set", "!set"],
  relation: ["=", "!=", "in", "!in", "set", "!set"],
  date: ["in_period", "!in_period", "set", "!set"],
};

/**
 * Apakah `leaf` bisa diedit lewat kotak nilai (Search Bar atas ATAU Sel
 * Filter), atau harus lewat Builder lanjutan. SATU-SATUNYA sumber keputusan.
 * @param {object|null} column kolom ter-resolve (`resolveColumnPath`), `null`
 *   bila tak ditemukan
 * @param {{k?: string, o?: string, v?: unknown}} leaf
 * @returns {"edit"|"dotted"|"builder"} "edit" = mode value utk `column`;
 *   "dotted" = leaf bertitik lama tanpa kolom ter-resolve (edit sbg teks
 *   polos); "builder" = buka Builder.
 */
export const canEditLeafInCell = (column, leaf) => {
  // Leaf mode kolom (bandingkan dgn kolom lain, `v = {mode:"column", ref}`).
  if (leaf?.v && typeof leaf.v === "object" && leaf.v.mode === "column") {
    return "builder";
  }
  if (!column) {
    return String(leaf?.k ?? "").includes(".") ? "dotted" : "builder";
  }
  const mode = resolveValueMode(column);
  if (!mode) return "builder";
  return EDITABLE_OPERATORS[mode]?.includes(leaf?.o) ? "edit" : "builder";
};

/**
 * Kolom sintetis utk leaf bertitik lama yang kolomnya tak ter-resolve
 * (fallback "dotted"): string polos, judul = segmen terakhir key.
 * @param {{k?: string}} leaf
 * @returns {{name: string, type: "string", title: string}}
 */
export const dottedColumnFor = (leaf) => {
  const key = String(leaf?.k ?? "");
  return { name: key, type: "string", title: key.split(".").pop() };
};

/**
 * Opsi `enterValueMode` (`editId`, `initialText`, `initialChecked`,
 * `initialRecords`, `initialTextChips`, `initialDateChips`) utk mengedit
 * `chip.node` -- dipindah apa adanya dari `openEditorForChip`.
 * @param {object} column kolom (atau hasil `dottedColumnFor`)
 * @param {{id: string, node: object}} chip chip leaf (`treeToChips`)
 * @param {{monthsShort?: string[]}} [ctx]
 * @returns {object}
 */
export const buildEditorPrefill = (column, chip, ctx = {}) => {
  const node = chip.node;
  // Kolom relasi: prefill chip dari leaf existing (Requirement 27 & 36.8) --
  // `!` di input bila leaf bernegasi.
  if (column?.type === "relation") {
    return {
      editId: chip.id,
      initialRecords: leafCheckedList(node),
      initialText: leafExcluded(node) ? "!" : "",
    };
  }
  const valueMode = column ? resolveValueMode(column) : null;
  if (!valueMode) {
    // Fallback "dotted": teks polos tanpa fetch ulang.
    return { editId: chip.id, initialText: leafToText(node) };
  }
  const isTyped = valueMode === "text" || valueMode === "number";
  const checked = valueMode === "list" ? leafCheckedList(node) : [];
  // Revisi 7 (Requirement 36.8): leaf `in`/`!in` text/number tampil sbg chip;
  // operator lain (matches, perbandingan, between) tetap teks.
  const asChips = isTyped && (node?.o === "in" || node?.o === "!in");
  const datePeriods =
    valueMode === "date"
      ? leafDatePeriods(node).map((p) =>
          normalizeDatePayload(p, column.type === "datetime"),
        )
      : [];
  const dateAsText = datePeriods.length === 1;
  return {
    editId: chip.id,
    // Revisi 5 (Requirement 25): prefill LEWAT `leafToText` (bukan cuma `v`
    // mentah) -- leaf `{o:"!=", v:500}` prefill jadi "!500", bukan "500".
    // List/boolean: nilai jadi chip, `!` bila negasi.
    initialText:
      isTyped && !asChips
        ? leafToText(node)
        : dateAsText
          ? `${leafExcluded(node) ? "!" : ""}${periodValueToText(
              datePeriods[0],
              ctx.monthsShort,
            )}`
          : leafExcluded(node)
            ? "!"
            : "",
    initialTextChips: asChips
      ? (Array.isArray(node.v) ? node.v : [node.v]).map((x) => `${x}`)
      : [],
    // Revisi 6 (Requirement 27): sama, KHUSUS list/boolean.
    initialChecked: checked,
    // Revisi 11/12b/16: leaf date ber-`v` DAFTAR tampil sbg chip nilai; SATU
    // nilai langsung dikonversi ke TEKS di kotak (`dateAsText`).
    initialDateChips: dateAsText ? [] : datePeriods,
  };
};
