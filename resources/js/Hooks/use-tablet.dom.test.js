import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useIsTablet } from "./use-tablet.jsx";

function mockMatchMedia(initialMatches) {
  const listeners = new Set();
  let matches = initialMatches;

  const addEventListener = vi.fn((event, cb) => {
    if (event === "change") listeners.add(cb);
  });
  const removeEventListener = vi.fn((event, cb) => {
    if (event === "change") listeners.delete(cb);
  });

  window.matchMedia = vi.fn().mockImplementation((query) => ({
    matches,
    media: query,
    addEventListener,
    removeEventListener,
  }));

  return {
    addEventListener,
    removeEventListener,
    setMatches: (value) => {
      matches = value;
      listeners.forEach((cb) => cb());
    },
    listenerCount: () => listeners.size,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useIsTablet", () => {
  it("true saat innerWidth di bawah breakpoint (768px)", () => {
    mockMatchMedia(true);
    vi.stubGlobal("innerWidth", 500);

    const { result } = renderHook(() => useIsTablet());
    expect(result.current).toBe(true);
  });

  it("false saat innerWidth di atas breakpoint", () => {
    mockMatchMedia(false);
    vi.stubGlobal("innerWidth", 1024);

    const { result } = renderHook(() => useIsTablet());
    expect(result.current).toBe(false);
  });

  it("true tepat di batas bawah breakpoint (767px)", () => {
    mockMatchMedia(true);
    vi.stubGlobal("innerWidth", 767);

    const { result } = renderHook(() => useIsTablet());
    expect(result.current).toBe(true);
  });

  it("false tepat di nilai breakpoint (768px, bukan lagi tablet)", () => {
    mockMatchMedia(false);
    vi.stubGlobal("innerWidth", 768);

    const { result } = renderHook(() => useIsTablet());
    expect(result.current).toBe(false);
  });

  it("selalu mengembalikan boolean (bukan undefined) meski sebelum effect selesai", () => {
    mockMatchMedia(false);
    vi.stubGlobal("innerWidth", 1024);

    const { result } = renderHook(() => useIsTablet());
    expect(typeof result.current).toBe("boolean");
  });

  it("update saat event 'change' matchMedia terpicu", () => {
    const mql = mockMatchMedia(false);
    vi.stubGlobal("innerWidth", 1024);

    const { result } = renderHook(() => useIsTablet());
    expect(result.current).toBe(false);

    act(() => {
      vi.stubGlobal("innerWidth", 400);
      mql.setMatches(true);
    });

    expect(result.current).toBe(true);
  });

  it("query media list dibuat dengan max-width tepat 1px di bawah breakpoint", () => {
    mockMatchMedia(false);
    vi.stubGlobal("innerWidth", 1024);

    renderHook(() => useIsTablet());

    expect(window.matchMedia).toHaveBeenCalledWith("(max-width: 767px)");
  });

  it("melepas listener 'change' saat unmount (cleanup effect)", () => {
    const mql = mockMatchMedia(false);
    vi.stubGlobal("innerWidth", 1024);

    const { unmount } = renderHook(() => useIsTablet());
    expect(mql.listenerCount()).toBe(1);

    unmount();

    expect(mql.removeEventListener).toHaveBeenCalledWith(
      "change",
      expect.any(Function),
    );
    expect(mql.listenerCount()).toBe(0);
  });
});
