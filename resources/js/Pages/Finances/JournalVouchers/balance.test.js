import { describe, expect, it } from "vitest";
import { summarizeBalance, toMinor } from "./balance";

describe("toMinor", () => {
  it("membulatkan HALF_UP ke minor unit", () => {
    expect(toMinor(1.005, 2)).toBe(101);
    expect(toMinor("100.004", 2)).toBe(10000);
    expect(toMinor(100.005, 2)).toBe(10001);
    expect(toMinor("150000.5000", 2)).toBe(15000050);
  });

  it("menghormati minor unit mata uang (0 dan 3 desimal)", () => {
    expect(toMinor(1500.5, 0)).toBe(1501);
    expect(toMinor(1.2345, 3)).toBe(1235);
  });

  it("nilai kosong atau bukan angka menjadi 0", () => {
    expect(toMinor(null)).toBe(0);
    expect(toMinor(undefined)).toBe(0);
    expect(toMinor("")).toBe(0);
    expect(toMinor("abc")).toBe(0);
  });

  it("menangani notasi eksponen", () => {
    expect(toMinor(1e-7, 2)).toBe(0);
    expect(toMinor(1e21, 2)).toBe(1e23);
  });
});

describe("summarizeBalance", () => {
  const account = (id) => ({ id });

  it("seimbang bila Σdebit = Σkredit dalam minor unit dan ada >= 2 baris", () => {
    const result = summarizeBalance(
      [
        { account: account("a"), debit: 100.004, credit: 0 },
        { account: account("b"), debit: 0, credit: 100 },
      ],
      2,
    );

    expect(result.state).toBe("balanced");
    expect(result.differenceMinor).toBe(0);
    expect(result.lineCount).toBe(2);
  });

  it("tidak seimbang melaporkan selisih (debit dikurangi kredit)", () => {
    const result = summarizeBalance(
      [
        { account: account("a"), debit: 100.005, credit: 0 },
        { account: account("b"), debit: 0, credit: 100 },
      ],
      2,
    );

    expect(result.state).toBe("unbalanced");
    expect(result.differenceMinor).toBe(1);
  });

  it("kurang dari 2 baris terisi menjadi too_few; baris kosong diabaikan", () => {
    expect(summarizeBalance([], 2).state).toBe("too_few");
    expect(
      summarizeBalance(
        [
          { account: account("a"), debit: 10, credit: 0 },
          { debit: null, credit: null },
        ],
        2,
      ).state,
    ).toBe("too_few");
  });

  it("dua baris bernilai nol tidak dianggap seimbang", () => {
    const result = summarizeBalance(
      [{ account: account("a") }, { account: account("b") }],
      2,
    );

    expect(result.state).toBe("unbalanced");
  });
});
