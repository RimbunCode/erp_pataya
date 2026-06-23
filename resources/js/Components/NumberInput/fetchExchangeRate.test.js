import { describe, it, expect, vi, afterEach } from "vitest";

import { fetchExchangeRate } from "./fetchExchangeRate";

describe("fetchExchangeRate", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  const mockFetch = (responseBody, ok = true, status = 200) => {
    global.fetch = vi.fn().mockResolvedValue({
      ok,
      status,
      json: () => Promise.resolve(responseBody),
    });
  };

  const mockFetchJsonError = (jsonError) => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.reject(jsonError),
    });
  };

  it("uses /v2/rate/{base}/{quote} when options.quote is provided", async () => {
    mockFetch({ date: "2026-06-16", base: "USD", quote: "EUR", rate: 0.8619 });

    await fetchExchangeRate("USD", { quote: "EUR" });

    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.frankfurter.dev/v2/rate/USD/EUR",
    );
  });

  it("uses /v2/rates?base={base} when options.quote is omitted", async () => {
    mockFetch([
      { date: "2026-06-16", base: "USD", quote: "EUR", rate: 0.8619 },
    ]);

    await fetchExchangeRate("USD");

    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.frankfurter.dev/v2/rates?base=USD",
    );
  });

  it("appends extra query params (date, providers)", async () => {
    mockFetch({
      date: "2024-01-15",
      base: "USD",
      quote: "EUR",
      rate: 0.91,
    });

    await fetchExchangeRate("USD", {
      quote: "EUR",
      date: "2024-01-15",
      providers: "ECB",
    });

    const calledUrl = global.fetch.mock.calls[0][0];
    expect(calledUrl).toContain("/v2/rate/USD/EUR");
    expect(calledUrl).toContain("date=2024-01-15");
    expect(calledUrl).toContain("providers=ECB");
  });

  it("returns { rate, base, quote, date } from single-object response", async () => {
    mockFetch({ date: "2026-06-16", base: "USD", quote: "EUR", rate: 0.8619 });

    const result = await fetchExchangeRate("USD", { quote: "EUR" });

    expect(result).toEqual({
      rate: 0.8619,
      base: "USD",
      quote: "EUR",
      date: "2026-06-16",
    });
  });

  it("returns first entry from array response (/v2/rates fallback)", async () => {
    mockFetch([
      { date: "2026-06-16", base: "USD", quote: "EUR", rate: 0.8619 },
      { date: "2026-06-16", base: "USD", quote: "IDR", rate: 17723 },
    ]);

    const result = await fetchExchangeRate("USD");

    expect(result).toEqual({
      rate: 0.8619,
      base: "USD",
      quote: "EUR",
      date: "2026-06-16",
    });
  });

  it("throws with API error message from JSON body", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 422,
      json: () => Promise.resolve({ message: "Could not find currency ABC" }),
    });

    await expect(fetchExchangeRate("ABC", { quote: "XYZ" })).rejects.toThrow(
      "Could not find currency ABC",
    );
  });

  it("throws with status fallback when JSON body is not parseable", async () => {
    mockFetchJsonError(new SyntaxError("Unexpected token"));

    await expect(fetchExchangeRate("USD", { quote: "EUR" })).rejects.toThrow(
      "Exchange rate fetch failed: 500",
    );
  });

  it("throws when array response is empty", async () => {
    mockFetch([]);

    await expect(fetchExchangeRate("USD")).rejects.toThrow(
      "No exchange rate data returned",
    );
  });

  it("ignores null-valued extra options (does not append to URL)", async () => {
    mockFetch({ date: "2026-06-16", base: "USD", quote: "EUR", rate: 0.8619 });

    await fetchExchangeRate("USD", {
      quote: "EUR",
      date: null,
      providers: undefined,
    });

    const calledUrl = global.fetch.mock.calls[0][0];
    expect(calledUrl).toBe("https://api.frankfurter.dev/v2/rate/USD/EUR");
  });
});
