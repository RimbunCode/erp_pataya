/**
 * Unit test murni untuk useDynamicRefs.
 *
 * useDynamicRefs() sendiri TIDAK memanggil hook React apapun (bukan
 * useState/useRef/useContext/useEffect) -- ia cuma mengembalikan tuple
 * [getRef, setRef] yang membaca/menulis sebuah `Map` di MODULE SCOPE
 * (React.createRef() dipakai sekadar sbg factory objek {current: null},
 * tidak butuh lifecycle React). Karena itu hook ini aman dipanggil
 * langsung sbg fungsi biasa tanpa renderHook/jsdom.
 *
 * PENTING: `map` di useDynamicRefs.js didefinisikan di module scope
 * (bukan di dalam fungsi useDynamicRefs), sehingga SEMUA pemanggilan
 * useDynamicRefs() -- termasuk di test lain dalam file yang sama --
 * berbagi satu Map yang sama. Supaya test di file ini tidak saling
 * bertabrakan, setiap test memakai key unik.
 */

import { describe, it, expect, vi } from "vitest";
import useDynamicRefs from "./useDynamicRefs";

describe("useDynamicRefs", () => {
  it("mengembalikan tuple [getRef, setRef] berupa function", () => {
    const result = useDynamicRefs();

    expect(result).toHaveLength(2);
    expect(typeof result[0]).toBe("function");
    expect(typeof result[1]).toBe("function");
  });

  it("setRef membuat object ref baru berbentuk {current: null} dan mengembalikannya", () => {
    const [, setRef] = useDynamicRefs();

    const ref = setRef("row-1");

    expect(ref).toEqual({ current: null });
  });

  it("getRef mengembalikan ref persis sama (identity) dgn yang disimpan setRef untuk key yang sama", () => {
    const [getRef, setRef] = useDynamicRefs();

    const ref = setRef("row-2");

    expect(getRef("row-2")).toBe(ref);
  });

  it("getRef untuk key yang belum pernah di-set mengembalikan undefined", () => {
    const [getRef] = useDynamicRefs();

    expect(getRef("key-yang-tidak-pernah-di-set")).toBeUndefined();
  });

  it("setRef dipanggil ulang dgn key sama membuat ref BARU (identity beda) dan menimpa ref lama di map", () => {
    const [getRef, setRef] = useDynamicRefs();

    const first = setRef("row-3");
    const second = setRef("row-3");

    expect(second).not.toBe(first);
    expect(getRef("row-3")).toBe(second);
  });

  it("setRef dgn key falsy (undefined) memanggil console.warn dan mengembalikan undefined tanpa menyimpan apapun", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const [getRef, setRef] = useDynamicRefs();

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
    const [getRef, setRef] = useDynamicRefs();

    setRef("");

    expect(getRef("")).toBeUndefined();

    warnSpy.mockRestore();
  });

  it("getRef dgn key falsy (null) memanggil console.warn dan mengembalikan undefined", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const [getRef] = useDynamicRefs();

    const result = getRef(null);

    expect(warnSpy).toHaveBeenCalledWith(
      "useDynamicRefs: Cannot get ref without key",
    );
    expect(result).toBeUndefined();

    warnSpy.mockRestore();
  });

  it("map penyimpanan bersifat module-level singleton: dua panggilan useDynamicRefs() berbeda berbagi state yang sama, bukan ter-isolasi per-instance", () => {
    const [, setRefFromFirstCall] = useDynamicRefs();
    const [getRefFromSecondCall] = useDynamicRefs();

    const ref = setRefFromFirstCall("shared-key");

    // getRef dari hasil pemanggilan useDynamicRefs() yang BERBEDA tetap
    // melihat ref yang sama, karena `map` bukan state per-instance.
    expect(getRefFromSecondCall("shared-key")).toBe(ref);
  });
});
