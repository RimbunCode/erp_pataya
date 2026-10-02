// localGroups — pengelompokan IN-MEMORY utk host yang sudah memegang seluruh
// datanya (LinkModel `cache` mode; spec linkmodel-grouping-search Requirement
// 8.8-8.9). Menghasilkan bentuk respons node yang SAMA dgn backend
// (`{type, data, current_page, last_page, total, per_page}`) sehingga `GroupTree`
// dipakai apa adanya lewat `fetcher`.
//
// Hanya tipe skalar/relasi/boolean: bucket date/number sengaja TIDAK didukung di
// sini (ekspresi bucket SQL tak boleh "dicerminkan" di client -- sumber drift
// yang dihapus spec group-tree); level semacam itu dibuang oleh `inferLevels`.

export const LOCAL_PAGE_SIZE = 25;

const isRelationValue = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);

/**
 * Identitas grup sebuah nilai kolom: `{key, raw, label?}` (bentuk deskriptor).
 * @param {*} value
 */
export const describeValue = (value) => {
  if (value === null || value === undefined || value === "") {
    return { key: "null", raw: null };
  }
  if (isRelationValue(value)) {
    const id = value.id ?? null;
    return id === null
      ? { key: "null", raw: null }
      : { key: String(id), raw: id, label: value };
  }
  if (typeof value === "boolean") {
    return { key: String(value), raw: value };
  }

  return { key: String(value), raw: value };
};

/**
 * Turunkan `levels` ({column, granularity, range, type}) dari grup yang diminta
 * dengan MENGINTIP tipe nilai pertama yang tak kosong pada `rows`. Level yang
 * tipenya tak didukung (array/objek non-relasi) dibuang; urutan sisanya tetap.
 * @param {Array<{column: string}>} groups
 * @param {Array<object>} rows
 */
export const inferLevels = (groups, rows) => {
  const levels = [];
  for (const group of groups ?? []) {
    const sample = (rows ?? [])
      .map((row) => row?.[group.column])
      .find((value) => value !== null && value !== undefined && value !== "");
    let type = "string";
    if (Array.isArray(sample)) continue;
    if (isRelationValue(sample)) type = "relation";
    else if (typeof sample === "boolean") type = "boolean";
    levels.push({
      column: group.column,
      granularity: null,
      range: null,
      type,
    });
  }

  return levels;
};

const compareKeys = (a, b) => {
  if (a.key === "null") return b.key === "null" ? 0 : -1;
  if (b.key === "null") return 1;

  return a.key.localeCompare(b.key, undefined, { numeric: true });
};

const matchesPath = (row, levels, path) =>
  path.every(
    (raw, index) =>
      describeValue(row?.[levels[index].column]).raw === raw ||
      (raw === null &&
        describeValue(row?.[levels[index].column]).key === "null"),
  );

const paginate = (items, page, perPage) => {
  const total = items.length;
  const lastPage = Math.max(1, Math.ceil(total / perPage));
  const safePage = Math.max(1, page);

  return {
    data: items.slice((safePage - 1) * perPage, safePage * perPage),
    current_page: safePage,
    last_page: lastPage,
    total,
    per_page: perPage,
  };
};

/**
 * Isi sebuah node: daftar sub-grup (`path.length < levels.length`) atau baris
 * daun. `path` = nilai `raw` leluhur.
 * @param {Array<object>} rows
 * @param {Array<{column: string}>} levels
 * @param {Array} path
 * @param {number} [page]
 * @param {number} [perPage]
 */
export const groupNodeFromRows = (
  rows,
  levels,
  path = [],
  page = 1,
  perPage = LOCAL_PAGE_SIZE,
) => {
  const scoped = (rows ?? []).filter((row) => matchesPath(row, levels, path));

  if (path.length >= levels.length) {
    return { type: "rows", ...paginate(scoped, page, perPage) };
  }

  const level = levels[path.length];
  const groups = new Map();
  for (const row of scoped) {
    const descriptor = describeValue(row?.[level.column]);
    const existing = groups.get(descriptor.key);
    if (existing) existing.count += 1;
    else
      groups.set(descriptor.key, { ...descriptor, count: 1, aggregates: {} });
  }
  const items = [...groups.values()].sort(compareKeys);

  return { type: "groups", ...paginate(items, page, perPage) };
};

/**
 * Fetcher utk `GroupTree`/`useGroupNode`: membaca `rows` TERBARU lewat
 * `getRows()` supaya tak perlu dibuat ulang tiap data berubah (kunci cache
 * TanStack dibedakan oleh `version`/`params` di pemanggil).
 * @param {object} options
 * @param {() => Array<object>} options.getRows
 * @param {Array<{column: string}>} options.levels
 */
export const createLocalGroupFetcher =
  ({ getRows, levels }) =>
  ({ rawPath, page }) =>
    Promise.resolve(groupNodeFromRows(getRows(), levels, rawPath, page));
