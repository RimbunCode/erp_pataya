import { describe, expect, it } from "vitest";
import { isFilterTreeDirty } from "./filterTreeCompare";

describe("isFilterTreeDirty", () => {
  it("false untuk tree identik", () => {
    const tree = {
      root: {
        k: "and",
        c: {
          a: { k: "status", o: "=", v: "draft" },
        },
      },
    };
    expect(isFilterTreeDirty(tree, tree)).toBe(false);
  });

  it("false meski urutan anak berbeda (urutan-independen)", () => {
    const saved = {
      root: {
        k: "and",
        c: {
          a: { k: "status", o: "=", v: "draft" },
          b: { k: "customer_id", o: "=", v: 1 },
        },
      },
    };
    const current = {
      root: {
        k: "and",
        c: {
          // Id & urutan key berbeda, isi sama.
          z: { k: "customer_id", o: "=", v: 1 },
          y: { k: "status", o: "=", v: "draft" },
        },
      },
    };
    expect(isFilterTreeDirty(saved, current)).toBe(false);
  });

  it("true saat operator berubah", () => {
    const saved = {
      root: { k: "and", c: { a: { k: "status", o: "=", v: "draft" } } },
    };
    const current = {
      root: { k: "and", c: { a: { k: "status", o: "!=", v: "draft" } } },
    };
    expect(isFilterTreeDirty(saved, current)).toBe(true);
  });

  it("true saat nilai berubah", () => {
    const saved = {
      root: { k: "and", c: { a: { k: "status", o: "=", v: "draft" } } },
    };
    const current = {
      root: { k: "and", c: { a: { k: "status", o: "=", v: "submitted" } } },
    };
    expect(isFilterTreeDirty(saved, current)).toBe(true);
  });

  it("true saat item kosong ditambahkan (item belum lengkap ikut dihitung)", () => {
    const saved = {
      root: { k: "and", c: { a: { k: "status", o: "=", v: "draft" } } },
    };
    const current = {
      root: {
        k: "and",
        c: {
          a: { k: "status", o: "=", v: "draft" },
          b: { k: "", o: "", v: "" },
        },
      },
    };
    expect(isFilterTreeDirty(saved, current)).toBe(true);
  });

  it("mendukung bentuk `c` dan `children` secara sama", () => {
    const usingC = {
      root: { k: "and", c: { a: { k: "status", o: "=", v: "draft" } } },
    };
    const usingChildren = {
      root: {
        k: "and",
        children: { a: { k: "status", o: "=", v: "draft" } },
      },
    };
    expect(isFilterTreeDirty(usingC, usingChildren)).toBe(false);
  });

  it("mendukung grup nested di kedua sisi", () => {
    const saved = {
      root: {
        k: "and",
        c: {
          g: {
            k: "or",
            c: {
              a: { k: "status", o: "=", v: "draft" },
              b: { k: "status", o: "=", v: "submitted" },
            },
          },
        },
      },
    };
    const current = {
      root: {
        k: "and",
        c: {
          g: {
            k: "or",
            c: {
              b: { k: "status", o: "=", v: "submitted" },
              a: { k: "status", o: "=", v: "draft" },
            },
          },
        },
      },
    };
    expect(isFilterTreeDirty(saved, current)).toBe(false);
  });

  it("false untuk tree/subtree kosong di kedua sisi", () => {
    expect(isFilterTreeDirty(null, undefined)).toBe(false);
    expect(isFilterTreeDirty({ root: { k: "and", c: {} } }, null)).toBe(false);
  });
});
