// periodParsing — fungsi murni: parse token periode (tahun/kuartal/half-year/
// bulan/hari) dari teks ketikan. Diekstrak dari `DateSelector.jsx` (revisi 6,
// spec datatable2-advanced-search §15.5, Requirement 30.4) supaya `SearchBar`
// bisa reuse parser YANG SAMA tanpa duplikasi implementasi — `DateSelector.jsx`
// import balik dari sini, bukan lagi mendefinisikan sendiri.
//
// `parseSummary` (parsing ringkasan " - " range, KHUSUS widget `DateSelector.jsx`
// sendiri) SENGAJA TIDAK dipindah ke sini -- SearchBar punya sintaks between
// sendiri (`a..b`, tanpa spasi) yang split lalu panggil `parsePeriodToken` per
// sisi, BUKAN lewat `parseSummary`.

import { format } from "date-fns";
import { enUS } from "date-fns/locale";

// Simbol prefix operator untuk parse input cepat (dipakai `DateSelector.jsx`
// widget DAN SearchBar).
export const OPERATOR_SYMBOLS = [
  { sym: ">=", op: "on-or-after" },
  { sym: "<=", op: "on-or-before" },
  { sym: ">", op: "after" },
  { sym: "<", op: "before" },
  { sym: "=", op: "is" },
];

/**
 * Label i18n (operator/bulan/kuartal/half-year) untuk parsing & tampilan --
 * dibangun sekali per (t, dateLocale), dioper sbg param ke `parsePeriodToken`
 * (bukan disimpan module-level, supaya tetap murni & reaktif ke locale aktif).
 * @param {object} root0
 * @param {(key: string) => string} root0.t
 * @param {object} root0.dateLocale locale date-fns (`getLocaleDate`)
 * @returns {{operators: object, months: string[], monthsShort: string[], quarters: string[], halfYears: string[]}}
 */
export function buildPeriodI18nLabels({ t, dateLocale }) {
  return {
    operators: {
      is: t("core.datatable.filter.dateselector.subop.is"),
      after: t("core.datatable.filter.dateselector.subop.after"),
      "on-or-after": t("core.datatable.filter.dateselector.subop.on-or-after"),
      before: t("core.datatable.filter.dateselector.subop.before"),
      "on-or-before": t(
        "core.datatable.filter.dateselector.subop.on-or-before",
      ),
      between: t("core.datatable.filter.dateselector.subop.between"),
    },
    months: Array.from({ length: 12 }, (_, i) =>
      format(new Date(2000, i, 1), "MMMM", { locale: dateLocale }),
    ),
    monthsShort: Array.from({ length: 12 }, (_, i) =>
      format(new Date(2000, i, 1), "MMM", { locale: dateLocale }),
    ),
    quarters: ["Q1", "Q2", "Q3", "Q4"],
    halfYears: ["H1", "H2"],
  };
}

/**
 * Objek `i18n` lengkap utk widget `ui/date-selector.jsx` (reui) -- dipakai
 * bersama `Filter/DateSelector.jsx` (wrapper Builder lanjutan) DAN SearchBar
 * (embed langsung, revisi 6 §15.5) supaya label PERSIS sama & tak
 * terduplikasi 2x.
 * @param {object} root0
 * @param {(key: string) => string} root0.t
 * @param {{operators: object, months: string[], monthsShort: string[], quarters: string[], halfYears: string[]}} root0.i18nLabels hasil `buildPeriodI18nLabels`
 * @returns {object}
 */
export function buildReuiDateI18n({ t, i18nLabels }) {
  return {
    today: t("core.datatable.filter.dateselector.today.day"),
    labels: {
      operator: t("core.datatable.filter.dateselector.label.operator"),
      period: t("core.datatable.filter.dateselector.label.period"),
    },
    todayLabels: {
      day: t("core.datatable.filter.dateselector.today.day"),
      month: t("core.datatable.filter.dateselector.today.month"),
      quarter: t("core.datatable.filter.dateselector.today.quarter"),
      "half-year": t("core.datatable.filter.dateselector.today.half-year"),
      year: t("core.datatable.filter.dateselector.today.year"),
    },
    filterTypes: i18nLabels.operators,
    periodTypes: {
      day: t("core.datatable.filter.period.unit.day"),
      month: t("core.datatable.filter.period.unit.month"),
      quarter: t("core.datatable.filter.period.unit.quarter"),
      halfYear: t("core.datatable.filter.period.unit.half-year"),
      year: t("core.datatable.filter.period.unit.year"),
    },
    months: i18nLabels.months,
    monthsShort: i18nLabels.monthsShort,
    quarters: i18nLabels.quarters,
    halfYears: i18nLabels.halfYears,
  };
}

