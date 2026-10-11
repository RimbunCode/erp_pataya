import { describe, expect, it } from "vitest";

import {
  buildEditorPrefill,
  canEditLeafInCell,
  dottedColumnFor,
  leafCheckedList,
  leafExcluded,
  recordLabel,
  sameLabel,
} from "./valueInputUtils";

const col = (type, extra = {}) => ({ name: "x", type, ...extra });

const stringFree = col("string");
const stringOpts = col("string", { options: ["a", "b"] });
const number = col("number");
const currency = col("currency");
const bool = col("boolean");
const date = col("date");
const datetime = col("datetime");
const relation = col("relation", { related: "App\\Models\\Category" });
const relationNoRelated = col("relation");
const time = col("time");

const leaf = (o, v) => ({ k: "x", o, v });

describe("canEditLeafInCell", () => {
  it("leaf mode kolom selalu ke Builder", () => {
    for (const c of [stringFree, number, date, relation]) {
      expect(
        canEditLeafInCell(c, leaf("=", { mode: "column", ref: "other" })),
      ).toBe("builder");
    }
  });

  it("string bebas: matches/!matches/in/!in/set/!set bisa, = != starts_with ends_with ke Builder", () => {
    for (const o of ["matches", "!matches", "in", "!in", "set", "!set"]) {
      expect(canEditLeafInCell(stringFree, leaf(o, "a"))).toBe("edit");
    }
    for (const o of ["=", "!=", "starts_with", "ends_with"]) {
      expect(canEditLeafInCell(stringFree, leaf(o, "a"))).toBe("builder");
    }
  });

  it("string ber-opsi (mode list): = != in !in bisa, matches/starts_with ke Builder", () => {
    for (const o of ["=", "!=", "in", "!in", "set", "!set"]) {
      expect(canEditLeafInCell(stringOpts, leaf(o, "a"))).toBe("edit");
    }
    for (const o of ["matches", "starts_with", "ends_with"]) {
      expect(canEditLeafInCell(stringOpts, leaf(o, "a"))).toBe("builder");
    }
  });

  it("number/currency: perbandingan, between, in bisa; !between ke Builder", () => {
    for (const c of [number, currency]) {
      for (const o of [
        "=",
        "!=",
        ">",
        ">=",
        "<",
        "<=",
        "between",
        "in",
        "!in",
      ]) {
        expect(canEditLeafInCell(c, leaf(o, 1))).toBe("edit");
      }
      expect(canEditLeafInCell(c, leaf("!between", [1, 2]))).toBe("builder");
    }
  });

  it("boolean: = / != bisa", () => {
    expect(canEditLeafInCell(bool, leaf("=", true))).toBe("edit");
    expect(canEditLeafInCell(bool, leaf("!=", true))).toBe("edit");
  });

  it("date/datetime: in_period/!in_period bisa, operator lain ke Builder", () => {
    for (const c of [date, datetime]) {
      expect(canEditLeafInCell(c, leaf("in_period", {}))).toBe("edit");
      expect(canEditLeafInCell(c, leaf("!in_period", {}))).toBe("edit");
      expect(canEditLeafInCell(c, leaf(">", "2026-01-01"))).toBe("builder");
    }
  });

  it("relasi: = != in !in set bisa; tanpa `related` atau operator lain ke Builder", () => {
    for (const o of ["=", "!=", "in", "!in", "set", "!set"]) {
      expect(canEditLeafInCell(relation, leaf(o, { id: 1 }))).toBe("edit");
    }
    expect(canEditLeafInCell(relation, leaf("matches", "a"))).toBe("builder");
    expect(canEditLeafInCell(relationNoRelated, leaf("=", { id: 1 }))).toBe(
      "builder",
    );
  });

  it("set/!set bisa utk semua mode yang punya mode nilai", () => {
    for (const c of [stringFree, stringOpts, number, bool, date, relation]) {
      expect(canEditLeafInCell(c, leaf("set"))).toBe("edit");
      expect(canEditLeafInCell(c, leaf("!set"))).toBe("edit");
    }
  });

  it("tipe tanpa mode nilai (time) ke Builder", () => {
    expect(canEditLeafInCell(time, leaf("=", "10:00"))).toBe("builder");
  });

  it("tanpa kolom: key bertitik = dotted, selain itu Builder", () => {
    expect(
      canEditLeafInCell(null, { k: "category.name", o: "matches", v: "a" }),
    ).toBe("dotted");
    expect(canEditLeafInCell(null, { k: "ghost", o: "=", v: 1 })).toBe(
      "builder",
    );
  });
});

describe("dottedColumnFor", () => {
  it("string polos berjudul segmen terakhir", () => {
    expect(dottedColumnFor({ k: "category.name" })).toEqual({
      name: "category.name",
      type: "string",
      title: "name",
    });
  });
});

