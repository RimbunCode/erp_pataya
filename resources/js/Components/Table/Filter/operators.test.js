import { describe, expect, it } from "vitest";
import {
  columnHasOptions,
  columnOperatorOptions,
  getOperators,
  isUnsearchableDerivedColumn,
} from "./operators";

describe("columnHasOptions", () => {
  it("false jika column.options tidak ada", () => {
    expect(columnHasOptions({})).toBe(false);
    expect(columnHasOptions(null)).toBe(false);
  });

  it("true untuk options berupa array non-kosong", () => {
    expect(columnHasOptions({ options: ["a", "b"] })).toBe(true);
  });

  it("false untuk options berupa array kosong", () => {
    expect(columnHasOptions({ options: [] })).toBe(false);
  });

  it("true untuk options berupa object non-kosong", () => {
    expect(columnHasOptions({ options: { draft: "Draft" } })).toBe(true);
  });

  it("false untuk options berupa object kosong", () => {
    expect(columnHasOptions({ options: {} })).toBe(false);
  });
});

describe("getOperators - mode value", () => {
  it("string tanpa options: '=' pakai valueInput 'text'", () => {
    const ops = getOperators("string", { hasOptions: false });
    expect(ops["="].valueInput).toBe("text");
  });

  it("string dengan options: '=' pakai valueInput 'select'", () => {
    const ops = getOperators("string", { hasOptions: true });
    expect(ops["="].valueInput).toBe("select");
  });

  it("string selalu punya matches/starts_with/ends_with sebagai text", () => {
    const ops = getOperators("string", { hasOptions: true });
    expect(ops.matches.valueInput).toBe("text");
    expect(ops.starts_with.valueInput).toBe("text");
    expect(ops.ends_with.valueInput).toBe("text");
  });

  it("number/currency: operator komparasi penuh + between pakai currency2", () => {
    const ops = getOperators("number");
    expect(ops["="].valueInput).toBe("currency");
    expect(ops[">"].valueInput).toBe("currency");
    expect(ops.between.valueInput).toBe("currency2");
  });

  it("date/datetime: HANYA in_period/!in_period (+ set/!set); banyak nilai = daftar di bawah operator yg sama (revisi 16)", () => {
    for (const type of ["date", "datetime"]) {
      const ops = getOperators(type);
      expect(Object.keys(ops).sort()).toEqual(
        ["!in_period", "!set", "in_period", "set"].sort(),
      );
      expect(ops.in_period.valueInput).toBe("dateselector");
      expect(ops["!in_period"].valueInput).toBe("dateselector");
      expect(ops["="]).toBeUndefined();
      expect(ops.in).toBeUndefined();
      expect(ops["!in"]).toBeUndefined();
    }
  });

  it("date mode column: in/!in tetap columnrefMulti (bukan daftar periode)", () => {
    const ops = getOperators("date", { mode: "column" });
    expect(ops.in.valueInput).toBe("columnrefMulti");
    expect(ops["!in"].valueInput).toBe("columnrefMulti");
  });

  it("boolean: '=' dan '!=' pakai checkbox", () => {
    const ops = getOperators("boolean");
    expect(ops["="].valueInput).toBe("checkbox");
    expect(ops["!="].valueInput).toBe("checkbox");
  });

  it("relation basic (bukan morph): pakai linkmodel/linkmodelMulti", () => {
    const ops = getOperators("relation", { typeRelation: "basic" });
    expect(ops["="].valueInput).toBe("linkmodel");
    expect(ops.in.valueInput).toBe("linkmodelMulti");
  });

  it("relation morph: pakai morph/morphMulti", () => {
    const ops = getOperators("relation", { typeRelation: "morph" });
    expect(ops["="].valueInput).toBe("morph");
    expect(ops.in.valueInput).toBe("morphMulti");
  });

  it("relations (plural, hasMany): has/!has/in/!in semua multiselect-like", () => {
    const ops = getOperators("relations", { typeRelation: "basic" });
    expect(ops.has.valueInput).toBe("linkmodelMulti");
    expect(ops.in.valueInput).toBe("linkmodelMulti");
  });

  it("formStatus/enum: '=' select, 'in' multiselect", () => {
    const ops = getOperators("formStatus");
    expect(ops["="].valueInput).toBe("select");
    expect(ops.in.valueInput).toBe("multiselect");
  });

  it("tipe non-filterable (binary/json/mixed/attribute): tidak ada operator sama sekali", () => {
    expect(getOperators("binary")).toEqual({});
    expect(getOperators("json")).toEqual({});
    expect(getOperators("mixed")).toEqual({});
    expect(getOperators("attribute")).toEqual({});
  });

  it("tipe tidak dikenal: hanya UNIVERSAL (set/!set)", () => {
    const ops = getOperators("unknown_type");
    expect(Object.keys(ops)).toEqual(["set", "!set"]);
  });

  it("set/!set selalu ada (UNIVERSAL) untuk tipe filterable", () => {
    const ops = getOperators("string");
    expect(ops.set.valueInput).toBe("none");
    expect(ops["!set"].valueInput).toBe("none");
  });
});

