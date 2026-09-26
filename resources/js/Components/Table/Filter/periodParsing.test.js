import { describe, expect, it } from "vitest";
import { id as idLocale } from "date-fns/locale";
import {
  OPERATOR_SYMBOLS,
  buildBetweenPeriodValue,
  buildFlexibleBetween,
  buildPeriodI18nLabels,
  buildReuiDateI18n,
  completeRange,
  defaultYearBounds,
  hasPeriodSelection,
  isCompletePeriodValue,
  matchMonthName,
  monthsStartingWith,
  parseLocalDate,
  parsePeriodToken,
  relevantYears,
  toLocalDateValue,
  toLocalDayString,
} from "./periodParsing";

const t = (key) => key;
const i18nLabels = buildPeriodI18nLabels({ t, dateLocale: idLocale });
const ctx = { isDatetime: false, dateLocale: idLocale, i18nLabels };
const ctxDatetime = { ...ctx, isDatetime: true };

describe("parsePeriodToken — regression guard extract dari DateSelector.jsx (Requirement 30.4)", () => {
  it("tahun 4-digit", () => {
    expect(parsePeriodToken("2026", ctx)).toEqual({
      period: "year",
      year: 2026,
    });
  });

  it("tahun 2-digit -> SELALU +2000 (tanpa pivot 19xx)", () => {
    expect(parsePeriodToken("26", ctx)).toEqual({ period: "year", year: 2026 });
    expect(parsePeriodToken("99", ctx)).toEqual({ period: "year", year: 2099 });
  });

  it("kuartal 'Q2 2025' & 'Q2 25' (case-insensitive)", () => {
    expect(parsePeriodToken("Q2 2025", ctx)).toEqual({
      period: "quarter",
      year: 2025,
      quarter: 1,
    });
    expect(parsePeriodToken("q2 25", ctx)).toEqual({
      period: "quarter",
      year: 2025,
      quarter: 1,
    });
  });

  it("half-year 'H1 2026' & 'H1 26'", () => {
    expect(parsePeriodToken("H1 2026", ctx)).toEqual({
      period: "half-year",
      year: 2026,
      halfYear: 0,
    });
    expect(parsePeriodToken("h2 26", ctx)).toEqual({
      period: "half-year",
      year: 2026,
      halfYear: 1,
    });
  });

  it("bulan-tahun NAMA penuh/singkat (i18n id)", () => {
    expect(parsePeriodToken("Januari 2025", ctx)).toEqual({
      period: "month",
      year: 2025,
      month: 0,
    });
    expect(parsePeriodToken("Jan 2025", ctx)).toEqual({
      period: "month",
      year: 2025,
      month: 0,
    });
  });

  it("BARU (Requirement 30.3): bulan-tahun ANGKA slash 'MM/yyyy'", () => {
    expect(parsePeriodToken("09/2026", ctx)).toEqual({
      period: "month",
      year: 2026,
      month: 8,
    });
    expect(parsePeriodToken("09/26", ctx)).toEqual({
      period: "month",
      year: 2026,
      month: 8,
    });
  });

  it("BARU (Requirement 30.3): bulan-tahun ANGKA dash 'yyyy-MM'", () => {
    expect(parsePeriodToken("2026-09", ctx)).toEqual({
      period: "month",
      year: 2026,
      month: 8,
    });
  });

  it("bulan-tahun angka di luar 1-12 -> bukan month, jatuh ke pola lain / null", () => {
    expect(parsePeriodToken("13/2026", ctx)).toBeNull();
  });

  it("tanggal harian: 'dd MMMM yyyy', 'yyyy-MM-dd', 'dd/MM/yyyy', 'dd-MM-yyyy'", () => {
    const cases = ["15 Januari 2026", "2026-01-15", "15/01/2026", "15-01-2026"];
    for (const raw of cases) {
      const token = parsePeriodToken(raw, ctx);
      expect(token?.period).toBe("day");
      expect(token?.startDate).toBeInstanceOf(Date);
      expect(token.startDate.getFullYear()).toBe(2026);
      expect(token.startDate.getMonth()).toBe(0);
      expect(token.startDate.getDate()).toBe(15);
    }
  });

  it("isDatetime: format tambahan dgn jam ('dd MMMM yyyy HH:mm', 'yyyy-MM-dd HH:mm')", () => {
    const withTime = parsePeriodToken("15 Januari 2026 14:30", ctxDatetime);
    expect(withTime.period).toBe("day");
    expect(withTime.startDate.getHours()).toBe(14);
    expect(withTime.startDate.getMinutes()).toBe(30);

    const isoWithTime = parsePeriodToken("2026-01-15 14:30", ctxDatetime);
    expect(isoWithTime.startDate.getHours()).toBe(14);
  });

  it("teks kosong / tak dikenali -> null", () => {
    expect(parsePeriodToken("", ctx)).toBeNull();
    expect(parsePeriodToken("   ", ctx)).toBeNull();
    expect(parsePeriodToken("bukan periode apa pun", ctx)).toBeNull();
  });
});

