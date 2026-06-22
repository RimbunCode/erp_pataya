import { generateRandom } from "@/lib/utils";
import { resolveColumn } from "@/Components/Table/Filter/filterValidation";
import { getOperators } from "@/Components/Table/Filter/operators";

/**
 * Konversi dua arah antara dua grammar filter yang hidup di codebase:
 *
 * 1. **Tree LinkModel** — grammar ringkas yang dipakai prop `filters` komponen
 *    LinkModel/SelectModel & engine lama `ModelController::filterToQuery`. Map
 *    `{ kolom: nilai }` digabung AND per-level; key `and`/`or` = grup boolean;
 *    key `relasi.kolom` atau `relasi: {...}` = filter relasi (whereHas).
 * 2. **Tree FilterBuilder** — grammar `{ root: { k, c } }` yang dikonsumsi
 *    `FilterEvaluator` (backend) & `useNestedFilters`/`FilterBuilder` (frontend).
 *    Group `{ k:"and"|"or", c:{ <id>: node } }`; item `{ k:kolom, o:operator, v:nilai }`.
 *
 * INVARIAN renderability: hasil `linkModelToFilterTree` HANYA memakai operator
 * yang ada di `getOperators(column.type, ...)` (operators.js) untuk type kolomnya.
 * Operator tanpa padanan renderable dipetakan-ulang (mis. komparasi date →
 * `in_period` berbentuk DateSelector) atau di-skip — tidak pernah operator liar.
 * @see resources/js/Components/Table/Filter/operators.js (getOperators — whitelist per type)
 * @see app/Services/Core/FilterEvaluator.php (konsumen tree {root:{k,o,v,c}} di backend)
 * @see app/Services/Core/LinkModelFilterConverter.php (mirror PHP, pemetaan identik)
 * @see resources/js/Hooks/useNestedFilters.jsx (konsumen tree FilterBuilder di frontend)
 * @see .kiro/specs/select-model-rewrite/design.md (§3.3 grammar LinkModelFilterTree)
 */

/**
 * Tree LinkModel — map kolom→nilai (gabung AND), nilai scalar = operator `=`
 * (shorthand), objek `{ <operator>: <value> }` (AND antar-operator), key
 * `and`/`or` = grup boolean berisi sub-tree, key `relasi.kolom`/`relasi: {...}`
 * = filter relasi.
 *
 * Operator: `=`|`==`|`equal` (default) · `!=`|`not`|`notEqual` · `>`|`>=`|`<`|`<=` ·
 * `in`|`notIn` (array) · `between`|`notBetween` ([min,max]) · `like`|`notLike` ·
 * `jsonContains`|`jsonDoesntContains` (formStatuses) · `column` (nama kolom lain) ·
 * `and`|`or` (grup pada satu kolom).
 * @typedef {{[key: string]: unknown}} LinkModelFilterTree
 * @example <caption>shorthand equal</caption>
 * { status: "submitted" }                          // status = 'submitted'
 * @example <caption>operator eksplisit</caption>
 * { required_quantity: { ">": 0 } }                 // required_quantity > 0
 * @example <caption>grup boolean</caption>
 * { or: { status: "submitted", code: { like: "WO" } } }
 * @example <caption>filter pada relasi (whereHas)</caption>
 * { "items.required_quantity": { ">": 0 } }
 * @example <caption>date (dibungkus jadi in_period)</caption>
 * { created_at: { ">": "2024-01-01" } }             // → in_period / after
 */

/**
 * Tree FilterBuilder/FilterEvaluator — `{ root: group }`; group
 * `{ k:"and"|"or", c:{ <id>: node } }`; item `{ k:kolom, o:operator, v:nilai }`.
 * @typedef {{ root: { k: string, c: {[id: string]: unknown} } }} FilterBuilderTree
 */

const createId = () => generateRandom(8);

