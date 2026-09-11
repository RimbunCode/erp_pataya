import { describe, it, expect } from "vitest";
import { validate, convertTemplateLink } from "./linkModelUtils";

describe("validate", () => {
  it("true jika thisModel cocok dengan model", () => {
    expect(validate({ thisModel: "User" }, "User")).toBe(true);
  });

  it("false jika thisModel tidak cocok", () => {
    expect(validate({ thisModel: "User" }, "Role")).toBe(false);
  });

  it("true (skip validasi) jika value atau model falsy", () => {
    expect(validate(null, "User")).toBe(true);
    expect(validate({ thisModel: "User" }, null)).toBe(true);
  });
});

describe("convertTemplateLink", () => {
  it("return string kosong jika value falsy", () => {
    expect(convertTemplateLink(null)).toBe("");
    expect(convertTemplateLink(undefined)).toBe("");
  });

  it("mengekstrak plain text sebelum tag pertama (pola: teks lalu tag)", () => {
    // Pola nyata templateLink di codebase (mis. User::templateLink() -> ':name')
    // umumnya diawali placeholder/teks, bukan langsung tag HTML.
    const value = {
      templateLink: "Hello World<br>",
    };
    expect(convertTemplateLink(value)).toBe("Hello World");
  });

  it("mengutamakan konten <title> jika ada", () => {
    const value = {
      templateLink: "<title>My Title</title><p>Body text</p>",
    };
    expect(convertTemplateLink(value)).toBe("My Title");
  });

  it("return string kosong jika templateLink diawali tag tanpa <title>", () => {
    // ^[^<]+ tidak match jika karakter pertama sudah '<' — bukan bug, regex
    // ini didesain menangkap teks SEBELUM tag pertama, bukan strip semua tag.
    const value = {
      templateLink: "<p>Hello World</p>",
    };
    expect(convertTemplateLink(value)).toBe("");
  });

  it("mengganti placeholder :field dengan nilai dari value", () => {
    const value = {
      templateLink: "Halo :name",
      name: "Budi",
    };
    expect(convertTemplateLink(value)).toBe("Halo Budi");
  });

  it("hasil plain text (bukan asObject, tanpa search) di-unescape kembali ke karakter asli", () => {
    // Branch ini dipakai sbg plain text (value input search, sorting, diff) -- bukan
    // lewat dangerouslySetInnerHTML -- jadi harus keluar sbg teks asli, bukan entity HTML.
    // Regresi: "Seals & Gaskets" pernah tampil literal sbg "Seals &amp; Gaskets".
    const value = {
      templateLink: ":name",
      name: "Seals & Gaskets",
    };
    expect(convertTemplateLink(value)).toBe("Seals & Gaskets");
  });

  it("resolve nested object, escape saat substitusi lalu unescape balik di output plain text", () => {
    const value = {
      templateLink: ":customer",
      customer: { name: "<script>alert(1)</script>" },
    };
    // Escaping tetap terjadi saat substitusi ke template HTML (mencegah tag asing
    // menembus struktur template), tapi hasil akhir plain text dikembalikan ke teks asli.
    expect(convertTemplateLink(value)).toBe("<script>alert(1)</script>");
  });

  it("highlight kata pencarian dengan <mark> saat search diberikan", () => {
    const value = {
      templateLink: "Halo Budi",
    };
    const result = convertTemplateLink(value, "Budi");
    expect(result).toContain('<mark class="bg-yellow-500">Budi</mark>');
  });

  it("tidak highlight teks di dalam tag HTML", () => {
    const value = {
      templateLink: '<p class="Budi">Halo Budi</p>',
    };
    const result = convertTemplateLink(value, "Budi");
    // class="Budi" di attribute tidak boleh ikut ter-wrap <mark>
    expect(result).toContain('class="Budi"');
    expect(result).toContain('<mark class="bg-yellow-500">Budi</mark>');
  });

  it("asObject=true tidak strip ke plain text meski search kosong", () => {
    // Semua caller di codebase memberi search="" (bukan null/undefined) saat
    // asObject=true — lihat LinkModel.jsx, InputBarcode.jsx.
    const value = {
      templateLink: "<title>My Title</title><p>Body</p>",
    };
    const result = convertTemplateLink(value, "", true);
    expect(result).not.toContain("<title>");
    expect(result).toContain("Body");
  });
});
