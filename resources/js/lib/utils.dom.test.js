import { describe, it, expect } from "vitest";
import {
  isMetaAppendColumn,
  formatBytes,
  isImageUrl,
  toSnakeCase,
  isNullOrWhitespace,
  getValueObject,
  isValidStatus,
  camelize,
  isDeepEmpty,
  inArray,
  calculateArray,
  calculateDurationDays,
  calculateRentalAmount,
  getSafePrintFontFamily,
  checkPermission,
} from "./utils";

describe("isMetaAppendColumn", () => {
  it("mengenali kolom meta append", () => {
    expect(isMetaAppendColumn({ name: "route" })).toBe(true);
    expect(isMetaAppendColumn({ name: "canDelete" })).toBe(true);
  });

  it("menolak kolom data biasa", () => {
    expect(isMetaAppendColumn({ name: "customer_name" })).toBe(false);
  });

  it("aman untuk column undefined/null", () => {
    expect(isMetaAppendColumn(undefined)).toBe(false);
    expect(isMetaAppendColumn(null)).toBe(false);
  });
});

describe("formatBytes", () => {
  it("format 0 bytes", () => {
    expect(formatBytes(0)).toBe("0 Bytes");
  });

  it("format ke KB/MB/GB sesuai skala", () => {
    expect(formatBytes(1024)).toBe("1 KB");
    expect(formatBytes(1048576)).toBe("1 MB");
    expect(formatBytes(1073741824)).toBe("1 GB");
  });

  it("membulatkan sesuai jumlah desimal", () => {
    expect(formatBytes(1536, 1)).toBe("1.5 KB");
  });
});

describe("isImageUrl", () => {
  it("mengenali URL http/https sebagai image URL", () => {
    expect(isImageUrl("https://example.com/a.jpg")).toBe(true);
    expect(isImageUrl("http://example.com/a.jpg")).toBe(true);
  });

  it("mengenali protocol-relative URL sebagai image URL", () => {
    expect(isImageUrl("//example.com/a.jpg")).toBe(true);
  });

  it("menolak file-ID lokal (bukan URL)", () => {
    expect(isImageUrl("abc123-file-id")).toBe(false);
  });

  it("aman untuk value null/undefined", () => {
    expect(isImageUrl(null)).toBe(false);
    expect(isImageUrl(undefined)).toBe(false);
  });
});

// checkUrlPath (pathname-wildcard matching) SUDAH DIHAPUS dari utils.js --
// digantikan Ziggy `route().current(routeName)` sejak refactor sidebar Desk
// (lihat NavMain.jsx). Tidak ada pemakai lain (grep seluruh resources/js),
// jadi 3 test lama di sini dihapus, bukan di-skip -- fungsi yang diuji
// memang sudah tidak ada.

describe("toSnakeCase", () => {
  it("mengubah camelCase menjadi snake_case", () => {
    expect(toSnakeCase("myVariableName")).toBe("my_variable_name");
  });

  it("mengubah spasi dan dash menjadi underscore", () => {
    expect(toSnakeCase("hello world-test")).toBe("hello_world_test");
  });

  it("hasil selalu lowercase", () => {
    expect(toSnakeCase("MyVariable")).toBe("my_variable");
  });
});

describe("isNullOrWhitespace", () => {
  it("true untuk null/undefined", () => {
    expect(isNullOrWhitespace(null)).toBe(true);
    expect(isNullOrWhitespace(undefined)).toBe(true);
  });

  it("true untuk string kosong atau hanya spasi", () => {
    expect(isNullOrWhitespace("")).toBe(true);
    expect(isNullOrWhitespace("   ")).toBe(true);
  });

  it("false untuk string berisi konten", () => {
    expect(isNullOrWhitespace("hello")).toBe(false);
    expect(isNullOrWhitespace("  hello  ")).toBe(false);
  });
});

describe("getValueObject", () => {
  it("resolve nested path dot-notation", () => {
    expect(getValueObject({ a: { b: { c: 42 } } }, "a.b.c")).toBe(42);
  });

  it("return undefined untuk path yang tidak ada", () => {
    expect(getValueObject({ a: {} }, "a.b.c")).toBeUndefined();
  });
});

describe("isValidStatus", () => {
  it("false untuk status yang dikecualikan", () => {
    expect(isValidStatus("draft")).toBe(false);
    expect(isValidStatus("canceled")).toBe(false);
    expect(isValidStatus("rejected")).toBe(false);
  });

  it("true untuk status lain", () => {
    expect(isValidStatus("approved")).toBe(true);
    expect(isValidStatus("completed")).toBe(true);
  });
});

describe("camelize", () => {
  it("mengubah string dengan spasi menjadi camelCase", () => {
    expect(camelize("hello world")).toBe("helloWorld");
  });

  it("huruf pertama selalu lowercase", () => {
    expect(camelize("Hello World")).toBe("helloWorld");
  });
});

describe("isDeepEmpty", () => {
  it("true untuk undefined/null", () => {
    expect(isDeepEmpty(undefined)).toBe(true);
    expect(isDeepEmpty(null)).toBe(true);
  });

  it("true untuk array kosong atau array berisi nilai kosong", () => {
    expect(isDeepEmpty([])).toBe(true);
    expect(isDeepEmpty([null, undefined])).toBe(true);
  });

  it("true untuk object kosong atau object berisi nilai kosong", () => {
    expect(isDeepEmpty({})).toBe(true);
    expect(isDeepEmpty({ a: null, b: undefined })).toBe(true);
  });

  it("false untuk value yang benar-benar berisi data", () => {
    expect(isDeepEmpty("text")).toBe(false);
    expect(isDeepEmpty(0)).toBe(false);
    expect(isDeepEmpty({ a: 1 })).toBe(false);
    expect(isDeepEmpty([1, 2])).toBe(false);
  });
});

