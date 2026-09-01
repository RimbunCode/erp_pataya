import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { resolveCurrencyInput } from "./useCurrency";

describe("resolveCurrencyInput", () => {
  it("null/undefined/'' -> kind 'none'", () => {
    expect(resolveCurrencyInput(null)).toEqual({ kind: "none" });
    expect(resolveCurrencyInput(undefined)).toEqual({ kind: "none" });
    expect(resolveCurrencyInput("")).toEqual({ kind: "none" });
  });

  it("string non-kosong -> kind 'fetch' dengan code tsb", () => {
    expect(resolveCurrencyInput("idr")).toEqual({ kind: "fetch", code: "idr" });
  });

  it("object dengan symbol -> kind 'symbol', tanpa fetch", () => {
    expect(resolveCurrencyInput({ code: "idr", symbol: "Rp" })).toEqual({
      kind: "symbol",
      symbol: "Rp",
    });
  });

  it("object tanpa symbol tapi ada code -> kind 'fetch'", () => {
    expect(resolveCurrencyInput({ code: "idr" })).toEqual({
      kind: "fetch",
      code: "idr",
    });
  });

  it("object tanpa symbol dan tanpa code -> kind 'none'", () => {
    expect(resolveCurrencyInput({})).toEqual({ kind: "none" });
  });
});

const usePageMock = vi.fn();
vi.mock("@inertiajs/react", () => ({
  usePage: () => usePageMock(),
}));

const getCurrencyConfig = vi.fn();
vi.mock("./getCurrencyConfig", () => ({
  getCurrencyConfig: (...a) => getCurrencyConfig(...a),
}));

const { useCurrency } = await import("./useCurrency");

describe("useCurrency", () => {
  beforeEach(() => {
    getCurrencyConfig.mockReset();
    usePageMock.mockReturnValue({
      props: { preferences: { default_currency_id: "idr" } },
    });
  });

  it("currencyCode null -> symbol null, loading false, tanpa fetch", async () => {
    const { result } = renderHook(() => useCurrency(null));
    expect(result.current).toEqual({ symbol: null, loading: false });
    expect(getCurrencyConfig).not.toHaveBeenCalled();
  });

  it("object dengan symbol -> pakai langsung tanpa fetch", async () => {
    const { result } = renderHook(() =>
      useCurrency({ code: "idr", symbol: "Rp" }),
    );
    await waitFor(() => expect(result.current.symbol).toBe("Rp"));
    expect(getCurrencyConfig).not.toHaveBeenCalled();
  });

  it("string code -> fetch via getCurrencyConfig, symbol terisi setelah resolve", async () => {
    getCurrencyConfig.mockResolvedValue({ symbol: "$" });

    const { result } = renderHook(() => useCurrency("usd"));

    await waitFor(() => expect(result.current.symbol).toBe("$"));
    expect(result.current.loading).toBe(false);
    expect(getCurrencyConfig).toHaveBeenCalledWith("usd", "idr");
  });

  it("getCurrencyConfig gagal -> symbol null, tidak throw", async () => {
    getCurrencyConfig.mockRejectedValue(new Error("network error"));

    const { result } = renderHook(() => useCurrency("usd"));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.symbol).toBeNull();
  });
});
