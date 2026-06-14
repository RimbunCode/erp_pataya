// Validasi filter tree untuk FilterTable — dipakai sebelum "Terapkan Filter".
//
// Sumber kebenaran value-shape per operator diturunkan dari operators.js
// (getOperators -> valueInput), JANGAN menduplikasi daftar operator di sini.
// Backend (App\Services\Core\FilterTreeCleaner) me-mirror aturan yang sama.
//
// Output validateTree:
//   { valid: boolean, errors: { [itemId]: messageKey } }
// messageKey memetakan ke lang "core.datatable.filter.validation.*".

import { columnHasOptions, getOperators } from "./operators";

import { isNullOrWhitespace } from "@/lib/utils";

const GROUP_CHILDREN = "c";
const ITEM_KEY = "k";
const ITEM_OPERATOR = "o";
const ITEM_VALUE = "v";

const MSG = {
  required: "core.datatable.filter.validation.value_required",
  numeric: "core.datatable.filter.validation.value_numeric",
  time: "core.datatable.filter.validation.value_time",
  date: "core.datatable.filter.validation.value_date",
  rangeTwo: "core.datatable.filter.validation.range_two",
  selectOne: "core.datatable.filter.validation.select_one",
  relation: "core.datatable.filter.validation.relation_required",
  period: "core.datatable.filter.validation.period_incomplete",
};

const TIME_RE = /^\d{2}:\d{2}$/;

const isGroupNode = (node) =>
  Boolean(
    node &&
    typeof node === "object" &&
    (GROUP_CHILDREN in node || "children" in node),
  );

const toArray = (cols) => {
  if (!cols) return [];
  return Array.isArray(cols) ? cols : Object.values(cols);
};

const isNumeric = (v) => {
  if (v === null || v === undefined || `${v}`.trim() === "") return false;
  return !Number.isNaN(Number(v));
};

const isFilledScalar = (v) => {
  if (v === null || v === undefined) return false;
  if (Array.isArray(v)) return v.length > 0;
  return !isNullOrWhitespace(`${v}`);
};

/**
 * Resolusi kolom (mirror FilterEvaluator::resolveColumn) — dukung dot-notation
 * relasi. `columns` adalah peta/array node kolom (getColumns frontend). Untuk
 * kolom anak relasi yang belum ter-load, kembalikan null → caller fallback ke
 * presence-only.
 * @param columns
 * @param key
 */
const resolveColumn = (columns, key) => {
  if (!key) return null;
  const list = toArray(columns);
  const findByName = (cols, name) =>
    toArray(cols).find((c) => c?.name === name) ?? null;

  if (!key.includes(".")) {
    // Peta keyed-by-name (jika ada) atau cari by name di array.
    if (!Array.isArray(columns) && columns?.[key]) return columns[key];
    return findByName(list, key);
  }

  const segments = key.split(".");
  let cols = columns;
  let column = null;
  for (const segment of segments) {
    column =
      (!Array.isArray(cols) && cols?.[segment]) ||
      findByName(cols, segment) ||
      null;
    if (!column) return null;
    cols = column.columns ?? [];
  }
  return column;
};

/**
 * Tentukan valueInput untuk (column, operator) lewat getOperators — selaras
 * dengan ValueField. Mengembalikan null bila tak ter-resolve.
 * @param column
 * @param operator
 */
const valueInputFor = (column, operator) => {
  if (!column?.type || !operator) return null;
  const ops = getOperators(column.type, {
    typeRelation: column.typeRelation,
    hasOptions: columnHasOptions(column),
  });
  return ops[operator]?.valueInput ?? null;
};

/**
 * Validasi satu item terhadap kolomnya. Mengembalikan messageKey bila invalid,
 * atau null bila valid. `column` boleh null (kolom tak ter-resolve) → fallback
 * presence-only (key+operator+value terisi).
 * @param item
 * @param column
 * @returns {string|null}
 */