describe("parsePeriodToken — feedback revisi 6: format yang sebelumnya gagal (Requirement 30.3)", () => {
  const ymd = (token) =>
    `${token.startDate.getFullYear()}-${token.startDate.getMonth() + 1}-${token.startDate.getDate()}`;

  it("hari tahun 2-digit ('15/09/26') -> 2026, BUKAN tahun 26", () => {
    expect(ymd(parsePeriodToken("15/09/26", ctx))).toBe("2026-9-15");
  });

  it.each([
    ["15.09.2026", "2026-9-15"],
    ["15 09 2026", "2026-9-15"],
    ["5/9/2026", "2026-9-5"],
    ["2026/09/15", "2026-9-15"],
    ["2026.09.15", "2026-9-15"],
    ["2026-9-5", "2026-9-5"],
    ["15 Sep 2026", "2026-9-15"],
    ["5 sept 2026", "2026-9-5"],
    ["15 Agu 2026", "2026-8-15"],
    ["15 August 2026", "2026-8-15"],
    ["15-Sep-26", "2026-9-15"],
  ])("hari '%s' -> %s", (raw, expected) => {
    expect(ymd(parsePeriodToken(raw, ctx))).toBe(expected);
  });

  it("hari-bulan tak valid ('02/13/2026') jatuh ke bulan-hari ala AS", () => {
    expect(ymd(parsePeriodToken("02/13/2026", ctx))).toBe("2026-2-13");
  });

  it("tanggal mustahil ('31/02/2026') -> null", () => {
    expect(parsePeriodToken("31/02/2026", ctx)).toBeNull();
  });

  it.each([
    ["2026 Q2", { period: "quarter", year: 2026, quarter: 1 }],
    ["Q2-2026", { period: "quarter", year: 2026, quarter: 1 }],
    ["2026 H1", { period: "half-year", year: 2026, halfYear: 0 }],
    ["2026H2", { period: "half-year", year: 2026, halfYear: 1 }],
  ])(
    "kuartal/half urutan tahun-dulu & separator lain '%s'",
    (raw, expected) => {
      expect(parsePeriodToken(raw, ctx)).toEqual(expected);
    },
  );

  it("H3 (half-year tak ada) -> null", () => {
    expect(parsePeriodToken("H3 2026", ctx)).toBeNull();
  });

  it.each([
    ["9/2026", { period: "month", year: 2026, month: 8 }],
    ["09-2026", { period: "month", year: 2026, month: 8 }],
    ["09.2026", { period: "month", year: 2026, month: 8 }],
    ["2026/09", { period: "month", year: 2026, month: 8 }],
    ["2026-9", { period: "month", year: 2026, month: 8 }],
    ["Agu 2026", { period: "month", year: 2026, month: 7 }],
    ["sept 2026", { period: "month", year: 2026, month: 8 }],
    ["August 2026", { period: "month", year: 2026, month: 7 }],
    ["Sep 26", { period: "month", year: 2026, month: 8 }],
    ["2026 September", { period: "month", year: 2026, month: 8 }],
  ])("bulan-tahun '%s'", (raw, expected) => {
    expect(parsePeriodToken(raw, ctx)).toEqual(expected);
  });

  it("nama bulan ambigu / tak dikenal -> null", () => {
    expect(parsePeriodToken("Ju 2026", ctx)).toBeNull();
    expect(parsePeriodToken("Foo 2026", ctx)).toBeNull();
  });

  it.each([
    "15/09/2026 14:30",
    "15-09-2026 14:30",
    "2026-09-15 14:30",
    "2026-09-15T14:30",
    "2026-09-15 14:30:00",
    "15 September 2026 14:30",
  ])("datetime: '%s' -> hari + jam 14:30", (raw) => {
    const token = parsePeriodToken(raw, ctxDatetime);
    expect(ymd(token)).toBe("2026-9-15");
    expect(token.startDate.getHours()).toBe(14);
    expect(token.startDate.getMinutes()).toBe(30);
  });

  it("date (bukan datetime): suffix jam ditolak; datetime: jam mustahil ditolak", () => {
    expect(parsePeriodToken("15/09/2026 14:30", ctx)).toBeNull();
    expect(parsePeriodToken("15/09/2026 25:00", ctxDatetime)).toBeNull();
    expect(parsePeriodToken("15/09/2026 14:61", ctxDatetime)).toBeNull();
  });

  it("jam pada token non-hari (bulan/tahun) ditolak", () => {
    expect(parsePeriodToken("09/2026 14:30", ctxDatetime)).toBeNull();
  });

  it("spasi ganda / spasi tepi dilipat", () => {
    expect(ymd(parsePeriodToken("  15   Sep   2026 ", ctx))).toBe("2026-9-15");
  });
});

