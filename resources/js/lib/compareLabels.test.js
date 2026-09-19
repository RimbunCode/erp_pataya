import { describe, it, expect } from "vitest";
import { compareLabels } from "./compareLabels";

describe("compareLabels", () => {
  it("mengurutkan abjad, tak peduli huruf besar/kecil di awal kata", () => {
    const sorted = ["Nama", "kode", "Akun", "budget"].sort((a, b) =>
      compareLabels(a, b),
    );
    expect(sorted).toEqual(["Akun", "budget", "kode", "Nama"]);
  });

  it("locale ikut aturan collation bahasa (ä: dekat 'a' di de, setelah 'z' di sv)", () => {
    const words = ["z", "ä", "a"];
    expect([...words].sort((a, b) => compareLabels(a, b, "de"))).toEqual([
      "a",
      "ä",
      "z",
    ]);
    expect([...words].sort((a, b) => compareLabels(a, b, "sv"))).toEqual([
      "a",
      "z",
      "ä",
    ]);
  });

  it("null/undefined dianggap string kosong, tidak crash", () => {
    expect(() => compareLabels(undefined, "a")).not.toThrow();
    expect(compareLabels(null, "a")).toBeLessThan(0);
    expect(compareLabels("a", undefined)).toBeGreaterThan(0);
  });
});
