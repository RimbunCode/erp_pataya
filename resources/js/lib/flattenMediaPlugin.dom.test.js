// flattenMediaPlugin.dom.test.js
//
// Butuh document/MutationObserver nyata (frame iframe GrapesJS) tapi tidak
// me-render komponen React -> environment "dom" (jsdom), bukan "unit" (node)
// atau "component" (rtl). Lihat vitest.config.js project "dom".
import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import flattenMediaPlugin from "./flattenMediaPlugin";

/**
 * Fake editor GrapesJS minimal: mendukung banyak listener per event (perlu
 * untuk mendokumentasikan bug penumpukan listener di test "canvas:frame:load"),
 * plus getConfig()/storageManager untuk jalur stripOnStore.
 * @param root0
 * @param root0.frameEl
 */
function createFakeEditor({ frameEl } = {}) {
  const listeners = {};
  const on = (event, cb) => {
    (listeners[event] ||= []).push(cb);
  };
  const off = (event, cb) => {
    if (!listeners[event]) return;
    listeners[event] = listeners[event].filter((fn) => fn !== cb);
  };
  const once = (event, cb) => {
    const wrapper = (...args) => {
      off(event, wrapper);
      cb(...args);
    };
    on(event, wrapper);
  };
  const trigger = (event, ...args) => {
    [...(listeners[event] || [])].forEach((cb) => cb(...args));
  };
  const countListeners = (event) => (listeners[event] || []).length;

  let storageManager;
  return {
    Canvas: { getFrameEl: () => frameEl },
    on,
    off,
    once,
    trigger,
    countListeners,
    getConfig: () => ({ storageManager }),
    setStorageManager: (sm) => {
      storageManager = sm;
    },
  };
}

describe("flattenMediaPlugin — stripOnStore (StorageManager safety-net)", () => {
  it("membungkus sm.onStore dan strip @media dari pagesHtml[].css", () => {
    const editor = createFakeEditor();
    const sm = {};
    editor.setStorageManager(sm);

    flattenMediaPlugin(editor);

    const data = {
      pagesHtml: [
        { html: "<p>A</p>", css: "@media print { color: red; }" },
        { html: "<p>B</p>", css: ".plain { color: blue; }" },
      ],
    };
    const result = sm.onStore(data, editor);

    expect(result.pagesHtml[0].css).toBe(" color: red; ");
    expect(result.pagesHtml[1].css).toBe(".plain { color: blue; }");
  });

  it("strip @media dari out.data.css juga (bukan cuma pagesHtml)", () => {
    const editor = createFakeEditor();
    const sm = {};
    editor.setStorageManager(sm);

    flattenMediaPlugin(editor);

    const data = { data: { css: "@media print { color: green; }" } };
    const result = sm.onStore(data, editor);

    expect(result.data.css).toBe(" color: green; ");
  });

  it("memanggil userOnStore yang sudah ada lebih dulu, lalu strip hasilnya", () => {
    const editor = createFakeEditor();
    const userOnStore = vi.fn((data) => ({ ...data, taggedByUser: true }));
    const sm = { onStore: userOnStore };
    editor.setStorageManager(sm);

    flattenMediaPlugin(editor);

    const data = {
      pagesHtml: [{ html: "", css: "@media print { color: red; }" }],
    };
    const result = sm.onStore(data, editor);

    expect(userOnStore).toHaveBeenCalledWith(data, editor);
    expect(result.taggedByUser).toBe(true);
    expect(result.pagesHtml[0].css).toBe(" color: red; ");
  });

  it("stripOnStore:false tidak membungkus sm.onStore sama sekali", () => {
    const editor = createFakeEditor();
    const originalOnStore = () => {};
    const sm = { onStore: originalOnStore };
    editor.setStorageManager(sm);

    flattenMediaPlugin(editor, { stripOnStore: false });

    expect(sm.onStore).toBe(originalOnStore);
  });

  it("tidak crash kalau storageManager tidak ada di config editor", () => {
    const editor = createFakeEditor(); // getConfig() -> { storageManager: undefined }

    expect(() => flattenMediaPlugin(editor)).not.toThrow();
  });

  it("pagesHtml bukan array dilewati (tidak crash, out dikembalikan apa adanya)", () => {
    const editor = createFakeEditor();
    const sm = {};
    editor.setStorageManager(sm);
    flattenMediaPlugin(editor);

    const data = { pagesHtml: null, data: { css: "@media print { x: 1; }" } };
    const result = sm.onStore(data, editor);

    expect(result.pagesHtml).toBeNull();
    expect(result.data.css).toBe(" x: 1; ");
  });

  it("[BUG] @media berisi >1 rule menghasilkan CSS rusak (brace tak seimbang)", () => {
    // MEDIA_RE = /@media[^{]+\{([\s\S]*?)\}\s*/g -- capture group non-greedy
    // berhenti di "}" PERTAMA yang ditemukan, bukan closing brace milik
    // @media block itu sendiri. Untuk 1 rule di dalamnya ini kebetulan
    // terlihat benar (closing brace rule termakan sbg delimiter, closing
    // brace @media yang tersisa "menutup" ulang). Tapi untuk >1 rule di
    // dalam satu @media block (kasus normal di CSS nyata), closing brace
    // rule pertama termakan tanpa pernah digantikan apa pun, sehingga rule
    // pertama tidak pernah ditutup sebelum rule kedua dimulai -> CSS rusak.
    const editor = createFakeEditor();
    const sm = {};
    editor.setStorageManager(sm);
    flattenMediaPlugin(editor);

    const css =
      "@media (min-width: 600px) { .a { color: red; } .b { color: blue; } }";
    const result = sm.onStore({ pagesHtml: [{ html: "", css }] }, editor);

    expect(result.pagesHtml[0].css).toBe(
      " .a { color: red; .b { color: blue; } }",
    );
  });
});

