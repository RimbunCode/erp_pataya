/**
 * Unit test untuk assetItems.js -- util gabungan baris tabel Items dan Asset Items
 * (spec asset-items-section, Requirement 5.1-5.3).
 */

import { describe, it, expect } from "vitest";
import {
  allocationContext,
  getAllItems,
  partitionRowsByAssetId,
} from "./assetItems";

describe("partitionRowsByAssetId", () => {
  it("memisahkan baris berdasarkan himpunan id aset tetap dengan urutan terjaga", () => {
    const rows = [
      { id: "r1", item: { id: "v1" } },
      { id: "a1", asset: { id: "a1" } },
      { id: "r2", item: { id: "v3" } },
      { id: "a2", asset_id: "a2" },
    ];

    const parts = partitionRowsByAssetId(rows);

    expect(parts.items.map((row) => row.id)).toEqual(["r1", "r2"]);
    expect(parts.asset_items.map((row) => row.id)).toEqual(["a1", "a2"]);
  });

  it("himpunan kosong: semua baris tetap di items", () => {
    const rows = [{ id: "r1", item: { id: "v1" } }];

    const parts = partitionRowsByAssetId(rows);

    expect(parts.items).toEqual(rows);
    expect(parts.asset_items).toEqual([]);
  });

  it("baris tanpa id asset dianggap barang biasa", () => {
    const rows = [{ id: "r1" }, { id: "r2", item: null }];

    const parts = partitionRowsByAssetId(rows);

    expect(parts.items).toHaveLength(2);
    expect(parts.asset_items).toEqual([]);
  });

  it("rows null/undefined menghasilkan dua daftar kosong", () => {
    expect(partitionRowsByAssetId(null)).toEqual({
      items: [],
      asset_items: [],
    });
    expect(partitionRowsByAssetId(undefined)).toEqual({
      items: [],
      asset_items: [],
    });
  });
});

describe("getAllItems", () => {
  it("menggabungkan items lebih dulu lalu asset_items dengan urutan terjaga", () => {
    const data = {
      items: [{ id: "r1" }, { id: "r2" }],
      asset_items: [{ id: "a1" }],
    };

    expect(getAllItems(data).map((row) => row.id)).toEqual(["r1", "r2", "a1"]);
  });

  it("menganggap key yang tidak ada, null, atau undefined sebagai daftar kosong", () => {
    expect(getAllItems({})).toEqual([]);
    expect(getAllItems({ items: null, asset_items: null })).toEqual([]);
    expect(getAllItems(undefined)).toEqual([]);
    expect(getAllItems({ asset_items: [{ id: "a1" }] })).toEqual([
      { id: "a1" },
    ]);
  });

  it("tidak memutasi data input", () => {
    const data = { items: [{ id: "r1" }], asset_items: [{ id: "a1" }] };
    getAllItems(data);

    expect(data.items).toHaveLength(1);
    expect(data.asset_items).toHaveLength(1);
  });
});

describe("allocationContext", () => {
  const data = {
    items: [{ id: "r1" }, { id: "r2" }],
    asset_items: [{ id: "a1" }, { id: "a2" }, { id: "a3" }],
  };

  it("kind item: baris tabel aktif = items, posisi tidak bergeser", () => {
    const dataTable = [{ id: "r1-baru" }, { id: "r2-baru" }];

    const ctx = allocationContext({ kind: "item", dataTable, index: 1, data });

    expect(ctx.rows.map((row) => row.id)).toEqual([
      "r1-baru",
      "r2-baru",
      "a1",
      "a2",
      "a3",
    ]);
    expect(ctx.index).toBe(1);
    expect(ctx.rows[ctx.index]).toBe(dataTable[1]);
  });

  it("kind asset: dataTable menggantikan asset_items dan posisi digeser sebanyak items", () => {
    const dataTable = [{ id: "a1-baru" }, { id: "a2-baru" }];

    const ctx = allocationContext({ kind: "asset", dataTable, index: 1, data });

    expect(ctx.rows.map((row) => row.id)).toEqual([
      "r1",
      "r2",
      "a1-baru",
      "a2-baru",
    ]);
    expect(ctx.index).toBe(3);
    expect(ctx.rows[ctx.index]).toBe(dataTable[1]);
  });

  it("tabel lain kosong atau tidak ada: posisi tetap benar", () => {
    const dataTable = [{ id: "a1" }];

    const ctx = allocationContext({
      kind: "asset",
      dataTable,
      index: 0,
      data: { items: null },
    });

    expect(ctx.rows).toEqual([{ id: "a1" }]);
    expect(ctx.index).toBe(0);
  });

  it("dataTable null diperlakukan sebagai kosong", () => {
    const ctx = allocationContext({
      kind: "item",
      dataTable: null,
      index: 0,
      data: { asset_items: [{ id: "a1" }] },
    });

    expect(ctx.rows).toEqual([{ id: "a1" }]);
  });
});
