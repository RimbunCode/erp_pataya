import Handlebars from "handlebars";
import { format as dateFnsFormat } from "date-fns";
import { TZDate } from "@date-fns/tz";
import { formatNumber as formatNumberValue } from "@/Components/NumberInput/formatNumber";
import { convertTemplateLink } from "./linkModelUtils";
import { resolveLabel } from "@/Pages/Core/PrintTemplate/utils/variableTokenUtils";

// Format angka gaya Indonesia (locale "id"): pemisah ribuan "." dan desimal ",".
const ID_GROUP_SEPARATOR = ".";
const ID_DECIMAL_SEPARATOR = ",";

// Fallback symbol per currency code untuk helper Handlebars `formatCurrency`
// (helper hanya menerima kode currency string, bukan symbol).
const CURRENCY_SYMBOLS = {
  IDR: "Rp",
  USD: "$",
  EUR: "€",
  GBP: "£",
  JPY: "¥",
  SGD: "S$",
  MYR: "RM",
};

/**
 * Resolve a dot-notation field path within a DataTableColumns configuration array.
 *
 * Traverses the columns hierarchy following the path segments. For example,
 * given path "customer.name" it will find the "customer" column, then look
 * inside its nested columns for "name".
 * @param {string} path - Dot-notation field path (e.g., "customer.name", "items.product")
 * @param {Array} columns - DataTableColumns configuration array
 * @returns {object|null} The resolved column definition or null if not found
 */
function _resolveFieldPath(path, columns) {
  if (!path || !columns) return null;

  const parts = path.split(".");
  let current = columns;

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    const found = current?.find(
      (col) => col.name === part || col.nameOfFunction === part,
    );

    if (!found) return null;

    // Last segment — return the column definition
    if (i === parts.length - 1) {
      return found;
    }

    // Navigate into nested columns
    if (found.columns && Array.isArray(found.columns)) {
      current = found.columns;
    } else {
      return null;
    }
  }

  return null;
}

