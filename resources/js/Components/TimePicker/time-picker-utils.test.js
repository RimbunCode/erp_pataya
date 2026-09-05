import { describe, expect, it } from "vitest";
import {
  isValidHour,
  isValid12Hour,
  isValidMinuteOrSecond,
  getValidNumber,
  getValidHour,
  getValid12Hour,
  getValidMinuteOrSecond,
  getValidArrowHour,
  getValidArrow12Hour,
  getValidArrowMinuteOrSecond,
  setMinutes,
  setSeconds,
  setHours,
  set12Hours,
  setDateByType,
  getDateByType,
  getArrowByType,
  convert12HourTo24Hour,
  display12HourValue,
} from "./time-picker-utils";

describe("isValidHour / isValid12Hour / isValidMinuteOrSecond", () => {
  it("isValidHour menerima 00-23", () => {
    expect(isValidHour("00")).toBe(true);
    expect(isValidHour("23")).toBe(true);
    expect(isValidHour("24")).toBe(false);
    expect(isValidHour("5")).toBe(false); // harus 2 digit
  });

  it("isValid12Hour menerima 01-12", () => {
    expect(isValid12Hour("01")).toBe(true);
    expect(isValid12Hour("12")).toBe(true);
    expect(isValid12Hour("00")).toBe(false);
    expect(isValid12Hour("13")).toBe(false);
  });

  it("isValidMinuteOrSecond menerima 00-59", () => {
    expect(isValidMinuteOrSecond("00")).toBe(true);
    expect(isValidMinuteOrSecond("59")).toBe(true);
    expect(isValidMinuteOrSecond("60")).toBe(false);
  });
});

describe("getValidNumber", () => {
  it("clamp ke max/min tanpa loop", () => {
    expect(getValidNumber("99", { max: 23 })).toBe("23");
    expect(getValidNumber("-5", { max: 23, min: 0 })).toBe("00");
  });

  it("loop=true membungkus ke ujung berlawanan", () => {
    expect(getValidNumber("99", { max: 23, loop: true })).toBe("00");
    expect(getValidNumber("-1", { max: 23, min: 0, loop: true })).toBe("23");
  });

  it("value non-numeric fallback ke '00'", () => {
    expect(getValidNumber("abc", { max: 23 })).toBe("00");
  });

  it("padStart ke 2 digit", () => {
    expect(getValidNumber("5", { max: 23 })).toBe("05");
  });
});

describe("getValidHour / getValid12Hour / getValidMinuteOrSecond", () => {
  it("mengembalikan value apa adanya bila sudah valid", () => {
    expect(getValidHour("15")).toBe("15");
    expect(getValid12Hour("07")).toBe("07");
    expect(getValidMinuteOrSecond("45")).toBe("45");
  });

  it("meng-clamp value invalid via getValidNumber", () => {
    expect(getValidHour("99")).toBe("23");
    expect(getValid12Hour("00")).toBe("01");
    expect(getValidMinuteOrSecond("99")).toBe("59");
  });
});

describe("getValidArrowHour / getValidArrow12Hour / getValidArrowMinuteOrSecond", () => {
  it("increment biasa", () => {
    expect(getValidArrowHour("10", 1)).toBe("11");
    expect(getValidArrowMinuteOrSecond("30", 5)).toBe("35");
  });

  it("loop di batas atas hour (23 + 1 -> 00)", () => {
    expect(getValidArrowHour("23", 1)).toBe("00");
  });

  it("loop di batas bawah hour (00 - 1 -> 23)", () => {
    expect(getValidArrowHour("00", -1)).toBe("23");
  });

  it("loop 12hour di batas (12 + 1 -> 01)", () => {
    expect(getValidArrow12Hour("12", 1)).toBe("01");
  });
});

