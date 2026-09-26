// searchChips — fungsi murni: turunkan chip dari Filter Tree, dan
// tambah/ubah/hapus chip = operasi immutable pada Filter Tree yang sama
// dipakai FilterTable2 (design.md §5.1, §5.4, §5.6; Requirement 2, 4, 6, 7).
//
// Filter Tree: { root: { k: "and"|"or", c: { [id]: Node } } }
// Node = group { k, c } | leaf { k: <kolom>, o: <operator>, v: <value> }

import { columnHasOptions } from "../Filter/operators";
import { compareLabels } from "@/lib/compareLabels";
import { formatPeriodValue, resolveColumnPath } from "./columnSearch";
import { convertTemplateLink } from "@/lib/linkModelUtils";
import { createFilterItem } from "@/Hooks/useNestedFilters";
import { generateRandom } from "@/lib/utils";

// Id node baru dibuat lokal (bukan lewat React context useNestedFilters) --
// pola sama dengan `createId` di useNestedFilters.jsx (`generateRandom(8)`).
// TIDAK memakai `Date.now()` (pola `addFilter`, DataTable2.jsx:583) karena
// beberapa fungsi di sini bisa membuat >1 node baru dalam satu pemanggilan
// (mis. `addSearchChip` per kolom) -- berisiko id sama pada milidetik sama.
const createId = () => generateRandom(8);

const isGroupLike = (node) =>
  Boolean(node && typeof node === "object" && (node.c || node.children));

const childrenOf = (node) => node?.c ?? node?.children ?? {};

/**
 * Apakah `node` adalah "Chip Cari": grup `or` beranak >=2, semua anak leaf
 * `o: "matches"` dengan `v` identik. Deteksi berbasis pola (bukan penanda
 * custom) karena `FilterTreeCleaner::cleanGroup()` hanya menyisakan `k`/`c`
 * (design.md §5.1, Requirement 4.6).
 * @param {object} node
 * @returns {boolean}
 */
const isSearchGroup = (node) => {
  if (!isGroupLike(node)) return false;
  if (String(node.k ?? "").toLowerCase() !== "or") return false;

  const entries = Object.values(childrenOf(node));
  if (entries.length < 2) return false;

  let refValue;
  return entries.every((child, i) => {
    if (!child || typeof child !== "object" || isGroupLike(child)) {
      return false;
    }
    if (child.o !== "matches") return false;
    if (i === 0) {
      refValue = child.v;
      return true;
    }
    return JSON.stringify(child.v) === JSON.stringify(refValue);
  });
};

// --- Label nilai chip (Requirement 2.8) -------------------------------

/**
 * Bangun daftar opsi `{value,label}` dari `column.options` -- meniru
 * `ValueField.jsx` (:81-93) apa adanya supaya label chip konsisten dengan
 * label yang dirender di form filter. Diurutkan abjad menurut label yang
 * SUDAH diterjemahkan (Revisi 13) -- urutan `options` di config kolom tak
 * dipakai (bukan urutan alur/prioritas yang bermakna bagi pencari).
 * @param {object} column
 * @param {(key: string) => string} t
 * @returns {Array<{value: *, label: string}>}
 */
const buildOptionList = (column, t) => {
  const opts = column?.options ?? [];
  const valueTrans = column?.valueTrans;
  const labelOf = (val) => (valueTrans ? t(`${valueTrans}.${val}`) : `${val}`);
  const list = Array.isArray(opts) ? opts : Object.values(opts);
  return list
    .map((o) =>
      typeof o === "string" || typeof o === "number"
        ? { value: o, label: labelOf(o) }
        : { ...o, label: o.label ?? labelOf(o.value) },
    )
    .sort((a, b) => compareLabels(a.label, b.label));
};

// Kolom status dokumen (opsinya dirender sbg `BadgeStatus`, sama dgn sel tabel).
const isStatusColumn = (column) =>
  column?.type === "formStatus" || column?.type === "formStatuses";

