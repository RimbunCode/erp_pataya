/**
 * Utilitas untuk mengekstrak dan membersihkan template dari editor GrapesJS.
 * Menangani penghapusan style khusus editor dan ekstraksi HTML/CSS final.
 * @module templateExportUtils
 */

import { formatHandlebarTemplate } from "./templateFormatUtils";

/**
 * Menghapus style khusus editor (.gjs-static-html-wrapper) dari CSS yang diekspor.
 * Style ini hanya digunakan untuk tampilan di canvas editor (border dashed, pseudo-element)
 * dan tidak boleh ikut tersimpan ke template final.
 * @param {string} css - String CSS mentah dari editor GrapesJS
 * @returns {string} CSS yang sudah dibersihkan dari rule wrapper editor
 */
export function stripEditorOnlyWrapperStyles(css) {
  if (typeof css !== "string" || !css.trim()) {
    return css;
  }

  // Hapus rule block .gjs-static-html-wrapper yang mengandung border dashed editor
  let cleaned = css.replace(
    /\.gjs-static-html-wrapper\s*\{[^}]*border:\s*2px\s+dashed\s+#6366f1[^}]*\}/gi,
    "",
  );

  // Hapus rule block .gjs-static-html-wrapper::before (pseudo-element label editor)
  cleaned = cleaned.replace(
    /\.gjs-static-html-wrapper::before\s*\{[^}]*\}/gi,
    "",
  );

  return cleaned;
}

/**
 * Mengekstrak template HTML dan CSS saat ini dari instance editor GrapesJS.
 * Melakukan formatting pada HTML (normalisasi token Handlebar) dan
 * membersihkan CSS dari style khusus editor sebelum dikembalikan.
 * @param {object} editor - Instance editor GrapesJS yang aktif
 * @param {object} [fallbackTemplate] - Template fallback jika editor tidak tersedia atau terjadi error
 * @param {string} [fallbackTemplate.html] - HTML fallback
 * @param {string} [fallbackTemplate.css] - CSS fallback
 * @returns {{html: string, css: string}} Objek berisi HTML dan CSS template yang sudah diproses
 */
export function getCurrentTemplateFromEditor(editor, fallbackTemplate = {}) {
  if (!editor) {
    return {
      html: fallbackTemplate?.html || "",
      css: fallbackTemplate?.css || "",
    };
  }

  try {
    const page = editor.Pages.getSelected() || editor.Pages.getAll()[0];
    const component = page?.getMainComponent?.();

    const rawCss = component ? editor.getCss({ component }) : editor.getCss();

    return {
      html: formatHandlebarTemplate(
        component ? editor.getHtml({ component }) : editor.getHtml(),
      ),
      css: stripEditorOnlyWrapperStyles(rawCss),
    };
  } catch (error) {
    console.error("Failed to extract current template", error);
    return {
      html: fallbackTemplate?.html || "",
      css: fallbackTemplate?.css || "",
    };
  }
}
