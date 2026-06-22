/**
 * Utilitas untuk memformat dan mengelola token variabel Handlebar.
 * Menyediakan fungsi-fungsi helper untuk memformat nilai kolom,
 * menghasilkan token Handlebar, dan menampilkan label variabel.
 * @module variableTokenUtils
 */

import { formatNumber } from "@/Components/NumberInput/formatNumber";

// Format angka gaya Indonesia (locale "id"): pemisah ribuan "." dan desimal ",".
const ID_GROUP_SEPARATOR = ".";
const ID_DECIMAL_SEPARATOR = ",";

/**
 * Memformat nilai berdasarkan tipe kolom dan opsi format dari DataTableColumns.
 * Mendukung tipe "currency" (format mata uang) dan "numeric"/"number" (format angka desimal).
 *
 * Memakai `formatNumber` (helper internal). Symbol currency diambil dari kolom
 * (`column.symbol` / `column.currency.symbol`) bila tersedia, fallback "Rp".
 * @param {number|string|null} value - Nilai yang akan diformat
 * @param {object} column - Definisi kolom dari DataTableColumns
 * @returns {string} Nilai yang sudah diformat atau string asli
 */
export function formatColumnValue(value, column) {
  if (value == null || value === "") return "";

  const type = column?.type;
  const decimalScale = column?.decimalScale ?? column?.formatOptions?.decimals;

  // Format sebagai mata uang.
  if (type === "currency") {
    try {
      const decimals = typeof decimalScale === "number" ? decimalScale : 2;
      const symbol = column?.symbol ?? column?.currency?.symbol ?? "Rp";
      const formatted = formatNumber(value, {
        groupSeparator: ID_GROUP_SEPARATOR,
        decimalSeparator: ID_DECIMAL_SEPARATOR,
        decimalScale: decimals,
        prefix: `${symbol} `,
      });
      return formatted === "" ? String(value) : formatted;
    } catch {
      return String(value);
    }
  }

  // Format sebagai angka desimal dengan jumlah digit tertentu.
  if (type === "numeric" || type === "number") {
    try {
      const numericValue =
        typeof value === "string" ? parseFloat(value) : Number(value);
      if (isNaN(numericValue)) return String(value);

      const decimals = typeof decimalScale === "number" ? decimalScale : 0;
      const formatted = formatNumber(numericValue, {
        groupSeparator: ID_GROUP_SEPARATOR,
        decimalSeparator: ID_DECIMAL_SEPARATOR,
        decimalScale: decimals,
      });
      return formatted === "" ? String(value) : formatted;
    } catch {
      return String(value);
    }
  }

  return String(value);
}

/**
 * Menghasilkan token Handlebar untuk variabel, membungkus dengan helper format
 * jika tipe kolom adalah currency atau numeric/number.
 * @param {object} variable - Definisi variabel/kolom
 * @param {string} fullKey - Key lengkap dengan notasi dot untuk variabel
 * @returns {string} String token Handlebar (dengan {{ }})
 */
export function getFormattedHandlebarToken(variable, fullKey) {
  const type = variable?.type;
  const normalizedDocPath = fullKey.startsWith("doc.")
    ? fullKey
    : `doc.${fullKey}`;

  // Variabel perusahaan menggunakan prefix company
  if (variable.parentType === "company") {
    return `{{company.${variable.name}}}`;
  }

  // Variabel info dokumen menggunakan prefix docInfo
  if (variable.parentType === "docInfo" || type === "docInfo") {
    return `{{docInfo.${variable.name}}}`;
  }

  // Variabel relasi menggunakan helper relation
  if (type === "relation") {
    return `{{relation ${normalizedDocPath}}}`;
  }

  // Tipe currency menggunakan helper formatCurrency dengan kode mata uang
  if (type === "currency") {
    const currency =
      variable?.currency ?? variable?.formatOptions?.currency ?? "IDR";
    return `{{formatCurrency ${normalizedDocPath} "${currency}"}}`;
  }

  // Tipe numeric/number menggunakan helper formatNumber dengan jumlah desimal
  if (type === "numeric" || type === "number") {
    const decimals =
      variable?.decimalScale ?? variable?.formatOptions?.decimals ?? 0;
    return `{{formatNumber ${normalizedDocPath} ${decimals}}}`;
  }

  return `{{${normalizedDocPath}}}`;
}

/**
 * Memeriksa apakah tipe kolom memerlukan pemformatan khusus.
 * @param {string} type - Tipe kolom dari DataTableColumns
 * @returns {boolean} True jika tipe memerlukan pemformatan
 */
export function isFormattableType(type) {
  return type === "currency" || type === "numeric" || type === "number";
}

/**
 * Mengambil nilai contoh dari data example menggunakan path notasi dot.
 * @param {object} exampleData - Objek data contoh dari backend
 * @param {string} path - Path notasi dot (misal: "customer_name", "customer.name")
 * @param {string} type - Tipe variabel ("data", "preferences", "relation", dll.)
 * @returns {string|null} Nilai contoh yang ditemukan atau null
 */
export function resolveExampleValue(exampleData, path, type) {
  if (!exampleData || !path) return null;

  // Untuk preferences, cari di objek preferences
  if (type === "preferences") {
    const preferences = exampleData?.preferences;
    if (preferences && preferences[path] !== undefined) {
      return String(preferences[path]);
    }
    return null;
  }

  // Untuk data biasa, telusuri objek data contoh menggunakan path
  const parts = path.split(".");
  let current = exampleData;

  for (const part of parts) {
    if (current == null || typeof current !== "object") return null;
    current = current[part];
  }

  if (current == null) return null;
  if (typeof current === "object") return JSON.stringify(current);
  return String(current);
}