const formatSingleValue = (value, column, t) => {
  if (value === null || value === undefined || value === "") return "";

  const isRelationColumn =
    column && (column.type === "relation" || column.type === "relations");
  if (isRelationColumn && typeof value === "object") {
    // Value relasi = objek record penuh (ValueField.jsx:193-203). `search`
    // kosong ("") supaya title-tag di templateLink dilucuti (Requirement
    // 2.8); fallback ke name/code/id bila hasilnya kosong.
    const label = convertTemplateLink(value, "");
    return label || `${value.name ?? value.code ?? value.id ?? ""}`;
  }

  if (column?.type === "boolean") {
    const truthy = value === true || value === "true";
    return t(truthy ? "core.datatable.yes" : "core.datatable.no");
  }

  if (column && columnHasOptions(column)) {
    const found = buildOptionList(column, t).find(
      (o) => `${o.value}` === `${value}`,
    );
    return found ? found.label : `${value}`;
  }

  // Revisi 5 (Requirement 25): kolom string BEBAS (bukan boolean/ber-opsi/
  // relasi -- yg diatas sudah py representasi sendiri) dibungkus kutip, biar
  // user tau ini teks yg DIKETIK apa adanya (`matches`), bukan label/preset
  // tetap. Number/currency TIDAK ikut -- itu bukan teks bebas.
  if (column?.type === "string") return `"${value}"`;

  return `${value}`;
};

const formatValueLabel = (value, column, t) => {
  if (Array.isArray(value)) {
    return value
      .map((v) => formatSingleValue(v, column, t))
      .filter((v) => v !== "")
      .join(", ");
  }
  return formatSingleValue(value, column, t);
};

// --- tree -> chip --------------------------------------------------------

const countLeaves = (node) => {
  const children = node?.c ?? node?.children;
  if (!children || typeof children !== "object") return 1;
  return Object.values(children).reduce((sum, c) => sum + countLeaves(c), 0);
};

// Judul kolom berpath (`category.name` -> "Kategori › Nama") supaya chip
// pencarian relasi tetap menyebut relasinya, bukan cuma "Nama". Segmen yang
// tak ter-resolve memakai segmen mentahnya.
const columnPathTitle = (columns, key, t) => {
  const segments = String(key ?? "").split(".");
  return segments
    .map((segment, i) => {
      const col = resolveColumnPath(
        columns,
        segments.slice(0, i + 1).join("."),
      );
      return col?.title ?? (col?.titleTrans ? t(col.titleTrans) : segment);
    })
    .join(" › ");
};

// Nilai `in_period`/`!in_period` berupa DAFTAR objek periode (Revisi 16; bukan
// objek tunggal, skalar, atau record relasi).
const isPeriodListValue = (v) =>
  Array.isArray(v) &&
  v.length > 0 &&
  v.every((x) => x && typeof x === "object" && x.period);

const leafToChip = (id, node, columns, t, options) => {
  const column = resolveColumnPath(columns, node?.k);
  const colTitle = columnPathTitle(columns, node?.k, t);
  // Revisi 8 (Requirement 40.3): `set`/`!set` tanpa value -> `Kolom: Diisi`.
  if (node?.o === "set" || node?.o === "!set") {
    return {
      id,
      kind: "leaf",
      label: `${colTitle}: ${t(`core.datatable.filter.operator.${node.o}`)}`,
      node,
    };
  }
  const isPeriod = node?.o === "in_period" || node?.o === "!in_period";
  // Revisi 16: `in_period`/`!in_period` ber-`v` DAFTAR objek periode -- dibaca
  // `a, b, c` (label penuh ada di tooltip chip, teks dipotong CSS).
  const isPeriodList = isPeriod && isPeriodListValue(node?.v);
  const valueLabel = isPeriodList
    ? node.v.map((x) => formatPeriodValue(x, options?.monthsShort)).join(", ")
    : isPeriod
      ? formatPeriodValue(node?.v, options?.monthsShort)
      : formatValueLabel(node?.v, column, t);
  // in_period "is" (mis. preset "Bulan ini") / daftar "Pada" dibaca sbg
  // `Kolom: nilai`. `!in_period` TIDAK ikut -- negasinya harus tetap terbaca.
  const isEqIn =
    node?.o === "=" ||
    node?.o === "in" ||
    (node?.o === "in_period" && (isPeriodList || node?.v?.operator === "is"));
  const label = isEqIn
    ? `${colTitle}: ${valueLabel}`
    : `${colTitle} ${t(`core.datatable.filter.operator.${node?.o}`)} ${valueLabel}`;
  return { id, kind: "leaf", label, node };
};

