import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({ t: (key) => `TR:${key}` }),
}));
vi.mock("axios", () => ({ default: { get: vi.fn() } }));

import axios from "axios";
import GroupTree from "./GroupTree";
import GroupPager from "./GroupPager";

const levels = [
  { column: "category", granularity: null, range: null, type: "string" },
];
const nestedLevels = [
  ...levels,
  { column: "is_active", granularity: null, range: null, type: "boolean" },
];
const baseParams = { fid: "f1", sort: "-name", group: "category" };

const rootItems = [
  { key: "fruit", raw: "fruit", count: 3, aggregates: {} },
  { key: "vegetable", raw: "vegetable", count: 2, aggregates: {} },
];

// Respons node baku: `type` + envelope paginator.
const rowsResponse = (names, over = {}) => ({
  data: {
    type: "rows",
    data: names.map((name, index) => ({ id: `${name}-${index}`, name })),
    current_page: 1,
    last_page: 1,
    total: names.length,
    per_page: 100,
    ...over,
  },
});
const groupsResponse = (items, over = {}) => ({
  data: {
    type: "groups",
    data: items,
    current_page: 1,
    last_page: 1,
    total: items.length,
    per_page: 100,
    ...over,
  },
});

// `onPrefetch` (bila ada) HANYA ditandai lewat atribut di stub DEFAULT ini --
// TIDAK dipasang ke onMouseEnter di sini, krn `userEvent.click()` (dipakai
// hampir semua tes lain di file ini utk membuka node) SENDIRI menyimulasikan
// hover sblm klik; memasangnya di sini akan diam2 menambah panggilan prefetch
// ke SEMUA tes klik yg ada. Tes hover sungguhan pakai renderer LOKAL terpisah
// (describe "GroupTree — prefetch") yg memasangnya secara eksplisit.
const renderers = {
  renderGroupHeader: ({
    item,
    depth,
    level,
    isOpen,
    onToggle,
    pager,
    onPrefetch,
  }) => (
    <div
      role="button"
      aria-expanded={isOpen}
      data-depth={depth}
      data-level={level?.column}
      data-has-prefetch={onPrefetch ? "true" : "false"}
      onClick={onToggle}
    >
      <span>{item.key}</span>
      <span>({item.count})</span>
      {pager}
    </div>
  ),
  renderRow: (row, { depth }) => (
    <div data-testid="row" data-depth={depth}>
      {row.name}
    </div>
  ),
  renderLoading: ({ depth }) => (
    <div role="status" data-depth={depth}>
      loading
    </div>
  ),
  renderError: ({ onRetry }) => (
    <div role="alert">
      <button type="button" onClick={onRetry}>
        retry
      </button>
    </div>
  ),
};

const makeClient = () =>
  new QueryClient({ defaultOptions: { queries: { retry: false } } });

const tree = (props = {}) => (
  <GroupTree
    rootItems={rootItems}
    levels={levels}
    baseParams={baseParams}
    pathname="/orders"
    version={0}
    {...renderers}
    {...props}
  />
);

const setup = (props = {}) => {
  const client = makeClient();
  const wrap = (ui) => (
    <QueryClientProvider client={client}>{ui}</QueryClientProvider>
  );
  const view = render(wrap(tree(props)));
  return {
    ...view,
    client,
    update: (next = {}) => view.rerender(wrap(tree({ ...props, ...next }))),
  };
};

const header = (key) =>
  screen.getByRole("button", { name: new RegExp(`^${key}`) });

beforeEach(() => {
  axios.get.mockReset();
});

