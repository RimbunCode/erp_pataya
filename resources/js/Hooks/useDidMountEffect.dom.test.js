import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import useDidMountEffect from "./useDidMountEffect";

describe("useDidMountEffect", () => {
  it("tidak memanggil callback saat mount pertama", () => {
    const fn = vi.fn();
    renderHook(({ dep }) => useDidMountEffect(fn, [dep]), {
      initialProps: { dep: 1 },
    });

    expect(fn).not.toHaveBeenCalled();
  });

  it("memanggil callback saat dependency berubah setelah mount", () => {
    const fn = vi.fn();
    const { rerender } = renderHook(({ dep }) => useDidMountEffect(fn, [dep]), {
      initialProps: { dep: 1 },
    });

    expect(fn).not.toHaveBeenCalled();

    rerender({ dep: 2 });
    expect(fn).toHaveBeenCalledTimes(1);

    rerender({ dep: 3 });
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
