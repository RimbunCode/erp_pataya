import { describe, expect, it } from "vitest";
import QueryString from "qs";
import fixture from "../../../../../tests/fixtures/group-levels-cases.json";
import {
  applyGroupDefaults,
  buildExpandParams,
  computeGroupDefaults,
  groupsFromQuery,
  inheritFromDefaults,
  groupsToQuery,
  MAX_GROUP_LEVELS,
  moveGroupLevel,
  normalizeGroupLevels,
  sameGroups,
  setLevelOption,
  toggleGroupLevel,
} from "./groupLevels";

const level = (column, granularity = null, range = null) => ({
  column,
  granularity,
  range,
});

const columns = {
  category: { name: "category", type: "string" },
  status: { name: "status", type: "formStatus" },
  order_date: { name: "order_date", type: "date" },
  amount: { name: "amount", type: "number", groupRangeOptions: [50, 500] },
  total: { name: "total", type: "currency" },
  customer: { name: "customer", type: "relation" },
};

describe("fixture bersama BE<->FE (Property 6)", () => {
  it.each(fixture.normalize)("normalize: $name", ({ input, expected }) => {
    expect(normalizeGroupLevels(input)).toEqual(expected);
  });

  it.each(fixture.wire)("groupsFromQuery: $name", ({ query, expected }) => {
    expect(groupsFromQuery(query)).toEqual(expected);
  });
});

describe("normalizeGroupLevels", () => {
  it("idempoten untuk semua kasus fixture", () => {
    for (const { input } of fixture.normalize) {
      const once = normalizeGroupLevels(input);
      expect(normalizeGroupLevels(once)).toEqual(once);
    }
  });

  it("struktural: tidak mengoreksi nilai salah & tidak memotong ke MAX", () => {
    const levels = normalizeGroupLevels([
      { column: "a", granularity: "decade" },
      { column: "b", range: -5 },
      "c",
      "d",
      "e",
      "f",
    ]);

    expect(levels).toHaveLength(6);
    expect(levels[0].granularity).toBe("decade");
    expect(levels[1].range).toBe(-5);
    expect(MAX_GROUP_LEVELS).toBe(4);
  });
});

describe("computeGroupDefaults / applyGroupDefaults", () => {
  it("date -> granularity month; number -> opsi range pertama kolom; lainnya null", () => {
    expect(computeGroupDefaults(columns.order_date)).toEqual(
      level("order_date", "month", null),
    );
    expect(computeGroupDefaults(columns.amount)).toEqual(
      level("amount", null, 50),
    );
    // Tanpa groupRangeOptions -> default global (10).
    expect(computeGroupDefaults(columns.total)).toEqual(
      level("total", null, 10),
    );
    expect(computeGroupDefaults(columns.category)).toEqual(level("category"));
    expect(computeGroupDefaults(null)).toEqual(level(null));
  });

  it("applyGroupDefaults hanya mengisi yang null, tidak menimpa nilai eksplisit", () => {
    const result = applyGroupDefaults(
      [level("order_date"), level("amount", null, 500), level("category")],
      columns,
    );

    expect(result).toEqual([
      level("order_date", "month"),
      level("amount", null, 500),
      level("category"),
    ]);
  });
});

describe("toggleGroupLevel", () => {
  it("menambah kolom non-aktif sbg level TERDALAM dgn default per tipe", () => {
    const result = toggleGroupLevel(
      [level("category")],
      "order_date",
      columns.order_date,
    );

    expect(result).toEqual([level("category"), level("order_date", "month")]);
  });

  it("menghapus kolom yang sudah aktif; level lain & urutannya utuh", () => {
    const groups = [level("category"), level("status"), level("customer")];

    expect(toggleGroupLevel(groups, "status")).toEqual([
      level("category"),
      level("customer"),
    ]);
  });

  it("mengabaikan penambahan saat sudah MAX_GROUP_LEVELS aktif", () => {
    const full = ["a", "b", "c", "d"].map((column) => level(column));

    expect(toggleGroupLevel(full, "e")).toEqual(full);
    // Tapi menghapus tetap boleh di batas.
    expect(toggleGroupLevel(full, "b")).toHaveLength(3);
  });

  it("tanpa metadata kolom tetap menambah level polos dgn nama yang diminta", () => {
    expect(toggleGroupLevel([], "unknown")).toEqual([level("unknown")]);
  });
});

describe("moveGroupLevel", () => {
  const groups = [level("a"), level("b"), level("c")];

  it("memindahkan level -> urutan nesting berubah", () => {
    expect(moveGroupLevel(groups, 0, 2).map((l) => l.column)).toEqual([
      "b",
      "c",
      "a",
    ]);
    expect(moveGroupLevel(groups, 2, 0).map((l) => l.column)).toEqual([
      "c",
      "a",
      "b",
    ]);
  });

  it("indeks di luar rentang / sama = tidak berubah", () => {
    expect(moveGroupLevel(groups, 1, 1)).toEqual(groups);
    expect(moveGroupLevel(groups, -1, 1)).toEqual(groups);
    expect(moveGroupLevel(groups, 0, 3)).toEqual(groups);
  });
});

describe("setLevelOption", () => {
  it("mengubah granularity/range SATU kolom saja", () => {
    const groups = [level("order_date", "month"), level("amount", null, 50)];

    expect(
      setLevelOption(groups, "order_date", { granularity: "year" }),
    ).toEqual([level("order_date", "year"), level("amount", null, 50)]);
    expect(setLevelOption(groups, "amount", { range: "100" })).toEqual([
      level("order_date", "month"),
      level("amount", null, 100),
    ]);
  });
});