// Tahun 2-digit SELALU +2000 (TANPA pivot ke 19xx) -- keputusan sadar
// (brainstorming revisi 6): app ERP ini tak perlu filter tahun sebelum 2000.
const normalizeYear = (raw) => {
  const n = parseInt(raw, 10);
  return raw.length <= 2 ? 2000 + n : n;
};

// Nama bulan Inggris SELALU ikut dikenali di samping locale aktif (user app
// berbahasa Indonesia tetap wajar mengetik "August"/"Aug").
const EN_MONTHS = Array.from({ length: 12 }, (_, i) =>
  format(new Date(2000, i, 1), "MMMM", { locale: enUS }).toLowerCase(),
);
const EN_MONTHS_SHORT = Array.from({ length: 12 }, (_, i) =>
  format(new Date(2000, i, 1), "MMM", { locale: enUS }).toLowerCase(),
);

/**
 * Index bulan (0-11) dari nama bulan yg diketik, atau -1. Cocok bila SAMA
 * PERSIS dgn nama penuh/singkat (locale aktif ATAU Inggris), atau -- utk
 * ketikan >=3 huruf -- AWALAN nama penuh (`sept`, `agus`). Ambigu (awalan
 * yg cocok >1 bulan) -> -1.
 * @param {string} raw
 * @param {{months: string[], monthsShort: string[]}} i18nLabels
 * @returns {number}
 */
export function matchMonthName(raw, i18nLabels) {
  const name = `${raw ?? ""}`.trim().toLowerCase().replace(/\.$/, "");
  if (!name) return -1;
  const found = new Set();
  for (let i = 0; i < 12; i++) {
    const wide = [i18nLabels.months[i], EN_MONTHS[i]].map((s) =>
      `${s}`.toLowerCase(),
    );
    const short = [i18nLabels.monthsShort[i], EN_MONTHS_SHORT[i]].map((s) =>
      `${s}`.toLowerCase(),
    );
    if (wide.includes(name) || short.includes(name)) found.add(i);
    else if (name.length >= 3 && wide.some((w) => w.startsWith(name))) {
      found.add(i);
    }
  }
  return found.size === 1 ? [...found][0] : -1;
}

const isValidDate = (y, m, d) => {
  const dt = new Date(y, m, d);
  return dt.getFullYear() === y && dt.getMonth() === m && dt.getDate() === d;
};

const pad2 = (n) => String(n).padStart(2, "0");

/**
 * `Date` -> string LOKAL `YYYY-MM-DD` (atau `YYYY-MM-DD HH:mm` bila ada
 * komponen jam/menit) -- format yg sama dgn preset SearchBar & diterima
 * `Carbon::parse` di `FilterEvaluator::resolvePeriodBounds`. BUKAN
 * `toISOString()` (UTC): di zona +07 tengah malam lokal jadi 17:00 hari
 * SEBELUMNYA, dianggap backend sbg filter presisi-menit di hari yg salah.
 * @param {Date} d
 * @returns {string}
 */
export function toLocalDayString(d) {
  const base = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  return d.getHours() || d.getMinutes()
    ? `${base} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`
    : base;
}

// Suffix jam `HH:mm[:ss]` (dipisah spasi / `T`) -- HANYA diterima utk kolom
// datetime & HANYA utk token hari.
const TIME_SUFFIX = /^(.*\S)[ T](\d{1,2}):(\d{2})(?::\d{2})?$/;

const YEAR = String.raw`(\d{4}|\d{2})`;
// Penanda kuartal (`Q`/`K`/`TW`/kuartal/triwulan/quarter) & half-year (`H`/`S`/
// semester/half) -- kata PENUH dulu supaya alternasi tak memotong ke huruf tunggal.
const UNIT_WORD = "kuartal|quartal|triwulan|quarter|semester|half|tw|q|k|h|s";
const QUARTER_WORD = /^(kuartal|quartal|triwulan|quarter|tw|q|k)$/i;
const NAME = String.raw`([A-Za-zÀ-ɏ.]+)`;

