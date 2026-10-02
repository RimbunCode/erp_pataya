/**
 * Advance Search Dialog -- SearchBar + grouping (spec linkmodel-grouping-search
 * Requirement 2, 6, 7).
 */

import { describe, expect, it, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({ t: (key) => `TR:${key}` }),
}));
vi.mock("@/Hooks/usePermission", () => ({
  default: () => ({ can: () => true, canGlobal: () => true }),
}));
vi.mock("@inertiajs/react", () => ({
  router: { get: vi.fn(), reload: vi.fn() },
  usePage: () => ({ props: { lang: "id", preferences: {} }, url: "/test" }),
}));

const axiosPost = vi.fn();
vi.mock("axios", () => ({
  default: {
    post: (...args) => axiosPost(...args),
    get: () => Promise.resolve({ data: { data: [] } }),
  },
}));

window.route = (name) => name;

import AdvanceSearchDialog, {
  addCarryOverSearch,
  buildGroupOptions,
  buildSearchBarColumnMap,
} from "./AdvanceSearchDialog";

const MODEL = "App\\Models\\Inventory\\Item";
const columns = [
  { name: "code", type: "string", linkable: false, title: "Kode" },
  {
    name: "category",
    type: "string",
    linkable: true,
    groupable: true,
    title: "Kategori",
  },
  {
    name: "secret",
    type: "string",
    linkable: false,
    groupable: true,
    title: "Rahasia",
  },
];
const levels = [
  { column: "category", granularity: null, range: null, type: "string" },
];

const flatPage = (rows) => ({
  data: {
    model: MODEL,
    route: "items",
    translateKey: null,
    columns,
    templateLinkColumns: ["code"],
    parentColumn: null,
    data: {
      data: rows,
      current_page: 1,
      last_page: 1,
      per_page: 25,
      total: rows.length,
    },
  },
});
const groupedPage = (items) => ({
  data: {
    ...flatPage(items).data,
    groupMeta: { levels, aggregates: [] },
    defaultGroups: [],
    data: {
      data: items,
      current_page: 1,
      last_page: 1,
      per_page: 25,
      total: items.length,
    },
  },
});
const descriptor = (key, count) => ({ key, raw: key, count, aggregates: {} });
const row = (id, code) => ({ id, code, templateLink: ":code" });

const renderDialog = (props = {}) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  const ui = (extra = {}) => (
    <QueryClientProvider client={queryClient}>
      <AdvanceSearchDialog
        open
        onOpenChange={vi.fn()}
        model={MODEL}
        onSelect={vi.fn()}
        {...props}
        {...extra}
      />
    </QueryClientProvider>
  );
  const result = render(ui());

  return { ...result, rerenderDialog: (extra) => result.rerender(ui(extra)) };
};

const selectDataCalls = () =>
  axiosPost.mock.calls.filter(([url]) => url === "model.selectData");

describe("AdvanceSearchDialog -- SearchBar", () => {
  beforeEach(() => {
    axiosPost.mockReset();
  });

  it("kotak teks lama diganti SearchBar (tanpa input teks bebas lama)", async () => {
    axiosPost.mockResolvedValue(flatPage([row(1, "A1")]));
    renderDialog();

    await waitFor(() => expect(axiosPost).toHaveBeenCalled());
    expect(
      screen.getAllByPlaceholderText("TR:core.form.search.placeholder").length,
    ).toBeGreaterThan(0);
  });

  it("initialSearch -> dikirim sebagai search awal lalu menjadi chip Cari pada filters", async () => {
    axiosPost.mockResolvedValue(flatPage([row(1, "A1")]));
    renderDialog({ initialSearch: "abc" });

    await waitFor(() =>
      expect(selectDataCalls()[0][1]).toMatchObject({ search: "abc" }),
    );
    // kolom sumber templateLink diketahui -> chip Cari masuk ke tree filter
    await waitFor(() => {
      const withFilters = selectDataCalls().find(([, p]) => p.filters);
      expect(withFilters).toBeTruthy();
      const group = Object.values(withFilters[1].filters.root.c)[0];
      const leaves = Object.values(group.c ?? { only: group });
      expect(
        leaves.every((leaf) => leaf.o === "matches" && leaf.v === "abc"),
      ).toBe(true);
    });
  });
});

