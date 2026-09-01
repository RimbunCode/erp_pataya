import { describe, expect, it } from "vitest";
import { columnHasOptions, getOperators } from "./operators";

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

  it("date/datetime: hanya in_period/!in_period (tanpa komparasi biasa)", () => {
    const ops = getOperators("date");
    expect(Object.keys(ops)).toEqual(
      expect.arrayContaining(["in_period", "!in_period", "set", "!set"]),
    );
    expect(ops["="]).toBeUndefined();
    expect(ops.in_period.valueInput).toBe("dateselector");
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