/**
 * Parse SATU token periode (bukan ekspresi operator/range -- itu tanggung
 * jawab pemanggil, lihat `Filter/DateSelector.jsx:parseSummary` utk widget,
 * atau parser sintaks ketik SearchBar utk `!`/`>`/`..`).
 *
 * Format didukung (spasi ganda dilipat):
 * - tahun: `2026`, `26` (2 digit SELALU +2000)
 * - kuartal / half-year, dua urutan: `Q2 2026`, `Q2 26`, `Q2-2026`,
 *   `2026 Q2`, `H1 2026`, `2026 H1`
 * - bulan-tahun ANGKA: `09/2026`, `09/26`, `09-2026`, `09.2026`, `2026-09`,
 *   `2026/09`
 * - bulan-tahun NAMA (penuh/singkat, locale aktif + Inggris, awalan >=3
 *   huruf): `September 2026`, `Sep 26`, `Agu 2026`, `sept 2026`,
 *   `2026 September`
 * - hari: `15/09/2026`, `15-09-2026`, `15.09.2026`, `15 09 2026`,
 *   `15/09/26`, `2026-09-15`, `2026/09/15`, `15 September 2026`,
 *   `15 Sep 26` (+ `09/15/2026` bila hari-bulan tak valid)
 * - kuartal / half-year kata: `Kuartal 2 2026`, `Triwulan 2 2026`,
 *   `Semester 1 2026`, `2026 Semester 2`
 * - hari nama-bulan-dulu (AS): `September 15, 2026`, `Sep 15 2026`
 * - hari + jam (KHUSUS `isDatetime`): tiap format hari di atas + ` 14:30`
 *   / ` 14:30:00` / `T14:30`
 * @param {string} raw
 * @param {object} root0
 * @param {boolean} root0.isDatetime
 * @param {{months: string[], monthsShort: string[]}} root0.i18nLabels
 * @returns {object|null} token `{period, year, month?, quarter?, halfYear?, startDate?}`
 */