describe("getOperators - mode column (column-ref)", () => {
  it("operator string di-override ke columnref, set/!set dibuang", () => {
    const ops = getOperators("string", { hasOptions: false, mode: "column" });
    expect(ops["="].valueInput).toBe("columnref");
    expect(ops.set).toBeUndefined();
    expect(ops["!set"]).toBeUndefined();
  });

  it("operator 'in'/'!in' di mode column pakai columnrefMulti", () => {
    const ops = getOperators("string", { mode: "column" });
    expect(ops.in.valueInput).toBe("columnrefMulti");
    expect(ops["!in"].valueInput).toBe("columnrefMulti");
  });

  it("operator 'between' di mode column pakai columnref2", () => {
    const ops = getOperators("number", { mode: "column" });
    expect(ops.between.valueInput).toBe("columnref2");
  });

  it("date/datetime mode column pakai DATE_COLUMN_OPERATORS penuh (bukan in_period)", () => {
    const ops = getOperators("date", { mode: "column" });
    expect(ops["="]).toBeDefined();
    expect(ops[">"]).toBeDefined();
    expect(ops.between).toBeDefined();
    expect(ops.in_period).toBeUndefined();
  });

  it("mode column selalu buang in_period/!in_period jika ada di base ops", () => {
    const ops = getOperators("date", { mode: "column" });
    expect(ops.in_period).toBeUndefined();
    expect(ops["!in_period"]).toBeUndefined();
  });
});

