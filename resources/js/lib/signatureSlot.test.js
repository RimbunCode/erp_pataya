import { describe, it, expect } from "vitest";
import { buildSignatureHtml, EXAMPLE_SIGNATURE } from "./signatureSlot";

/**
 * Markup yang dihasilkan di sini harus identik dengan
 * `PrintTemplateRenderService::buildSignatureHtml()`. Ekspektasi ditulis
 * sebagai string penuh, bukan potongan, supaya perbedaan sekecil atribut
 * atau urutan elemen pun terlihat: berkas PHP-nya memuat test padanan
 * dengan ekspektasi yang sama persis.
 */
describe("buildSignatureHtml", () => {
  const withImage = {
    image: "data:image/png;base64,AAA",
    name: "Budi",
    date: "1 Januari 2026",
    hasSignature: true,
  };

  const withoutImage = {
    image: null,
    name: "Budi",
    date: "1 Januari 2026",
    hasSignature: false,
  };

  it("mengembalikan string kosong untuk data null", () => {
    expect(buildSignatureHtml(null)).toBe("");
  });

  it("merender gambar saja saat tanpa opsi", () => {
    expect(buildSignatureHtml(withImage, { previewAlt: "Pratinjau" })).toBe(
      '<div class="approval-signature">' +
        '<img src="data:image/png;base64,AAA" alt="Pratinjau" style="max-height:80px;display:block;" />' +
        "</div>",
    );
  });

  it("menambahkan nama dan tanggal saat diminta", () => {
    expect(
      buildSignatureHtml(withImage, {
        showName: true,
        showDate: true,
        previewAlt: "Pratinjau",
      }),
    ).toBe(
      '<div class="approval-signature">' +
        '<img src="data:image/png;base64,AAA" alt="Pratinjau" style="max-height:80px;display:block;" />' +
        '<span style="display:block;">Budi</span>' +
        '<span style="display:block;">1 Januari 2026</span>' +
        "</div>",
    );
  });

  it("jatuh ke nama dan tanggal saat penandatangan tidak punya TTD", () => {
    expect(buildSignatureHtml(withoutImage)).toBe(
      '<div class="approval-signature">' +
        '<span style="display:block;">Budi</span>' +
        '<span style="display:block;">1 Januari 2026</span>' +
        "</div>",
    );
  });

  it("fallback tetap memuat nama walau showName tidak diminta", () => {
    // Tanpa gambar, slot kosong tidak memberi tahu siapa yang menyetujui,
    // jadi nama ikut tanpa memandang opsi.
    expect(buildSignatureHtml(withoutImage, { showName: false })).toContain(
      "Budi",
    );
  });

  it("meng-escape karakter HTML pada nama", () => {
    expect(
      buildSignatureHtml({
        image: null,
        name: '<script>alert("x")</script>',
        date: null,
        hasSignature: false,
      }),
    ).toBe(
      '<div class="approval-signature">' +
        '<span style="display:block;">&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;</span>' +
        "</div>",
    );
  });

  it("menyediakan data contoh untuk pratinjau template", () => {
    expect(EXAMPLE_SIGNATURE.hasSignature).toBe(true);
    expect(EXAMPLE_SIGNATURE.image).toMatch(/^data:image\/svg\+xml;base64,/);
  });
});
