import { describe, expect, it } from "vitest";
import {
  buildDateChipsLeaf,
  buildListLeaf,
  chipEntryViolation,
  hasValueSymbol,
  buildDateLeafFromText,
  buildDatePresets,
  buildDateWidgetValue,
  buildLeafFromText,
  buildChipsLeaf,
  columnTitle,
  dateSignature,
  formatPeriodValue,
  isColumnSearchable,
  leafDatePeriods,
  leafToText,
  mergeDatePeriods,
  parseDatePeriod,
  parseMultiValueText,
  relationLabelColumn,
  resolveColumnPath,
  resolveValueMode,
  separatorsFor,
  parseDateText,
  periodValueToText,
  suggestionYears,
  suggestPeriodTokens,
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

describe("formatPeriodValue — format chip `dd MMM yyyy HH:mm` (revisi 9)", () => {
  it.each([
    [
      { period: "day", operator: "is", startDate: "2026-09-21T00:00:00.000Z" },
      "21 Sep 2026",
    ],
    [{ period: "month", operator: "is", year: 2026, month: 8 }, "Sep 2026"],
    [{ period: "quarter", operator: "is", year: 2026, quarter: 2 }, "Q3 2026"],
    [
      { period: "half-year", operator: "is", year: 2026, halfYear: 1 },
      "H2 2026",
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
    ).toBe("Jan 2026 – Jun 2026");
    expect(
      formatPeriodValue({
        period: "day",
        operator: "between",
        startDate: "2026-09-01",
        endDate: "2026-09-30",
      }),
    ).toBe("01 Sep 2026 – 30 Sep 2026");
  });

  it("operator perbandingan tampil sbg simbol (`>`, `>=`, `<`, `<=`) di depan nilai", () => {
    expect(
      formatPeriodValue({ period: "year", operator: "after", year: 2026 }),
    ).toBe(">2026");
    expect(
      formatPeriodValue({
        period: "month",
        operator: "on-or-before",
        year: 2026,
        month: 8,
      }),
    ).toBe("<=Sep 2026");
    expect(
      formatPeriodValue({
        period: "day",
        operator: "on-or-after",
        startDate: "2026-09-21",
      }),
    ).toBe(">=21 Sep 2026");
  });

  it("hari: Date mentah / string; jam `HH:mm` (24 jam) tampil hanya bila bukan 00:00", () => {
    expect(
      formatPeriodValue({
        period: "day",
        operator: "is",
        startDate: new Date(2026, 8, 21),
      }),
    ).toBe("21 Sep 2026");
    expect(
      formatPeriodValue({
        period: "day",
        operator: "is",
        startDate: new Date(2026, 8, 21, 19, 5),
      }),
    ).toBe("21 Sep 2026 19:05");
    expect(
      formatPeriodValue({
        period: "day",
        operator: "is",
        startDate: "2026-09-21 14:30",
      }),
    ).toBe("21 Sep 2026 14:30");
    expect(
      formatPeriodValue({
        period: "day",
        operator: "is",
        startDate: "2026-09-21 00:00",
      }),
    ).toBe("21 Sep 2026");
  });

  it("nama bulan singkat mengikuti locale yg dioper (mis. Indonesia: Agu/Okt/Des)", () => {
    const id = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "Mei",
      "Jun",
      "Jul",
      "Agu",
      "Sep",
      "Okt",
      "Nov",
      "Des",
    ];
    expect(
      formatPeriodValue(
        { period: "day", operator: "is", startDate: "2026-08-17" },
        id,
      ),
    ).toBe("17 Agu 2026");
    expect(
      formatPeriodValue(
        { period: "month", operator: "is", year: 2026, month: 11 },
        id,
      ),
    ).toBe("Des 2026");
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

describe("buildLeafFromText — sintaks simbol revisi 3 (Requirement 19)", () => {
  const strCol = { name: "code", type: "string" };
  const numCol = { name: "total", type: "currency" };
  const relCol = relationColumn([
    { name: "code", type: "string" },
    { name: "name", type: "string" },
  ]);

  it("awalan '!' -> negasi (!matches text/relation, != number)", () => {
    expect(buildLeafFromText(strCol, "!abc")).toEqual({
      k: "code",
      o: "!matches",
      v: "abc",
    });
    expect(buildLeafFromText(numCol, "!1500")).toEqual({
      k: "total",
      o: "!=",
      v: 1500,
    });
    expect(buildLeafFromText(relCol, "!elek")).toEqual({
      k: "category.name",
      o: "!matches",
      v: "elek",
    });
  });

  it("'!' tanpa sisa teks (cuma bang) -> literal apa adanya, bukan negasi kosong", () => {
    expect(buildLeafFromText(strCol, "!")).toEqual({
      k: "code",
      o: "matches",
      v: "!",
    });
  });

  it("awalan perbandingan (>,>=,<,<=) -> operator sesuai, KHUSUS number", () => {
    expect(buildLeafFromText(numCol, ">500")).toEqual({
      k: "total",
      o: ">",
      v: 500,
    });
    expect(buildLeafFromText(numCol, ">=500")).toEqual({
      k: "total",
      o: ">=",
      v: 500,
    });
    expect(buildLeafFromText(numCol, "<100")).toEqual({
      k: "total",
      o: "<",
      v: 100,
    });
    expect(buildLeafFromText(numCol, "<=100")).toEqual({
      k: "total",
      o: "<=",
      v: 100,
    });
  });

  it("perbandingan pada kolom text -> TIDAK dikenali, fallback literal SELURUH teks termasuk simbol", () => {
    expect(buildLeafFromText(strCol, ">500")).toEqual({
      k: "code",
      o: "matches",
      v: ">500",
    });
  });

  it("daftar dipisah pipe (revisi 6, ganti koma) -> 'in' (text/number/relation), TIDAK berlaku bila cuma 1 nilai", () => {
    expect(buildLeafFromText(strCol, "a | b | c")).toEqual({
      k: "code",
      o: "in",
      v: ["a", "b", "c"],
    });
    expect(buildLeafFromText(numCol, "10 | 20 | 30")).toEqual({
      k: "total",
      o: "in",
      v: [10, 20, 30],
    });
    expect(buildLeafFromText(relCol, "PT A | PT B")).toEqual({
      k: "category.name",
      o: "in",
      v: ["PT A", "PT B"],
    });
    // Cuma 1 nilai efektif (pipe trailing) -> bukan 'in', tetap literal biasa.
    expect(buildLeafFromText(strCol, "a|")).toEqual({
      k: "code",
      o: "matches",
      v: "a|",
    });
  });

  it("koma TIDAK LAGI jadi separator 'in' (revisi 6) -- diperlakukan sbg bagian teks/gagal number literal", () => {
    expect(buildLeafFromText(strCol, "a, b, c")).toEqual({
      k: "code",
      o: "matches",
      v: "a, b, c",
    });
    expect(buildLeafFromText(numCol, "10, 20, 30")).toBeNull();
  });

  it("pipe dgn salah satu nilai non-numerik pada kolom number -> bukan 'in' (gagal), literal teks utuh JUGA gagal (Number NaN) -> null", () => {
    expect(buildLeafFromText(numCol, "10 | abc")).toBeNull();
  });

  it("kolom list/boolean/date TIDAK tersentuh sintaks simbol -- tetap null spt sebelumnya", () => {
    expect(
      buildLeafFromText({ name: "ok", type: "boolean" }, "!ya"),
    ).toBeNull();
    expect(buildLeafFromText({ name: "d", type: "date" }, ">2026")).toBeNull();
  });
});

describe("buildLeafFromText — sintaks 'between' revisi 6 (Requirement 26.3)", () => {
  const numCol = { name: "total", type: "number" };
  const strCol = { name: "code", type: "string" };

  it("'a..b' pada kolom number -> leaf o:'between', v:[a,b]", () => {
    expect(buildLeafFromText(numCol, "100..500")).toEqual({
      k: "total",
      o: "between",
      v: [100, 500],
    });
  });

  it("spasi di sekitar '..' tetap ditoleransi (trim per sisi)", () => {
    expect(buildLeafFromText(numCol, "100 .. 500")).toEqual({
      k: "total",
      o: "between",
      v: [100, 500],
    });
  });

  it("salah satu sisi bukan angka -> bukan between, fallback literal (gagal juga -> null)", () => {
    expect(buildLeafFromText(numCol, "100..abc")).toBeNull();
  });

  it("karakter '-' TIDAK diperlakukan sbg between (Requirement 26.3) -- dicoba sbg number literal, gagal -> null", () => {
    expect(buildLeafFromText(numCol, "100-500")).toBeNull();
  });

  it("'between' HANYA utk number -- kolom text tetap literal utuh (termasuk '..')", () => {
    expect(buildLeafFromText(strCol, "100..500")).toEqual({
      k: "code",
      o: "matches",
      v: "100..500",
    });
  });
});

const dateCtx = {
  isDatetime: false,
  dateLocale: undefined,
  i18nLabels: {
    months: [
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
    ],
    monthsShort: [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "Mei",
      "Jun",
      "Jul",
      "Agu",
      "Sep",
      "Okt",
      "Nov",
      "Des",
    ],
  },
};

describe("buildDateLeafFromText — sintaks simbol revisi 6 (Requirement 26, 30.6)", () => {
  const dateCol = { name: "created_at", type: "date" };

  it("token polos (tahun) -> leaf 'in_period', v.operator 'is'", () => {
    expect(buildDateLeafFromText(dateCol, "2026", dateCtx)).toEqual({
      k: "created_at",
      o: "in_period",
      v: { period: "year", year: 2026, operator: "is" },
    });
  });

  it("'!' -> negasi, leaf 'o' jadi '!in_period' (bukan v.operator)", () => {
    expect(buildDateLeafFromText(dateCol, "!2026", dateCtx)).toEqual({
      k: "created_at",
      o: "!in_period",
      v: { period: "year", year: 2026, operator: "is" },
    });
  });

  it("'>'/'>='/'<'/'<=' -> operator perbandingan DI DALAM v.operator, leaf 'o' tetap 'in_period'", () => {
    expect(buildDateLeafFromText(dateCol, ">2026", dateCtx).v.operator).toBe(
      "after",
    );
    expect(buildDateLeafFromText(dateCol, ">=2026", dateCtx).v.operator).toBe(
      "on-or-after",
    );
    expect(buildDateLeafFromText(dateCol, "<2026", dateCtx).v.operator).toBe(
      "before",
    );
    expect(buildDateLeafFromText(dateCol, "<=2026", dateCtx).v.operator).toBe(
      "on-or-before",
    );
  });

  it("'a..b' (sama period) -> 'between', rangeStart/rangeEnd terisi", () => {
    expect(buildDateLeafFromText(dateCol, "2026..2027", dateCtx)).toEqual({
      k: "created_at",
      o: "in_period",
      v: {
        period: "year",
        operator: "between",
        year: 2026,
        rangeStart: { year: 2026, value: 0 },
        rangeEnd: { year: 2027, value: 0 },
      },
    });
  });

  it("'!a..b' -> negasi + between digabung", () => {
    expect(buildDateLeafFromText(dateCol, "!2026..2027", dateCtx).o).toBe(
      "!in_period",
    );
  });

  it("'a..b' granularitas campuran -> dinormalkan ke yg lebih halus (revisi 10): ujung awal = unit pertama, ujung akhir = unit TERAKHIR", () => {
    expect(buildDateLeafFromText(dateCol, "2026..Q2 2027", dateCtx).v).toEqual({
      period: "quarter",
      operator: "between",
      year: 2026,
      rangeStart: { year: 2026, value: 0 },
      rangeEnd: { year: 2027, value: 1 },
    });
    expect(buildDateLeafFromText(dateCol, "Jan 2026..2027", dateCtx).v).toEqual(
      {
        period: "month",
        operator: "between",
        year: 2026,
        rangeStart: { year: 2026, value: 0 },
        rangeEnd: { year: 2027, value: 11 },
      },
    );
    expect(
      buildDateLeafFromText(dateCol, "10 Sep 2026..Dec 2026", dateCtx).v,
    ).toEqual({
      period: "day",
      operator: "between",
      startDate: "2026-09-10",
      endDate: "2026-12-31",
    });
  });

  it("tanggal harian -> period 'day', startDate string LOKAL (bukan Date/UTC ISO)", () => {
    expect(buildDateLeafFromText(dateCol, "2026-01-15", dateCtx)).toEqual({
      k: "created_at",
      o: "in_period",
      v: { period: "day", operator: "is", startDate: "2026-01-15" },
    });
  });

  it.each([
    ["15/01/2026", "2026-01-15"],
    ["15-01-2026", "2026-01-15"],
    ["15.01.2026", "2026-01-15"],
    ["15/01/26", "2026-01-15"],
    ["2026/01/15", "2026-01-15"],
    ["15 Januari 2026", "2026-01-15"],
    ["15 Jan 2026", "2026-01-15"],
    ["5 Agu 2026", "2026-08-05"],
    ["15 January 2026", "2026-01-15"],
  ])("format hari '%s' -> startDate '%s'", (text, expected) => {
    expect(buildDateLeafFromText(dateCol, text, dateCtx).v.startDate).toBe(
      expected,
    );
  });

  it("jam HANYA dipahami kolom datetime -> startDate 'YYYY-MM-DD HH:mm'", () => {
    const dtCol = { name: "posting_at", type: "datetime" };
    const dtCtx = { ...dateCtx, isDatetime: true };
    expect(
      buildDateLeafFromText(dtCol, "15/01/2026 14:30", dtCtx).v.startDate,
    ).toBe("2026-01-15 14:30");
    expect(
      buildDateLeafFromText(dtCol, "2026-01-15T14:30:00", dtCtx).v.startDate,
    ).toBe("2026-01-15 14:30");
    // kolom date biasa: suffix jam bukan token valid.
    expect(
      buildDateLeafFromText(dateCol, "15/01/2026 14:30", dateCtx),
    ).toBeNull();
  });

  it("'a..b' hari -> between dgn startDate/endDate string lokal", () => {
    expect(
      buildDateLeafFromText(dateCol, "01/01/2026..31/01/2026", dateCtx).v,
    ).toEqual({
      period: "day",
      operator: "between",
      startDate: "2026-01-01",
      endDate: "2026-01-31",
    });
  });

  it("perbandingan hari ('>=15/01/2026') -> v.operator + startDate string", () => {
    expect(buildDateLeafFromText(dateCol, ">=15/01/2026", dateCtx).v).toEqual({
      period: "day",
      operator: "on-or-after",
      startDate: "2026-01-15",
    });
  });

  it("teks tak dikenali -> null", () => {
    expect(buildDateLeafFromText(dateCol, "bukan tanggal", dateCtx)).toBeNull();
  });

  it("string kosong -> null", () => {
    expect(buildDateLeafFromText(dateCol, "   ", dateCtx)).toBeNull();
  });
});

describe("suggestionYears — batas atas tahun sistem + 1 (revisi 9)", () => {
  const now = new Date(2026, 8, 25);

  it.each([
    [2025, [2025, 2024, 2026, 2023, 2027]],
    [2026, [2026, 2025, 2027, 2024, 2023]],
    [2027, [2027, 2026, 2025, 2024, 2023]],
    [2024, [2024, 2023, 2025, 2022, 2026]],
    [2030, [2030, 2029, 2028, 2027, 2026]],
  ])(
    "ketik %s (sistem 2026): 5 tahun, ketikan dulu, seri -> lebih lampau",
    (typed, expected) => {
      expect(suggestionYears(typed, now)).toEqual(expected);
    },
  );
});

describe("suggestPeriodTokens — saran meniru format ketikan (revisi 9, Requirement 54)", () => {
  const now = new Date(2026, 8, 25); // sistem: 25 Sep 2026 (Q3, H2)
  const ctx = { ...dateCtx, now };
  const labels = (raw, extra = {}) =>
    suggestPeriodTokens(raw, { ...ctx, ...extra }).map((r) => r.label);

  it.each([
    ["2026", ["2026", "2025", "2027", "2024", "2023"]],
    ["2025", ["2025", "2024", "2026", "2023", "2027"]],
    ["26", ["26", "25", "27", "24", "23"]],
    ["202", ["2026", "2025", "2027", "2024", "2023"]],
    ["2", ["2026", "2025", "2027", "2024", "2023"]],
  ])("tahun: '%s' -> %j", (raw, expected) => {
    expect(labels(raw)).toEqual(expected);
  });

  it("'Jan 26' -> ketikan dulu, format 2 digit dipertahankan (Jan 25, Jan 27 ...)", () => {
    expect(labels("Jan 26")).toEqual([
      "Jan 26",
      "Jan 25",
      "Jan 27",
      "Jan 24",
      "Jan 23",
    ]);
  });

  it("nama bulan tanpa tahun -> dilengkapi tahun sistem lalu divariasikan", () => {
    expect(labels("Jan")).toEqual([
      "Jan 2026",
      "Jan 2025",
      "Jan 2027",
      "Jan 2024",
      "Jan 2023",
    ]);
    expect(labels("Januari")[0]).toBe("Januari 2026");
    expect(labels("sep")[0]).toBe("sep 2026");
  });

  it("token lengkap: variasi tahun, format (urutan, pemisah, kata) dipertahankan", () => {
    expect(labels("Q2 2025")).toEqual([
      "Q2 2025",
      "Q2 2024",
      "Q2 2026",
      "Q2 2023",
      "Q2 2027",
    ]);
    expect(labels("2026-09")).toEqual([
      "2026-09",
      "2025-09",
      "2027-09",
      "2024-09",
      "2023-09",
    ]);
    expect(labels("2026 Q2")[1]).toBe("2025 Q2");
    expect(labels("09/2026")[1]).toBe("09/2025");
  });

  it.each([
    ["Kuartal 2", "Kuartal 2 2026"],
    ["Quartal 2", "Quartal 2 2026"],
    ["Triwulan 3", "Triwulan 3 2026"],
    ["Q2", "Q2 2026"],
    ["Semester 1", "Semester 1 2026"],
    ["H1", "H1 2026"],
  ])(
    "unit + angka tanpa tahun: '%s' -> diawali '%s' + variasi tahun",
    (raw, first) => {
      const result = labels(raw);
      expect(result).toHaveLength(5);
      expect(result[0]).toBe(first);
      expect(result[1]).toBe(first.replace("2026", "2025"));
    },
  );

  it("kata kuartal/semester tanpa angka -> unit di tahun sistem, paling dekat dgn sekarang dulu", () => {
    expect(labels("Kuartal")).toEqual([
      "Kuartal 3 2026",
      "Kuartal 2 2026",
      "Kuartal 4 2026",
      "Kuartal 1 2026",
    ]);
    expect(labels("Quartal")[0]).toBe("Quartal 3 2026");
    expect(labels("Semester")).toEqual(["Semester 2 2026", "Semester 1 2026"]);
    expect(labels("q")[0]).toBe("Q3 2026");
    expect(labels("kuar")[0]).toBe("Kuartal 3 2026");
  });

  it("awalan bulan ambigu / pendek -> bulan-bulan itu di tahun sistem (terdekat dulu)", () => {
    expect(labels("Ju")).toEqual(["Juli 2026", "Juni 2026"]);
    expect(labels("Ma")).toEqual(["Mei 2026", "Maret 2026"]);
  });

  it("tanggal: hari-bulan tanpa tahun & nama bulan -> tahun sistem + variasi; format dipertahankan", () => {
    expect(labels("15/09")).toEqual([
      "15/09/2026",
      "15/09/2025",
      "15/09/2027",
      "15/09/2024",
      "15/09/2023",
    ]);
    expect(labels("15 Sep")[0]).toBe("15 Sep 2026");
    expect(labels("15/09/2026")[1]).toBe("15/09/2025");
    expect(labels("15/09/26")[1]).toBe("15/09/25");
  });

  it("datetime: suffix jam ikut dipertahankan", () => {
    const r = labels("15/09/2026 14:30", { isDatetime: true });
    expect(r[0]).toBe("15/09/2026 14:30");
    expect(r[1]).toBe("15/09/2025 14:30");
  });

  it("nilai saran = hasil parser yg sama dgn Enter (day -> string lokal, operator 'is')", () => {
    const [first, second] = suggestPeriodTokens("15/09/2026", ctx);
    expect(first.value).toEqual({
      period: "day",
      operator: "is",
      startDate: "2026-09-15",
    });
    expect(second.value.startDate).toBe("2025-09-15");
    expect(suggestPeriodTokens("Jan 26", ctx)[0].value).toEqual({
      period: "month",
      operator: "is",
      year: 2026,
      month: 0,
    });
  });

  it("maksimal 5; tanggal yg tak valid di tahun tetangga dibuang (29/02)", () => {
    expect(labels("Jan")).toHaveLength(5);
    const r = labels("29/02/2024");
    expect(r[0]).toBe("29/02/2024");
    expect(r).not.toContain("29/02/2025");
    expect(r).not.toContain("29/02/2023");
  });

  it("teks kosong / simbol tanpa isi / rentang / tak dikenali -> []", () => {
    for (const raw of ["", "  ", ">", ">=", "..", "bukan periode"]) {
      expect(labels(raw)).toEqual([]);
    }
  });

  it("rentang 'a..b' (revisi 10): saran utk ujung akhir, ujung awal apa adanya; akhir >= awal", () => {
    // lengkap: variasi tahun ujung akhir, hanya yg tidak mendahului ujung awal
    expect(labels("Q2 2026..Q4 2026")).toEqual([
      "Q2 2026..Q4 2026",
      "Q2 2026..Q4 2027",
    ]);
    // ujung akhir belum lengkap
    expect(labels("Q2 2026..Q4")[0]).toBe("Q2 2026..Q4 2026");
    // ujung akhir kosong: mulai dari ujung awal itu sendiri
    expect(labels("Jan 2026..")).toEqual([
      "Jan 2026..Jan 2026",
      "Jan 2026..Jan 2027",
    ]);
    expect(labels("15/09/2026..")[0]).toBe("15/09/2026..15/09/2026");
    const [first] = suggestPeriodTokens("2025..2026", ctx);
    expect(first.value).toEqual({
      period: "year",
      operator: "between",
      year: 2025,
      rangeStart: { year: 2025, value: 0 },
      rangeEnd: { year: 2026, value: 0 },
    });
  });

  it("rentang granularitas campuran & ujung akhir tanpa tahun (revisi 10)", () => {
    // ujung akhir = tahun -> Des tahun itu
    expect(labels("Jan 2026..2027")).toEqual([
      "Jan 2026..2027",
      "Jan 2026..2026",
    ]);
    const [mixed] = suggestPeriodTokens("Jan 2026..2027", ctx);
    expect(mixed.value).toEqual({
      period: "month",
      operator: "between",
      year: 2026,
      rangeStart: { year: 2026, value: 0 },
      rangeEnd: { year: 2027, value: 11 },
    });
    // ujung akhir tanpa tahun -> tahun ujung AWAL (bukan tahun sistem)
    expect(labels("Jan 2026..Mar")).toEqual([
      "Jan 2026..Mar 2026",
      "Jan 2026..Mar 2027",
    ]);
    expect(labels("Jan 2020..Mar")).toEqual([
      "Jan 2020..Mar 2020",
      "Jan 2020..Mar 2021",
      "Jan 2020..Mar 2022",
    ]);
    // hari .. bulan -> hari terakhir bulan itu
    const day = suggestPeriodTokens("10 Sep 2026..Dec 2026", ctx);
    expect(day.map((r) => r.label)).toEqual([
      "10 Sep 2026..Dec 2026",
      "10 Sep 2026..Dec 2027",
    ]);
    expect(day[0].value).toEqual({
      period: "day",
      operator: "between",
      startDate: "2026-09-10",
      endDate: "2026-12-31",
    });
  });

  it("rentang: ujung awal belum terparse -> []; akhir sebelum awal dibuang", () => {
    expect(labels("..2026")).toEqual([]);
    expect(labels("abc..2026")).toEqual([]);
    expect(labels("Q2 2026..2026")).toEqual(["Q2 2026..2026", "Q2 2026..2027"]); // kuartal vs tahun -> dinormalkan ke kuartal (Q2-Q4 2026)
    expect(labels("2026..2025")).not.toContain("2026..2025");
  });

  it("simbol perbandingan di depan (revisi 10): saran ikut bersimbol & operatornya dibawa", () => {
    expect(labels(">2026")).toEqual([
      ">2026",
      ">2025",
      ">2027",
      ">2024",
      ">2023",
    ]);
    expect(suggestPeriodTokens(">2026", ctx)[0].value).toEqual({
      period: "year",
      year: 2026,
      operator: "after",
    });
    expect(labels("<= Jan")[0]).toBe("<=Jan 2026");
    expect(suggestPeriodTokens("<= Jan", ctx)[0].value.operator).toBe(
      "on-or-before",
    );
    expect(suggestPeriodTokens(">=15/09", ctx)[0].value).toEqual({
      period: "day",
      operator: "on-or-after",
      startDate: "2026-09-15",
    });
  });
});

describe("parseMultiValueText — pecah teks search box di '|' (Requirement 36.2)", () => {
  it("segmen sebelum '|' terakhir = committed, sesudahnya = pending", () => {
    expect(parseMultiValueText("Draft | Selesai | sel")).toEqual({
      exclude: false,
      committed: ["Draft", "Selesai"],
      pending: "sel",
    });
  });

  it("'!' di awal = exclude & tidak ikut segmen; tanpa '|' -> semua pending", () => {
    expect(parseMultiValueText("!Draft")).toEqual({
      exclude: true,
      committed: [],
      pending: "Draft",
    });
  });

  it("separator terakhir (`a | `) -> pending kosong; segmen kosong/spasi dibuang", () => {
    expect(parseMultiValueText("a |  | b | ")).toEqual({
      exclude: false,
      committed: ["a", "b"],
      pending: "",
    });
    expect(parseMultiValueText("")).toEqual({
      exclude: false,
      committed: [],
      pending: "",
    });
  });

  it("';' juga pemisah (default), ',' HANYA bila diizinkan (separatorsFor: bukan number)", () => {
    expect(parseMultiValueText("a; b | c")).toEqual({
      exclude: false,
      committed: ["a", "b"],
      pending: "c",
    });
    // default (number): koma = desimal, bukan pemisah.
    expect(parseMultiValueText("10,5; 7")).toEqual({
      exclude: false,
      committed: ["10,5"],
      pending: "7",
    });
    expect(
      parseMultiValueText("a, b; c", { separators: separatorsFor("text") }),
    ).toEqual({ exclude: false, committed: ["a", "b"], pending: "c" });
  });

  it("separatorsFor: number & date tanpa koma, selain itu `|;,`", () => {
    expect(separatorsFor("number")).toBe("|;");
    expect(separatorsFor("date")).toBe("|;");
    expect(separatorsFor("text")).toBe("|;,");
    expect(separatorsFor("list")).toBe("|;,");
    expect(separatorsFor("relation")).toBe("|;,");
  });

  it("isLabel: seluruh ketikan = satu label yg memuat pemisah -> tidak dipecah; pemisah di ujung menyelesaikannya", () => {
    const opts = {
      separators: separatorsFor("relation"),
      isLabel: (l) => l === "PT Maju, Tbk",
    };
    expect(parseMultiValueText("PT Maju, Tbk", opts)).toEqual({
      exclude: false,
      committed: [],
      pending: "PT Maju, Tbk",
    });
    expect(parseMultiValueText("!PT Maju, Tbk;", opts)).toEqual({
      exclude: true,
      committed: ["PT Maju, Tbk"],
      pending: "",
    });
    // bukan label utuh -> dipecah biasa.
    expect(parseMultiValueText("PT Maju, X", opts).committed).toEqual([
      "PT Maju",
    ]);
  });
});

describe("buildChipsLeaf — leaf dari chip nilai text/number (Requirement 36.7)", () => {
  const textCol = { name: "code", type: "string" };
  const numCol = { name: "total", type: "number" };

  it("satu chip -> operator biasa lewat buildLeafFromText", () => {
    expect(buildChipsLeaf(textCol, ["abc"])).toEqual({
      k: "code",
      o: "matches",
      v: "abc",
    });
    expect(buildChipsLeaf(numCol, ["500"])).toEqual({
      k: "total",
      o: "=",
      v: 500,
    });
    // ekspresi tunggal (perbandingan/between) tetap didukung.
    expect(buildChipsLeaf(numCol, [">=500"])).toEqual({
      k: "total",
      o: ">=",
      v: 500,
    });
  });

  it("satu chip + exclude -> '!matches' / '!='", () => {
    expect(buildChipsLeaf(textCol, ["abc"], true).o).toBe("!matches");
    expect(buildChipsLeaf(numCol, ["5"], true).o).toBe("!=");
  });

  it(">=2 chip -> 'in' / '!in' (text: string, number: angka)", () => {
    expect(buildChipsLeaf(textCol, ["a", "b"])).toEqual({
      k: "code",
      o: "in",
      v: ["a", "b"],
    });
    expect(buildChipsLeaf(textCol, ["a", "b"], true).o).toBe("!in");
    expect(buildChipsLeaf(numCol, ["1", "2"])).toEqual({
      k: "total",
      o: "in",
      v: [1, 2],
    });
  });

  it("number >=2 chip dgn nilai bukan angka -> null; kosong -> null", () => {
    expect(buildChipsLeaf(numCol, ["1", ">2"])).toBeNull();
    expect(buildChipsLeaf(textCol, [])).toBeNull();
    expect(buildChipsLeaf(textCol, ["  "])).toBeNull();
  });
});

describe("leafToText — inverse buildLeafFromText (Requirement 25, 26)", () => {
  it("'in' -> gabung pipe (bukan koma, revisi 6)", () => {
    expect(leafToText({ o: "in", v: ["a", "b", "c"] })).toBe("a | b | c");
  });

  it("'between' -> 'a..b'", () => {
    expect(leafToText({ o: "between", v: [100, 500] })).toBe("100..500");
  });

  it("negasi & perbandingan tetap seperti sebelumnya", () => {
    expect(leafToText({ o: "!matches", v: "abc" })).toBe("!abc");
    expect(leafToText({ o: ">=", v: 500 })).toBe(">=500");
  });

  it("leaf kosong/null -> string kosong", () => {
    expect(leafToText(null)).toBe("");
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

describe("periodValueToText — widget -> teks search box (revisi 10)", () => {
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const text = (value) => periodValueToText(value, months);
  const day = (operator, extra = {}) => ({
    period: "day",
    operator,
    startDate: "2026-09-25",
    ...extra,
  });

  it("operator -> simbol di depan nilai", () => {
    expect(text(day("is"))).toBe("25 Sep 2026");
    expect(text(day("after"))).toBe(">25 Sep 2026");
    expect(text(day("on-or-after"))).toBe(">=25 Sep 2026");
    expect(text(day("before"))).toBe("<25 Sep 2026");
    expect(text(day("on-or-before"))).toBe("<=25 Sep 2026");
  });

  it("periode non-hari & jam datetime", () => {
    expect(
      text({ period: "month", operator: "is", year: 2026, month: 8 }),
    ).toBe("Sep 2026");
    expect(
      text({ period: "quarter", operator: "after", year: 2026, quarter: 2 }),
    ).toBe(">Q3 2026");
    expect(text({ period: "year", operator: "is", year: 2026 })).toBe("2026");
    expect(text(day("is", { startDate: "2026-09-25 19:35" }))).toBe(
      "25 Sep 2026 19:35",
    );
  });

  it("between: a..b; ujung awal saja -> 'a..'; kosong -> '..'", () => {
    expect(
      text(day("between", { startDate: "2026-09-10", endDate: "2026-09-20" })),
    ).toBe("10 Sep 2026..20 Sep 2026");
    expect(text(day("between", { startDate: "2026-09-10" }))).toBe(
      "10 Sep 2026..",
    );
    expect(text({ period: "day", operator: "between" })).toBe("..");
    expect(
      text({
        period: "month",
        operator: "between",
        rangeStart: { year: 2026, value: 0 },
        rangeEnd: { year: 2026, value: 5 },
      }),
    ).toBe("Jan 2026..Jun 2026");
  });

  it("tanpa pilihan: hanya simbol operator ('' utk is)", () => {
    expect(text({ period: "day", operator: "after" })).toBe(">");
    expect(text({ period: "day", operator: "on-or-before" })).toBe("<=");
    expect(text({ period: "day", operator: "is" })).toBe("");
    expect(text({ period: "month", operator: "is", year: 2026 })).toBe("");
    expect(text(null)).toBe("");
  });
});

describe("parseDateText — teks search box -> operator + nilai utk widget (revisi 10)", () => {
  it("tanpa simbol: is; dgn simbol: operator sesuai; `!` = negate", () => {
    expect(parseDateText("2026", dateCtx)).toEqual({
      negate: false,
      operator: "is",
      value: { period: "year", year: 2026, operator: "is" },
    });
    expect(parseDateText("!>= Q2 2026", dateCtx)).toEqual({
      negate: true,
      operator: "on-or-after",
      value: {
        period: "quarter",
        year: 2026,
        quarter: 1,
        operator: "on-or-after",
      },
    });
    for (const [text, operator] of [
      [">2026", "after"],
      ["<2026", "before"],
      ["<=2026", "on-or-before"],
    ]) {
      expect(parseDateText(text, dateCtx).operator).toBe(operator);
    }
  });

  it("hari -> startDate string LOKAL", () => {
    expect(parseDateText("<15/09/2026", dateCtx).value).toEqual({
      period: "day",
      operator: "before",
      startDate: "2026-09-15",
    });
  });

  it("simbol berdiri sendiri -> operator tanpa nilai; teks tak terparse -> is tanpa nilai", () => {
    expect(parseDateText(">", dateCtx)).toEqual({
      negate: false,
      operator: "after",
      value: null,
    });
    expect(parseDateText(">=", dateCtx).operator).toBe("on-or-after");
    expect(parseDateText("abc", dateCtx)).toEqual({
      negate: false,
      operator: "is",
      value: null,
    });
    expect(parseDateText("", dateCtx).value).toBeNull();
    expect(parseDateText("!", dateCtx)).toEqual({
      negate: true,
      operator: "is",
      value: null,
    });
  });

  it("rentang: lengkap, separuh (ujung awal saja), kosong", () => {
    expect(parseDateText("2025..2026", dateCtx)).toEqual({
      negate: false,
      operator: "between",
      value: {
        period: "year",
        operator: "between",
        year: 2025,
        rangeStart: { year: 2025, value: 0 },
        rangeEnd: { year: 2026, value: 0 },
      },
    });
    expect(parseDateText("10/09/2026..", dateCtx).value).toEqual({
      period: "day",
      operator: "between",
      startDate: "2026-09-10",
    });
    expect(parseDateText("Jan 2026..", dateCtx).value).toEqual({
      period: "month",
      operator: "between",
      year: 2026,
      rangeStart: { year: 2026, value: 0 },
    });
    expect(parseDateText("..", dateCtx)).toEqual({
      negate: false,
      operator: "between",
      value: null,
    });
  });

  it("round-trip: parseDateText(periodValueToText(v)) mengembalikan nilai yg sama", () => {
    const months = dateCtx.i18nLabels.monthsShort;
    for (const value of [
      { period: "day", operator: "on-or-after", startDate: "2026-09-25" },
      { period: "month", operator: "before", year: 2026, month: 8 },
      { period: "half-year", operator: "is", year: 2026, halfYear: 1 },
      {
        period: "day",
        operator: "between",
        startDate: "2026-09-10",
        endDate: "2026-09-20",
      },
    ]) {
      const parsed = parseDateText(periodValueToText(value, months), dateCtx);
      expect(parsed.operator).toBe(value.operator);
      expect(parsed.value).toMatchObject(value);
    }
  });
});

describe("chip nilai date/datetime (revisi 11, Requirement 60)", () => {
  const dateCol = { name: "created_at", type: "date" };
  const sep = { period: "month", operator: "is", year: 2026, month: 8 };
  const oct = { period: "month", operator: "is", year: 2026, month: 9 };
  const y2027 = { period: "year", operator: "is", year: 2027 };
  const gte = { period: "year", operator: "on-or-after", year: 2027 };

  describe("dateSignature", () => {
    it("urutan kunci tak berpengaruh; selections ikut dihitung", () => {
      expect(
        dateSignature({ year: 2026, period: "year", operator: "is" }),
      ).toBe(dateSignature({ operator: "is", period: "year", year: 2026 }));
      expect(dateSignature({ ...sep, selections: [] })).not.toBe(
        dateSignature({ ...sep, selections: [oct] }),
      );
      // nilai widget bersertifikat selections tak sama dgn item polos
      expect(dateSignature({ ...sep, selections: [] })).not.toBe(
        dateSignature(sep),
      );
    });
  });

  describe("mergeDatePeriods", () => {
    it("menambah, membuang duplikat, mempertahankan urutan", () => {
      expect(mergeDatePeriods([sep], [oct, sep])).toEqual({
        chips: [sep, oct],
      });
    });

    it("banyak nilai hanya utk 'Pada': non-Pada + apa pun lagi -> error", () => {
      expect(mergeDatePeriods([sep], [gte])).toEqual({
        error: "multi_only_is",
      });
      expect(mergeDatePeriods([gte], [sep])).toEqual({
        error: "multi_only_is",
      });
    });

    it("satu nilai non-Pada sah; menggantikan nilai non-Pada tunggal sah", () => {
      expect(mergeDatePeriods([], [gte])).toEqual({ chips: [gte] });
      const lt = { ...gte, operator: "before" };
      expect(
        mergeDatePeriods([gte], [lt], { replaceKey: dateSignature(gte) }),
      ).toEqual({ chips: [lt] });
    });

    it("batas: tepat max lolos, max+1 -> error limit", () => {
      const many = (n) =>
        Array.from({ length: n }, (_, i) => ({
          period: "year",
          operator: "is",
          year: 2000 + i,
        }));
      expect(mergeDatePeriods([], many(20)).chips).toHaveLength(20);
      expect(mergeDatePeriods(many(20), [y2027])).toEqual({ error: "limit" });
      expect(mergeDatePeriods([], many(3), { max: 2 })).toEqual({
        error: "limit",
      });
    });

    it("replaceKey: pengganti masuk di posisi yg sama; kosong + dropReplaced = hapus; kosong saja = utuh", () => {
      const key = dateSignature(oct);
      expect(
        mergeDatePeriods([sep, oct, y2027], [gte], { replaceKey: key }),
      ).toEqual({ error: "multi_only_is" });
      const nov = { period: "month", operator: "is", year: 2026, month: 10 };
      expect(
        mergeDatePeriods([sep, oct, y2027], [nov], { replaceKey: key }).chips,
      ).toEqual([sep, nov, y2027]);
      expect(
        mergeDatePeriods([sep, oct], [], {
          replaceKey: key,
          dropReplaced: true,
        }).chips,
      ).toEqual([sep]);
      expect(
        mergeDatePeriods([sep, oct], [], { replaceKey: key }).chips,
      ).toEqual([sep, oct]);
    });

    it("tak memutasi daftar asal", () => {
      const prev = [sep];
      mergeDatePeriods(prev, [oct]);
      expect(prev).toEqual([sep]);
    });
  });

  describe("buildDateChipsLeaf", () => {
    it("satu nilai -> in_period / !in_period (operator perbandingan tetap di dalam nilai)", () => {
      expect(buildDateChipsLeaf(dateCol, [sep])).toEqual({
        k: "created_at",
        o: "in_period",
        v: sep,
      });
      expect(buildDateChipsLeaf(dateCol, [gte], true)).toEqual({
        k: "created_at",
        o: "!in_period",
        v: gte,
      });
    });

    it(">= 2 nilai 'Pada' -> TETAP in_period / !in_period, `v` = daftar periode (revisi 16)", () => {
      expect(buildDateChipsLeaf(dateCol, [sep, oct])).toEqual({
        k: "created_at",
        o: "in_period",
        v: [sep, oct],
      });
      expect(buildDateChipsLeaf(dateCol, [sep, y2027], true).o).toBe(
        "!in_period",
      );
      expect(buildDateChipsLeaf(dateCol, [sep, oct]).v).toBeInstanceOf(Array);
    });

    it("kosong / >= 2 nilai dgn non-Pada -> null", () => {
      expect(buildDateChipsLeaf(dateCol, [])).toBeNull();
      expect(buildDateChipsLeaf(dateCol, [sep, gte])).toBeNull();
    });

    it("kunci undefined/null & selections dibuang dari nilai leaf", () => {
      const leaf = buildDateChipsLeaf(dateCol, [
        { ...sep, startDate: undefined, endDate: null, selections: [] },
      ]);
      expect(Object.keys(leaf.v).sort()).toEqual(
        ["month", "operator", "period", "year"].sort(),
      );
    });
  });

  describe("leafDatePeriods", () => {
    it("in_period/!in_period: `v` objek -> satu nilai, `v` daftar -> daftar; lainnya []", () => {
      expect(leafDatePeriods({ o: "in_period", v: sep })).toEqual([sep]);
      expect(leafDatePeriods({ o: "!in_period", v: sep })).toEqual([sep]);
      expect(leafDatePeriods({ o: "in_period", v: [sep, oct] })).toEqual([
        sep,
        oct,
      ]);
      expect(leafDatePeriods({ o: "!in_period", v: [sep] })).toEqual([sep]);
      // elemen bukan objek periode dibuang
      expect(leafDatePeriods({ o: "in_period", v: ["a", "b"] })).toEqual([]);
      // `in`/`!in` bukan operator date lagi (leaf lama tak dibaca) & operator lain
      expect(leafDatePeriods({ o: "in", v: [sep, oct] })).toEqual([]);
      expect(leafDatePeriods({ o: "!in", v: [sep] })).toEqual([]);
      expect(leafDatePeriods({ o: "set" })).toEqual([]);
      expect(leafDatePeriods(null)).toEqual([]);
    });
  });

  describe("parseDatePeriod", () => {
    it("token lengkap -> nilai periode; tak terparse / simbol saja -> null", () => {
      expect(parseDatePeriod("Sep 2026", dateCtx)).toMatchObject({
        period: "month",
        operator: "is",
        year: 2026,
        month: 8,
      });
      expect(parseDatePeriod("bukan tanggal", dateCtx)).toBeNull();
      expect(parseDatePeriod(">", dateCtx)).toBeNull();
      expect(parseDatePeriod("", dateCtx)).toBeNull();
    });

    it("rentang separuh dilengkapi (end = start)", () => {
      expect(parseDatePeriod("10/09/2026..", dateCtx)).toEqual({
        period: "day",
        operator: "between",
        startDate: "2026-09-10",
        endDate: "2026-09-10",
      });
    });
  });

  describe("buildDateWidgetValue (pratinjau chip + ketikan)", () => {
    const typed = (text) => parseDateText(text, dateCtx);

    it("chip Pada -> selections; Periode = ketikan Pada > prevPeriod > chip terakhir > day", () => {
      expect(buildDateWidgetValue({ chips: [sep, oct] })).toEqual({
        period: "month",
        operator: "is",
        selections: [sep, oct],
      });
      // Periode yg dipilih user dipertahankan (walau tak ada chip ber-Periode itu)
      expect(
        buildDateWidgetValue({ chips: [sep, y2027], prevPeriod: "day" }).period,
      ).toBe("day");
      expect(
        buildDateWidgetValue({ chips: [], prevPeriod: "year" }).period,
      ).toBe("year");
      // tanpa prevPeriod -> Periode chip terakhir; tanpa chip -> day
      expect(buildDateWidgetValue({ chips: [sep, y2027] }).period).toBe("year");
      expect(buildDateWidgetValue({ chips: [] }).period).toBe("day");
      expect(
        buildDateWidgetValue({
          chips: [sep],
          typed: typed("2027"),
          prevPeriod: "day",
        }),
      ).toMatchObject({ period: "year", selections: [sep, y2027] });
    });

    it("ketikan Pada ditambahkan sbg pratinjau (dedup dgn chip)", () => {
      expect(
        buildDateWidgetValue({ chips: [sep], typed: typed("Sep 2026") })
          .selections,
      ).toEqual([sep]);
      expect(
        buildDateWidgetValue({ chips: [sep], typed: typed("Okt 2026") })
          .selections,
      ).toHaveLength(2);
    });

    it("simbol saja tanpa chip -> Kondisi widget mengikuti, tanpa nilai", () => {
      expect(
        buildDateWidgetValue({
          chips: [],
          typed: typed(">"),
          prevPeriod: "month",
        }),
      ).toEqual({ period: "month", operator: "after", selections: [] });
      expect(buildDateWidgetValue({ chips: [], typed: typed("..") })).toEqual({
        period: "day",
        operator: "between",
        selections: [],
      });
    });

    it("satu non-Pada (chip atau ketikan) -> nilai tunggal widget; rentang separuh dipertahankan mentah", () => {
      expect(buildDateWidgetValue({ chips: [gte] })).toEqual({
        ...gte,
        selections: [],
      });
      const half = buildDateWidgetValue({
        chips: [],
        typed: typed("10/09/2026.."),
      });
      expect(half).toEqual({
        period: "day",
        operator: "between",
        startDate: "2026-09-10",
        selections: [],
      });
    });

    it("ketikan bersimbol saat ada chip Pada TIDAK dipratinjau (chip tetap)", () => {
      expect(
        buildDateWidgetValue({ chips: [sep], typed: typed(">=2027") }),
      ).toEqual({ period: "month", operator: "is", selections: [sep] });
      expect(buildDateWidgetValue({ chips: [sep], typed: typed(">") })).toEqual(
        { period: "month", operator: "is", selections: [sep] },
      );
    });

    it("editingKey: ketikan menggantikan chip yg diedit, bukan menambah", () => {
      const v = buildDateWidgetValue({
        chips: [sep, oct],
        typed: typed("Nov 2026"),
        editingKey: dateSignature(oct),
      });
      expect(v.selections.map((s) => s.month)).toEqual([8, 10]);
    });

    it("ketikan melampaui aturan daftar/batas -> pratinjau = chip saja", () => {
      const many = Array.from({ length: 20 }, (_, i) => ({
        period: "year",
        operator: "is",
        year: 2000 + i,
      }));
      expect(
        buildDateWidgetValue({ chips: many, typed: typed("Sep 2026") })
          .selections,
      ).toHaveLength(20);
    });
  });
});

describe("aturan daftar chip nilai number/date (revisi 12)", () => {
  describe("hasValueSymbol", () => {
    it("number & date: perbandingan di awal / rentang `..`; desimal & tanggal polos bukan simbol", () => {
      for (const mode of ["number", "date"]) {
        for (const text of [">5", ">=5", "<5", "<=5", " > 5", "1..5"]) {
          expect(hasValueSymbol(mode, text)).toBe(true);
        }
      }
      expect(hasValueSymbol("number", "1.5")).toBe(false);
      expect(hasValueSymbol("number", "500")).toBe(false);
      expect(hasValueSymbol("date", "15.09.2026")).toBe(false);
      expect(hasValueSymbol("date", "Sep 2026")).toBe(false);
    });

    it("mode lain (text/list/relation) tak punya simbol", () => {
      expect(hasValueSymbol("text", ">abc")).toBe(false);
      expect(hasValueSymbol("list", "a..b")).toBe(false);
    });
  });

  describe("chipEntryViolation", () => {
    it("tanpa chip lain: satu nilai bersimbol sah; >1 segmen dgn simbol ditolak", () => {
      expect(chipEntryViolation("number", [], [">5"])).toBeNull();
      expect(chipEntryViolation("number", [], ["1", "2"])).toBeNull();
      expect(chipEntryViolation("number", [], ["1", ">5"])).toBe(
        "symbol_with_chips",
      );
      expect(chipEntryViolation("number", [], [">1", ">5"])).toBe(
        "symbol_with_chips",
      );
    });

    it("ada chip polos: simbol ditolak, nilai polos boleh (kecuali negasi -- negasi bukan bagian teks)", () => {
      expect(chipEntryViolation("number", ["1"], [">5"])).toBe(
        "symbol_with_chips",
      );
      expect(chipEntryViolation("number", ["1"], ["1..5"])).toBe(
        "symbol_with_chips",
      );
      expect(chipEntryViolation("number", ["1", "2"], ["3"])).toBeNull();
    });

    it("ada chip bersimbol: tak ada nilai berikutnya (apa pun bentuknya)", () => {
      expect(chipEntryViolation("number", [">5"], ["3"])).toBe("single_only");
      expect(chipEntryViolation("number", ["1..5"], [">7"])).toBe(
        "single_only",
      );
    });

    it("kotak/segmen kosong tak pernah melanggar", () => {
      expect(chipEntryViolation("number", [">5"], [""])).toBeNull();
      expect(chipEntryViolation("number", ["1"], ["  ", ""])).toBeNull();
      expect(chipEntryViolation("number", [">5"], [])).toBeNull();
    });

    it("date: chip = objek periode; bersimbol bila operator != is", () => {
      const plain = { period: "year", operator: "is", year: 2026 };
      const gte = { period: "year", operator: "on-or-after", year: 2027 };
      expect(chipEntryViolation("date", [plain], [">2027"])).toBe(
        "symbol_with_chips",
      );
      expect(chipEntryViolation("date", [plain], ["2027"])).toBeNull();
      expect(chipEntryViolation("date", [gte], ["2028"])).toBe("single_only");
      expect(chipEntryViolation("date", [], ["2026..2027"])).toBeNull();
    });

    it("text/list/relation tak dibatasi", () => {
      expect(chipEntryViolation("text", ["a"], [">b"])).toBeNull();
      expect(chipEntryViolation("list", [1], ["x"])).toBeNull();
    });
  });

  describe("buildListLeaf", () => {
    const status = { name: "status", type: "string" };
    const statuses = { name: "status", type: "formStatuses" };

    it("satu nilai -> =/!=; >= 2 -> in/!in", () => {
      expect(buildListLeaf(status, ["a"])).toEqual({
        k: "status",
        o: "=",
        v: "a",
      });
      expect(buildListLeaf(status, ["a"], true).o).toBe("!=");
      expect(buildListLeaf(status, ["a", "b"])).toEqual({
        k: "status",
        o: "in",
        v: ["a", "b"],
      });
      expect(buildListLeaf(status, ["a", "b"], true).o).toBe("!in");
    });

    it("formStatuses (array status): SELALU in/!in, walau satu nilai (backend tak menerima =)", () => {
      expect(buildListLeaf(statuses, ["draft"])).toEqual({
        k: "status",
        o: "in",
        v: ["draft"],
      });
      expect(buildListLeaf(statuses, ["draft"], true).o).toBe("!in");
    });

    it("kosong -> null", () => {
      expect(buildListLeaf(status, [])).toBeNull();
      expect(buildListLeaf(status, undefined)).toBeNull();
    });
  });
});
