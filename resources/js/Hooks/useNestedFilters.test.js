import { describe, it, expect } from "vitest";
import {
  createFilterGroup,
  createFilterItem,
  canWrapGroup,
  flattenFilters,
  getMaxDepth,
  getSubtreeMaxDepth,
  getNodeById,
  isGroupNode,
  isOnlyChildOfRoot,
  MAX_NESTED_DEPTH,
  normalizeFiltersState,
} from "./useNestedFilters.jsx";

describe("isGroupNode", () => {
  it("true untuk node dengan children (format singkat 'c')", () => {
    expect(isGroupNode({ c: {} })).toBe(true);
  });

  it("true untuk node dengan children (format panjang)", () => {
    expect(isGroupNode({ children: {} })).toBe(true);
  });

  it("false untuk item filter biasa", () => {
    expect(isGroupNode({ k: "field", o: "=", v: "1" })).toBe(false);
  });

  it("false untuk null/undefined", () => {
    expect(isGroupNode(null)).toBe(false);
    expect(isGroupNode(undefined)).toBe(false);
  });
});

describe("createFilterItem / createFilterGroup", () => {
  it("createFilterItem menghasilkan item kosong default", () => {
    expect(createFilterItem()).toEqual({ k: "", o: "", v: "" });
  });

  it("createFilterItem menerima override", () => {
    expect(createFilterItem({ k: "name" })).toEqual({
      k: "name",
      o: "",
      v: "",
    });
  });

  it("createFilterGroup menghasilkan group 'and' dengan 1 item default", () => {
    const group = createFilterGroup();
    expect(group.k).toBe("and");
    expect(Object.keys(group.c)).toHaveLength(1);
  });
});

describe("normalizeFiltersState", () => {
  it("menghasilkan root group dengan minimal 1 item jika filters kosong", () => {
    const result = normalizeFiltersState();
    expect(result.root.k).toBe("and");
    expect(Object.keys(result.root.c)).toHaveLength(1);
  });

  it("menormalisasi nested group yang valid", () => {
    const input = {
      root: {
        key: "or",
        children: {
          a: { key: "field1", operator: "=", value: "1" },
        },
      },
    };
    const result = normalizeFiltersState(input);
    expect(result.root.k).toBe("or");
    expect(result.root.c.a).toEqual({ k: "field1", o: "=", v: "1" });
  });

  it("membuang group anak yang jadi kosong setelah normalisasi", () => {
    const input = {
      root: {
        k: "and",
        c: {
          a: { k: "and", c: {} }, // group kosong, harus dibuang
          b: { k: "field", o: "=", v: "1" },
        },
      },
    };
    const result = normalizeFiltersState(input);
    expect(Object.keys(result.root.c)).toEqual(["b"]);
  });
});

describe("isOnlyChildOfRoot", () => {
  it("true jika root hanya punya 1 child dengan id tsb", () => {
    const filters = { root: { k: "and", c: { a: createFilterItem() } } };
    expect(isOnlyChildOfRoot(filters, "a")).toBe(true);
  });

  it("false jika root punya lebih dari 1 child", () => {
    const filters = {
      root: {
        k: "and",
        c: { a: createFilterItem(), b: createFilterItem() },
      },
    };
    expect(isOnlyChildOfRoot(filters, "a")).toBe(false);
  });
});

describe("canWrapGroup", () => {
  it("root hanya boleh di-wrap jika child > 1", () => {
    const single = { root: { k: "and", c: { a: createFilterItem() } } };
    expect(canWrapGroup(single, "root")).toBe(false);

    const multi = {
      root: { k: "and", c: { a: createFilterItem(), b: createFilterItem() } },
    };
    expect(canWrapGroup(multi, "root")).toBe(true);
  });

  it("non-root group selalu boleh di-wrap", () => {
    const filters = {
      root: {
        k: "and",
        c: { g: { k: "and", c: { a: createFilterItem() } } },
      },
    };
    expect(canWrapGroup(filters, "g")).toBe(true);
  });

  it("false jika node bukan group", () => {
    const filters = { root: { k: "and", c: { a: createFilterItem() } } };
    expect(canWrapGroup(filters, "a")).toBe(false);
  });
});

describe("getNodeById", () => {
  it("menemukan node di top-level", () => {
    const nodes = { a: createFilterItem({ k: "x" }) };
    expect(getNodeById(nodes, "a")).toEqual(createFilterItem({ k: "x" }));
  });

  it("menemukan node bersarang di dalam group", () => {
    const nodes = {
      g: { k: "and", c: { a: createFilterItem({ k: "nested" }) } },
    };
    expect(getNodeById(nodes, "a")).toEqual(createFilterItem({ k: "nested" }));
  });

  it("null jika tidak ditemukan", () => {
    expect(getNodeById({ a: createFilterItem() }, "notfound")).toBeNull();
  });
});

describe("flattenFilters", () => {
  it("menghasilkan array [key, operator, value] untuk item lengkap", () => {
    const nodes = {
      a: { k: "status", o: "=", v: "active" },
    };
    expect(flattenFilters(nodes)).toEqual([["status", "=", "active"]]);
  });

  it("mengabaikan item yang belum lengkap", () => {
    const nodes = {
      a: { k: "status", o: "", v: "" },
      b: { k: "", o: "=", v: "1" },
    };
    expect(flattenFilters(nodes)).toEqual([]);
  });

  it("menelusuri group bersarang secara rekursif", () => {
    const nodes = {
      g: {
        k: "or",
        c: {
          a: { k: "status", o: "=", v: "active" },
          b: { k: "type", o: "=", v: "vip" },
        },
      },
    };
    expect(flattenFilters(nodes)).toEqual([
      ["status", "=", "active"],
      ["type", "=", "vip"],
    ]);
  });

  it("item dengan value array dianggap lengkap jika tidak kosong", () => {
    const nodes = { a: { k: "status", o: "in", v: ["a", "b"] } };
    expect(flattenFilters(nodes)).toEqual([["status", "in", ["a", "b"]]]);
  });

  it("item dengan value array kosong dianggap TIDAK lengkap", () => {
    const nodes = { a: { k: "status", o: "in", v: [] } };
    expect(flattenFilters(nodes)).toEqual([]);
  });
});

describe("getMaxDepth / getSubtreeMaxDepth", () => {
  it("getMaxDepth = 0 untuk root tanpa nested group", () => {
    const filters = { root: { k: "and", c: { a: createFilterItem() } } };
    expect(getMaxDepth(filters)).toBe(0);
  });

  it("getMaxDepth bertambah sesuai kedalaman nested group", () => {
    const filters = {
      root: {
        k: "and",
        c: {
          g1: {
            k: "or",
            c: { g2: { k: "and", c: { a: createFilterItem() } } },
          },
        },
      },
    };
    expect(getMaxDepth(filters)).toBe(2);
  });

  it("MAX_NESTED_DEPTH terdefinisi sebagai konstanta angka", () => {
    expect(typeof MAX_NESTED_DEPTH).toBe("number");
  });

  it("getSubtreeMaxDepth dihitung dari baseDepth yang diberikan", () => {
    const node = {
      k: "and",
      c: { g: { k: "or", c: { a: createFilterItem() } } },
    };
    expect(getSubtreeMaxDepth(node, 1)).toBe(2);
  });
});