const validateItem = (item, column) => {
  const key = item?.[ITEM_KEY];
  const operator = item?.[ITEM_OPERATOR];
  const value = item?.[ITEM_VALUE];

  if (isNullOrWhitespace(key)) return MSG.required;
  if (isNullOrWhitespace(operator)) return MSG.required;

  // Kolom tak ter-resolve (mis. relasi belum di-load): presence-only.
  const valueInput = column ? valueInputFor(column, operator) : "text";
  if (valueInput === null) {
    return isFilledScalar(value) ? null : MSG.required;
  }

  switch (valueInput) {
    case "none":
      return null;

    case "checkbox":
      return null; // boolean; default false dianggap valid

    case "text":
    case "select":
      return isFilledScalar(value) ? null : MSG.required;

    case "currency":
    case "number":
      return isNumeric(value) ? null : MSG.numeric;

    case "time":
      return TIME_RE.test(`${value ?? ""}`) ? null : MSG.time;

    case "currency2": {
      const a = Array.isArray(value) ? value : [];
      if (a.length !== 2 || !isFilledScalar(a[0]) || !isFilledScalar(a[1])) {
        return MSG.rangeTwo;
      }
      return isNumeric(a[0]) && isNumeric(a[1]) ? null : MSG.numeric;
    }

    case "time2": {
      const a = Array.isArray(value) ? value : [];
      if (a.length !== 2 || !isFilledScalar(a[0]) || !isFilledScalar(a[1])) {
        return MSG.rangeTwo;
      }
      return TIME_RE.test(`${a[0]}`) && TIME_RE.test(`${a[1]}`)
        ? null
        : MSG.time;
    }

    case "multiselect": {
      const a = Array.isArray(value) ? value.filter(isFilledScalar) : [];
      return a.length >= 1 ? null : MSG.selectOne;
    }

    case "linkmodel":
      return value && value.id != null ? null : MSG.relation;

    case "linkmodelMulti":
    case "morphMulti": {
      const a = Array.isArray(value) ? value : [];
      const filled = a.filter((v) => v && v.id != null);
      return filled.length >= 1 ? null : MSG.relation;
    }

    case "morph":
      return value && value.type != null && value.id != null
        ? null
        : MSG.relation;

    case "dateselector": {
      if (!value || !value.period || !value.operator) return MSG.period;
      const subop = value.operator;
      const isRange = subop === "between" || subop === "not-between";
      if (value.period === "day") {
        if (!value.startDate || !isDateParseable(value.startDate)) {
          return MSG.date;
        }
        if (isRange && (!value.endDate || !isDateParseable(value.endDate))) {
          return MSG.date;
        }
        return null;
      }
      // Non-day: butuh year (single atau rangeStart/rangeEnd).
      const startYear = value.rangeStart?.year ?? value.year;
      if (startYear == null) return MSG.period;
      if (isRange && (value.rangeEnd?.year ?? value.year) == null) {
        return MSG.period;
      }
      return null;
    }

    default:
      return isFilledScalar(value) ? null : MSG.required;
  }
};

const isDateParseable = (v) => !Number.isNaN(Date.parse(`${v}`));

/**
 * Apakah item benar-benar kosong (belum disentuh) — key & operator & value
 * semua kosong. Item kosong total dilewati (akan di-drop), bukan error.
 * @param item
 */
const isUntouchedItem = (item) =>
  isNullOrWhitespace(item?.[ITEM_KEY]) &&
  isNullOrWhitespace(item?.[ITEM_OPERATOR]) &&
  !isFilledScalar(item?.[ITEM_VALUE]);

/**
 * Validasi seluruh tree. Telusur rekursif; kumpulkan error per-itemId.
 * Item kosong total dilewati. Tree tanpa satu pun item valid → valid:false.
 * @param tree
 * @param columns
 * @returns {{ valid: boolean, errors: Record<string,string> }}
 */
const validateTree = (tree, columns) => {
  const errors = {};
  let validCount = 0;

  const walk = (nodes) => {
    for (const [id, node] of Object.entries(nodes ?? {})) {
      if (isGroupNode(node)) {
        walk(node[GROUP_CHILDREN] ?? node.children);
        continue;
      }
      if (isUntouchedItem(node)) continue;

      const column = resolveColumn(columns, node?.[ITEM_KEY]);
      const message = validateItem(node, column);
      if (message) {
        errors[id] = message;
      } else {
        validCount += 1;
      }
    }
  };

  const root = tree?.root ?? tree;
  walk(root?.[GROUP_CHILDREN] ?? root?.children);

  const valid = Object.keys(errors).length === 0 && validCount > 0;
  return { valid, errors };
};

export { validateTree, validateItem, resolveColumn, valueInputFor };