const nodeToChip = (id, node, columns, t, options) => {
  if (!isGroupLike(node)) return leafToChip(id, node, columns, t, options);

  if (isSearchGroup(node)) {
    const children = Object.values(childrenOf(node));
    const text = children[0]?.v ?? "";
    return {
      id,
      kind: "search",
      label: t("core.datatable.search.search_chip", { text }),
      node,
      columns: children.map((c) => c.k),
    };
  }

  const count = countLeaves(node);
  return {
    id,
    kind: "advanced",
    label: t("core.datatable.search.advanced_chip", { count }),
    node,
    count,
  };
};

/**
 * Turunkan daftar chip dari Filter Tree -- Search Bar TIDAK menyimpan
 * salinan kondisi filter sendiri, chip SELALU turunan dari tree (Requirement
 * 2.1-2.7).
 * @param {object} tree
 * @param {object} columns peta kolom (getColumns())
 * @param {(key: string, params?: object) => string} t
 * @param {{monthsShort?: string[]}} [options] nama bulan singkat locale aktif
 *   (label chip tanggal `25 Sep 2026`); default Inggris.
 * @returns {Array<object>}
 */
const treeToChips = (tree, columns, t, options) => {
  const root = tree?.root ?? tree;
  if (!root) return [];

  const children = childrenOf(root);
  const entries = Object.entries(children);
  if (entries.length === 0) return [];

  // Root `or` beranak >1 -> seluruh tree jadi satu chip `advanced`.
  if (String(root.k ?? "").toLowerCase() === "or" && entries.length > 1) {
    const count = countLeaves(root);
    return [
      {
        id: "root",
        kind: "advanced",
        label: t("core.datatable.search.advanced_chip", { count }),
        node: root,
        count,
      },
    ];
  }

  return entries.map(([id, node]) => nodeToChip(id, node, columns, t, options));
};

// --- add / update / remove ------------------------------------------------

const toValueArray = (v) => (Array.isArray(v) ? v : [v]);

// Nilai "kosong" tak pernah boleh jadi kondisi: tanpa guard ini `addLeafChip`
// dgn `v: null` (mis. picker relasi yg di-reset) ikut ter-merge ke leaf `in`
// yang sudah ada -> `category in [Sparepart, null]` (ketemu saat verifikasi
// visual). Boolean `false` dan angka `0` VALID -- hanya null/undefined/""/[].
const isEmptyValue = (v) =>
  v === null ||
  v === undefined ||
  (typeof v === "string" && v.trim() === "") ||
  (Array.isArray(v) && v.length === 0);
const valueDedupeKey = (v) =>
  v && typeof v === "object" ? `id:${v.id}` : `v:${v}`;

/**
 * Gabung 2 nilai (scalar atau array) jadi array unik (relasi dedup by id).
 * @param existingV
 * @param newV
 */
const mergeValues = (existingV, newV) => {
  const seen = new Set();
  const result = [];
  for (const item of [...toValueArray(existingV), ...toValueArray(newV)]) {
    const key = valueDedupeKey(item);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }
  return result;
};

