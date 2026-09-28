import { describe, expect, it } from "vitest";
import {
  formatAggregate,
  groupLabelValue,
  splitHeaderColumns,
} from "./groupDisplay";

describe("groupLabelValue", () => {
  it("grup NULL (key 'null') -> null utk semua tipe (GroupLabel: 'Tanpa Nilai')", () => {
    for (const type of [
      "string",
      "relation",
      "boolean",
      "formStatuses",
      "date",
    ]) {
      expect(
        groupLabelValue({ key: "null", raw: null, label: null }, { type }),
      ).toBeNull();
    }
  });

  it("relation -> objek relasi utuh dari label deskriptor", () => {
    const label = { id: 10, name: "Acme" };
    expect(
      groupLabelValue({ key: "10", raw: 10, label }, { type: "relation" }),
    ).toBe(label);
  });

  it("boolean -> boolean asli dari key (bukan 0/1 SQL mentah)", () => {
    expect(groupLabelValue({ key: "true", raw: 1 }, { type: "boolean" })).toBe(
      true,
    );
    expect(groupLabelValue({ key: "false", raw: 0 }, { type: "boolean" })).toBe(
      false,
    );
  });

  it("formStatuses -> array status dari key JSON ringkas", () => {
    expect(
      groupLabelValue(
        { key: '["approved","pending"]', raw: ['["approved", "pending"]'] },
        { type: "formStatuses" },
      ),
    ).toEqual(["approved", "pending"]);
  });

  it("tipe lain -> raw (string, kunci bucket date, batas bawah bucket number)", () => {
    expect(
      groupLabelValue({ key: "fruit", raw: "fruit" }, { type: "string" }),
    ).toBe("fruit");
    expect(
      groupLabelValue({ key: "2026-Q1", raw: "2026-Q1" }, { type: "date" }),
    ).toBe("2026-Q1");
    expect(groupLabelValue({ key: "0", raw: 0 }, { type: "number" })).toBe(0);
  });
});

describe("formatAggregate", () => {
  it("null/undefined/'' -> string kosong (semua nilai NULL)", () => {
    expect(formatAggregate(null, { type: "number" })).toBe("");
    expect(formatAggregate(undefined, { type: "number" })).toBe("");
    expect(formatAggregate("", { type: "number" })).toBe("");
  });

  it("number: memakai numberFormat kolom (pemisah ribuan)", () => {
    expect(
      formatAggregate(1500, { type: "number", numberFormat: "#,###" }),
    ).toBe("1,500");
  });

  it("currency: prefix simbol dari currencyCode objek; tanpa simbol -> tanpa prefix", () => {
    expect(
      formatAggregate(2500, {
        type: "currency",
        numberFormat: "#,###",
        currencyCode: { symbol: "Rp" },
      }),
    ).toBe("Rp 2,500");
    expect(
      formatAggregate(2500, { type: "currency", numberFormat: "#,###" }),
    ).toBe("2,500");
  });

  it("nilai 0 (falsy tapi valid) TIDAK dianggap kosong", () => {
    expect(formatAggregate(0, { type: "number", numberFormat: "#,###" })).toBe(
      "0",
    );
  });

  it("fallback ke preferences.default_number_format bila kolom tak mengatur", () => {
    expect(
      formatAggregate(
        1500,
        { type: "number" },
        { default_number_format: "#,###" },
      ),
    ).toBe("1,500");
  });
});

describe("splitHeaderColumns", () => {
  const cols = ["name", "qty", "note", "total"].map((name) => ({ name }));

  it("label span = kolom di depan + kolom SEBELUM agregat pertama; sisanya 1 sel per kolom", () => {
    const { labelSpan, trailing } = splitHeaderColumns(
      cols,
      [{ column: "qty" }, { column: "total" }],
      0,
    );

    expect(labelSpan).toBe(1);
    expect(trailing.map((c) => c.name)).toEqual(["qty", "note", "total"]);
  });

  it("kolom pemilih/aksi di depan ikut dihitung dalam span label", () => {
    expect(splitHeaderColumns(cols, [{ column: "note" }], 2).labelSpan).toBe(4);
    expect(splitHeaderColumns(cols, [{ column: "note" }], 1).labelSpan).toBe(3);
  });

  it("tanpa kolom agregat yang tampil -> label span PENUH & tanpa sel sisa", () => {
    const { labelSpan, trailing } = splitHeaderColumns(
      cols,
      [{ column: "kolom_disembunyikan" }],
      1,
    );

    expect(labelSpan).toBe(5);
    expect(trailing).toEqual([]);
    expect(splitHeaderColumns(cols, [], 0).labelSpan).toBe(4);
    expect(splitHeaderColumns(cols, undefined, 0).trailing).toEqual([]);
  });

  it("span minimal 1: agregat pertama = kolom pertama & tak ada kolom depan -> label menempati kolom itu", () => {
    const { labelSpan, trailing } = splitHeaderColumns(
      cols,
      [{ column: "name" }, { column: "total" }],
      0,
    );

    expect(labelSpan).toBe(1);
    expect(trailing.map((c) => c.name)).toEqual(["qty", "note", "total"]);
  });
});
