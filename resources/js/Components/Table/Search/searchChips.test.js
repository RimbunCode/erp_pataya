import { describe, expect, it } from "vitest";
import {
  addLeafChip,
  addSearchChip,
  isSearchGroup,
  removeChip,
  treeToChips,
  updateChip,
} from "./searchChips";
import { convertTemplateLink } from "@/lib/linkModelUtils";

// Mock `t` sederhana yang menginterpolasi `:placeholder` secara generik dan
// tetap assertable (dipanggil ulang di test dgn param yang sama utk
// membangun expected string -- decoupled dari isi lang file yang bisa
// berubah).
const t = (key, params) =>
  params
    ? `${key}[${Object.entries(params)
        .map(([k, v]) => `:${k}=${v}`)
        .join(",")}]`
    : key;

const columns = {
  status: {
    name: "status",
    title: "Status",
    type: "formStatus",
    options: [
      { value: "draft", label: "Draft" },
      { value: "submitted", label: "Submitted" },
    ],
  },
  total: { name: "total", title: "Total", type: "currency" },
  name: { name: "name", title: "Nama", type: "string" },
  active: { name: "active", title: "Aktif", type: "boolean" },
  priority: {
    name: "priority",
    title: "Prioritas",
    type: "string",
    options: ["low", "high"],
    valueTrans: "priority",
  },
  customer: {
    name: "customer",
    title: "Customer",
    type: "relation",
    related: "Customer",
  },
};

const deepFreeze = (obj) => {
  if (obj && typeof obj === "object" && !Object.isFrozen(obj)) {
    Object.freeze(obj);
    Object.values(obj).forEach(deepFreeze);
  }
  return obj;
};

describe("isSearchGroup", () => {
  it("true untuk grup or >=2 anak, semua leaf matches, v identik", () => {
    const node = {
      k: "or",
      c: {
        a: { k: "name", o: "matches", v: "PT A" },
        b: { k: "code", o: "matches", v: "PT A" },
      },
    };
    expect(isSearchGroup(node)).toBe(true);
  });

  it("false bila anak < 2", () => {
    const node = { k: "or", c: { a: { k: "name", o: "matches", v: "PT A" } } };
    expect(isSearchGroup(node)).toBe(false);
  });

  it("false bila salah satu operator bukan matches", () => {
    const node = {
      k: "or",
      c: {
        a: { k: "name", o: "matches", v: "PT A" },
        b: { k: "code", o: "=", v: "PT A" },
      },
    };
    expect(isSearchGroup(node)).toBe(false);
  });

  it("false bila v anak tidak identik", () => {
    const node = {
      k: "or",
      c: {
        a: { k: "name", o: "matches", v: "PT A" },
        b: { k: "code", o: "matches", v: "PT B" },
      },
    };
    expect(isSearchGroup(node)).toBe(false);
  });

  it("false bila k bukan or (mis. and)", () => {
    const node = {
      k: "and",
      c: {
        a: { k: "name", o: "matches", v: "PT A" },
        b: { k: "code", o: "matches", v: "PT A" },
      },
    };
    expect(isSearchGroup(node)).toBe(false);
  });

  it("false bila salah satu anak adalah grup (bukan leaf)", () => {
    const node = {
      k: "or",
      c: {
        a: { k: "name", o: "matches", v: "PT A" },
        b: { k: "and", c: { c: { k: "code", o: "matches", v: "PT A" } } },
      },
    };
    expect(isSearchGroup(node)).toBe(false);
  });
});

