import { describe, expect, it, vi } from "vitest";
import { parseCssDeclarations } from "./cssUtils";
import {
  handleModalEditorKeyDown,
  resolveCssModalInitialDraft,
} from "./modalEditorUtils";

describe("Print editor bug conditions", () => {
  it("normalizes camelCase CSS properties into kebab-case", () => {
    expect(parseCssDeclarations("backgroundColor: red;")).toEqual({
      "background-color": "red",
    });
  });

  it("normalizes multiple camelCase declarations into kebab-case", () => {
    expect(parseCssDeclarations("fontSize: 14px; marginTop: 8px;")).toEqual({
      "font-size": "14px",
      "margin-top": "8px",
    });
  });

  it("provides default css template when selected component has empty CSS", () => {
    const result = resolveCssModalInitialDraft({
      cssDraft: "",
      selectedComponentId: "i7k2",
      isBodyNode: false,
    });

    expect(result).toBe("#i7k2{ }");
  });

  it("triggers save and prevents default on Ctrl+S in modal", () => {
    const onSave = vi.fn();
    const event = {
      key: "s",
      ctrlKey: true,
      metaKey: false,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    };

    const handled = handleModalEditorKeyDown(event, onSave);

    expect(handled).toBe(true);
    expect(event.preventDefault).toHaveBeenCalledTimes(1);
    expect(event.stopPropagation).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it("triggers save and prevents default on Cmd+S in modal", () => {
    const onSave = vi.fn();
    const event = {
      key: "s",
      ctrlKey: false,
      metaKey: true,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    };

    const handled = handleModalEditorKeyDown(event, onSave);

    expect(handled).toBe(true);
    expect(event.preventDefault).toHaveBeenCalledTimes(1);
    expect(event.stopPropagation).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledTimes(1);
  });
});
