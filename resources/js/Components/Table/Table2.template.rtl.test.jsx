import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Integrasi Cell (Table2) <-> renderer bersama SemanticTemplate (spec
// datatable-semantic-templates 10.1/10.6): kolom ber-template, relations,
// progress, isLink + template, dan kolom lama yang TIDAK boleh berubah.

vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({ t: (key) => `TR:${key}` }),
}));

vi.mock("@inertiajs/react", () => ({
  router: { get: vi.fn(), reload: vi.fn() },
  usePage: () => ({ props: {}, url: "/test" }),
}));

vi.mock("axios", () => ({ default: { get: vi.fn() } }));

vi.mock("@/Hooks/usePermission", () => ({
  default: () => ({ can: () => true, canGlobal: () => true }),
}));

vi.mock("@/Components/Link", () => ({
  default: ({ href, children, ...props }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("./Header", () => ({
  default: ({ title, id }) => <th data-testid={`header-${id}`}>{title}</th>,
}));

import Table2, { isRelationsChipColumn } from "./Table2";

const renderTable = (columns, data) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <Table2 columns={columns} data={data} />
    </QueryClientProvider>,
  );

beforeEach(() => {
  window.route = (name, id) => `/${name}/${id}`;
  // Table2 menyimpan visibilitas kolom di cookie (per path) -- bersihkan agar
  // kolom test sebelumnya tidak menyembunyikan kolom test berikutnya.
  document.cookie.split(";").forEach((cookie) => {
    const name = cookie.split("=")[0].trim();
    if (name) {
      document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
    }
  });
});

describe("Cell - kolom ber-template", () => {
  const rows = [{ id: 1, title: "Judul A", sub: "Sub A", total: 1500 }];

  it("merender template lewat renderer bersama dengan tag semantik", () => {
    const { container } = renderTable(
      {
        title: {
          name: "title",
          title: "Title",
          type: "string",
          template: "<stack><strong>:title</strong><muted>:sub</muted></stack>",
        },
      },
      rows,
    );

    expect(screen.getByText("Judul A").tagName).toBe("STRONG");
    expect(screen.getByText("Sub A")).toHaveClass("text-muted-foreground");
    expect(container.querySelector(".flex-col")).not.toBeNull();
  });

  it("template menggantikan render per-type (number -> isi template)", () => {
    renderTable(
      {
        total: {
          name: "total",
          title: "Total",
          type: "number",
          template: "<b>Rp :total</b>",
        },
      },
      rows,
    );

    expect(screen.getByText("Rp 1500").tagName).toBe("B");
  });

  it("nilai kosong dirender kosong, bukan token mentah", () => {
    renderTable(
      {
        title: {
          name: "title",
          title: "Title",
          type: "string",
          template: "<b>[:nothing]</b>",
        },
      },
      rows,
    );

    expect(screen.getByText("[]")).toBeInTheDocument();
  });

  it("nilai berisi HTML tidak pernah menjadi elemen (escaping)", () => {
    const { container } = renderTable(
      {
        title: {
          name: "title",
          title: "Title",
          type: "string",
          template: "<b>:title</b>",
        },
      },
      [{ id: 1, title: "<img src=x onerror=alert(1)>" }],
    );

    expect(container.querySelector("img")).toBeNull();
    expect(
      screen.getByText("<img src=x onerror=alert(1)>"),
    ).toBeInTheDocument();
  });

  it("isLink + template: seluruh sel jadi satu tautan ke record baris", () => {
    renderTable(
      {
        title: {
          name: "title",
          title: "Title",
          type: "string",
          isLink: true,
          route: "orders.show",
          primaryKey: "id",
          template: "<strong>:title</strong>",
        },
      },
      rows,
    );

    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/orders.show/1");
    expect(link).toContainElement(screen.getByText("Judul A"));
  });

  it("isLink + template yang memuat <nav-link>: tidak ada <a> bersarang", () => {
    const { container } = renderTable(
      {
        title: {
          name: "title",
          title: "Title",
          type: "string",
          isLink: true,
          route: "orders.show",
          primaryKey: "id",
          template: "<nav-link><strong>:title</strong></nav-link>",
        },
      },
      rows,
    );

    expect(container.querySelectorAll("a")).toHaveLength(1);
    expect(container.querySelector("a a")).toBeNull();
    expect(screen.getByText("Judul A")).toBeInTheDocument();
  });

  it("<nav-link> tanpa isLink menautkan ke record baris", () => {
    renderTable(
      {
        title: {
          name: "title",
          title: "Title",
          type: "string",
          route: "orders.show",
          primaryKey: "id",
          template:
            "<nav-link><strong>:title</strong></nav-link><muted>x</muted>",
        },
      },
      rows,
    );

    expect(screen.getByRole("link")).toHaveAttribute("href", "/orders.show/1");
    expect(screen.getByText("x").closest("a")).toBeNull();
  });

  it("<badge> memakai peta badgeColors kolom", () => {
    renderTable(
      {
        status: {
          name: "status",
          title: "Status",
          type: "string",
          template: "<badge>:status</badge>",
          badgeColors: { exported: "green" },
        },
      },
      [{ id: 1, status: "exported" }],
    );

    expect(screen.getByText("exported").className).toMatch(/bg-green-100/);
  });
});

describe("Cell - relations (chip)", () => {
  const column = {
    name: "deliveryNotes",
    title: "Delivery Notes",
    type: "relations",
    route: "delivery-notes",
    primaryKey: "id",
    max: 2,
  };
  const row = {
    id: 1,
    deliveryNotes: [1, 2, 3].map((n) => ({
      id: n,
      thisModel: "DeliveryNote",
      code: `DN-${n}`,
      templateLink: "<b>:code</b>",
    })),
  };

  it("merender chip per record anak, dibatasi max, sisanya '+N'", () => {
    const { container } = renderTable({ deliveryNotes: column }, [row]);

    expect(container.querySelectorAll('[data-slot="chip"]')).toHaveLength(2);
    expect(screen.getByText("DN-1")).toBeInTheDocument();
    expect(screen.getByText("DN-2")).toBeInTheDocument();
    expect(screen.queryByText("DN-3")).toBeNull();
    expect(screen.getByRole("button", { name: "+1" })).toBeInTheDocument();
  });

  it("chip bisa diklik ke record anak", () => {
    renderTable({ deliveryNotes: column }, [row]);

    expect(
      screen.getAllByRole("link").map((a) => a.getAttribute("href")),
    ).toEqual(["/delivery-notes/1", "/delivery-notes/2"]);
  });

  it("max: 0 (opt-in) menampilkan semua chip tanpa '+N'", () => {
    const { container } = renderTable(
      { deliveryNotes: { ...column, max: 0 } },
      [row],
    );

    expect(container.querySelectorAll('[data-slot="chip"]')).toHaveLength(3);
    expect(screen.queryByRole("button", { name: /^\+/ })).toBeNull();
  });

  it("kolom relations TANPA max dan TANPA template tetap disembunyikan (Req 14.1)", () => {
    const { max: _max, ...withoutMax } = column;
    const { container } = renderTable({ deliveryNotes: withoutMax }, [row]);

    expect(screen.queryByTestId("header-deliveryNotes")).toBeNull();
    expect(container.querySelector('[data-slot="chips"]')).toBeNull();
    expect(screen.queryByText("DN-1")).toBeNull();
  });

  it("relations + template: template dirender PER ANAK (bukan terhadap baris induk), default max 3", () => {
    const { max: _max, ...withoutMax } = column;
    const parentRow = {
      ...row,
      code: "INDUK",
      deliveryNotes: [1, 2, 3, 4].map((n) => ({
        id: n,
        thisModel: "DeliveryNote",
        code: `DN-${n}`,
        templateLink: "<b>TL-:code</b>",
      })),
    };
    const { container } = renderTable(
      {
        deliveryNotes: {
          ...withoutMax,
          template: "<muted>no. :code</muted>",
        },
      },
      [parentRow],
    );

    expect(screen.getByTestId("header-deliveryNotes")).toBeInTheDocument();
    expect(container.querySelectorAll('[data-slot="chip"]')).toHaveLength(3);
    expect(screen.getByText("no. DN-1")).toHaveClass("text-muted-foreground");
    expect(screen.getByText("no. DN-3")).toBeInTheDocument();
    expect(screen.queryByText(/INDUK/)).toBeNull();
    expect(screen.queryByText(/TL-/)).toBeNull();
    expect(screen.getByRole("button", { name: "+1" })).toBeInTheDocument();
  });

  it("relasi kosong tidak merender apa pun", () => {
    const { container } = renderTable({ deliveryNotes: column }, [
      { id: 1, deliveryNotes: [] },
    ]);

    expect(container.querySelector('[data-slot="chips"]')).toBeNull();
  });
});

describe("Cell - progress", () => {
  const column = { name: "per_billed", title: "Billed", type: "progress" };

  it("default donut dengan persentase, biru < 100", () => {
    const { container } = renderTable({ per_billed: column }, [
      { id: 1, per_billed: 45.25 },
    ]);

    expect(screen.getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "45.25",
    );
    expect(container.querySelector('[data-slot="arc"]')).toHaveClass(
      "stroke-blue-500",
    );
  });

  it("shape bar dari konfigurasi kolom, hijau saat 100", () => {
    const { container } = renderTable(
      { per_billed: { ...column, shape: "bar" } },
      [{ id: 1, per_billed: 100 }],
    );

    expect(container.querySelector('[data-shape="bar"]')).not.toBeNull();
    expect(container.querySelector('[data-slot="fill"]')).toHaveClass(
      "bg-green-500",
    );
  });

  it("nilai null menampilkan '–'", () => {
    renderTable({ per_billed: column }, [{ id: 1, per_billed: null }]);

    expect(screen.getByText("–")).toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).toBeNull();
  });
});

describe("Cell - kolom tanpa template (Property 10: tidak berubah)", () => {
  it("string polos, number terformat, dan json/mixed tetap seperti semula", () => {
    const { container } = renderTable(
      {
        name: { name: "name", title: "Name", type: "string" },
        qty: {
          name: "qty",
          title: "Qty",
          type: "number",
          numberFormat: "#.###,##",
        },
        meta: { name: "meta", title: "Meta", type: "json" },
      },
      [{ id: 1, name: "Item A", qty: 1234.5, meta: { a: 1 } }],
    );

    expect(screen.getByText("Item A").tagName).toBe("SPAN");
    expect(screen.getByText("1.234,50")).toBeInTheDocument();
    expect(container.querySelector('[data-slot="chips"]')).toBeNull();
    expect(screen.queryByRole("progressbar")).toBeNull();
  });

  it("isLink tanpa template tetap membungkus teks dalam <Link>", () => {
    renderTable(
      {
        name: {
          name: "name",
          title: "Name",
          type: "string",
          isLink: true,
          route: "items.show",
          primaryKey: "id",
        },
      },
      [{ id: 7, name: "Item A" }],
    );

    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/items.show/7");
    expect(link).toHaveTextContent("Item A");
  });

  it("type relation tetap menampilkan teks <title>/pertama dan menautkan ke relasi", () => {
    renderTable(
      {
        customer: {
          name: "customer",
          title: "Customer",
          type: "relation",
          route: "customers.show",
          primaryKey: "id",
        },
      },
      [
        {
          id: 1,
          customer: {
            id: 5,
            thisModel: "Customer",
            name: "Budi",
            templateLink: "<title>Budi</title><b>:name</b>",
          },
        },
      ],
    );

    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/customers.show/5");
    expect(link).toHaveTextContent("Budi");
  });
});

describe("isRelationsChipColumn (opt-in relations)", () => {
  it("true bila punya max (termasuk 0) atau template", () => {
    expect(isRelationsChipColumn({ max: 3 })).toBe(true);
    expect(isRelationsChipColumn({ max: 0 })).toBe(true);
    expect(isRelationsChipColumn({ template: "<b>:code</b>" })).toBe(true);
  });

  it("false tanpa max dan template (config existing tak berubah)", () => {
    expect(isRelationsChipColumn({})).toBe(false);
    expect(isRelationsChipColumn({ max: null })).toBe(false);
    expect(isRelationsChipColumn({ template: "" })).toBe(false);
    expect(isRelationsChipColumn(null)).toBe(false);
  });
});
