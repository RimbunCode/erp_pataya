import { describe, expect, it } from "vitest";
import fc from "fast-check";
import {
  BASIC_TAGS,
  FORMATTERS,
  PLACEHOLDER_RE,
  SEMANTIC_TAGS,
  fillAttrs,
  fillPlaceholders,
  formatValue,
  normalizeSelfClosing,
  prepareTemplate,
  sanitizeWithoutDom,
  stripTitle,
  templateToText,
} from "./templateEngine";

// Environment "unit" = node. Sanitizer allowlist tidak memakai DOM (browser = SSR).

const NON_VOID_TAGS = [...SEMANTIC_TAGS, ...BASIC_TAGS].filter(
  (tag) => tag !== "br",
);

describe("konstanta", () => {
  it("SEMANTIC_TAGS memuat 14 tag dan nav-link (bukan link)", () => {
    expect(SEMANTIC_TAGS).toHaveLength(14);
    expect(SEMANTIC_TAGS).toContain("nav-link");
    expect(SEMANTIC_TAGS).not.toContain("link");
  });

  it("PLACEHOLDER_RE menangkap path, alias, dan formatter", () => {
    const found = [
      ..."x :code :rel.sub.name :name{:alias} :at|datetime".matchAll(
        PLACEHOLDER_RE,
      ),
    ].map((m) => m[0]);
    expect(found).toEqual([
      ":code",
      ":rel.sub.name",
      ":name{:alias}",
      ":at|datetime",
    ]);
  });
});

describe("normalizeSelfClosing (Property 8)", () => {
  it("mengubah self-closing tag non-void menjadi pasangan buka/tutup", () => {
    expect(normalizeSelfClosing('<icon name="truck"/>')).toBe(
      '<icon name="truck"></icon>',
    );
    expect(normalizeSelfClosing('<progress value=":p" shape="bar" />')).toBe(
      '<progress value=":p" shape="bar"></progress>',
    );
    expect(normalizeSelfClosing("<nav-link/>")).toBe("<nav-link></nav-link>");
  });

  it("tidak menyentuh tag void <br/> dan tag berpasangan", () => {
    expect(normalizeSelfClosing("<br/>")).toBe("<br/>");
    expect(normalizeSelfClosing("<b>x</b><br/>")).toBe("<b>x</b><br/>");
  });

  it("menghormati '/>' di dalam nilai atribut", () => {
    expect(normalizeSelfClosing('<icon name="a/>b"/>')).toBe(
      '<icon name="a/>b"></icon>',
    );
  });

  it("idempoten dan <x a=1/> setara <x a=1></x> untuk setiap tag", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...NON_VOID_TAGS),
        fc.array(
          fc.tuple(
            fc.constantFrom("class", "color", "to", "of", "max", "name"),
            fc.stringMatching(/^[a-z0-9 :.]{0,8}$/),
          ),
          { maxLength: 3 },
        ),
        (tag, attrs) => {
          const attrStr = attrs.map(([k, v]) => ` ${k}="${v}"`).join("");
          const selfClosing = `<${tag}${attrStr}/>`;
          const once = normalizeSelfClosing(selfClosing);
          expect(once).toBe(`<${tag}${attrStr}></${tag}>`);
          expect(normalizeSelfClosing(once)).toBe(once);
        },
      ),
    );
  });
});

describe("<title> (Property 7)", () => {
  it("stripTitle membuang tag beserta isinya", () => {
    expect(stripTitle("<title>A</title><b>B</b>")).toBe("<b>B</b>");
    expect(stripTitle('<TITLE x="1">A\nB</TITLE>x')).toBe("x");
  });

  it("context selain selected membuang teks <title>", () => {
    fc.assert(
      fc.property(
        fc.constantFrom("cell", "option", "chip", "mobile"),
        fc.stringMatching(/^[A-Za-z0-9]{3,12}$/),
        (context, marker) => {
          const html = prepareTemplate(
            `<title>TTL${marker}</title><b>:code</b>`,
            { code: "x" },
            { context },
          );
          expect(html).not.toContain(`TTL${marker}`);
          expect(html).not.toContain("<title");
          expect(html).toContain("<b>:code</b>");
        },
      ),
    );
  });

  it("context selected mempertahankan <title>", () => {
    const html = prepareTemplate(
      "<title>Judul</title><b>:code</b>",
      {},
      { context: "selected" },
    );
    expect(html).toContain("<title>Judul</title>");
  });
});

describe("prepareTemplate", () => {
  it("template kosong menghasilkan string kosong", () => {
    expect(prepareTemplate("", {}, { context: "cell" })).toBe("");
    expect(prepareTemplate(null, {}, { context: "cell" })).toBe("");
  });

  it("menyelesaikan ternary dengan data baris, placeholder tetap utuh", () => {
    const template = "<b>:asset_id ? :asset.name | :item.name</b>";
    expect(prepareTemplate(template, { asset_id: 1 }, {})).toBe(
      "<b>:asset.name</b>",
    );
    expect(prepareTemplate(template, { asset_id: null }, {})).toBe(
      "<b>:item.name</b>",
    );
  });

  it("menormalkan self-closing sebelum sanitasi", () => {
    expect(prepareTemplate('<icon name="truck"/>', {}, {})).toBe(
      '<icon name="truck"></icon>',
    );
  });
});

