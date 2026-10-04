/**
 * Pembangun HTML slot tanda tangan untuk helper Handlebars
 * `{{approvalSignature}}`.
 *
 * Kembaran sisi klien dari
 * `PrintTemplateRenderService::buildSignatureHtml()`. Keduanya HARUS
 * menghasilkan markup identik untuk data yang sama: pratinjau editor dan PDF
 * hasil render server dibangun lewat jalur yang berbeda, dan perbedaan
 * apa pun di sini muncul sebagai pratinjau yang berbohong.
 *
 * Data tanda tangan tidak dihitung di sini melainkan diresolusi server dan
 * dikirim sebagai prop `approvalSignature` (berkasnya tidak publik dan harus
 * dibaca dari storage sebagai data URI).
 */

const PLACEHOLDER_IMAGE =
  "data:image/svg+xml;base64," +
  btoa(
    '<svg xmlns="http://www.w3.org/2000/svg" width="180" height="70">' +
      '<path d="M10 50 C40 10, 60 60, 90 30 S140 15, 170 45" ' +
      'fill="none" stroke="#334155" stroke-width="3" stroke-linecap="round"/>' +
      "</svg>",
  );

/**
 * Data tanda tangan contoh untuk pratinjau template yang belum terikat
 * dokumen nyata. Tanpa ini perancang template melihat slot kosong dan tidak
 * bisa menilai tata letaknya.
 */
export const EXAMPLE_SIGNATURE = {
  image: PLACEHOLDER_IMAGE,
  name: "Contoh Penyetuju",
  date: "1 Januari 2026",
  hasSignature: true,
};

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function line(value) {
  return `<span style="display:block;">${escapeHtml(value)}</span>`;
}

/**
 * Susun HTML slot tanda tangan.
 * @param {{image: string|null, name: string|null, date: string|null, hasSignature: boolean}|null} signature
 * @param {{showName?: boolean, showDate?: boolean, previewAlt?: string}} options
 * @returns {string} HTML, atau string kosong bila tidak ada yang ditampilkan.
 */
export function buildSignatureHtml(signature, options = {}) {
  if (!signature) return "";

  const showName = Boolean(options.showName);
  const showDate = Boolean(options.showDate);
  const previewAlt = options.previewAlt ?? "Pratinjau tanda tangan";

  const parts = [];

  if (signature.hasSignature) {
    parts.push(
      `<img src="${escapeHtml(signature.image)}" alt="${escapeHtml(previewAlt)}" style="max-height:80px;display:block;" />`,
    );
  } else if (signature.name != null) {
    // Fallback: nama DAN tanggal, tanpa memandang showName/showDate. Tanpa
    // gambar, tidak ada apa pun yang menandai siapa yang menyetujui dan
    // kapan, jadi slot kosong bukan pilihan.
    parts.push(line(signature.name));
    if (signature.date != null) parts.push(line(signature.date));

    return `<div class="approval-signature">${parts.join("")}</div>`;
  }

  if (showName && signature.name != null) parts.push(line(signature.name));
  if (showDate && signature.date != null) parts.push(line(signature.date));

  if (parts.length === 0) return "";

  return `<div class="approval-signature">${parts.join("")}</div>`;
}