describe("getOperators - kolom turunan (searchVia)", () => {
  const NUMBER_KEYS = [
    "!=",
    "!between",
    "!in",
    "!set",
    "<",
    "<=",
    "=",
    ">",
    ">=",
    "between",
    "in",
    "set",
  ];

  it.each(["string", "attribute"])(
    "searchVia 'dependsOn' (type %s): HANYA matches/!matches + set/!set",
    (type) => {
      const ops = getOperators(type, { searchVia: "dependsOn" });
      expect(Object.keys(ops).sort()).toEqual(
        ["!matches", "!set", "matches", "set"].sort(),
      );
      expect(ops.matches.valueInput).toBe("text");
      expect(ops["!matches"].valueInput).toBe("text");
      expect(ops["="]).toBeUndefined();
      expect(ops.starts_with).toBeUndefined();
    },
  );

  it.each(["expression", "single"])(
    "searchVia '%s': operator number untuk number/currency/progress/attribute",
    (searchVia) => {
      for (const type of ["number", "currency", "progress", "attribute"]) {
        const ops = getOperators(type, { searchVia });
        expect(Object.keys(ops).sort()).toEqual(NUMBER_KEYS);
        expect(ops["="].valueInput).toBe("currency");
        expect(ops.between.valueInput).toBe("currency2");
      }
    },
  );

  it("searchVia 'dependsOn' di mode column: tidak ada operator", () => {
    expect(
      getOperators("string", { searchVia: "dependsOn", mode: "column" }),
    ).toEqual({});
  });

  it("searchVia 'expression' di mode column: operator number -> columnref", () => {
    const ops = getOperators("progress", {
      searchVia: "expression",
      mode: "column",
    });
    expect(ops["="].valueInput).toBe("columnref");
    expect(ops.between.valueInput).toBe("columnref2");
    expect(ops.set).toBeUndefined();
  });

  it("kolom attribute / progress / virtual TANPA searchVia: tidak ada operator", () => {
    expect(getOperators("attribute", {})).toEqual({});
    expect(getOperators("progress", {})).toEqual({});
    expect(getOperators("string", { virtual: true })).toEqual({});
    expect(getOperators("number", { virtual: true })).toEqual({});
  });

  it("virtual dengan searchVia tetap mengikuti searchVia", () => {
    expect(
      Object.keys(
        getOperators("string", { virtual: true, searchVia: "dependsOn" }),
      ),
    ).toContain("matches");
  });

  it("kolom biasa tanpa searchVia tidak berubah (Property 10)", () => {
    expect(Object.keys(getOperators("string", {})).sort()).toEqual(
      [
        "!=",
        "!in",
        "!matches",
        "!set",
        "=",
        "ends_with",
        "in",
        "matches",
        "set",
        "starts_with",
      ].sort(),
    );
  });

  it("relations: has/!has/in/!in + matches/!matches (teks) + set/!set", () => {
    const ops = getOperators("relations", { typeRelation: "basic" });
    expect(Object.keys(ops).sort()).toEqual(
      ["!has", "!in", "!matches", "!set", "has", "in", "matches", "set"].sort(),
    );
    expect(ops.matches.valueInput).toBe("text");
    expect(ops["!matches"].valueInput).toBe("text");
    expect(ops.has.valueInput).toBe("linkmodelMulti");
  });
});

describe("columnOperatorOptions & isUnsearchableDerivedColumn", () => {
  it("menurunkan opsi dari metadata kolom", () => {
    expect(
      columnOperatorOptions({
        typeRelation: "morph",
        options: ["a"],
        searchVia: "dependsOn",
        virtual: true,
      }),
    ).toEqual({
      typeRelation: "morph",
      hasOptions: true,
      searchVia: "dependsOn",
      virtual: true,
    });
    expect(columnOperatorOptions(null)).toEqual({
      typeRelation: undefined,
      hasOptions: false,
      searchVia: undefined,
      virtual: undefined,
    });
  });

  it("searchVia null dianggap tidak ada", () => {
    expect(
      columnOperatorOptions({ searchVia: null }).searchVia,
    ).toBeUndefined();
  });

  it("kolom turunan tanpa searchVia tidak memenuhi syarat pencarian", () => {
    expect(isUnsearchableDerivedColumn({ virtual: true, type: "string" })).toBe(
      true,
    );
    expect(isUnsearchableDerivedColumn({ type: "attribute" })).toBe(true);
    expect(isUnsearchableDerivedColumn({ type: "progress" })).toBe(true);
  });

  it("kolom turunan dengan searchVia, dan kolom biasa, memenuhi syarat", () => {
    expect(
      isUnsearchableDerivedColumn({
        virtual: true,
        type: "string",
        searchVia: "dependsOn",
      }),
    ).toBe(false);
    expect(
      isUnsearchableDerivedColumn({
        type: "progress",
        searchVia: "expression",
      }),
    ).toBe(false);
    expect(isUnsearchableDerivedColumn({ type: "string" })).toBe(false);
    expect(isUnsearchableDerivedColumn(null)).toBe(false);
  });
});
