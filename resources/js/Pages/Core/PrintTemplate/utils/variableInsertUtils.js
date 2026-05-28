/**
 * Utilitas untuk membangun dan menyisipkan token variabel ke canvas editor.
 * Menangani tipe variabel: "company", "docInfo", "relation", dan "doc" (default).
 * Menyediakan fungsi-fungsi untuk membangun token, menyederhanakan tampilan,
 * membuat payload drag, dan menyisipkan token inline ke komponen teks.
 * @module variableInsertUtils
 */

import {
  encodeTokenToBase64,
  escapeAttributeValue,
  simplifyInlineDisplayToken,
} from "./variableEncodingUtils";
import { simplifyTokenDisplay } from "../Components/tokenConfigHelpers";
import { getFormattedHandlebarToken } from "./variableTokenUtils";

/**
 * Mengekstrak label key dari token Handlebar dengan menghapus pembungkus {{...}}.
 * Idempotent: jika input sudah tanpa pembungkus, dikembalikan apa adanya.
 *
 * @param {string} token - String token (bisa dengan atau tanpa pembungkus `{{...}}`)
 * @returns {string} Isi token tanpa pembungkus, atau string asli jika bukan format token
 */
export function extractLabelKeyFromToken(token) {
  if (!token || typeof token !== "string") {
    return "";
  }

  const match = token.trim().match(/^\{\{\s*(.*?)\s*\}\}$/);
  return match ? match[1] : token;
}

/**
 * Membangun string token Handlebar berdasarkan tipe dan path variabel.
 * Menentukan format token sesuai dengan tipe variabel:
 * - company → {{company.<keyName>}}
 * - docInfo → {{docInfo.<keyName>}}
 * - relation → {{relation doc.<path>}}
 * - default → {{doc.<path>}}
 *
 * @param {object} params - Parameter untuk membangun token
 * @param {string} params.variableType - Tipe variabel (company, docInfo, relation, data, dll)
 * @param {string} params.parentType - Tipe parent dari variabel (company, docInfo, dll)
 * @param {string} params.variablePath - Path lengkap variabel dalam notasi dot
 * @param {string} params.keyName - Nama key variabel (digunakan untuk company/docInfo)
 * @returns {string} String token Handlebar yang sudah diformat
 */
export function buildVariableToken({
  variableType,
  parentType,
  variablePath,
  keyName,
}) {
  // Jika tipe parent atau variabel adalah "company", gunakan format company
  if (parentType === "company" || variableType === "company") {
    return `{{company.${keyName}}}`;
  }
  // Jika tipe parent atau variabel adalah "docInfo", gunakan format docInfo
  if (parentType === "docInfo" || variableType === "docInfo") {
    return `{{docInfo.${keyName}}}`;
  }

  // Normalisasi path agar selalu dimulai dengan "doc."
  const normalizedPath = variablePath.startsWith("doc.")
    ? variablePath
    : `doc.${variablePath}`;

  // Untuk tipe relation, gunakan format "relation doc.<path>"
  if (variableType === "relation") {
    return `{{relation ${normalizedPath}}}`;
  }

  // Default: gunakan path langsung tanpa prefix tambahan
  return `{{${normalizedPath}}}`;
}

/**
 * Menyederhanakan tampilan token untuk ditampilkan di canvas editor.
 * Menangani kasus khusus:
 * - Token kosong dengan variablePath berprefix "doc." → hapus prefix
 * - Token dengan formatCurrency/formatNumber → ekstrak nama field
 * - Lainnya → delegasi ke simplifyTokenDisplay
 *
 * @param {string} token - String token Handlebar lengkap (bisa kosong)
 * @param {string} [variablePath=""] - Path variabel untuk fallback jika token kosong
 * @returns {string} Token yang disederhanakan untuk tampilan di canvas
 */
export function getSimplifiedTokenDisplay(token, variablePath = "") {
  // Jika token kosong, buat tampilan dari variablePath dengan menghapus prefix "doc."
  if (!token) {
    return variablePath ? `{{${variablePath.replace(/^doc\./, "")}}}` : "";
  }

  // Cek apakah token mengandung formatCurrency atau formatNumber
  const formattedTokenMatch = token.match(
    /\{\{\s*format(?:Currency|Number)\s+doc\.([^\s}]+)/,
  );
  if (formattedTokenMatch?.[1]) {
    return `{{${formattedTokenMatch[1]}}}`;
  }

  // Delegasi ke simplifyTokenDisplay untuk kasus lainnya
  return simplifyTokenDisplay(token);
}

/**
 * Membuat payload data untuk operasi drag variabel ke canvas editor.
 * Menggabungkan informasi variabel dengan token terformat.
 *
 * @param {object} params - Parameter untuk membuat payload
 * @param {object} params.variable - Objek variabel dengan properti name, type, dll
 * @param {Array} params.nestedColumns - Kolom-kolom nested untuk relasi
 * @param {string} params.displayLabel - Label tampilan variabel
 * @param {string} params.fullKey - Key lengkap dalam notasi dot
 * @returns {object} Payload yang siap digunakan untuk drag-and-drop
 */
export function buildVariableDragPayload({
  variable,
  nestedColumns,
  displayLabel,
  fullKey,
}) {
  return {
    ...variable,
    columns: nestedColumns,
    displayLabel,
    fullKey,
    formattedToken: getFormattedHandlebarToken(variable, fullKey),
  };
}

/**
 * Mencoba menyisipkan token variabel secara inline ke komponen teks yang sedang diedit.
 * Hanya berhasil jika komponen yang dipilih adalah tipe "text" dan sedang dalam mode edit.
 * Menggunakan execCommand untuk menyisipkan HTML span dengan atribut data variabel.
 *
 * @param {object} editor - Instance editor GrapesJS
 * @param {object} selectedComponent - Komponen yang sedang dipilih di canvas
 * @param {string} token - String token Handlebar yang akan disisipkan
 * @param {string} fullKey - Key lengkap variabel dalam notasi dot
 * @returns {boolean} True jika berhasil menyisipkan, false jika tidak memenuhi syarat
 */
export function tryInsertInlineVariableToken(
  editor,
  selectedComponent,
  token,
  fullKey,
) {
  if (!editor || !selectedComponent || !token) {
    return false;
  }

  // Periksa apakah komponen adalah tipe teks dan sedang dalam mode edit
  const isTextComponent = selectedComponent.is?.("text");
  const isTextEditingActive = editor.Commands?.isActive?.(
    "core:component-text",
  );

  if (!isTextComponent || !isTextEditingActive) {
    return false;
  }

  // Dapatkan dokumen iframe canvas untuk eksekusi insertHTML
  const iframeDocument = editor.Canvas.getDocument?.();
  if (!iframeDocument?.execCommand) {
    return false;
  }

  // Bangun HTML inline dengan atribut data untuk identifikasi variabel
  const inlinePath = fullKey.replace(/^doc\./, "");
  const displayToken = simplifyInlineDisplayToken(fullKey, token);
  const encodedToken = encodeTokenToBase64(token);
  const inlineHtml = `<span data-variable-inline="${escapeAttributeValue(inlinePath)}" data-variable-path="${escapeAttributeValue(inlinePath)}" data-token="${escapeAttributeValue(token)}" data-token-b64="${escapeAttributeValue(encodedToken)}" contenteditable="false" class="inline-variable-token">${escapeAttributeValue(displayToken)}</span>`;

  // Sisipkan HTML ke posisi kursor saat ini dalam komponen teks
  iframeDocument.execCommand("insertHTML", false, inlineHtml);
  selectedComponent.trigger("change:content");
  editor.trigger("update");

  return true;
}
