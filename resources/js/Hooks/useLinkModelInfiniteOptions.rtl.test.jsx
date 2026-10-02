import { beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";

vi.mock("laravel-react-i18n", () => ({
  useLaravelReactI18n: () => ({ t: (key) => `TR:${key}` }),
}));

const axiosPost = vi.fn();
vi.mock("axios", () => ({
  default: { post: (...args) => axiosPost(...args) },
}));

window.route = (name) => name;

import useLinkModelInfiniteOptions, {
  buildLinkModelGroupPayload,
  fetchLinkModelGroupNode,
  LINKMODEL_PAGE_SIZE,
} from "./useLinkModelInfiniteOptions";

const wrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });

  const Wrapper = ({ children }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  return Wrapper;
};

const flat = (rows, over = {}) => ({
  data: {
    data: rows,
    total: rows.length,
    current_page: 1,
    last_page: 1,
    per_page: LINKMODEL_PAGE_SIZE,
    ...over,
  },
});
const levels = [{ column: "category", granularity: null, range: null, type: "string" }];

describe("buildLinkModelGroupPayload", () => {
  it("opt-in groupTree, tanpa limit; group hanya bila diberikan", () => {
    const base = buildLinkModelGroupPayload({ model: "M", filters: { a: 1 } });
    expect(base.groupTree).toBe(true);
    expect(base.limit).toBeUndefined();
    expect(base.cacheMode).toBe(false);
    expect(base.filters).toEqual({ a: 1 });
    expect("group" in base).toBe(false);

    expect(buildLinkModelGroupPayload({ model: "M", group: [] }).group).toEqual([]);
  });
});

describe("fetchLinkModelGroupNode", () => {
  beforeEach(() => {
    // Blok {}: `mockReset()` mengembalikan fungsi mock-nya sendiri, dan vitest
    // memperlakukan fungsi yang dikembalikan hook sbg callback cleanup
    // (dipanggil tanpa argumen setelah tes).
    axiosPost.mockReset();
  });

  it("POST route model dengan groupPath (JSON), groupPage, dan show", async () => {
    axiosPost.mockResolvedValue({ data: { type: "rows", data: [] } });

    const data = await fetchLinkModelGroupNode({
      params: { model: "M", group: [] },
      rawPath: ["a", null],
      page: 2,
    });

    expect(data.type).toBe("rows");
    expect(axiosPost).toHaveBeenCalledWith(
      "model",
      { model: "M", group: [], groupPath: '["a",null]', groupPage: 2, show: LINKMODEL_PAGE_SIZE },
      { signal: undefined },
    );
  });
});

describe("useLinkModelInfiniteOptions", () => {
  beforeEach(() => {
    // Blok {}: `mockReset()` mengembalikan fungsi mock-nya sendiri, dan vitest
    // memperlakukan fungsi yang dikembalikan hook sbg callback cleanup
    // (dipanggil tanpa argumen setelah tes).
    axiosPost.mockReset();
  });

  it("tidak fetch saat dropdown tertutup", () => {
    renderHook(() => useLinkModelInfiniteOptions({ model: "M", open: false }), {
      wrapper: wrapper(),
    });

    expect(axiosPost).not.toHaveBeenCalled();
  });

  it("flat: halaman pertama tanpa limit; fetchNextPage menambahkan halaman berikutnya", async () => {
    axiosPost.mockImplementation((_url, payload) =>
      Promise.resolve(
        payload.page === 2
          ? flat([{ id: 3 }], { current_page: 2, last_page: 2, total: 3 })
          : flat([{ id: 1 }, { id: 2 }], { current_page: 1, last_page: 2, total: 3 }),
      ),
    );
    const { result } = renderHook(
      () => useLinkModelInfiniteOptions({ model: "M", open: true }),
      { wrapper: wrapper() },
    );

    await waitFor(() => expect(result.current.options).toHaveLength(2));
    expect(result.current.isGrouped).toBe(false);
    expect(result.current.hasNextPage).toBe(true);
    expect(axiosPost.mock.calls[0][1]).toMatchObject({ page: 1, show: LINKMODEL_PAGE_SIZE, groupTree: true });
    expect(axiosPost.mock.calls[0][1].limit).toBeUndefined();

    await act(async () => {
      await result.current.fetchNextPage();
    });

    await waitFor(() => expect(result.current.options.map((o) => o.id)).toEqual([1, 2, 3]));
    expect(result.current.hasNextPage).toBe(false);
  });

  it("grup: level-0 sbg rootItems + groupMeta/defaultGroups; baseParams membawa grup EFEKTIF tanpa groupTree", async () => {
    axiosPost.mockResolvedValue({
      data: {
        type: "groups",
        data: [{ key: "a", raw: "a", count: 2, aggregates: {} }],
        current_page: 1,
        last_page: 1,
        total: 1,
        per_page: 25,
        groupMeta: { levels, aggregates: [] },
        defaultGroups: levels,
      },
    });
    const { result } = renderHook(
      () => useLinkModelInfiniteOptions({ model: "M", open: true, search: "", filters: { f: 1 } }),
      { wrapper: wrapper() },
    );

    await waitFor(() => expect(result.current.isGrouped).toBe(true));
    expect(result.current.rootItems).toHaveLength(1);
    expect(result.current.options).toEqual([]);
    expect(result.current.defaultGroups).toEqual(levels);
    expect(result.current.baseParams.group).toEqual([
      { column: "category", granularity: null, range: null },
    ]);
    expect(result.current.baseParams.groupTree).toBeUndefined();
    expect(result.current.baseParams.filters).toEqual({ f: 1 });
  });

  it("group eksplisit dikirim; ganti group -> request baru dari halaman 1", async () => {
    axiosPost.mockResolvedValue(flat([{ id: 1 }]));
    const { result, rerender } = renderHook(
      ({ group }) => useLinkModelInfiniteOptions({ model: "M", open: true, group }),
      { wrapper: wrapper(), initialProps: { group: [] } },
    );
    await waitFor(() => expect(result.current.options).toHaveLength(1));
    expect(axiosPost.mock.calls[0][1].group).toEqual([]);

    rerender({ group: levels });
    await waitFor(() => expect(axiosPost).toHaveBeenCalledTimes(2));
    expect(axiosPost.mock.calls[1][1]).toMatchObject({ group: levels, page: 1 });
  });

  it("gagal fetch -> daftar kosong tanpa melempar", async () => {
    axiosPost.mockRejectedValue(new Error("boom"));
    const { result } = renderHook(
      () => useLinkModelInfiniteOptions({ model: "M", open: true }),
      { wrapper: wrapper() },
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.options).toEqual([]);
  });
});
