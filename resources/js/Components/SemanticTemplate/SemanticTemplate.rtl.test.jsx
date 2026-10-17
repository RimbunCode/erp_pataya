import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import fc from "fast-check";

const state = vi.hoisted(() => ({
  allowRead: true,
  allowGlobal: true,
  props: {},
}));

vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({ t: (key) => `TR:${key}` }),
}));

vi.mock("@inertiajs/react", () => ({
  usePage: () => ({ props: state.props }),
}));

vi.mock("@/Hooks/usePermission", () => ({
  default: () => ({
    can: () => state.allowRead,
    canGlobal: () => state.allowGlobal,
  }),
}));

vi.mock("@/Components/Link", () => ({
  default: ({ href, children, ...props }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

import SemanticTemplate from "./SemanticTemplate";

const column = {
  name: "status",
  route: "orders.show",
  primaryKey: "id",
  valueTrans: "orders.statuses",
  badgeColors: { exported: "green" },
};

const renderTemplate = (template, row = {}, extra = {}) =>
  render(
    <SemanticTemplate
      template={template}
      row={row}
      column={column}
      {...extra}
    />,
  );

beforeEach(() => {
  state.allowRead = true;
  state.allowGlobal = true;
  state.props = {};
  window.route = (name, id) => `/${name}/${id}`;
});

describe("escaping nilai (Property 1)", () => {
  it("nilai <img onerror> tampil sebagai teks, tidak ada elemen img", () => {
    const value = "<img src=x onerror=alert(1)>";
    const { container } = renderTemplate("<b>:name</b>", { name: value });

    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("b").textContent).toBe(value);
  });

  it("nilai berisi </stack> dan :other tidak mengubah struktur maupun diekspansi", () => {
    const value = "</stack><u>:other</u>";
    const { container } = renderTemplate("<stack><b>:name</b></stack>", {
      name: value,
      other: "BOOM",
    });

    expect(container.querySelector("u")).toBeNull();
    expect(container.textContent).toBe(value);
    expect(container.querySelectorAll("b")).toHaveLength(1);
  });

  it("nilai sembarang hanya muncul sebagai textContent", () => {
    fc.assert(
      fc.property(fc.string(), (value) => {
        const { container, unmount } = renderTemplate("<b>:name</b>", {
          name: value,
        });
        const elements = [...container.querySelectorAll("*")].map(
          (el) => el.tagName,
        );
        const text = container.querySelector("b").textContent;
        unmount();
        expect(elements).toEqual(["B"]);
        expect(text).toBe(value);
      }),
      { numRuns: 40 },
    );
  });

  it("nilai di atribut tidak bisa menyuntik atribut lain", () => {
    const { container } = renderTemplate('<badge color=":c">x</badge>', {
      c: 'red" onmouseover="alert(1)',
    });

    expect(container.querySelector("[onmouseover]")).toBeNull();
    expect(container.textContent).toBe("x");
  });
});

describe("sanitasi allowlist", () => {
  it("membuang script, on*, href, style; mempertahankan teks", () => {
    const { container } = renderTemplate(
      '<span onclick="x()" style="color:red" href="/a" class="font-bold">ok</span><script>alert(1)</script>',
    );
    const span = container.querySelector("span");

    expect(container.querySelector("script")).toBeNull();
    expect(span.getAttribute("class")).toBe("font-bold");
    expect(span.hasAttribute("onclick")).toBe(false);
    expect(span.hasAttribute("style")).toBe(false);
    expect(span.hasAttribute("href")).toBe(false);
    expect(container.textContent).toBe("ok");
  });

  it("tag di luar allowlist dibuang, isi teks dipertahankan", () => {
    const { container } = renderTemplate(
      '<a href="javascript:alert(1)">klik</a><font>teks</font>',
    );

    expect(container.querySelector("a,font")).toBeNull();
    expect(container.textContent).toBe("klikteks");
  });

  it("<title> dibuang di context cell", () => {
    const { container } = renderTemplate("<title>JUDUL</title><b>:code</b>", {
      code: "SO-1",
    });

    expect(container.textContent).toBe("SO-1");
  });

  it("HTML dasar dirender (span, div, p, br, i, em, small, u, strong)", () => {
    const { container } = renderTemplate(
      "<div><p>a</p><i>b</i><em>c</em><small>d</small><u>e</u><strong>f</strong><br/><span>g</span></div>",
    );

    for (const tag of [
      "div",
      "p",
      "i",
      "em",
      "small",
      "u",
      "strong",
      "br",
      "span",
    ]) {
      expect(container.querySelector(tag)).not.toBeNull();
    }
    expect(container.textContent).toBe("abcdefg");
  });
});

describe("placeholder", () => {
  it("null/tak ada dirender kosong, bukan token mentah", () => {
    const { container } = renderTemplate("<b>[:a_x][:b_x.c_x]</b>", {
      a_x: null,
    });

    expect(container.textContent).toBe("[][]");
  });

  it("formatter dan ternary", () => {
    state.props = { preferences: { default_number_format: "#.###,##" } };
    const { container } = renderTemplate(
      "<b>:amount|number</b> <i>:flag ? :yes_v | :no_v</i>",
      { amount: 1234.5, flag: 0, yes_v: "Y", no_v: "N" },
    );

    expect(container.querySelector("b").textContent).toBe("1.234,50");
    expect(container.querySelector("i").textContent).toBe("N");
  });

  it("|trans memakai valueTrans kolom", () => {
    const { container } = renderTemplate("<b>:status|trans</b>", {
      status: "draft",
    });

    expect(container.textContent).toBe("TR:orders.statuses.draft");
  });
});

describe("tag semantik", () => {
  it("muted, stack, inline", () => {
    const { container } = renderTemplate(
      "<stack><muted>a</muted><inline><b>b</b><b>c</b></inline></stack>",
    );

    expect(screen.getByText("a")).toHaveClass("text-muted-foreground");
    expect(container.querySelector("div")).toHaveClass("flex-col");
    expect(container.querySelectorAll("div")[1]).toHaveClass("flex-row");
  });

  it("badge memakai atribut color, lalu peta badgeColors, lalu fallback secondary", () => {
    renderTemplate(
      '<badge color="red">R</badge><badge>M</badge><badge color="zzz">Z</badge>',
      { status: "exported" },
    );

    expect(screen.getByText("R").className).toMatch(/bg-red-100/);
    expect(screen.getByText("M").className).toMatch(/bg-green-100/);
    expect(screen.getByText("Z").className).toMatch(/bg-secondary/);
  });

  it("status memakai BadgeStatus", () => {
    renderTemplate("<status>:status</status>", { status: "draft" });

    expect(screen.getByText("TR:status.draft")).toBeInTheDocument();
  });

  it("dot berwarna", () => {
    const { container } = renderTemplate('<dot color="red">label</dot>');

    expect(container.querySelector('[data-slot="dot"]')).toHaveClass(
      "bg-red-500",
    );
    expect(container.textContent).toBe("label");
  });

  it("truncate memotong satu baris", () => {
    renderTemplate("<truncate>teks panjang sekali</truncate>");

    expect(screen.getByText("teks panjang sekali")).toHaveClass("truncate");
  });

  it("progress mengisi value dari placeholder atribut", () => {
    renderTemplate('<progress value=":pp" shape="bar"></progress>', {
      pp: 45.25,
    });

    expect(screen.getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "45.25",
    );
  });

  it("progress self-closing dinormalkan dan tidak menelan sibling", () => {
    const { container } = renderTemplate('<progress value="10"/><b>after</b>');

    expect(screen.getByRole("progressbar")).toBeInTheDocument();
    expect(container.querySelector("b").textContent).toBe("after");
  });

  it("icon dari nama lucide; nama tak dikenal tidak dirender", () => {
    const { container } = renderTemplate(
      '<icon name="truck"/><icon name="zzz-unknown"/>',
    );

    expect(container.querySelectorAll("svg")).toHaveLength(1);
    expect(container.querySelector('[data-icon="truck"]')).not.toBeNull();
  });

  it("avatar menampilkan inisial", () => {
    renderTemplate('<avatar name=":nm"></avatar>', { nm: "Budi Santoso" });

    expect(screen.getByText("BS")).toBeInTheDocument();
  });

  it("when merender anak hanya bila field terisi", () => {
    const template = '<when field="note"><b>ADA</b></when>';
    const filled = renderTemplate(template, { note: "x" });
    expect(filled.container.textContent).toBe("ADA");
    filled.unmount();

    const empty = renderTemplate(template, { note: "" });
    expect(empty.container.textContent).toBe("");
    empty.unmount();

    const emptyList = renderTemplate(template, { note: [] });
    expect(emptyList.container.textContent).toBe("");
  });

  it("mark menyorot dengan bg-yellow-500", () => {
    renderTemplate("<mark>penting</mark>");

    expect(screen.getByText("penting")).toHaveClass("bg-yellow-500");
  });
});

describe("<nav-link>", () => {
  const row = {
    id: 7,
    created_by_id: 1,
    customer: { id: 5, thisModel: "Customer", route: "customers" },
  };

  it("tanpa `to` menautkan ke record baris", () => {
    renderTemplate("<nav-link><b>SO-7</b></nav-link>", row);

    expect(screen.getByRole("link")).toHaveAttribute("href", "/orders.show/7");
    expect(screen.getByRole("link")).toContainElement(screen.getByText("SO-7"));
  });

  it("to=rel menautkan ke record relasi", () => {
    renderTemplate('<nav-link to="customer"><b>Budi</b></nav-link>', row);

    expect(screen.getByRole("link")).toHaveAttribute(
      "href",
      "/customers.show/5",
    );
  });

  it("tanpa izin: isi dirender tanpa <a>", () => {
    state.allowRead = false;
    state.allowGlobal = false;
    const { container } = renderTemplate(
      '<nav-link><b>A</b></nav-link><nav-link to="customer"><b>B</b></nav-link>',
      row,
    );

    expect(screen.queryByRole("link")).toBeNull();
    expect(container.textContent).toBe("AB");
  });

  it("tanpa route: isi dirender tanpa <a>", () => {
    render(
      <SemanticTemplate
        template="<nav-link><b>A</b></nav-link>"
        row={row}
        column={{ name: "x" }}
      />,
    );

    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByText("A")).toBeInTheDocument();
  });

  it("relasi kosong: tanpa <a>", () => {
    renderTemplate('<nav-link to="customer"><b>B</b></nav-link>', {
      ...row,
      customer: null,
    });

    expect(screen.queryByRole("link")).toBeNull();
  });

  it("nav-link bersarang dan chips di dalam nav-link tanpa <a> dalam", () => {
    const { container } = renderTemplate(
      '<nav-link><nav-link to="customer">dalam</nav-link><chips of="items"></chips></nav-link>',
      {
        ...row,
        items: [{ id: 1, templateLink: ":code", code: "I-1", thisModel: "I" }],
      },
    );

    expect(container.querySelectorAll("a")).toHaveLength(1);
    expect(container.querySelector("a a")).toBeNull();
    expect(container.textContent).toContain("dalam");
    expect(container.textContent).toContain("I-1");
  });
});

describe("<nav-link> di luar konteks kolom (row.route) dan context option", () => {
  const row = {
    id: 7,
    route: "salesOrders",
    created_by_id: 1,
    items: [{ id: 1, thisModel: "I", templateLink: ":code", code: "I-1" }],
  };
  const noColumn = (template, extra = {}) =>
    render(
      <SemanticTemplate template={template} row={row} {...extra} />,
    );

  it("tanpa column: fallback ke row.route + '.show' dan id (kartu mobile)", () => {
    noColumn("<nav-link><b>SO-7</b></nav-link>", { context: "mobile" });

    expect(screen.getByRole("link")).toHaveAttribute(
      "href",
      "/salesOrders.show/7",
    );
  });

  it("column.route tetap menang atas row.route", () => {
    render(
      <SemanticTemplate
        template="<nav-link><b>SO-7</b></nav-link>"
        row={row}
        column={{ name: "x", route: "orders.show", primaryKey: "id" }}
      />,
    );

    expect(screen.getByRole("link")).toHaveAttribute("href", "/orders.show/7");
  });

  it("tanpa izin baca: tanpa <a> walau row.route ada", () => {
    state.allowRead = false;
    noColumn("<nav-link><b>SO-7</b></nav-link>", { context: "mobile" });

    expect(screen.queryByRole("link")).toBeNull();
  });

  it("tanpa column.route dan tanpa row.route: tanpa <a>", () => {
    render(
      <SemanticTemplate
        template="<nav-link><b>SO-7</b></nav-link>"
        row={{ id: 7 }}
        context="mobile"
      />,
    );

    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByText("SO-7")).toBeInTheDocument();
  });

  it("context option: <nav-link> dan <chips> TIDAK menjadi <a> (klik opsi = memilih)", () => {
    const { container } = noColumn(
      '<nav-link><b>SO-7</b></nav-link><nav-link to="items.0"><i>ke-item</i></nav-link><chips of="items"></chips>',
      { context: "option" },
    );

    expect(container.querySelector("a")).toBeNull();
    expect(container.textContent).toContain("SO-7");
    expect(container.textContent).toContain("ke-item");
    expect(container.textContent).toContain("I-1");
  });

  it("context cell/chip lain tetap menghasilkan tautan", () => {
    const { container } = noColumn("<nav-link><b>SO-7</b></nav-link>", {
      context: "chip",
    });

    expect(container.querySelectorAll("a")).toHaveLength(1);
  });
});

describe("sorotan pencarian (Property 6)", () => {
  const template =
    "<stack><strong>:code</strong><muted>:name</muted><badge>:tag</badge></stack>";

  it("membungkus kata cocok dengan <mark> di dalam tag semantik", () => {
    const { container } = renderTemplate(
      template,
      { code: "SO-ABC", name: "Budi Abc", tag: "abc" },
      { search: "abc" },
    );

    const marks = container.querySelectorAll("mark");
    expect(marks).toHaveLength(3);
    for (const mark of marks) {
      expect(mark).toHaveClass("bg-yellow-500");
      expect(mark.textContent.toLowerCase()).toBe("abc");
    }
    expect(container.querySelector("strong mark")).not.toBeNull();
    expect(container.querySelector("strong").tagName).toBe("STRONG");
  });

  it("textContent sama dengan atau tanpa search; jumlah <mark> = kemunculan kata", () => {
    const word = fc.stringMatching(/^[a-c]{1,3}$/);
    const text = fc.stringMatching(/^[a-c ]{0,12}$/);

    fc.assert(
      fc.property(text, text, text, word, (code, name, tag, search) => {
        const row = { code, name, tag };
        const plain = renderTemplate(template, row);
        const plainText = plain.container.textContent;
        plain.unmount();

        const highlighted = renderTemplate(template, row, { search });
        const highlightedText = highlighted.container.textContent;
        const markCount = highlighted.container.querySelectorAll("mark").length;
        highlighted.unmount();

        const regex = new RegExp(search, "gi");
        const expected = [code, name, tag].reduce(
          (sum, value) => sum + (value.match(regex)?.length ?? 0),
          0,
        );

        expect(highlightedText).toBe(plainText);
        expect(markCount).toBe(expected);
      }),
      { numRuns: 40 },
    );
  });

  it("isi <mark> template tidak disorot ulang (tanpa mark bersarang)", () => {
    const { container } = renderTemplate(
      "<mark>abc</mark>",
      {},
      {
        search: "abc",
      },
    );

    expect(container.querySelector("mark mark")).toBeNull();
    expect(container.textContent).toBe("abc");
  });
});
