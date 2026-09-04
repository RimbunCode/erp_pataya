import { describe, expect, it } from "vitest";

import { hasBlockDescription } from "./BlockDescriptionTooltip";

// hasBlockDescription() adalah fungsi murni (tanpa DOM) yg menentukan apakah
// BlockDescriptionTooltip perlu dirender sama sekali -- diuji terpisah di sini
// sesuai prioritas unit test murni, sebelum test render komponennya sendiri
// (lihat BlockDescriptionTooltip.rtl.test.jsx).
describe("hasBlockDescription", () => {
  describe("nilai falsy (tidak ada deskripsi sama sekali)", () => {
    it.each([
      ["undefined", undefined],
      ["null", null],
      ["string kosong", ""],
      ["angka 0", 0],
      ["false", false],
    ])("mengembalikan false utk %s", (_label, value) => {
      expect(hasBlockDescription(value)).toBe(false);
    });
  });

  describe("deskripsi berbentuk string biasa (data lama, sebelum TiptapEditor)", () => {
    it("mengembalikan false utk string berisi whitespace saja", () => {
      expect(hasBlockDescription("   ")).toBe(false);
      expect(hasBlockDescription("\n\t ")).toBe(false);
    });

    it("mengembalikan true utk string berisi teks", () => {
      expect(hasBlockDescription("Deskripsi block")).toBe(true);
    });

    it("mengembalikan true utk string dgn whitespace di sekitar teks (trim hanya utk pengecekan, nilai asli tidak diubah)", () => {
      expect(hasBlockDescription("  Deskripsi block  ")).toBe(true);
    });
  });

  describe("deskripsi berbentuk objek { json, html } (hasil TiptapEditor)", () => {
    it("mengembalikan false utk objek tanpa field html", () => {
      expect(hasBlockDescription({})).toBe(false);
      expect(hasBlockDescription({ json: { type: "doc" } })).toBe(false);
    });

    it("mengembalikan false utk field html null/undefined/kosong/whitespace", () => {
      expect(hasBlockDescription({ html: null })).toBe(false);
      expect(hasBlockDescription({ html: undefined })).toBe(false);
      expect(hasBlockDescription({ html: "" })).toBe(false);
      expect(hasBlockDescription({ html: "   " })).toBe(false);
    });

    it("mengembalikan true utk field html berisi markup", () => {
      expect(hasBlockDescription({ html: "<p>Halo</p>" })).toBe(true);
    });

    it("mengabaikan field json -- hanya field html yg menentukan hasil", () => {
      expect(
        hasBlockDescription({ json: { type: "doc" }, html: "<p>Isi</p>" }),
      ).toBe(true);
    });

    it("hanya cek keberadaan string html (bukan konten visualnya) -- tag kosong berisi whitespace tetap dianggap true", () => {
      // Bukan bug: docstring fungsi ini hanya menjanjikan "ada konten html
      // atau tidak", bukan "ada konten visible atau tidak". trim() dilakukan
      // pada string html mentah, bukan pada textContent hasil parse HTML,
      // jadi tag kosong ("<p></p>") tetap dianggap punya deskripsi.
      expect(hasBlockDescription({ html: "<p></p>" })).toBe(true);
    });
  });

  describe("tipe data tak terduga tidak menyebabkan crash", () => {
    it("angka non-nol -- truthy, tapi tidak ada field html jadi false", () => {
      expect(hasBlockDescription(123)).toBe(false);
    });

    it("array kosong -- truthy, tapi tidak ada field html jadi false", () => {
      expect(hasBlockDescription([])).toBe(false);
    });
  });
});