export function parsePeriodToken(raw, { isDatetime, i18nLabels }) {
  let text = `${raw ?? ""}`.trim().replace(/\s+/g, " ");
  if (!text) return null;

  let m = text.match(/^(\d{2}|\d{4})$/);
  if (m) return { period: "year", year: normalizeYear(m[1]) };

  // kuartal / half-year: `Q2 2026` `Q2-26` `2026 Q2` `2026H1`, plus kata
  // Indonesia/Inggris: `Kuartal 2 2026` `Triwulan 2 2026` `Semester 1 2026`.
  m =
    text.match(
      new RegExp(String.raw`^(${UNIT_WORD})[ \-/]?([1-4])[ \-/]?${YEAR}$`, "i"),
    ) ??
    text.match(
      new RegExp(String.raw`^(\d{4})[ \-/]?(${UNIT_WORD})[ \-/]?([1-4])$`, "i"),
    );
  if (m) {
    const yearFirst = /^\d/.test(m[1]);
    const word = yearFirst ? m[2] : m[1];
    const idx = parseInt(yearFirst ? m[3] : m[2], 10) - 1;
    const year = normalizeYear(yearFirst ? m[1] : m[3]);
    if (QUARTER_WORD.test(word))
      return { period: "quarter", year, quarter: idx };
    return idx <= 1 ? { period: "half-year", year, halfYear: idx } : null;
  }

  // Suffix jam: hanya sah utk token hari pada kolom datetime.
  let hh = 0;
  let mi = 0;
  let hasTime = false;
  const tm = text.match(TIME_SUFFIX);
  if (tm) {
    if (!isDatetime) return null;
    hh = parseInt(tm[2], 10);
    mi = parseInt(tm[3], 10);
    if (hh > 23 || mi > 59) return null;
    text = tm[1];
    hasTime = true;
  }
  const day = (y, mo, d) =>
    isValidDate(y, mo, d)
      ? { period: "day", startDate: new Date(y, mo, d, hh, mi) }
      : null;
  const noTime = (token) => (hasTime ? null : token);

  // hari, 3 bagian angka: `2026-09-15` `2026/09/15` (tahun dulu) atau
  // `15/09/2026` `15-09-26` `15.09.2026` `15 09 2026` (hari dulu; bila
  // hari-bulan tak valid coba bulan-hari ala AS `09/15/2026`).
  m = text.match(/^(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})$/);
  if (m) return day(+m[1], +m[2] - 1, +m[3]);
  m = text.match(
    new RegExp(String.raw`^(\d{1,2})[/\-. ](\d{1,2})[/\-. ]${YEAR}$`),
  );
  if (m) {
    const y = normalizeYear(m[3]);
    return day(y, +m[2] - 1, +m[1]) ?? day(y, +m[1] - 1, +m[2]);
  }

  // hari dgn nama bulan DULU (ala AS, tahun 4 digit): `September 15, 2026`
  // `Sep 15 2026`.
  m = text.match(
    new RegExp(String.raw`^${NAME}[/\-. ]+(\d{1,2})[/\-. ,]+(\d{4})$`),
  );
  if (m) {
    const month = matchMonthName(m[1], i18nLabels);
    if (month >= 0) return day(+m[3], month, +m[2]);
  }

  // hari dgn nama bulan: `15 September 2026` `15-Sep-26` `5 sept, 2026`.
  m = text.match(
    new RegExp(String.raw`^(\d{1,2})[/\-. ]+${NAME}[/\-. ,]+${YEAR}$`),
  );
  if (m) {
    const month = matchMonthName(m[2], i18nLabels);
    return month < 0 ? null : day(normalizeYear(m[3]), month, +m[1]);
  }

  // Dari sini token BUKAN hari -> suffix jam tak boleh ada (`noTime`).
  // bulan-tahun ANGKA: `09/2026` `09/26` (slash boleh 2 digit) `09-2026`
  // `09.2026` `2026-09` `2026/9`.
  m =
    text.match(/^(\d{1,2})\/(\d{2}|\d{4})$/) ??
    text.match(/^(\d{1,2})[-.](\d{4})$/);
  if (m) {
    const month = parseInt(m[1], 10) - 1;
    return month >= 0 && month <= 11
      ? noTime({ period: "month", year: normalizeYear(m[2]), month })
      : null;
  }
  m = text.match(/^(\d{4})[/\-.](\d{1,2})$/);
  if (m) {
    const month = parseInt(m[2], 10) - 1;
    return month >= 0 && month <= 11
      ? noTime({ period: "month", year: parseInt(m[1], 10), month })
      : null;
  }

  // bulan-tahun NAMA: `September 2026` `Sep-26` `2026 September`
  // (urutan tahun-dulu HANYA utk tahun 4 digit -- `15 Sep` bukan tahun 2015).
  m = text.match(new RegExp(String.raw`^${NAME}[/\-. ]+${YEAR}$`));
  if (m) {
    const month = matchMonthName(m[1], i18nLabels);
    return month < 0
      ? null
      : noTime({ period: "month", year: normalizeYear(m[2]), month });
  }
  m = text.match(new RegExp(String.raw`^(\d{4})[/\-. ]+${NAME}$`));
  if (m) {
    const month = matchMonthName(m[2], i18nLabels);
    return month < 0
      ? null
      : noTime({ period: "month", year: parseInt(m[1], 10), month });
  }

  return null;
}

/**
 * 3 tahun relevan (lalu, ini, depan) untuk partial-token suggestion (Requirement
 * 30.5) -- default TETAP, bukan query ke backend.
 * @param {Date} [now]
 * @returns {number[]}
 */
export function relevantYears(now = new Date()) {
  const year = now.getFullYear();
  return [year - 1, year, year + 1];
}

// Ambil index unit (month/quarter/half) dari token periode -- dipakai
// `buildBetweenPeriodValue` menyusun `rangeStart`/`rangeEnd`.
function subPeriodValue(token) {
  if (token.period === "month") return token.month;
  if (token.period === "quarter") return token.quarter;
  if (token.period === "half-year") return token.halfYear;
  return 0;
}

/**
 * Gabung 2 token periode (hasil `parsePeriodToken`) jadi SATU value operator
 * `between` -- dipakai baik `Filter/DateSelector.jsx:parseSummary` (separator
 * ` - `) maupun sintaks ketik SearchBar (separator `..`, lihat
 * `Search/columnSearch.js:buildDateLeafFromText`). Period HARUS sama KECUALI
 * `day` (day tak butuh cek period `b`, konsisten dgn logic asli sebelum
 * diekstrak). `null` bila salah satu token null atau period non-day beda.
 * @param {object|null} a
 * @param {object|null} b
 * @returns {object|null}
 */
