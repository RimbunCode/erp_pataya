import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import useRowSelection from "./useRowSelection";

const ulidA = { id: "01HZX0000000000000000000AA", name: "A" };
const ulidB = { id: "01HZX0000000000000000000BB", name: "B" };
const num1 = { id: 1, name: "one" };
const num2 = { id: 2, name: "two" };

function setup(resetKey = "k1") {
  return renderHook(({ resetKey }) => useRowSelection({ resetKey }), {
    initialProps: { resetKey },
  });
}

describe("useRowSelection", () => {
  it("mulai kosong", () => {
    const { result } = setup();
    expect(result.current.count).toBe(0);
    expect(result.current.rows).toEqual([]);
    expect(result.current.selected).toBeInstanceOf(Map);
    expect(result.current.isSelected(num1)).toBe(false);
  });

  it("toggle menambah dan menghapus baris", () => {
    const { result } = setup();
    act(() => result.current.toggle(num1, true));
    expect(result.current.isSelected(num1)).toBe(true);
    expect(result.current.count).toBe(1);

    act(() => result.current.toggle(num1, false));
    expect(result.current.isSelected(num1)).toBe(false);
    expect(result.current.count).toBe(0);
  });

  it("setMany(rows, true) memilih banyak baris dan setMany(rows, false) melepasnya", () => {
    const { result } = setup();
    act(() => result.current.setMany([num1, num2, ulidA], true));
    expect(result.current.count).toBe(3);

    act(() => result.current.setMany([num1, ulidA], false));
    expect(result.current.count).toBe(1);
    expect(result.current.isSelected(num2)).toBe(true);
    expect(result.current.isSelected(num1)).toBe(false);
  });

  it("isSelected bekerja untuk id ULID string dan number", () => {
    const { result } = setup();
    act(() => result.current.toggle(ulidA, true));
    act(() => result.current.toggle(num2, true));
    expect(result.current.isSelected(ulidA)).toBe(true);
    expect(result.current.isSelected(ulidB)).toBe(false);
    expect(result.current.isSelected(num2)).toBe(true);
    expect(result.current.isSelected(num1)).toBe(false);
  });

  it("id string '1' dan number 1 adalah kunci berbeda (tanpa coercion)", () => {
    const { result } = setup();
    act(() => result.current.toggle({ id: 1 }, true));
    expect(result.current.isSelected({ id: 1 })).toBe(true);
    expect(result.current.isSelected({ id: "1" })).toBe(false);

    act(() => result.current.toggle({ id: "1" }, true));
    expect(result.current.count).toBe(2);
  });

  it("rows mempertahankan objek terbaru saat baris yang sama dipilih lagi", () => {
    const { result } = setup();
    act(() => result.current.toggle({ id: 1, name: "lama" }, true));
    const newer = { id: 1, name: "baru" };
    act(() => result.current.toggle(newer, true));
    expect(result.current.count).toBe(1);
    expect(result.current.rows).toHaveLength(1);
    expect(result.current.rows[0]).toBe(newer);
  });

  it("rows mengikuti urutan penambahan", () => {
    const { result } = setup();
    act(() => result.current.setMany([num2, num1], true));
    expect(result.current.rows).toEqual([num2, num1]);
  });

  it("clear() mengosongkan seleksi", () => {
    const { result } = setup();
    act(() => result.current.setMany([num1, num2], true));
    act(() => result.current.clear());
    expect(result.current.count).toBe(0);
    expect(result.current.rows).toEqual([]);
  });

  it("mengganti resetKey mengosongkan seleksi, tetapi render pertama tidak", () => {
    const { result, rerender } = setup("k1");
    act(() => result.current.setMany([num1, num2], true));
    expect(result.current.count).toBe(2);

    rerender({ resetKey: "k1" });
    expect(result.current.count).toBe(2);

    rerender({ resetKey: "k2" });
    expect(result.current.count).toBe(0);
  });

  it("toggle/setMany/clear stabil antar render, isSelected stabil bila seleksi tak berubah", () => {
    const { result, rerender } = setup();
    const first = result.current;
    rerender({ resetKey: "k1" });
    expect(result.current.toggle).toBe(first.toggle);
    expect(result.current.setMany).toBe(first.setMany);
    expect(result.current.clear).toBe(first.clear);
    expect(result.current.isSelected).toBe(first.isSelected);

    act(() => result.current.toggle(num1, true));
    expect(result.current.toggle).toBe(first.toggle);
    expect(result.current.setMany).toBe(first.setMany);
    expect(result.current.clear).toBe(first.clear);
  });
});
