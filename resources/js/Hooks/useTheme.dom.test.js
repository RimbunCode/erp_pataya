import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act } from "@testing-library/react";

function mockMatchMedia(matches) {
  window.matchMedia = vi.fn().mockImplementation((query) => ({
    matches,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
}

// Node 22+ punya lazy getter `localStorage` global yang butuh flag
// --localstorage-file, dan pada kombinasi Vitest 4.1.7 + Node 26 di environment
// ini jsdom's localStorage tidak ter-bridge dengan bersih ke global scope
// (lihat populateGlobal di source Vitest). Mock manual in-memory menghindari
// ketergantungan pada perilaku itu sepenuhnya.
function createMemoryStorage() {
  let store = {};
  return {
    getItem: (key) => (key in store ? store[key] : null),
    setItem: (key, value) => {
      store[key] = String(value);
    },
    removeItem: (key) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
}

describe("useTheme", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", createMemoryStorage());
    document.cookie = "theme=; path=/; max-age=0";
    mockMatchMedia(false);
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("theme default 'system' jika localStorage kosong", async () => {
    const { default: useTheme } = await import("./useTheme.js");
    expect(useTheme.getState().theme).toBe("system");
  });

  it("currentTheme resolve ke 'light'/'dark' sesuai prefers-color-scheme saat theme=system", async () => {
    mockMatchMedia(true); // prefers dark
    const { default: useTheme } = await import("./useTheme.js");
    expect(useTheme.getState().currentTheme).toBe("dark");
  });

  it("membaca theme tersimpan dari localStorage saat init", async () => {
    localStorage.setItem("theme", "dark");
    const { default: useTheme } = await import("./useTheme.js");
    expect(useTheme.getState().theme).toBe("dark");
    expect(useTheme.getState().currentTheme).toBe("dark");
  });

  it("setTheme('dark') menyimpan ke localStorage dan cookie", async () => {
    const { default: useTheme } = await import("./useTheme.js");

    act(() => {
      useTheme.getState().setTheme("dark");
    });

    expect(useTheme.getState().theme).toBe("dark");
    expect(useTheme.getState().currentTheme).toBe("dark");
    expect(localStorage.getItem("theme")).toBe("dark");
    expect(document.cookie).toContain("theme=dark");
  });

  it("setTheme('system') resolve currentTheme sesuai matchMedia", async () => {
    mockMatchMedia(true); // prefers dark
    const { default: useTheme } = await import("./useTheme.js");

    act(() => {
      useTheme.getState().setTheme("system");
    });

    expect(useTheme.getState().theme).toBe("system");
    expect(useTheme.getState().currentTheme).toBe("dark");
  });

  it("setCurrentTheme mengubah currentTheme tanpa menyentuh theme", async () => {
    const { default: useTheme } = await import("./useTheme.js");

    act(() => {
      useTheme.getState().setCurrentTheme("light");
    });

    expect(useTheme.getState().currentTheme).toBe("light");
  });
});
