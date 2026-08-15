/**
 * Unit tests untuk FormTable.mergeDiffRows (row diff correctness).
 * Task 11.4 (spec value-before-optimization).
 *
 * Validates: Requirements 4.1, 4.2, 4.3, 4.4
 * Feature: value-before-optimization
 */

import { describe, it, expect } from "vitest";
import { mergeDiffRows } from "./FormTable";

describe("mergeDiffRows", () => {
  it("baris baru di after (id tidak ada di before) -> ditandai added", () => {
    const before = [{ id: 1, qty: 5 }];
    const after = [
      { id: 1, qty: 5 },
      { id: 2, qty: 3 },
    ];
    const result = mergeDiffRows(before, after, "id");
    expect(result).toHaveLength(2);
    expect(result[0].__diffStatus).toBeUndefined();
    expect(result[1].id).toBe(2);
    expect(result[1].__diffStatus).toBe("added");
  });

  it("baris di before tanpa pasangan di after -> muncul sebagai removed pada index aslinya", () => {
    const before = [
      { id: 1, qty: 5 },
      { id: 2, qty: 3 },
      { id: 3, qty: 1 },
    ];
    const after = [
      { id: 1, qty: 5 },
      { id: 3, qty: 1 },
    ];
    const result = mergeDiffRows(before, after, "id");
    expect(result).toHaveLength(3);
    expect(result[0].id).toBe(1);
    expect(result[0].__diffStatus).toBeUndefined();
    // ghost row id:2 disisipkan di index 1 (posisi aslinya di `before`)
    expect(result[1].id).toBe(2);
    expect(result[1].__diffStatus).toBe("removed");
    expect(result[2].id).toBe(3);
    expect(result[2].__diffStatus).toBeUndefined();
  });

  it("baris ter-match dengan cell berbeda -> tidak ditandai added/removed, __diffBefore terisi untuk perbandingan cell", () => {
    const before = [{ id: 1, qty: 5, price: 100 }];
    const after = [{ id: 1, qty: 10, price: 100 }];
    const result = mergeDiffRows(before, after, "id");
    expect(result).toHaveLength(1);
    expect(result[0].__diffStatus).toBeUndefined();
    expect(result[0].__diffBefore).toEqual(before[0]);
    expect(result[0].qty).toBe(10);
  });

  it("baris tanpa id di kedua sisi -> fallback matching by index", () => {
    const before = [{ qty: 5 }, { qty: 3 }];
    const after = [{ qty: 5 }, { qty: 7 }];
    const result = mergeDiffRows(before, after, "id");
    expect(result).toHaveLength(2);
    expect(result[0].__diffStatus).toBeUndefined();
    expect(result[0].__diffBefore).toEqual(before[0]);
    expect(result[1].__diffStatus).toBeUndefined();
    expect(result[1].__diffBefore).toEqual(before[1]);
    expect(result[1].qty).toBe(7);
  });

  it("before kosong -> semua baris after ditandai added", () => {
    const after = [{ id: 1 }, { id: 2 }];
    const result = mergeDiffRows([], after, "id");
    expect(result).toHaveLength(2);
    expect(result.every((r) => r.__diffStatus === "added")).toBe(true);
  });

  it("after kosong -> semua baris before ditandai removed, urutan dipertahankan", () => {
    const before = [{ id: 1 }, { id: 2 }];
    const result = mergeDiffRows(before, [], "id");
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe(1);
    expect(result[0].__diffStatus).toBe("removed");
    expect(result[1].id).toBe(2);
    expect(result[1].__diffStatus).toBe("removed");
  });

  it("before dan after sama persis -> tidak ada baris added/removed", () => {
    const rows = [{ id: 1, qty: 5 }];
    const result = mergeDiffRows(rows, rows, "id");
    expect(result).toHaveLength(1);
    expect(result[0].__diffStatus).toBeUndefined();
  });

  it("baris ditambah di tengah -> urutan hasil tetap mengikuti after untuk baris ter-match, ghost row di posisi asal", () => {
    const before = [{ id: 1 }, { id: 2 }];
    const after = [{ id: 1 }, { id: 3 }, { id: 2 }];
    const result = mergeDiffRows(before, after, "id");
    const ids = result.map((r) => r.id);
    expect(ids).toEqual([1, 3, 2]);
    expect(result.find((r) => r.id === 3).__diffStatus).toBe("added");
  });
});
