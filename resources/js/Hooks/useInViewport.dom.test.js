import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import useInViewport from "./useInViewport";

// jsdom tidak punya layout nyata -- test-setup.js polyfill
// IntersectionObserver default (langsung intersecting), jadi hook ini
// SENGAJA override globalThis.IntersectionObserver sendiri per test supaya
// bisa kontrol kapan callback intersect dipicu (skenario "belum kelihatan"
// perlu diuji eksplisit, bukan cuma "langsung true").
let observedCallback;
let observeSpy;
let disconnectSpy;
let lastOptions;

// eslint-disable-next-line local/no-unused-vars-fixer -- dipakai di beforeEach() sbg nilai assignment, false-positive
class MockIntersectionObserver {
  constructor(callback, options) {
    observedCallback = callback;
    lastOptions = options;
  }
  observe(target) {
    observeSpy(target);
  }
  unobserve() {}
  disconnect(...args) {
    disconnectSpy(...args);
  }
}

beforeEach(() => {
  observeSpy = vi.fn();
  disconnectSpy = vi.fn();
  observedCallback = undefined;
  lastOptions = undefined;
  globalThis.IntersectionObserver = MockIntersectionObserver;
});

describe("useInViewport", () => {
  it("false di awal, tidak observe apa pun kalau ref.current belum ada", () => {
    const ref = { current: null };
    const { result } = renderHook(() => useInViewport(ref));

    expect(result.current).toBe(false);
    expect(observeSpy).not.toHaveBeenCalled();
  });

  it("observe node dari ref.current, rootMargin default 200px", () => {
    const node = document.createElement("div");
    const ref = { current: node };
    renderHook(() => useInViewport(ref));

    expect(observeSpy).toHaveBeenCalledWith(node);
    expect(lastOptions).toEqual({ rootMargin: "200px" });
  });

  it("rootMargin bisa dioverride via opsi kedua", () => {
    const ref = { current: document.createElement("div") };
    renderHook(() => useInViewport(ref, { rootMargin: "50px" }));

    expect(lastOptions).toEqual({ rootMargin: "50px" });
  });

  it("true setelah entry.isIntersecting, lalu disconnect (one-shot -- tidak observe ulang)", () => {
    const ref = { current: document.createElement("div") };
    const { result } = renderHook(() => useInViewport(ref));

    expect(result.current).toBe(false);

    act(() => {
      observedCallback([{ isIntersecting: true }]);
    });

    expect(result.current).toBe(true);
    expect(disconnectSpy).toHaveBeenCalled();
    // Cuma 1 observer yang pernah dibuat sepanjang siklus ini -- effect
    // TIDAK bikin observer baru lagi setelah isInView jadi true.
    expect(observeSpy).toHaveBeenCalledTimes(1);
  });

  it("tetap false kalau entry.isIntersecting false (belum masuk viewport)", () => {
    const ref = { current: document.createElement("div") };
    const { result } = renderHook(() => useInViewport(ref));

    act(() => {
      observedCallback([{ isIntersecting: false }]);
    });

    expect(result.current).toBe(false);
    expect(disconnectSpy).not.toHaveBeenCalled();
  });

  it("disconnect saat unmount sebelum sempat intersecting", () => {
    const ref = { current: document.createElement("div") };
    const { unmount } = renderHook(() => useInViewport(ref));

    unmount();

    expect(disconnectSpy).toHaveBeenCalledTimes(1);
  });
});
