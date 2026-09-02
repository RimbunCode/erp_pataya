import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderHook } from "@testing-library/react";
import { LibraryContext, useLibrary } from "./hooks";

/**
 * hooks.js hanya berisi re-export React Context (LibraryContext) dan hook
 * pembacanya (useLibrary = useContext(LibraryContext)). Wrapper Provider
 * ditulis pakai React.createElement (bukan JSX) supaya file ini tetap valid
 * sebagai *.dom.test.js biasa (tidak perlu suffix .rtl.test.jsx) -- tidak
 * ada UI/DOM yang benar-benar dirender, cuma context plumbing lewat
 * renderHook, sama seperti pola useLocale.dom.test.js / useIsDirtyForm.dom.test.js.
 * @param value
 */
function makeWrapper(value) {
  return function Wrapper({ children }) {
    return createElement(LibraryContext.Provider, { value }, children);
  };
}

describe("useLibrary", () => {
  it("mengembalikan undefined saat dipanggil tanpa LibraryContext.Provider", () => {
    const { result } = renderHook(() => useLibrary());

    expect(result.current).toBeUndefined();
  });

  it("mengembalikan value yang disediakan oleh LibraryContext.Provider", () => {
    const contextValue = {
      search: "invoice",
      resultSearch: [{ id: 1, name: "invoice.pdf" }],
      checklistFile: new Set([1]),
      setChecklistFile: () => {},
      imageOnly: false,
    };

    const { result } = renderHook(() => useLibrary(), {
      wrapper: makeWrapper(contextValue),
    });

    expect(result.current).toBe(contextValue);
  });

  it("mengikuti value baru saat Provider di-rerender dengan value berbeda", () => {
    let value = { search: "a" };
    const wrapper = ({ children }) =>
      createElement(LibraryContext.Provider, { value }, children);

    const { result, rerender } = renderHook(() => useLibrary(), { wrapper });

    expect(result.current).toBe(value);

    value = { search: "b" };
    rerender();

    expect(result.current).toBe(value);
  });
});
