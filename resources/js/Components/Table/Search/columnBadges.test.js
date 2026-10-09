import { describe, expect, it } from "vitest";

import {
  badgesForColumn,
  columnsUsedInAdvanced,
  leafBelongsToColumn,
} from "./columnBadges";
import { addLeafChip, removeLeafValue, treeToChips } from "./searchChips";

const t = (key) => key;

const columns = {
  name: { name: "name", title: "Nama", type: "string" },
  qty: { name: "qty", title: "Jumlah", type: "number" },
  status: {
    name: "status",
    title: "Status",
    type: "string",
    options: [
      { value: "draft", label: "Draft" },
      { value: "done", label: "Selesai" },
    ],
  },
  active: { name: "active", title: "Aktif", type: "boolean" },
  created: { name: "created", title: "Dibuat", type: "date" },
  category: {
    name: "category",
    title: "Kategori",
    type: "relation",
    related: "App\\Models\\Category",
    columns: {
      "category.name": {
        name: "category.name",
        title: "Nama",
        type: "string",
      },
    },
  },
};

const treeOf = (leaves) => {
  const c = {};
  leaves.forEach((leaf, i) => {
    c[`L${i}`] = leaf;
  });
  return { root: { k: "and", c } };
};

const badgesOf = (leaves, columnName) => {
  const tree = treeOf(leaves);
  const chips = treeToChips(tree, columns, t, {});
  return badgesForColumn(chips, columns[columnName], { t, columns });
};

describe("leafBelongsToColumn", () => {
  it("nama sama, atau (relasi) key bertitik di bawahnya", () => {
    expect(leafBelongsToColumn("name", columns.name)).toBe(true);
    expect(leafBelongsToColumn("qty", columns.name)).toBe(false);
    expect(leafBelongsToColumn("category", columns.category)).toBe(true);
    expect(leafBelongsToColumn("category.name", columns.category)).toBe(true);
    expect(leafBelongsToColumn("categoryx", columns.category)).toBe(false);
    // kolom non-relasi tidak mengklaim key bertitik
    expect(leafBelongsToColumn("name.first", columns.name)).toBe(false);
    expect(leafBelongsToColumn(undefined, columns.name)).toBe(false);
  });
});