export function buildBetweenPeriodValue(a, b) {
  if (!a || !b) return null;
  if (a.period === "day") {
    return {
      period: "day",
      operator: "between",
      startDate: a.startDate,
      endDate: b.startDate,
    };
  }
  if (a.period === b.period) {
    return {
      period: a.period,
      operator: "between",
      year: a.year,
      rangeStart: { year: a.year, value: subPeriodValue(a) },
      rangeEnd: { year: b.year, value: subPeriodValue(b) },
    };
  }
  return null;
}

/**
 * String/Date tanggal -> `Date`. Bentuk lokal `YYYY-MM-DD[ HH:mm]` (format yg
 * disimpan di leaf) di-parse LOKAL -- BUKAN `new Date("YYYY-MM-DD")` yg dibaca
 * UTC (hari bergeser di zona negatif). Fallback `new Date(v)` utk ISO lama
 * (`...Z`) yg mungkin sudah tersimpan di filter template.
 * @param {string|Date|null|undefined} v
 * @returns {Date|undefined}
 */
export function parseLocalDate(v) {
  if (!v) return undefined;
  if (v instanceof Date) return isNaN(v.getTime()) ? undefined : v;
  const local = `${v}`.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?$/,
  );
  if (local) {
    return new Date(
      +local[1],
      +local[2] - 1,
      +local[3],
      +(local[4] ?? 0),
      +(local[5] ?? 0),
    );
  }
  const d = new Date(v);
  return isNaN(d.getTime()) ? undefined : d;
}

/**
 * Date/string tanggal -> string LOKAL utk disimpan di leaf. Kolom `date`
 * (bukan datetime) SELALU membuang jam -- tanpa ini tombol "Hari ini" widget
 * (yg membawa jam sekarang) menghasilkan filter presisi-menit utk kolom date.
 * @param {string|Date|null|undefined} v
 * @param {{isDatetime?: boolean}} [opts]
 * @returns {string|undefined}
 */
export function toLocalDateValue(v, { isDatetime = false } = {}) {
  const d = parseLocalDate(v);
  if (!d) return undefined;
  return toLocalDayString(
    isDatetime ? d : new Date(d.getFullYear(), d.getMonth(), d.getDate()),
  );
}

// Field unit periode non-day pada value widget.
const UNIT_FIELD = {
  month: "month",
  quarter: "quarter",
  "half-year": "halfYear",
};

/**
 * Apakah value periode punya pilihan yg bisa dipakai filter (start sudah ada).
 * Widget `ui/date-selector` SELALU emit saat mount & setelah ganti
 * granularitas/operator -- value kosong (`{period, operator}` tanpa tanggal/
 * tahun) TIDAK boleh dianggap pilihan: dikomit jadi leaf tanpa batas & jadi
 * pemenang palsu atas preset ter-highlight saat Enter.
 * @param {object|null|undefined} v
 * @returns {boolean}
 */
export function hasPeriodSelection(v) {
  if (!v || !v.period || !v.operator) return false;
  if (v.period === "day") return Boolean(v.startDate);
  if (v.rangeStart) return v.rangeStart.year != null;
  if (v.year == null) return false;
  const field = UNIT_FIELD[v.period];
  return field === undefined || v[field] != null;
}

/**
 * Lengkapi range `between` yg belum punya end -> end = start.
 * - day  : endDate = startDate
 * - lain : rangeEnd = rangeStart (atap dari year + unit index)
 * Mengembalikan objek baru (tak memutasi input). Bila bukan between atau end
 * sudah ada, kembalikan apa adanya.
 * @param {object} v
 * @returns {object}
 */
export function completeRange(v) {
  if (!v || v.operator !== "between") return v;

  if (v.period === "day") {
    return v.startDate && !v.endDate ? { ...v, endDate: v.startDate } : v;
  }

  const start =
    v.rangeStart ??
    (v.year != null ? { year: v.year, value: subPeriodValue(v) } : undefined);
  return start && !v.rangeEnd
    ? { ...v, rangeStart: start, rangeEnd: start }
    : v;
}

/**
 * Batas tahun default utk panel pilih periode/tahun: 20 tahun ke belakang
 * (dokumen historis) s/d 5 tahun ke depan (jatuh tempo/kontrak). Default lama
 * (10 tahun terpusat / s.d. tahun ini) membuat tahun lampau & mendatang tak
 * bisa dipilih di grid.
 * @param {Date} [now]
 * @returns {{minYear: number, maxYear: number}}
 */