describe("matchMonthName & toLocalDayString", () => {
  it("nama penuh/singkat/awalan, locale aktif + Inggris", () => {
    expect(matchMonthName("Agustus", i18nLabels)).toBe(7);
    expect(matchMonthName("agu", i18nLabels)).toBe(7);
    expect(matchMonthName("Aug.", i18nLabels)).toBe(7);
    expect(matchMonthName("sept", i18nLabels)).toBe(8);
    expect(matchMonthName("Dec", i18nLabels)).toBe(11);
  });

  it("awalan <3 huruf / ambigu / kosong -> -1", () => {
    expect(matchMonthName("ma", i18nLabels)).toBe(-1);
    expect(matchMonthName("ju", i18nLabels)).toBe(-1);
    expect(matchMonthName("", i18nLabels)).toBe(-1);
    expect(matchMonthName("xyz", i18nLabels)).toBe(-1);
  });

  it("toLocalDayString: tengah malam LOKAL tetap hari itu (bukan UTC geser)", () => {
    expect(toLocalDayString(new Date(2026, 8, 1))).toBe("2026-09-01");
    expect(toLocalDayString(new Date(2026, 0, 5, 14, 30))).toBe(
      "2026-01-05 14:30",
    );
  });
});

describe("relevantYears — Requirement 30.5", () => {
  it("3 tahun (lalu, ini, depan) relatif ke `now`", () => {
    expect(relevantYears(new Date(2026, 5, 1))).toEqual([2025, 2026, 2027]);
  });

  it("default param `now` = tanggal SEKARANG (tak perlu argumen eksplisit)", () => {
    const [prev, current, next] = relevantYears();
    expect(current).toBe(new Date().getFullYear());
    expect(next - current).toBe(1);
    expect(current - prev).toBe(1);
  });
});

