// groupLevels — kontrak group multi-level DataTable2 (spec datatable2-group-tree,
// Requirement 1, 11, 12, 13): SATU-SATUNYA tempat logika `Groups` di FE. Padanan
// FE dari App\Services\Core\DataTable\Group\GroupLevels (BE) -- input yang sama
// HARUS menghasilkan `Groups` yang sama di PHP & JS (Property 6; dijaga fixture
// bersama tests/fixtures/group-levels-cases.json).
//
//   GroupLevel = { column: string, granularity: string|null, range: number|null }
//   Groups     = GroupLevel[]   // urutan = nesting (index 0 = terluar), maks 4, kolom unik
//
// normalizeGroupLevels() bersifat STRUKTURAL, bukan sanitasi nilai: ia hanya
// mengubah berbagai bentuk masukan jadi `Groups` (dedupe kolom, string numerik
// -> angka). Nilai granularity/range yang salah TIDAK dikoreksi & jumlah level
// TIDAK dipotong -- koreksi & pemotongan dilakukan backend (GroupLevelResolver).

export const MAX_GROUP_LEVELS = 4;

// Granularity date/time/datetime (padanan BE GroupLevels::GRANULARITIES).
export const DATE_GROUP_GRANULARITIES = [
  "day",
  "month",
  "quarter",
  "half",
  "year",
];

// Lebar range default kolom number/currency yang tak mengatur
// `groupRangeOptions` sendiri.
export const DEFAULT_NUMBER_GROUP_RANGE_OPTIONS = [10, 100, 1000];

export const isDateGroupType = (type) =>
  ["date", "time", "datetime"].includes(type);
export const isNumberGroupType = (type) =>
  ["number", "currency"].includes(type);

const isPlainObject = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);

