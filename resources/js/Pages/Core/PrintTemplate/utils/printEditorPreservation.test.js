import { describe, expect, it, vi } from "vitest";
import { parseCssDeclarations } from "./cssUtils";
import {
  handleModalEditorKeyDown,
  resolveCssModalInitialDraft,
} from "./modalEditorUtils";

describe("Print editor preservation behaviors", () => {
  it("preserves already-valid kebab-case CSS declarations", () => {
    expect(
      parseCssDeclarations("background-color: red; margin-top: 10px;"),
    ).toEqual({
      "background-color": "red",
      "margin-top": "10px",
    });
  });

  it("preserves single-word css properties", () => {
    expect(parseCssDeclarations("color: blue;")).toEqual({
      color: "blue",
    });
  });

  it("keeps existing css draft unchanged when present", () => {
    const existingCss = "font-size: 12px;\ncolor: #111;";

    const result = resolveCssModalInitialDraft({
      cssDraft: existingCss,
      selectedComponentId: "abc123",
      isBodyNode: false,
    });

    expect(result).toBe(existingCss);
  });

  it('still stops "/" key propagation in modal editor', () => {
    const event = {
      key: "/",
      stopPropagation: vi.fn(),
    };

    const handled = handleModalEditorKeyDown(event, vi.fn());

    expect(handled).toBe(false);
    expect(event.stopPropagation).toHaveBeenCalledTimes(1);
  });

  it("does not trigger save on non-save shortcuts", () => {
    const onSave = vi.fn();
    const event = {
      key: "p",
      ctrlKey: true,
      metaKey: false,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    };

    const handled = handleModalEditorKeyDown(event, onSave);

    expect(handled).toBe(false);
    expect(onSave).not.toHaveBeenCalled();
    expect(event.preventDefault).not.toHaveBeenCalled();
  });
});
