import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useScreen } from "./useScreen.jsx";

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
      listeners.forEach((cb) => cb({ matches: value }));
    },
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useScreen", () => {
  it("true saat mql.matches true", () => {
    mockMatchMedia(true);
    const { result } = renderHook(() => useScreen("1024px"));
    expect(result.current).toBe(true);
  });

  it("false saat mql.matches false", () => {
    mockMatchMedia(false);
    const { result } = renderHook(() => useScreen("1024px"));
    expect(result.current).toBe(false);
  });

  it("update saat event 'change' terpicu", () => {
    const mql = mockMatchMedia(false);
    const { result } = renderHook(() => useScreen("1024px"));
    expect(result.current).toBe(false);

    act(() => {
      mql.setMatches(true);
    });

    expect(result.current).toBe(true);
  });
});
