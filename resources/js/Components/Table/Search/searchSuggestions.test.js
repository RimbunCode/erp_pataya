import { describe, expect, it } from "vitest";
import { buildSuggestions } from "./searchSuggestions";

const t = (key, params) =>
  params
    ? `${key}[${Object.entries(params)
        .map(([k, v]) => `:${k}=${v}`)
        .join(",")}]`
    : key;

const columns = {
  code: { name: "code", title: "Kode", type: "string" },
  status: {
    name: "status",
    title: "Status",
    type: "formStatus",
    options: [
      { value: "draft", label: "Draft" },
      { value: "completed", label: "Selesai" },
    ],
  },
  active: { name: "active", title: "Aktif", type: "boolean" },
  hidden: { name: "hidden", title: "Hidden Col", type: "string", hidden: true },
  ignored: {
    name: "ignored",
    title: "Ignored Col",
    type: "string",
    ignore: true,
  },
  notSearchable: {
    name: "notSearchable",
    title: "Not Searchable",
    type: "string",
    searchable: false,
  },
  route: { name: "route", title: "route", type: "string" }, // meta append
};

const searchColumns = ["code"];
const savedFilters = [
  { id: 1, name: "Draft Saya" },
  { id: 2, name: "PO Bulan Ini" },
  { id: 3, name: null },
];
const groupOptions = [
  { value: "__no_group__", label: "Tidak Dikelompokkan" },
  { value: "status", label: "Status" },
  { value: "created_at", label: "Tanggal Dibuat" },
];

const ctx = { columns, searchColumns, savedFilters, groupOptions, t };

describe("buildSuggestions", () => {
  it("teks kosong/whitespace -> []", () => {
    expect(buildSuggestions("", ctx)).toEqual([]);
    expect(buildSuggestions("   ", ctx)).toEqual([]);
    expect(buildSuggestions(undefined, ctx)).toEqual([]);
  });

  it("urutan seksi: text -> saved -> column -> value -> group", () => {
    const sections = buildSuggestions("s", ctx).map((s) => s.section);
    expect(sections).toEqual(["text", "saved", "column", "value", "group"]);
  });

  it("seksi text hanya 1 item, label search_all", () => {
    const result = buildSuggestions("PT A", ctx);
    const textSection = result.find((s) => s.section === "text");
    expect(textSection.items).toHaveLength(1);
    expect(textSection.items[0].label).toBe(
      t("core.datatable.search.search_all", { text: "PT A" }),
    );
  });

  it("seksi text tidak muncul bila searchColumns kosong", () => {
    const result = buildSuggestions("PT A", { ...ctx, searchColumns: [] });
    expect(result.find((s) => s.section === "text")).toBeUndefined();
  });

  it("seksi saved cocok per nama, fallback untitled, dibatasi 3", () => {
    const many = [
      { id: 1, name: "Status A" },
      { id: 2, name: "Status B" },
      { id: 3, name: "Status C" },
      { id: 4, name: "Status D" },
    ];
    const result = buildSuggestions("status", { ...ctx, savedFilters: many });
    const savedSection = result.find((s) => s.section === "saved");
    expect(savedSection.items).toHaveLength(3);
  });

  it("saved filter tanpa nama -> fallback untitled key", () => {
    // Mock `t` mengembalikan key verbatim (tanpa param) -> query dicocokkan
    // ke key mentahnya, bukan teks Indonesia asli.
    const result = buildSuggestions("untitled", {
      ...ctx,
      savedFilters: [{ id: 9, name: null }],
    });
    const savedSection = result.find((s) => s.section === "saved");
    expect(savedSection.items[0].label).toBe(
      t("core.datatable.filter.saved.untitled"),
    );
  });

  it("seksi saved tidak muncul bila savedFilters tidak diberikan (mis. tanpa prop model)", () => {
    const { savedFilters: _omit, ...rest } = ctx;
    const result = buildSuggestions("PT A", rest);
    expect(result.find((s) => s.section === "saved")).toBeUndefined();
  });

  it("seksi column menyaring searchable:false / hidden / ignore / meta append", () => {
    const result = buildSuggestions("col", ctx); // cocok "Not Searchable"/"Hidden Col"/"Ignored Col" via kata "col"? gunakan title eksplisit di bawah
    // Uji eksplisit per kolom terlarang tidak pernah muncul apa pun query-nya
    // yang mestinya cocok nama title-nya.
    const hiddenResult = buildSuggestions("hidden col", ctx);
    expect(
      hiddenResult
        .find((s) => s.section === "column")
        ?.items.some((i) => i.payload.column === "hidden"),
    ).toBeFalsy();

    const ignoredResult = buildSuggestions("ignored col", ctx);
    expect(
      ignoredResult
        .find((s) => s.section === "column")
        ?.items.some((i) => i.payload.column === "ignored"),
    ).toBeFalsy();

    const notSearchableResult = buildSuggestions("not searchable", ctx);
    expect(
      notSearchableResult
        .find((s) => s.section === "column")
        ?.items.some((i) => i.payload.column === "notSearchable"),
    ).toBeFalsy();

    const routeResult = buildSuggestions("route", ctx);
    expect(
      routeResult
        .find((s) => s.section === "column")
        ?.items.some((i) => i.payload.column === "route"),
    ).toBeFalsy();

    expect(result).toBeDefined();
  });

  it("seksi column cocok title, dibatasi 5", () => {
    const manyColumns = Object.fromEntries(
      ["A", "B", "C", "D", "E", "F"].map((s) => [
        `col${s}`,
        { name: `col${s}`, title: `Kolom ${s}`, type: "string" },
      ]),
    );
    const result = buildSuggestions("kolom", { ...ctx, columns: manyColumns });
    expect(result.find((s) => s.section === "column").items).toHaveLength(5);
  });

  it("pencocokan case-insensitive & per kata", () => {
    const result = buildSuggestions("STATUS", ctx);
    const columnSection = result.find((s) => s.section === "column");
    expect(columnSection.items.some((i) => i.payload.column === "status")).toBe(
      true,
    );
  });

  it("seksi value: label opsi terjemahan (mis. 'Selesai') -> 'Status: Selesai'", () => {
    const result = buildSuggestions("selesai", ctx);
    const valueSection = result.find((s) => s.section === "value");
    expect(valueSection.items).toHaveLength(1);
    expect(valueSection.items[0].label).toBe("Status: Selesai");
    expect(valueSection.items[0].prefix).toBe("Status: ");
    expect(valueSection.items[0].payload).toEqual({
      k: "status",
      o: "=",
      v: "completed",
    });
  });

  it("seksi value: boolean menghasilkan label via core.datatable.yes/no", () => {
    // Mock `t` mengembalikan key verbatim -> cocokkan ke kata dlm key itu.
    const result = buildSuggestions("yes", ctx);
    const valueSection = result.find((s) => s.section === "value");
    expect(valueSection.items[0].label).toBe(
      `Aktif: ${t("core.datatable.yes")}`,
    );
  });

  it("seksi group: cocok label, exclude sentinel __no_group__, dibatasi 3", () => {
    const result = buildSuggestions("t", ctx); // "Tidak Dikelompokkan"/"Tanggal Dibuat" cocok huruf t
    const groupSection = result.find((s) => s.section === "group");
    expect(
      groupSection.items.every((i) => i.payload.column !== "__no_group__"),
    ).toBe(true);
  });

  it("seksi group label pakai group_by_label", () => {
    const result = buildSuggestions("status", ctx);
    const groupSection = result.find((s) => s.section === "group");
    expect(groupSection.items[0].label).toBe(
      t("core.datatable.search.group_by_label", { column: "Status" }),
    );
  });

  it("seksi group tidak muncul tanpa groupOptions", () => {
    const { groupOptions: _omit, ...rest } = ctx;
    const result = buildSuggestions("status", rest);
    expect(result.find((s) => s.section === "group")).toBeUndefined();
  });

  it("seksi kosong (tidak ada yg cocok) tidak dirender -- seksi text tetap tampil krn tak butuh match", () => {
    const result = buildSuggestions("xyzxyzxyz-tidak-ada-yg-cocok", ctx);
    expect(result.map((s) => s.section)).toEqual(["text"]);
  });

  it("tanpa searchColumns & tanpa yg cocok -> []", () => {
    const result = buildSuggestions("xyzxyzxyz-tidak-ada-yg-cocok", {
      ...ctx,
      searchColumns: [],
    });
    expect(result).toEqual([]);
  });
});