describe("buildEditorPrefill", () => {
  const chip = (node, id = "L1") => ({ id, node });

  it("text matches -> teks polos; negasi -> awalan !", () => {
    expect(
      buildEditorPrefill(stringFree, chip({ k: "x", o: "matches", v: "abc" })),
    ).toMatchObject({
      editId: "L1",
      initialText: "abc",
      initialTextChips: [],
      initialChecked: [],
    });
    expect(
      buildEditorPrefill(stringFree, chip({ k: "x", o: "!matches", v: "abc" })),
    ).toMatchObject({ initialText: "!abc" });
  });

  it("text in -> chip nilai (string), teks kosong", () => {
    expect(
      buildEditorPrefill(stringFree, chip({ k: "x", o: "in", v: ["a", "b"] })),
    ).toMatchObject({ initialText: "", initialTextChips: ["a", "b"] });
  });

  it("number: perbandingan & between kembali sebagai teks bersimbol (bukan operator hilang)", () => {
    expect(
      buildEditorPrefill(number, chip({ k: "x", o: ">=", v: 5 })),
    ).toMatchObject({ initialText: ">=5" });
    expect(
      buildEditorPrefill(number, chip({ k: "x", o: "between", v: [1, 9] })),
    ).toMatchObject({ initialText: "1..9" });
    expect(
      buildEditorPrefill(number, chip({ k: "x", o: "!=", v: 500 })),
    ).toMatchObject({ initialText: "!500" });
  });

  it("number in -> chip nilai", () => {
    expect(
      buildEditorPrefill(number, chip({ k: "x", o: "in", v: [1, 2] })),
    ).toMatchObject({ initialTextChips: ["1", "2"] });
  });

  it("list: = / in -> initialChecked; negasi -> awalan ! di teks", () => {
    expect(
      buildEditorPrefill(stringOpts, chip({ k: "x", o: "in", v: ["a", "b"] })),
    ).toMatchObject({ initialChecked: ["a", "b"], initialText: "" });
    expect(
      buildEditorPrefill(stringOpts, chip({ k: "x", o: "!=", v: "a" })),
    ).toMatchObject({ initialChecked: ["a"], initialText: "!" });
  });

  it("relasi: record + awalan ! bila negasi", () => {
    const rec = { id: 7, name: "Sparepart" };
    expect(
      buildEditorPrefill(relation, chip({ k: "x", o: "in", v: [rec] })),
    ).toMatchObject({ initialRecords: [rec], initialText: "" });
    expect(
      buildEditorPrefill(relation, chip({ k: "x", o: "!=", v: rec })),
    ).toMatchObject({ initialRecords: [rec], initialText: "!" });
  });

  it("date: satu periode -> teks, banyak periode -> chip tanggal", () => {
    const one = { period: "month", operator: "is", year: 2026, month: 8 };
    const two = { period: "month", operator: "is", year: 2026, month: 9 };
    const single = buildEditorPrefill(
      date,
      chip({ k: "x", o: "in_period", v: one }),
    );
    expect(single.initialDateChips).toEqual([]);
    expect(single.initialText).not.toBe("");

    const multi = buildEditorPrefill(
      date,
      chip({ k: "x", o: "in_period", v: [one, two] }),
    );
    expect(multi.initialDateChips).toHaveLength(2);
    expect(multi.initialText).toBe("");
  });

  it("date negasi satu periode: teks diawali !", () => {
    const one = { period: "month", operator: "is", year: 2026, month: 8 };
    expect(
      buildEditorPrefill(date, chip({ k: "x", o: "!in_period", v: one }))
        .initialText,
    ).toMatch(/^!/);
  });

  it("leaf dotted tanpa kolom: teks polos", () => {
    const dotted = dottedColumnFor({ k: "category.name" });
    expect(
      buildEditorPrefill(
        null,
        chip({ k: "category.name", o: "matches", v: "abc" }),
      ),
    ).toEqual({ editId: "L1", initialText: "abc" });
    expect(dotted.name).toBe("category.name");
  });
});

describe("helper kecil", () => {
  it("leafCheckedList / leafExcluded", () => {
    expect(leafCheckedList({ o: "=", v: 1 })).toEqual([1]);
    expect(leafCheckedList({ o: "in", v: [1, 2] })).toEqual([1, 2]);
    expect(leafCheckedList({ o: "matches", v: "a" })).toEqual([]);
    expect(leafCheckedList(null)).toEqual([]);
    expect(leafExcluded({ o: "!in" })).toBe(true);
    expect(leafExcluded({ o: "=" })).toBe(false);
  });

  it("sameLabel tak peduli huruf & spasi tepi; recordLabel fallback name/code/id", () => {
    expect(sameLabel(" Aktif ", "aktif")).toBe(true);
    expect(sameLabel("a", "b")).toBe(false);
    expect(recordLabel({ id: 3 })).toBe("3");
    expect(recordLabel({ id: 3, code: "C-1" })).toBe("C-1");
  });
});