describe("badgesForColumn — label nilai-saja", () => {
  it("text: nilai berkutip (teks bebas), editable", () => {
    const [b] = badgesOf([{ k: "name", o: "matches", v: "abc" }], "name");
    expect(b.label).toBe('"abc"');
    expect(b.editable).toBe("edit");
    expect(b.leafId).toBe("L0");
    expect(b.key).toBe("L0:abc");
    expect(b.negated).toBe(false);
  });

  it("negasi diberi awalan ≠ dan negated=true", () => {
    const [b] = badgesOf([{ k: "name", o: "!matches", v: "abc" }], "name");
    expect(b.label).toBe('≠ "abc"');
    expect(b.negated).toBe(true);
  });

  it("number: simbol perbandingan, between, tidak-sama", () => {
    expect(badgesOf([{ k: "qty", o: ">=", v: 100 }], "qty")[0].label).toBe(
      "≥ 100",
    );
    expect(badgesOf([{ k: "qty", o: "<=", v: 5 }], "qty")[0].label).toBe("≤ 5");
    expect(badgesOf([{ k: "qty", o: ">", v: 5 }], "qty")[0].label).toBe("> 5");
    expect(
      badgesOf([{ k: "qty", o: "between", v: [1, 9] }], "qty")[0].label,
    ).toBe("1..9");
    expect(badgesOf([{ k: "qty", o: "!=", v: 5 }], "qty")[0].label).toBe("≠ 5");
  });

  it("in multi-nilai -> satu badge per nilai dengan valueKey berbeda", () => {
    const badges = badgesOf([{ k: "qty", o: "in", v: [1, 2, 3] }], "qty");
    expect(badges.map((b) => b.label)).toEqual(["1", "2", "3"]);
    expect(new Set(badges.map((b) => b.key)).size).toBe(3);
    expect(badges.every((b) => b.leafId === "L0")).toBe(true);
  });

  it("!in -> semua badge bernegasi", () => {
    const badges = badgesOf([{ k: "qty", o: "!in", v: [1, 2] }], "qty");
    expect(badges.map((b) => b.label)).toEqual(["≠ 1", "≠ 2"]);
  });

  it("kolom ber-opsi memakai label opsi", () => {
    const badges = badgesOf(
      [{ k: "status", o: "in", v: ["draft", "done"] }],
      "status",
    );
    expect(badges.map((b) => b.label)).toEqual(["Draft", "Selesai"]);
  });

  it("boolean: Ya/Tidak lewat kunci i18n", () => {
    const [b] = badgesOf([{ k: "active", o: "=", v: false }], "active");
    expect(b.label).toBe("core.datatable.no");
  });

  it("set / !set: label operator, bukan nilai", () => {
    const [a] = badgesOf([{ k: "name", o: "set" }], "name");
    expect(a.label).toBe("core.datatable.filter.operator.set");
    const [b] = badgesOf([{ k: "name", o: "!set" }], "name");
    expect(b.label).toBe("core.datatable.filter.operator.!set");
    expect(b.negated).toBe(true);
  });

  it("date: periode -> badge; daftar periode -> satu badge per periode; negasi ≠", () => {
    const p1 = { period: "month", operator: "is", year: 2026, month: 8 };
    const p2 = { period: "month", operator: "is", year: 2026, month: 9 };
    expect(
      badgesOf([{ k: "created", o: "in_period", v: p1 }], "created"),
    ).toHaveLength(1);
    expect(
      badgesOf([{ k: "created", o: "in_period", v: [p1, p2] }], "created"),
    ).toHaveLength(2);
    const [neg] = badgesOf(
      [{ k: "created", o: "!in_period", v: p1 }],
      "created",
    );
    expect(neg.label.startsWith("≠ ")).toBe(true);
  });

  it("relasi: record dilabeli name/code/id; dotted lama tampil sbg teks", () => {
    const rec = { id: 7, name: "Sparepart" };
    const [r] = badgesOf([{ k: "category", o: "=", v: rec }], "category");
    expect(r.label).toBe("Sparepart");
    expect(r.valueKey).toBe("7");
    const [d] = badgesOf(
      [{ k: "category.name", o: "matches", v: "abc" }],
      "category",
    );
    expect(d.label).toBe('"abc"');
    expect(d.editable).toBe("edit");
  });

  it("operator tanpa sintaks sel -> editable builder dengan label operator penuh", () => {
    const [b] = badgesOf([{ k: "name", o: "starts_with", v: "abc" }], "name");
    expect(b.editable).toBe("builder");
    expect(b.label).toBe('core.datatable.filter.operator.starts_with "abc"');
    const [c] = badgesOf(
      [{ k: "qty", o: "=", v: { mode: "column", ref: "other" } }],
      "qty",
    );
    expect(c.editable).toBe("builder");
    expect(c.label).toContain("other");
  });

  it("leaf kolom lain tidak ikut; chip search/advanced tidak menghasilkan badge", () => {
    const tree = {
      root: {
        k: "and",
        c: {
          L0: { k: "qty", o: ">", v: 1 },
          S1: {
            k: "or",
            c: {
              a: { k: "name", o: "matches", v: "x" },
              b: { k: "category", o: "matches", v: "x" },
            },
          },
          A2: {
            k: "and",
            c: {
              a: { k: "name", o: "=", v: "y" },
              b: { k: "qty", o: "=", v: 2 },
            },
          },
        },
      },
    };
    const chips = treeToChips(tree, columns, t, {});
    expect(badgesForColumn(chips, columns.name, { t, columns })).toHaveLength(
      0,
    );
    expect(
      badgesForColumn(chips, columns.qty, { t, columns }).map((b) => b.leafId),
    ).toEqual(["L0"]);
  });
});