const hasOperatorKeys = (value) => {
  if (typeof value !== "object" || value === null) return false;
  const knownOperators = [
    "=",
    "==",
    "equal",
    "!=",
    "not",
    "notEqual",
    ">",
    ">=",
    "<",
    "<=",
    "in",
    "notIn",
    "between",
    "notBetween",
    "like",
    "notLike",
    "matches",
    "starts_with",
    "ends_with",
    "has",
    "!has",
    "set",
    "!set",
    "in_period",
    "!in_period",
    "and",
    "or",
    "column",
  ];
  for (const k of Object.keys(value)) {
    if (knownOperators.includes(k)) return true;
  }
  return false;
};

const mapOperator = (operator) => {
  switch (operator) {
    case "=":
    case "==":
    case "equal":
      return "=";
    case "!=":
    case "not":
    case "notEqual":
      return "!=";
    case ">":
    case ">=":
    case "<":
    case "<=":
      return operator;
    case "in":
      return "in";
    case "notIn":
      return "!in";
    case "between":
      return "between";
    case "notBetween":
      return "!between";
    case "like":
      return "matches";
    case "notLike":
      return "!matches";
    case "matches":
    case "starts_with":
    case "ends_with":
    case "has":
    case "!has":
    case "set":
    case "!set":
    case "in_period":
    case "!in_period":
      return operator;
    default:
      return null;
  }
};

const flattenRelation = (prefix, value) => {
  const result = {};
  for (const [k, v] of Object.entries(value)) {
    result[`${prefix}.${k}`] = v;
  }
  return result;
};

/**
 * Konversi tree LinkModel → tree FilterBuilder, renderable di `FilterBuilder`.
 *
 * Pemetaan operator IDENTIK helper PHP `LinkModelFilterConverter`: `not`→`!=`,
 * `notIn`→`!in`, `like`→`matches`, `notLike`→`!matches`, `notBetween`→`!between`;
 * kolom date/datetime → `in_period`/`!in_period` (value period DateSelector);
 * `jsonContains`/`jsonDoesntContains` pada formStatuses → `has`/`!has`; `column`
 * → column-mode `{ kind:"column", ref }`; key `raw(...)` & operator tak dikenal
 * di-skip. Item yang operatornya tak ada di `getOperators(type)` di-skip
 * (invarian renderability).
 * @param {LinkModelFilterTree} linkFilters  filter tree LinkModel
 * @param {{[name: string]: object}} columns  peta `getColumns()` (sumber type/relasi/options)
 * @returns {FilterBuilderTree}               tree renderable di FilterBuilder
 */
