import { describe, expect, it } from "vitest";
import { renderHook } from "@testing-library/react";
import { useFollowingDate } from "./otherModuleDefaults";

const at = (day, hour = 10) => new Date(2030, 2, day, hour, 0);
const time = (patch, field = "target") => patch[field]?.getTime();

describe("useFollowingDate", () => {
  describe("initialPatch (default form baru)", () => {
    it("mengisi target = source + N hari (P-O3)", () => {
      const { result } = renderHook(() => useFollowingDate(7));

      expect(time(result.current.initialPatch(at(1), "target"))).toBe(
        at(8).getTime(),
      );
    });

    it("0 hari menyamakan target dengan source", () => {
      const { result } = renderHook(() => useFollowingDate(0));

      expect(time(result.current.initialPatch(at(3), "target"))).toBe(
        at(3).getTime(),
      );
    });

    it.each([
      ["tanpa setting hari", null, at(1)],
      ["hari kosong", "", at(1)],
      ["tanpa source", 7, null],
      ["source tidak valid", 7, "bukan tanggal"],
    ])("mengembalikan objek kosong: %s", (_label, days, source) => {
      const { result } = renderHook(() => useFollowingDate(days));

      expect(result.current.initialPatch(source, "target")).toEqual({});
    });
  });

  describe("followPatch (user mengubah source)", () => {
    it("mengikuti perubahan source selama target belum disentuh", () => {
      const { result } = renderHook(() => useFollowingDate(7));
      const initial = result.current.initialPatch(at(1), "target");

      const first = result.current.followPatch(
        at(10),
        initial.target,
        "target",
      );
      expect(time(first)).toBe(at(17).getTime());

      const second = result.current.followPatch(at(20), first.target, "target");
      expect(time(second)).toBe(at(27).getTime());
    });

    it("mengisi target kosong dengan source + N hari (tiket: start_date dipilih kemudian)", () => {
      const { result } = renderHook(() => useFollowingDate(3));

      expect(time(result.current.followPatch(at(6), undefined, "target"))).toBe(
        at(9).getTime(),
      );
    });

    it("berhenti mengikuti setelah markTouched", () => {
      const { result } = renderHook(() => useFollowingDate(7));
      const initial = result.current.initialPatch(at(1), "target");

      result.current.markTouched();

      expect(
        result.current.followPatch(at(10), initial.target, "target"),
      ).toEqual({});
      expect(result.current.followPatch(at(11), at(25), "target")).toEqual({});
    });

    it("menganggap target yang berbeda dari hasil otomatis sebagai sentuhan user", () => {
      const { result } = renderHook(() => useFollowingDate(7));
      result.current.initialPatch(at(1), "target");

      expect(result.current.followPatch(at(10), at(29), "target")).toEqual({});
      // Tetap tidak mengikuti walau nilainya kemudian kebetulan sama dengan hasil otomatis.
      expect(result.current.followPatch(at(12), at(15), "target")).toEqual({});
    });

    it("tidak menimpa nilai draft yang dipulihkan (tanpa initialPatch sebelumnya)", () => {
      const { result } = renderHook(() => useFollowingDate(7));

      expect(result.current.followPatch(at(5), at(28), "target")).toEqual({});
    });

    it.each([
      ["tanpa setting hari", null],
      ["hari kosong", undefined],
    ])("tidak mengisi apa pun: %s", (_label, days) => {
      const { result } = renderHook(() => useFollowingDate(days));

      expect(result.current.followPatch(at(1), undefined, "target")).toEqual(
        {},
      );
    });

    it("tidak mengisi saat source dikosongkan", () => {
      const { result } = renderHook(() => useFollowingDate(7));
      const initial = result.current.initialPatch(at(1), "target");

      expect(
        result.current.followPatch(null, initial.target, "target"),
      ).toEqual({});
    });
  });
});
