import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({ t: (key) => `TR:${key}` }),
}));
vi.mock("axios", () => ({ default: { get: vi.fn() } }));

import axios from "axios";
import GroupTree from "./GroupTree";

const levels = [
  { column: "category", granularity: null, range: null, type: "string" },
  { column: "status", granularity: null, range: null, type: "string" },
];

const renderers = {
  renderGroupHeader: ({ item, depth, isOpen, onToggle, pathKey }) => (
    <div
      role="button"
      aria-expanded={isOpen}
      data-depth={depth}
      data-path={pathKey}
      onClick={onToggle}
    >
      {item.key}({item.count})
    </div>
  ),
  renderRow: (row) => <div data-testid="row">{row.name}</div>,
  renderLoading: () => <div role="status">loading</div>,
  renderError: () => <div role="alert">error</div>,
};

const makeClient = () =>
  new QueryClient({ defaultOptions: { queries: { retry: false } } });

const node = (type, data) => ({
  type,
  data,
  current_page: 1,
  last_page: 1,
  total: data.length,
  per_page: 25,
});

// fetcher kustom: tidak ada axios sama sekali.
const makeFetcher = () =>
  vi.fn(async ({ rawPath }) => {
    if (rawPath.length === 1) {
      return node("groups", [
        { key: "draft", raw: "draft", count: 4, aggregates: {} },
        { key: "done", raw: "done", count: 6, aggregates: {} },
      ]);
    }

    return node("rows", [{ id: 1, name: `row-${rawPath.join("-")}` }]);
  });

const rootItems = [
  { key: "a", raw: "a", count: 10, aggregates: {} },
  { key: "b", raw: "b", count: 10, aggregates: {} },
  { key: "c", raw: "c", count: 10, aggregates: {} },
  { key: "d", raw: "d", count: 1, aggregates: {} },
];

const tree = (props = {}) => (
  <QueryClientProvider client={makeClient()}>
    <GroupTree
      rootItems={rootItems}
      levels={levels}
      baseParams={{ q: 1 }}
      pathname="/lookup"
      {...renderers}
      {...props}
    />
  </QueryClientProvider>
);

describe("GroupTree — fetcher kustom", () => {
  it("memakai fetcher, bukan axios, dan membawa rawPath/page", async () => {
    const fetcher = makeFetcher();
    render(tree({ fetcher }));

    await userEvent.click(screen.getByText("a(10)"));

    await waitFor(() => expect(fetcher).toHaveBeenCalled());
    expect(fetcher.mock.calls[0][0]).toMatchObject({
      pathname: "/lookup",
      rawPath: ["a"],
      page: 1,
    });
    expect(axios.get).not.toHaveBeenCalled();
    expect(await screen.findByText("draft(4)")).toBeTruthy();
  });

  it("renderGroupHeader menerima pathKey (JSON path raw)", () => {
    render(tree({ fetcher: makeFetcher() }));

    expect(screen.getByText("a(10)").getAttribute("data-path")).toBe('["a"]');
  });
});

describe("GroupTree — autoExpand", () => {
  it("membuka grup level-0 sesuai anggaran (maks 3, kumulatif <= budget)", async () => {
    render(tree({ fetcher: makeFetcher(), autoExpand: { budget: 25 } }));

    await waitFor(() =>
      expect(screen.getByText("a(10)").getAttribute("aria-expanded")).toBe(
        "true",
      ),
    );
    expect(screen.getByText("b(10)").getAttribute("aria-expanded")).toBe(
      "true",
    );
    // a+b = 20, +c = 30 > 25 -> c tidak dibuka.
    expect(screen.getByText("c(10)").getAttribute("aria-expanded")).toBe(
      "false",
    );
    expect(screen.getByText("d(1)").getAttribute("aria-expanded")).toBe(
      "false",
    );
  });

  it("rekursif: node yang dibuka otomatis membuka sub-grup pertamanya", async () => {
    const fetcher = makeFetcher();
    render(tree({ fetcher, autoExpand: { budget: 25 } }));

    // sub-grup a: draft(4)+done(6)=10 <= 25 -> keduanya terbuka, barisnya dimuat.
    await waitFor(() =>
      expect(screen.getAllByTestId("row").length).toBeGreaterThanOrEqual(2),
    );
    expect(
      fetcher.mock.calls.some(([args]) => args.rawPath.join("/") === "a/draft"),
    ).toBe(true);
  });

  it("toggle manual tak dilawan saat data yang sama dirender ulang", async () => {
    const fetcher = makeFetcher();
    const { rerender } = render(
      tree({ fetcher, autoExpand: { budget: 25, maxGroups: 1 } }),
    );
    await waitFor(() =>
      expect(screen.getByText("a(10)").getAttribute("aria-expanded")).toBe(
        "true",
      ),
    );

    await userEvent.click(screen.getByText("a(10)"));
    expect(screen.getByText("a(10)").getAttribute("aria-expanded")).toBe(
      "false",
    );

    // render ulang dgn rootItems baru (referensi beda, tanda tangan sama)
    rerender(
      <QueryClientProvider client={makeClient()}>
        <GroupTree
          rootItems={[...rootItems]}
          levels={levels}
          baseParams={{ q: 1 }}
          pathname="/lookup"
          fetcher={fetcher}
          autoExpand={{ budget: 25, maxGroups: 1 }}
          {...renderers}
        />
      </QueryClientProvider>,
    );
    expect(screen.getByText("a(10)").getAttribute("aria-expanded")).toBe(
      "false",
    );
  });

  it("tanpa autoExpand semua grup tertutup", () => {
    render(tree({ fetcher: makeFetcher() }));

    for (const key of ["a(10)", "b(10)", "c(10)", "d(1)"]) {
      expect(screen.getByText(key).getAttribute("aria-expanded")).toBe("false");
    }
  });

  it("autoExpandKey berubah -> dijalankan ulang", async () => {
    const fetcher = makeFetcher();
    const { rerender } = render(
      tree({
        fetcher,
        autoExpand: { budget: 25, maxGroups: 1 },
        autoExpandKey: "x",
      }),
    );
    await waitFor(() =>
      expect(screen.getByText("a(10)").getAttribute("aria-expanded")).toBe(
        "true",
      ),
    );
    await userEvent.click(screen.getByText("a(10)"));

    rerender(
      <QueryClientProvider client={makeClient()}>
        <GroupTree
          rootItems={rootItems}
          levels={levels}
          baseParams={{ q: 1 }}
          pathname="/lookup"
          fetcher={fetcher}
          autoExpand={{ budget: 25, maxGroups: 1 }}
          autoExpandKey="y"
          {...renderers}
        />
      </QueryClientProvider>,
    );

    await waitFor(() =>
      expect(screen.getByText("a(10)").getAttribute("aria-expanded")).toBe(
        "true",
      ),
    );
  });
});