export function defaultYearBounds(now = new Date()) {
  const year = now.getFullYear();
  return { minYear: year - 20, maxYear: year + 5 };
}

/**
 * Indeks bulan (0-11) yg nama penuh/singkatnya (locale aktif ATAU Inggris)
 * DIAWALI teks yg diketik -- utk saran bulan dari awalan 1-2 huruf (`ju` ->
 * Juni, Juli).
 * @param {string} raw
 * @param {{months: string[], monthsShort: string[]}} i18nLabels
 * @returns {number[]}
 */
export function monthsStartingWith(raw, i18nLabels) {
  const name = `${raw ?? ""}`.trim().toLowerCase().replace(/\.$/, "");
  if (!name) return [];
  const out = [];
  for (let i = 0; i < 12; i++) {
    const names = [
      i18nLabels.months[i],
      EN_MONTHS[i],
      i18nLabels.monthsShort[i],
      EN_MONTHS_SHORT[i],
    ].map((n) => `${n}`.toLowerCase());
    if (names.some((n) => n.startsWith(name))) out.push(i);
  }
  return out;
}

/**
 * Pilihan periode sudah LENGKAP (siap dikomit): ada pilihan (`hasPeriodSelection`)
 * dan, utk `between`, kedua ujung sudah dipilih. Range yg baru separuh
 * dipilih belum lengkap (menunggu klik kedua).
 * @param {object|null|undefined} v
 * @returns {boolean}
 */
export function isCompletePeriodValue(v) {
  if (!hasPeriodSelection(v)) return false;
  if (v.operator !== "between") return true;
  return v.period === "day" ? Boolean(v.endDate) : Boolean(v.rangeEnd);
}

// Urutan granularitas (kecil -> besar) utk rentang campuran.
const PERIOD_RANK = { day: 0, month: 1, quarter: 2, "half-year": 3, year: 4 };

// Jumlah unit `target` dalam SATU unit periode yg lebih kasar.
const UNITS_PER = {
  month: { quarter: 3, "half-year": 6, year: 12 },
  quarter: { "half-year": 2, year: 4 },
  "half-year": { year: 2 },
};

// Indeks unit `target` [pertama, terakhir] yg tercakup token non-hari.
const unitSpan = (token, target) => {
  const idx = subPeriodValue(token);
  if (token.period === target) return [idx, idx];
  const size = UNITS_PER[target][token.period];
  const base = token.period === "year" ? 0 : idx;
  return [base * size, base * size + size - 1];
};

// Batas token pada granularitas `target`: hari -> `Date`, lainnya -> {year, value}.
const rangeEdge = (token, target, which) => {
  if (target === "day") {
    if (token.period === "day") return token.startDate;
    const [lo, hi] = unitSpan(token, "month");
    return which === "first"
      ? new Date(token.year, lo, 1)
      : new Date(token.year, hi + 1, 0);
  }
  const [lo, hi] = unitSpan(token, target);
  return { year: token.year, value: which === "first" ? lo : hi };
};

/**
 * Gabung 2 token periode jadi `between` -- seperti `buildBetweenPeriodValue`
 * tetapi juga untuk granularitas CAMPURAN (revisi 10): kedua ujung
 * dinormalkan ke granularitas yg lebih halus; ujung awal = unit pertama
 * periodenya, ujung akhir = unit TERAKHIR periodenya. `Jan 2026..2027` ->
 * rentang bulan Jan 2026 - Des 2027; `2026..Q2 2027` -> kuartal Q1 2026 -
 * Q2 2027; `10 Sep 2026..Des 2026` -> hari 10 Sep - 31 Des 2026.
 * `null` bila salah satu token null. TIDAK memeriksa urutan ujung.
 * @param {object|null} a token awal (`parsePeriodToken`)
 * @param {object|null} b token akhir
 * @returns {object|null}
 */
export function buildFlexibleBetween(a, b) {
  if (!a || !b) return null;
  const target =
    PERIOD_RANK[a.period] <= PERIOD_RANK[b.period] ? a.period : b.period;
  const first = rangeEdge(a, target, "first");
  const last = rangeEdge(b, target, "last");
  if (target === "day") {
    return {
      period: "day",
      operator: "between",
      startDate: first,
      endDate: last,
    };
  }
  return {
    period: target,
    operator: "between",
    year: first.year,
    rangeStart: first,
    rangeEnd: last,
  };
}