describe("columnsUsedInAdvanced", () => {
  it("hanya kunci di dalam chip advanced (bukan search, bukan leaf biasa)", () => {
    const tree = {
      root: {
        k: "and",
        c: {
          L0: { k: "qty", o: ">", v: 1 },
          S1: {
            k: "or",
            c: {
              a: { k: "name", o: "matches", v: "x" },
              b: { k: "code", o: "matches", v: "x" },
            },
          },
          A2: {
            k: "and",
            c: {
              a: { k: "status", o: "=", v: "y" },
              g: { k: "or", c: { z: { k: "active", o: "=", v: true } } },
            },
          },
        },
      },
    };
    const chips = treeToChips(tree, columns, t, {});
    expect([...columnsUsedInAdvanced(chips)].sort()).toEqual([
      "active",
      "status",
    ]);
  });

  it("root OR multi-kondisi = satu chip advanced -> semua kuncinya", () => {
    const tree = {
      root: {
        k: "or",
        c: {
          a: { k: "name", o: "=", v: "1" },
          b: { k: "qty", o: ">", v: 1 },
        },
      },
    };
    const chips = treeToChips(tree, columns, t, {});
    expect([...columnsUsedInAdvanced(chips)].sort()).toEqual(["name", "qty"]);
  });
});

describe("removeLeafValue", () => {
  const tree3 = treeOf([
    { k: "qty", o: "in", v: [1, 2, 3] },
    { k: "name", o: "matches", v: "a" },
  ]);

  it("n>=3: buang satu nilai, urutan sisa dipertahankan, operator tetap", () => {
    const next = removeLeafValue(tree3, "L0", "2");
    expect(next.root.c.L0).toEqual({ k: "qty", o: "in", v: [1, 3] });
    expect(next.root.c.L1).toEqual(tree3.root.c.L1);
  });

  it("n=2: sisa satu -> turun ke = (in) / != (!in)", () => {
    const two = treeOf([{ k: "qty", o: "in", v: [1, 2] }]);
    expect(removeLeafValue(two, "L0", "1").root.c.L0).toEqual({
      k: "qty",
      o: "=",
      v: 2,
    });
    const neg = treeOf([{ k: "qty", o: "!in", v: [1, 2] }]);
    expect(removeLeafValue(neg, "L0", "2").root.c.L0).toEqual({
      k: "qty",
      o: "!=",
      v: 1,
    });
  });

  it("leaf bernilai tunggal -> seluruh leaf dihapus; tree kosong -> null", () => {
    const single = treeOf([{ k: "name", o: "matches", v: "a" }]);
    expect(removeLeafValue(single, "L0", "a")).toBeNull();
    const withOther = removeLeafValue(tree3, "L1", "a");
    expect(Object.keys(withOther.root.c)).toEqual(["L0"]);
  });

  it("periode berdaftar: sisa satu -> objek tunggal", () => {
    const p1 = { period: "month", operator: "is", year: 2026, month: 8 };
    const p2 = { period: "month", operator: "is", year: 2026, month: 9 };
    const tree = treeOf([{ k: "created", o: "in_period", v: [p1, p2] }]);
    const chips = treeToChips(tree, columns, t, {});
    const [first] = badgesForColumn(chips, columns.created, { t, columns });
    const next = removeLeafValue(tree, "L0", first.valueKey);
    expect(next.root.c.L0).toEqual({
      k: "created",
      o: "in_period",
      v: p2,
    });
  });

  it("id atau kunci tak ditemukan -> tree apa adanya (referensi sama)", () => {
    expect(removeLeafValue(tree3, "ZZZ", "1")).toBe(tree3);
    expect(removeLeafValue(tree3, "L0", "999")).toBe(tree3);
  });

  it("tidak memutasi tree masukan", () => {
    const before = JSON.stringify(tree3);
    removeLeafValue(tree3, "L0", "1");
    expect(JSON.stringify(tree3)).toBe(before);
  });

  it("round-trip: addLeafChip lalu removeLeafValue satu nilai kembali ke semula", () => {
    const base = treeOf([{ k: "name", o: "matches", v: "a" }]);
    const added = addLeafChip(base, { k: "qty", o: "in", v: [1, 2] });
    const id = Object.keys(added.root.c).find((k) => k !== "L0");
    const once = removeLeafValue(added, id, "1");
    expect(once.root.c[id]).toEqual({ k: "qty", o: "=", v: 2 });
  });
});