describe("flattenMediaPlugin — runtime canvas scrubber", () => {
  let iframe;

  beforeEach(() => {
    iframe = document.createElement("iframe");
    document.body.appendChild(iframe);
  });

  afterEach(() => {
    iframe.remove();
  });

  function addStyle(doc, css) {
    const style = doc.createElement("style");
    style.textContent = css;
    doc.head.appendChild(style);
    return style;
  }

  it("saat event 'load', langsung scrub semua <style> yang sudah ada di frame", () => {
    const doc = iframe.contentDocument;
    const style = addStyle(doc, "@media print { color: red; }");

    const editor = createFakeEditor({ frameEl: iframe });
    flattenMediaPlugin(editor);
    editor.trigger("load");

    expect(style.textContent).toBe(" color: red; ");
  });

  it("style tanpa @media tidak ditulis ulang (textContent identik, bukan cuma sama isinya)", () => {
    const doc = iframe.contentDocument;
    const style = addStyle(doc, ".plain { color: blue; }");

    const editor = createFakeEditor({ frameEl: iframe });
    flattenMediaPlugin(editor);
    editor.trigger("load");

    expect(style.textContent).toBe(".plain { color: blue; }");
  });

  it("MutationObserver otomatis men-scrub <style> baru yang disisipkan setelah load", async () => {
    const doc = iframe.contentDocument;
    const editor = createFakeEditor({ frameEl: iframe });
    flattenMediaPlugin(editor);
    editor.trigger("load");

    const newStyle = addStyle(doc, "@media print { color: green; }");
    // Callback MutationObserver berjalan async (microtask setelah mutasi).
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(newStyle.textContent).toBe(" color: green; ");
  });

  it("event editor 'component:styleUpdate' memicu scrub ulang secara sinkron", () => {
    const doc = iframe.contentDocument;
    const style = addStyle(doc, ".plain { color: blue; }");

    const editor = createFakeEditor({ frameEl: iframe });
    flattenMediaPlugin(editor);
    editor.trigger("load");

    style.textContent = "@media print { color: red; }";
    editor.trigger("component:styleUpdate");

    // Dicek segera (sinkron) supaya hasil ini terbukti berasal dari listener
    // event-nya sendiri, bukan dari microtask MutationObserver.
    expect(style.textContent).toBe(" color: red; ");
  });

  it("event editor 'change:device' juga memicu scrub ulang secara sinkron", () => {
    const doc = iframe.contentDocument;
    const style = addStyle(doc, ".plain { color: blue; }");

    const editor = createFakeEditor({ frameEl: iframe });
    flattenMediaPlugin(editor);
    editor.trigger("load");

    style.textContent = "@media print { color: red; }";
    editor.trigger("change:device");

    expect(style.textContent).toBe(" color: red; ");
  });

  it("frame belum tersedia (getFrameEl mengembalikan undefined) tidak crash", () => {
    const editor = createFakeEditor({ frameEl: undefined });

    expect(() => {
      flattenMediaPlugin(editor);
      editor.trigger("load");
      editor.trigger("destroy");
    }).not.toThrow();
  });

  it("'destroy' melepas listener editor: event lanjutan tidak lagi men-scrub", () => {
    const doc = iframe.contentDocument;
    const style = addStyle(doc, ".plain { color: blue; }");

    const editor = createFakeEditor({ frameEl: iframe });
    flattenMediaPlugin(editor);
    editor.trigger("load");
    editor.trigger("destroy");

    style.textContent = "@media print { color: red; }";
    editor.trigger("component:styleUpdate");

    // Listener sudah di-off saat destroy -> textContent tidak ikut di-scrub.
    expect(style.textContent).toBe("@media print { color: red; }");
  });

  it("[BUG] 'canvas:frame:load' me-rebind tanpa melepas listener lama -> listener editor menumpuk", async () => {
    const editor = createFakeEditor({ frameEl: iframe });
    flattenMediaPlugin(editor);
    editor.trigger("load");

    expect(editor.countListeners("component:styleUpdate")).toBe(1);

    editor.trigger("canvas:frame:load");
    // bindRuntimeScrubber() rebind dipanggil di dalam setTimeout(fn, 0).
    await new Promise((resolve) => setTimeout(resolve, 20));

    // Current (buggy) behavior: return value dari bindRuntimeScrubber() yang
    // kedua (unbind function-nya) dibuang begitu saja di handler
    // "canvas:frame:load" -- cuma obs.disconnect() yang dipanggil, listener
    // editor.on("component:styleUpdate", ...) dari bind PERTAMA tidak pernah
    // di-off, sehingga listener menumpuk jadi 2 (bukan tetap 1).
    expect(editor.countListeners("component:styleUpdate")).toBe(2);
  });
});