describe("treeToChips", () => {
  it("null/undefined tree -> []", () => {
    expect(treeToChips(null, columns, t)).toEqual([]);
    expect(treeToChips(undefined, columns, t)).toEqual([]);
  });

  it("root tanpa anak -> []", () => {
    expect(treeToChips({ root: { k: "and", c: {} } }, columns, t)).toEqual([]);
  });

  it("leaf operator = -> chip leaf format 'Kolom: nilai'", () => {
    const tree = {
      root: { k: "and", c: { a: { k: "status", o: "=", v: "draft" } } },
    };
    const chips = treeToChips(tree, columns, t);
    expect(chips).toHaveLength(1);
    expect(chips[0]).toMatchObject({ id: "a", kind: "leaf" });
    expect(chips[0].label).toBe("Status: Draft");
  });

  it("leaf operator in -> chip leaf, value digabung ', '", () => {
    const tree = {
      root: {
        k: "and",
        c: { a: { k: "status", o: "in", v: ["draft", "submitted"] } },
      },
    };
    expect(treeToChips(tree, columns, t)[0].label).toBe(
      "Status: Draft, Submitted",
    );
  });

  it("leaf operator lain -> 'Kolom <label operator> nilai'", () => {
    const tree = {
      root: { k: "and", c: { a: { k: "total", o: ">", v: 100 } } },
    };
    const chips = treeToChips(tree, columns, t);
    expect(chips[0].label).toBe(
      `Total ${t("core.datatable.filter.operator.>")} 100`,
    );
  });

  it("grup OR Chip Cari -> chip 'search' + daftar kolom", () => {
    const tree = {
      root: {
        k: "and",
        c: {
          g: {
            k: "or",
            c: {
              a: { k: "name", o: "matches", v: "PT A" },
              b: { k: "code", o: "matches", v: "PT A" },
            },
          },
        },
      },
    };
    const chips = treeToChips(tree, columns, t);
    expect(chips).toHaveLength(1);
    expect(chips[0].kind).toBe("search");
    expect(chips[0].label).toBe(
      t("core.datatable.search.search_chip", { text: "PT A" }),
    );
    expect(chips[0].columns).toEqual(["name", "code"]);
  });

  it("chip 'leaf' dgn 1 kolom pencarian tetap dianggap benar (collapse cleaner)", () => {
    // FilterTreeCleaner backend meng-collapse grup or ber-anak tunggal jadi
    // leaf `matches` langsung -- treeToChips harus menampilkannya sbg leaf,
    // BUKAN mencoba mendeteksinya sebagai Chip Cari (Requirement 4.5).
    const tree = {
      root: { k: "and", c: { a: { k: "name", o: "matches", v: "PT A" } } },
    };
    const chips = treeToChips(tree, columns, t);
    expect(chips[0].kind).toBe("leaf");
    expect(chips[0].label).toBe(
      `Nama ${t("core.datatable.filter.operator.matches")} PT A`,
    );
  });

  it("grup lain (bukan Chip Cari) anak langsung root -> chip 'advanced' dgn count leaf", () => {
    const tree = {
      root: {
        k: "and",
        c: {
          g: {
            k: "and",
            c: {
              a: { k: "total", o: ">", v: 100 },
              b: { k: "total", o: "<", v: 500 },
            },
          },
        },
      },
    };
    const chips = treeToChips(tree, columns, t);
    expect(chips[0].kind).toBe("advanced");
    expect(chips[0].count).toBe(2);
    expect(chips[0].label).toBe(
      t("core.datatable.search.advanced_chip", { count: 2 }),
    );
  });

  it("grup OR anak root yg gagal syarat Chip Cari (v beda) -> chip 'advanced'", () => {
    const tree = {
      root: {
        k: "and",
        c: {
          g: {
            k: "or",
            c: {
              a: { k: "name", o: "matches", v: "PT A" },
              b: { k: "name", o: "matches", v: "PT B" },
            },
          },
        },
      },
    };
    expect(treeToChips(tree, columns, t)[0].kind).toBe("advanced");
  });

  it("root or dgn >1 anak -> seluruh tree 1 chip advanced", () => {
    const tree = {
      root: {
        k: "or",
        c: {
          a: { k: "status", o: "=", v: "draft" },
          b: { k: "total", o: ">", v: 100 },
        },
      },
    };
    const chips = treeToChips(tree, columns, t);
    expect(chips).toHaveLength(1);
    expect(chips[0]).toMatchObject({ id: "root", kind: "advanced", count: 2 });
  });

  it("kolom tak ter-resolve -> pakai key mentah", () => {
    const tree = {
      root: { k: "and", c: { a: { k: "unknown_col", o: "=", v: "x" } } },
    };
    expect(treeToChips(tree, columns, t)[0].label).toBe("unknown_col: x");
  });

  it("label opsi via valueTrans (parseTrans-like)", () => {
    const tree = {
      root: { k: "and", c: { a: { k: "priority", o: "=", v: "high" } } },
    };
    // t tanpa param mengembalikan key verbatim (mock) -> assertable.
    expect(treeToChips(tree, columns, t)[0].label).toBe(
      `Prioritas: ${t("priority.high")}`,
    );
  });

  it("boolean -> label core.datatable.yes/no", () => {
    const tree = {
      root: { k: "and", c: { a: { k: "active", o: "=", v: true } } },
    };
    expect(treeToChips(tree, columns, t)[0].label).toBe(
      `Aktif: ${t("core.datatable.yes")}`,
    );
  });

  it("value relasi -> convertTemplateLink(record, '') dgn fallback name??code??id", () => {
    const record = {
      id: 1,
      name: "PT A",
      code: "C001",
      templateLink: "<title>:name</title> (:code)",
    };
    const tree = {
      root: { k: "and", c: { a: { k: "customer", o: "=", v: record } } },
    };
    const expected = convertTemplateLink(record, "");
    expect(expected).not.toBe(""); // sanity: templateLink py teks di luar <title>
    expect(treeToChips(tree, columns, t)[0].label).toBe(
      `Customer: ${expected}`,
    );
  });

  it("value relasi fallback ke name bila convertTemplateLink kosong", () => {
    const record = {
      id: 2,
      name: "PT B",
      templateLink: "<title>:name</title>",
    };
    // Sanity: templateLink HANYA berisi <title>, convertTemplateLink(v,'')
    // melucuti seluruh title tag -> hasil kosong -> fallback dipakai.
    expect(convertTemplateLink(record, "")).toBe("");
    const tree = {
      root: { k: "and", c: { a: { k: "customer", o: "=", v: record } } },
    };
    expect(treeToChips(tree, columns, t)[0].label).toBe("Customer: PT B");
  });
});

