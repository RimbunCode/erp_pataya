import { describe, expect, it } from "vitest";
import {
  formatDateValue,
  isRangeFilterType,
  DEFAULT_DATE_SELECTOR_I18N,
} from "./date-selector";

describe("isRangeFilterType", () => {
  it("true hanya untuk operator 'between'", () => {
    expect(isRangeFilterType("between")).toBe(true);
    expect(isRangeFilterType("is")).toBe(false);
    expect(isRangeFilterType("before")).toBe(false);
    expect(isRangeFilterType(undefined)).toBe(false);
  });
});

describe("formatDateValue", () => {
  it("period='day' dengan single date -> format dayDateFormat", () => {
    expect(
      formatDateValue({ period: "day", startDate: new Date(2026, 0, 15) }),
    ).toBe("01/15/2026");
  });

  it("period='day' dengan range (startDate+endDate) -> 'start - end'", () => {
    expect(
      formatDateValue({
        period: "day",
        startDate: new Date(2026, 0, 1),
        endDate: new Date(2026, 0, 31),
      }),
    ).toBe("01/01/2026 - 01/31/2026");
  });

  it("period='day' tanpa startDate -> string kosong", () => {
    expect(formatDateValue({ period: "day" })).toBe("");
  });

  it("period='day' menghormati dayDateFormat custom", () => {
    expect(
      formatDateValue(
        { period: "day", startDate: new Date(2026, 0, 15) },
        DEFAULT_DATE_SELECTOR_I18N,
        "yyyy-MM-dd",
      ),
    ).toBe("2026-01-15");
  });

  it("period='month' single -> 'MonShort Year'", () => {
    expect(formatDateValue({ period: "month", year: 2026, month: 0 })).toBe(
      "Jan 2026",
    );
  });

  it("period='month' range -> 'MonShort Year - MonShort Year'", () => {
    expect(
      formatDateValue({
        period: "month",
        rangeStart: { year: 2026, value: 0 },
        rangeEnd: { year: 2026, value: 5 },
      }),
    ).toBe("Jan 2026 - Jun 2026");
  });

  it("period='quarter' single -> 'Qn Year'", () => {
    expect(formatDateValue({ period: "quarter", year: 2026, quarter: 2 })).toBe(
      "Q3 2026",
    );
  });

  it("period='half-year' single -> 'Hn Year'", () => {
    expect(
      formatDateValue({ period: "half-year", year: 2026, halfYear: 1 }),
    ).toBe("H2 2026");
  });

  it("period='year' single -> 'Year'", () => {
    expect(formatDateValue({ period: "year", year: 2026 })).toBe("2026");
  });

  it("period='year' range -> 'Year - Year'", () => {
    expect(
      formatDateValue({
        period: "year",
        rangeStart: { year: 2024 },
        rangeEnd: { year: 2026 },
      }),
    ).toBe("2024 - 2026");
  });

  it("period tidak dikenal atau value kosong -> string kosong", () => {
    expect(formatDateValue({ period: "unknown" })).toBe("");
    expect(formatDateValue(null)).toBe("");
    expect(formatDateValue(undefined)).toBe("");
  });

  it("i18n custom dipakai untuk label bulan/quarter/half-year", () => {
    const customI18n = {
      ...DEFAULT_DATE_SELECTOR_I18N,
      monthsShort: [
        "Jan-ID", "Feb-ID", "Mar-ID", "Apr-ID", "Mei-ID", "Jun-ID",
        "Jul-ID", "Agu-ID", "Sep-ID", "Okt-ID", "Nov-ID", "Des-ID",
      ],
    };
    expect(
      formatDateValue({ period: "month", year: 2026, month: 0 }, customI18n),
    ).toBe("Jan-ID 2026");
  });
});
