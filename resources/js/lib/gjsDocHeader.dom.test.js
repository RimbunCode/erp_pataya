/**
 * Tests for the gjsDocHeader GrapesJS plugin.
 *
 * gjsDocHeader is a plugin function `(editor) => void` — it never renders a
 * React component, so it belongs in the "dom" project (jsdom, but no RTL
 * render): it needs real DOM APIs (querySelector, MouseEvent dispatch,
 * inline styles) to exercise the resize-divider drag behaviour registered in
 * `view.onRender`, plus a lightweight mock of the GrapesJS `editor` object to
 * exercise plugin registration, the `swap-header-layout` command, and the
 * toolbar-restoration `editor.on("load", ...)` handler.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import gjsDocHeader from "./gjsDocHeader";

// ---------------------------------------------------------------------------
// Mock GrapesJS editor
// ---------------------------------------------------------------------------

function createMockEditor() {
  const canvasBody = document.createElement("div");
  return {
    DomComponents: { addType: vi.fn() },
    Commands: { add: vi.fn() },
    Blocks: { add: vi.fn() },
    Canvas: {
      getDocument: () => document,
      getBody: () => canvasBody,
    },
    on: vi.fn(),
    trigger: vi.fn(),
    store: vi.fn(),
    getWrapper: vi.fn(),
  };
}

/**
 * Grabs the config object passed to `mockFn(name, config)` for a given name.
 * @param mockFn
 * @param name
 */
function registeredConfig(mockFn, name) {
  const call = mockFn.mock.calls.find(([callName]) => callName === name);
  return call ? call[1] : undefined;
}

/**
 * Builds the rendered header markup that `view.onRender` operates on.
 * @param root0
 * @param root0.reversed
 */
function buildHeaderDom({ reversed = false } = {}) {
  const root = document.createElement("div");
  root.innerHTML = `
    <div class="doc-header${reversed ? " reverse-layout" : ""}">
      <div class="doc-logo"><img /></div>
      <div class="resize-divider"></div>
      <div class="doc-info"><h2></h2></div>
    </div>
  `;
  return root;
}