describe("GroupTree — default tertutup & lazy fetch", () => {
  it("menampilkan header level-0 TERTUTUP dan tidak fetch apa pun", () => {
    setup();

    expect(header("fruit")).toHaveAttribute("aria-expanded", "false");
    expect(header("vegetable")).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryAllByTestId("row")).toHaveLength(0);
    expect(axios.get).not.toHaveBeenCalled();
  });

  it("header menerima `level` = levels[depth]", () => {
    setup();

    expect(header("fruit")).toHaveAttribute("data-level", "category");
    expect(header("fruit")).toHaveAttribute("data-depth", "0");
  });

  it("buka grup -> fetch dgn param halaman + groupPath (JSON) + groupPage; loading lalu baris (depth = jumlah level)", async () => {
    const user = userEvent.setup({ delay: null });
    let resolve;
    axios.get.mockReturnValue(new Promise((r) => (resolve = r)));
    setup();

    await user.click(header("fruit"));

    expect(await screen.findByRole("status")).toBeInTheDocument();
    expect(axios.get).toHaveBeenCalledTimes(1);
    expect(axios.get).toHaveBeenCalledWith(
      "/orders",
      expect.objectContaining({
        params: { ...baseParams, groupPath: '["fruit"]', groupPage: 1 },
        paramsSerializer: expect.any(Function),
      }),
    );

    resolve(rowsResponse(["Apel", "Jeruk"]));
    expect(await screen.findByText("Apel")).toBeInTheDocument();
    expect(screen.getAllByTestId("row")).toHaveLength(2);
    expect(screen.getAllByTestId("row")[0]).toHaveAttribute("data-depth", "1");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(header("fruit")).toHaveAttribute("aria-expanded", "true");
  });

  it("grup lain tidak ikut terbuka/fetch", async () => {
    const user = userEvent.setup({ delay: null });
    axios.get.mockResolvedValue(rowsResponse(["Apel"]));
    setup();

    await user.click(header("fruit"));
    await screen.findByText("Apel");

    expect(header("vegetable")).toHaveAttribute("aria-expanded", "false");
    expect(axios.get).toHaveBeenCalledTimes(1);
  });

  it("tutup grup menyembunyikan isinya; buka lagi memuat ulang (staleTime 0, bukan cache 2 menit)", async () => {
    const user = userEvent.setup({ delay: null });
    axios.get.mockResolvedValue(rowsResponse(["Apel"]));
    setup();

    await user.click(header("fruit"));
    await screen.findByText("Apel");
    await user.click(header("fruit"));
    expect(screen.queryByText("Apel")).not.toBeInTheDocument();

    await user.click(header("fruit"));
    await screen.findByText("Apel");
    expect(axios.get).toHaveBeenCalledTimes(2);
  });

  it("raw null & raw array masuk groupPath apa adanya (grup NULL, formStatuses)", async () => {
    const user = userEvent.setup({ delay: null });
    axios.get.mockResolvedValue(rowsResponse(["X"]));
    setup({
      rootItems: [
        { key: "null", raw: null, count: 1, aggregates: {} },
        { key: '["draft"]', raw: ['["draft"]'], count: 1, aggregates: {} },
      ],
    });

    await user.click(header("null"));
    await screen.findByText("X");
    await user.click(screen.getByRole("button", { name: /draft/ }));

    await waitFor(() => expect(axios.get).toHaveBeenCalledTimes(2));
    expect(axios.get.mock.calls[0][1].params.groupPath).toBe("[null]");
    expect(axios.get.mock.calls[1][1].params.groupPath).toBe(
      '[["[\\"draft\\"]"]]',
    );
  });
});

describe("GroupTree — nested", () => {
  it("node bertipe groups merender sub-grup (depth+1) yang bisa dibuka; path menumpuk", async () => {
    const user = userEvent.setup({ delay: null });
    axios.get
      .mockResolvedValueOnce(
        groupsResponse([
          { key: "true", raw: 1, count: 2, aggregates: {} },
          { key: "false", raw: 0, count: 1, aggregates: {} },
        ]),
      )
      .mockResolvedValueOnce(rowsResponse(["Apel Aktif"]));
    setup({ levels: nestedLevels });

    await user.click(header("fruit"));
    const child = await screen.findByRole("button", { name: /^true/ });
    expect(child).toHaveAttribute("data-depth", "1");
    expect(child).toHaveAttribute("data-level", "is_active");

    await user.click(child);
    expect(await screen.findByText("Apel Aktif")).toBeInTheDocument();
    expect(axios.get.mock.calls[1][1].params.groupPath).toBe('["fruit",1]');
    expect(screen.getByTestId("row")).toHaveAttribute("data-depth", "2");
  });

  it("menutup induk menyembunyikan seluruh subtree", async () => {
    const user = userEvent.setup({ delay: null });
    axios.get.mockResolvedValue(
      groupsResponse([{ key: "true", raw: 1, count: 2, aggregates: {} }]),
    );
    setup({ levels: nestedLevels });

    await user.click(header("fruit"));
    await screen.findByRole("button", { name: /^true/ });
    await user.click(header("fruit"));

    expect(
      screen.queryByRole("button", { name: /^true/ }),
    ).not.toBeInTheDocument();
  });
});

