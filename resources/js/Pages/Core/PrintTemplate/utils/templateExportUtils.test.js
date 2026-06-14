import { describe, it, expect, vi } from "vitest";
import {
  stripEditorOnlyWrapperStyles,
  getCurrentTemplateFromEditor,
} from "./templateExportUtils";

describe("stripEditorOnlyWrapperStyles", () => {
  it("removes .gjs-static-html-wrapper border dashed rule", () => {
    const css = `.gjs-static-html-wrapper { border: 2px dashed #6366f1; position: relative; }`;
    const result = stripEditorOnlyWrapperStyles(css);
    expect(result).toBe("");
  });

  it("removes .gjs-static-html-wrapper::before pseudo-element rule", () => {
    const css = `.gjs-static-html-wrapper::before { content: "Static HTML"; position: absolute; top: -20px; }`;
    const result = stripEditorOnlyWrapperStyles(css);
    expect(result).toBe("");
  });

  it("removes both wrapper and pseudo-element rules together", () => {
    const css = [
      `.gjs-static-html-wrapper { border: 2px dashed #6366f1; }`,
      `.gjs-static-html-wrapper::before { content: "Label"; font-size: 10px; }`,
      `.my-class { color: red; }`,
    ].join("\n");
    const result = stripEditorOnlyWrapperStyles(css);
    expect(result).toContain(".my-class { color: red; }");
    expect(result).not.toContain("gjs-static-html-wrapper");
  });

  it("preserves CSS without wrapper styles unchanged", () => {
    const css = `.invoice { margin: 0; padding: 16px; } body { font-size: 14px; }`;
    const result = stripEditorOnlyWrapperStyles(css);
    expect(result).toBe(css);
  });

  it("returns empty string as-is", () => {
    expect(stripEditorOnlyWrapperStyles("")).toBe("");
  });

  it("returns whitespace-only string as-is", () => {
    expect(stripEditorOnlyWrapperStyles("   ")).toBe("   ");
  });

  it("returns non-string values as-is", () => {
    expect(stripEditorOnlyWrapperStyles(null)).toBe(null);
    expect(stripEditorOnlyWrapperStyles(undefined)).toBe(undefined);
  });

  it("handles multiple wrapper rules in CSS", () => {
    const css = [
      `.gjs-static-html-wrapper { border: 2px dashed #6366f1; min-height: 50px; }`,
      `.header { background: #fff; }`,
      `.gjs-static-html-wrapper::before { content: "Wrapper"; color: #6366f1; }`,
      `.footer { padding: 10px; }`,
    ].join("\n");
    const result = stripEditorOnlyWrapperStyles(css);
    expect(result).toContain(".header { background: #fff; }");
    expect(result).toContain(".footer { padding: 10px; }");
    expect(result).not.toContain("gjs-static-html-wrapper");
  });

  it("is case-insensitive for the border color hex value", () => {
    const css = `.gjs-static-html-wrapper { border: 2px dashed #6366F1; }`;
    const result = stripEditorOnlyWrapperStyles(css);
    expect(result).not.toContain("gjs-static-html-wrapper");
  });
});

describe("getCurrentTemplateFromEditor", () => {
  it("returns fallback when editor is null", () => {
    const fallback = { html: "<p>fallback</p>", css: "p { color: red; }" };
    const result = getCurrentTemplateFromEditor(null, fallback);
    expect(result).toEqual(fallback);
  });

  it("returns fallback when editor is undefined", () => {
    const fallback = { html: "<div>test</div>", css: "div { margin: 0; }" };
    const result = getCurrentTemplateFromEditor(undefined, fallback);
    expect(result).toEqual(fallback);
  });

  it("returns empty strings when editor is null and no fallback provided", () => {
    const result = getCurrentTemplateFromEditor(null);
    expect(result).toEqual({ html: "", css: "" });
  });

  it("extracts HTML and CSS from editor with selected page", () => {
    const mockComponent = {};
    const mockEditor = {
      Pages: {
        getSelected: () => ({
          getMainComponent: () => mockComponent,
        }),
        getAll: () => [],
      },
      getHtml: vi.fn(({ component }) => "<p>Hello</p>"),
      getCss: vi.fn(({ component }) => "p { color: blue; }"),
    };

    const result = getCurrentTemplateFromEditor(mockEditor);
    expect(result.css).toBe("p { color: blue; }");
    expect(mockEditor.getHtml).toHaveBeenCalledWith({
      component: mockComponent,
    });
    expect(mockEditor.getCss).toHaveBeenCalledWith({
      component: mockComponent,
    });
  });

  it("falls back to first page when no page is selected", () => {
    const mockComponent = {};
    const mockEditor = {
      Pages: {
        getSelected: () => null,
        getAll: () => [{ getMainComponent: () => mockComponent }],
      },
      getHtml: vi.fn(({ component }) => "<div>content</div>"),
      getCss: vi.fn(({ component }) => "div { padding: 8px; }"),
    };

    const result = getCurrentTemplateFromEditor(mockEditor);
    expect(result.css).toBe("div { padding: 8px; }");
    expect(mockEditor.getHtml).toHaveBeenCalledWith({
      component: mockComponent,
    });
  });

  it("calls editor without component when getMainComponent is unavailable", () => {
    const mockEditor = {
      Pages: {
        getSelected: () => ({}), // page without getMainComponent
        getAll: () => [],
      },
      getHtml: vi.fn(() => "<span>no component</span>"),
      getCss: vi.fn(() => "span { font-weight: bold; }"),
    };

    const result = getCurrentTemplateFromEditor(mockEditor);
    expect(result.css).toBe("span { font-weight: bold; }");
    expect(mockEditor.getHtml).toHaveBeenCalledWith();
    expect(mockEditor.getCss).toHaveBeenCalledWith();
  });

  it("strips editor-only wrapper styles from CSS output", () => {
    const mockComponent = {};
    const rawCss = `.gjs-static-html-wrapper { border: 2px dashed #6366f1; } .invoice { margin: 0; }`;
    const mockEditor = {
      Pages: {
        getSelected: () => ({
          getMainComponent: () => mockComponent,
        }),
        getAll: () => [],
      },
      getHtml: vi.fn(() => "<div>test</div>"),
      getCss: vi.fn(() => rawCss),
    };

    const result = getCurrentTemplateFromEditor(mockEditor);
    expect(result.css).not.toContain("gjs-static-html-wrapper");
    expect(result.css).toContain(".invoice { margin: 0; }");
  });

  it("returns fallback when editor throws an error", () => {
    const mockEditor = {
      Pages: {
        getSelected: () => {
          throw new Error("Editor crashed");
        },
        getAll: () => [],
      },
      getHtml: vi.fn(),
      getCss: vi.fn(),
    };
    const fallback = { html: "<p>safe</p>", css: "p { color: green; }" };

    const result = getCurrentTemplateFromEditor(mockEditor, fallback);
    expect(result).toEqual(fallback);
  });

  it("returns empty strings when editor throws and no fallback provided", () => {
    const mockEditor = {
      Pages: {
        getSelected: () => {
          throw new Error("Unexpected error");
        },
        getAll: () => [],
      },
      getHtml: vi.fn(),
      getCss: vi.fn(),
    };

    const result = getCurrentTemplateFromEditor(mockEditor);
    expect(result).toEqual({ html: "", css: "" });
  });
});
