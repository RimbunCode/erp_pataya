// flattenMediaPlugin.scrubRuntime.dom.test.js
//
// Regresi: perubahan style di Style Manager tidak terlihat real-time di kanvas
// padahal Preview benar. Scrubber runtime menyunting `textContent` node <style>
// di iframe kanvas (milik GrapesJS dan Tailwind browser), sehingga CSS kanvas
// menyimpang dari model GrapesJS yang dipakai Preview. Editor print template
// memakai `editorFlattenMediaPlugin` yang tidak memasang scrubber itu.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import flattenMediaPlugin, {
  editorFlattenMediaPlugin,
} from "./flattenMediaPlugin";

function createFakeEditor({ frameEl }) {
  const listeners = {};
  const on = (event, cb) => {
    (listeners[event] ||= []).push(cb);
  };
  const off = (event, cb) => {
    listeners[event] = (listeners[event] || []).filter((fn) => fn !== cb);
  };
  return {
    Canvas: { getFrameEl: () => frameEl },
    on,
    off,
    once: (event, cb) => {
      const wrapper = (...args) => {
        off(event, wrapper);
        cb(...args);
      };
      on(event, wrapper);
    },
    trigger: (event, ...args) => {
      [...(listeners[event] || [])].forEach((cb) => cb(...args));
    },
    countListeners: (event) => (listeners[event] || []).length,
    getConfig: () => ({}),
  };
}

const MEDIA_CSS = "@media (min-width: 600px) { #box { color: red; } }";

describe("flattenMediaPlugin: opsi scrubRuntime", () => {
  let iframe;

  beforeEach(() => {
    iframe = document.createElement("iframe");
    document.body.appendChild(iframe);
  });

  afterEach(() => {
    iframe.remove();
  });

  function addStyle(css) {
    const style = iframe.contentDocument.createElement("style");
    style.textContent = css;
    iframe.contentDocument.head.appendChild(style);
    return style;
  }

  it("scrubRuntime:false tidak menyentuh <style> kanvas saat 'load'", () => {
    const style = addStyle(MEDIA_CSS);
    const editor = createFakeEditor({ frameEl: iframe });

    flattenMediaPlugin(editor, { scrubRuntime: false });
    editor.trigger("load");

    expect(style.textContent).toBe(MEDIA_CSS);
  });

  it("scrubRuntime:false membiarkan <style> baru dan event style tetap utuh", async () => {
    const editor = createFakeEditor({ frameEl: iframe });
    flattenMediaPlugin(editor, { scrubRuntime: false });
    editor.trigger("load");

    const style = addStyle(MEDIA_CSS);
    editor.trigger("component:styleUpdate");
    editor.trigger("styleManager:change");
    editor.trigger("change:device");
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(style.textContent).toBe(MEDIA_CSS);
  });

  it("scrubRuntime:false tidak memasang listener style apa pun", () => {
    const editor = createFakeEditor({ frameEl: iframe });

    flattenMediaPlugin(editor, { scrubRuntime: false });
    editor.trigger("load");

    expect(editor.countListeners("component:styleUpdate")).toBe(0);
    expect(editor.countListeners("styleManager:change")).toBe(0);
    expect(editor.countListeners("change:device")).toBe(0);
    expect(editor.countListeners("canvas:frame:load")).toBe(0);
  });

  it("default (scrubRuntime true) tetap men-scrub seperti sebelumnya", () => {
    const style = addStyle(MEDIA_CSS);
    const editor = createFakeEditor({ frameEl: iframe });

    flattenMediaPlugin(editor);
    editor.trigger("load");

    expect(style.textContent).not.toContain("@media");
  });

  it("editorFlattenMediaPlugin (dipakai Editor) tidak men-scrub kanvas", async () => {
    const style = addStyle(MEDIA_CSS);
    const editor = createFakeEditor({ frameEl: iframe });

    editorFlattenMediaPlugin(editor);
    editor.trigger("load");
    editor.trigger("component:styleUpdate");
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(style.textContent).toBe(MEDIA_CSS);
  });
});
