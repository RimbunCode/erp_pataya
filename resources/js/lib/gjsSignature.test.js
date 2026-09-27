import { describe, expect, it } from "vitest";
import {
  buildSignatureExpression,
  parseSignatureExpression,
} from "./gjsSignature";

describe("buildSignatureExpression", () => {
  it("menghasilkan triple-brace tanpa opsi", () => {
    // Triple-brace, bukan double: lightncandy di server meng-escape
    // keluaran helper pada double-brace, sehingga markup tanda tangan
    // keluar sebagai teks mentah di PDF.
    expect(buildSignatureExpression()).toBe("{{{approvalSignature}}}");
  });

  it("menyertakan showName saat diaktifkan", () => {
    expect(buildSignatureExpression({ showName: true })).toBe(
      "{{{approvalSignature showName=true}}}",
    );
  });

  it("menyertakan kedua opsi dalam urutan tetap", () => {
    expect(
      buildSignatureExpression({ showName: true, showDate: true }),
    ).toBe("{{{approvalSignature showName=true showDate=true}}}");
  });

  it("memperlakukan string 'true' sama dengan boolean true", () => {
    // Trait GrapesJS memberi boolean, tetapi atribut yang dibaca kembali
    // dari markup tersimpan berupa string. Keduanya harus sama artinya.
    expect(buildSignatureExpression({ showDate: "true" })).toBe(
      "{{{approvalSignature showDate=true}}}",
    );
  });

  it("mengabaikan nilai falsy dalam bentuk apa pun", () => {
    expect(
      buildSignatureExpression({
        showName: false,
        showDate: "false",
      }),
    ).toBe("{{{approvalSignature}}}");
  });
});

describe("parseSignatureExpression", () => {
  it("mengembalikan null untuk masukan bukan ekspresi", () => {
    expect(parseSignatureExpression("halo")).toBeNull();
    expect(parseSignatureExpression(null)).toBeNull();
    expect(parseSignatureExpression(undefined)).toBeNull();
  });

  it("membaca ekspresi tanpa opsi", () => {
    expect(parseSignatureExpression("{{{approvalSignature}}}")).toEqual({
      showName: false,
      showDate: false,
    });
  });

  it("membaca kedua opsi", () => {
    expect(
      parseSignatureExpression(
        "{{{approvalSignature showName=true showDate=true}}}",
      ),
    ).toEqual({ showName: true, showDate: true });
  });

  it("tetap membaca ekspresi double-brace dari template lama", () => {
    expect(
      parseSignatureExpression("{{approvalSignature showName=true}}"),
    ).toEqual({ showName: true, showDate: false });
  });
});

describe("round-trip", () => {
  it.each([
    { showName: false, showDate: false },
    { showName: true, showDate: false },
    { showName: false, showDate: true },
    { showName: true, showDate: true },
  ])("mempertahankan opsi %o melewati serialisasi", (options) => {
    expect(parseSignatureExpression(buildSignatureExpression(options))).toEqual(
      options,
    );
  });
});