export function initHandlebar(trans) {
  Handlebars.registerHelper("relation", function (payload) {
    return convertTemplateLink(payload);
  });

  // ─── Unified Label Helper ───────────────────────────────────────────────────
  // Requirements: 2.9, 2.10, 3.4
  //
  // Retrieves field labels from DataTableColumns configuration.
  // Replaces separate `infoColumns` and `trans` helpers with a unified approach.
  //
  // Usage:
  //   {{label "customer.name"}}
  //   {{label "items.product"}}
  //   {{label "fieldPath" type="preferences"}}
  //   {{label "fieldPath" locale="id"}}
  Handlebars.registerHelper("label", function (path, options) {
    if (typeof path !== "string") return null;

    const root = options.data.root;
    const { columns, modelDoc } = root;

    return resolveLabel(path, columns, modelDoc, trans);
  });

  // ─── Legacy Helpers (kept for backward compatibility) ─────────────────────────
  // These helpers are preserved to avoid breaking existing templates.
  // New templates should use the unified `label` helper instead.

  Handlebars.registerHelper("trans", function (payload) {
    if (typeof payload !== "string") {
      return payload?.title || trans(payload?.titleTrans) || payload?.name;
    } else {
      return trans(payload);
    }
  });
  Handlebars.registerHelper("companyDetail", function (key, options) {
    const data = options?.data?.root?.preferences;
    return data[key];
  });
  Handlebars.registerHelper("each", function (context, options) {
    if (!context) return options.fn(context);
    var ret = "";
    for (var i = 0, j = context.length; i < j; i++) {
      context[i].idx = i + 1;
      ret = ret + options.fn(context[i]);
    }

    return ret;
  });
  Handlebars.registerHelper("infoColumns", function (context, options) {
    if (!context) return options.fn(context);
    const type = options.hash.type ?? "data";
    const oriKey = options.hash.key ?? "";
    const splitKey = oriKey.split(".");

    let data = context?.filter((x) => x.type == type)[0]?.columns;

    for (let key of splitKey) {
      const temp = data?.filter((x) => x.name == key)[0]?.columns;
      if (temp) {
        data = temp;
      }
    }
    data = data?.reduce(
      (a, b) => ({
        ...a,
        [b.name]: options.hash.extract ? b[options.hash.extract] : b,
      }),
      {},
    );
    return options.fn(data);
  });

  // ─── Formatting Helpers ───────────────────────────────────────────────────────
  // Requirements: 2.11, 2.12

  /**
   * Format a date value using a format string.
   * Usage: {{formatDate date "DD/MM/YYYY"}}
   *
   * Supported format tokens (mapped to date-fns):
   *   DD -> dd, MM -> MM, YYYY -> yyyy, HH -> HH, mm -> mm, ss -> ss
   */
  Handlebars.registerHelper("formatDate", function (value, formatStr) {
    if (value == null || value === "") {
      return "";
    }
    if (typeof formatStr !== "string") {
      return "[formatDate: format parameter must be a string]";
    }

    try {
      // Convert user-friendly format tokens to date-fns tokens
      const dateFnsFormatStr = formatStr
        .replace(/YYYY/g, "yyyy")
        .replace(/DD/g, "dd")
        .replace(/\bss\b/g, "ss");

      const dateValue =
        value instanceof Date ? value : new TZDate(value, "UTC");

      return dateFnsFormat(dateValue, dateFnsFormatStr);
    } catch (e) {
      return `[formatDate error: ${e.message}]`;
    }
  });

  /**
   * Format a numeric value as currency.
   * Usage: {{formatCurrency amount "IDR"}}
   *
   * Memakai `formatNumber` (helper internal) dengan format Indonesia. Symbol
   * di-resolve dari kode currency via tabel CURRENCY_SYMBOLS (fallback kode).
   */
  Handlebars.registerHelper("formatCurrency", function (value, currency) {
    if (value == null || value === "") {
      return "";
    }
    if (typeof value !== "number" && typeof value !== "string") {
      return "[formatCurrency: value must be a number or numeric string]";
    }
    if (typeof currency !== "string" || currency.trim() === "") {
      return '[formatCurrency: currency parameter must be a non-empty string (e.g. "IDR", "USD")]';
    }

    try {
      const code = currency.trim().toUpperCase();
      const symbol = CURRENCY_SYMBOLS[code] ?? code;
      return formatNumberValue(value, {
        groupSeparator: ID_GROUP_SEPARATOR,
        decimalSeparator: ID_DECIMAL_SEPARATOR,
        decimalScale: 2,
        prefix: `${symbol} `,
      });
    } catch (e) {
      return `[formatCurrency error: ${e.message}]`;
    }
  });

  /**
   * Format a numeric value with a specified number of decimal places.
   * Usage: {{formatNumber value 2}}
   */
  Handlebars.registerHelper("formatNumber", function (value, decimals) {
    if (value == null || value === "") {
      return "";
    }
    if (typeof value !== "number" && typeof value !== "string") {
      return "[formatNumber: value must be a number or numeric string]";
    }
    if (typeof decimals !== "number" || !Number.isInteger(decimals)) {
      return "[formatNumber: decimals parameter must be an integer]";
    }

    try {
      const numericValue =
        typeof value === "string" ? parseFloat(value) : value;

      if (isNaN(numericValue)) {
        return "[formatNumber: value is not a valid number]";
      }

      return formatNumberValue(numericValue, {
        groupSeparator: ID_GROUP_SEPARATOR,
        decimalSeparator: ID_DECIMAL_SEPARATOR,
        decimalScale: decimals,
      });
    } catch (e) {
      return `[formatNumber error: ${e.message}]`;
    }
  });

  /**
   * Convert text to uppercase.
   * Usage: {{uppercase text}}
   */
  Handlebars.registerHelper("uppercase", function (value) {
    if (value == null || value === "") {
      return "";
    }
    if (typeof value !== "string") {
      return "[uppercase: value must be a string]";
    }

    return value.toUpperCase();
  });

  // ─── Arithmetic Helpers for Calculated Columns ────────────────────────────────
  // Requirements: 3.15
  // Support inline expressions in table cells for calculated columns.

  /**
   * Multiply two values.
   * Usage: {{multiply this.quantity this.price}}
   */
  Handlebars.registerHelper("multiply", function (a, b) {
    const numA = typeof a === "string" ? parseFloat(a) : a;
    const numB = typeof b === "string" ? parseFloat(b) : b;

    if (numA == null || numB == null || isNaN(numA) || isNaN(numB)) {
      return 0;
    }

    return numA * numB;
  });

  /**
   * Subtract second value from first.
   * Usage: {{subtract this.total this.discount}}
   */
  Handlebars.registerHelper("subtract", function (a, b) {
    const numA = typeof a === "string" ? parseFloat(a) : a;
    const numB = typeof b === "string" ? parseFloat(b) : b;

    if (numA == null || isNaN(numA)) return 0;
    if (numB == null || isNaN(numB)) return numA;

    return numA - numB;
  });

  /**
   * Add two values.
   * Usage: {{add this.subtotal this.tax}}
   */
  Handlebars.registerHelper("add", function (a, b) {
    const numA = typeof a === "string" ? parseFloat(a) : a;
    const numB = typeof b === "string" ? parseFloat(b) : b;

    if (numA == null || isNaN(numA)) return numB || 0;
    if (numB == null || isNaN(numB)) return numA || 0;

    return numA + numB;
  });

  /**
   * Divide first value by second.
   * Usage: {{divide this.total this.quantity}}
   */
  Handlebars.registerHelper("divide", function (a, b) {
    const numA = typeof a === "string" ? parseFloat(a) : a;
    const numB = typeof b === "string" ? parseFloat(b) : b;

    if (numA == null || isNaN(numA)) return 0;
    if (numB == null || numB === 0 || isNaN(numB)) return 0;

    return numA / numB;
  });
}
