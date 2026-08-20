import { describe, expect, it, vi } from "vitest";
import {
  resolveCssModalInitialDraft,
  isSaveShortcut,
  handleModalEditorKeyDown,
} from "./modalEditorUtils";

describe("resolveCssModalInitialDraft", () => {
  it("cssDraft non-kosong dikembalikan apa adanya (prioritas tertinggi)", () => {
    expect(
      resolveCssModalInitialDraft({ cssDraft: ".card { color: red; }" }),
    ).toBe(".card { color: red; }");
  });

  it("cssDraft kosong + isBodyNode -> string kosong (bukan template selector)", () => {
    expect(
      resolveCssModalInitialDraft({ cssDraft: "", isBodyNode: true }),
    ).toBe("");
  });

  it("cssDraft kosong + ada selectedComponentId -> template '#id{ }'", () => {
    expect(
      resolveCssModalInitialDraft({
        cssDraft: "",
        selectedComponentId: "hero-1",
      }),
    ).toBe("#hero-1{ }");
  });

  it("cssDraft kosong + tanpa selectedComponentId -> string kosong", () => {
    expect(resolveCssModalInitialDraft({ cssDraft: "" })).toBe("");
  });

  it("default params (tanpa argumen) -> string kosong", () => {
    expect(resolveCssModalInitialDraft()).toBe("");
  });

  it("cssDraft whitespace-only diperlakukan sebagai kosong", () => {
    expect(
      resolveCssModalInitialDraft({
        cssDraft: "   ",
        selectedComponentId: "x",
      }),
    ).toBe("#x{ }");
  });
});

describe("isSaveShortcut", () => {
  it("true untuk Ctrl+S", () => {
    expect(isSaveShortcut({ ctrlKey: true, key: "s" })).toBe(true);
  });

  it("true untuk Cmd+S (metaKey, macOS)", () => {
    expect(isSaveShortcut({ metaKey: true, key: "S" })).toBe(true);
  });

  it("false tanpa modifier key", () => {
    expect(isSaveShortcut({ key: "s" })).toBe(false);
  });

  it("false untuk key selain 's'", () => {
    expect(isSaveShortcut({ ctrlKey: true, key: "a" })).toBe(false);
  });

  it("event null/undefined -> false", () => {
    expect(isSaveShortcut(null)).toBe(false);
    expect(isSaveShortcut(undefined)).toBe(false);
  });
});

describe("handleModalEditorKeyDown", () => {
  it("Ctrl+S memanggil preventDefault, stopPropagation, onSave, return true", () => {
    const onSave = vi.fn();
    const event = {
      key: "s",
      ctrlKey: true,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    };

    const result = handleModalEditorKeyDown(event, onSave);

    expect(result).toBe(true);
    expect(event.preventDefault).toHaveBeenCalled();
    expect(event.stopPropagation).toHaveBeenCalled();
    expect(onSave).toHaveBeenCalled();
  });

  it("key '/' menghentikan propagasi meski bukan save shortcut, return false", () => {
    const onSave = vi.fn();
    const event = { key: "/", stopPropagation: vi.fn() };

    const result = handleModalEditorKeyDown(event, onSave);

    expect(result).toBe(false);
    expect(event.stopPropagation).toHaveBeenCalled();
    expect(onSave).not.toHaveBeenCalled();
  });

  it("key biasa (bukan shortcut) -> return false, onSave tidak dipanggil", () => {
    const onSave = vi.fn();
    const result = handleModalEditorKeyDown({ key: "a" }, onSave);

    expect(result).toBe(false);
    expect(onSave).not.toHaveBeenCalled();
  });

  it("event null -> return false tanpa crash", () => {
    expect(handleModalEditorKeyDown(null, vi.fn())).toBe(false);
  });

  it("onSave undefined tidak menyebabkan crash saat shortcut terpicu", () => {
    const event = {
      key: "s",
      ctrlKey: true,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    };
    expect(() => handleModalEditorKeyDown(event, undefined)).not.toThrow();
  });
});
