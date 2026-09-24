import { describe, expect, it } from "vitest";
import {
  buildDatePresets,
  buildLeafFromText,
  columnTitle,
  formatPeriodValue,
  isColumnSearchable,
  relationLabelColumn,
  resolveColumnPath,
  resolveValueMode,
} from "./columnSearch";

const t = (key) => key;

const relationColumn = (children) => ({
  name: "category",
  type: "relation",
  related: "App\Models\Inventory\Category",
  title: "Kategori",
  columns: Object.fromEntries(
    children.map((c) => [
      `category.${c.name}`,
      { ...c, name: `category.${c.name}` },
    ]),
  ),
});

describe("relationLabelColumn", () => {
  it("memilih anak 'name' lebih dulu, lalu 'code', lalu 'title'", () => {
    const col = relationColumn([
      { name: "code", type: "string" },
      { name: "name", type: "string" },
    ]);
    expect(relationLabelColumn(col).name).toBe("category.name");

    const onlyCode = relationColumn([
      { name: "id", type: "string" },
      { name: "code", type: "string" },
    ]);
    expect(relationLabelColumn(onlyCode).name).toBe("category.code");
  });

  it("fallback ke anak string pertama bila tak ada nama yang dikenal", () => {
    const col = relationColumn([
      { name: "amount", type: "number" },
      { name: "label", type: "string" },
    ]);
    expect(relationLabelColumn(col).name).toBe("category.label");
  });

  it("mengabaikan anak non-string, searchable:false, hidden, dan ignore", () => {
    const col = relationColumn([
      { name: "name", type: "string", searchable: false },
      { name: "code", type: "string", hidden: true },
      { name: "title", type: "string", ignore: true },
      { name: "qty", type: "number" },
    ]);
    expect(relationLabelColumn(col)).toBeNull();
  });

  it("null bila relasi tak punya anak sama sekali", () => {
    expect(relationLabelColumn({ type: "relation" })).toBeNull();
    expect(relationLabelColumn(null)).toBeNull();
  });
});

describe("resolveValueMode", () => {
  it.each([
    [{ type: "string" }, "text"],
    [{ type: "number" }, "number"],
    [{ type: "currency" }, "number"],
    [{ type: "boolean" }, "list"],
    [{ type: "date" }, "date"],
    [{ type: "datetime" }, "date"],
    [{ type: "formStatus", options: ["draft", "done"] }, "list"],
    [{ type: "string", options: { a: "A" } }, "list"],
  ])("%j -> %s", (column, expected) => {
    expect(resolveValueMode(column)).toBe(expected);
  });

  it("opsi kosong tidak dianggap 'list'", () => {
    expect(resolveValueMode({ type: "string", options: [] })).toBe("text");
  });

  it("relasi SELALU 'relation' asal punya `related` -- backend tak pernah kirim anak pre-populated (getColumns() selalu 'columns: []' utk tipe relation), anak di-hydrate lazy oleh caller", () => {
    expect(
      resolveValueMode(relationColumn([{ name: "name", type: "string" }])),
    ).toBe("relation");
    // Belum ter-hydrate (columns kosong) -- TETAP "relation" (bukan null).
    expect(resolveValueMode(relationColumn([]))).toBe("relation");
    expect(
      resolveValueMode({
        type: "relation",
        related: "App\Models\X",
        columns: {},
      }),
    ).toBe("relation");
    // Tanpa `related` (config rusak, tak ada model target utk di-fetch) -> null.
    expect(resolveValueMode({ type: "relation", columns: {} })).toBeNull();
  });

  it.each([
    [{ type: "json" }],
    [{ type: "mixed" }],
    [{ type: "relations" }],
    [{ type: "time" }],
    [{ type: "image" }],
    [null],
    [undefined],
  ])("tipe tak didukung %j -> null", (column) => {
    expect(resolveValueMode(column)).toBeNull();
  });
});

describe("columnTitle", () => {
  it("memakai title, lalu t(titleTrans), lalu name", () => {
    expect(
      columnTitle({ title: "Nama", titleTrans: "x.name", name: "n" }, t),
    ).toBe("Nama");
    expect(columnTitle({ titleTrans: "x.name", name: "n" }, t)).toBe("x.name");
    expect(columnTitle({ name: "n" }, t)).toBe("n");
  });
});

