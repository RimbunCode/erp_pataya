// useHoverIntent (permintaan user, revisi 2026-09-28): mouse yang cuma LEWAT
// header node tertutup (scroll cepat lintas beberapa row grup) sebelumnya
// memicu prefetch tiap row yang disentuh -- badai request percuma. Hook ini
// menunda prefetch sampai pointer benar2 BERTAHAN di row itu.
import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useHoverIntent } from "./GroupHeaderRow";

afterEach(() => {
  vi.useRealTimers();
});

describe("useHoverIntent", () => {
  it("mouseEnter lalu mouseLeave SEBELUM delay -> callback tidak pernah dipanggil", () => {
    vi.useFakeTimers();
    const callback = vi.fn();
    const { result } = renderHook(() => useHoverIntent(callback, 150));

    act(() => {
      result.current.onMouseEnter();
    });
    act(() => {
      vi.advanceTimersByTime(100);
      result.current.onMouseLeave();
    });
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(callback).not.toHaveBeenCalled();
  });

  it("mouseEnter bertahan >= delay tanpa mouseLeave -> callback dipanggil sekali", () => {
    vi.useFakeTimers();
    const callback = vi.fn();
    const { result } = renderHook(() => useHoverIntent(callback, 150));

    act(() => {
      result.current.onMouseEnter();
    });
    act(() => {
      vi.advanceTimersByTime(150);
    });

    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("mouseEnter berulang (re-entry) sebelum delai selesai mereset timer, bukan menumpuk panggilan", () => {
    vi.useFakeTimers();
    const callback = vi.fn();
    const { result } = renderHook(() => useHoverIntent(callback, 150));

    act(() => {
      result.current.onMouseEnter();
      vi.advanceTimersByTime(100);
      result.current.onMouseEnter();
      vi.advanceTimersByTime(100);
    });
    expect(callback).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(50);
    });
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("callback undefined (node sudah terbuka) -> onMouseEnter tidak error", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useHoverIntent(undefined, 150));

    expect(() => {
      act(() => {
        result.current.onMouseEnter();
        vi.advanceTimersByTime(150);
      });
    }).not.toThrow();
  });

  it("unmount saat timer masih berjalan membatalkan timer (tidak memicu setState/callback setelah unmount)", () => {
    vi.useFakeTimers();
    const callback = vi.fn();
    const { result, unmount } = renderHook(() => useHoverIntent(callback, 150));

    act(() => {
      result.current.onMouseEnter();
    });
    unmount();
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(callback).not.toHaveBeenCalled();
  });
});