describe("buildBetweenPeriodValue — gabung 2 token jadi 'between'", () => {
  it("period 'day' -> startDate/endDate (TAK cek period sisi 'b')", () => {
    const a = { period: "day", startDate: new Date(2026, 0, 1) };
    const b = { period: "day", startDate: new Date(2026, 0, 31) };
    expect(buildBetweenPeriodValue(a, b)).toEqual({
      period: "day",
      operator: "between",
      startDate: a.startDate,
      endDate: b.startDate,
    });
  });

  it("period non-day SAMA -> rangeStart/rangeEnd", () => {
    const a = { period: "quarter", year: 2026, quarter: 0 };
    const b = { period: "quarter", year: 2026, quarter: 2 };
    expect(buildBetweenPeriodValue(a, b)).toEqual({
      period: "quarter",
      operator: "between",
      year: 2026,
      rangeStart: { year: 2026, value: 0 },
      rangeEnd: { year: 2026, value: 2 },
    });
  });

  it("period non-day BEDA -> null", () => {
    const a = { period: "quarter", year: 2026, quarter: 0 };
    const b = { period: "month", year: 2026, month: 5 };
    expect(buildBetweenPeriodValue(a, b)).toBeNull();
  });

  it("salah satu token null -> null", () => {
    expect(
      buildBetweenPeriodValue(null, { period: "year", year: 2026 }),
    ).toBeNull();
    expect(
      buildBetweenPeriodValue({ period: "year", year: 2026 }, null),
    ).toBeNull();
  });
});

describe("OPERATOR_SYMBOLS — urutan panjang dulu (>= sebelum >)", () => {
  it("urutan simbol tak berubah (kontrak dipakai parseSummary/buildDateLeafFromText)", () => {
    expect(OPERATOR_SYMBOLS.map((s) => s.sym)).toEqual([
      ">=",
      "<=",
      ">",
      "<",
      "=",
    ]);
  });
});

describe("buildPeriodI18nLabels & buildReuiDateI18n — glue i18n dipakai bersama widget/SearchBar", () => {
  it("buildPeriodI18nLabels: 12 bulan penuh & singkat, 4 kuartal, 2 half-year", () => {
    expect(i18nLabels.months).toHaveLength(12);
    expect(i18nLabels.monthsShort).toHaveLength(12);
    expect(i18nLabels.quarters).toEqual(["Q1", "Q2", "Q3", "Q4"]);
    expect(i18nLabels.halfYears).toEqual(["H1", "H2"]);
    expect(i18nLabels.operators.is).toBe(
      "core.datatable.filter.dateselector.subop.is",
    );
  });

  it("buildReuiDateI18n: reuse `i18nLabels` (bukan re-translate), shape sesuai kontrak reui", () => {
    const reui = buildReuiDateI18n({ t, i18nLabels });
    expect(reui.filterTypes).toBe(i18nLabels.operators);
    expect(reui.months).toBe(i18nLabels.months);
    expect(reui.monthsShort).toBe(i18nLabels.monthsShort);
    expect(reui.quarters).toBe(i18nLabels.quarters);
    expect(reui.halfYears).toBe(i18nLabels.halfYears);
    expect(reui.labels).toEqual({
      operator: "core.datatable.filter.dateselector.label.operator",
      period: "core.datatable.filter.dateselector.label.period",
    });
  });
});

