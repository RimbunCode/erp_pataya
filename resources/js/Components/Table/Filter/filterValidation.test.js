import { describe, expect, it } from "vitest";
import { resolveColumn, validateItem, validateTree } from "./filterValidation";

const columns = [
  { name: "status", type: "formStatus" },
  { name: "amount", type: "number" },
  { name: "notes", type: "string" },
  { name: "active", type: "boolean" },
  {
    name: "customer",
    type: "relation",
    columns: [{ name: "name", type: "string" }],
  },
];

describe("resolveColumn", () => {
  it("resolve kolom top-level by name", () => {
    expect(resolveColumn(columns, "status")).toEqual({
      name: "status",
      type: "formStatus",
    });
  });

  it("resolve kolom nested via dot-notation", () => {
    expect(resolveColumn(columns, "customer.name")).toEqual({
      name: "name",
      type: "string",
    });
  });

  it("return null untuk kolom yang tidak ditemukan", () => {
    expect(resolveColumn(columns, "unknown")).toBeNull();
  });

  it("return null untuk key kosong", () => {
    expect(resolveColumn(columns, "")).toBeNull();
    expect(resolveColumn(columns, null)).toBeNull();
  });

  it("return null jika segmen relasi belum ter-load (tidak ada sub-columns)", () => {
    expect(resolveColumn(columns, "notes.nested")).toBeNull();
  });
});

describe("validateItem", () => {
  it("wajib key & operator terisi (fallback presence-only saat column null)", () => {
    expect(validateItem({ k: "", o: "=", v: "x" }, null)).toBe(
      "core.datatable.filter.validation.value_required",
    );
    expect(validateItem({ k: "status", o: "", v: "x" }, null)).toBe(
      "core.datatable.filter.validation.value_required",
    );
  });

  it("operator 'set'/'!set' (valueInput=none) selalu valid tanpa value", () => {
    const column = { name: "status", type: "formStatus" };
    expect(validateItem({ k: "status", o: "set" }, column)).toBeNull();
  });

  it("valueInput 'currency'/'number': value harus numeric", () => {
    const column = { name: "amount", type: "number" };
    expect(validateItem({ k: "amount", o: "=", v: "abc" }, column)).toBe(
      "core.datatable.filter.validation.value_numeric",
    );
    expect(validateItem({ k: "amount", o: "=", v: "100" }, column)).toBeNull();
  });

  it("valueInput 'currency2' (between): butuh 2 nilai numeric", () => {
    const column = { name: "amount", type: "number" };
    expect(validateItem({ k: "amount", o: "between", v: ["10"] }, column)).toBe(
      "core.datatable.filter.validation.range_two",
    );
    expect(
      validateItem({ k: "amount", o: "between", v: ["10", "abc"] }, column),
    ).toBe("core.datatable.filter.validation.value_numeric");
    expect(
      validateItem({ k: "amount", o: "between", v: ["10", "20"] }, column),
    ).toBeNull();
  });

  it("valueInput 'checkbox': selalu valid (boolean, default false OK)", () => {
    const column = { name: "active", type: "boolean" };
    expect(validateItem({ k: "active", o: "=", v: false }, column)).toBeNull();
  });

  it("valueInput 'multiselect' (in/!in formStatus): butuh minimal 1 item", () => {
    const column = { name: "status", type: "formStatus" };
    expect(validateItem({ k: "status", o: "in", v: [] }, column)).toBe(
      "core.datatable.filter.validation.select_one",
    );
    expect(
      validateItem({ k: "status", o: "in", v: ["draft"] }, column),
    ).toBeNull();
  });

  it("valueInput 'linkmodel' (relation): butuh object dengan id terisi", () => {
    const column = { name: "customer", type: "relation" };
    expect(validateItem({ k: "customer", o: "=", v: null }, column)).toBe(
      "core.datatable.filter.validation.relation_required",
    );
    expect(
      validateItem({ k: "customer", o: "=", v: { id: 1 } }, column),
    ).toBeNull();
  });

  it("mode column-ref (value.kind='column'): valueInput columnref butuh ref terisi", () => {
    const column = { name: "amount", type: "number" };
    expect(
      validateItem(
        { k: "amount", o: "=", v: { kind: "column", ref: "" } },
        column,
      ),
    ).toBe("core.datatable.filter.validation.value_required");
    expect(
      validateItem(
        { k: "amount", o: "=", v: { kind: "column", ref: "other_field" } },
        column,
      ),
    ).toBeNull();
  });

  it("valueInput 'dateselector': butuh period+operator, day butuh startDate valid", () => {
    const column = { name: "created_at", type: "date" };
    expect(
      validateItem({ k: "created_at", o: "in_period", v: null }, column),
    ).toBe("core.datatable.filter.validation.period_incomplete");
    expect(
      validateItem(
        {
          k: "created_at",
          o: "in_period",
          v: { period: "day", operator: "=", startDate: "2026-01-01" },
        },
        column,
      ),
    ).toBeNull();
    expect(
      validateItem(
        {
          k: "created_at",
          o: "in_period",
          v: { period: "day", operator: "=", startDate: "not-a-date" },
        },
        column,
      ),
    ).toBe("core.datatable.filter.validation.value_date");
  });

  it("dateselector non-day (mis. year): butuh year terisi", () => {
    const column = { name: "created_at", type: "date" };
    expect(
      validateItem(
        {
          k: "created_at",
          o: "in_period",
          v: { period: "year", operator: "=" },
        },
        column,
      ),
    ).toBe("core.datatable.filter.validation.period_incomplete");
    expect(
      validateItem(
        {
          k: "created_at",
          o: "in_period",
          v: { period: "year", operator: "=", year: 2026 },
        },
        column,
      ),
    ).toBeNull();
  });
});

describe("validateTree", () => {
  it("valid=true jika minimal 1 item valid dan tidak ada error", () => {
    const tree = {
      root: {
        c: {
          a: { k: "amount", o: "=", v: "100" },
        },
      },
    };
    const result = validateTree(tree, columns);
    expect(result).toEqual({ valid: true, errors: {} });
  });

  it("valid=false jika ada item dengan error", () => {
    const tree = {
      root: {
        c: {
          a: { k: "amount", o: "=", v: "not-a-number" },
        },
      },
    };
    const result = validateTree(tree, columns);
    expect(result.valid).toBe(false);
    expect(result.errors.a).toBe(
      "core.datatable.filter.validation.value_numeric",
    );
  });

  it("item yang benar-benar kosong (untouched) dilewati, bukan error", () => {
    const tree = {
      root: {
        c: {
          a: { k: "", o: "", v: "" },
          b: { k: "amount", o: "=", v: "100" },
        },
      },
    };
    const result = validateTree(tree, columns);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual({});
  });

  it("tree tanpa satu pun item valid (semua untouched) -> valid:false", () => {
    const tree = { root: { c: { a: { k: "", o: "", v: "" } } } };
    const result = validateTree(tree, columns);
    expect(result.valid).toBe(false);
  });

  it("menelusuri nested group secara rekursif", () => {
    const tree = {
      root: {
        c: {
          g: {
            c: {
              a: { k: "amount", o: "=", v: "abc" },
            },
          },
        },
      },
    };
    const result = validateTree(tree, columns);
    expect(result.valid).toBe(false);
    expect(result.errors.a).toBe(
      "core.datatable.filter.validation.value_numeric",
    );
  });
});
