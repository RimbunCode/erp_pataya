import { describe, expect, it } from "vitest";

import { columnLabel, isSelectableColumn } from "./ColumnOrderPicker";

// isSelectableColumn() dan columnLabel() adalah fungsi murni (tanpa DOM) yg
// menentukan kolom mana yg bisa dipilih & bagaimana labelnya ditampilkan --
// diuji terpisah di sini sesuai prioritas unit test murni, sebelum test
// render/interaksi komponennya sendiri (lihat ColumnOrderPicker.rtl.test.jsx).

describe("isSelectableColumn", () => {
  describe("tipe yang secara struktural tidak bisa dirender sebagai satu sel tabel", () => {
    it.each(["relations", "mixed", "json"])(
      "menolak kolom bertipe %s",
      (type) => {
        expect(isSelectableColumn({ name: "col", type })).toBe(false);
      },
    );
  });

  describe("relation (singular) & attribute TIDAK termasuk yang ditolak", () => {
    it("menerima kolom bertipe relation (singular, beda dari relations)", () => {
      expect(isSelectableColumn({ name: "supplier", type: "relation" })).toBe(
        true,
      );
    });

    it("menerima kolom bertipe attribute (accessor bisnis asli)", () => {
      expect(isSelectableColumn({ name: "full_name", type: "attribute" })).toBe(
        true,
      );
    });
  });

  describe("meta append column (disaring BY NAME, bukan by-type)", () => {
    it.each([
      "route",
      "canDelete",
      "canUpdate",
      "keyModel",
      "appendStatus",
      "thisModel",
      "templateLink",
      "disabledOn",
    ])("menolak kolom bernama %s walau tipenya string biasa", (name) => {
      expect(isSelectableColumn({ name, type: "string" })).toBe(false);
    });

    it("kolom attribute bernama SAMA dgn meta append tetap ditolak (nama menang, bukan tipe)", () => {
      expect(isSelectableColumn({ name: "route", type: "attribute" })).toBe(
        false,
      );
    });
  });

  describe("flag hidden/ignore", () => {
    it("menolak kolom yg ditandai hidden", () => {
      expect(
        isSelectableColumn({ name: "secret", type: "string", hidden: true }),
      ).toBe(false);
    });

    it("menolak kolom yg ditandai ignore", () => {
      expect(
        isSelectableColumn({ name: "internal", type: "string", ignore: true }),
      ).toBe(false);
    });
  });

  describe("kolom biasa yang valid", () => {
    it("menerima kolom string biasa tanpa flag apapun", () => {
      expect(isSelectableColumn({ name: "name", type: "string" })).toBe(true);
    });

    it("hidden=false dan ignore=false eksplisit tetap diterima", () => {
      expect(
        isSelectableColumn({
          name: "name",
          type: "string",
          hidden: false,
          ignore: false,
        }),
      ).toBe(true);
    });
  });
});

describe("columnLabel", () => {
  const t = (key) => `TR:${key}`;

  it("memakai title kalau tersedia", () => {
    expect(columnLabel({ name: "lang_code", title: "Kode Bahasa" }, t)).toBe(
      "Kode Bahasa",
    );
  });

  it("menerjemahkan titleTrans kalau title tidak ada", () => {
    expect(
      columnLabel({ name: "lang_code", titleTrans: "core.lang_code" }, t),
    ).toBe("TR:core.lang_code");
  });

  it("title diprioritaskan di atas titleTrans kalau keduanya ada", () => {
    expect(
      columnLabel(
        {
          name: "lang_code",
          title: "Kode Bahasa",
          titleTrans: "core.lang_code",
        },
        t,
      ),
    ).toBe("Kode Bahasa");
  });

  it("fallback ke name mentah kalau title & titleTrans tidak ada", () => {
    expect(columnLabel({ name: "lang_code" }, t)).toBe("lang_code");
  });

  it("column undefined/null tidak crash -- mengembalikan undefined", () => {
    expect(columnLabel(undefined, t)).toBeUndefined();
    expect(columnLabel(null, t)).toBeUndefined();
  });
});