describe("isColumnSearchable", () => {
  it("menerima kolom normal yang tipenya didukung", () => {
    expect(
      isColumnSearchable({ name: "code", type: "string", title: "Kode" }, t),
    ).toBe(true);
  });

  it.each([
    ["searchable:false", { name: "a", type: "string", searchable: false }],
    ["hidden", { name: "a", type: "string", hidden: true }],
    ["ignore", { name: "a", type: "string", ignore: true }],
    [
      "kolom anak relasi",
      { name: "a.b", type: "string", parentCol: { name: "a" } },
    ],
    ["tipe tak didukung", { name: "a", type: "json" }],
  ])("menolak %s", (_label, column) => {
    expect(isColumnSearchable(column, t)).toBe(false);
  });

  it("menolak kolom meta append (mis. route)", () => {
    expect(isColumnSearchable({ name: "route", type: "string" }, t)).toBe(
      false,
    );
  });

  it("menerima kolom yang judulnya BELUM diterjemahkan -- paritas dgn FilterItem2 (regresi: asset_category_id/id/type hilang dari daftar Kolom padahal tetap ada di Filter lanjutan)", () => {
    // FilterItem2 (`resolveColumn`/label kolom di FilterItem2.jsx) tak pernah
    // menggate pilihan kolom pada terjemahan -- t() yg mengembalikan key
    // mentah cuma bikin labelnya jelek, bukan alasan menyembunyikan kolom.
    // Akar masalah nyatanya: lang/id/inventory/item.php belum punya entri
    // utk kolom2 itu (gap konten, bukan bug filter kolom).
    const untranslated = {
      name: "asset_category_id",
      type: "string",
      titleTrans: "inventory.item.columns.asset_category_id",
      title: "inventory.item.columns.asset_category_id",
    };
    expect(isColumnSearchable(untranslated, t)).toBe(true);
    expect(isColumnSearchable({ ...untranslated, title: undefined }, t)).toBe(
      true,
    );
  });

  it("menolak relasi tanpa `related` (config rusak, tak ada model target)", () => {
    expect(
      isColumnSearchable({ name: "r", type: "relation", columns: {} }, t),
    ).toBe(false);
  });

  it("menerima relasi walau anak BELUM ter-hydrate, asal punya `related` (regresi: category/default_unit hilang dari daftar Kolom)", () => {
    expect(
      isColumnSearchable(
        {
          name: "category",
          type: "relation",
          related: "App\\Models\\Inventory\\Category",
          title: "Kategori",
          columns: [],
        },
        t,
      ),
    ).toBe(true);
  });

  it("null/undefined -> false", () => {
    expect(isColumnSearchable(null, t)).toBe(false);
    expect(isColumnSearchable(undefined, t)).toBe(false);
  });
});

describe("buildDatePresets", () => {
  // 21 Sep 2026 -- bulan indeks 8 (0-based).
  const now = new Date(2026, 8, 21);
  const presets = Object.fromEntries(
    buildDatePresets(now, t).map((p) => [p.key, p]),
  );

  it("menghasilkan 6 preset berurutan dengan label i18n", () => {
    expect(buildDatePresets(now, t).map((p) => p.key)).toEqual([
      "today",
      "yesterday",
      "this_month",
      "last_month",
      "this_year",
      "last_year",
    ]);
    expect(presets.today.label).toBe("core.datatable.search.period.today");
  });

  it("nilai in_period absolut sesuai bentuk DateSelector/FilterEvaluator", () => {
    expect(presets.today.value).toEqual({
      period: "day",
      operator: "is",
      startDate: "2026-09-21",
    });
    expect(presets.yesterday.value.startDate).toBe("2026-09-20");
    expect(presets.this_month.value).toEqual({
      period: "month",
      operator: "is",
      year: 2026,
      month: 8,
    });
    expect(presets.last_month.value).toEqual({
      period: "month",
      operator: "is",
      year: 2026,
      month: 7,
    });
    expect(presets.this_year.value).toEqual({
      period: "year",
      operator: "is",
      year: 2026,
    });
    expect(presets.last_year.value.year).toBe(2025);
  });

  it("batas tahun: 'kemarin' tgl 1 Jan dan 'bulan lalu' di Januari mundur ke tahun sebelumnya", () => {
    const jan = Object.fromEntries(
      buildDatePresets(new Date(2027, 0, 1), t).map((p) => [p.key, p]),
    );
    expect(jan.yesterday.value.startDate).toBe("2026-12-31");
    expect(jan.last_month.value).toMatchObject({ year: 2026, month: 11 });
  });
});