export const linkModelToFilterTree = (linkFilters, columns) => {
  const isRelationNode = (key) => {
    const colNode = resolveColumn(columns, key);
    if (!colNode) return false;
    return ["relation", "relations"].includes(colNode.type);
  };

  const parseGroup = (filters) => {
    const children = {};
    if (!filters || typeof filters !== "object") return children;

    for (const [key, value] of Object.entries(filters)) {
      const lowerKey = String(key).toLowerCase();

      if (lowerKey === "and" || lowerKey === "or") {
        if (typeof value === "object" && value !== null) {
          children[createId()] = {
            k: lowerKey,
            c: parseGroup(value),
          };
        }
        continue;
      }

      if (String(key).startsWith("raw(")) {
        continue;
      }

      if (typeof value === "object" && value !== null && isRelationNode(key)) {
        if (!Array.isArray(value) && !hasOperatorKeys(value)) {
          if (
            Object.keys(value).length > 0 &&
            !(
              value.id !== undefined &&
              Object.keys(value).filter((k) => !["id", "type"].includes(k))
                .length === 0
            )
          ) {
            const flattened = flattenRelation(key, value);
            const parsed = parseGroup(flattened);
            for (const [childId, childNode] of Object.entries(parsed)) {
              children[childId] = childNode;
            }
            continue;
          }
        }
      }

      const items = parseColumn(key, value);
      items.forEach((item) => {
        children[createId()] = item;
      });
    }
    return children;
  };

  const mapDatePeriod = (key, operator, value) => {
    let filterOp, periodOp;
    switch (operator) {
      case ">":
        filterOp = "in_period";
        periodOp = "after";
        break;
      case ">=":
        filterOp = "in_period";
        periodOp = "on-or-after";
        break;
      case "<":
        filterOp = "in_period";
        periodOp = "before";
        break;
      case "<=":
        filterOp = "in_period";
        periodOp = "on-or-before";
        break;
      case "=":
      case "equal":
        filterOp = "in_period";
        periodOp = "is";
        break;
      case "not":
      case "!=":
      case "notEqual":
        filterOp = "!in_period";
        periodOp = "is";
        break;
      case "between":
        filterOp = "in_period";
        periodOp = "between";
        break;
      case "notBetween":
        filterOp = "!in_period";
        periodOp = "between";
        break;
      default:
        return null;
    }

    const periodValue = {
      period: "day",
      operator: periodOp,
    };

    if (periodOp === "between") {
      if (Array.isArray(value) && value.length >= 2) {
        periodValue.startDate = value[0];
        periodValue.endDate = value[1];
      } else {
        return null;
      }
    } else {
      periodValue.startDate = value;
    }

    return {
      k: key,
      o: filterOp,
      v: periodValue,
    };
  };

  const mapItem = (key, operator, value) => {
    if (operator === "column") {
      let innerOp = "=";
      let ref = value;
      if (
        typeof value === "object" &&
        value !== null &&
        !Array.isArray(value)
      ) {
        const innerOpKey = Object.keys(value)[0];
        const mappedInnerOp = mapOperator(innerOpKey);
        if (mappedInnerOp !== null) {
          innerOp = mappedInnerOp;
          ref = value[innerOpKey];
        }
      }
      return {
        k: key,
        o: innerOp,
        v: { kind: "column", ref },
      };
    }

    const colNode = resolveColumn(columns, key);
    const type = colNode?.type || "string";

    if (type === "date" || type === "datetime") {
      const mapped = mapDatePeriod(key, operator, value);
      if (mapped === null) return null;

      if (colNode) {
        const ops = getOperators(type, {
          typeRelation: colNode.typeRelation,
          hasOptions: Boolean(colNode.options),
        });
        if (!Object.keys(ops).includes(mapped.o)) return null;
      }

      return mapped;
    }

    if (operator === "jsonContains" || operator === "jsonDoesntContains") {
      if (key === "formStatuses" || colNode?.name === "formStatuses") {
        const mappedOp = operator === "jsonContains" ? "has" : "!has";
        return { k: key, o: mappedOp, v: value };
      }
      return null;
    }

    const mappedOp = mapOperator(operator);
    if (mappedOp === null) return null;

    if (colNode) {
      const ops = getOperators(type, {
        typeRelation: colNode.typeRelation,
        hasOptions: Boolean(colNode.options),
      });
      if (!Object.keys(ops).includes(mappedOp)) {
        return null;
      }
    }

    return { k: key, o: mappedOp, v: value };
  };

  const parseColumn = (key, value) => {
    if (
      typeof value !== "object" ||
      value === null ||
      Array.isArray(value) ||
      (value.id !== undefined &&
        Object.keys(value).filter((k) => !["id", "type"].includes(k)).length ===
          0)
    ) {
      const item = mapItem(key, "=", value);
      return item ? [item] : [];
    }

    const items = [];
    for (const [opKey, val] of Object.entries(value)) {
      const lowerOpKey = String(opKey).toLowerCase();
      if (lowerOpKey === "and" || lowerOpKey === "or") {
        if (typeof val === "object" && val !== null) {
          items.push({
            k: lowerOpKey,
            c: parseGroup(val),
          });
        }
        continue;
      }

      const item = mapItem(key, opKey, val);
      if (item) {
        items.push(item);
      }
    }

    if (items.length > 1) {
      const groupChildren = {};
      items.forEach((item) => {
        groupChildren[createId()] = item;
      });
      return [
        {
          k: "and",
          c: groupChildren,
        },
      ];
    }

    return items;
  };

  const c = parseGroup(linkFilters);
  return {
    root: {
      k: "and",
      c,
    },
  };
};