describe("setMinutes / setSeconds / setHours / set12Hours", () => {
  it("setMinutes/setSeconds/setHours meng-clamp lalu set ke Date", () => {
    const date = new Date(2026, 0, 1, 0, 0, 0);
    setHours(date, "15");
    setMinutes(date, "30");
    setSeconds(date, "45");
    expect(date.getHours()).toBe(15);
    expect(date.getMinutes()).toBe(30);
    expect(date.getSeconds()).toBe(45);
  });

  it("set12Hours mengonversi 12-hour + period ke 24-hour", () => {
    const date = new Date(2026, 0, 1);
    set12Hours(date, "09", "PM");
    expect(date.getHours()).toBe(21);
  });
});

describe("setDateByType", () => {
  it("dispatch ke setter yang benar berdasarkan type", () => {
    const date = new Date(2026, 0, 1, 0, 0, 0);
    setDateByType(date, "30", "minutes");
    expect(date.getMinutes()).toBe(30);
  });

  it("type '12hours' tanpa period dikembalikan apa adanya (no-op)", () => {
    const date = new Date(2026, 0, 1, 5, 0, 0);
    const result = setDateByType(date, "09", "12hours", undefined);
    expect(result.getHours()).toBe(5);
  });

  it("type tidak dikenal dikembalikan apa adanya", () => {
    const date = new Date(2026, 0, 1, 5, 0, 0);
    expect(setDateByType(date, "09", "unknown").getHours()).toBe(5);
  });
});

describe("getDateByType", () => {
  it("mengembalikan '00' untuk date range object ({from}/{to})", () => {
    expect(getDateByType({ from: new Date() }, "hours")).toBe("00");
    expect(getDateByType({ to: new Date() }, "minutes")).toBe("00");
  });

  it("mengekstrak bagian minutes/seconds/hours dari Date", () => {
    const date = new Date(2026, 0, 1, 14, 5, 9);
    expect(getDateByType(date, "hours")).toBe("14");
    expect(getDateByType(date, "minutes")).toBe("05");
    expect(getDateByType(date, "seconds")).toBe("09");
  });

  it("type '12hours' mengonversi 24h ke tampilan 12h", () => {
    const date = new Date(2026, 0, 1, 14, 0, 0); // 14:00 -> "02"
    expect(getDateByType(date, "12hours")).toBe("02");
  });
});

describe("getArrowByType", () => {
  it("dispatch minutes/seconds/hours/12hours ke fungsi arrow yang benar", () => {
    expect(getArrowByType("30", 1, "minutes")).toBe("31");
    expect(getArrowByType("30", 1, "seconds")).toBe("31");
    expect(getArrowByType("10", 1, "hours")).toBe("11");
    expect(getArrowByType("10", 1, "12hours")).toBe("11");
  });

  it("type tidak dikenal fallback ke '00'", () => {
    expect(getArrowByType("10", 1, "unknown")).toBe("00");
  });
});

describe("convert12HourTo24Hour", () => {
  it("PM: 1-11 ditambah 12, 12 tetap 12", () => {
    expect(convert12HourTo24Hour(9, "PM")).toBe(21);
    expect(convert12HourTo24Hour(12, "PM")).toBe(12);
  });

  it("AM: 12 menjadi 0, selain itu tetap", () => {
    expect(convert12HourTo24Hour(12, "AM")).toBe(0);
    expect(convert12HourTo24Hour(6, "AM")).toBe(6);
  });

  it("tanpa period dikembalikan apa adanya", () => {
    expect(convert12HourTo24Hour(15, undefined)).toBe(15);
  });
});

describe("display12HourValue", () => {
  it("0 dan 12 -> '12'", () => {
    expect(display12HourValue(0)).toBe("12");
    expect(display12HourValue(12)).toBe("12");
  });

  it(">=22 -> hours - 12 tanpa leading zero", () => {
    expect(display12HourValue(22)).toBe("10");
    expect(display12HourValue(23)).toBe("11");
  });

  it("13-21 -> hours % 12 dengan leading zero bila <10", () => {
    expect(display12HourValue(13)).toBe("01");
    expect(display12HourValue(21)).toBe("09");
  });

  it("1-11 -> leading zero", () => {
    expect(display12HourValue(5)).toBe("05");
  });
});