describe("sameGroups", () => {
  it("urutan BERMAKNA: nesting A>B beda dari B>A", () => {
    expect(sameGroups([level("a"), level("b")], [level("b"), level("a")])).toBe(
      false,
    );
  });

  it("sama bila kolom, urutan, granularity & range sama (null == undefined, angka sbg angka)", () => {
    expect(
      sameGroups(
        [{ column: "a" }, level("d", "month"), level("n", null, 100)],
        [level("a"), level("d", "month"), { column: "n", range: "100" }],
      ),
    ).toBe(true);
  });

  it("beda bila granularity atau range berbeda", () => {
    expect(sameGroups([level("d", "month")], [level("d", "year")])).toBe(false);
    expect(sameGroups([level("n", null, 10)], [level("n", null, 100)])).toBe(
      false,
    );
    expect(sameGroups([level("a")], [])).toBe(false);
    expect(sameGroups([], null)).toBe(true);
  });
});

describe("groupsToQuery / groupsFromQuery", () => {
  it("Groups -> param kawat: CSV berurutan + peta per kolom (hanya nilai non-null)", () => {
    const groups = [
      level("category"),
      level("order_date", "quarter"),
      level("amount", null, 100),
    ];

    expect(groupsToQuery(groups)).toEqual({
      group: "category,order_date,amount",
      groupGranularity: { order_date: "quarter" },
      groupRange: { amount: 100 },
    });
  });

  it("tanpa granularity/range tak menambah key peta kosong", () => {
    expect(groupsToQuery([level("a"), level("b")])).toEqual({ group: "a,b" });
  });

  it("Groups kosong: `group=` KOSONG hanya bila model punya default; selain itu param dihilangkan", () => {
    expect(groupsToQuery([], [level("category")])).toEqual({ group: "" });
    expect(groupsToQuery([], [])).toEqual({});
    expect(groupsToQuery(null)).toEqual({});
  });

  it("fallback boolean (mis. filter tersimpan aktif): true -> `group=` KOSONG, false -> dihilangkan; tak memengaruhi Groups berisi", () => {
    expect(groupsToQuery([], true)).toEqual({ group: "" });
    expect(groupsToQuery([], false)).toEqual({});
    expect(groupsToQuery([level("a")], true)).toEqual({ group: "a" });
  });

  it("round-trip lewat query string sungguhan (qs) -- angka & tanggal tetap sama", () => {
    const groups = [
      level("category"),
      level("order_date", "half"),
      level("amount", null, 0.5),
    ];

    const url = QueryString.stringify(groupsToQuery(groups), {
      skipNulls: true,
    });
    const parsed = QueryString.parse(url);

    expect(url).toContain("group=category%2Corder_date%2Camount");
    expect(groupsFromQuery(parsed)).toEqual(groups);
  });

  it("bookmark lama (skalar) dipetakan ke level pertama", () => {
    expect(
      groupsFromQuery({ group: "order_date", groupGranularity: "year" }),
    ).toEqual([level("order_date", "year")]);
  });

  it("param group tidak ada -> null; kosong -> []", () => {
    expect(groupsFromQuery({ page: "2" })).toBeNull();
    expect(groupsFromQuery(undefined)).toBeNull();
    expect(groupsFromQuery({ group: "" })).toEqual([]);
  });
});

describe("buildExpandParams", () => {
  it("ziggy.query tanpa page/group* lama + group EKSPLISIT dari nilai efektif groupMeta.levels", () => {
    const params = buildExpandParams(
      {
        fid: "abc",
        sort: "-name",
        page: "3",
        show: "50",
        group: "lama",
        groupGranularity: "year",
        groupRange: "5",
        groupPath: "[]",
        groupPage: "2",
      },
      [
        { column: "category", granularity: null, range: null, type: "string" },
        {
          column: "order_date",
          granularity: "quarter",
          range: null,
          type: "date",
        },
        { column: "amount", granularity: null, range: 100, type: "number" },
      ],
    );

    expect(params).toEqual({
      fid: "abc",
      sort: "-name",
      show: "50",
      group: "category,order_date,amount",
      groupGranularity: { order_date: "quarter" },
      groupRange: { amount: 100 },
    });
  });

  it("URL tanpa param apa pun (group berasal dari default) tetap menghasilkan group eksplisit", () => {
    expect(
      buildExpandParams({}, [
        {
          column: "status",
          granularity: null,
          range: null,
          type: "formStatus",
        },
      ]),
    ).toEqual({ group: "status" });
    expect(buildExpandParams(undefined, [])).toEqual({});
  });
});

describe("inheritFromDefaults", () => {
  const defaults = [level("order_date", "year"), level("amount", null, 500)];

  it("level dgn kolom SAMA yg tak menyebut granularity/range mewarisi dari default", () => {
    expect(
      inheritFromDefaults([level("category"), level("order_date")], defaults),
    ).toEqual([level("category"), level("order_date", "year")]);
    expect(inheritFromDefaults([level("amount")], defaults)).toEqual([
      level("amount", null, 500),
    ]);
  });

  it("nilai eksplisit di level menang atas default", () => {
    expect(inheritFromDefaults([level("order_date", "day")], defaults)).toEqual(
      [level("order_date", "day")],
    );
  });

  it("kolom LAIN tak mewarisi setelan kolom default (?group=<kolom lain>)", () => {
    expect(inheritFromDefaults([level("category")], defaults)).toEqual([
      level("category"),
    ]);
    expect(inheritFromDefaults([level("category")], [])).toEqual([
      level("category"),
    ]);
  });
});
