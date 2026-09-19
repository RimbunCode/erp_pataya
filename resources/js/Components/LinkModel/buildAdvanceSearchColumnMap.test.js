/**
 * Unit tests untuk buildAdvanceSearchColumnMap (pure function, node env).
 * Task 3.4 (spec linkmodel-advanced-search).
 *
 * Property 1 (design.md): himpunan kolom yang tampil sbg opsi column-picker
 * di Advance Search Dialog SELALU sama dengan
 * { c ∈ getColumns(M) | c.linkable === true } ∪ templateLinkColumns(M),
 * terlepas dari prop `fields`.
 *
 * Validates: Requirements 2.3, 2.6, 2.7
 */

import { describe, it, expect } from "vitest";
import {
  buildAdvanceSearchColumnMap,
  buildAdvanceSearchFilterColumnMap,
} from "./useAdvanceSearchModel";

const rawColumns = [
  { name: "id", type: "number", linkable: false },
  { name: "code", type: "string", linkable: false }, // kolom sumber templateLink, TIDAK linkable
  { name: "name", type: "string", linkable: true },
  { name: "valuation_rate", type: "currency", linkable: false }, // non-linkable, non-templateLink
  { name: "items", type: "relations", linkable: false },
  { name: "meta", type: "json", linkable: true },
  { name: "hiddenCol", type: "string", linkable: true, hidden: true },
  { name: "ignoredCol", type: "string", linkable: true, ignore: true },
];

describe("buildAdvanceSearchColumnMap", () => {
  const map = buildAdvanceSearchColumnMap(rawColumns, ["code"]);

  it("kolom linkable===true masuk peta", () => {
    expect(map).toHaveProperty("name");
  });

  it("kolom sumber templateLink masuk peta walau linkable===false", () => {
    expect(map).toHaveProperty("code");
  });

  it("kolom non-linkable-non-templateLink terbuang", () => {
    expect(map).not.toHaveProperty("valuation_rate");
    expect(map).not.toHaveProperty("id");
  });

  it("relasi (type relations)/json/hidden/ignore terbuang", () => {
    expect(map).not.toHaveProperty("items");
    expect(map).not.toHaveProperty("meta");
    expect(map).not.toHaveProperty("hiddenCol");
    expect(map).not.toHaveProperty("ignoredCol");
  });

  it("kolom sumber templateLink dapat locked:true", () => {
    expect(map.code.locked).toBe(true);
    expect(map.code.show).toBe(true);
  });

  it("kolom data linkable lain dapat locked:false", () => {
    expect(map.name.locked).toBe(false);
  });

  it("independen dari fields -- hasil sama persis walau dipanggil ulang tanpa argumen fields apapun", () => {
    // buildAdvanceSearchColumnMap hanya menerima (rawColumns, templateLinkColumnNames);
    // tidak ada parameter `fields` yg bisa mengubah hasil -- Property 1.
    const again = buildAdvanceSearchColumnMap(rawColumns, ["code"]);
    expect(again).toEqual(map);
  });

  it("rawColumns kosong/undefined -- return peta kosong, tidak error", () => {
    expect(buildAdvanceSearchColumnMap([], [])).toEqual({});
    expect(buildAdvanceSearchColumnMap(undefined, [])).toEqual({});
  });
});

describe("buildAdvanceSearchFilterColumnMap", () => {
  // Backend mengevaluasi `filters` terhadap schema penuh -- kolom filter TIDAK
  // dibatasi linkable (beda dari peta kolom tabel di atas).
  const map = buildAdvanceSearchFilterColumnMap(rawColumns);

  it("SEMUA kolom bernama masuk -- termasuk non-linkable, non-templateLink, relasi", () => {
    expect(Object.keys(map)).toEqual([
      "id",
      "code",
      "name",
      "valuation_rate",
      "items",
      "meta",
      "hiddenCol",
      "ignoredCol",
    ]);
  });

  it("nilai kolom diteruskan apa adanya (tanpa flag locked/show dari peta tabel)", () => {
    expect(map.valuation_rate).toBe(rawColumns[3]);
    expect(map.valuation_rate).not.toHaveProperty("locked");
  });

  it("peta tabel tetap terbatas -- kolom filter lebih luas dari kolom tampil", () => {
    const tableMap = buildAdvanceSearchColumnMap(rawColumns, ["code"]);
    expect(Object.keys(map).length).toBeGreaterThan(
      Object.keys(tableMap).length,
    );
    expect(tableMap).not.toHaveProperty("valuation_rate");
    expect(map).toHaveProperty("valuation_rate");
  });

  it("entri tanpa name diabaikan; rawColumns kosong/undefined -- peta kosong", () => {
    expect(buildAdvanceSearchFilterColumnMap([{ type: "string" }])).toEqual({});
    expect(buildAdvanceSearchFilterColumnMap([])).toEqual({});
    expect(buildAdvanceSearchFilterColumnMap(undefined)).toEqual({});
  });
});
