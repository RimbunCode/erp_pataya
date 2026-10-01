// Fungsi murni (bukan hook) yg diekstrak dari useGroupNode.js supaya prefetch
// (hover node tertutup, next-page pager -- lihat GroupTree.jsx) memakai
// bentuk queryKey & fetcher yg IDENTIK dgn `useGroupNode`. Perilaku hook itu
// sendiri (integrasi React Query) sudah diuji lewat GroupTree.rtl.test.jsx.
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("axios", () => ({ default: { get: vi.fn() } }));

import axios from "axios";
import {
  fetchGroupNode,
  groupNodeQueryKey,
  prefetchGroupNode,
} from "./useGroupNode";

const args = {
  pathname: "/orders",
  params: { fid: "f1", sort: "-name", group: "category" },
  rawPath: ["fruit"],
  page: 2,
  version: 3,
};

describe("groupNodeQueryKey", () => {
  it("bentuknya stabil: [GROUP_NODE_QUERY_KEY, pathname, hashParams, rawPath, page, version]", () => {
    expect(groupNodeQueryKey(args)).toEqual([
      "datatable-group-node",
      "/orders",
      expect.any(String),
      ["fruit"],
      2,
      3,
    ]);
  });

  it("urutan key di `params` TIDAK mempengaruhi kunci (params diurutkan sebelum di-hash)", () => {
    const a = groupNodeQueryKey(args);
    const b = groupNodeQueryKey({
      ...args,
      params: { group: "category", fid: "f1", sort: "-name" },
    });

    expect(a).toEqual(b);
  });

  it("`page`/`version`/`rawPath` beda -> kunci beda (masing2 entry cache terpisah)", () => {
    const base = groupNodeQueryKey(args);
    expect(groupNodeQueryKey({ ...args, page: 3 })).not.toEqual(base);
    expect(groupNodeQueryKey({ ...args, version: 4 })).not.toEqual(base);
    expect(groupNodeQueryKey({ ...args, rawPath: ["vegetable"] })).not.toEqual(
      base,
    );
  });
});

describe("fetchGroupNode", () => {
  beforeEach(() => {
    axios.get.mockReset();
    axios.get.mockResolvedValue({ data: { type: "rows", data: [] } });
  });

  it("GET ke `pathname` dgn groupPath (JSON) + groupPage + param halaman lainnya; mengembalikan `data`", async () => {
    const result = await fetchGroupNode(args);

    expect(axios.get).toHaveBeenCalledWith(
      "/orders",
      expect.objectContaining({
        params: expect.objectContaining({
          fid: "f1",
          sort: "-name",
          group: "category",
          groupPath: '["fruit"]',
          groupPage: 2,
        }),
      }),
    );
    expect(result).toEqual({ type: "rows", data: [] });
  });

  it("meneruskan AbortSignal ke axios (dibatalkan saat query di-unmount/berganti)", async () => {
    const signal = new AbortController().signal;
    await fetchGroupNode({ ...args, signal });

    expect(axios.get.mock.calls[0][1].signal).toBe(signal);
  });
});

describe("fetchGroupNode FIFO concurrency queue (permintaan user, revisi 2026-09-28)", () => {
  beforeEach(() => {
    axios.get.mockReset();
  });

  it("maksimal 4 axios.get berjalan bersamaan; sisanya antre lalu ikut jalan begitu slot kosong", async () => {
    const deferreds = [];
    axios.get.mockImplementation(
      () =>
        new Promise((resolve) => {
          deferreds.push(resolve);
        }),
    );

    const calls = Array.from({ length: 6 }, (_, i) =>
      fetchGroupNode({ ...args, page: i + 1 }),
    );

    // Job pertama synchronous sampai limit -- tanpa nunggu microtask apapun
    // (executor Promise & .then chain queue jalan sync saat dipanggil).
    expect(axios.get).toHaveBeenCalledTimes(4);

    // Selesaikan 2 yang pertama -> 2 slot kosong -> 2 job antre mulai jalan.
    deferreds[0]({ data: { done: 0 } });
    deferreds[1]({ data: { done: 1 } });
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(axios.get).toHaveBeenCalledTimes(6);

    deferreds[2]({ data: {} });
    deferreds[3]({ data: {} });
    deferreds[4]({ data: {} });
    deferreds[5]({ data: {} });

    const results = await Promise.all(calls);
    expect(results).toHaveLength(6);
  });

  it("job yang masih ANTRE (belum sempat axios.get) dan di-abort langsung dibuang dari antrean -- tak pernah menyentuh network", async () => {
    const deferreds = [];
    axios.get.mockImplementation(
      () =>
        new Promise((resolve) => {
          deferreds.push(resolve);
        }),
    );
    const controller = new AbortController();

    // 4 job pertama pakai slot; job ke-5 (dgn signal) masih antre.
    const blocking = Array.from({ length: 4 }, (_, i) =>
      fetchGroupNode({ ...args, page: i + 1 }),
    );
    const queuedPromise = fetchGroupNode({
      ...args,
      page: 99,
      signal: controller.signal,
    });

    expect(axios.get).toHaveBeenCalledTimes(4);

    controller.abort();
    await expect(queuedPromise).rejects.toBeTruthy();
    // Job yang di-abort TIDAK ikut menambah panggilan axios.get -- masih 4.
    expect(axios.get).toHaveBeenCalledTimes(4);

    deferreds.forEach((resolve) => resolve({ data: {} }));
    await Promise.all(blocking);
  });
});

describe("prefetchGroupNode", () => {
  it("memanggil queryClient.prefetchQuery dgn queryKey IDENTIK groupNodeQueryKey(args) & staleTime longgar (bukan 0)", () => {
    const queryClient = { prefetchQuery: vi.fn() };

    prefetchGroupNode(queryClient, args);

    expect(queryClient.prefetchQuery).toHaveBeenCalledTimes(1);
    const call = queryClient.prefetchQuery.mock.calls[0][0];
    expect(call.queryKey).toEqual(groupNodeQueryKey(args));
    expect(call.staleTime).toBeGreaterThan(0);
    expect(typeof call.queryFn).toBe("function");
  });

  it("queryFn hasil prefetchQuery benar2 memanggil fetchGroupNode (bukan fetcher lain yg meleset)", async () => {
    axios.get.mockReset();
    axios.get.mockResolvedValue({ data: { type: "groups", data: [] } });
    const queryClient = { prefetchQuery: vi.fn() };

    prefetchGroupNode(queryClient, args);
    const { queryFn } = queryClient.prefetchQuery.mock.calls[0][0];
    const result = await queryFn({ signal: undefined });

    expect(result).toEqual({ type: "groups", data: [] });
    expect(axios.get).toHaveBeenCalledWith(
      "/orders",
      expect.objectContaining({
        params: expect.objectContaining({ groupPage: 2 }),
      }),
    );
  });
});
