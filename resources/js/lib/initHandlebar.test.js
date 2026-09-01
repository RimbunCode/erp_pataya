import { describe, it, expect, beforeEach } from "vitest";
import Handlebars from "handlebars";
import { initHandlebar } from "./initHandlebar";

const t = (key) => `TR:${key}`;

const render = (template, data) => Handlebars.compile(template)(data);

beforeEach(() => {
  initHandlebar(t);
});

describe("helper: relation", () => {
  it("memanggil convertTemplateLink pada payload", () => {
    const result = render("{{relation payload}}", {
      payload: { templateLink: "Halo :name", name: "Budi" },
    });
    expect(result).toBe("Halo Budi");
  });
});

describe("helper: trans (legacy)", () => {
  it("menerjemahkan payload string via t()", () => {
    expect(render("{{trans key}}", { key: "core.hello" })).toBe(
      "TR:core.hello",
    );
  });

  it("fallback title -> t(titleTrans) -> name untuk payload object", () => {
    expect(render("{{trans payload}}", { payload: { title: "Judul" } })).toBe(
      "Judul",
    );
    expect(
      render("{{trans payload}}", { payload: { titleTrans: "x.y" } }),
    ).toBe("TR:x.y");
  });

  it("fallback ke name TERGANTUNG t(undefined) falsy (lihat catatan)", () => {
    // CATATAN: trans() di source ini adalah `payload?.title || trans(payload?.titleTrans) || payload?.name`.
    // Fallback ke `name` HANYA tercapai jika trans(undefined) bernilai falsy.
    // Translator asli (laravel-react-i18n .t()) TIDAK terdokumentasi eksplisit
    // untuk key=undefined — jika suatu saat ia mengembalikan string truthy utk
    // undefined (mis. "undefined"), fallback ke `name` tidak akan pernah tercapai
    // di production. Test ini pakai translator palsu yang falsy utk undefined,
    // agar behavior fallback-nya sendiri (bukan translator-nya) yang teruji.
    const tFalsyOnUndefined = (key) =>
      key === undefined ? undefined : `TR:${key}`;
    initHandlebar(tFalsyOnUndefined);
    expect(
      render("{{trans payload}}", { payload: { name: "field_name" } }),
    ).toBe("field_name");
  });
});

describe("helper: formatDate", () => {
  it("format tanggal sesuai token DD/MM/YYYY", () => {
    const result = render('{{formatDate date "DD/MM/YYYY"}}', {
      date: "2026-03-15",
    });
    expect(result).toBe("15/03/2026");
  });

  it("return kosong untuk value null/kosong", () => {
    expect(render('{{formatDate date "DD/MM/YYYY"}}', { date: null })).toBe("");
  });

  it("return pesan error jika format parameter bukan string", () => {
    const result = render("{{formatDate date 123}}", { date: "2026-01-01" });
    expect(result).toContain("[formatDate: format parameter must be a string]");
  });
});

describe("helper: formatCurrency", () => {
  it("format angka dengan simbol currency yang dikenal", () => {
    const result = render('{{formatCurrency amount "IDR"}}', {
      amount: 15000,
    });
    expect(result).toBe("Rp 15.000,00");
  });

  it("pakai kode currency sebagai simbol jika tidak dikenal", () => {
    const result = render('{{formatCurrency amount "XYZ"}}', {
      amount: 1000,
    });
    expect(result).toContain("XYZ");
  });

  it("return kosong untuk value null/kosong", () => {
    expect(render('{{formatCurrency amount "IDR"}}', { amount: null })).toBe(
      "",
    );
  });

  it("return pesan error jika currency parameter kosong", () => {
    const result = render('{{formatCurrency amount ""}}', { amount: 100 });
    expect(result).toContain("[formatCurrency: currency parameter must be");
  });
});

describe("helper: formatNumber", () => {
  it("format angka dengan jumlah desimal tertentu", () => {
    expect(render("{{formatNumber value 2}}", { value: 1234.5 })).toBe(
      "1.234,50",
    );
  });

  it("return pesan error jika decimals bukan integer", () => {
    const result = render("{{formatNumber value decimals}}", {
      value: 100,
      decimals: "abc",
    });
    expect(result).toContain(
      "[formatNumber: decimals parameter must be an integer]",
    );
  });
});

describe("helper: uppercase", () => {
  it("mengubah teks menjadi uppercase", () => {
    expect(render("{{uppercase value}}", { value: "halo" })).toBe("HALO");
  });

  it("return pesan error jika value bukan string", () => {
    const result = render("{{uppercase value}}", { value: 123 });
    expect(result).toContain("[uppercase: value must be a string]");
  });
});

describe("helper aritmatika: multiply/subtract/add/divide", () => {
  it("multiply mengalikan dua nilai", () => {
    expect(render("{{multiply a b}}", { a: 3, b: 4 })).toBe("12");
  });

  it("multiply return 0 untuk nilai non-numeric", () => {
    expect(render("{{multiply a b}}", { a: "x", b: 4 })).toBe("0");
  });

  it("subtract mengurangi nilai kedua dari nilai pertama", () => {
    expect(render("{{subtract a b}}", { a: 10, b: 3 })).toBe("7");
  });

  it("add menjumlahkan dua nilai", () => {
    expect(render("{{add a b}}", { a: 5, b: 7 })).toBe("12");
  });

  it("divide membagi nilai pertama dengan nilai kedua", () => {
    expect(render("{{divide a b}}", { a: 10, b: 4 })).toBe("2.5");
  });

  it("divide return 0 jika pembagi 0", () => {
    expect(render("{{divide a b}}", { a: 10, b: 0 })).toBe("0");
  });
});

describe("helper: label (unified)", () => {
  it("resolve label dari DataTableColumns via resolveLabel", () => {
    const result = render("{{label path}}", {
      path: "doc.customer_name",
      modelDoc: "SalesOrder",
      columns: {
        SalesOrder: {
          customer_name: { title: "Nama Pelanggan" },
        },
      },
    });
    expect(result).toBe("Nama Pelanggan");
  });

  it("return null jika path bukan string", () => {
    const result = render("{{label path}}", { path: 123 });
    expect(result).toBe("");
  });
});
