import { describe, expect, it } from "vitest";
import { buildSuggestions, findRelationScope } from "./searchSuggestions";

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

  it("urutan seksi DEFAULT (tanpa prefix match apa pun) = urutan insersi lama: text -> value", () => {
    // "elesa" cuma SUBSTRING "Selesai" (opsi Status) -- BUKAN prefix, jadi
    // skornya SAMA dgn seksi teks bebas (yg selalu tampil, label tak pernah
    // diawali query) -> tier seri, urutan jatuh balik ke insersi asli
    // (stable sort, Requirement 20.3). column/saved/group section tak
    // punya match sama sekali utk query ini (absen, bukan cuma turun skor).
    const sections = buildSuggestions("elesa", ctx).map((s) => s.section);
    expect(sections).toEqual(["text", "value"]);
  });

  it("urutan seksi DINAMIS ikut skor tertinggi -- prefix match menang atas teks bebas (Requirement 20.3)", () => {
    // "s" prefix-match "Status" (kolom & group) dan "Selesai"/"Saya" (value/
    // saved) -- tier LEBIH TINGGI drpd label teks bebas (selalu diawali
    // "core.datatable.search.search_all...", tak pernah diawali query).
    // Seksi ber-prefix-match naik di atas "text", urutan ANTAR seksi
    // ber-skor sama mengikuti insersi asli (stable).
    const sections = buildSuggestions("s", ctx).map((s) => s.section);
    expect(sections).toEqual(["saved", "column", "value", "group", "text"]);
  });

  it("dalam SATU seksi: item prefix match diurutkan di atas item substring-only (Requirement 20.1)", () => {
    // "Status" cocok "s" sbg PREFIX (awal kata). "Uraian pesanan" cocok "s"
    // cuma SUBSTRING di tengah kata "pesanan" -- harus di BAWAH "Status".
    const withS = {
      ...columns,
      description: {
        name: "description",
        title: "Uraian pesanan",
        type: "string",
      },
    };
    const result = buildSuggestions("s", { ...ctx, columns: withS });
    const columnSection = result.find((s) => s.section === "column");
    const labels = columnSection.items.map((i) => i.label);
    // "Status" (prefix kata) harus lebih dulu drpd "Uraian pesanan" (substring
    // di tengah kata "pesanan").
    expect(labels.indexOf("Status")).toBeLessThan(
      labels.indexOf("Uraian pesanan"),
    );
  });

  it("boost recentColumns menaikkan kolom substring-only DI ATAS kolom substring-only lain yg blm pernah dipakai, TAPI TETAP di bawah prefix match (Requirement 20.2)", () => {
    const withTwoSubstring = {
      ...columns,
      description: {
        name: "description",
        title: "Uraian pesanan",
        type: "string",
      },
      history: { name: "history", title: "Riwayat pesanan", type: "string" },
    };
    const withoutBoost = buildSuggestions("s", {
      ...ctx,
      columns: withTwoSubstring,
    }).find((sec) => sec.section === "column");
    const withBoost = buildSuggestions("s", {
      ...ctx,
      columns: withTwoSubstring,
      recentColumns: ["history"],
    }).find((sec) => sec.section === "column");

    // Tanpa boost: urutan insersi asli objek (Object.values) -- "history"
    // TIDAK didahulukan drpd "description".
    const idxDescNoBoost = withoutBoost.items.findIndex(
      (i) => i.payload.column === "description",
    );
    const idxHistNoBoost = withoutBoost.items.findIndex(
      (i) => i.payload.column === "history",
    );
    expect(idxHistNoBoost).toBeGreaterThan(idxDescNoBoost);

    // Dengan boost: "history" (baru dipakai) naik DI ATAS "description".
    const idxDescBoost = withBoost.items.findIndex(
      (i) => i.payload.column === "description",
    );
    const idxHistBoost = withBoost.items.findIndex(
      (i) => i.payload.column === "history",
    );
    expect(idxHistBoost).toBeLessThan(idxDescBoost);

    // TAPI "Status" (prefix match asli, skor 20) tetap DI ATAS "history"
    // yg cuma substring+boost (skor 11) -- boost TAK PERNAH ngalahin prefix.
    const idxStatus = withBoost.items.findIndex(
      (i) => i.payload.column === "status",
    );
    expect(idxStatus).toBeLessThan(idxHistBoost);
  });

  it("tanpa `recentColumns` (undefined) -> boost nonaktif, tak error (Requirement 20.5)", () => {
    expect(() => buildSuggestions("s", ctx)).not.toThrow();
    const sections = buildSuggestions("s", ctx).map((s) => s.section);
    expect(sections).toEqual(["saved", "column", "value", "group", "text"]);
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

  it("seksi value: kolom formStatuses (array status) -> `in` berisi satu nilai, bukan `=` (backend tak menerima `=`)", () => {
    const result = buildSuggestions("disetujui", {
      ...ctx,
      columns: {
        ...columns,
        docStatus: {
          name: "docStatus",
          title: "Approval",
          type: "formStatuses",
          options: [
            { value: "draft", label: "Draft" },
            { value: "approved", label: "Disetujui" },
          ],
        },
      },
    });
    const valueSection = result.find((s) => s.section === "value");
    expect(valueSection.items[0].payload).toEqual({
      k: "docStatus",
      o: "in",
      v: ["approved"],
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
      related: "App\Models\Inventory\Category",
      columns: {
        "category.name": {
          name: "category.name",
          type: "string",
          title: "Nama",
        },
      },
    },
    // Relasi TANPA `related` (config rusak, tak ada model target utk
    // di-fetch anaknya) -- satu2nya bentuk relasi yg TETAP disembunyikan.
    // Relasi NORMAL tanpa anak ter-hydrate (spt `category` sebelum
    // di-hydrate) justru HARUS tetap muncul -- lihat test di bawah.
    brokenRelation: {
      name: "brokenRelation",
      title: "Broken Relation",
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

  it("kolom relasi muncul di saran Kolom asal punya `related`, WALAU anak belum ter-hydrate (regresi: category/default_unit hilang)", () => {
    const column = buildSuggestions("k", ctx2).find(
      (s) => s.section === "column",
    );
    const names = column.items.map((i) => i.payload.column);
    expect(names).toContain("category");
  });

  it("kolom relasi TANPA `related` (config rusak) tetap disembunyikan", () => {
    const column = buildSuggestions("broken", ctx2).find(
      (s) => s.section === "column",
    );
    expect(column).toBeUndefined();
  });

  it("kolom dengan judul belum diterjemahkan TETAP muncul -- paritas FilterItem2 (regresi: asset_category_id/id/type hilang dari daftar Kolom Item padahal tetap ada di Filter lanjutan)", () => {
    const column = buildSuggestions("inventory", ctx2).find(
      (s) => s.section === "column",
    );
    expect(
      column.items.some((i) => i.payload.column === "asset_category_id"),
    ).toBe(true);
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

describe("buildSuggestions — revisi 13 (saran nilai terbatas ke kolom yg disebut)", () => {
  const now = new Date(2026, 8, 21);
  const months = [
    "Januari",
    "Februari",
    "Maret",
    "April",
    "Mei",
    "Juni",
    "Juli",
    "Agustus",
    "September",
    "Oktober",
    "November",
    "Desember",
  ];
  const dateContext = {
    i18nLabels: {
      months,
      monthsShort: months.map((m) => m.slice(0, 3)),
    },
  };
  const cols = {
    code: { name: "code", title: "Kode", type: "string" },
    status: {
      name: "status",
      title: "Status",
      type: "formStatus",
      // Sengaja TIDAK urut abjad -- daftar dari `buildOptionList` diurut.
      options: [
        { value: "submitted", label: "Diajukan" },
        { value: "draft", label: "Draft" },
        { value: "approved", label: "Disetujui" },
        { value: "completed", label: "Selesai" },
      ],
    },
    active: { name: "active", title: "Aktif", type: "boolean" },
    created_at: { name: "created_at", title: "Dibuat", type: "date" },
    total: { name: "total", title: "Total", type: "currency" },
    category: {
      name: "category",
      title: "Kategori",
      type: "relation",
      related: "App\\Models\\Inventory\\Category",
      columns: {},
    },
  };
  const c = { columns: cols, searchColumns: ["code"], t, now, dateContext };
  const valueOf = (text, extra = {}) =>
    buildSuggestions(text, { ...c, ...extra }).find(
      (s) => s.section === "value",
    );

  it("hanya judul kolom -> nilai kolom itu, urut abjad label (bukan urutan options)", () => {
    const value = valueOf("status");
    expect(value.items.map((i) => i.label)).toEqual([
      "Status: Diajukan",
      "Status: Disetujui",
      "Status: Draft",
      "Status: Selesai",
    ]);
    expect(value.items[0]).toMatchObject({
      prefix: "Status: ",
      badgeStatus: "submitted",
      payload: { k: "status", o: "=", v: "submitted" },
    });
  });

  it("judul kolom + sebagian label nilai (urutan kata bebas) -> hanya nilai yg cocok", () => {
    for (const text of ["status sel", "sel status", "Status SEL"]) {
      const value = valueOf(text);
      expect(value.items.map((i) => i.label)).toEqual(["Status: Selesai"]);
    }
  });

  it("label nilai saja (tanpa judul kolom) tetap cocok seperti biasa", () => {
    const value = valueOf("selesai");
    expect(value.items.map((i) => i.label)).toEqual(["Status: Selesai"]);
  });

  it("kata kolom tak membocorkan nilai kolom lain", () => {
    const value = valueOf("status");
    expect(value.items.every((i) => i.payload.k === "status")).toBe(true);
  });

  it("boolean: 'aktif' -> Ya/Tidak; 'aktif yes' -> hanya Ya", () => {
    expect(valueOf("aktif").items.map((i) => i.payload)).toEqual([
      { k: "active", o: "=", v: true },
      { k: "active", o: "=", v: false },
    ]);
    expect(valueOf("aktif yes").items).toHaveLength(1);
    expect(valueOf("aktif yes").items[0].payload.v).toBe(true);
  });

  it("date: 'dibuat this_month' -> preset periode kolom itu", () => {
    const value = valueOf("dibuat this_month");
    expect(value.items).toHaveLength(1);
    expect(value.items[0]).toMatchObject({
      prefix: "Dibuat: ",
      payload: {
        k: "created_at",
        o: "in_period",
        v: { period: "month", operator: "is", year: 2026, month: 8 },
      },
    });
  });

  it("date: 'dibuat sep 2026' -> periode terparse; tanpa dateContext tak ada saran periode", () => {
    const value = valueOf("dibuat sep 2026");
    expect(value.items[0]).toMatchObject({
      prefix: "Dibuat: ",
      payload: {
        k: "created_at",
        o: "in_period",
        v: { period: "month", year: 2026, month: 8 },
      },
    });
    expect(
      valueOf("dibuat sep 2026", { dateContext: undefined }),
    ).toBeUndefined();
  });

  it("date: simbol perbandingan ikut ('dibuat >= jan 26' -> on-or-after)", () => {
    const value = valueOf("dibuat >= jan 26");
    expect(value.items[0].payload).toMatchObject({
      k: "created_at",
      o: "in_period",
      v: { operator: "on-or-after", month: 0 },
    });
  });

  it("number: 'total 500' -> `=` 500; 'total >= 500' -> `>=`; bukan angka -> tak ada saran", () => {
    expect(valueOf("total 500").items[0]).toMatchObject({
      label: "Total: 500",
      payload: { k: "total", o: "=", v: 500 },
    });
    expect(valueOf("total >= 500").items[0].payload).toEqual({
      k: "total",
      o: ">=",
      v: 500,
    });
    expect(valueOf("total abc")).toBeUndefined();
    expect(valueOf("total")).toBeUndefined();
  });

  it("text: 'kode Budi' -> `matches` Budi (huruf asli dipertahankan); judul saja -> tak ada saran nilai", () => {
    expect(valueOf("kode Budi").items[0]).toMatchObject({
      label: 'Kode: "Budi"',
      payload: { k: "code", o: "matches", v: "Budi" },
    });
    expect(valueOf("kode")).toBeUndefined();
  });

  it("relation: record dari host masuk seksi nilai (`=` + record penuh)", () => {
    const record = { id: 7, name: "Elektronik" };
    const value = valueOf("kategori elek", {
      relationRecords: {
        column: "category",
        records: [{ record, label: "Elektronik" }],
      },
    });
    expect(value.items).toEqual([
      {
        key: "value-category-7",
        label: "Kategori: Elektronik",
        prefix: "Kategori: ",
        payload: { k: "category", o: "=", v: record },
      },
    ]);
  });

  it("relationRecords kosong / kolomnya tak dikenal -> tak ada item", () => {
    expect(valueOf("kategori", { relationRecords: null })).toBeUndefined();
    expect(
      valueOf("kategori", {
        relationRecords: {
          column: "unknown",
          records: [{ record: { id: 1 }, label: "X" }],
        },
      }),
    ).toBeUndefined();
  });
});

describe("findRelationScope — kolom relation yg disebut ketikan (revisi 13)", () => {
  const cols = {
    status: {
      name: "status",
      title: "Status",
      type: "formStatus",
      options: ["a"],
    },
    category: {
      name: "category",
      title: "Kategori",
      type: "relation",
      related: "Cat",
      columns: {},
    },
    subCategory: {
      name: "subCategory",
      title: "Sub Kategori",
      type: "relation",
      related: "Sub",
      columns: {},
    },
    broken: { name: "broken", title: "Rusak", type: "relation", columns: {} },
  };

  it("judul saja -> search kosong; judul + kata -> search = sisa kata (huruf asli)", () => {
    expect(findRelationScope("kategori", { columns: cols, t })).toMatchObject({
      column: { name: "category" },
      search: "",
    });
    expect(
      findRelationScope("Kategori Elek", { columns: cols, t }),
    ).toMatchObject({ column: { name: "category" }, search: "Elek" });
  });

  it("kolom dgn kata kolom terbanyak menang ('sub kategori' -> Sub Kategori)", () => {
    expect(
      findRelationScope("sub kategori", { columns: cols, t }).column.name,
    ).toBe("subCategory");
  });

  it("ketikan < 3 huruf, tak menyebut kolom relation, atau relation tanpa `related` -> null", () => {
    expect(findRelationScope("ka", { columns: cols, t })).toBeNull();
    expect(findRelationScope("status", { columns: cols, t })).toBeNull();
    expect(findRelationScope("rusak", { columns: cols, t })).toBeNull();
    expect(findRelationScope("", { columns: cols, t })).toBeNull();
  });
});
