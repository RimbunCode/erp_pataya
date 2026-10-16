import { describe, expect, it } from "vitest";
import gjsSignature, {
  buildSignatureExpression,
  parseSignatureExpression,
  SIGNATURE_ROLES,
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
    expect(buildSignatureExpression({ showName: true, showDate: true })).toBe(
      "{{{approvalSignature showName=true showDate=true}}}",
    );
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
      role: "approver",
    });
  });

  it("membaca kedua opsi", () => {
    expect(
      parseSignatureExpression(
        "{{{approvalSignature showName=true showDate=true}}}",
      ),
    ).toEqual({ showName: true, showDate: true, role: "approver" });
  });

  it("tetap membaca ekspresi double-brace dari template lama", () => {
    expect(
      parseSignatureExpression("{{approvalSignature showName=true}}"),
    ).toEqual({ showName: true, showDate: false, role: "approver" });
  });
});

describe("round-trip", () => {
  it.each([
    { showName: false, showDate: false, role: "approver" },
    { showName: true, showDate: false, role: "approver" },
    { showName: false, showDate: true, role: "approver" },
    { showName: true, showDate: true, role: "approver" },
    { showName: false, showDate: false, role: "creator" },
    { showName: true, showDate: false, role: "creator" },
    { showName: true, showDate: true, role: "creator" },
  ])("mempertahankan opsi %o melewati serialisasi", (options) => {
    expect(parseSignatureExpression(buildSignatureExpression(options))).toEqual(
      options,
    );
  });
});

describe("trait role", () => {
  it("memancarkan role hanya untuk creator", () => {
    expect(buildSignatureExpression({ role: "creator", showName: true })).toBe(
      '{{{approvalSignature role="creator" showName=true}}}',
    );
    // approver tidak memancarkan apa pun: markup template lama tidak berubah.
    expect(buildSignatureExpression({ role: "approver", showName: true })).toBe(
      "{{{approvalSignature showName=true}}}",
    );
    expect(buildSignatureExpression({ showName: true })).toBe(
      "{{{approvalSignature showName=true}}}",
    );
  });

  it("markup tanpa role terbaca sebagai approver", () => {
    expect(
      parseSignatureExpression("{{{approvalSignature showName=true}}}").role,
    ).toBe("approver");
  });

  it("role tidak dikenal terbaca sebagai approver", () => {
    expect(
      parseSignatureExpression('{{{approvalSignature role="checker"}}}').role,
    ).toBe("approver");
  });

  it("hanya menawarkan dua pilihan, tanpa 'Approver' sebagai role", () => {
    expect(SIGNATURE_ROLES).toEqual([
      { value: "approver", name: "Disetujui oleh" },
      { value: "creator", name: "Dibuat oleh" },
    ]);
  });
});

describe("plugin gjsSignature", () => {
  const registerPlugin = () => {
    let type;
    const editor = {
      on: () => {},
      Canvas: { getFrameEl: () => null },
      Components: { addType: (name, def) => (type = { name, def }) },
      Blocks: { add: () => {} },
    };
    gjsSignature(editor);
    return type.def;
  };

  const modelWith = (def, attributes) => ({
    getAttributes: () => attributes,
    set: () => {},
    ...def.model,
  });

  it("punya trait role bertipe select dengan default approver", () => {
    const def = registerPlugin();
    const trait = def.model.defaults.traits.find((t) => t.name === "role");

    expect(trait.type).toBe("select");
    expect(trait.default).toBe("approver");
    expect(trait.options.map((o) => o.value)).toEqual(["approver", "creator"]);
    // Tetap tanpa trait sequence (FR8a).
    expect(def.model.defaults.traits.map((t) => t.name)).not.toContain(
      "sequence",
    );
  });

  it("toHTML untuk creator memancarkan role di ekspresi", () => {
    const def = registerPlugin();
    const html = def.model.toHTML.call(
      modelWith(def, { role: "creator", showName: true }),
    );

    expect(html).toContain(
      '{{{approvalSignature role="creator" showName=true}}}',
    );
    expect(html).toContain('data-role="creator"');
  });

  it("toHTML untuk approver tidak mengubah markup lama", () => {
    const def = registerPlugin();
    const html = def.model.toHTML.call(
      modelWith(def, { role: "approver", showName: true }),
    );

    expect(html).toContain("{{{approvalSignature showName=true}}}");
    expect(html).not.toContain("role=");
    expect(html).not.toContain("data-role");
  });

  it("toHTML tanpa role sama dengan approver", () => {
    const def = registerPlugin();
    const html = def.model.toHTML.call(modelWith(def, { showName: true }));

    expect(html).toContain("{{{approvalSignature showName=true}}}");
  });
});