/**
 * Leaf langsung (bukan grup) anak `children` dgn `k` & `o` yang cocok.
 * @param children
 * @param key
 * @param ops
 */
const findDirectLeafByKey = (children, key, ops) => {
  for (const [id, node] of Object.entries(children ?? {})) {
    if (!node || typeof node !== "object" || isGroupLike(node)) continue;
    if (node.k === key && ops.includes(node.o)) return [id, node];
  }
  return null;
};

/**
 * Bungkus root `or` beranak >1 jadi anak grup baru `and` (dipakai
 * `addLeafChip`/`addSearchChip` saat root sudah OR multi-anak, agar leaf/
 * grup baru tidak ikut ter-OR-kan dengan kondisi yang sudah ada).
 * @param {object} root
 * @returns {{id: string, node: object}}
 */
const wrapAsGroup = (root) => ({
  id: createId(),
  node: { k: root.k ?? "or", c: childrenOf(root) },
});

/**
 * Tambah leaf ke root AND (buat root bila belum ada). MERGE: leaf baru
 * `=`/`in` pada kolom yang sudah punya leaf `=`/`in` langsung anak root ->
 * digabung jadi satu leaf `in`, nilai unik (relasi dedup `.id`). Root `or`
 * beranak >1 -> di-wrap dulu (Requirement 6.6, design.md §5.4). Nilai kosong
 * (null/undefined/""/[]) TIDAK ditambahkan -- tree dikembalikan apa adanya.
 * @param {object} tree
 * @param {{k: string, o: string, v: *}} leaf
 * @returns {object}
 */
const addLeafChip = (tree, { k, o, v }) => {
  // `set`/`!set` memang TANPA value -- bukan "nilai kosong".
  if (o !== "set" && o !== "!set" && isEmptyValue(v)) return tree;
  const root = tree?.root ?? tree ?? null;
  const rootKey = String(root?.k ?? "and").toLowerCase();
  const children = childrenOf(root);

  if (root && rootKey === "or" && Object.keys(children).length > 1) {
    const wrapped = wrapAsGroup(root);
    return {
      root: {
        k: "and",
        c: {
          [wrapped.id]: wrapped.node,
          [createId()]: createFilterItem({ k, o, v }),
        },
      },
    };
  }

  // Leaf date (`in_period`/`!in_period`, objek maupun DAFTAR periode) TIDAK
  // pernah digabung -- hanya `=`/`in` yg lewat sini: `valueDedupeKey` hanya
  // mengenal `.id` (semua periode dianggap sama -> daftar menciut jadi satu)
  // dan gabungan bisa melampaui batas 20 nilai backend. Chip terpisah tetap
  // eksplisit (AND).
  if (o === "=" || o === "in") {
    const mergeable = findDirectLeafByKey(children, k, ["=", "in"]);
    if (mergeable) {
      const [mergeId, mergeNode] = mergeable;
      return {
        root: {
          k: root?.k ?? "and",
          c: {
            ...children,
            [mergeId]: { k, o: "in", v: mergeValues(mergeNode.v, v) },
          },
        },
      };
    }
  }

  return {
    root: {
      k: root?.k ?? "and",
      c: { ...children, [createId()]: createFilterItem({ k, o, v }) },
    },
  };
};

/**
 * Tambah Chip Cari: grup `or` berisi leaf `matches` per kolom pencarian,
 * teks di-trim TANPA dipecah per kata (frasa utuh). Chip Cari kedua = grup
 * terpisah (AND antar-pencarian). Teks kosong atau tanpa kolom -> tree
 * dikembalikan apa adanya (Requirement 4.1-4.3).
 * @param {object} tree
 * @param {string} text
 * @param {string[]} searchColumns
 * @returns {object}
 */