describe("parsePeriodToken — audit revisi 8: kata kuartal/semester & nama-bulan-dulu", () => {
  it.each([
    ["Kuartal 2 2026", { period: "quarter", year: 2026, quarter: 1 }],
    ["Triwulan 3 26", { period: "quarter", year: 2026, quarter: 2 }],
    ["TW4 2026", { period: "quarter", year: 2026, quarter: 3 }],
    ["Quarter 1 2026", { period: "quarter", year: 2026, quarter: 0 }],
    ["Semester 1 2026", { period: "half-year", year: 2026, halfYear: 0 }],
    ["S2 2026", { period: "half-year", year: 2026, halfYear: 1 }],
    ["2026 Semester 2", { period: "half-year", year: 2026, halfYear: 1 }],
    ["Half 2 2026", { period: "half-year", year: 2026, halfYear: 1 }],
  ])("'%s' -> periode", (text, expected) => {
    expect(parsePeriodToken(text, ctx)).toEqual(expected);
  });

  it("indeks di luar batas ditolak (semester 3, kuartal 5)", () => {
    expect(parsePeriodToken("Semester 3 2026", ctx)).toBeNull();
    expect(parsePeriodToken("Kuartal 5 2026", ctx)).toBeNull();
  });

  it("bentuk lama tak berubah (Q2 2026, H1 2026, 2026 Q2)", () => {
    expect(parsePeriodToken("Q2 2026", ctx)).toEqual({
      period: "quarter",
      year: 2026,
      quarter: 1,
    });
    expect(parsePeriodToken("H1 2026", ctx)).toEqual({
      period: "half-year",
      year: 2026,
      halfYear: 0,
    });
    expect(parsePeriodToken("2026 Q2", ctx)).toEqual({
      period: "quarter",
      year: 2026,
      quarter: 1,
    });
  });

  it.each(["Sep 15 2026", "September 15, 2026", "sept-15-2026"])(
    "nama bulan DULU ala AS '%s' -> hari 15 Sep 2026 (lokal)",
    (text) => {
      const token = parsePeriodToken(text, ctx);
      expect(token.period).toBe("day");
      const d = token.startDate;
      expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([
        2026, 8, 15,
      ]);
    },
  );

  it("nama-bulan-dulu + jam hanya utk datetime", () => {
    expect(parsePeriodToken("Sep 15 2026 14:30", ctx)).toBeNull();
    const d = parsePeriodToken("Sep 15 2026 14:30", ctxDatetime).startDate;
    expect([d.getDate(), d.getHours(), d.getMinutes()]).toEqual([15, 14, 30]);
  });

  it("nama-bulan-dulu: tanggal tak valid / tahun 2 digit ditolak; 'Sep 2026' tetap bulan-tahun", () => {
    expect(parsePeriodToken("Sep 31 2026", ctx)).toBeNull();
    expect(parsePeriodToken("Sep 15 26", ctx)).toBeNull();
    expect(parsePeriodToken("Sep 2026", ctx)).toEqual({
      period: "month",
      year: 2026,
      month: 8,
    });
  });
});

describe("parseLocalDate & toLocalDateValue — audit date/datetime (revisi 8)", () => {
  it("`YYYY-MM-DD` di-parse LOKAL (bukan UTC): hari & jam tak bergeser", () => {
    const d = parseLocalDate("2026-03-15");
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2026, 2, 15]);
    expect([d.getHours(), d.getMinutes()]).toEqual([0, 0]);
  });

  it("`YYYY-MM-DD HH:mm` & `YYYY-MM-DDTHH:mm` -> jam lokal", () => {
    for (const raw of ["2026-03-15 14:35", "2026-03-15T14:35"]) {
      const d = parseLocalDate(raw);
      expect([d.getDate(), d.getHours(), d.getMinutes()]).toEqual([15, 14, 35]);
    }
  });

  it("ISO lama (`...Z`) tetap terbaca; kosong/rusak -> undefined; Date lolos", () => {
    expect(parseLocalDate("2026-03-15T10:00:00.000Z")).toBeInstanceOf(Date);
    expect(parseLocalDate("")).toBeUndefined();
    expect(parseLocalDate(null)).toBeUndefined();
    expect(parseLocalDate("bukan tanggal")).toBeUndefined();
    const now = new Date();
    expect(parseLocalDate(now)).toBe(now);
  });

  it("toLocalDateValue: kolom date membuang jam, datetime menyimpannya", () => {
    const d = new Date(2026, 8, 25, 14, 35);
    expect(toLocalDateValue(d)).toBe("2026-09-25");
    expect(toLocalDateValue(d, { isDatetime: true })).toBe("2026-09-25 14:35");
    expect(toLocalDateValue("2026-09-25 14:35")).toBe("2026-09-25");
    expect(toLocalDateValue(new Date(2026, 8, 25), { isDatetime: true })).toBe(
      "2026-09-25",
    );
    expect(toLocalDateValue(undefined)).toBeUndefined();
  });
});

