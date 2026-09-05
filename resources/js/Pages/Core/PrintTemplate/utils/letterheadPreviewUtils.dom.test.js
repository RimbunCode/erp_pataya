import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { mountLetterheadPreview } from "./letterheadPreviewUtils";

function createFakeEditor(frame, wrapperEl) {
  const listeners = {};
  return {
    Canvas: { getFrameEl: () => frame },
    getWrapper: () => ({ view: { el: wrapperEl } }),
    on: (event, cb) => {
      listeners[event] = cb;
    },
    _trigger: (event) => listeners[event]?.(),
  };
}

describe("mountLetterheadPreview", () => {
  let iframe;
  let wrapperEl;

  beforeEach(() => {
    iframe = document.createElement("iframe");
    document.body.appendChild(iframe);
    wrapperEl = iframe.contentDocument.createElement("div");
    iframe.contentDocument.body.appendChild(wrapperEl);
  });

  afterEach(() => {
    iframe.remove();
  });

  it("menyisipkan <style> dan <div id=letterhead-preview> ke dalam iframe", () => {
    const editor = createFakeEditor(iframe, wrapperEl);

    mountLetterheadPreview(editor, {
      html: "<p>Letterhead</p>",
      css: ".x { color: red; }",
    });

    const doc = iframe.contentDocument;
    const style = doc.getElementById("letterhead-preview-style");
    const preview = doc.getElementById("letterhead-preview");

    expect(style.innerHTML).toBe(".x { color: red; }");
    expect(preview.innerHTML).toBe("<p>Letterhead</p>");
  });

  it("preview disisipkan SEBELUM wrapper element (di atasnya)", () => {
    const editor = createFakeEditor(iframe, wrapperEl);
    mountLetterheadPreview(editor, { html: "<p>x</p>", css: "" });

    const doc = iframe.contentDocument;
    const preview = doc.getElementById("letterhead-preview");
    expect(preview.nextElementSibling).toBe(wrapperEl);
  });

  it("tanpa html maupun css, tidak memasang preview sama sekali", () => {
    const editor = createFakeEditor(iframe, wrapperEl);
    mountLetterheadPreview(editor, { html: "", css: "" });

    const doc = iframe.contentDocument;
    expect(doc.getElementById("letterhead-preview")).toBeNull();
    expect(doc.getElementById("letterhead-preview-style")).toBeNull();
  });

  it("memasang ulang: elemen preview lama dihapus sebelum yang baru disisipkan (tidak duplikat)", () => {
    const editor = createFakeEditor(iframe, wrapperEl);
    mountLetterheadPreview(editor, { html: "<p>Versi 1</p>", css: "" });
    mountLetterheadPreview(editor, { html: "<p>Versi 2</p>", css: "" });

    const doc = iframe.contentDocument;
    expect(doc.querySelectorAll("#letterhead-preview")).toHaveLength(1);
    expect(doc.getElementById("letterhead-preview").innerHTML).toBe(
      "<p>Versi 2</p>",
    );
  });

  it("mendaftarkan listener 'load' yang memasang ulang preview saat dipicu", () => {
    const editor = createFakeEditor(iframe, wrapperEl);
    mountLetterheadPreview(editor, { html: "<p>Awal</p>", css: "" });

    // Simulasikan editor reload: hapus manual lalu trigger 'load'.
    iframe.contentDocument.getElementById("letterhead-preview").remove();
    editor._trigger("load");

    expect(
      iframe.contentDocument.getElementById("letterhead-preview"),
    ).not.toBeNull();
  });

  it("frame belum tersedia (getFrameEl null) tidak crash", () => {
    const editor = createFakeEditor(null, wrapperEl);
    expect(() =>
      mountLetterheadPreview(editor, { html: "<p>x</p>", css: "" }),
    ).not.toThrow();
  });

  it("wrapper element belum tersedia tidak crash", () => {
    const editor = createFakeEditor(iframe, undefined);
    expect(() =>
      mountLetterheadPreview(editor, { html: "<p>x</p>", css: "" }),
    ).not.toThrow();
  });
});