describe("GroupTree — subLevelVersion (Requirement 24, permintaan user)", () => {
  it("naikkan subLevelVersion: node terbuka di kedalaman >=1 ikut TERTUTUP, node depth 0 TETAP terbuka", async () => {
    const user = userEvent.setup({ delay: null });
    axios.get
      .mockResolvedValueOnce(
        groupsResponse([
          { key: "true", raw: 1, count: 2, aggregates: {} },
          { key: "false", raw: 0, count: 1, aggregates: {} },
        ]),
      )
      .mockResolvedValueOnce(rowsResponse(["Apel Aktif"]));
    const { update } = setup({ levels: nestedLevels });

    await user.click(header("fruit"));
    const child = await screen.findByRole("button", { name: /^true/ });
    await user.click(child);
    expect(await screen.findByText("Apel Aktif")).toBeInTheDocument();

    // Sub-level "is_active" berganti kolom (mis. jadi "status") -- level 0
    // ("category") tak tersentuh, tapi identitas node depth>=1 ("true") tak
    // valid lagi (lihat komentar GroupTree.jsx). Refetch node "fruit" (masih
    // terbuka) pakai response groups yg SAMA di sini (fokus tes ini murni
    // pruning openKeys, bukan isi baru).
    axios.get.mockResolvedValue(
      groupsResponse([
        { key: "true", raw: 1, count: 2, aggregates: {} },
        { key: "false", raw: 0, count: 1, aggregates: {} },
      ]),
    );
    await act(async () => update({ subLevelVersion: 1 }));

    // "fruit" (depth 0) tetap terbuka -> anaknya ("true"/"false") tetap
    // dirender begitu refetch selesai.
    expect(await screen.findByRole("button", { name: /^true/ })).toBeTruthy();
    // "true" (depth 1) SENDIRI tertutup lagi -> isinya ("Apel Aktif") hilang.
    expect(screen.queryByText("Apel Aktif")).not.toBeInTheDocument();
  });

  it("subLevelVersion TIDAK berubah (versi sama) -> node terbuka tetap terbuka", async () => {
    const user = userEvent.setup({ delay: null });
    axios.get
      .mockResolvedValueOnce(
        groupsResponse([{ key: "true", raw: 1, count: 2, aggregates: {} }]),
      )
      .mockResolvedValueOnce(rowsResponse(["Apel Aktif"]));
    const { update } = setup({ levels: nestedLevels, subLevelVersion: 0 });

    await user.click(header("fruit"));
    const child = await screen.findByRole("button", { name: /^true/ });
    await user.click(child);
    expect(await screen.findByText("Apel Aktif")).toBeInTheDocument();

    await act(async () => update({ subLevelVersion: 0 }));

    expect(screen.getByText("Apel Aktif")).toBeInTheDocument();
  });
});