describe("hasPeriodSelection — emisi kosong widget BUKAN pilihan (revisi 8)", () => {
  it("tanpa period/operator, atau tanpa pilihan -> false", () => {
    expect(hasPeriodSelection(undefined)).toBe(false);
    expect(hasPeriodSelection({})).toBe(false);
    expect(hasPeriodSelection({ period: "day", operator: "is" })).toBe(false);
    expect(hasPeriodSelection({ period: "year", operator: "is" })).toBe(false);
    expect(
      hasPeriodSelection({ period: "month", operator: "is", year: 2026 }),
    ).toBe(false);
  });

  it("day: cukup startDate; non-day: tahun + unit (kecuali year)", () => {
    expect(
      hasPeriodSelection({
        period: "day",
        operator: "is",
        startDate: "2026-09-25",
      }),
    ).toBe(true);
    expect(
      hasPeriodSelection({ period: "year", operator: "is", year: 2026 }),
    ).toBe(true);
    expect(
      hasPeriodSelection({
        period: "month",
        operator: "is",
        year: 2026,
        month: 0,
      }),
    ).toBe(true);
    expect(
      hasPeriodSelection({
        period: "quarter",
        operator: "is",
        year: 2026,
        quarter: 0,
      }),
    ).toBe(true);
    expect(
      hasPeriodSelection({
        period: "half-year",
        operator: "is",
        year: 2026,
        halfYear: 1,
      }),
    ).toBe(true);
  });

  it("range non-day: rangeStart saja sudah cukup (end dilengkapi belakangan)", () => {
    expect(
      hasPeriodSelection({
        period: "month",
        operator: "between",
        rangeStart: { year: 2026, value: 2 },
      }),
    ).toBe(true);
  });
});

describe("completeRange — between tanpa end -> end = start", () => {
  it("day: endDate = startDate; sudah lengkap / bukan between -> apa adanya", () => {
    const half = {
      period: "day",
      operator: "between",
      startDate: "2026-09-01",
    };
    expect(completeRange(half).endDate).toBe("2026-09-01");
    const full = { ...half, endDate: "2026-09-30" };
    expect(completeRange(full)).toBe(full);
    const single = { period: "day", operator: "is", startDate: "2026-09-01" };
    expect(completeRange(single)).toBe(single);
  });

  it("non-day: rangeEnd = rangeStart; turun dari year+unit bila rangeStart kosong", () => {
    const withStart = {
      period: "month",
      operator: "between",
      rangeStart: { year: 2026, value: 2 },
    };
    expect(completeRange(withStart).rangeEnd).toEqual({ year: 2026, value: 2 });
    const fromYear = {
      period: "quarter",
      operator: "between",
      year: 2026,
      quarter: 1,
    };
    expect(completeRange(fromYear).rangeStart).toEqual({
      year: 2026,
      value: 1,
    });
    expect(completeRange(fromYear).rangeEnd).toEqual({ year: 2026, value: 1 });
  });

  it("tidak memutasi input; undefined aman", () => {
    const half = {
      period: "day",
      operator: "between",
      startDate: "2026-09-01",
    };
    completeRange(half);
    expect(half.endDate).toBeUndefined();
    expect(completeRange(undefined)).toBeUndefined();
  });
});

describe("defaultYearBounds", () => {
  it("20 tahun ke belakang s/d 5 tahun ke depan dari `now`", () => {
    expect(defaultYearBounds(new Date(2026, 5, 1))).toEqual({
      minYear: 2006,
      maxYear: 2031,
    });
  });
});

describe("isCompletePeriodValue — range menunggu ujung kedua (revisi 9)", () => {
  it("non-range: cukup ada pilihan", () => {
    expect(
      isCompletePeriodValue({
        period: "day",
        operator: "is",
        startDate: "2026-09-25",
      }),
    ).toBe(true);
    expect(isCompletePeriodValue({ period: "day", operator: "is" })).toBe(
      false,
    );
  });

  it("between day: butuh endDate", () => {
    const half = {
      period: "day",
      operator: "between",
      startDate: "2026-09-10",
    };
    expect(isCompletePeriodValue(half)).toBe(false);
    expect(isCompletePeriodValue({ ...half, endDate: "2026-09-20" })).toBe(
      true,
    );
  });

  it("between non-day: butuh rangeEnd", () => {
    const half = {
      period: "month",
      operator: "between",
      rangeStart: { year: 2026, value: 2 },
    };
    expect(isCompletePeriodValue(half)).toBe(false);
    expect(
      isCompletePeriodValue({ ...half, rangeEnd: { year: 2026, value: 5 } }),
    ).toBe(true);
  });
});