describe("gjsDocHeader plugin", () => {
  let editor;

  beforeEach(() => {
    editor = createMockEditor();
    gjsDocHeader(editor);
  });

  // -------------------------------------------------------------------------
  describe("plugin registration", () => {
    it("registers a block that inserts a gjsDocHeader component", () => {
      const block = registeredConfig(editor.Blocks.add, "gjsDocHeader");
      expect(block).toEqual({
        label: "Header Dokumen",
        category: "Dokumen",
        content: { type: "gjsDocHeader" },
      });
    });

    it("registers the swap-header-layout command with a run() handler", () => {
      const cmd = registeredConfig(editor.Commands.add, "swap-header-layout");
      expect(typeof cmd.run).toBe("function");
    });

    it("registers the gjsDocHeader component type with model defaults and a view", () => {
      const type = registeredConfig(
        editor.DomComponents.addType,
        "gjsDocHeader",
      );
      expect(type.model.defaults).toBeDefined();
      expect(typeof type.view.onRender).toBe("function");
    });
  });

  // -------------------------------------------------------------------------
  describe("component defaults", () => {
    let defaults;

    beforeEach(() => {
      defaults = registeredConfig(editor.DomComponents.addType, "gjsDocHeader")
        .model.defaults;
    });

    it("uses a <header> root tag, non-droppable but draggable", () => {
      expect(defaults.tagName).toBe("header");
      expect(defaults.attributes).toEqual({ class: "gjs-doc-header" });
      expect(defaults.droppable).toBe(false);
      expect(defaults.draggable).toBe(true);
    });

    it("includes CSS for the base layout, reverse layout and resize divider", () => {
      expect(defaults.styles).toContain(".gjs-doc-header");
      expect(defaults.styles).toContain(".doc-header.reverse-layout");
      expect(defaults.styles).toContain("flex-direction: row-reverse;");
      expect(defaults.styles).toContain(".resize-divider");
      expect(defaults.styles).toContain(".resize-divider:hover");
      expect(defaults.styles).toContain(".doc-info h2");
    });

    it("nests doc-logo, resize-divider and doc-info inside a single .doc-header row", () => {
      const headerRow = defaults.components[0];
      expect(headerRow.attributes.class).toBe("doc-header");
      expect(headerRow.components).toHaveLength(3);

      const [logo, divider, info] = headerRow.components;
      expect(logo.attributes.class).toBe("doc-logo");
      expect(divider.attributes.class).toBe("resize-divider");
      expect(info.attributes.class).toBe("doc-info");
    });

    it("BUG: the logo slot, its image and the divider set 'dropable' (typo) instead of 'droppable'", () => {
      // GrapesJS's real component option is `droppable`, not `dropable`.
      // These three nodes clearly intend to block drops into the
      // logo/divider slots (mirroring the correctly-spelled `droppable: false`
      // on the root a few lines above), but the misspelled key means
      // GrapesJS never reads it — the slots silently keep GrapesJS's
      // default droppable behaviour instead. Documented as-is; see
      // bugFindings for the fix (rename to `droppable`).
      const headerRow = defaults.components[0];
      const [logo, divider] = headerRow.components;
      const image = logo.components[0];

      expect(logo.dropable).toBe(false);
      expect(logo.droppable).toBeUndefined();
      expect(divider.dropable).toBe(false);
      expect(divider.droppable).toBeUndefined();
      expect(image.dropable).toBe(false);
      expect(image.droppable).toBeUndefined();
    });

    it("gives the logo slot and its nested image an image type with a swap-header-layout toolbar button", () => {
      const headerRow = defaults.components[0];
      const [logo] = headerRow.components;
      const image = logo.components[0];

      expect(logo.toolbar[0].command).toBe("swap-header-layout");
      expect(image.type).toBe("image");
      expect(image.toolbar[0].command).toBe("swap-header-layout");
      expect(image.attributes).toEqual({
        src: "/company-logo",
        alt: "Company Logo",
      });
    });

    it("leaves the resize-divider with an empty toolbar", () => {
      const headerRow = defaults.components[0];
      const divider = headerRow.components[1];
      expect(divider.toolbar).toEqual([]);
    });

    it("renders the company placeholder tokens in the info column, in order", () => {
      const headerRow = defaults.components[0];
      const info = headerRow.components[2];
      const contents = info.components.map((c) => c.content);

      expect(contents).toEqual([
        "{{company_name}}",
        "{{street}}, {{city}}, {{state}}, {{country_name}}. {{zip_code}}",
        "Telp: {{phone}}",
        "Email: {{email}}",
      ]);
    });
  });

  // -------------------------------------------------------------------------
  describe("swap-header-layout command", () => {
    let run;

    beforeEach(() => {
      run = registeredConfig(editor.Commands.add, "swap-header-layout").run;
    });

    function mockHeaderModel(initialClasses = []) {
      const classes = new Set(initialClasses);
      return {
        getClasses: () => Array.from(classes),
        addClass: vi.fn((c) => classes.add(c)),
        removeClass: vi.fn((c) => classes.delete(c)),
      };
    }

    it("does nothing when nothing is selected", () => {
      const ed = { getSelected: () => null, trigger: vi.fn(), store: vi.fn() };

      run(ed);

      expect(ed.trigger).not.toHaveBeenCalled();
      expect(ed.store).not.toHaveBeenCalled();
    });

    it("does nothing when neither closest() nor find() locate a .doc-header", () => {
      const selected = { closest: () => null, find: () => [] };
      const ed = {
        getSelected: () => selected,
        trigger: vi.fn(),
        store: vi.fn(),
      };

      run(ed);

      expect(ed.trigger).not.toHaveBeenCalled();
      expect(ed.store).not.toHaveBeenCalled();
    });

    it("adds reverse-layout when the resolved header does not have it yet", () => {
      const headerModel = mockHeaderModel([]);
      const selected = { closest: () => headerModel };
      const ed = {
        getSelected: () => selected,
        trigger: vi.fn(),
        store: vi.fn(),
      };

      run(ed);

      expect(headerModel.addClass).toHaveBeenCalledWith("reverse-layout");
      expect(headerModel.removeClass).not.toHaveBeenCalled();
      expect(ed.trigger).toHaveBeenCalledWith("component:update", headerModel);
      expect(ed.store).toHaveBeenCalledTimes(1);
    });

    it("removes reverse-layout when the resolved header already has it", () => {
      const headerModel = mockHeaderModel(["reverse-layout"]);
      const selected = { closest: () => headerModel };
      const ed = {
        getSelected: () => selected,
        trigger: vi.fn(),
        store: vi.fn(),
      };

      run(ed);

      expect(headerModel.removeClass).toHaveBeenCalledWith("reverse-layout");
      expect(headerModel.addClass).not.toHaveBeenCalled();
    });

    it("falls back to selected.find('.doc-header')[0] when closest() finds nothing", () => {
      const headerModel = mockHeaderModel([]);
      const selected = { closest: () => null, find: () => [headerModel] };
      const ed = {
        getSelected: () => selected,
        trigger: vi.fn(),
        store: vi.fn(),
      };

      run(ed);

      expect(headerModel.addClass).toHaveBeenCalledWith("reverse-layout");
    });

    it("falls back to find() when the selection has no closest() method at all", () => {
      const headerModel = mockHeaderModel([]);
      const selected = { find: () => [headerModel] };
      const ed = {
        getSelected: () => selected,
        trigger: vi.fn(),
        store: vi.fn(),
      };

      run(ed);

      expect(headerModel.addClass).toHaveBeenCalledWith("reverse-layout");
    });
  });

  // -------------------------------------------------------------------------
  describe("toolbar restoration on editor 'load'", () => {
    // The very first "load" registration happens synchronously during plugin
    // setup, before any component view has rendered (onRender adds more
    // "load" listeners later — see the onRender describe block below).
    let loadHandler;

    beforeEach(() => {
      loadHandler = editor.on.mock.calls.find(([evt]) => evt === "load")[1];
    });

    function mockImageComp(toolbar) {
      return {
        get: (k) => (k === "toolbar" ? toolbar : undefined),
        set: vi.fn(),
      };
    }

    function mockLogoComp({ toolbar = [], image } = {}) {
      const state = { toolbar };
      return {
        get: (k) => (k === "toolbar" ? state.toolbar : undefined),
        set: vi.fn((k, v) => {
          if (k === "toolbar") state.toolbar = v;
        }),
        findType: (t) => (t === "image" && image ? [image] : []),
      };
    }

    it("adds the swap toolbar button to a .doc-logo missing it", () => {
      const logo = mockLogoComp({ toolbar: [] });
      editor.getWrapper.mockReturnValue({
        find: (sel) => (sel === ".doc-logo" ? [logo] : []),
      });

      loadHandler();

      expect(logo.set).toHaveBeenCalledWith(
        "toolbar",
        expect.arrayContaining([
          expect.objectContaining({ command: "swap-header-layout" }),
        ]),
      );
    });

    it("does not duplicate the toolbar button on a .doc-logo that already has it", () => {
      const logo = mockLogoComp({
        toolbar: [{ attributes: {}, command: "swap-header-layout" }],
      });
      editor.getWrapper.mockReturnValue({
        find: (sel) => (sel === ".doc-logo" ? [logo] : []),
      });

      loadHandler();

      expect(logo.set).not.toHaveBeenCalled();
    });

    it("also restores the toolbar button on the logo's nested image component", () => {
      const image = mockImageComp([]);
      const logo = mockLogoComp({
        toolbar: [{ command: "swap-header-layout" }],
        image,
      });
      editor.getWrapper.mockReturnValue({
        find: (sel) => (sel === ".doc-logo" ? [logo] : []),
      });

      loadHandler();

      expect(image.set).toHaveBeenCalledWith(
        "toolbar",
        expect.arrayContaining([
          expect.objectContaining({ command: "swap-header-layout" }),
        ]),
      );
    });

    it("does not duplicate the toolbar button on a nested image that already has it", () => {
      const image = mockImageComp([{ command: "swap-header-layout" }]);
      const logo = mockLogoComp({
        toolbar: [{ command: "swap-header-layout" }],
        image,
      });
      editor.getWrapper.mockReturnValue({
        find: (sel) => (sel === ".doc-logo" ? [logo] : []),
      });

      loadHandler();

      expect(image.set).not.toHaveBeenCalled();
    });

    it("unconditionally resets every .resize-divider toolbar to an empty array", () => {
      const divider = { set: vi.fn() };
      editor.getWrapper.mockReturnValue({
        find: (sel) => (sel === ".resize-divider" ? [divider] : []),
      });

      loadHandler();

      expect(divider.set).toHaveBeenCalledWith("toolbar", []);
    });
  });

  // -------------------------------------------------------------------------
  describe("view.onRender — resize-divider drag behaviour", () => {
    let onRender;
    let el;
    let model;
    let logoModel;

    beforeEach(() => {
      vi.useFakeTimers();
      onRender = registeredConfig(editor.DomComponents.addType, "gjsDocHeader")
        .view.onRender;
      el = buildHeaderDom();
      logoModel = { addStyle: vi.fn() };
      model = { find: (sel) => (sel === ".doc-logo" ? [logoModel] : []) };
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    function renderAndAdvance(target = el) {
      onRender.call({ el: target, model });
      vi.advanceTimersByTime(200);
    }

    function logoWrap() {
      return el.querySelector(".doc-logo");
    }

    /**
     * Makes the logo's getBoundingClientRect() reflect its current inline width.
     * @param initialWidth
     */
    function stubWidth(initialWidth) {
      const wrap = logoWrap();
      wrap.getBoundingClientRect = () => ({
        width: parseFloat(wrap.style.width) || initialWidth,
      });
      return wrap;
    }

    it("does nothing (no crash) when the markup has no .doc-logo/.resize-divider", () => {
      const empty = document.createElement("div");
      expect(() => renderAndAdvance(empty)).not.toThrow();
    });

    it("drags the divider to resize the logo and persists the new width on mouseup", () => {
      stubWidth(100);
      renderAndAdvance();
      const divider = el.querySelector(".resize-divider");

      divider.dispatchEvent(
        new MouseEvent("mousedown", {
          clientX: 100,
          bubbles: true,
          cancelable: true,
        }),
      );
      expect(editor.Canvas.getBody().style.cursor).toBe("ew-resize");
      expect(editor.Canvas.getBody().style.userSelect).toBe("none");

      document.dispatchEvent(
        new MouseEvent("mousemove", {
          clientX: 160,
          bubbles: true,
          cancelable: true,
        }),
      );
      expect(logoWrap().style.width).toBe("160px");
      expect(logoWrap().style.flex).toBe("0 0 160px");

      document.dispatchEvent(
        new MouseEvent("mouseup", { bubbles: true, cancelable: true }),
      );

      expect(logoModel.addStyle).toHaveBeenCalledWith({
        width: "160px",
        flex: "0 0 160px",
      });
      expect(editor.trigger).toHaveBeenCalledWith(
        "component:update",
        logoModel,
      );
      expect(editor.store).toHaveBeenCalledTimes(1);
      expect(editor.Canvas.getBody().style.cursor).toBe("");
      expect(editor.Canvas.getBody().style.userSelect).toBe("");
    });

    it("ignores mousemove/mouseup before any mousedown has started a drag", () => {
      stubWidth(100);
      renderAndAdvance();

      document.dispatchEvent(
        new MouseEvent("mousemove", {
          clientX: 500,
          bubbles: true,
          cancelable: true,
        }),
      );
      document.dispatchEvent(
        new MouseEvent("mouseup", { bubbles: true, cancelable: true }),
      );

      expect(logoWrap().style.width).toBe("");
      expect(logoModel.addStyle).not.toHaveBeenCalled();
    });

    it("inverts the drag direction when the header has reverse-layout", () => {
      el = buildHeaderDom({ reversed: true });
      stubWidth(150);
      renderAndAdvance();
      const divider = el.querySelector(".resize-divider");

      divider.dispatchEvent(
        new MouseEvent("mousedown", {
          clientX: 200,
          bubbles: true,
          cancelable: true,
        }),
      );
      document.dispatchEvent(
        new MouseEvent("mousemove", {
          clientX: 260,
          bubbles: true,
          cancelable: true,
        }),
      );

      // Moving the mouse the same +60px now SHRINKS the logo (150-60=90)
      // instead of growing it (150+60=210), and 90 is still above the 80px
      // floor so this isolates the direction inversion from the clamp.
      expect(logoWrap().style.width).toBe("90px");

      document.dispatchEvent(
        new MouseEvent("mouseup", { bubbles: true, cancelable: true }),
      );
    });

    it("clamps the resized width to a minimum of 80px", () => {
      stubWidth(100);
      renderAndAdvance();
      const divider = el.querySelector(".resize-divider");

      divider.dispatchEvent(
        new MouseEvent("mousedown", {
          clientX: 100,
          bubbles: true,
          cancelable: true,
        }),
      );
      document.dispatchEvent(
        new MouseEvent("mousemove", {
          clientX: -500,
          bubbles: true,
          cancelable: true,
        }),
      );

      expect(logoWrap().style.width).toBe("80px");

      document.dispatchEvent(
        new MouseEvent("mouseup", { bubbles: true, cancelable: true }),
      );
    });

    it("re-runs the resize setup when the editor fires 'load'", () => {
      renderAndAdvance();
      const querySpy = vi.spyOn(el, "querySelector");

      const loadCalls = editor.on.mock.calls.filter(([evt]) => evt === "load");
      const onRenderLoadHandler = loadCalls[loadCalls.length - 1][1];

      onRenderLoadHandler();
      vi.advanceTimersByTime(300);

      expect(querySpy).toHaveBeenCalledWith(".doc-logo");
    });

    it("re-runs the resize setup on 'component:add' only for a gjsDocHeader component", () => {
      renderAndAdvance();
      const addHandler = editor.on.mock.calls.find(
        ([evt]) => evt === "component:add",
      )[1];

      const querySpy = vi.spyOn(el, "querySelector");

      addHandler({ is: () => false });
      vi.advanceTimersByTime(300);
      expect(querySpy).not.toHaveBeenCalled();

      addHandler({ is: (t) => t === "gjsDocHeader" });
      vi.advanceTimersByTime(300);
      expect(querySpy).toHaveBeenCalledWith(".doc-logo");
    });

    it("BUG: re-rendering registers additional 'load'/'component:add' listeners without ever removing the old ones", () => {
      // Each onRender call unconditionally does `editor.on("load", ...)` and
      // `editor.on("component:add", ...)` again, with no matching
      // `editor.off(...)` cleanup anywhere in the file. A header component
      // that re-renders multiple times over the life of the editor (e.g.
      // after unrelated undo/redo or component updates trigger GrapesJS to
      // re-render this view) keeps accumulating permanent listeners on the
      // shared editor event bus, each of which re-runs setupResizeHeader.
      renderAndAdvance();
      const loadCountAfterFirstRender = editor.on.mock.calls.filter(
        ([evt]) => evt === "load",
      ).length;

      renderAndAdvance();
      const loadCountAfterSecondRender = editor.on.mock.calls.filter(
        ([evt]) => evt === "load",
      ).length;

      expect(loadCountAfterSecondRender).toBe(loadCountAfterFirstRender + 1);
    });
  });
});
