/**
 * Fungsi-fungsi helper murni untuk Editor PrintTemplate.
 * Berisi utilitas kalkulasi lebar sidebar, resolusi unit template,
 * parsing nilai numerik, dan validasi sintaks Handlebar.
 * @module editorHelpers
 */

import Handlebars from "handlebars";

/** @type {number} Lebar default sidebar dalam piksel */
export const SIDEBAR_DEFAULT_WIDTH = 320;

/** @type {number} Lebar minimum sidebar dalam piksel */
export const SIDEBAR_MIN_WIDTH = 280;

/** @type {number} Lebar maksimum sidebar dalam piksel */
export const SIDEBAR_MAX_WIDTH = 520;

/**
 * Membatasi lebar sidebar agar tetap dalam rentang minimum dan maksimum.
 * Jika nilai bukan angka valid, mengembalikan lebar default.
 * @param {number} width - Lebar yang ingin di-set (dalam piksel)
 * @returns {number} Lebar yang sudah dibatasi dalam rentang [SIDEBAR_MIN_WIDTH, SIDEBAR_MAX_WIDTH]
 */
export function clampSidebarWidth(width) {
  const numericWidth = Number(width);
  if (!Number.isFinite(numericWidth)) {
    return SIDEBAR_DEFAULT_WIDTH;
  }

  return Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, numericWidth));
}

/**
 * Menentukan kode unit pengukuran dari objek printTemplate.
 * Mendukung format unit berupa string langsung atau objek dengan properti `code`.
 * Jika unit tidak valid atau kosong, mengembalikan "mm" sebagai default.
 * @param {Object} printTemplate - Objek konfigurasi print template
 * @param {string|Object} [printTemplate.unit] - Unit pengukuran (string atau objek {code: string})
 * @returns {string} Kode unit pengukuran (contoh: "mm", "cm", "in", "px")
 */
export function resolveTemplateUnitCode(printTemplate) {
  const rawUnit =
    typeof printTemplate?.unit === "string"
      ? printTemplate.unit
      : printTemplate?.unit?.code;

  // Jika unit bukan string valid atau kosong, gunakan "mm" sebagai fallback
  if (typeof rawUnit !== "string" || !rawUnit.trim()) {
    return "mm";
  }

  return rawUnit.trim();
}

/**
 * Mengkonversi nilai ke angka, mengembalikan fallback jika konversi gagal.
 * Berguna untuk parsing dimensi halaman (width, height, margin) dari konfigurasi template.
 * @param {*} value - Nilai yang akan dikonversi ke angka
 * @param {number} fallbackValue - Nilai default jika konversi gagal (NaN, Infinity, dll)
 * @returns {number} Nilai numerik hasil konversi atau fallbackValue
 */
export function parseNumericValue(value, fallbackValue) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallbackValue;
}

/**
 * Memvalidasi sintaks template Handlebar.
 * Menggunakan Handlebars.parse() untuk memeriksa apakah template memiliki sintaks yang benar.
 * @param {string} [template=""] - String template Handlebar yang akan divalidasi
 * @returns {{valid: boolean, message: string}} Objek hasil validasi dengan status dan pesan error
 */
export function validateHandlebarTemplate(template = "") {
  try {
    Handlebars.parse(template || "");
    return { valid: true, message: "" };
  } catch (error) {
    return {
      valid: false,
      message: error?.message || "Handlebar syntax error",
    };
  }
}