describe("formatPeriodValue", () => {
  it.each([
    [
      { period: "day", operator: "is", startDate: "2026-09-21T00:00:00.000Z" },
      "2026-09-21",
    ],
    [{ period: "month", operator: "is", year: 2026, month: 8 }, "2026-09"],
    [{ period: "quarter", operator: "is", year: 2026, quarter: 2 }, "2026 Q3"],
    [
      { period: "half-year", operator: "is", year: 2026, halfYear: 1 },
      "2026 H2",
    ],
    [{ period: "year", operator: "is", year: 2026 }, "2026"],
  ])("%j -> %s", (value, expected) => {
    expect(formatPeriodValue(value)).toBe(expected);
  });

  it("rentang (between) memakai en dash", () => {
    expect(
      formatPeriodValue({
        period: "month",
        operator: "between",
        rangeStart: { year: 2026, value: 0 },
        rangeEnd: { year: 2026, value: 5 },
      }),
    ).toBe("2026-01 – 2026-06");
    expect(
      formatPeriodValue({
        period: "day",
        operator: "between",
        startDate: "2026-09-01",
        endDate: "2026-09-30",
      }),
    ).toBe("2026-09-01 – 2026-09-30");
  });

  it("nilai kosong / bukan objek -> string kosong", () => {
    expect(formatPeriodValue(null)).toBe("");
    expect(formatPeriodValue("x")).toBe("");
    expect(formatPeriodValue({})).toBe("");
  });
});

describe("buildLeafFromText", () => {
  it("string -> matches", () => {
    expect(
      buildLeafFromText({ name: "code", type: "string" }, "  abc  "),
    ).toEqual({
      k: "code",
      o: "matches",
      v: "abc",
    });
  });

  it("number/currency -> '=' dengan Number; non-numerik -> null", () => {
    const col = { name: "total", type: "currency" };
    expect(buildLeafFromText(col, "1500")).toEqual({
      k: "total",
      o: "=",
      v: 1500,
    });
    expect(buildLeafFromText(col, "12.5")).toEqual({
      k: "total",
      o: "=",
      v: 12.5,
    });
    expect(buildLeafFromText(col, "abc")).toBeNull();
  });

  it("relasi -> matches di kolom anak berlabel (path dotted)", () => {
    const col = relationColumn([
      { name: "code", type: "string" },
      { name: "name", type: "string" },
    ]);
    expect(buildLeafFromText(col, "elek")).toEqual({
      k: "category.name",
      o: "matches",
      v: "elek",
    });
  });

  it("teks kosong / whitespace -> null", () => {
    expect(
      buildLeafFromText({ name: "code", type: "string" }, "   "),
    ).toBeNull();
    expect(buildLeafFromText({ name: "code", type: "string" }, "")).toBeNull();
  });

  it("mode list/date/tak didukung tidak dibangun dari teks -> null", () => {
    expect(buildLeafFromText({ name: "ok", type: "boolean" }, "ya")).toBeNull();
    expect(buildLeafFromText({ name: "d", type: "date" }, "2026")).toBeNull();
    expect(buildLeafFromText({ name: "j", type: "json" }, "x")).toBeNull();
  });
});

describe("resolveColumnPath", () => {
  // Bentuk asli peta DataTable2.getColumns(): anak berkunci & bernama dotted penuh.
  const columns = {
    code: { name: "code", type: "string", title: "Kode" },
    category: {
      name: "category",
      type: "relation",
      title: "Kategori",
      columns: {
        "category.name": {
          name: "category.name",
          type: "string",
          title: "Nama",
        },
      },
    },
    // Bentuk lama/relatif (nama anak tanpa prefix) tetap ditangani resolveColumn.
    legacy: {
      name: "legacy",
      type: "relation",
      columns: { label: { name: "label", type: "string", title: "Label" } },
    },
  };

  it("kolom level-atas", () => {
    expect(resolveColumnPath(columns, "code").title).toBe("Kode");
  });

  it("anak relasi bentuk DataTable2 (kunci & nama dotted penuh)", () => {
    expect(resolveColumnPath(columns, "category.name").title).toBe("Nama");
  });

  it("anak relasi bentuk relatif tetap ter-resolve (jalur resolveColumn)", () => {
    expect(resolveColumnPath(columns, "legacy.label").title).toBe("Label");
  });

  it("tak ter-resolve -> null (kolom, anak, atau relasi tak dikenal)", () => {
    expect(resolveColumnPath(columns, "ghost")).toBeNull();
    expect(resolveColumnPath(columns, "category.ghost")).toBeNull();
    expect(resolveColumnPath(columns, "ghost.name")).toBeNull();
    expect(resolveColumnPath(columns, "")).toBeNull();
    expect(resolveColumnPath(columns, null)).toBeNull();
  });
});
