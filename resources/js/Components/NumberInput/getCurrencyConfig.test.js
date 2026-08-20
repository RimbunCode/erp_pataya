import { describe, expect, it, vi, beforeEach } from "vitest";

const getDataModel = vi.fn();
const getFromLocalStorage = vi.fn();
const saveToLocalStorage = vi.fn();
vi.mock("@/lib/utils", () => ({
  getDataModel: (...a) => getDataModel(...a),
  getFromLocalStorage: (...a) => getFromLocalStorage(...a),
  saveToLocalStorage: (...a) => saveToLocalStorage(...a),
}));

import { getCurrencyConfig } from "./getCurrencyConfig";

describe("getCurrencyConfig", () => {
  beforeEach(() => {
    getDataModel.mockReset();
    getFromLocalStorage.mockReset();
    saveToLocalStorage.mockReset();
  });

  it("mengembalikan null bila code kosong/null dan bukan 'default'", async () => {
    expect(await getCurrencyConfig(null)).toBeNull();
    expect(await getCurrencyConfig("")).toBeNull();
    expect(getDataModel).not.toHaveBeenCalled();
  });

  it("code='default' memakai defaultCode", async () => {
    getFromLocalStorage.mockReturnValue(null);
    getDataModel.mockResolvedValue({ symbol: "Rp" });

    await getCurrencyConfig("default", "idr");

    expect(getDataModel).toHaveBeenCalledWith(
      "App\\Models\\Core\\Currency",
      { code: "IDR" },
      { limit: 1 },
    );
  });

  it("mengembalikan hasil dari cache tanpa memanggil getDataModel", async () => {
    getFromLocalStorage.mockReturnValue({ symbol: "$" });

    const result = await getCurrencyConfig("usd");

    expect(result).toEqual({ symbol: "$" });
    expect(getDataModel).not.toHaveBeenCalled();
  });

  it("cache miss: fetch getDataModel, simpan ke cache, kembalikan symbol", async () => {
    getFromLocalStorage.mockReturnValue(null);
    getDataModel.mockResolvedValue({ symbol: "Rp", code: "IDR" });

    const result = await getCurrencyConfig("idr");

    expect(result).toEqual({ symbol: "Rp" });
    expect(saveToLocalStorage).toHaveBeenCalledWith(
      "currency:IDR",
      { symbol: "Rp" },
      7,
    );
  });

  it("mengembalikan null bila getDataModel tidak menemukan row", async () => {
    getFromLocalStorage.mockReturnValue(null);
    getDataModel.mockResolvedValue(null);

    expect(await getCurrencyConfig("xxx")).toBeNull();
    expect(saveToLocalStorage).not.toHaveBeenCalled();
  });

  it("mengembalikan null bila getDataModel throw (mis. network error)", async () => {
    getFromLocalStorage.mockReturnValue(null);
    getDataModel.mockRejectedValue(new Error("network error"));

    expect(await getCurrencyConfig("idr")).toBeNull();
  });
});