/**
 * Menghasilkan string token Handlebar untuk variabel berdasarkan tipe dan parentType.
 * @param {object} variable - Objek variabel dengan properti name, type, dan parentType
 * @returns {string} String token Handlebar
 */
export function getHandlebarToken(variable) {
  const normalizedDocPath = variable.name.startsWith("doc.")
    ? variable.name
    : `doc.${variable.name}`;

  // Variabel perusahaan
  if (variable.parentType === "company") {
    return `{{company.${variable.name}}}`;
  }

  // Variabel info dokumen
  if (variable.parentType === "docInfo" || variable.type === "docInfo") {
    return `{{docInfo.${variable.name}}}`;
  }

  // Variabel relasi tunggal
  if (variable.type === "relation") {
    return `{{relation ${normalizedDocPath}}}`;
  }

  // Variabel relasi jamak (each loop)
  if (variable.type == "relations") {
    return `{{#each ${normalizedDocPath}}}...{{/each}}`;
  }

  return `{{${normalizedDocPath}}}`;
}

/**
 * Mengambil label tampilan untuk variabel menggunakan terjemahan atau title.
 * Prioritas: title > titleTrans (diterjemahkan) > name.
 * @param {object} variable - Objek variabel dengan properti title, titleTrans, dan name
 * @param {Function} t - Fungsi terjemahan dari laravel-react-i18n
 * @returns {string} Label yang akan ditampilkan
 */
export function getDisplayLabel(variable, t) {
  return (
    variable.title ||
    (variable.titleTrans ? t(variable.titleTrans) : null) ||
    variable.name
  );
}

/**
 * Menentukan label kolom dengan prioritas:
 * `title` → `t(titleTrans)` → `name`.
 * @param {object} col
 * @param {Function} t
 * @param {string} fallbackPath
 * @returns {string}
 */
function resolveColumnDisplayLabel(col, t, fallbackPath) {
  const hasDirectTitle = typeof col?.title === "string" && col.title.trim();
  if (hasDirectTitle) {
    return col.title;
  }

  const hasTitleTrans =
    typeof col?.titleTrans === "string" && col.titleTrans.trim();
  if (hasTitleTrans) {
    if (typeof t === "function") {
      const translated = t(col.titleTrans);
      if (translated != null && translated !== "") {
        return translated;
      }
    }
    return col.titleTrans;
  }

  const hasName = typeof col?.name === "string" && col.name.trim();
  if (hasName) {
    return col.name;
  }

  return fallbackPath;
}

/**
 * Resolusi label dari path dan mengembalikan metadata `titleTrans`
 * dari leaf column saat berhasil.
 * @param {string} path
 * @param {object|null|undefined} columns
 * @param {string|null|undefined} modelDoc
 * @param {Function} t
 * @returns {{ label: string, titleTrans: string|null }}
 */
export function resolveLabelWithMeta(path, columns, modelDoc, t) {
  if (!path || !columns) {
    return { label: path ?? "", titleTrans: null };
  }

  const firstDotIndex = path.indexOf(".");
  if (firstDotIndex === -1) {
    return { label: path, titleTrans: null };
  }

  const prefix = path.slice(0, firstDotIndex);
  const segments = path.slice(firstDotIndex + 1).split(".");
  if (segments.length === 0) {
    return { label: path, titleTrans: null };
  }

  let currentModel = null;
  if (prefix === "doc") {
    if (!modelDoc) {
      return { label: path, titleTrans: null };
    }
    currentModel = modelDoc;
  } else if (prefix === "company" || prefix === "docInfo") {
    currentModel = prefix;
  } else {
    return { label: path, titleTrans: null };
  }

  let result = path;
  let resolvedTitleTrans = null;

  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index];
    const modelColumns = columns?.[currentModel];
    if (!modelColumns || typeof modelColumns !== "object") {
      return { label: path, titleTrans: null };
    }

    const col = modelColumns?.[segment];
    if (!col || typeof col !== "object") {
      return { label: path, titleTrans: null };
    }

    const hasAnyLabelValue = Boolean(
      (typeof col.title === "string" && col.title.trim()) ||
      (typeof col.titleTrans === "string" && col.titleTrans.trim()) ||
      (typeof col.name === "string" && col.name.trim()),
    );
    if (!hasAnyLabelValue) {
      return { label: path, titleTrans: null };
    }

    result = resolveColumnDisplayLabel(col, t, path);
    resolvedTitleTrans =
      typeof col.titleTrans === "string" && col.titleTrans.trim()
        ? col.titleTrans
        : null;

    const isRelationType = col.type === "relation" || col.type === "relations";
    if (!isRelationType) {
      continue;
    }

    if (col.related) {
      currentModel = col.related;
      continue;
    }

    // Relation leaf tanpa `related`: kembalikan label terbaik yang sudah ada.
    if (index < segments.length - 1) {
      return { label: result, titleTrans: resolvedTitleTrans };
    }
  }

  return { label: result, titleTrans: resolvedTitleTrans };
}

export function resolveLabel(path, columns, modelDoc, t) {
  return resolveLabelWithMeta(path, columns, modelDoc, t).label;
}
