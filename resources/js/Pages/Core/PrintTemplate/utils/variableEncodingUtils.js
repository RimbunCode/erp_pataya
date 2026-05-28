/**
 * Utilitas encoding dan escaping untuk token variabel inline.
 * Menyediakan fungsi-fungsi untuk mengkonversi token ke Base64,
 * meng-escape karakter khusus HTML, dan menyederhanakan tampilan token.
 * @module variableEncodingUtils
 */

import { simplifyTokenDisplay } from "../Components/tokenConfigHelpers";

/**
 * Mengkonversi string token menjadi representasi Base64.
 * Menggunakan TextEncoder untuk mendukung karakter Unicode dengan benar.
 *
 * @param {string} token - String token yang akan di-encode ke Base64
 * @returns {string} String hasil encoding Base64, atau string kosong jika gagal
 */
export function encodeTokenToBase64(token) {
  if (!token || typeof window === "undefined") {
    return "";
  }

  try {
    const bytes = new TextEncoder().encode(token);
    const binary = String.fromCharCode(...bytes);
    return window.btoa(binary);
  } catch {
    return "";
  }
}

/**
 * Meng-escape karakter khusus HTML dalam nilai atribut.
 * Mencegah XSS dan memastikan nilai aman untuk digunakan dalam atribut HTML.
 *
 * @param {string} value - Nilai yang akan di-escape (default: string kosong)
 * @returns {string} Nilai yang sudah di-escape dengan entity HTML
 */
export function escapeAttributeValue(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Menyederhanakan tampilan token inline untuk ditampilkan di canvas editor.
 * Jika token tersedia, gunakan fungsi simplifyTokenDisplay dari tokenConfigHelpers.
 * Jika tidak, buat tampilan sederhana dari fullKey dengan menghapus prefix "doc.".
 *
 * @param {string} fullKey - Key lengkap variabel (misal: "doc.customer_name")
 * @param {string} token - String token Handlebar lengkap (misal: "{{doc.customer_name}}")
 * @returns {string} Token yang disederhanakan untuk tampilan di canvas
 */
export function simplifyInlineDisplayToken(fullKey = "", token = "") {
  // Jika token tersedia, gunakan fungsi canonical simplifyTokenDisplay
  if (token) {
    return simplifyTokenDisplay(token);
  }
  return `{{${fullKey.replace(/^doc\./, "")}}}`;
}