// Sama dgn PHP is_numeric() utk string: `Number()` JS terlalu longgar
// ("0x1A" -> 26, "" -> 0), jadi bentuknya dicek eksplisit dgn regex.
const NUMERIC_STRING = /^\s*[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?\s*$/;

// String numerik dari URL ("100") -> angka; nilai lain apa adanya (nilai salah
// sengaja TIDAK dikoreksi, lihat catatan file).
const normalizeRange = (range) => {
  if (range === "" || range === null || range === undefined) return null;
  return typeof range === "string" && NUMERIC_STRING.test(range)
    ? Number(range)
    : range;
};

const normalizeLevel = (item) => {
  if (typeof item === "string") {
    const column = item.trim();
    return column ? { column, granularity: null, range: null } : null;
  }
  if (isPlainObject(item) && typeof item.column === "string") {
    const column = item.column.trim();
    if (!column) return null;
    const granularity = item.granularity ?? null;
    return {
      column,
      granularity: granularity === "" ? null : granularity,
      range: normalizeRange(item.range ?? null),
    };
  }
  return null;
};

/**
 * Masukan yang diterima: null/""/[] (-> []), string satu kolom, string CSV
 * "a,b" (khusus URL), objek lama {column, granularity?, range?} (-> 1 level),
 * list string, list objek, atau campuran list string/objek. Kolom unik (yang
 * pertama menang).
 * @param {*} input
 * @returns {Array<{column: string, granularity: *, range: *}>}
 */
export const normalizeGroupLevels = (input) => {
  let items;
  if (typeof input === "string") {
    items = input.split(",");
  } else if (Array.isArray(input)) {
    items = input;
  } else if (isPlainObject(input) && "column" in input) {
    items = [input]; // objek lama {column, ...} -> 1 level
  } else {
    return []; // objek asosiatif tanpa `column`, angka, null, dst
  }

  const levels = new Map();
  for (const item of items) {
    const level = normalizeLevel(item);
    if (level && !levels.has(level.column)) levels.set(level.column, level);
  }
  return [...levels.values()];
};

/**
 * Default granularity/range utk kolom grup BARU: date/time/datetime -> "month";
 * number/currency -> opsi range pertama kolom (fallback default global);
 * lainnya -> null.
 * @param {object|null} column node kolom (WAJIB `column.name`)
 */
export const computeGroupDefaults = (column) => ({
  column: column?.name ?? null,
  granularity: isDateGroupType(column?.type) ? "month" : null,
  range: isNumberGroupType(column?.type)
    ? (column?.groupRangeOptions?.[0] ?? DEFAULT_NUMBER_GROUP_RANGE_OPTIONS[0])
    : null,
});

/**
 * Isi granularity/range yang null dgn default EFEKTIF per tipe kolom (yang juga
 * dipakai SQL backend) -- utk state awal & label chip.
 * @param {Array} groups
 * @param {Object<string, object>} columns peta nama -> node kolom
 */
export const applyGroupDefaults = (groups, columns) =>
  normalizeGroupLevels(groups).map((level) => {
    const defaults = computeGroupDefaults(
      columns?.[level.column] ?? { name: level.column },
    );
    return {
      ...level,
      granularity: level.granularity ?? defaults.granularity,
      range: level.range ?? defaults.range,
    };
  });

/**
 * Toggle satu kolom: aktif -> dihapus; non-aktif -> ditambah sbg level TERDALAM
 * dgn default per tipe. Sudah MAX_GROUP_LEVELS aktif -> penambahan diabaikan.
 * @param {Array} groups
 * @param {string} column nama kolom
 * @param {object} [columnMeta] node kolom (utk default granularity/range)
 */
export const toggleGroupLevel = (groups, column, columnMeta) => {
  const levels = normalizeGroupLevels(groups);
  if (levels.some((level) => level.column === column)) {
    return levels.filter((level) => level.column !== column);
  }
  if (levels.length >= MAX_GROUP_LEVELS) return levels;
  return [...levels, computeGroupDefaults({ ...columnMeta, name: column })];
};

/**
 * Pindahkan level dari indeks `from` ke `to` (urutan nesting berubah).
 * @param groups
 * @param from
 * @param to
 */
export const moveGroupLevel = (groups, from, to) => {
  const levels = normalizeGroupLevels(groups);
  if (
    from === to ||
    from < 0 ||
    to < 0 ||
    from >= levels.length ||
    to >= levels.length
  ) {
    return levels;
  }
  const next = [...levels];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
};

/**
 * Ubah granularity/range milik SATU kolom; level lain tak tersentuh.
 * @param groups
 * @param column
 * @param patch
 */
export const setLevelOption = (groups, column, patch) =>
  normalizeGroupLevels(groups).map((level) =>
    level.column === column
      ? {
          ...level,
          ...("granularity" in patch
            ? { granularity: patch.granularity ?? null }
            : {}),
          ...("range" in patch ? { range: normalizeRange(patch.range) } : {}),
        }
      : level,
  );

/**
 * Sama-tidaknya dua `Groups`: urutan, kolom, granularity, dan range (angka
 * dibandingkan sbg angka). Urutan BERMAKNA -- mengubah urutan = mengubah nesting.
 * @param a
 * @param b
 */
export const sameGroups = (a, b) => {
  const left = normalizeGroupLevels(a);
  const right = normalizeGroupLevels(b);
  return (
    left.length === right.length &&
    left.every(
      (level, index) =>
        level.column === right[index].column &&
        (level.granularity ?? null) === (right[index].granularity ?? null) &&
        (level.range ?? null) === (right[index].range ?? null),
    )
  );
};

/**
 * Level TERLUAR (index 0) dua `Groups` sama persis (kolom+granularity+range)?
 * Dipakai DataTable2 (Requirement 24) utk deteksi "ubah sub-level SAJA" --
 * kalau level 0 tak berubah, daftar grup level-0 (`data.data` dari server)
 * tetap valid, jadi reload Inertia bisa dilewati (cukup perbarui isi level-1
 * ke bawah lewat fetch TanStack yang sudah ada).
 * @param a
 * @param b
 */
export const sameRootLevel = (a, b) => {
  const left = normalizeGroupLevels(a);
  const right = normalizeGroupLevels(b);
  if (left.length === 0 || right.length === 0) return false;
  return (
    left[0].column === right[0].column &&
    (left[0].granularity ?? null) === (right[0].granularity ?? null) &&
    (left[0].range ?? null) === (right[0].range ?? null)
  );
};

// Nilai per-kolom dari param bentuk peta (`groupGranularity[kolom]`) atau
// skalar lama (hanya level pertama).
const wireValue = (param, column, index) => {
  if (isPlainObject(param)) return param[column] ?? null;
  return index === 0 && param !== undefined && param !== null && param !== ""
    ? param
    : null;
};

/**
 * Timpa granularity/range tiap level dgn nilai dari query (peta per kolom, atau
 * skalar lama utk level pertama) -- param URL menang atas nilai di level.
 * @param {Array} levels
 * @param {object} query hasil parse query string (mis. ziggy.query)
 */
export const withWireOptions = (levels, query) =>
  levels.map((level, index) => ({
    ...level,
    granularity:
      wireValue(query?.groupGranularity, level.column, index) ??
      level.granularity,
    range:
      normalizeRange(wireValue(query?.groupRange, level.column, index)) ??
      level.range,
  }));

/**
 * Baca group dari query string (bentuk kawat): `group=a,b`,
 * `groupGranularity[a]=month`, `groupRange[b]=100`. Skalar lama dianggap milik
 * level pertama.
 *
 * `null` = param `group` TIDAK ADA (pemanggil pakai default dari backend);
 * `[]` = `group=` kosong eksplisit ("Tidak ada").
 * @param query
 * @returns {Array|null}
 */
export const groupsFromQuery = (query) => {
  if (!query || query.group === undefined || query.group === null) return null;
  return withWireOptions(normalizeGroupLevels(query.group), query);
};

/**
 * Kebalikan groupsFromQuery(): `Groups` -> objek param URL untuk
 * QueryString.stringify. `Groups` kosong menghasilkan `group=` KOSONG (eksplisit
 * "Tidak ada") HANYA bila ada group yang bisa jatuh kembali dipakai backend
 * (default model ATAU group milik filter tersimpan aktif) -- param yang HILANG
 * akan membuat backend memakainya lagi; tanpa fallback, param cukup dihilangkan.
 * @param {Array} groups
 * @param {Array|boolean} [fallback] `defaultGroups` dari backend, atau boolean
 *   "ada fallback" (host menyertakan `fid != null`: filter tersimpan bisa punya
 *   group, sedangkan `defaultGroups` bisa basi krn dimuat sebelum filter dipilih)
 */
export const groupsToQuery = (groups, fallback = []) => {
  const levels = normalizeGroupLevels(groups);
  if (levels.length === 0) {
    const hasFallback = Array.isArray(fallback)
      ? normalizeGroupLevels(fallback).length > 0
      : Boolean(fallback);
    return hasFallback ? { group: "" } : {};
  }

  const query = { group: levels.map((level) => level.column).join(",") };
  for (const level of levels) {
    if (level.granularity !== null && level.granularity !== undefined) {
      (query.groupGranularity ??= {})[level.column] = level.granularity;
    }
    if (level.range !== null && level.range !== undefined) {
      (query.groupRange ??= {})[level.column] = level.range;
    }
  }
  return query;
};

/**
 * Param request EXPAND (spec datatable2-group-tree, Requirement 14.3) =
 * `ziggy.query` (URL yang dirender server) TANPA `page`/`group*` lama, ditambah
 * group EKSPLISIT dari nilai EFEKTIF `groupMeta.levels`. Explicit karena
 * request expand berupa XHR: backend HANYA memakai `?group=` eksplisit (grup
 * dari filter/default model hanya utk request halaman). `fid`/`sort`/`show`
 * yang tak ada di URL sengaja TIDAK ditambah -- backend me-resolve default
 * filter/sort/`show` cookie identik utk XHR, jadi paritas dgn level-0 terjaga
 * tanpa menduplikasi logika di FE.
 * @param {object} query ziggy.query
 * @param {Array<{column: string, granularity: *, range: *}>} levels groupMeta.levels
 */
export const buildExpandParams = (query, levels) => {
  const {
    page: _page,
    group: _group,
    groupGranularity: _granularity,
    groupRange: _range,
    groupPath: _path,
    groupPage: _groupPage,
    ...base
  } = query ?? {};

  return {
    ...base,
    ...groupsToQuery(
      (levels ?? []).map(({ column, granularity, range }) => ({
        column,
        granularity,
        range,
      })),
    ),
  };
};

/**
 * Level dari URL yang TIDAK menyebut granularity/range mewarisi dari level
 * default (`defaultGroups` backend) dgn kolom SAMA -- cermin
 * GroupLevelResolver::resolve() di backend, supaya state awal FE cocok dgn yg
 * dieksekusi backend. `?group=<kolom lain>` TIDAK mewarisi setelan kolom default.
 * @param {Array} groups level dari URL (groupsFromQuery)
 * @param {Array} defaults `defaultGroups`
 */
export const inheritFromDefaults = (groups, defaults) => {
  const inheritFrom = new Map(
    normalizeGroupLevels(defaults).map((level) => [level.column, level]),
  );
  return normalizeGroupLevels(groups).map((level) => {
    const inherited = inheritFrom.get(level.column);
    return {
      ...level,
      granularity: level.granularity ?? inherited?.granularity ?? null,
      range: level.range ?? inherited?.range ?? null,
    };
  });
};
