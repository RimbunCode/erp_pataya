import { getValueObject, isNullOrWhitespace } from "./utils";

function validateWithOperators(value, operators, logic = "and") {
  const parseDate = (val) => {
    if (val instanceof Date) return val;
    if (typeof val === "string") {
      const parsed = new Date(val);
      return isNaN(parsed.getTime()) ? null : parsed;
    }
    return null;
  };

  const normalizeDateComparison = (left, right) => {
    const leftDate = parseDate(left);

    if (Array.isArray(right)) {
      const rightDates = right.map(parseDate);
      if (leftDate && rightDates.every(Boolean)) {
        return {
          left: leftDate.getTime(),
          right: rightDates.map((d) => d.getTime()),
        };
      }
      return { left, right };
    }

    const rightDate = parseDate(right);
    if (leftDate && rightDate) {
      return { left: leftDate.getTime(), right: rightDate.getTime() };
    }

    return { left, right };
  };

  let result = false;
  for (let keyOperator in operators) {
    const valOperator = operators[keyOperator];
    keyOperator = keyOperator.match(/^([^\[\]]+)/)?.[1] ?? keyOperator;
    switch (keyOperator) {
      case "and":
      case "or": {
        result =
          Array.isArray(valOperator) && keyOperator == "or"
            ? valOperator.includes(value)
            : validateWithOperators(value, valOperator, keyOperator);
        break;
      }
      case "!=":
      case "notEqual":
      case "not":
        (() => {
          const { left, right } = normalizeDateComparison(value, valOperator);
          result = left != right;
        })();
        break;
      case "equal":
      case "==":
        (() => {
          const { left, right } = normalizeDateComparison(value, valOperator);
          result = left == right;
        })();
        break;
      case ">":
        (() => {
          const { left, right } = normalizeDateComparison(value, valOperator);
          result = left > right;
        })();
        break;
      case ">=":
        (() => {
          const { left, right } = normalizeDateComparison(value, valOperator);
          result = left >= right;
        })();
        break;
      case "<":
        (() => {
          const { left, right } = normalizeDateComparison(value, valOperator);
          result = left < right;
        })();
        break;
      case "<=":
        (() => {
          const { left, right } = normalizeDateComparison(value, valOperator);
          result = left <= right;
        })();
        break;
      case "jsonContains":
        if (Array.isArray(value)) {
          let rst = false;
          value.forEach((item) => {
            if (valOperator.includes(item)) {
              rst = true;
            }
            return;
          });
          result = rst;
        }
        break;
      case "jsonDoesntContains":
        if (Array.isArray(value)) {
          let rst = true;
          value.forEach((item) => {
            if (!valOperator.includes(item)) {
              rst = false;
            }
            return;
          });
          result = rst;
        }
        break;
      case "like":
        result = valOperator.includes(value);
        break;
      case "notlike":
        result = !valOperator.includes(value);
        break;
      case "in":
        if (Array.isArray(value)) {
          let rst = false;
          value.forEach((item) => {
            if (valOperator.includes(item)) {
              rst = true;
            }
          });
          result = rst;
          break;
        }
        result = Array.isArray(valOperator)
          ? valOperator.includes(value)
          : false;
        break;
      case "notIn":
        if (Array.isArray(value)) {
          let rst = true;
          value.forEach((item) => {
            if (!valOperator.includes(item)) {
              rst = false;
            }
          });
          result = rst;
          break;
        }
        result = Array.isArray(valOperator)
          ? !valOperator.includes(value)
          : true;
        break;
      case "between":
        (() => {
          const { left, right } = normalizeDateComparison(value, valOperator);
          result =
            Array.isArray(right) && right.length >= 2
              ? left >= right[0] && left <= right[1]
              : value >= valOperator[0] && value <= valOperator[1];
        })();
        break;
      case "notBetween":
        (() => {
          const { left, right } = normalizeDateComparison(value, valOperator);
          result =
            Array.isArray(right) && right.length >= 2
              ? left < right[0] || left > right[1]
              : value < valOperator[0] || value > valOperator[1];
        })();
        break;
      default: {
        const keys = keyOperator.split(/\.|->/);
        let val = value;

        for (let key of keys) {
          if (!val) break;
          val = val[key];
        }
        result = val ? validateWithOperators(val, valOperator) : true;

        break;
      }
    }
    if (logic === "and" && !result) return false;
    if (logic === "or" && result) return true;
  }
  return logic == "and";
}
export function validate(value, model) {
  if (!value || !model) return true;
  return value.thisModel === model;
}
function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export const convertTemplateLink = (value, search, asObject = false) => {
  if (!value) return "";
  const template = value.templateLink ?? "";
  let item = template.replace(/:((\w[\w]+{:[\w]+})|(\w[\w.]+))/g, (match) => {
    match = match.replace(/(.*?){:(.*?)}/i, ":$2");
    const newValue = getValueObject(value, match.substring(1));
    if (typeof newValue == "object" && newValue !== null) {
      if (newValue.templateLink) {
        return convertTemplateLink(newValue, search);
      }
      const firstVal = Object.values(newValue).find(
        (v) => typeof v === "string" || typeof v === "number",
      );
      return firstVal != null ? escapeHtml(firstVal) : match;
    }
    return newValue != null ? escapeHtml(newValue) : match;
  });
  if (!asObject && search == null) {
    const titleMatch = item.match(/<title(.*?)>(.*?)<\/title>/i);
    const plainTextMatch = item.match(/^[^<]+/g);

    return titleMatch
      ? titleMatch[2].trim()
      : plainTextMatch
        ? plainTextMatch[0].trim()
        : "";
  }

  item = item.replace(/<title(.*?)>(.*?)<\/title>/gi, "");

  let searchWords =
    search
      .split(/\s+/)
      ?.map((string) => string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      .filter((x) => !isNullOrWhitespace(x)) || [];

  if (searchWords.length < 1) return item;

  let regex = new RegExp(`(${searchWords.join("|")})`, "gi");
  item = item.replace(/(<[^>]+>)|([^<]+)/g, (_, tag, text) => {
    if (tag) return tag; // Jika ini bagian dari tag HTML, jangan ubah
    return text.replace(regex, `<mark class="bg-yellow-500">$1</mark>`); // Hanya ubah teks biasa
  });

  return item;
};