describe("addLeafChip", () => {
  it("tree kosong -> tambah leaf pertama", () => {
    const result = addLeafChip(null, { k: "status", o: "=", v: "draft" });
    const entries = Object.entries(result.root.c);
    expect(entries).toHaveLength(1);
    expect(entries[0][1]).toMatchObject({
      k: "status",
      o: "=",
      v: "draft",
    });
  });

  it("merge '=' + '=' pada kolom sama -> satu leaf 'in'", () => {
    const tree = deepFreeze({
      root: { k: "and", c: { a: { k: "status", o: "=", v: "draft" } } },
    });
    const result = addLeafChip(tree, {
      k: "status",
      o: "=",
      v: "submitted",
    });
    const entries = Object.values(result.root.c);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      k: "status",
      o: "in",
      v: ["draft", "submitted"],
    });
  });

  it("merge 'in' + '=' pada kolom sama -> tetap satu leaf 'in', unik", () => {
    const tree = deepFreeze({
      root: {
        k: "and",
        c: { a: { k: "status", o: "in", v: ["draft", "submitted"] } },
      },
    });
    // Nilai duplikat -> tidak nambah.
    const dup = addLeafChip(tree, { k: "status", o: "=", v: "submitted" });
    expect(Object.values(dup.root.c)[0].v).toEqual(["draft", "submitted"]);

    // Nilai baru -> ditambahkan.
    const added = addLeafChip(tree, { k: "status", o: "=", v: "cancelled" });
    expect(Object.values(added.root.c)[0].v).toEqual([
      "draft",
      "submitted",
      "cancelled",
    ]);
  });

  it("dedup nilai relasi via .id", () => {
    const tree = deepFreeze({
      root: {
        k: "and",
        c: { a: { k: "customer", o: "=", v: { id: 1, name: "A" } } },
      },
    });
    const dup = addLeafChip(tree, {
      k: "customer",
      o: "=",
      v: { id: 1, name: "A (versi lain)" },
    });
    expect(Object.values(dup.root.c)[0].v).toHaveLength(1);

    const added = addLeafChip(tree, {
      k: "customer",
      o: "=",
      v: { id: 2, name: "B" },
    });
    expect(Object.values(added.root.c)[0].v.map((r) => r.id)).toEqual([1, 2]);
  });

  it("operator selain =/in -> leaf AND terpisah, tidak merge", () => {
    const tree = deepFreeze({
      root: { k: "and", c: { a: { k: "total", o: ">", v: 100 } } },
    });
    const result = addLeafChip(tree, { k: "total", o: "<", v: 500 });
    expect(Object.keys(result.root.c)).toHaveLength(2);
  });

  it("kolom berbeda -> tidak merge, leaf terpisah", () => {
    const tree = deepFreeze({
      root: { k: "and", c: { a: { k: "status", o: "=", v: "draft" } } },
    });
    const result = addLeafChip(tree, { k: "total", o: "=", v: 100 });
    expect(Object.keys(result.root.c)).toHaveLength(2);
  });

  it("tidak memutasi tree input", () => {
    const tree = deepFreeze({
      root: { k: "and", c: { a: { k: "status", o: "=", v: "draft" } } },
    });
    expect(() =>
      addLeafChip(tree, { k: "status", o: "=", v: "submitted" }),
    ).not.toThrow();
  });
});

