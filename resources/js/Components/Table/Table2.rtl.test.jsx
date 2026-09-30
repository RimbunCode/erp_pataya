import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

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

// Header (drag handle, resize handle, sort UI) punya kompleksitas dnd-kit
// tersendiri -- stub agar test Table2 fokus ke wrapper: selectable checkbox,
// loading/empty state, cell rendering dasar.
vi.mock("./Header", () => ({
  default: ({ title, id }) => <th data-testid={`header-${id}`}>{title}</th>,
}));

import axios from "axios";
import Table2 from "./Table2";

const columns = {
  name: { name: "name", title: "Name", type: "text" },
};

const data = [
  { id: 1, name: "Item A" },
  { id: 2, name: "Item B" },
];

describe("Table2", () => {
  it("menampilkan loading state saat isLoading=true", () => {
    render(<Table2 columns={columns} data={[]} isLoading />);
    expect(screen.getByText(/TR:core.form.loading/)).toBeInTheDocument();
  });

  it("menampilkan NoDataImg saat data kosong dan bukan dynamic data", () => {
    render(<Table2 columns={columns} data={[]} />);
    expect(screen.queryByText(/TR:core.form.loading/)).not.toBeInTheDocument();
  });

  it("menampilkan pesan no_data saat data kosong dan isDynamicData=true", () => {
    render(<Table2 columns={columns} data={[]} isDynamicData />);
    expect(screen.getByText(/TR:core.datatable.no_data/)).toBeInTheDocument();
  });

  it("merender baris data dengan header kolom yang diberikan", () => {
    render(<Table2 columns={columns} data={data} />);
    expect(screen.getByTestId("header-name")).toBeInTheDocument();
    expect(screen.getByText("Item A")).toBeInTheDocument();
    expect(screen.getByText("Item B")).toBeInTheDocument();
  });

  it("tidak merender checkbox saat selectable=false", () => {
    render(<Table2 columns={columns} data={data} selectable={false} />);
    expect(screen.queryAllByRole("forminput")).toHaveLength(0);
  });

  it("selectable=true merender checkbox per baris + 1 checkbox select-all di header", () => {
    render(<Table2 columns={columns} data={data} selectable />);
    // 2 baris + 1 select-all header
    expect(screen.getAllByRole("forminput")).toHaveLength(3);
  });

  it("klik checkbox select-all menandai semua baris terpilih", async () => {
    const user = userEvent.setup({ delay: null });
    render(<Table2 columns={columns} data={data} selectable />);

    const [selectAll, ...rowChecks] = screen.getAllByRole("forminput");
    await user.click(selectAll);

    rowChecks.forEach((cb) =>
      expect(cb).toHaveAttribute("data-state", "checked"),
    );
  });

  // Task 6 (spec linkmodel-advanced-search) — onRowClick: mode single-select
  // klik-langsung (dipakai Advance Search Dialog), independen dari `selectable`
  // (checkbox multi-select, dipakai SelectModel). Prop opsional, default
  // undefined -- tidak boleh mengubah perilaku existing (selectable tetap jalan).
  it("onRowClick terisi -- klik baris memanggil callback dengan row yang benar, tanpa checkbox", async () => {
    const user = userEvent.setup({ delay: null });
    const onRowClick = vi.fn();
    render(<Table2 columns={columns} data={data} onRowClick={onRowClick} />);

    expect(screen.queryAllByRole("forminput")).toHaveLength(0);

    await user.click(screen.getByText("Item B"));

    expect(onRowClick).toHaveBeenCalledTimes(1);
    expect(onRowClick).toHaveBeenCalledWith(data[1]);
  });

  it("onRowClick tidak diisi (default) -- klik baris tidak memicu apapun (regresi)", async () => {
    const user = userEvent.setup({ delay: null });
    render(<Table2 columns={columns} data={data} />);

    // Tidak ada assertion callback (tak ada prop) -- cukup pastikan klik tidak throw.
    await expect(user.click(screen.getByText("Item A"))).resolves.not.toThrow();
  });

  // Kolom isLink tanpa `route` (mis. dari SelectModel/useSelectModel yang tak
  // menurunkan route seperti DataTable2) dulu crash: window.route(route ?? "", ...)
  // memanggil Ziggy dengan nama route kosong, lalu Link (Inertia mergeDataIntoQueryString)
  // memanggil href.toString() pada Router object rusak → "Cannot convert undefined
  // or null to object". Cell harus fallback ke teks biasa, bukan <Link>.
  it("kolom isLink tanpa route dirender sebagai teks biasa, bukan Link", () => {
    window.route = vi.fn(() => "/should-not-be-called");
    const isLinkColumns = {
      code: {
        name: "code",
        title: "Code",
        type: "string",
        isLink: true,
        primaryKey: "id",
      },
    };
    render(
      <Table2
        columns={isLinkColumns}
        data={[{ id: 1, code: "PSN/PR-0001" }]}
        persistColumns={false}
        isDynamicData
      />,
    );

    expect(screen.getByText("PSN/PR-0001")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(window.route).not.toHaveBeenCalled();
  });

  it("kolom isLink dengan route tetap dirender sebagai Link", () => {
    window.route = vi.fn(() => "/purchase-requests/1");
    const isLinkColumns = {
      code: {
        name: "code",
        title: "Code",
        type: "string",
        isLink: true,
        route: "purchaseRequests.show",
        primaryKey: "id",
      },
    };
    render(
      <Table2
        columns={isLinkColumns}
        data={[{ id: 1, code: "PSN/PR-0001" }]}
        persistColumns={false}
        isDynamicData
      />,
    );

    expect(screen.getByRole("link", { name: "PSN/PR-0001" })).toHaveAttribute(
      "href",
      "/purchase-requests/1",
    );
    expect(window.route).toHaveBeenCalledWith("purchaseRequests.show", 1);
  });

  // Pohon grup (spec datatable2-group-tree): `data` = deskriptor grup level-0,
  // isi grup di-fetch lazy saat dibuka. Label per-tipe diuji di
  // Group/GroupHeaderRow.rtl.test.jsx; perilaku pohon (nested, pager, error,
  // version) di Group/GroupTree.rtl.test.jsx -- di sini integrasi dgn Table2.
  describe("grouping (prop group -> GroupTree)", () => {
    const groupColumns = {
      name: { name: "name", title: "Name", type: "text" },
      qty: { name: "qty", title: "Qty", type: "number", numberFormat: "#,###" },
    };
    const descriptors = [
      { key: "fruit", raw: "fruit", count: 10, aggregates: { qty: 1500 } },
      {
        key: "vegetable",
        raw: "vegetable",
        count: 3,
        aggregates: { qty: null },
      },
    ];
    const group = {
      levels: [
        { column: "category", granularity: null, range: null, type: "string" },
      ],
      aggregates: [{ column: "qty", fn: "sum" }],
      baseParams: { group: "category" },
      version: 0,
      resetKey: "k1",
      pathname: "/orders",
    };

    const renderGrouped = (props = {}) => {
      const client = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      });
      const wrap = (extra = {}) => (
        <QueryClientProvider client={client}>
          <Table2
            columns={groupColumns}
            data={descriptors}
            group={group}
            persistColumns={false}
            {...props}
            {...extra}
          />
        </QueryClientProvider>
      );
      const view = render(wrap());
      return { ...view, update: (extra) => view.rerender(wrap(extra)) };
    };

    beforeEach(() => axios.get.mockReset());

    it("merender header grup level-0 dari `data` (count dari deskriptor) TERTUTUP, tanpa fetch", () => {
      renderGrouped();

      expect(screen.getByText("fruit")).toBeInTheDocument();
      expect(screen.getByText("(10)")).toBeInTheDocument();
      expect(screen.getByText("vegetable")).toBeInTheDocument();
      expect(screen.getByText("(3)")).toBeInTheDocument();
      expect(screen.queryByText("Item A")).not.toBeInTheDocument();
      expect(axios.get).not.toHaveBeenCalled();
    });

    it("klik header -> fetch node lalu baris dirender lewat TableRow (sel per kolom)", async () => {
      const user = userEvent.setup({ delay: null });
      axios.get.mockResolvedValue({
        data: {
          type: "rows",
          data: [{ id: 1, name: "Item A", qty: 1200 }],
          current_page: 1,
          last_page: 1,
          total: 1,
          per_page: 100,
        },
      });
      renderGrouped();

      await user.click(screen.getByRole("button", { name: /fruit/ }));

      expect(await screen.findByText("Item A")).toBeInTheDocument();
      // Sel `qty` baris memakai Cell (format angka) -- BUKAN sel agregat header.
      expect(screen.getByText("1,200")).toBeInTheDocument();
      expect(axios.get).toHaveBeenCalledWith(
        "/orders",
        expect.objectContaining({
          params: { group: "category", groupPath: '["fruit"]', groupPage: 1 },
        }),
      );
    });

    it("agregat tampil di sel kolomnya pada baris header grup; grup dgn agregat null -> sel kosong", () => {
      renderGrouped();

      const tds = (name) =>
        Array.from(
          screen
            .getByRole("button", { name })
            .closest("tr")
            .querySelectorAll("td"),
        );
      const fruit = tds(/fruit/);
      const vegetable = tds(/vegetable/);

      // label (span kolom `name`) + sel `qty`
      expect(fruit).toHaveLength(2);
      expect(fruit[1]).toHaveTextContent("1,500");
      expect(fruit[1]).toHaveAttribute(
        "title",
        "TR:core.datatable.aggregate.sum",
      );
      expect(vegetable[1]).toHaveTextContent("");
    });

    it("kolom pemilih menambah span label header grup", () => {
      renderGrouped({ selectable: true });

      const label = screen.getByRole("button", { name: /fruit/ });
      expect(label.style.gridColumn).toBe("span 2");
    });

    it("mode grup: tanpa baris filler & tanpa gridTemplateRows berbasis data.length; jalur flat tetap punya filler 1fr", () => {
      const { container, unmount } = renderGrouped();
      const table = container.querySelector("table");

      expect(table.style.alignContent).toBe("start");
      expect(table.style.gridTemplateRows).toBe("");
      expect(container.querySelectorAll("td.row-auto")).toHaveLength(0);
      unmount();

      const flat = render(
        <Table2
          columns={groupColumns}
          data={[{ id: 1, name: "Item A" }]}
          persistColumns={false}
        />,
      );
      const flatTable = flat.container.querySelector("table");
      expect(flatTable.style.gridTemplateRows).toContain("1fr");
      expect(flat.container.querySelectorAll("td.row-auto")).toHaveLength(1);
    });

    it("`group.resetKey` berubah (halaman server berganti) -> semua grup kembali tertutup", async () => {
      const user = userEvent.setup({ delay: null });
      axios.get.mockResolvedValue({
        data: {
          type: "rows",
          data: [{ id: 1, name: "Item A" }],
          current_page: 1,
          last_page: 1,
          total: 1,
          per_page: 100,
        },
      });
      const { update } = renderGrouped();

      await user.click(screen.getByRole("button", { name: /fruit/ }));
      await screen.findByText("Item A");

      update({ group: { ...group, resetKey: "k2" } });

      expect(screen.queryByText("Item A")).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: /fruit/ })).toHaveAttribute(
        "aria-expanded",
        "false",
      );
    });

    it("data level-0 kosong -> tampil NoData (bukan pohon kosong)", () => {
      renderGrouped({ data: [], isDynamicData: true });

      expect(screen.getByText(/TR:core.datatable.no_data/)).toBeInTheDocument();
    });

    it("tanpa prop `group` -- tidak ada header grup sama sekali (regresi 100+ halaman existing)", () => {
      render(<Table2 columns={columns} data={data} />);

      expect(
        screen.queryByRole("button", { name: /fruit/ }),
      ).not.toBeInTheDocument();
      expect(screen.getByText("Item A")).toBeInTheDocument();
    });
  });
});
