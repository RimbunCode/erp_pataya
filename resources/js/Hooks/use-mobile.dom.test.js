import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useIsMobile } from "./use-mobile.jsx";

function mockMatchMedia(initialMatches) {
  const listeners = new Set();
  let matches = initialMatches;

  window.matchMedia = vi.fn().mockImplementation((query) => ({
    matches,
    media: query,
    addEventListener: (event, cb) => {
      if (event === "change") listeners.add(cb);
    },
    removeEventListener: (event, cb) => {
      if (event === "change") listeners.delete(cb);
    },
  }));

  return {
    setMatches: (value) => {
      matches = value;
      listeners.forEach((cb) => cb());
    },
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useIsMobile", () => {
  it("true saat innerWidth di bawah breakpoint (768px)", () => {
    mockMatchMedia(true);
    vi.stubGlobal("innerWidth", 500);

    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(true);
  });

  it("false saat innerWidth di atas breakpoint", () => {
    mockMatchMedia(false);
    vi.stubGlobal("innerWidth", 1024);

    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);
  });

  it("update saat event 'change' matchMedia terpicu", () => {
    const mql = mockMatchMedia(false);
    vi.stubGlobal("innerWidth", 1024);

    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);

    act(() => {
      vi.stubGlobal("innerWidth", 400);
      mql.setMatches(true);
    });

    expect(result.current).toBe(true);
  });
});