describe("addSearchChip", () => {
  it("teks kosong -> tree tidak berubah", () => {
    const tree = deepFreeze({
      root: { k: "and", c: { a: { k: "status", o: "=", v: "draft" } } },
    });
    expect(addSearchChip(tree, "   ", ["name"])).toBe(tree);
  });

  it("tanpa kolom pencarian -> tree tidak berubah", () => {
    const tree = deepFreeze({ root: { k: "and", c: {} } });
    expect(addSearchChip(tree, "PT A", [])).toBe(tree);
  });

  it("frasa multi-kata TIDAK dipecah -> satu leaf matches per kolom", () => {
    const result = addSearchChip(null, "  PT Abadi Sentosa  ", [
      "name",
      "code",
    ]);
    const group = Object.values(result.root.c)[0];
    const leaves = Object.values(group.c);
    expect(leaves).toHaveLength(2);
    leaves.forEach((leaf) => {
      expect(leaf.o).toBe("matches");
      expect(leaf.v).toBe("PT Abadi Sentosa");
    });
    expect(isSearchGroup(group)).toBe(true);
  });

  it("Chip Cari kedua ditambahkan sbg grup OR terpisah (AND antar-pencarian)", () => {
    const first = addSearchChip(null, "PT A", ["name", "code"]);
    const second = addSearchChip(first, "Toko Baru", ["name", "code"]);
    const groups = Object.values(second.root.c);
    expect(groups).toHaveLength(2);
    const texts = groups.map((g) => Object.values(g.c)[0].v).sort();
    expect(texts).toEqual(["PT A", "Toko Baru"]);
  });

  it("tidak memutasi tree input", () => {
    const tree = deepFreeze({
      root: { k: "and", c: { a: { k: "status", o: "=", v: "draft" } } },
    });
    expect(() => addSearchChip(tree, "PT A", ["name"])).not.toThrow();
  });
});

describe("updateChip", () => {
  it("leaf: merge k/o/v", () => {
    const tree = deepFreeze({
      root: { k: "and", c: { a: { k: "status", o: "=", v: "draft" } } },
    });
    const result = updateChip(tree, "a", { o: "!=" });
    expect(result.root.c.a).toMatchObject({
      k: "status",
      o: "!=",
      v: "draft",
    });
  });

  it("chip search: ganti v di semua anak grup", () => {
    const tree = deepFreeze({
      root: {
        k: "and",
        c: {
          g: {
            k: "or",
            c: {
              a: { k: "name", o: "matches", v: "PT A" },
              b: { k: "code", o: "matches", v: "PT A" },
            },
          },
        },
      },
    });
    const result = updateChip(tree, "g", { v: "PT Baru" });
    const leaves = Object.values(result.root.c.g.c);
    expect(leaves.every((l) => l.v === "PT Baru")).toBe(true);
  });

  it("id tak ditemukan -> tree tidak berubah (isi sama)", () => {
    const tree = deepFreeze({
      root: { k: "and", c: { a: { k: "status", o: "=", v: "draft" } } },
    });
    const result = updateChip(tree, "tidak-ada", { v: "x" });
    expect(result.root.c.a).toMatchObject({ k: "status", o: "=", v: "draft" });
  });

  it("tidak memutasi tree input", () => {
    const tree = deepFreeze({
      root: { k: "and", c: { a: { k: "status", o: "=", v: "draft" } } },
    });
    expect(() => updateChip(tree, "a", { v: "submitted" })).not.toThrow();
  });
});