const mapBackOperator = (operator, value) => {
  if (operator === "in_period") {
    if (value && value.period === "day" && value.operator) {
      switch (value.operator) {
        case "after":
          return ">";
        case "on-or-after":
          return ">=";
        case "before":
          return "<";
        case "on-or-before":
          return "<=";
        case "is":
          return "=";
        case "between":
          return "between";
      }
    }
    return "in_period";
  }
  if (operator === "!in_period") {
    if (value && value.period === "day" && value.operator) {
      switch (value.operator) {
        case "is":
          return "!=";
        case "between":
          return "notBetween";
      }
    }
    return "!in_period";
  }

  switch (operator) {
    case "=":
      return "=";
    case "!=":
      return "!=";
    case "in":
      return "in";
    case "!in":
      return "notIn";
    case "between":
      return "between";
    case "!between":
      return "notBetween";
    case "matches":
      return "like";
    case "!matches":
      return "notLike";
    case "has":
      return "jsonContains";
    case "!has":
      return "jsonDoesntContains";
    default:
      return operator;
  }
};

/**
 * Konversi balik tree FilterBuilder → tree LinkModel (untuk dikirim inline ke
 * backend, mis. `model.selectData`). Membalik pemetaan: `=`→shorthand scalar,
 * `!=`→`not`, `matches`→`like`, `in_period` day → komparasi (`after`→`>`,
 * `between`→`{between:[start,end]}`), column-mode → `{ column: ref }`.
 *
 * Round-trip `link → tree → link` setara untuk operator yang punya padanan dua
 * arah. `in_period` non-day (month/quarter/year) tak punya padanan scalar →
 * dipertahankan apa adanya.
 * @param {FilterBuilderTree} tree  tree dari FilterBuilder/useNestedFilters
 * @returns {LinkModelFilterTree}   filter tree LinkModel
 */
export const filterTreeToLinkModel = (tree) => {
  if (!tree || !tree.root) return {};

  const walk = (node) => {
    if (!node) return null;

    if (
      node.c !== undefined &&
      node.k &&
      ["and", "or"].includes(String(node.k).toLowerCase())
    ) {
      const groupKey = String(node.k).toLowerCase();
      const children = Object.values(node.c).map(walk).filter(Boolean);

      if (children.length === 0) return null;

      const merged = {};
      children.forEach((child) => {
        for (const [k, v] of Object.entries(child)) {
          if (
            merged[k] !== undefined &&
            typeof merged[k] === "object" &&
            typeof v === "object" &&
            !Array.isArray(merged[k]) &&
            !Array.isArray(v)
          ) {
            Object.assign(merged[k], v);
          } else {
            merged[k] = v;
          }
        }
      });

      // Don't wrap in { and: ... } if it's not strictly necessary, but LinkModel 'and'/'or' expects
      // "and": { ... }
      return { [groupKey]: merged };
    }

    if (node.k && node.o) {
      const key = node.k;
      const op = mapBackOperator(node.o, node.v);
      let val = node.v;

      if (node.o === "in_period" || node.o === "!in_period") {
        if (op === "between" || op === "notBetween") {
          val = [val.startDate, val.endDate];
        } else if (op !== "in_period" && op !== "!in_period") {
          val = val.startDate;
        }
      }

      if (val && typeof val === "object" && val.kind === "column") {
        if (op === "=") {
          return { [key]: { column: val.ref } };
        }
        return { [key]: { column: { [op]: val.ref } } };
      }

      if (op === "=") {
        return { [key]: val };
      }
      return { [key]: { [op]: val } };
    }
  };

  const rootC = tree.root.c || {};
  const rootChildren = Object.values(rootC).map(walk).filter(Boolean);

  const result = {};
  rootChildren.forEach((child) => {
    for (const [k, v] of Object.entries(child)) {
      if (
        result[k] !== undefined &&
        typeof result[k] === "object" &&
        typeof v === "object" &&
        !Array.isArray(result[k]) &&
        !Array.isArray(v)
      ) {
        Object.assign(result[k], v);
      } else {
        result[k] = v;
      }
    }
  });

  return result;
};
