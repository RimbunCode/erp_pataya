/**
 * Utilitas untuk memformat dan mengelola token variabel Handlebar.
 * Menyediakan fungsi-fungsi helper untuk memformat nilai kolom,
 * menghasilkan token Handlebar, dan menampilkan label variabel.
 * @module variableTokenUtils
 */

import { formatValue } from "@/Components/CurrencyInput";

/**
 * Memformat nilai berdasarkan tipe kolom dan opsi format dari DataTableColumns.
 * Mendukung tipe "currency" (format mata uang) dan "numeric"/"number" (format angka desimal).
 *
 * @param {number|string|null} value - Nilai yang akan diformat
 * @param {object} column - Definisi kolom dari DataTableColumns
 * @returns {string} Nilai yang sudah diformat atau string asli
 */
export function formatColumnValue(value, column) {
  if (value == null || value === "") return "";

  const type = column?.type;
  const decimalScale = column?.decimalScale ?? column?.formatOptions?.decimals;
  const currency = column?.currency ?? column?.formatOptions?.currency ?? "IDR";

  // Format sebagai mata uang menggunakan Intl.NumberFormat
  if (type === "currency") {
    try {
      const numericValue =
        typeof value === "number" ? value.toString() : String(value);
      return formatValue({
        value: numericValue,
        intlConfig: {
          locale: "id",
          currency: currency,
        },
      });
    } catch {
      return String(value);
    }
  }

  // Format sebagai angka desimal dengan jumlah digit tertentu
  if (type === "numeric" || type === "number") {
    try {
      const numericValue =
        typeof value === "string" ? parseFloat(value) : Number(value);
      if (isNaN(numericValue)) return String(value);

      const decimals = typeof decimalScale === "number" ? decimalScale : 0;
      return formatValue({
        value: numericValue.toFixed(decimals),
        intlConfig: {
          locale: "id",
        },
        decimalScale: decimals,
      });
    } catch {
      return String(value);
    }
  }

  return String(value);
}

/**
 * Menghasilkan token Handlebar untuk variabel, membungkus dengan helper format
 * jika tipe kolom adalah currency atau numeric/number.
 *
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
 *
 * @param {string} type - Tipe kolom dari DataTableColumns
 * @returns {boolean} True jika tipe memerlukan pemformatan
 */
export function isFormattableType(type) {
  return type === "currency" || type === "numeric" || type === "number";
}

/**
 * Mengambil nilai contoh dari data example menggunakan path notasi dot.
 *
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
 *
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
 *
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