describe("GroupTree — pager per node", () => {
  const bigResponse = (page) =>
    rowsResponse([`Baris hal ${page}`], {
      current_page: page,
      last_page: 3,
      total: 250,
      per_page: 100,
    });

  it("pager tampil di header node hanya bila total > per_page; mengatur halaman ANAK node itu", async () => {
    const user = userEvent.setup({ delay: null });
    axios.get.mockImplementation((_url, { params }) =>
      Promise.resolve(bigResponse(params.groupPage)),
    );
    setup();

    await user.click(header("fruit"));
    await screen.findByText("Baris hal 1");
    expect(
      screen.getByText("TR:core.datatable.group_pager.range"),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", {
        name: "TR:core.datatable.group_pager.next",
      }),
    );
    expect(await screen.findByText("Baris hal 2")).toBeInTheDocument();
    // BUKAN `.at(-1)` -- Requirement 21.8 (prefetch next-page) bikin halaman
    // BERIKUTNYA (3) ikut di-prefetch tepat setelah halaman 2 settle, jadi
    // panggilan TERAKHIR yg tercatat bisa saja milik prefetch itu, bukan klik
    // "next" itu sendiri. Cukup pastikan ADA panggilan utk halaman 2.
    expect(
      axios.get.mock.calls.some((call) => call[1].params.groupPage === 2),
    ).toBe(true);
  });

  it("klik pager TIDAK menutup header node", async () => {
    const user = userEvent.setup({ delay: null });
    axios.get.mockImplementation((_url, { params }) =>
      Promise.resolve(bigResponse(params.groupPage)),
    );
    setup();

    await user.click(header("fruit"));
    await screen.findByText("Baris hal 1");
    await user.click(
      screen.getByRole("button", {
        name: "TR:core.datatable.group_pager.next",
      }),
    );
    await screen.findByText("Baris hal 2");

    expect(header("fruit")).toHaveAttribute("aria-expanded", "true");
  });

  it("ganti halaman tak berkedip: isi halaman lama tetap tampil sampai halaman baru tiba (keepPreviousData)", async () => {
    const user = userEvent.setup({ delay: null });
    let resolvePage2;
    axios.get.mockImplementation((_url, { params }) =>
      params.groupPage === 1
        ? Promise.resolve(bigResponse(1))
        : new Promise((r) => (resolvePage2 = r)),
    );
    setup();

    await user.click(header("fruit"));
    await screen.findByText("Baris hal 1");
    await user.click(
      screen.getByRole("button", {
        name: "TR:core.datatable.group_pager.next",
      }),
    );

    // Halaman 2 belum tiba -> halaman 1 masih ada, TANPA skeleton loading.
    expect(screen.getByText("Baris hal 1")).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();

    resolvePage2(bigResponse(2));
    expect(await screen.findByText("Baris hal 2")).toBeInTheDocument();
  });

  it("halaman tiap node independen: node A di halaman 2 tidak mengubah node B", async () => {
    const user = userEvent.setup({ delay: null });
    axios.get.mockImplementation((_url, { params }) =>
      Promise.resolve(bigResponse(params.groupPage)),
    );
    setup();

    await user.click(header("fruit"));
    await screen.findByText("Baris hal 1");
    await user.click(
      screen.getByRole("button", {
        name: "TR:core.datatable.group_pager.next",
      }),
    );
    await screen.findByText("Baris hal 2");

    await user.click(header("vegetable"));
    // BUKAN hitungan total panggilan -- Requirement 21.8 (prefetch next-page)
    // menambah panggilan OTOMATIS (fruit halaman 3, lalu vegetable halaman 2)
    // di luar klik eksplisit user, jadi jumlahnya tak lagi deterministik 3.
    // Cari panggilan vegetable HALAMAN 1 secara spesifik (bukan `.at(-1)`,
    // yg bisa jadi prefetch vegetable halaman 2).
    const vegetableCall = await waitFor(() => {
      const call = axios.get.mock.calls.find(
        (c) =>
          c[1].params.groupPath === '["vegetable"]' &&
          c[1].params.groupPage === 1,
      );
      expect(call).toBeDefined();

      return call[1].params;
    });
    expect(vegetableCall.groupPath).toBe('["vegetable"]');
    expect(vegetableCall.groupPage).toBe(1);
    // Node "fruit" (halaman 2) TAK IKUT BERUBAH oleh dibukanya "vegetable".
    expect(screen.getByText("Baris hal 2")).toBeInTheDocument();
  });

  it("tanpa pager bila total <= per_page", async () => {
    const user = userEvent.setup({ delay: null });
    axios.get.mockResolvedValue(rowsResponse(["Apel"]));
    setup();

    await user.click(header("fruit"));
    await screen.findByText("Apel");

    expect(
      screen.queryByText("TR:core.datatable.group_pager.range"),
    ).not.toBeInTheDocument();
  });
});