describe("inArray", () => {
  it("true jika needle tunggal ada di haystack array", () => {
    expect(inArray([1, 2, 3], 2)).toBe(true);
  });

  it("true jika salah satu needles array ada di haystack array", () => {
    expect(inArray([1, 2, 3], [5, 2])).toBe(true);
  });

  it("false jika tidak ada yang cocok (haystack array)", () => {
    expect(inArray([1, 2, 3], 9)).toBe(false);
    expect(inArray([1, 2, 3], [9, 8])).toBe(false);
  });

  it("bekerja saat haystack berupa value tunggal, needles array (pola status-check)", () => {
    // Pola dominan di codebase: inArray(status, ["a","b"]) — status BUKAN array.
    expect(inArray("draft", ["draft", "canceled"])).toBe(true);
    expect(inArray("approved", ["draft", "canceled"])).toBe(false);
  });

  it("bekerja saat haystack DAN needles sama-sama value tunggal string", () => {
    // Sebelum fix: string di posisi haystack ter-iterasi per-karakter dan
    // tidak pernah match. Regression guard untuk PurchaseReceipts/Show.jsx dkk.
    expect(inArray("received", "received")).toBe(true);
    expect(inArray("draft", "received")).toBe(false);
  });

  it("bekerja saat haystack berupa array of candidates, needles value tunggal (pola permission-check)", () => {
    // Pola lain di codebase: inArray(["create","import"], action).
    expect(inArray(["create", "import", "select"], "create")).toBe(true);
    expect(inArray(["create", "import", "select"], "delete")).toBe(false);
  });
});

describe("calculateArray", () => {
  const arr = [{ qty: 2 }, { qty: 3 }, { qty: 5 }];

  it("menjumlahkan (+) sesuai keyColumn", () => {
    expect(calculateArray(arr, "qty", "+")).toBe(10);
  });

  it("menghitung rata-rata (average)", () => {
    expect(calculateArray(arr, "qty", "average")).toBeCloseTo(10 / 3);
  });

  it("return 0 jika keyColumn/operator tidak lengkap", () => {
    expect(calculateArray(arr, null, "+")).toBe(0);
    expect(calculateArray(arr, "qty", null)).toBe(0);
  });
});

describe("calculateDurationDays", () => {
  it("menghitung selisih hari inklusif kedua ujung", () => {
    expect(calculateDurationDays("2026-01-01", "2026-01-01")).toBe(1);
    expect(calculateDurationDays("2026-01-01", "2026-01-05")).toBe(5);
  });
});

describe("calculateRentalAmount", () => {
  it("prorata harian untuk durasi <= 30 hari", () => {
    expect(calculateRentalAmount(3000, 15)).toBeCloseTo((3000 / 30) * 15);
  });

  it("kombinasi bulan penuh + sisa hari untuk durasi > 30 hari", () => {
    // 45 hari = 1 bulan penuh (3000) + 15 hari prorata (1500)
    expect(calculateRentalAmount(3000, 45)).toBeCloseTo(3000 + 1500);
  });
});

describe("getSafePrintFontFamily", () => {
  it("wrap nama font dengan quote dan fallback generic", () => {
    expect(getSafePrintFontFamily("Arial")).toBe("'Arial', sans-serif");
  });

  it("infer fallback serif untuk font serif dikenal", () => {
    expect(getSafePrintFontFamily("Times New Roman")).toBe(
      "'Times New Roman', serif",
    );
  });

  it("infer fallback monospace untuk font monospace dikenal", () => {
    expect(getSafePrintFontFamily("Courier New")).toBe(
      "'Courier New', monospace",
    );
  });

  it("escape quote pada nama font", () => {
    expect(getSafePrintFontFamily("O'Brien")).toBe("'O\\'Brien', sans-serif");
  });

  it("return fallback generic saja jika nama font kosong", () => {
    expect(getSafePrintFontFamily("", "monospace")).toBe("monospace");
  });
});

describe("checkPermission", () => {
  const permissions = {
    "App\\Models\\User": {
      0: {
        1: { only_creator: false, permissions: { view: true, update: true } },
      },
    },
  };

  it("allowed=true jika ada permission level yang sesuai", () => {
    expect(
      checkPermission(permissions, "App\\Models\\User", "view", 0),
    ).toEqual({ allowed: true, onlyCreator: false });
  });

  it("allowed=false jika action tidak diizinkan", () => {
    expect(
      checkPermission(permissions, "App\\Models\\User", "delete", 0),
    ).toEqual({ allowed: false, onlyCreator: false });
  });

  it("allowed=false jika model tidak ada di permissions", () => {
    expect(
      checkPermission(permissions, "App\\Models\\Unknown", "view", 0),
    ).toEqual({ allowed: false, onlyCreator: false });
  });

  it("bypass true jika model masuk ignorePermissionModels", () => {
    expect(
      checkPermission(permissions, "App\\Models\\Unknown", "view", 0, [
        "App\\Models\\Unknown",
      ]),
    ).toEqual({ allowed: true, onlyCreator: false });
  });

  it("onlyCreator=true jika permission level only_creator", () => {
    const perms = {
      Model: { 0: { 1: { only_creator: true, permissions: { view: true } } } },
    };
    expect(checkPermission(perms, "Model", "view", 0)).toEqual({
      allowed: true,
      onlyCreator: true,
    });
  });
});
