import { describe, expect, it } from "vitest";
import { addDays, depreciationDefaultsPatch } from "./otherModuleDefaults";

describe("addDays", () => {
  it("menambah hari kalender dan mempertahankan jam lokal", () => {
    const next = addDays(new Date(2030, 2, 1, 9, 30), 14);

    expect(next.getTime()).toBe(new Date(2030, 2, 15, 9, 30).getTime());
  });

  it("menerima string ISO dan angka epoch", () => {
    const base = new Date(2030, 0, 10, 12, 0);

    expect(addDays(base.toISOString(), 1).getTime()).toBe(
      new Date(2030, 0, 11, 12, 0).getTime(),
    );
    expect(addDays(base.getTime(), 0).getTime()).toBe(base.getTime());
  });

  it("melewati batas bulan dan tahun", () => {
    expect(addDays(new Date(2030, 11, 30, 8, 0), 5).getTime()).toBe(
      new Date(2031, 0, 4, 8, 0).getTime(),
    );
  });

  it.each([
    [null, 5],
    [undefined, 5],
    ["", 5],
    ["bukan tanggal", 5],
    [new Date(2030, 0, 1), null],
    [new Date(2030, 0, 1), undefined],
    [new Date(2030, 0, 1), ""],
    [new Date(2030, 0, 1), "abc"],
  ])("mengembalikan null untuk masukan tidak valid (%s, %s)", (value, days) => {
    expect(addDays(value, days)).toBeNull();
  });
});

describe("depreciationDefaultsPatch", () => {
  const defaults = {
    depreciation_method: "straight_line",
    frequency_of_depreciation: 12,
    total_number_of_depreciations: 5,
  };

  it("mengisi ketiga field yang kosong", () => {
    expect(depreciationDefaultsPatch({}, defaults)).toEqual(defaults);
    expect(
      depreciationDefaultsPatch(
        {
          depreciation_method: null,
          frequency_of_depreciation: "",
          total_number_of_depreciations: undefined,
        },
        defaults,
      ),
    ).toEqual(defaults);
  });

  it("tidak menimpa nilai yang sudah ada, termasuk 0", () => {
    expect(
      depreciationDefaultsPatch(
        { depreciation_method: "manual", frequency_of_depreciation: 0 },
        defaults,
      ),
    ).toEqual({ total_number_of_depreciations: 5 });
  });

  it("tidak mengisi field yang tidak punya default", () => {
    expect(
      depreciationDefaultsPatch(
        {},
        {
          depreciation_method: null,
          frequency_of_depreciation: 6,
        },
      ),
    ).toEqual({ frequency_of_depreciation: 6 });
    expect(depreciationDefaultsPatch({}, undefined)).toEqual({});
  });
});
