// Operator metadata untuk FilterTable. Selaras dengan backend
// App\Services\Core\FilterEvaluator::$operatorsByType.
//
// Tiap operator membawa `valueInput` yang menentukan komponen value field
// yang dirender oleh ValueField:
//   - "none"        : tanpa input (set/!set)
//   - "text"        : input teks
//   - "currency"    : NumberInput
//   - "currency2"   : dua NumberInput (between)
//   - "checkbox"    : Checkbox (boolean)
//   - "select"      : Select tunggal (formStatus/enum/relation single)
//   - "multiselect" : MultiSelect / multi-grow (in/!in)
//   - "linkmodel"   : LinkModel (relation basic)
//   - "linkmodelMulti"
//   - "morph"       : PermissionLinkModel + LinkModel (relation morph)
//   - "morphMulti"
//   - "time" / "time2"
//   - "dateselector": DateSelector (in_period)

const UNIVERSAL = {
  set: { operator: "set", valueInput: "none" },
  "!set": { operator: "!set", valueInput: "none" },
};

const op = (operator, valueInput) => ({ operator, valueInput });

// Apakah kolom membawa daftar `options` (enum-like). String dengan options
// dirender sebagai Select alih-alih input teks bebas.
const columnHasOptions = (column) => {
  const opts = column?.options;
  if (!opts) return false;
  return Array.isArray(opts) ? opts.length > 0 : Object.keys(opts).length > 0;
};

// valueInput untuk operator di mode column (bandingkan dgn kolom lain):
//   single komparasi → columnref · in/!in → columnrefMulti · between → columnref2
const columnRefInput = (operator) => {
  if (operator === "in" || operator === "!in") return "columnrefMulti";
  if (operator === "between" || operator === "!between") return "columnref2";
  return "columnref";
};

// Operator komparasi penuh untuk date/datetime di mode column (in_period
// dikecualikan; period butuh anchor literal). Selaras dgn backend
// FilterEvaluator::applyColumnComparison.
const DATE_COLUMN_OPERATORS = [
  "=",
  "!=",
  ">",
  ">=",
  "<",
  "<=",
  "in",
  "!in",
  "between",
  "!between",
];

const getOperators = (type, { typeRelation, hasOptions, mode } = {}) => {
  // Mode column: bandingkan kolom kiri dgn kolom lain. Operator mengikuti
  // type (kecuali date/datetime → set penuh tanpa in_period); valueInput
  // di-override ke columnref*; set/!set & in_period dibuang.
  if (mode === "column") {
    const baseOps =
      type === "date" || type === "datetime"
        ? DATE_COLUMN_OPERATORS
        : Object.keys(getOperators(type, { typeRelation, hasOptions }));

    const result = {};
    for (const operator of baseOps) {
      if (["set", "!set", "in_period", "!in_period"].includes(operator)) {
        continue;
      }
      result[operator] = op(operator, columnRefInput(operator));
    }
    return result;
  }

  let operators = {};

  switch (type) {
    case "string":
      // String dengan daftar `options` (enum-like) memakai Select/MultiSelect
      // untuk =,!=,in,!in; matches/starts_with/ends_with tetap teks bebas.
      operators = {
        "=": op("=", hasOptions ? "select" : "text"),
        "!=": op("!=", hasOptions ? "select" : "text"),
        matches: op("matches", "text"),
        "!matches": op("!matches", "text"),
        starts_with: op("starts_with", "text"),
        ends_with: op("ends_with", "text"),
        in: op("in", "multiselect"),
        "!in": op("!in", "multiselect"),
      };
      break;

    case "number":
    case "currency":
      operators = {
        "=": op("=", "currency"),
        "!=": op("!=", "currency"),
        ">": op(">", "currency"),
        ">=": op(">=", "currency"),
        "<": op("<", "currency"),
        "<=": op("<=", "currency"),
        in: op("in", "multiselect"),
        "!in": op("!in", "multiselect"),
        between: op("between", "currency2"),
        "!between": op("!between", "currency2"),
      };
      break;

    case "time":
      operators = {
        "=": op("=", "time"),
        "!=": op("!=", "time"),
        ">": op(">", "time"),
        ">=": op(">=", "time"),
        "<": op("<", "time"),
        "<=": op("<=", "time"),
        in: op("in", "multiselect"),
        "!in": op("!in", "multiselect"),
        between: op("between", "time2"),
        "!between": op("!between", "time2"),
      };
      break;

    case "date":
    case "datetime":
      // Semua komparasi & granularitas dipindahkan ke DateSelector.
      operators = {
        in_period: op("in_period", "dateselector"),
        "!in_period": op("!in_period", "dateselector"),
      };
      break;

    case "boolean":
      operators = {
        "=": op("=", "checkbox"),
        "!=": op("!=", "checkbox"),
      };
      break;

    case "relation": {
      const single = typeRelation === "morph" ? "morph" : "linkmodel";
      const multi = typeRelation === "morph" ? "morphMulti" : "linkmodelMulti";
      operators = {
        "=": op("=", single),
        "!=": op("!=", single),
        in: op("in", multi),
        "!in": op("!in", multi),
      };
      break;
    }

    case "formStatus":
    case "enum":
      operators = {
        "=": op("=", "select"),
        "!=": op("!=", "select"),
        in: op("in", "multiselect"),
        "!in": op("!in", "multiselect"),
      };
      break;

    case "relations": {
      const multi = typeRelation === "morph" ? "morphMulti" : "linkmodelMulti";
      operators = {
        has: op("has", multi),
        "!has": op("!has", multi),
        in: op("in", multi),
        "!in": op("!in", multi),
      };
      break;
    }

    case "formStatuses":
      operators = {
        has: op("has", "multiselect"),
        "!has": op("!has", "multiselect"),
        in: op("in", "multiselect"),
        "!in": op("!in", "multiselect"),
      };
      break;

    default:
      operators = {};
  }

  // Tipe non-filterable: tidak ada operator.
  if (["binary", "json", "mixed", "attribute"].includes(type)) {
    return {};
  }

  return { ...operators, ...UNIVERSAL };
};

export { getOperators, columnHasOptions };
