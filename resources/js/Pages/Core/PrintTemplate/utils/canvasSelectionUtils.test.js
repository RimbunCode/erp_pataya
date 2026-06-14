import { describe, expect, it, vi } from "vitest";
import {
  removeAllSelectedComponents,
  shouldClearSelectionOnCanvasClick,
} from "./canvasSelectionUtils";

function createElementStub({
  componentType = "",
  closestComponent = null,
  ownerDocument = null,
} = {}) {
  return {
    ownerDocument,
    closest: vi.fn((selector) => {
      if (selector === "[data-gjs-type]") {
        return closestComponent;
      }
      return null;
    }),
    getAttribute: vi.fn((name) =>
      name === "data-gjs-type" ? componentType : null,
    ),
  };
}

describe("canvasSelectionUtils", () => {
  it("clears selection when body is clicked", () => {
    const doc = {};
    const body = createElementStub({ ownerDocument: doc });
    doc.body = body;
    doc.documentElement = createElementStub({ ownerDocument: doc });

    expect(
      shouldClearSelectionOnCanvasClick({
        target: body,
      }),
    ).toBe(true);
  });

  it("clears selection when clicked element is outside component nodes", () => {
    const target = createElementStub({ closestComponent: null });

    expect(
      shouldClearSelectionOnCanvasClick({
        target,
      }),
    ).toBe(true);
  });

  it("clears selection when closest component is wrapper", () => {
    const wrapperElement = createElementStub({ componentType: "wrapper" });
    const target = createElementStub({
      closestComponent: wrapperElement,
    });

    expect(
      shouldClearSelectionOnCanvasClick({
        target,
        wrapperElement,
      }),
    ).toBe(true);
  });

  it("does not clear selection when clicked inside non-wrapper component", () => {
    const componentElement = createElementStub({ componentType: "text" });
    const target = createElementStub({
      closestComponent: componentElement,
    });

    expect(
      shouldClearSelectionOnCanvasClick({
        target,
      }),
    ).toBe(false);
  });

  it("supports text node target by using parentElement", () => {
    const wrapperElement = createElementStub({ componentType: "wrapper" });
    const textNodeTarget = {
      nodeType: 3,
      parentElement: createElementStub({
        closestComponent: wrapperElement,
      }),
    };

    expect(
      shouldClearSelectionOnCanvasClick({
        target: textNodeTarget,
        wrapperElement,
      }),
    ).toBe(true);
  });

  it("removeAllSelectedComponents calls removeSelected for selected items", () => {
    const removeSelected = vi.fn();
    const selectedComponents = [{ id: 1 }, { id: 2 }];
    const editor = {
      getSelectedAll: vi.fn(() => selectedComponents),
      removeSelected,
    };

    const result = removeAllSelectedComponents(editor);

    expect(result).toBe(true);
    expect(removeSelected).toHaveBeenCalledWith(selectedComponents);
  });

  it("removeAllSelectedComponents returns false when selection is empty", () => {
    const removeSelected = vi.fn();
    const editor = {
      getSelectedAll: vi.fn(() => []),
      removeSelected,
    };

    const result = removeAllSelectedComponents(editor);

    expect(result).toBe(false);
    expect(removeSelected).not.toHaveBeenCalled();
  });
});