describe("AdvanceSearchDialog -- grup awal dari prop group", () => {
  beforeEach(() => {
    axiosPost.mockReset();
    axiosPost.mockResolvedValue(flatPage([row(1, "A1")]));
  });

  it("selalu opt-in groupTree; prop group dikirim sbg grup eksplisit", async () => {
    renderDialog({ group: "category" });

    await waitFor(() => expect(selectDataCalls().length).toBeGreaterThan(0));
    expect(selectDataCalls()[0][1]).toMatchObject({
      groupTree: true,
      group: [{ column: "category", granularity: null, range: null }],
    });
  });

  it("tanpa prop group -> `group` tak dikirim (server memakai default model)", async () => {
    renderDialog();

    await waitFor(() => expect(selectDataCalls().length).toBeGreaterThan(0));
    expect("group" in selectDataCalls()[0][1]).toBe(false);
    expect(selectDataCalls()[0][1].groupTree).toBe(true);
  });

  it("group={[]} -> dibuka tanpa grup, `group: []` eksplisit", async () => {
    renderDialog({ group: [] });

    await waitFor(() => expect(selectDataCalls().length).toBeGreaterThan(0));
    expect(selectDataCalls()[0][1].group).toEqual([]);
  });
});

describe("AdvanceSearchDialog -- tampilan grup", () => {
  beforeEach(() => {
    axiosPost.mockReset();
  });

  it("level-0 tampil sbg header grup tertutup; buka -> fetch groupPath; klik baris -> onSelect", async () => {
    const user = userEvent.setup({ delay: null });
    const onSelect = vi.fn();
    axiosPost.mockImplementation((_url, payload) => {
      if (payload.groupPath !== undefined) {
        return Promise.resolve({
          data: {
            type: "rows",
            data: [row(1, "ITM-1"), row(2, "ITM-2")],
            current_page: 1,
            last_page: 1,
            total: 2,
            per_page: 25,
          },
        });
      }
      return Promise.resolve(
        groupedPage([descriptor("alpha", 2), descriptor("beta", 1)]),
      );
    });
    renderDialog({ group: "category", onSelect });

    const table = await screen.findByRole("table");
    const header = await within(table).findByText("alpha");
    expect(within(table).queryByText("ITM-1")).not.toBeInTheDocument();

    await user.click(header);

    const cell = await within(table).findByText("ITM-1");
    const expand = selectDataCalls().find(([, p]) => p.groupPath !== undefined);
    expect(expand[1]).toMatchObject({
      groupPath: '["alpha"]',
      groupPage: 1,
      includeAllLinkable: true,
      group: [{ column: "category", granularity: null, range: null }],
    });
    // expand tak membawa flag opt-in level-0
    expect(expand[1].groupTree).toBeUndefined();

    await user.click(cell);
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({ id: 1, code: "ITM-1" }),
    );
  });

  it("dibuka ulang -> perubahan lokal direset ke grup prop", async () => {
    axiosPost.mockResolvedValue(flatPage([row(1, "A1")]));
    const { rerenderDialog } = renderDialog({ group: "category" });
    await waitFor(() => expect(selectDataCalls().length).toBeGreaterThan(0));

    rerenderDialog({ open: false });
    axiosPost.mockClear();
    rerenderDialog({ open: true });

    await waitFor(() => expect(selectDataCalls().length).toBeGreaterThan(0));
    expect(selectDataCalls()[0][1].group).toEqual([
      { column: "category", granularity: null, range: null },
    ]);
  });
});

describe("helper dialog", () => {
  const t = (key) => key;

  it("addCarryOverSearch: 1 kolom -> leaf matches; >=2 kolom -> grup OR (chip Cari)", () => {
    const single = addCarryOverSearch(null, " abc ", ["code"]);
    const [leaf] = Object.values(single.root.c);
    expect(leaf).toMatchObject({ k: "code", o: "matches", v: "abc" });

    const multi = addCarryOverSearch(null, "abc", ["code", "name"]);
    const [group] = Object.values(multi.root.c);
    expect(group.k).toBe("or");
    expect(Object.values(group.c)).toHaveLength(2);
  });

  it("buildSearchBarColumnMap: title terjemahan + buang hidden/ignore", () => {
    const map = buildSearchBarColumnMap(
      {
        a: { name: "a", titleTrans: "x.a" },
        b: { name: "b", title: "B", hidden: true },
        c: { name: "c", title: "C", ignore: true },
      },
      t,
    );

    expect(Object.keys(map)).toEqual(["a"]);
    expect(map.a.title).toBe("x.a");
    expect(map.a.searchable).toBe(true);
  });

  it("buildGroupOptions: groupable ∩ aman (relasi, linkable, atau sumber templateLink)", () => {
    const options = buildGroupOptions(
      {
        a: {
          name: "a",
          title: "A",
          groupable: true,
          type: "string",
          linkable: true,
        },
        b: { name: "b", title: "B", groupable: true, type: "string" },
        c: { name: "c", title: "C", groupable: true, type: "relation" },
        d: { name: "d", title: "D", groupable: true, type: "string" },
        e: {
          name: "e",
          title: "E",
          groupable: false,
          type: "string",
          linkable: true,
        },
        f: {
          name: "f",
          title: "F",
          groupable: true,
          type: "json",
          linkable: true,
        },
      },
      ["d"],
    );

    expect(options.map((o) => o.value)).toEqual(["a", "c", "d"]);
  });
});