describe("removeChip", () => {
  it("hapus satu-satunya leaf -> root null", () => {
    const tree = deepFreeze({
      root: { k: "and", c: { a: { k: "status", o: "=", v: "draft" } } },
    });
    expect(removeChip(tree, "a")).toBeNull();
  });

  it("hapus salah satu leaf -> sisa lain tetap ada", () => {
    const tree = deepFreeze({
      root: {
        k: "and",
        c: {
          a: { k: "status", o: "=", v: "draft" },
          b: { k: "total", o: ">", v: 100 },
        },
      },
    });
    const result = removeChip(tree, "a");
    expect(Object.keys(result.root.c)).toEqual(["b"]);
  });

  it("hapus grup Chip Cari sekaligus (via id grup)", () => {
    const tree = deepFreeze({
      root: {
        k: "and",
        c: {
          g: {
            k: "or",
            c: {
              a: { k: "name", o: "matches", v: "PT A" },
              b: { k: "code", o: "matches", v: "PT A" },
            },
          },
        },
      },
    });
    expect(removeChip(tree, "g")).toBeNull();
  });

  it("id 'root' (chip whole-tree) -> null", () => {
    const tree = deepFreeze({
      root: {
        k: "or",
        c: {
          a: { k: "status", o: "=", v: "draft" },
          b: { k: "total", o: ">", v: 100 },
        },
      },
    });
    expect(removeChip(tree, "root")).toBeNull();
  });

  it("tree null -> null", () => {
    expect(removeChip(null, "a")).toBeNull();
  });

  it("tidak memutasi tree input", () => {
    const tree = deepFreeze({
      root: {
        k: "and",
        c: {
          a: { k: "status", o: "=", v: "draft" },
          b: { k: "total", o: ">", v: 100 },
        },
      },
    });
    expect(() => removeChip(tree, "a")).not.toThrow();
  });
});

describe("addLeafChip — nilai kosong (regresi verifikasi visual)", () => {
  const withSparepart = {
    root: {
      k: "and",
      c: {
        a: { k: "customer", o: "=", v: { id: "1", name: "PT A" } },
      },
    },
  };

  it.each([[null], [undefined], [""], ["   "], [[]]])(
    "v=%j tidak menambah/menggabung apa pun, tree dikembalikan apa adanya",
    (v) => {
      const tree = deepFreeze(structuredClone(withSparepart));
      expect(addLeafChip(tree, { k: "customer", o: "=", v })).toBe(tree);
      expect(addLeafChip(null, { k: "name", o: "matches", v })).toBeNull();
    },
  );

  it("mencegah `in [record, null]` saat picker relasi ter-reset (bug asli)", () => {
    const tree = deepFreeze(structuredClone(withSparepart));
    const next = addLeafChip(tree, { k: "customer", o: "=", v: null });
    expect(JSON.stringify(next)).not.toContain("null");
  });

  it("boolean false dan angka 0 adalah nilai VALID", () => {
    const a = addLeafChip(null, { k: "active", o: "=", v: false });
    expect(Object.values(a.root.c)[0]).toMatchObject({ k: "active", v: false });
    const b = addLeafChip(null, { k: "total", o: "=", v: 0 });
    expect(Object.values(b.root.c)[0]).toMatchObject({ k: "total", v: 0 });
  });
});

describe("treeToChips — judul kolom berpath & periode", () => {
  const cols = {
    category: {
      name: "category",
      title: "Kategori",
      type: "relation",
      columns: {
        "category.name": {
          name: "category.name",
          title: "Nama",
          type: "string",
          parentCol: { name: "category" },
        },
      },
    },
    created_at: { name: "created_at", title: "Dibuat", type: "date" },
  };

  it("leaf pada kolom relasi berpath dilabeli 'Kategori › Nama'", () => {
    const [chip] = treeToChips(
      {
        root: {
          k: "and",
          c: { a: { k: "category.name", o: "matches", v: "elek" } },
        },
      },
      cols,
      t,
    );
    expect(chip.kind).toBe("leaf");
    expect(chip.label).toBe(
      "Kategori › Nama core.datatable.filter.operator.matches elek",
    );
  });

  it("segmen yang tak ter-resolve memakai segmen mentah", () => {
    const [chip] = treeToChips(
      { root: { k: "and", c: { a: { k: "ghost.field", o: "=", v: "x" } } } },
      cols,
      t,
    );
    expect(chip.label).toBe("ghost › field: x");
  });

  it("in_period 'is' dibaca sbg 'Kolom: nilai' (bukan [object Object])", () => {
    const [chip] = treeToChips(
      {
        root: {
          k: "and",
          c: {
            a: {
              k: "created_at",
              o: "in_period",
              v: { period: "month", operator: "is", year: 2026, month: 8 },
            },
          },
        },
      },
      cols,
      t,
    );
    expect(chip.label).toBe("Dibuat: 2026-09");
    expect(chip.label).not.toContain("object");
  });

  it("in_period selain 'is' tetap menyebut operatornya", () => {
    const [chip] = treeToChips(
      {
        root: {
          k: "and",
          c: {
            a: {
              k: "created_at",
              o: "in_period",
              v: { period: "year", operator: "after", year: 2025 },
            },
          },
        },
      },
      cols,
      t,
    );
    expect(chip.label).toBe(
      "Dibuat core.datatable.filter.operator.in_period 2025",
    );
  });
});