describe("sanitizeWithoutDom (allowlist)", () => {
  it("membuang script beserta isinya", () => {
    expect(sanitizeWithoutDom("<b>a</b><script>alert(1)</script>")).toBe(
      "<b>a</b>",
    );
  });

  it("membuang atribut on*, href, style; mempertahankan allowlist", () => {
    const out = sanitizeWithoutDom(
      '<span class="x" onclick="evil()" style="color:red" href="/a" to="rel">t</span>',
    );
    expect(out).toBe('<span class="x" to="rel">t</span>');
  });

  it("membuang tag di luar allowlist tetapi menjaga teksnya", () => {
    expect(sanitizeWithoutDom("<iframe src='x'></iframe><u>a</u>")).toBe(
      "<u>a</u>",
    );
    expect(sanitizeWithoutDom("<font>teks</font>")).toBe("teks");
  });

  it("membuang src berskema javascript:", () => {
    expect(
      sanitizeWithoutDom('<avatar src="javascript:alert(1)">x</avatar>'),
    ).toBe("<avatar>x</avatar>");
  });

  it("mempertahankan tag semantik dan nav-link", () => {
    const html =
      '<stack><nav-link to="customer"><badge color="red">:s</badge></nav-link></stack>';
    expect(sanitizeWithoutDom(html)).toBe(html);
  });

  it("meng-escape '<' liar", () => {
    expect(sanitizeWithoutDom("1 < 2 and <b>x</b>")).toBe(
      "1 &lt; 2 and <b>x</b>",
    );
  });
});

describe("fillPlaceholders", () => {
  it("nilai null/undefined/tak ada menjadi string kosong", () => {
    expect(
      fillPlaceholders("[:aa][:bb][:cc.dd]", { aa: null, bb: undefined }),
    ).toBe("[][][]");
  });

  it("path bertingkat dan alias :name{:alias}", () => {
    const row = { rel: { sub: { name: "Deep" } }, alias: "Al" };
    expect(fillPlaceholders(":rel.sub.name / :name{:alias}", row)).toBe(
      "Deep / Al",
    );
  });

  it("titik di akhir kalimat bukan bagian path", () => {
    expect(fillPlaceholders("Halo :name.", { name: "Budi" })).toBe(
      "Halo Budi.",
    );
  });

  it("nilai tidak diekspansi ulang (Property 2)", () => {
    fc.assert(
      fc.property(fc.string(), fc.string(), (a, b) => {
        const row = { aa: a, bb: b, other: "EXPANDED" };
        expect(fillPlaceholders(":aa", row)).toBe(a);
        expect(fillPlaceholders(":aa-:bb", row)).toBe(`${a}-${b}`);
      }),
    );
  });

  it("nilai berisi ':other' atau HTML tetap literal", () => {
    const row = { aa: ":other <img onerror=x> </stack>", other: "X" };
    expect(fillPlaceholders("<b>:aa</b>", row)).toBe(
      "<b>:other <img onerror=x> </stack></b>",
    );
  });

  it("objek relasi memakai templateLink terlihat, atau string pertama", () => {
    const row = {
      customer: {
        templateLink: "<b>:code</b><br/>:name",
        code: "C1",
        name: "N",
      },
      plain: { id: 3, label: "L" },
      list: [{ name: "a" }, { name: "b" }],
    };
    expect(fillPlaceholders(":customer", row)).toBe("C1 N");
    expect(fillPlaceholders(":plain", row)).toBe("3");
  });

  it("formatter tak dikenal menampilkan nilai mentah", () => {
    expect(fillPlaceholders(":xx|foo", { xx: "raw" })).toBe("raw");
  });

  it("formatter diterapkan lewat ctx", () => {
    const out = fillPlaceholders(
      ":status|trans",
      { status: "draft" },
      { valueTrans: "po.status" },
      { t: (key) => `T(${key})` },
    );
    expect(out).toBe("T(po.status.draft)");
  });

  it("fillAttrs mengisi placeholder pada nilai atribut", () => {
    expect(
      fillAttrs({ value: ":pp", class: "x", to: "rel" }, { pp: 45.5 }),
    ).toEqual({ value: "45.5", class: "x", to: "rel" });
  });
});

