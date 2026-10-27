import { describe, expect, it } from "vitest";

import { getLocaleDate } from "@/lib/utils";
import { buildDatetimePickerI18n } from "./datetimePickerI18n";

const t = (key) => `TR:${key}`;

describe("buildDatetimePickerI18n", () => {
  it("locale id: bulan penuh, bulan singkat, dan nama hari berbahasa Indonesia", () => {
    const i18n = buildDatetimePickerI18n({
      t,
      dateLocale: getLocaleDate("id"),
    });

    expect(i18n.months).toHaveLength(12);
    expect(i18n.months[0]).toBe("Januari");
    expect(i18n.months[9]).toBe("Oktober");
    expect(i18n.monthsShort).toHaveLength(12);
    expect(i18n.monthsShort[4]).toBe("Mei");
    expect(i18n.monthsShort[7]).toBe("Agt");
    // Minggu pertama: urutan sama dengan i18n bawaan (Minggu = indeks 0).
    expect(i18n.weekdays).toHaveLength(7);
    expect(i18n.weekdays[0]).toBe("Minggu");
    expect(i18n.weekdays[1]).toBe("Senin");
    expect(i18n.weekdaysShort).toHaveLength(7);
  });

  it("locale en: tetap berbahasa Inggris", () => {
    const i18n = buildDatetimePickerI18n({
      t,
      dateLocale: getLocaleDate("en"),
    });

    expect(i18n.months[9]).toBe("October");
    expect(i18n.weekdays[0]).toBe("Sunday");
    expect(i18n.weekdaysShort[0]).toBe("Su");
  });

  it("label tombol diambil dari kunci core.form.today dan core.form.now", () => {
    const i18n = buildDatetimePickerI18n({
      t,
      dateLocale: getLocaleDate("en"),
    });

    expect(i18n.goToToday).toBe("TR:core.form.today");
    expect(i18n.now).toBe("TR:core.form.now");
  });
});