describe("GroupTree — error, refetch, reset", () => {
  it("gagal fetch -> baris error hanya utk node itu + 'retry' memuat ulang", async () => {
    const user = userEvent.setup({ delay: null });
    axios.get
      .mockRejectedValueOnce(new Error("500"))
      .mockResolvedValueOnce(rowsResponse(["Pulih"]));
    setup();

    await user.click(header("fruit"));
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    // Header & grup lain tetap utuh.
    expect(header("vegetable")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "retry" }));

    expect(await screen.findByText("Pulih")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("`version` naik -> node TERBUKA di-refetch (mis. setelah hapus/reload)", async () => {
    const user = userEvent.setup({ delay: null });
    axios.get
      .mockResolvedValueOnce(rowsResponse(["Lama"]))
      .mockResolvedValueOnce(rowsResponse(["Baru"]));
    const { update } = setup({ version: 0 });

    await user.click(header("fruit"));
    await screen.findByText("Lama");

    update({ version: 1 });

    expect(await screen.findByText("Baru")).toBeInTheDocument();
    expect(axios.get).toHaveBeenCalledTimes(2);
    // Tetap terbuka (state terbuka TIDAK direset oleh version).
    expect(header("fruit")).toHaveAttribute("aria-expanded", "true");
  });

  it("parent me-remount via `key` -> semua grup kembali tertutup", async () => {
    const user = userEvent.setup({ delay: null });
    axios.get.mockResolvedValue(rowsResponse(["Apel"]));
    const client = makeClient();
    const wrap = (key) => (
      <QueryClientProvider client={client}>
        <GroupTree
          key={key}
          rootItems={rootItems}
          levels={levels}
          baseParams={baseParams}
          pathname="/orders"
          {...renderers}
        />
      </QueryClientProvider>
    );
    const { rerender } = render(wrap("a"));

    await user.click(header("fruit"));
    await screen.findByText("Apel");

    rerender(wrap("b"));

    expect(header("fruit")).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Apel")).not.toBeInTheDocument();
  });
});

describe("GroupPager — kontras tombol", () => {
  it("tombol sebelumnya/berikutnya berwarna primer, berborder & membulat (mudah terlihat)", () => {
    render(
      <GroupPager page={2} total={250} perPage={100} onPageChange={() => {}} />,
    );

    for (const name of [
      "TR:core.datatable.group_pager.previous",
      "TR:core.datatable.group_pager.next",
    ]) {
      const button = screen.getByRole("button", { name });
      expect(button.className).toContain("bg-primary");
      expect(button.className).toContain("text-primary-foreground");
      expect(button.className).toContain("border");
      expect(button.className).toContain("rounded-md");
    }
  });
});

describe("GroupPager", () => {
  const renderPager = (props) =>
    render(
      <GroupPager
        page={1}
        total={250}
        perPage={100}
        onPageChange={() => {}}
        {...props}
      />,
    );

  it("tidak render bila total <= perPage atau perPage kosong", () => {
    const { container, rerender } = renderPager({ total: 100 });
    expect(container).toBeEmptyDOMElement();

    rerender(
      <GroupPager page={1} total={250} perPage={0} onPageChange={() => {}} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("tombol sebelumnya disabled di halaman 1, berikutnya disabled di halaman terakhir", () => {
    const { rerender } = renderPager({ page: 1 });
    expect(
      screen.getByRole("button", {
        name: "TR:core.datatable.group_pager.previous",
      }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", {
        name: "TR:core.datatable.group_pager.next",
      }),
    ).toBeEnabled();

    rerender(
      <GroupPager page={3} total={250} perPage={100} onPageChange={() => {}} />,
    );
    expect(
      screen.getByRole("button", {
        name: "TR:core.datatable.group_pager.next",
      }),
    ).toBeDisabled();
  });

  it("onPageChange menerima halaman berikut/sebelumnya; klik tidak merambat ke induk", async () => {
    const user = userEvent.setup({ delay: null });
    const onPageChange = vi.fn();
    const onParentClick = vi.fn();
    render(
      <div onClick={onParentClick}>
        <GroupPager
          page={2}
          total={250}
          perPage={100}
          onPageChange={onPageChange}
        />
      </div>,
    );

    await user.click(
      screen.getByRole("button", {
        name: "TR:core.datatable.group_pager.next",
      }),
    );
    await user.click(
      screen.getByRole("button", {
        name: "TR:core.datatable.group_pager.previous",
      }),
    );

    expect(onPageChange).toHaveBeenNthCalledWith(1, 3);
    expect(onPageChange).toHaveBeenNthCalledWith(2, 1);
    expect(onParentClick).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Prefetch (Requirement 21.7-21.8, permintaan user): hover node tertutup &
// next-page node terbuka -- terpisah dari cek render, fokus ke KAPAN &
// PARAM APA axios.get dipanggil TANPA klik eksplisit.
// ---------------------------------------------------------------------------
describe("GroupTree — prefetch", () => {
  const bigResponse = (page) =>
    rowsResponse([`Baris hal ${page}`], {
      current_page: page,
      last_page: 3,
      total: 250,
      per_page: 100,
    });

  // Renderer LOKAL (bukan `renderers` bersama file ini) yg memasang
  // `onPrefetch` ke `onMouseEnter`/`onFocus` -- `userEvent.click()` di tes
  // LAIN file ini menyimulasikan hover sblm klik, jadi wiring ini sengaja
  // TIDAK ada di stub default (lihat komentar di atas `renderers`).
  const hoverAwareHeader = {
    ...renderers,
    renderGroupHeader: ({
      item,
      depth,
      level,
      isOpen,
      onToggle,
      pager,
      onPrefetch,
    }) => (
      <div
        role="button"
        aria-expanded={isOpen}
        data-depth={depth}
        data-level={level?.column}
        data-has-prefetch={onPrefetch ? "true" : "false"}
        onClick={onToggle}
        onMouseEnter={onPrefetch}
        onFocus={onPrefetch}
      >
        <span>{item.key}</span>
        <span>({item.count})</span>
        {pager}
      </div>
    ),
  };

  it("hover header node TERTUTUP memuat halaman 1 SEBELUM diklik; `onPrefetch` tak ada utk node yg SUDAH terbuka", async () => {
    const user = userEvent.setup({ delay: null });
    axios.get.mockResolvedValue(rowsResponse(["Apel"]));
    setup(hoverAwareHeader);

    expect(header("fruit")).toHaveAttribute("data-has-prefetch", "true");
    await user.hover(header("fruit"));
    await waitFor(() => expect(axios.get).toHaveBeenCalledTimes(1));
    expect(axios.get).toHaveBeenCalledWith(
      "/orders",
      expect.objectContaining({
        params: expect.objectContaining({
          groupPath: '["fruit"]',
          groupPage: 1,
        }),
      }),
    );
    // Belum diklik -- header masih tertutup, tanpa baris.
    expect(header("fruit")).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryAllByTestId("row")).toHaveLength(0);

    // Klik pakai cache yg SAMA (kunci identik) -- tampil TANPA baris
    // "loading" sama sekali (bukan cuma cepat, tapi instan). fireEvent (bukan
    // userEvent.click) supaya tak menyimulasikan hover LAGI di sini.
    fireEvent.click(header("fruit"));
    expect(await screen.findByText("Apel")).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();

    // Node yg SUDAH terbuka: `onPrefetch` tak diteruskan (hover tak berbuat apa2).
    expect(header("fruit")).toHaveAttribute("data-has-prefetch", "false");
    axios.get.mockClear();
    await user.hover(header("fruit"));
    expect(axios.get).not.toHaveBeenCalled();
  });

  it("mode infinite: `onPrefetch` tak pernah ada (hover tak berbuat apa2) -- rootMargin sentinel sendiri yg jadi prefetch", async () => {
    const user = userEvent.setup({ delay: null });
    axios.get.mockResolvedValue(rowsResponse(["Apel"]));
    setup({ ...hoverAwareHeader, infinite: true });

    expect(header("fruit")).toHaveAttribute("data-has-prefetch", "false");
    await user.hover(header("fruit"));
    expect(axios.get).not.toHaveBeenCalled();
  });

  it("begitu halaman AKTIF node terbuka settle, halaman BERIKUTNYA otomatis di-prefetch (klik 'next' pager jadi instan)", async () => {
    const user = userEvent.setup({ delay: null });
    axios.get.mockImplementation((_url, { params }) =>
      Promise.resolve(bigResponse(params.groupPage)),
    );
    setup();

    await user.click(header("fruit"));
    await screen.findByText("Baris hal 1");
    // Halaman 2 di-prefetch OTOMATIS, TANPA user menyentuh pager sama sekali.
    await waitFor(() =>
      expect(
        axios.get.mock.calls.some((call) => call[1].params.groupPage === 2),
      ).toBe(true),
    );

    axios.get.mockClear();
    await user.click(
      screen.getByRole("button", {
        name: "TR:core.datatable.group_pager.next",
      }),
    );
    // Sudah dari cache: teks halaman 2 langsung tampil TANPA baris "loading".
    expect(screen.getByText("Baris hal 2")).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("halaman TERAKHIR (page == lastPage) tak memicu prefetch lagi -- prefetch berhenti di ujung, tak pernah minta halaman 4", async () => {
    const user = userEvent.setup({ delay: null });
    axios.get.mockImplementation((_url, { params }) =>
      Promise.resolve(bigResponse(params.groupPage)),
    );
    setup();

    await user.click(header("fruit"));
    await screen.findByText("Baris hal 1");
    const next = () =>
      user.click(
        screen.getByRole("button", {
          name: "TR:core.datatable.group_pager.next",
        }),
      );
    await next();
    await screen.findByText("Baris hal 2");
    await next();
    await screen.findByText("Baris hal 3"); // 3 = last_page, tombol next jadi disabled

    // Beri kesempatan efek jalan (kalau ada bug, ini akan menambah panggilan).
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(
      axios.get.mock.calls.some((call) => call[1].params.groupPage === 4),
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Mode INFINITE SCROLL (mobile): halaman node dimuat saat sentinel terlihat
// ---------------------------------------------------------------------------
describe("GroupTree — infinite scroll (mobile)", () => {
  // jsdom tak punya IntersectionObserver: tiruan yang bisa dipicu manual.
  let observers;
  beforeEach(() => {
    observers = [];
    globalThis.IntersectionObserver = class {
      constructor(callback, options) {
        this.callback = callback;
        this.options = options;
        this.disconnected = false;
        observers.push(this);
      }
      observe() {}
      disconnect() {
        this.disconnected = true;
      }
    };
  });
  const intersect = () =>
    act(() => {
      observers
        .filter((observer) => !observer.disconnected)
        .forEach((observer) => observer.callback([{ isIntersecting: true }]));
    });

  const page = (n, total = 60, perPage = 25) => {
    const from = (n - 1) * perPage;
    const names = Array.from(
      { length: Math.min(perPage, total - from) },
      (_, i) => `r${from + i + 1}`,
    );

    return rowsResponse(names, { current_page: n, total, per_page: perPage });
  };

  it("buka grup memuat halaman 1 SAJA; tanpa pager tombol, header menampilkan 'dimuat / total'", async () => {
    const user = userEvent.setup({ delay: null });
    axios.get.mockResolvedValueOnce(page(1));
    setup({ infinite: true });

    await user.click(header("fruit"));

    expect(await screen.findAllByTestId("row")).toHaveLength(25);
    expect(axios.get).toHaveBeenCalledTimes(1);
    expect(axios.get.mock.calls[0][1].params.groupPage).toBe(1);
    expect(screen.getByTestId("group-loaded-info")).toHaveTextContent(
      "25 / 60",
    );
    expect(
      screen.queryByRole("button", {
        name: "TR:core.datatable.group_pager.next",
      }),
    ).toBeNull();
  });

  it("sentinel terlihat -> halaman 2 ditambahkan di bawah (bukan diganti); lalu 3 (halaman terakhir parsial); sentinel hilang saat semua termuat", async () => {
    const user = userEvent.setup({ delay: null });
    axios.get
      .mockResolvedValueOnce(page(1))
      .mockResolvedValueOnce(page(2))
      .mockResolvedValueOnce(page(3));
    setup({ infinite: true });
    await user.click(header("fruit"));
    await screen.findAllByTestId("row");

    intersect();
    await waitFor(() => expect(screen.getAllByTestId("row")).toHaveLength(50));
    expect(axios.get.mock.calls[1][1].params.groupPage).toBe(2);
    // Baris halaman 1 TETAP ada (ditambah, bukan diganti).
    expect(screen.getByText("r1")).toBeInTheDocument();
    expect(screen.getByText("r50")).toBeInTheDocument();

    intersect();
    await waitFor(() => expect(screen.getAllByTestId("row")).toHaveLength(60));
    expect(axios.get.mock.calls[2][1].params.groupPage).toBe(3);
    expect(screen.getByTestId("group-loaded-info")).toHaveTextContent(
      "60 / 60",
    );
    await waitFor(() =>
      expect(screen.queryByTestId("group-load-more")).toBeNull(),
    );
    expect(axios.get).toHaveBeenCalledTimes(3);
  });

  it("selagi memuat halaman berikutnya tampil renderLoading di dasar daftar (baris lama tetap)", async () => {
    const user = userEvent.setup({ delay: null });
    let resolveNext;
    axios.get
      .mockResolvedValueOnce(page(1))
      .mockReturnValueOnce(new Promise((resolve) => (resolveNext = resolve)));
    setup({ infinite: true });
    await user.click(header("fruit"));
    await screen.findAllByTestId("row");

    intersect();
    expect(await screen.findByRole("status")).toBeInTheDocument();
    expect(screen.getAllByTestId("row")).toHaveLength(25);

    resolveNext(page(2));
    await waitFor(() => expect(screen.getAllByTestId("row")).toHaveLength(50));
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("daftar yang muat 1 halaman: tanpa sentinel & tanpa info; sub-grup dimuat infinite juga", async () => {
    const user = userEvent.setup({ delay: null });
    axios.get.mockResolvedValueOnce(rowsResponse(["a", "b"]));
    setup({ infinite: true });

    await user.click(header("fruit"));
    await screen.findAllByTestId("row");

    expect(screen.queryByTestId("group-load-more")).toBeNull();
    expect(screen.queryByTestId("group-loaded-info")).toBeNull();
  });

  it("gagal memuat halaman berikutnya: baris lama tetap, 'coba lagi' hanya meminta halaman berikutnya", async () => {
    const user = userEvent.setup({ delay: null });
    axios.get
      .mockResolvedValueOnce(page(1))
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce(page(2));
    setup({ infinite: true });
    await user.click(header("fruit"));
    await screen.findAllByTestId("row");

    intersect();
    await user.click(await screen.findByRole("button", { name: "retry" }));

    await waitFor(() => expect(screen.getAllByTestId("row")).toHaveLength(50));
    expect(axios.get.mock.calls.at(-1)[1].params.groupPage).toBe(2);
  });

  it("mode biasa (tanpa `infinite`) tak memakai sentinel maupun info dimuat", async () => {
    const user = userEvent.setup({ delay: null });
    axios.get.mockResolvedValueOnce(page(1, 60, 25));
    setup();

    await user.click(header("fruit"));
    await screen.findAllByTestId("row");

    expect(screen.queryByTestId("group-load-more")).toBeNull();
    expect(screen.queryByTestId("group-loaded-info")).toBeNull();
    expect(observers).toHaveLength(0);
  });
});
