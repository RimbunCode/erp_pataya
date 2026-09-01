import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";

const useLaravelReactI18nMock = vi.fn();

vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => useLaravelReactI18nMock(),
}));

import useLocale from "./useLocale";

describe("useLocale", () => {
  it("memetakan properti t dari useLaravelReactI18n menjadi trans", () => {
    const t = vi.fn((key) => key);
    useLaravelReactI18nMock.mockReturnValue({ t });

    const { result } = renderHook(() => useLocale());

    expect(result.current.trans).toBe(t);
  });

  it("meneruskan properti lain (selain t) apa adanya lewat spread", () => {
    const currentLocale = () => "en";
    const setLocale = vi.fn();
    useLaravelReactI18nMock.mockReturnValue({
      t: vi.fn(),
      currentLocale,
      setLocale,
    });

    const { result } = renderHook(() => useLocale());

    expect(result.current.currentLocale).toBe(currentLocale);
    expect(result.current.setLocale).toBe(setLocale);
  });

  it("tidak menyertakan key 't' asli pada hasil (hanya 'trans')", () => {
    const t = vi.fn();
    useLaravelReactI18nMock.mockReturnValue({ t, currentLocale: () => "id" });

    const { result } = renderHook(() => useLocale());

    expect(result.current).not.toHaveProperty("t");
    expect(Object.keys(result.current).sort()).toEqual(
      ["currentLocale", "trans"].sort(),
    );
  });
});
