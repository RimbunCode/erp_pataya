/**
 * Unit test murni untuk useDynamicRefs.
 *
 * useDynamicRefs() kini hook React sungguhan: `map` dibuat via
 * `useRef(new Map()).current` DI DALAM hook, sehingga per-instance --
 * setiap pemanggilan/render terpisah punya Map sendiri, tidak lagi
 * berbagi state module-level seperti sebelumnya.
 *
 * Karena `useRef` butuh dispatcher React aktif (tidak bisa dipanggil
 * sbg fungsi biasa di luar render), test ini memanggil hook lewat
 * `react-dom/server` (`renderToStaticMarkup`) -- render sekali pass,
 * tanpa DOM/jsdom, cukup untuk menangkap tuple [getRef, setRef] yang
 * closure-nya (menutup `map` milik render tsb) tetap hidup dan bisa
 * dipanggil setelah render selesai. Ini menghindari kebutuhan jsdom
 * (renderHook dari @testing-library/react butuh document), jadi file
 * ini tetap jalan di project "unit" (node).
 */

import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import useDynamicRefs from "./useDynamicRefs";

function callHook() {
  let result;
  function TestComponent() {
    result = useDynamicRefs();
    return null;
  }
  renderToStaticMarkup(React.createElement(TestComponent));
  return result;
}

describe("useDynamicRefs", () => {
  it("mengembalikan tuple [getRef, setRef] berupa function", () => {
    const result = callHook();

    expect(result).toHaveLength(2);
    expect(typeof result[0]).toBe("function");
    expect(typeof result[1]).toBe("function");
  });

  it("setRef membuat object ref baru berbentuk {current: null} dan mengembalikannya", () => {
    const [, setRef] = callHook();

    const ref = setRef("row-1");

    expect(ref).toEqual({ current: null });
  });

  it("getRef mengembalikan ref persis sama (identity) dgn yang disimpan setRef untuk key yang sama", () => {
    const [getRef, setRef] = callHook();

    const ref = setRef("row-2");

    expect(getRef("row-2")).toBe(ref);
  });

  it("getRef untuk key yang belum pernah di-set mengembalikan undefined", () => {
    const [getRef] = callHook();

    expect(getRef("key-yang-tidak-pernah-di-set")).toBeUndefined();
  });

  it("setRef dipanggil ulang dgn key sama membuat ref BARU (identity beda) dan menimpa ref lama di map", () => {
    const [getRef, setRef] = callHook();

    const first = setRef("row-3");
    const second = setRef("row-3");

    expect(second).not.toBe(first);
    expect(getRef("row-3")).toBe(second);
  });

  it("setRef dgn key falsy (undefined) memanggil console.warn dan mengembalikan undefined tanpa menyimpan apapun", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const [getRef, setRef] = callHook();

    const result = setRef(undefined);

    expect(warnSpy).toHaveBeenCalledWith(
      "useDynamicRefs: Cannot set ref without key ",
    );
    expect(result).toBeUndefined();
    expect(getRef(undefined)).toBeUndefined();

    warnSpy.mockRestore();
  });

  it("setRef dgn key falsy (empty string) juga tidak menyimpan ref apapun", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const [getRef, setRef] = callHook();

    setRef("");

    expect(getRef("")).toBeUndefined();

    warnSpy.mockRestore();
  });

  it("getRef dgn key falsy (null) memanggil console.warn dan mengembalikan undefined", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const [getRef] = callHook();

    const result = getRef(null);

    expect(warnSpy).toHaveBeenCalledWith(
      "useDynamicRefs: Cannot get ref without key",
    );
    expect(result).toBeUndefined();

    warnSpy.mockRestore();
  });

  it("map penyimpanan bersifat per-instance: dua render useDynamicRefs() berbeda TIDAK berbagi state (bukan module-level singleton lagi)", () => {
    const [, setRefFromFirstInstance] = callHook();
    const [getRefFromSecondInstance] = callHook();

    setRefFromFirstInstance("shared-key");

    // getRef dari instance hook (render) yang BERBEDA tidak melihat ref
    // yang di-set instance lain, karena `map` kini per-instance (useRef),
    // bukan lagi Map tunggal di module scope.
    expect(getRefFromSecondInstance("shared-key")).toBeUndefined();
  });
});
