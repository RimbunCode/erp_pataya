/**
 * Utilitas untuk menampilkan preview letterhead di canvas editor.
 * Menangani penyisipan elemen HTML dan CSS letterhead ke dalam iframe canvas GrapesJS,
 * serta pembersihan elemen preview sebelumnya sebelum memasang yang baru.
 * @module letterheadPreviewUtils
 */

/**
 * Memasang preview letterhead (HTML + CSS) ke dalam canvas editor GrapesJS.
 * Preview ditempatkan sebelum wrapper editor agar tampil sebagai latar belakang
 * di bagian atas halaman. Fungsi ini juga mendaftarkan listener "load" agar
 * preview otomatis dipasang ulang saat editor dimuat ulang.
 *
 * @param {object} editor - Instance editor GrapesJS
 * @param {object} options - Opsi konfigurasi letterhead
 * @param {string} options.html - Markup HTML letterhead yang akan ditampilkan
 * @param {string} options.css - Style CSS untuk letterhead
 * @returns {void}
 */
export function mountLetterheadPreview(editor, { html, css }) {
  const addPreview = () => {
    const frame = editor.Canvas.getFrameEl();
    if (!frame) {
      return;
    }

    const doc = frame.contentDocument || frame.contentWindow.document;
    if (!doc) {
      return;
    }

    const wrapperEl = editor.getWrapper().view?.el;
    if (!wrapperEl) {
      return;
    }

    // Jika tidak ada HTML maupun CSS, tidak perlu memasang preview
    if (!html && !css) {
      return;
    }

    // Hapus elemen style letterhead sebelumnya untuk menghindari duplikasi
    const previousStyle = doc.getElementById("letterhead-preview-style");
    if (previousStyle) {
      previousStyle.remove();
    }

    // Hapus elemen preview letterhead sebelumnya
    const previousPreview = doc.getElementById("letterhead-preview");
    if (previousPreview) {
      previousPreview.remove();
    }

    // Sisipkan style CSS letterhead ke dalam <head> iframe
    const styleEl = doc.createElement("style");
    styleEl.id = "letterhead-preview-style";
    styleEl.innerHTML = css || "";
    doc.head.appendChild(styleEl);

    // Buat container preview letterhead dengan pengaturan non-interaktif
    const box = doc.createElement("div");
    box.id = "letterhead-preview";
    box.style.position = "relative";
    box.style.pointerEvents = "none";
    box.style.zIndex = "1";
    box.style.userSelect = "none";
    box.setAttribute("contenteditable", "false");

    // Masukkan HTML letterhead dan tempatkan sebelum wrapper editor
    box.innerHTML = html || "";
    doc.body.insertBefore(box, wrapperEl);
  };

  // Daftarkan listener agar preview dipasang ulang saat editor dimuat
  editor.on("load", addPreview);
  addPreview();
}
