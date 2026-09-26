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

import {
  buildFlexibleBetween,
  completeRange,
  hasPeriodSelection,
  monthsStartingWith,
  parsePeriodToken,
  toLocalDayString,
} from "../Filter/periodParsing";
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

const COMPARE_SYMBOL_BY_PERIOD_OPERATOR = {
  after: ">",
  "on-or-after": ">=",
  before: "<",
  "on-or-before": "<=",
};

const DEFAULT_MONTHS_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/**
 * Label chip utk nilai `in_period` (revisi 9): hari `25 Sep 2026` (+ ` 19:35`
 * bila ada jam), bulan `Sep 2026`, kuartal `Q3 2026`, half-year `H2 2026`,
 * tahun `2026`. Rentang (between) -> `awal – akhir`. Nama bulan singkat
 * mengikuti locale lewat `monthsShort` (default Inggris).
 * @param {object} value nilai in_period
 * @param {string[]} [monthsShort] 12 nama bulan singkat locale aktif
 * @returns {string}
 */
export const formatPeriodValue = (
  value,
  monthsShort = DEFAULT_MONTHS_SHORT,
) => {
  if (!value || typeof value !== "object" || !value.period) return "";
  const isRange =
    value.operator === "between" || value.operator === "not-between";
  // `Date` (mentah dari widget) / string `YYYY-MM-DD[ HH:mm[:ss]]` -> tanggal;
  // jam ikut tampil HANYA bila bukan 00:00 (selaras backend: jam != 0 =
  // filter presisi-menit, bukan seluruh hari).
  // String dibaca APA ADANYA (tanpa konversi zona) -- selaras cara backend
  // membacanya (`Carbon::parse`); `Date` mentah pakai komponen lokal.
  const day = (v) => {
    let parts;
    if (v instanceof Date) {
      parts = [
        v.getFullYear(),
        v.getMonth() + 1,
        v.getDate(),
        v.getHours(),
        v.getMinutes(),
      ];
    } else {
      const m = `${v ?? ""}`
        .replace("T", " ")
        .match(/^(\d{4})-(\d{2})-(\d{2})(?: (\d{2}):(\d{2}))?/);
      if (!m) return `${v ?? ""}`;
      parts = [+m[1], +m[2], +m[3], +(m[4] ?? 0), +(m[5] ?? 0)];
    }
    const [y, mo, d, hh, mi] = parts;
    const base = `${pad2(d)} ${monthsShort[mo - 1]} ${y}`;
    return hh || mi ? `${base} ${pad2(hh)}:${pad2(mi)}` : base;
  };
  const unit = (year, idx) => {
    if (value.period === "month") return `${monthsShort[idx]} ${year}`;
    if (value.period === "quarter") return `Q${Number(idx) + 1} ${year}`;
    if (value.period === "half-year") return `H${Number(idx) + 1} ${year}`;
    return `${year}`;
  };

  // Perbandingan (`>2026` dst) HARUS terbaca di chip -- tanpa simbol, "> 2026"
  // tampil sama persis dgn "= 2026" (menyesatkan).
  const cmp = COMPARE_SYMBOL_BY_PERIOD_OPERATOR[value.operator] ?? "";

  if (value.period === "day") {
    return isRange && value.endDate
      ? `${day(value.startDate)} – ${day(value.endDate)}`
      : `${cmp}${day(value.startDate)}`;
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
  return `${cmp}${unit(value.year, value[idxKey])}`;
};

const PERIOD_UNIT_FIELD = {
  month: "month",
  quarter: "quarter",
  "half-year": "halfYear",
};
const PERIOD_SYMBOL = {
  after: ">",
  "on-or-after": ">=",
  before: "<",
  "on-or-before": "<=",
};

/**
 * Nilai periode -> TEKS ketikan yg bisa dibaca balik `parseDateText` (revisi
 * 10, sinkron widget -> search box): simbol operator (`>`, `>=`, `<`, `<=`)
 * di depan, rentang `a..b`, label `formatPeriodValue` (`25 Sep 2026`, `Sep
 * 2026`, `Q3 2026`, ...). Tanpa pilihan hanya simbolnya (mis. `>`); `..`
 * bila between kosong; "" bila operator `is` tanpa pilihan.
 * @param {object} value nilai periode (bentuk widget: startDate/endDate string)
 * @param {string[]} [monthsShort]
 * @returns {string}
 */
export const periodValueToText = (value, monthsShort) => {
  if (!value?.period) return "";
  const label = (part) =>
    formatPeriodValue({ ...part, operator: "is" }, monthsShort);
  const endpoint = (r) => {
    const part = { period: value.period, year: r.year };
    const field = PERIOD_UNIT_FIELD[value.period];
    if (field) part[field] = r.value;
    return label(part);
  };

  if (value.operator === "between") {
    const a =
      value.period === "day"
        ? value.startDate
          ? label({ period: "day", startDate: value.startDate })
          : ""
        : value.rangeStart
          ? endpoint(value.rangeStart)
          : "";
    const b =
      value.period === "day"
        ? value.endDate
          ? label({ period: "day", startDate: value.endDate })
          : ""
        : value.rangeEnd
          ? endpoint(value.rangeEnd)
          : "";
    return a || b ? `${a}..${b}` : "..";
  }
  const symbol = PERIOD_SYMBOL[value.operator] ?? "";
  return hasPeriodSelection(value) ? `${symbol}${label(value)}` : symbol;
};

/**
 * Leaf literal (operator default per mode, TANPA cek simbol) -- dasar dari
 * `buildLeafFromText` DAN fallback-nya sendiri saat kombinasi simbol tak
 * cocok utk tipe kolom aktif (Requirement 19.6).
 * @param {object} column
 * @param {"text"|"number"|"relation"} mode
 * @param {string} text SUDAH trim, TAK kosong.
 * @returns {{k: string, o: string, v: *}|null}
 */
const buildLiteralLeaf = (column, mode, text) => {
  if (mode === "text") return { k: column.name, o: "matches", v: text };
  if (mode === "number") {
    const n = Number(text);
    return Number.isNaN(n) ? null : { k: column.name, o: "=", v: n };
  }
  if (mode === "relation") {
    const labelColumn = relationLabelColumn(column);
    return labelColumn ? { k: labelColumn.name, o: "matches", v: text } : null;
  }
  return null;
};

// Operator negasi per mode (revisi 3, sintaks ketik `!`) -- Requirement 19.3.
const NEGATE_OPERATOR = {
  text: "!matches",
  relation: "!matches",
  number: "!=",
};

// Urutan PANJANG dulu (`>=`/`<=` sebelum `>`/`<`) supaya `>=` tak pernah
// salah cocok sbg `>` + sisa teks `"=..."`.
const COMPARE_PREFIXES = [">=", "<=", ">", "<"];

/**
 * Bangun patch leaf `{k, o, v}` dari teks ketikan sesuai mode kolom. `null`
 * bila teks kosong / tak valid utk mode itu (mode `list`/`date` tidak lewat
 * sini -- nilainya dipilih dari daftar).
 *
 * Revisi 3 (Requirement 19, sintaks ketik `kolom:operator?value`) -- selain
 * teks polos (operator default), mengenali AWALAN simbol pada `text`:
 * `!nilai` (negasi), `>`/`>=`/`<`/`<=` nilai (perbandingan, KHUSUS number),
 * `a|b|c` (daftar -> `in`). Kombinasi tak cocok utk tipe kolom aktif (mis.
 * `>` pada kolom text) jatuh ke literal (Requirement 19.6) -- TIDAK pernah
 * error/blocking, konsisten dgn filosofi "tanpa dialog operator" revisi 2.
 *
 * Revisi 6 (Requirement 26): separator daftar diganti koma -> pipe (`|`) --
 * koma bentrok dgn desimal locale ID/EU (`"10,5"` ambigu angka vs list).
 * Ditambah sintaks `a..b` (KHUSUS number) -> `between`.
 * @param {object} column
 * @param {string} text
 * @returns {{k: string, o: string, v: *}|null}
 */
export const buildLeafFromText = (column, text) => {
  const trimmed = `${text ?? ""}`.trim();
  if (!trimmed) return null;
  const mode = resolveValueMode(column);
  if (mode !== "text" && mode !== "number" && mode !== "relation") {
    return null;
  }

  if (trimmed.startsWith("!") && trimmed.length > 1) {
    const rest = trimmed.slice(1).trim();
    const negated = rest ? buildLiteralLeaf(column, mode, rest) : null;
    if (negated) return { ...negated, o: NEGATE_OPERATOR[mode] };
  }

  if (mode === "number") {
    for (const prefix of COMPARE_PREFIXES) {
      if (!trimmed.startsWith(prefix)) continue;
      const rest = trimmed.slice(prefix.length).trim();
      const n = Number(rest);
      if (rest && !Number.isNaN(n)) return { k: column.name, o: prefix, v: n };
    }

    const betweenIdx = trimmed.indexOf("..");
    if (betweenIdx > 0) {
      const a = Number(trimmed.slice(0, betweenIdx).trim());
      const b = Number(trimmed.slice(betweenIdx + 2).trim());
      if (!Number.isNaN(a) && !Number.isNaN(b)) {
        return { k: column.name, o: "between", v: [a, b] };
      }
    }
  }

  if (trimmed.includes("|")) {
    const parts = trimmed
      .split("|")
      .map((p) => p.trim())
      .filter(Boolean);
    if (parts.length > 1) {
      if (mode === "number") {
        const nums = parts.map(Number);
        if (nums.every((n) => !Number.isNaN(n))) {
          return { k: column.name, o: "in", v: nums };
        }
      } else {
        const key =
          mode === "relation" ? relationLabelColumn(column)?.name : column.name;
        if (key) return { k: key, o: "in", v: parts };
      }
    }
  }

  return buildLiteralLeaf(column, mode, trimmed);
};

const NEGATED_OPERATORS = new Set(Object.values(NEGATE_OPERATOR));

/**
 * Kebalikan `buildLeafFromText` -- rekonstruksi teks ketikan (termasuk
 * awalan simbol) dari sebuah leaf `{k, o, v}`, dipakai saat EDIT ULANG chip
 * existing (Requirement 25: chip diedit tanpa ini kehilangan operator diam2
 * -- prefill dulu HANYA `v`, commit ulang tanpa retype simbol membuat
 * operator `!=`/`>`/`in` balik ke default). `null`/leaf tanpa `o` dikenal ->
 * string kosong.
 * @param {{o?: string, v?: *}|null} leaf
 * @returns {string}
 */
export const leafToText = (leaf) => {
  if (!leaf) return "";
  const { o, v } = leaf;
  if (o === "in") {
    return (Array.isArray(v) ? v : [v]).map((x) => `${x}`).join(" | ");
  }
  if (o === "between") {
    const [a, b] = Array.isArray(v) ? v : [v];
    return `${a ?? ""}..${b ?? ""}`;
  }
  if (NEGATED_OPERATORS.has(o)) {
    return `!${v ?? ""}`;
  }
  if (COMPARE_PREFIXES.includes(o)) {
    return `${o}${v ?? ""}`;
  }
  return `${v ?? ""}`;
};

/**
 * Pecah teks search box multi-value (revisi 7, Requirement 36.2) `!a | b; c`
 * jadi bagian-bagiannya. `committed` = segmen SEBELUM pemisah terakhir (sudah
 * "selesai" diketik -> jadi chip / harus cocok label opsi); `pending` =
 * segmen SESUDAH pemisah terakhir (masih diketik -> filter pencarian).
 * Segmen kosong dibuang.
 * @param {string} text
 * @param {object} [options]
 * @param {string} [options.separators] karakter pemisah (`separatorsFor(mode)`).
 * @param {(label: string) => boolean} [options.isLabel] true bila seluruh
 *   ketikan adalah SATU label opsi (walau memuat karakter pemisah).
 * @returns {{exclude: boolean, committed: string[], pending: string}}
 */
export const parseMultiValueText = (
  text,
  { separators = "|;", isLabel } = {},
) => {
  const raw = `${text ?? ""}`;
  const exclude = raw.startsWith("!");
  const body = exclude ? raw.slice(1) : raw;
  const sepClass = new RegExp(`[${separators}]`);
  // Seluruh ketikan = SATU label opsi yg kebetulan memuat karakter pemisah
  // (mis. "PT Maju, Tbk" hasil Tab/ketik penuh) -> jangan dipecah; pemisah
  // di ujung ("PT Maju, Tbk|") tetap menyelesaikan label itu.
  const trimmed = body.trim();
  const endsWithSep = sepClass.test(trimmed.slice(-1));
  const core = endsWithSep ? trimmed.slice(0, -1).trim() : trimmed;
  if (isLabel?.(core)) {
    return endsWithSep
      ? { exclude, committed: [core], pending: "" }
      : { exclude, committed: [], pending: body.replace(/^\s+/, "") };
  }
  const parts = body.split(sepClass);
  const pending = parts.pop().replace(/^\s+/, "");
  return {
    exclude,
    committed: parts.map((p) => p.trim()).filter(Boolean),
    pending,
  };
};

/**
 * Leaf dari nilai terpilih kolom list/boolean (revisi 12): SATU nilai -> `=`/`!=`,
 * >= 2 -> `in`/`!in`. Kolom `formStatuses` (array status) TAK punya `=`/`!=`
 * (backend `FilterTreeCleaner`: has/!has/in/!in) sehingga selalu `in`/`!in`,
 * walau satu nilai.
 * @param {object} column
 * @param {Array<string|number|boolean>} values
 * @param {boolean} [exclude]
 * @returns {{k: string, o: string, v: *}|null}
 */
export const buildListLeaf = (column, values, exclude = false) => {
  if (!values?.length) return null;
  if (values.length === 1 && column.type !== "formStatuses") {
    return { k: column.name, o: exclude ? "!=" : "=", v: values[0] };
  }
  return { k: column.name, o: exclude ? "!in" : "in", v: values };
};

// Nilai bersimbol (revisi 12): perbandingan (`>`, `>=`, `<`, `<=`) atau rentang
// (`a..b`) -- hanya sah SENDIRIAN (satu chip); banyak nilai (`in`) = nilai polos.
/**
 * @param {"number"|"date"|string|null} mode
 * @param {string} text ketikan / teks chip (tanpa awalan `!`)
 * @returns {boolean}
 */
export const hasValueSymbol = (mode, text) => {
  if (mode !== "number" && mode !== "date") return false;
  const s = `${text ?? ""}`.trim();
  return COMPARE_PREFIXES.some((p) => s.startsWith(p)) || s.includes("..");
};

// Chip bersimbol? number: teks chip; date: objek periode (operator != "is").
const chipHasSymbol = (mode, chip) =>
  mode === "date" ? chip?.operator !== "is" : hasValueSymbol(mode, chip);

/**
 * Aturan daftar chip nilai number/date (revisi 12): N nilai polos ATAU tepat
 * SATU nilai bersimbol (kecuali negasi `!`, yg global). Dipakai SAAT mengetik
 * -- pelanggaran DITOLAK (kotak tak berubah) + pesan, bukan diterima lalu
 * diberi peringatan.
 * @param {"number"|"date"|string|null} mode
 * @param {Array<string|object>} otherChips chip yg sudah ada (TANPA yg sedang diedit)
 * @param {string[]} typed segmen ketikan (committed + pending)
 * @returns {"symbol_with_chips"|"single_only"|null}
 *   `single_only` = chip bersimbol sudah ada -> tak ada chip berikutnya;
 *   `symbol_with_chips` = simbol diketik selagi ada chip lain / >1 segmen.
 */
export const chipEntryViolation = (mode, otherChips, typed) => {
  if (mode !== "number" && mode !== "date") return null;
  const segments = typed.map((s) => `${s}`.trim()).filter(Boolean);
  if (segments.length === 0) return null;
  if (otherChips.some((chip) => chipHasSymbol(mode, chip))) {
    return "single_only";
  }
  const hasSymbol = segments.some((s) => hasValueSymbol(mode, s));
  return hasSymbol && (otherChips.length > 0 || segments.length > 1)
    ? "symbol_with_chips"
    : null;
};

// Pemisah nilai chip (revisi 7): `|` dan `;` utk SEMUA tipe ber-operator `in`;
// `,` HANYA utk non-number (koma = desimal di locale ID/EU, Requirement 26) dan
// non-date (revisi 11: koma tak dipakai utk tanggal -- "25 Sep, 2026" ambigu).
export const separatorsFor = (mode) =>
  mode === "number" || mode === "date" ? "|;" : "|;,";

/**
 * Leaf dari chip nilai kolom text/number (revisi 7, Requirement 36.7): SATU
 * nilai -> lewat `buildLeafFromText` (operator biasa: `matches`, `=`,
 * perbandingan `>`/`between` utk number, `!` -> `!matches`/`!=`); >=2 nilai
 * -> `in`/`!in` (dibangun LANGSUNG -- jalur string `!a|b` lama menghasilkan
 * `!matches "a|b"`, bukan `!in`). `null` bila kosong, atau number dgn >=2
 * nilai yg tak semuanya angka.
 * @param {object} column
 * @param {Array<string|number>} values
 * @param {boolean} [exclude]
 * @returns {{k: string, o: string, v: *}|null}
 */
export const buildChipsLeaf = (column, values, exclude = false) => {
  const vals = values.map((v) => `${v}`.trim()).filter(Boolean);
  if (vals.length === 0) return null;
  if (vals.length === 1) {
    return buildLeafFromText(column, `${exclude ? "!" : ""}${vals[0]}`);
  }
  const o = exclude ? "!in" : "in";
  if (resolveValueMode(column) === "number") {
    const nums = vals.map(Number);
    return nums.some(Number.isNaN) ? null : { k: column.name, o, v: nums };
  }
  return { k: column.name, o, v: vals };
};

// Sama urutan `COMPARE_PREFIXES` (panjang dulu) tapi map ke operator DI
// DALAM value `in_period` (bukan operator leaf top-level spt number/text --
// leaf date SELALU `in_period`/`!in_period`, perbandingan encoded di
// `v.operator`, selaras `FilterEvaluator::applyPeriod()`).
const DATE_COMPARE_OPERATOR = [
  [">=", "on-or-after"],
  ["<=", "on-or-before"],
  [">", "after"],
  ["<", "before"],
];

/**
 * Bangun leaf `{k, o, v}` utk kolom date/datetime dari teks ketikan --
 * grammar simbol SAMA dgn `buildLeafFromText` (`!` negasi, `>`/`>=`/`<`/`<=`
 * perbandingan, `a..b` between -- Requirement 26, 30.6, §15.1/§15.5), reuse
 * `parsePeriodToken`/`buildBetweenPeriodValue` (periodParsing.js) per token.
 * BUKAN via `Filter/DateSelector.jsx:parseSummary` (itu punya grammar SENDIRI
 * -- label i18n & separator ` - `, khusus widget itu).
 * @param {object} column kolom date/datetime
 * @param {string} text
 * @param {{isDatetime: boolean, dateLocale: object, i18nLabels: object}} ctx
 * @returns {{k: string, o: string, v: object}|null}
 */
export const buildDateLeafFromText = (column, text, ctx) => {
  let trimmed = `${text ?? ""}`.trim();
  if (!trimmed) return null;

  let negate = false;
  if (trimmed.startsWith("!") && trimmed.length > 1) {
    negate = true;
    trimmed = trimmed.slice(1).trim();
  }
  const leafOperator = negate ? "!in_period" : "in_period";

  // Token `day` membawa `Date` (kontrak widget `DateSelector`); leaf yg
  // dikirim ke backend WAJIB string LOKAL -- `Date`/`toISOString()` (UTC)
  // menggeser hari di zona +07 (tengah malam lokal jadi 17:00 hari
  // SEBELUMNYA, dibaca `FilterEvaluator` sbg filter presisi-menit).
  const leaf = (value) => {
    if (!value) return null;
    const out = { ...value };
    if (out.startDate instanceof Date) {
      out.startDate = toLocalDayString(out.startDate);
    }
    if (out.endDate instanceof Date) {
      out.endDate = toLocalDayString(out.endDate);
    }
    return { k: column.name, o: leafOperator, v: out };
  };

  const betweenIdx = trimmed.indexOf("..");
  if (betweenIdx > 0) {
    const a = parsePeriodToken(trimmed.slice(0, betweenIdx).trim(), ctx);
    const b = parsePeriodToken(trimmed.slice(betweenIdx + 2).trim(), ctx);
    return leaf(buildFlexibleBetween(a, b));
  }

  for (const [prefix, operator] of DATE_COMPARE_OPERATOR) {
    if (!trimmed.startsWith(prefix)) continue;
    const token = parsePeriodToken(trimmed.slice(prefix.length).trim(), ctx);
    return leaf(token && { ...token, operator });
  }

  const token = parsePeriodToken(trimmed, ctx);
  return leaf(token && { ...token, operator: "is" });
};

const unitIndex = (token) =>
  token.period === "month"
    ? token.month
    : token.period === "quarter"
      ? token.quarter
      : token.period === "half-year"
        ? token.halfYear
        : 0;

// Token/nilai dgn `Date` -> string LOKAL (bentuk leaf).
const toLeafValue = (value) => {
  const out = { ...value };
  if (out.startDate instanceof Date) {
    out.startDate = toLocalDayString(out.startDate);
  }
  if (out.endDate instanceof Date) {
    out.endDate = toLocalDayString(out.endDate);
  }
  return out;
};

/**
 * Teks ketikan date/datetime -> `{negate, operator, value}` utk SINKRON ke
 * widget (revisi 10). Beda dgn `buildDateLeafFromText` (yg hanya memberi leaf
 * bila teks LENGKAP): di sini simbol operator yg berdiri sendiri (`>`, `..`)
 * tetap menghasilkan `operator` (`value` null), dan rentang yg baru separuh
 * (`25 Sep 2026..`) menghasilkan `between` dgn ujung awal saja.
 * @param {string} text
 * @param {{isDatetime: boolean, dateLocale: object, i18nLabels: object}} ctx
 * @returns {{negate: boolean, operator: string, value: object|null}}
 */
export const parseDateText = (text, ctx) => {
  let t = `${text ?? ""}`.trim();
  const negate = t.startsWith("!");
  if (negate) t = t.slice(1).trim();

  const idx = t.indexOf("..");
  if (idx >= 0) {
    const a = parsePeriodToken(t.slice(0, idx).trim(), ctx);
    const b = parsePeriodToken(t.slice(idx + 2).trim(), ctx);
    const full = buildFlexibleBetween(a, b);
    if (full) {
      return { negate, operator: "between", value: toLeafValue(full) };
    }
    if (a) {
      const start =
        a.period === "day"
          ? { period: "day", operator: "between", startDate: a.startDate }
          : {
              period: a.period,
              operator: "between",
              year: a.year,
              rangeStart: { year: a.year, value: unitIndex(a) },
            };
      return { negate, operator: "between", value: toLeafValue(start) };
    }
    return { negate, operator: "between", value: null };
  }

  for (const [prefix, operator] of DATE_COMPARE_OPERATOR) {
    if (!t.startsWith(prefix)) continue;
    const token = parsePeriodToken(t.slice(prefix.length).trim(), ctx);
    return {
      negate,
      operator,
      value: token ? toLeafValue({ ...token, operator }) : null,
    };
  }
  const token = parsePeriodToken(t, ctx);
  return {
    negate,
    operator: "is",
    value: token ? toLeafValue({ ...token, operator: "is" }) : null,
  };
};

// --- Saran nilai tanggal dari ketikan (revisi 9, Requirement 54) -----------

const SUGGESTION_LIMIT = 5;
const QUARTER_WORDS = ["kuartal", "quartal", "quarter", "triwulan"];
const HALF_WORDS = ["semester", "half"];

/**
 * Tahun kandidat saran: SATU ketikan + tetangganya, maksimal 5 tahun, batas
 * atas = tahun sistem + 1 (bukan `typed + 2` buta); sisa slot diisi tahun
 * SEBELUM ketikan. Urutan: paling dekat dgn ketikan dulu, seri -> tahun lebih
 * lampau (mis. ketik 2025, sistem 2026 -> 2025, 2024, 2026, 2023, 2027).
 * @param {number} typedYear
 * @param {Date} [now]
 * @returns {number[]}
 */
export const suggestionYears = (typedYear, now = new Date()) => {
  const cap = now.getFullYear() + 1;
  const after = Math.max(0, Math.min(2, cap - typedYear));
  const before = SUGGESTION_LIMIT - 1 - after;
  const years = [];
  for (let y = typedYear - before; y <= typedYear + after; y++) years.push(y);
  return years.sort(
    (a, b) => Math.abs(a - typedYear) - Math.abs(b - typedYear) || a - b,
  );
};

// Posisi tahun di dalam teks token: 4 digit di awal (`2026-09`, `2026 Q2`),
// seluruh teks (`2026`/`26`), atau 2/4 digit terakhir sebelum suffix jam.
const findYearSlot = (text) => {
  if (/^\d{4}(?=\D)/.test(text)) return { start: 0, len: 4 };
  const whole = text.match(/^(\d{4}|\d{2})$/);
  if (whole) return { start: 0, len: whole[1].length };
  const end = /(\d{4}|\d{2})(?=(?:[ T]\d{1,2}:\d{2}(?::\d{2})?)?$)/.exec(text);
  return end ? { start: end.index, len: end[1].length } : null;
};

// Ganti tahun di `slot` dgn `year`, lebar digit mengikuti ketikan (2 vs 4).
const withYear = (text, slot, year) =>
  text.slice(0, slot.start) +
  (slot.len === 2 ? String(year).slice(-2) : String(year)) +
  text.slice(slot.start + slot.len);

const capitalize = (w) => w.charAt(0).toUpperCase() + w.slice(1);

/**
 * Saran nilai tanggal yg MENIRU format ketikan (revisi 9): "Jan 26" -> "Jan
 * 26", "Jan 25", "Jan 27", ... Tiap kandidat divalidasi `parsePeriodToken`
 * (parser yg SAMA dgn Enter) sehingga label saran = apa yg akan dikomit.
 * - awalan tahun (1-3 digit): tahun sekitar tahun sistem yg berawalan itu;
 * - token lengkap: variasi TAHUN (`suggestionYears`), format dipertahankan;
 * - token tanpa tahun (`Jan`, `Q2`, `Kuartal 2`, `15/09`, `15 Sep`): dilengkapi
 *   tahun sistem lalu divariasikan;
 * - kata kuartal/semester tanpa angka, awalan nama bulan: unit dienumerasi di
 *   tahun sistem (paling dekat dgn sekarang dulu).
 * `[]` utk teks kosong atau tak dikenali.
 * @param {string} raw
 * @param {{i18nLabels: object, dateLocale?: object, isDatetime?: boolean, now?: Date}} ctx
 * @returns {Array<{key: string, label: string, value: object}>}
 */
const suggestBody = (
  raw,
  { i18nLabels, dateLocale, isDatetime = false, now = new Date(), anchorYear },
) => {
  const text = `${raw ?? ""}`.trim().replace(/\s+/g, " ");
  if (!text) return [];
  const ctx = { isDatetime, dateLocale, i18nLabels };
  // `anchorYear` (rentang): tahun acuan pengganti tahun sistem utk token tanpa
  // tahun; batas atas tahun tetap berdasar `now`.
  const sysYear = anchorYear ?? now.getFullYear();
  const lower = text.toLowerCase();

  // Kandidat (string) -> saran; buang yg tak terparse & duplikat.
  const finish = (labels) => {
    const seen = new Set();
    const out = [];
    for (const label of labels) {
      if (seen.has(label)) continue;
      const token = parsePeriodToken(label, ctx);
      if (!token) continue;
      seen.add(label);
      const { startDate, ...rest } = token;
      const value = { ...rest, operator: "is" };
      if (startDate) value.startDate = toLocalDayString(startDate);
      out.push({ key: `sug:${label}`, label, value });
      if (out.length === SUGGESTION_LIMIT) break;
    }
    return out;
  };
  const yearVariants = (seed, typedYear) => {
    const slot = findYearSlot(seed);
    return slot
      ? suggestionYears(typedYear, now).map((y) => withYear(seed, slot, y))
      : [seed];
  };
  const byCloseness = (center) => (a, b) =>
    Math.abs(a - center) - Math.abs(b - center) || a - b;

  // 1. awalan tahun (`2`, `20`, `202`)
  if (/^\d{1,3}$/.test(text)) {
    const years = suggestionYears(sysYear, now).filter((y) =>
      String(y).startsWith(text),
    );
    if (years.length) return finish(years.map(String));
  }

  // 2. token sudah lengkap -> variasi tahun, format ketikan dipertahankan
  const token = parsePeriodToken(text, ctx);
  if (token) {
    const slot = findYearSlot(text);
    const typedYear = token.year ?? token.startDate?.getFullYear();
    return slot && typedYear != null
      ? finish(yearVariants(text, typedYear))
      : [];
  }

  // 3. tanpa tahun -> lengkapi dgn tahun sistem (`15/09` -> `15/09/2026`)
  const dm = text.match(/^\d{1,2}([/\-.])\d{1,2}$/);
  const tryAppend = (sep) => {
    const candidate = `${text}${sep}${sysYear}`;
    return parsePeriodToken(candidate, ctx) ? candidate : null;
  };
  const seed = (dm ? tryAppend(dm[1]) : null) ?? tryAppend(" ");
  if (seed) return finish(yearVariants(seed, sysYear));

  // 4. kata kuartal / semester tanpa angka (tahun sistem, paling dekat dulu)
  const currentQuarter = Math.floor(now.getMonth() / 3);
  const currentHalf = now.getMonth() < 6 ? 0 : 1;
  const unitLabels = (words, letter, count, current) => {
    const word = words.find((w) => lower.length >= 3 && w.startsWith(lower));
    const single = lower === letter;
    if (!word && !single) return null;
    const name = single ? null : lower === word ? text : capitalize(word);
    return Array.from({ length: count }, (_, i) => i)
      .sort(byCloseness(current))
      .map((i) => {
        const n = i + 1;
        const unit = name ? `${name} ${n}` : `${letter.toUpperCase()}${n}`;
        return `${unit} ${sysYear}`;
      });
  };
  const quarters = unitLabels(QUARTER_WORDS, "q", 4, currentQuarter);
  if (quarters) return finish(quarters);
  const halves = unitLabels(HALF_WORDS, "h", 2, currentHalf);
  if (halves) return finish(halves);

  // 5. awalan nama bulan (1-2 huruf / ambigu), tahun sistem
  if (/^[A-Za-zÀ-ɏ.]+$/.test(text)) {
    const idx = monthsStartingWith(text, i18nLabels);
    if (idx.length === 1) {
      return finish(
        yearVariants(`${i18nLabels.months[idx[0]]} ${sysYear}`, sysYear),
      );
    }
    if (idx.length > 1) {
      return finish(
        idx
          .sort(byCloseness(now.getMonth()))
          .map((i) => `${i18nLabels.months[i]} ${sysYear}`),
      );
    }
  }

  return [];
};

// Kunci urut ujung rentang (hasil `buildFlexibleBetween`): hari -> waktu,
// lainnya -> tahun*100 + unit.
const edgeKey = (value, which) => {
  if (value.period === "day") {
    return (which === "start" ? value.startDate : value.endDate).getTime();
  }
  const edge = which === "start" ? value.rangeStart : value.rangeEnd;
  return edge.year * 100 + edge.value;
};

/**
 * Saran utk rentang `a..b` (revisi 10): saran dihitung utk segmen yg sedang
 * diketik (ujung akhir `b`; bila kosong, dari ujung awal `a` -- ujung akhir
 * pertama = ujung awal itu sendiri), diawali `a..` apa adanya. Ujung awal
 * harus sudah terparse. Ujung akhir tanpa tahun (`Jan 2026..Mar`) dilengkapi
 * tahun ujung AWAL (bukan tahun sistem); granularitas ujung boleh beda
 * (`Jan 2026..2027`, lihat `buildFlexibleBetween`). Kandidat yg ujung
 * akhirnya SEBELUM ujung awal dibuang.
 * @param {string} text berisi `..`
 * @param {object} ctx sama dgn `suggestBody`
 * @returns {Array<{key: string, label: string, value: object}>}
 */
const suggestRange = (text, ctx) => {
  const idx = text.indexOf("..");
  const left = text.slice(0, idx).trim();
  const right = text.slice(idx + 2).trim();
  const parseCtx = {
    isDatetime: ctx.isDatetime ?? false,
    i18nLabels: ctx.i18nLabels,
  };
  const start = left ? parsePeriodToken(left, parseCtx) : null;
  if (!start) return [];
  const anchorYear = start.year ?? start.startDate.getFullYear();
  const out = [];
  for (const candidate of suggestBody(right || left, { ...ctx, anchorYear })) {
    const end = parsePeriodToken(candidate.label, parseCtx);
    const value = buildFlexibleBetween(start, end);
    if (!value || edgeKey(value, "end") < edgeKey(value, "start")) continue;
    const label = `${left}..${candidate.label}`;
    out.push({ key: `sug:${label}`, label, value: toLeafValue(value) });
  }
  return out;
};

export const DATE_OPERATOR_BY_SYMBOL = {
  ">=": "on-or-after",
  "<=": "on-or-before",
  ">": "after",
  "<": "before",
};

/**
 * Saran nilai tanggal (lihat `suggestBody`) + dukungan simbol perbandingan di
 * depan (revisi 10): `>= Jan 26` -> saran `>=Jan 26`, `>=Jan 25`, ... dgn
 * operator `on-or-after`. Rentang (`..`) & simbol tanpa isi -> [].
 * @param {string} raw
 * @param {{i18nLabels: object, dateLocale?: object, isDatetime?: boolean, now?: Date}} ctx
 * @returns {Array<{key: string, label: string, value: object}>}
 */
export const suggestPeriodTokens = (raw, ctx) => {
  const text = `${raw ?? ""}`.trim();
  if (!text) return [];
  if (text.includes("..")) return suggestRange(text, ctx);
  const match = text.match(/^(>=|<=|>|<)\s*(.*)$/);
  if (!match) return suggestBody(text, ctx);
  const [, symbol, body] = match;
  const operator = DATE_OPERATOR_BY_SYMBOL[symbol];
  return suggestBody(body, ctx).map((s) => ({
    ...s,
    key: `sug:${symbol}${s.label}`,
    label: `${symbol}${s.label}`,
    value: { ...s.value, operator },
  }));
};

// --- Chip nilai date/datetime (revisi 11, Requirement 60) -------------------

/** Batas nilai `in` date/datetime -- selaras `FilterTreeCleaner::MAX_PERIOD_VALUES`. */
export const MAX_DATE_VALUES = 20;

const DATE_SIGNATURE_KEYS = [
  "period",
  "operator",
  "startDate",
  "endDate",
  "year",
  "month",
  "quarter",
  "halfYear",
  "rangeStart",
  "rangeEnd",
];
const keySignature = (v) => DATE_SIGNATURE_KEYS.map((k) => v?.[k] ?? null);

/**
 * Tanda tangan KANONIK (urutan kunci tetap) nilai periode / nilai widget --
 * membandingkan nilai widget dgn prefill leaf (urutan kunci leaf tersimpan bisa
 * beda dari emisi widget) DAN jadi kunci chip. Bila `selections` ada, ikut
 * dihitung (nilai widget mode multi).
 * @param {object|null|undefined} v
 * @returns {string}
 */
export const dateSignature = (v) =>
  JSON.stringify(
    Array.isArray(v?.selections)
      ? [keySignature(v), v.selections.map(keySignature)]
      : keySignature(v),
  );

/**
 * Nilai periode bentuk leaf: hanya kunci periode yg terisi (tanpa `undefined`/
 * `null`/`selections`) -- yg dikirim ke backend.
 * @param {object} v
 * @returns {object}
 */
export const cleanPeriodValue = (v) =>
  Object.fromEntries(
    DATE_SIGNATURE_KEYS.filter((k) => v?.[k] != null).map((k) => [k, v[k]]),
  );

/**
 * Daftar periode dari leaf date/datetime existing: `in_period`/`!in_period` ->
 * `v` objek = satu nilai, `v` daftar = daftar (Revisi 16); selain itu [].
 * Dipakai prefill chip nilai saat EDIT chip utama.
 * @param {{o?: string, v?: *}|null|undefined} leaf
 * @returns {object[]}
 */
export const leafDatePeriods = (leaf) => {
  if (!leaf) return [];
  const { o, v } = leaf;
  if (o !== "in_period" && o !== "!in_period") return [];
  if (Array.isArray(v)) {
    return v.filter((x) => x && typeof x === "object" && x.period);
  }
  return v && typeof v === "object" ? [v] : [];
};

/**
 * Teks ketikan -> SATU nilai periode siap jadi chip (`operator` di dalamnya),
 * atau null bila tak terparse / belum ada pilihan. Rentang yg baru separuh
 * dilengkapi (end = start), sama dgn penutupan popover di Builder.
 * @param {string} text tanpa awalan `!` (negasi = state Search Bar)
 * @param {{isDatetime: boolean, dateLocale: object, i18nLabels: object}} ctx
 * @returns {object|null}
 */
export const parseDatePeriod = (text, ctx) => {
  const { value } = parseDateText(text, ctx);
  return value && hasPeriodSelection(value) ? completeRange(value) : null;
};

/**
 * Tambah/ganti nilai di daftar chip date (Requirement 60.4): daftar sah =
 * N (>= 1) nilai "Pada" (`is`) ATAU tepat SATU nilai selain itu. Pelanggaran
 * / melebihi batas -> `{error}` dan daftar TAK berubah (pemanggil tampilkan
 * pesan). Duplikat dibuang.
 * @param {object[]} prev daftar chip sekarang
 * @param {object[]} incoming nilai baru
 * @param {object} [options]
 * @param {string|null} [options.replaceKey] `dateSignature` chip yg diedit --
 *   `incoming` menggantikannya di posisi yg sama.
 * @param {boolean} [options.dropReplaced] `incoming` kosong = hapus chip yg diedit.
 * @param {number} [options.max]
 * @returns {{chips: object[]}|{error: "multi_only_is"|"limit"}}
 */
export const mergeDatePeriods = (
  prev,
  incoming,
  { replaceKey = null, dropReplaced = false, max = MAX_DATE_VALUES } = {},
) => {
  const list = [...prev];
  const at =
    replaceKey === null
      ? -1
      : list.findIndex((p) => dateSignature(p) === replaceKey);
  if (at >= 0) {
    if (incoming.length > 0) list.splice(at, 1, ...incoming);
    else if (dropReplaced) list.splice(at, 1);
  } else {
    list.push(...incoming);
  }
  const seen = new Set();
  const chips = list.filter((p) => {
    const key = dateSignature(p);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  if (chips.length > 1 && chips.some((p) => p.operator !== "is")) {
    return { error: "multi_only_is" };
  }
  if (chips.length > max) return { error: "limit" };
  return { chips };
};

/**
 * Leaf dari chip nilai date/datetime -- SELALU `in_period`/`!in_period`
 * (Revisi 16): SATU nilai -> `v` objek periode (operator perbandingan/rentang
 * ikut di dalam nilai); >= 2 nilai (semua "Pada") -> `v` DAFTAR periode. `null`
 * bila kosong / daftar tak sah (>= 2 nilai tapi ada yg bukan `is`).
 * @param {object} column
 * @param {object[]} periods
 * @param {boolean} [exclude]
 * @returns {{k: string, o: string, v: *}|null}
 */
export const buildDateChipsLeaf = (column, periods, exclude = false) => {
  if (!periods?.length) return null;
  if (periods.length > 1 && periods.some((p) => p.operator !== "is")) {
    return null;
  }
  return {
    k: column.name,
    o: exclude ? "!in_period" : "in_period",
    v:
      periods.length === 1
        ? cleanPeriodValue(periods[0])
        : periods.map(cleanPeriodValue),
  };
};

/**
 * Nilai widget `DateSelector` (mode multi) yg MENCERMINKAN kotak search:
 * chip + ketikan (pratinjau, belum jadi chip). Aturan: simbol/`..` saja tanpa
 * nilai -> Kondisi widget mengikuti; SATU nilai non-"Pada" -> nilai tunggal
 * widget (rentang separuh dipertahankan mentah supaya klik kedua masih
 * mungkin); selain itu daftar `selections` (Kondisi Pada). Ketikan yg
 * melanggar aturan daftar tidak dipratinjau (chip tetap).
 * @param {object} args
 * @param {object[]} args.chips
 * @param {{operator: string, value: object|null}|null} [args.typed] hasil `parseDateText` ketikan
 * @param {string|null} [args.editingKey] chip yg sedang diedit (diganti ketikan)
 * @param {string} [args.prevPeriod] Periode widget saat ini
 * @returns {object}
 */
export const buildDateWidgetValue = ({
  chips,
  typed = null,
  editingKey = null,
  prevPeriod,
}) => {
  const raw =
    typed?.value && hasPeriodSelection(typed.value) ? typed.value : null;
  const merged = mergeDatePeriods(chips, raw ? [completeRange(raw)] : [], {
    replaceKey: editingKey,
  });
  const periods = merged.error ? chips : merged.chips;
  if (periods.length === 0 && typed && typed.operator !== "is") {
    return {
      period: prevPeriod ?? "day",
      operator: typed.operator,
      selections: [],
    };
  }
  if (periods.length === 1 && periods[0].operator !== "is") {
    const only =
      raw &&
      !merged.error &&
      dateSignature(completeRange(raw)) === dateSignature(periods[0])
        ? raw
        : periods[0];
    return { ...only, selections: [] };
  }
  const plain = periods.filter((p) => p.operator === "is");
  // Periode widget: ketikan "Pada" yg ikut dipratinjau menang; selain itu
  // Periode yg sedang dipilih user dipertahankan (pemanggil menggantinya bila
  // chip baru datang dgn Periode lain, mis. hasil tempel).
  const typedPeriod =
    !merged.error && raw?.operator === "is" ? raw.period : undefined;
  return {
    period: typedPeriod ?? prevPeriod ?? plain.at(-1)?.period ?? "day",
    operator: "is",
    selections: plain,
  };
};