describe("monthsStartingWith — awalan nama bulan (locale + Inggris)", () => {
  it("'ju' -> Juni & Juli; 'ma' -> Maret & Mei(May); tak cocok -> []", () => {
    expect(monthsStartingWith("ju", i18nLabels)).toEqual([5, 6]);
    expect(monthsStartingWith("ma", i18nLabels)).toEqual([2, 4]);
    expect(monthsStartingWith("xyz", i18nLabels)).toEqual([]);
    expect(monthsStartingWith("", i18nLabels)).toEqual([]);
  });
});

describe("buildFlexibleBetween — rentang campuran (revisi 10)", () => {
  const tok = (raw, c = ctx) => parsePeriodToken(raw, c);

  it("granularitas sama: sama dgn buildBetweenPeriodValue (non-hari)", () => {
    expect(buildFlexibleBetween(tok("Jan 2026"), tok("Jun 2026"))).toEqual(
      buildBetweenPeriodValue(tok("Jan 2026"), tok("Jun 2026")),
    );
    expect(buildFlexibleBetween(tok("2026"), tok("2027"))).toEqual(
      buildBetweenPeriodValue(tok("2026"), tok("2027")),
    );
  });

  it("bulan .. tahun -> bulan; ujung akhir = Desember", () => {
    expect(buildFlexibleBetween(tok("Jan 2026"), tok("2027"))).toEqual({
      period: "month",
      operator: "between",
      year: 2026,
      rangeStart: { year: 2026, value: 0 },
      rangeEnd: { year: 2027, value: 11 },
    });
  });

  it("tahun .. bulan -> bulan; ujung awal = Januari", () => {
    expect(buildFlexibleBetween(tok("2026"), tok("Mar 2027"))).toEqual({
      period: "month",
      operator: "between",
      year: 2026,
      rangeStart: { year: 2026, value: 0 },
      rangeEnd: { year: 2027, value: 2 },
    });
  });

  it("kuartal/semester .. tahun & kuartal .. semester", () => {
    expect(buildFlexibleBetween(tok("Q2 2026"), tok("2026")).rangeEnd).toEqual({
      year: 2026,
      value: 3,
    });
    // H2 = Q3-Q4 -> ujung awal Q3, ujung akhir Q4
    const h = buildFlexibleBetween(tok("H2 2026"), tok("Q1 2027"));
    expect(h.period).toBe("quarter");
    expect(h.rangeStart).toEqual({ year: 2026, value: 2 });
    expect(h.rangeEnd).toEqual({ year: 2027, value: 0 });
    // semester .. tahun -> semester
    expect(buildFlexibleBetween(tok("H1 2026"), tok("2026")).rangeEnd).toEqual({
      year: 2026,
      value: 1,
    });
  });

  it("hari .. bulan/tahun -> hari; hari terakhir periodenya", () => {
    const v = buildFlexibleBetween(tok("10 Sep 2026"), tok("Feb 2028"));
    expect(v.period).toBe("day");
    expect([v.startDate.getMonth(), v.startDate.getDate()]).toEqual([8, 10]);
    // 2028 kabisat -> 29 Feb
    expect([v.endDate.getMonth(), v.endDate.getDate()]).toEqual([1, 29]);
    const y = buildFlexibleBetween(tok("2026"), tok("15 Mar 2027"));
    expect([y.startDate.getMonth(), y.startDate.getDate()]).toEqual([0, 1]);
    expect(y.endDate.getDate()).toBe(15);
  });

  it("null bila salah satu ujung null", () => {
    expect(buildFlexibleBetween(null, tok("2026"))).toBeNull();
    expect(buildFlexibleBetween(tok("2026"), null)).toBeNull();
  });
});
