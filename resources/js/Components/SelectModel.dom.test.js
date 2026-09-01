import { describe, expect, it, vi, beforeEach } from "vitest";

const axiosPost = vi.fn();
vi.mock("axios", () => ({
  default: { post: (...args) => axiosPost(...args) },
}));

const toastError = vi.fn();
vi.mock("@/lib/gooeyToast", () => ({
  gooeyToast: { error: (...args) => toastError(...args) },
}));

// Tambahkan route() ke window jsdom yang sudah ada -- JANGAN replace window
// seluruhnya (vi.stubGlobal("window", {...})), karena itu menghapus semua
// property jsdom lain (location, dsb) yang dibutuhkan dependency transitive.
window.route = (name) => name;

const { loadFromModel } = await import("./SelectModel.jsx");

const t = (key) => `TR:${key}`;

describe("loadFromModel", () => {
  beforeEach(() => {
    axiosPost.mockReset();
    toastError.mockReset();
  });

  it("mode direct (tanpa select): return rows apa adanya", async () => {
    axiosPost.mockResolvedValue({
      data: { model: "App\\Models\\User", data: { data: [{ id: 1 }] } },
    });

    const result = await loadFromModel("App\\Models\\User", 1, null, t);

    expect(axiosPost).toHaveBeenCalledWith("model.selectData", {
      model: "App\\Models\\User",
      select: undefined,
      baseFilters: { id: 1 },
      with: undefined,
      show: 1,
      page: 1,
    });
    expect(result).toEqual({
      items: [{ id: 1 }],
      model: "App\\Models\\User",
      mode: "direct",
      sourceModel: null,
      sourceIds: null,
    });
  });

  it("mode self-extraction (dengan select): flatMap relasi dari tiap row", async () => {
    axiosPost.mockResolvedValue({
      data: {
        model: "App\\Models\\PurchaseOrder",
        data: {
          data: [
            { id: 1, items: [{ id: 10 }, { id: 11 }] },
            { id: 2, items: [{ id: 12 }] },
          ],
        },
      },
    });

    const result = await loadFromModel(
      "App\\Models\\PurchaseOrder",
      1,
      "items",
      t,
    );

    expect(axiosPost).toHaveBeenCalledWith(
      "model.selectData",
      expect.objectContaining({ select: "items", with: ["items"] }),
    );
    expect(result).toEqual({
      items: [{ id: 10 }, { id: 11 }, { id: 12 }],
      model: "App\\Models\\PurchaseOrder",
      mode: "self-extraction",
      sourceModel: "App\\Models\\PurchaseOrder",
      sourceIds: [1],
    });
  });

  it("row tanpa relasi select tidak menyumbang item (default ke [])", async () => {
    axiosPost.mockResolvedValue({
      data: {
        model: "App\\Models\\PurchaseOrder",
        data: { data: [{ id: 1 }] }, // tidak ada key "items"
      },
    });

    const result = await loadFromModel(
      "App\\Models\\PurchaseOrder",
      1,
      "items",
      t,
    );

    expect(result.items).toEqual([]);
  });

  it("return null dan menampilkan toast error saat request gagal", async () => {
    axiosPost.mockRejectedValue(new Error("network error"));

    const result = await loadFromModel("App\\Models\\User", 1, null, t);

    expect(result).toBeNull();
    expect(toastError).toHaveBeenCalledWith("TR:core.errors.fetch_failed");
  });

  it("data.data.data kosong/undefined default ke array kosong", async () => {
    axiosPost.mockResolvedValue({ data: {} });

    const result = await loadFromModel("App\\Models\\User", 1, null, t);

    expect(result.items).toEqual([]);
  });
});
