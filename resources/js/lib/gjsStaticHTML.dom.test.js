/**
 * Tests for gjsStaticHTML — GrapesJS "Static HTML" component plugin.
 *
 * The plugin's only export is the registration function `gjsStaticHTML(editor)`.
 * All real logic (model.init/setCustomHTML/toHTML, view.onRender/
 * disableChildContentEditable, the "load" style-injector, and the
 * component:dblclick / component:add handlers) lives as closures/methods
 * passed into `editor.Components.addType(...)`, `editor.Blocks.add(...)` and
 * `editor.on(...)`. To exercise them we build a minimal fake GrapesJS
 * `editor` that records what it's called with, then invoke the captured
 * functions directly against fake model/view contexts — the same style
 * used by gjsRelationsTable.customMode.unit.test.js for GrapesJS internals.
 *
 * Environment: jsdom (`.dom.test.js`) — the source touches real DOM APIs
 * (frame.contentDocument, doc.createElement, el.innerHTML,
 * el.querySelectorAll) and setCustomHTML() calls the real `sanitizeHTML()`,
 * which itself requires `DOMParser`. Neither renders a React component, so
 * this is not an `.rtl.test.jsx` case.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import gjsStaticHTML from "./gjsStaticHTML";

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

/**
 * Minimal fake GrapesJS editor. Records every `on()` handler, every
 * `trigger()` call, and every `Components.addType()` / `Blocks.add()`
 * registration so tests can retrieve and invoke them directly.
 */
function createMockEditor() {
  const handlers = {};
  const triggered = [];
  const componentTypes = {};
  const blocks = {};
  let frameEl = null;

  return {
    on(event, cb) {
      if (!handlers[event]) handlers[event] = [];
      handlers[event].push(cb);
    },
    trigger(event, ...args) {
      triggered.push({ event, args });
    },
    Components: {
      addType(type, definition) {
        componentTypes[type] = definition;
      },
    },
    Blocks: {
      add(id, definition) {
        blocks[id] = definition;
      },
    },
    Canvas: {
      getFrameEl: () => frameEl,
    },
    setFrameEl(el) {
      frameEl = el;
    },
    _handlers: handlers,
    _triggered: triggered,
    _componentTypes: componentTypes,
    _blocks: blocks,
  };
}

/**
 * Minimal Backbone-like fake model: get/set backed by a plain object.
 * @param initialAttrs
 */
function createFakeModel(initialAttrs = {}) {
  const attrs = { ...initialAttrs };
  const triggeredEvents = [];
  const resetSpy = vi.fn();

  return {
    get: (key) => attrs[key],
    set: (key, value) => {
      attrs[key] = value;
    },
    trigger: (event) => {
      triggeredEvents.push(event);
    },
    components: vi.fn(() => ({ reset: resetSpy })),
    _attrs: attrs,
    _triggeredEvents: triggeredEvents,
    _resetSpy: resetSpy,
  };
}

function createFakeComponent(attrs) {
  return { get: (key) => attrs[key] };
}

// ---------------------------------------------------------------------------
// Shared setup
// ---------------------------------------------------------------------------

let editor;
let definition;

beforeEach(() => {
  editor = createMockEditor();
  gjsStaticHTML(editor);
  definition = editor._componentTypes.staticHTML;
});

// ---------------------------------------------------------------------------
// Component type registration
// ---------------------------------------------------------------------------

describe("gjsStaticHTML — component type registration", () => {
  it("registers the 'staticHTML' component type", () => {
    expect(definition).toBeDefined();
    expect(typeof definition.model.init).toBe("function");
    expect(typeof definition.model.setCustomHTML).toBe("function");
    expect(typeof definition.model.toHTML).toBe("function");
  });

  it("sets non-editable, non-droppable, layerable/selectable/hoverable defaults", () => {
    const d = definition.model.defaults;
    expect(d.tagName).toBe("div");
    expect(d.droppable).toBe(false);
    expect(d.editable).toBe(false);
    expect(d.layerable).toBe(true);
    expect(d.selectable).toBe(true);
    expect(d.hoverable).toBe(true);
  });

  it("tags the wrapper element with the staticHTML marker attributes", () => {
    const attrs = definition.model.defaults.attributes;
    expect(attrs.class).toBe("gjs-static-html-wrapper");
    expect(attrs["data-gjs-type"]).toBe("staticHTML");
  });

  it("initializes customHTML/sanitizedHTML/warnings/traits empty", () => {
    const d = definition.model.defaults;
    expect(d.customHTML).toBe("");
    expect(d.sanitizedHTML).toBe("");
    expect(d.sanitizationWarnings).toEqual([]);
    expect(d.traits).toEqual([]);
  });

  it("includes only the (print-safe) placeholder styles in the exported defaults.styles", () => {
    const styles = definition.model.defaults.styles;
    expect(styles).toContain(".gjs-static-html-placeholder");
    // Editor-only border/badge styles must NOT be part of the exported CSS
    // (Requirements 24.3/24.4) — they're injected into the canvas iframe only.
    expect(styles).not.toContain("::before");
  });
});