const addSearchChip = (tree, text, searchColumns) => {
  const trimmed = typeof text === "string" ? text.trim() : "";
  const cols = Array.isArray(searchColumns)
    ? searchColumns.filter(Boolean)
    : [];
  if (!trimmed || cols.length === 0) return tree;

  const root = tree?.root ?? tree ?? null;
  const rootKey = String(root?.k ?? "and").toLowerCase();
  const children = childrenOf(root);

  const groupChildren = {};
  for (const col of cols) {
    groupChildren[createId()] = createFilterItem({
      k: col,
      o: "matches",
      v: trimmed,
    });
  }
  const searchGroupNode = { k: "or", c: groupChildren };

  if (root && rootKey === "or" && Object.keys(children).length > 1) {
    const wrapped = wrapAsGroup(root);
    return {
      root: {
        k: "and",
        c: { [wrapped.id]: wrapped.node, [createId()]: searchGroupNode },
      },
    };
  }

  return {
    root: {
      k: root?.k ?? "and",
      c: { ...children, [createId()]: searchGroupNode },
    },
  };
};

const updateNodeById = (nodes, targetId, patch) => {
  let changed = false;
  const result = {};
  for (const [id, node] of Object.entries(nodes ?? {})) {
    if (id === targetId) {
      result[id] = applyChipPatch(node, patch);
      changed = true;
      continue;
    }
    if (isGroupLike(node)) {
      const nextChildren = updateNodeById(childrenOf(node), targetId, patch);
      if (nextChildren !== childrenOf(node)) {
        result[id] = { ...node, c: nextChildren };
        changed = true;
        continue;
      }
    }
    result[id] = node;
  }
  return changed ? result : nodes;
};

const applyChipPatch = (node, patch) => {
  if (isSearchGroup(node)) {
    // Chip `search`: ganti `v` di SEMUA anak grup (k/o tetap `matches`).
    const nextChildren = {};
    for (const [id, child] of Object.entries(childrenOf(node))) {
      nextChildren[id] = { ...child, v: patch.v };
    }
    return { ...node, c: nextChildren };
  }
  if (isGroupLike(node)) return node;
  // Chip `leaf`: merge k/o/v.
  return { ...node, ...patch };
};

/**
 * Perbarui node chip (leaf: merge `k`/`o`/`v`; Chip Cari: ganti `v` semua
 * anak grup). Immutable, tidak memutasi `tree` (Requirement 7.1-7.2).
 * @param {object} tree
 * @param {string} id
 * @param {{k?: string, o?: string, v?: *}} patch
 * @returns {object}
 */
const updateChip = (tree, id, patch) => {
  const root = tree?.root ?? tree;
  if (!root) return tree;
  return { root: { ...root, c: updateNodeById(childrenOf(root), id, patch) } };
};

const removeNodeById = (nodes, targetId) => {
  let changed = false;
  const result = {};
  for (const [id, node] of Object.entries(nodes ?? {})) {
    if (id === targetId) {
      changed = true;
      continue;
    }
    if (isGroupLike(node)) {
      const nextChildren = removeNodeById(childrenOf(node), targetId);
      if (nextChildren !== childrenOf(node)) {
        changed = true;
        if (Object.keys(nextChildren).length === 0) continue; // buang grup kosong
        result[id] = { ...node, c: nextChildren };
        continue;
      }
    }
    result[id] = node;
  }
  return changed ? result : nodes;
};

/**
 * Hapus node chip dari tree (di mana pun posisinya). Root tanpa anak sisa ->
 * `null` (Requirement 7.5, 10.4).
 * @param {object} tree
 * @param {string} id
 * @returns {object|null}
 */
const removeChip = (tree, id) => {
  const root = tree?.root ?? tree;
  if (!root || id === "root") return null;
  const nextChildren = removeNodeById(childrenOf(root), id);
  if (Object.keys(nextChildren).length === 0) return null;
  return { root: { ...root, c: nextChildren } };
};

export {
  addLeafChip,
  addSearchChip,
  buildOptionList,
  isSearchGroup,
  isStatusColumn,
  removeChip,
  treeToChips,
  updateChip,
};