describe("formatValue", () => {
  const PREF_ID = { default_number_format: "#.###,##" };

  it("daftar formatter lengkap", () => {
    expect(FORMATTERS).toEqual([
      "date",
      "datetime",
      "relative",
      "number",
      "currency",
      "percent",
      "trans",
    ]);
  });

  it("null/undefined/'' -> '' untuk semua formatter", () => {
    for (const f of [...FORMATTERS, undefined, "foo"]) {
      expect(formatValue(null, f, {})).toBe("");
      expect(formatValue(undefined, f, {})).toBe("");
      expect(formatValue("", f, {})).toBe("");
    }
  });

  it("date mengikuti locale", () => {
    const value = "2026-10-17T12:00:00";
    expect(formatValue(value, "date", { lang: "id" })).toBe("17 Oktober 2026");
    expect(formatValue(value, "date", { lang: "en" })).toBe(
      "October 17th, 2026",
    );
  });

  it("datetime memuat tanggal dan jam, mengikuti locale", () => {
    const value = "2026-10-17T12:34:56";
    expect(formatValue(value, "datetime", { lang: "id" })).toMatch(
      /^17 Oktober 2026.*12\.34/,
    );
    expect(formatValue(value, "datetime", { lang: "en" })).toMatch(
      /^October 17th, 2026.*12:34/,
    );
  });

  it("tanggal tidak valid dikembalikan mentah", () => {
    expect(formatValue("bukan-tanggal", "date", { lang: "id" })).toBe(
      "bukan-tanggal",
    );
    expect(formatValue("bukan-tanggal", "relative", { lang: "id" })).toBe(
      "bukan-tanggal",
    );
  });

  it("relative memakai locale dan akhiran lalu/ago", () => {
    const now = new Date("2026-10-17T14:00:00");
    const value = "2026-10-17T12:00:00";
    expect(formatValue(value, "relative", { lang: "id", now })).toMatch(
      /2 jam.*lalu/,
    );
    expect(formatValue(value, "relative", { lang: "en", now })).toMatch(
      /2 hours ago/,
    );
  });

  it("number mengikuti default_number_format preferensi", () => {
    expect(formatValue(1234567.891, "number", { preferences: PREF_ID })).toBe(
      "1.234.567,89",
    );
    expect(
      formatValue("1234567.5", "number", {
        preferences: { default_number_format: "#,###.##" },
      }),
    ).toBe("1,234,567.50");
  });

  it("number: decimalScale kolom dipakai, non-angka mentah", () => {
    expect(formatValue(1.005, "number", { column: { decimalScale: 2 } })).toBe(
      "1.01",
    );
    expect(formatValue("abc", "number", {})).toBe("abc");
  });

  it("currency memakai simbol dari row.currency atau column.currencyCode", () => {
    expect(
      formatValue(1500, "currency", {
        preferences: PREF_ID,
        row: { currency: { symbol: "Rp" } },
      }),
    ).toBe("Rp 1.500,00");
    expect(
      formatValue(1500, "currency", {
        preferences: PREF_ID,
        row: { currency: { symbol: "Rp" } },
        column: { currencyCode: { symbol: "$" } },
      }),
    ).toBe("$ 1.500,00");
    expect(formatValue(1500, "currency", { preferences: PREF_ID })).toBe(
      "1.500,00",
    );
  });

  it("percent menambah akhiran %", () => {
    expect(formatValue(45.25, "percent", { preferences: PREF_ID })).toBe(
      "45,25%",
    );
    expect(formatValue("100", "percent", {})).toBe("100%");
  });

  it("trans memakai valueTrans kolom dan fungsi t", () => {
    const t = (key) => `T(${key})`;
    expect(
      formatValue("draft", "trans", { t, column: { valueTrans: "a.b" } }),
    ).toBe("T(a.b.draft)");
    expect(formatValue("draft", "trans", { t })).toBe("draft");
    expect(
      formatValue("draft", "trans", { column: { valueTrans: "a.b" } }),
    ).toBe("draft");
  });

  it("tanpa formatter nilai menjadi string", () => {
    expect(formatValue(12, undefined, {})).toBe("12");
  });
});

describe("templateToText", () => {
  it("teks terlihat: tanpa tag, tanpa <title>, tanpa nama tag", () => {
    const row = { code: "SO-1", name: "Budi" };
    const text = templateToText(
      "<title>JUDUL</title><b>:code</b><br/><span>:name</span>",
      row,
    );
    expect(text).toBe("SO-1 Budi");
    expect(text).not.toMatch(/span|JUDUL/i);
  });

  it("menyelesaikan ternary dan mengisi null sebagai kosong", () => {
    expect(templateToText(":aa ? :xx | :yy", { aa: 0, xx: "X", yy: "Y" })).toBe(
      "Y",
    );
    expect(templateToText("<b>:missing</b> ok", {})).toBe("ok");
  });

  it("nilai berisi '<' tidak dianggap tag", () => {
    expect(templateToText("<b>:vv</b>", { vv: "1 < 2 > 0" })).toBe("1 < 2 > 0");
  });

  it("decode entity template", () => {
    expect(templateToText("a &amp; b", {})).toBe("a & b");
  });

  it("template kosong menghasilkan ''", () => {
    expect(templateToText(null, {})).toBe("");
  });
});