describe("buildSuggestions — revisi 2 (kolom tanggal, relasi, judul rusak)", () => {
  const now = new Date(2026, 8, 21);
  const extra = {
    ...columns,
    created_at: { name: "created_at", title: "Dibuat", type: "date" },
    category: {
      name: "category",
      title: "Kategori",
      type: "relation",
      columns: {
        "category.name": {
          name: "category.name",
          type: "string",
          title: "Nama",
        },
      },
    },
    orphanRelation: {
      name: "orphan",
      title: "Orphan",
      type: "relation",
      columns: {},
    },
    broken: {
      name: "asset_category_id",
      type: "string",
      titleTrans: "inventory.item.columns.asset_category_id",
      title: "inventory.item.columns.asset_category_id",
    },
    meta: { name: "meta", title: "Meta", type: "json" },
  };
  const ctx2 = { ...ctx, columns: extra, now };

  it("kolom tanggal menawarkan preset periode di seksi nilai (in_period absolut)", () => {
    const value = buildSuggestions("this_month", ctx2).find(
      (s) => s.section === "value",
    );
    expect(value.items).toHaveLength(1);
    expect(value.items[0]).toMatchObject({
      label: "Dibuat: core.datatable.search.period.this_month",
      prefix: "Dibuat: ",
      payload: {
        k: "created_at",
        o: "in_period",
        v: { period: "month", operator: "is", year: 2026, month: 8 },
      },
    });
  });

  it("preset dicocokkan per kata pada labelnya (bukan pada nama kolom)", () => {
    const value = buildSuggestions("period", ctx2).find(
      (s) => s.section === "value",
    );
    // Semua 6 preset cocok "period", tapi seksi dibatasi 5.
    expect(value.items).toHaveLength(5);
    expect(value.items.every((i) => i.payload.k === "created_at")).toBe(true);
  });

  it("kolom relasi (punya anak string) muncul di saran Kolom; tanpa anak string tidak", () => {
    const column = buildSuggestions("k", ctx2).find(
      (s) => s.section === "column",
    );
    const names = column.items.map((i) => i.payload.column);
    expect(names).toContain("category");
    expect(names).not.toContain("orphan");
  });

  it("kolom dengan judul belum diterjemahkan disembunyikan (asset_category_id)", () => {
    const all = buildSuggestions("inventory", ctx2);
    expect(all.find((s) => s.section === "column")).toBeUndefined();
  });

  it("kolom tipe tak didukung (json) tidak pernah ditawarkan", () => {
    const column = buildSuggestions("meta", ctx2).find(
      (s) => s.section === "column",
    );
    expect(column).toBeUndefined();
  });

  it("tanpa `now`, memakai tanggal sekarang (tidak melempar)", () => {
    const { now: _omit, ...noNow } = ctx2;
    expect(() => buildSuggestions("today", noNow)).not.toThrow();
    const value = buildSuggestions("today", noNow).find(
      (s) => s.section === "value",
    );
    expect(value.items[0].payload.v.period).toBe("day");
  });
});