// ---------------------------------------------------------------------------
// Block registration
// ---------------------------------------------------------------------------

describe("gjsStaticHTML — block registration", () => {
  it("registers the 'staticHTML' block in the Basic category", () => {
    const block = editor._blocks.staticHTML;
    expect(block).toBeDefined();
    expect(block.label).toBe("Custom HTML");
    expect(block.category).toBe("Basic");
    expect(block.content).toEqual({ type: "staticHTML" });
    expect(block.activate).toBe(true);
    expect(block.media).toContain("<svg");
  });
});

// ---------------------------------------------------------------------------
// model.init()
// ---------------------------------------------------------------------------

describe("model.init()", () => {
  it("renders the saved sanitizedHTML directly when present", () => {
    const model = createFakeModel({
      sanitizedHTML: "<p>Saved</p>",
      customHTML: "<p>Saved</p>",
    });

    definition.model.init.call(model);

    expect(model.get("content")).toBe("<p>Saved</p>");
  });

  it("shows the placeholder for a fresh component (no sanitizedHTML, no customHTML)", () => {
    const model = createFakeModel({});

    definition.model.init.call(model);

    expect(model.get("content")).toContain("gjs-static-html-placeholder");
    expect(model.get("content")).toContain("Custom HTML Block");
  });

  it("[BUG] leaves content unset when customHTML is present but sanitizedHTML is falsy", () => {
    // Documents current behavior: init() only falls back to the placeholder
    // when customHTML is ALSO empty. A component whose customHTML survived
    // but sanitizedHTML did not (e.g. legacy/partial saved data) ends up
    // with no `content` attribute at all, so the view renders nothing —
    // not even the placeholder. See bugFindings in the test report.
    const model = createFakeModel({
      sanitizedHTML: "",
      customHTML: "<p>legacy content</p>",
    });

    definition.model.init.call(model);

    expect(model.get("content")).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// model.setCustomHTML()
// ---------------------------------------------------------------------------

describe("model.setCustomHTML()", () => {
  it("stores raw + sanitized HTML, updates content, resets children, and triggers change:content", () => {
    const model = createFakeModel();

    const result = definition.model.setCustomHTML.call(model, "<p>Hello</p>");

    expect(model.get("customHTML")).toBe("<p>Hello</p>");
    expect(model.get("sanitizedHTML")).toBe("<p>Hello</p>");
    expect(model.get("content")).toBe("<p>Hello</p>");
    expect(model._resetSpy).toHaveBeenCalledTimes(1);
    expect(model._triggeredEvents).toContain("change:content");
    expect(result.sanitizedHTML).toBe("<p>Hello</p>");
  });

  it("strips dangerous tags via the real sanitizer and records a warning", () => {
    const model = createFakeModel();

    const result = definition.model.setCustomHTML.call(
      model,
      "<p>Hi</p><script>alert(1)</script>",
    );

    expect(model.get("sanitizedHTML")).not.toContain("<script>");
    expect(model.get("sanitizationWarnings")).toEqual(result.warnings);
    expect(result.warnings.some((w) => w.includes("script"))).toBe(true);
    // Raw (unsanitized) HTML is preserved verbatim in customHTML.
    expect(model.get("customHTML")).toBe("<p>Hi</p><script>alert(1)</script>");
  });

  it("falls back to the placeholder content when sanitization yields nothing", () => {
    const model = createFakeModel();

    definition.model.setCustomHTML.call(model, "<script>alert(1)</script>");

    expect(model.get("sanitizedHTML")).toBe("");
    expect(model.get("content")).toContain("gjs-static-html-placeholder");
    expect(model._resetSpy).toHaveBeenCalledTimes(1);
  });

  it("handles empty string input without throwing", () => {
    const model = createFakeModel();

    const result = definition.model.setCustomHTML.call(model, "");

    expect(model.get("customHTML")).toBe("");
    expect(model.get("sanitizedHTML")).toBe("");
    expect(model.get("sanitizationWarnings")).toEqual([]);
    expect(model.get("content")).toContain("gjs-static-html-placeholder");
    expect(result.sanitizedHTML).toBe("");
  });
});

// ---------------------------------------------------------------------------
// model.toHTML()
// ---------------------------------------------------------------------------

describe("model.toHTML()", () => {
  it("wraps the sanitized HTML in the wrapper div when content exists", () => {
    const model = createFakeModel({ sanitizedHTML: "<p>Body</p>" });

    const html = definition.model.toHTML.call(model);

    expect(html).toBe('<div class="gjs-static-html-wrapper"><p>Body</p></div>');
  });

  it("outputs an empty wrapper div when there is no sanitizedHTML", () => {
    const model = createFakeModel({ sanitizedHTML: "" });

    const html = definition.model.toHTML.call(model);

    expect(html).toBe('<div class="gjs-static-html-wrapper"></div>');
  });
});

// ---------------------------------------------------------------------------
// view.onRender() / view.disableChildContentEditable()
// ---------------------------------------------------------------------------

describe("view.onRender()", () => {
  function createView(overrides = {}) {
    return { ...definition.view, ...overrides };
  }

  it("renders model content as innerHTML", () => {
    const el = document.createElement("div");
    const model = createFakeModel({ content: "<p>Rendered</p>" });
    const view = createView({ el, model });

    view.onRender();

    expect(el.innerHTML).toBe("<p>Rendered</p>");
  });

  it("leaves existing DOM untouched when model content is falsy", () => {
    const el = document.createElement("div");
    el.innerHTML = "<b>existing</b>";
    const model = createFakeModel({ content: "" });
    const view = createView({ el, model });

    view.onRender();

    expect(el.innerHTML).toBe("<b>existing</b>");
  });

  it("strips contenteditable from rendered children", () => {
    const el = document.createElement("div");
    const model = createFakeModel({
      content:
        '<p contenteditable="true">a</p><span contenteditable="">b</span>',
    });
    const view = createView({ el, model });

    view.onRender();

    expect(el.querySelectorAll("[contenteditable]").length).toBe(0);
  });
});

describe("view.disableChildContentEditable()", () => {
  it("removes the contenteditable attribute from every matching descendant", () => {
    const el = document.createElement("div");
    el.innerHTML =
      '<p contenteditable="true">a</p><div><span contenteditable="">b</span></div><i>c</i>';
    const view = { ...definition.view, el };

    view.disableChildContentEditable();

    expect(el.querySelectorAll("[contenteditable]").length).toBe(0);
    expect(el.querySelector("p").hasAttribute("contenteditable")).toBe(false);
  });

  it("is a no-op when there is nothing contenteditable", () => {
    const el = document.createElement("div");
    el.innerHTML = "<p>plain</p>";
    const view = { ...definition.view, el };

    expect(() => view.disableChildContentEditable()).not.toThrow();
    expect(el.innerHTML).toBe("<p>plain</p>");
  });
});

// ---------------------------------------------------------------------------
// injectEditorStyles (registered on the "load" event)
// ---------------------------------------------------------------------------

describe("gjsStaticHTML — editor-only style injection ('load' handler)", () => {
  function getLoadHandler() {
    return editor._handlers.load[0];
  }

  it("registers exactly one 'load' handler", () => {
    expect(editor._handlers.load).toHaveLength(1);
  });

  it("does nothing when the canvas has no frame element yet", () => {
    editor.setFrameEl(null);

    expect(() => getLoadHandler()()).not.toThrow();
  });

  it("injects a <style> tag with the editor-only CSS into the frame's <head>", () => {
    const frameDoc = document.implementation.createHTMLDocument("canvas");
    editor.setFrameEl({ contentDocument: frameDoc, contentWindow: null });

    getLoadHandler()();

    const styleEl = frameDoc.getElementById("gjs-static-html-editor-styles");
    expect(styleEl).not.toBeNull();
    expect(styleEl.parentElement).toBe(frameDoc.head);
    expect(styleEl.innerHTML).toContain(".gjs-static-html-wrapper");
    expect(styleEl.innerHTML).toContain("border: 2px dashed #6366f1");
  });

  it("falls back to frame.contentWindow.document when contentDocument is unavailable", () => {
    const frameDoc = document.implementation.createHTMLDocument("canvas");
    editor.setFrameEl({
      contentDocument: null,
      contentWindow: { document: frameDoc },
    });

    getLoadHandler()();

    expect(
      frameDoc.getElementById("gjs-static-html-editor-styles"),
    ).not.toBeNull();
  });

  it("reuses the existing <style> element on repeated calls instead of duplicating it", () => {
    const frameDoc = document.implementation.createHTMLDocument("canvas");
    editor.setFrameEl({ contentDocument: frameDoc, contentWindow: null });
    const handler = getLoadHandler();

    handler();
    const first = frameDoc.getElementById("gjs-static-html-editor-styles");
    handler();
    const second = frameDoc.getElementById("gjs-static-html-editor-styles");

    expect(first).toBe(second);
    expect(
      frameDoc.querySelectorAll("#gjs-static-html-editor-styles").length,
    ).toBe(1);
  });

  it("[BUG] throws when neither contentDocument nor contentWindow is available", () => {
    // Documents current behavior: `frame.contentDocument || frame.contentWindow.document`
    // has no guard for a null/undefined contentWindow — see bugFindings.
    editor.setFrameEl({ contentDocument: null, contentWindow: null });

    expect(() => getLoadHandler()()).toThrow();
  });
});

// ---------------------------------------------------------------------------
// component:dblclick handler
// ---------------------------------------------------------------------------

describe("gjsStaticHTML — component:dblclick handler", () => {
  function getHandler() {
    return editor._handlers["component:dblclick"][0];
  }

  it("triggers 'staticHTML:edit' when the double-clicked component is a staticHTML", () => {
    const component = createFakeComponent({ type: "staticHTML" });

    getHandler()(component);

    expect(editor._triggered).toContainEqual({
      event: "staticHTML:edit",
      args: [component],
    });
  });

  it("does not trigger for other component types", () => {
    const component = createFakeComponent({ type: "text" });

    getHandler()(component);

    expect(editor._triggered.some((t) => t.event === "staticHTML:edit")).toBe(
      false,
    );
  });
});

// ---------------------------------------------------------------------------
// component:add handler
// ---------------------------------------------------------------------------

describe("gjsStaticHTML — component:add handler", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function getHandler() {
    return editor._handlers["component:add"][0];
  }

  it("triggers 'staticHTML:edit' after a 100ms delay for a freshly added component", () => {
    const component = createFakeComponent({
      type: "staticHTML",
      customHTML: "",
    });

    getHandler()(component);
    expect(editor._triggered.some((t) => t.event === "staticHTML:edit")).toBe(
      false,
    );

    vi.advanceTimersByTime(100);

    expect(editor._triggered).toContainEqual({
      event: "staticHTML:edit",
      args: [component],
    });
  });

  it("does not trigger before the delay has elapsed", () => {
    const component = createFakeComponent({
      type: "staticHTML",
      customHTML: "",
    });

    getHandler()(component);
    vi.advanceTimersByTime(99);

    expect(editor._triggered.some((t) => t.event === "staticHTML:edit")).toBe(
      false,
    );
  });

  it("does not trigger when the component already has customHTML (loaded from a template)", () => {
    const component = createFakeComponent({
      type: "staticHTML",
      customHTML: "<p>already set</p>",
    });

    getHandler()(component);
    vi.advanceTimersByTime(100);

    expect(editor._triggered.some((t) => t.event === "staticHTML:edit")).toBe(
      false,
    );
  });

  it("does not trigger for components of a different type", () => {
    const component = createFakeComponent({ type: "text", customHTML: "" });

    getHandler()(component);
    vi.advanceTimersByTime(100);

    expect(editor._triggered.some((t) => t.event === "staticHTML:edit")).toBe(
      false,
    );
  });
});
