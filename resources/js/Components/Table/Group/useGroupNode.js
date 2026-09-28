// useGroupNode — fetch isi SATU node pohon grup saat dibuka (spec
// datatable2-group-tree, Requirement 14.2-14.4). Request expand = GET ke route
// index yang SAMA dgn halaman (macro dataTable() menjawab JSON), jadi scope
// per-controller (scopeVisible, sharedListing, branch, permission middleware,
// cookie kolom) ikut berlaku tanpa menyentuh 62 controller.

import {
  keepPreviousData,
  useInfiniteQuery,
  useQuery,
} from "@tanstack/react-query";
import QueryString from "qs";
import axios from "axios";

export const GROUP_NODE_QUERY_KEY = "datatable-group-node";

// Revisi 2026-09-27 (permintaan user "tercache hasilnya, lebih optimal"): dulu
// 30s -- terlalu pendek utk toggle tutup lalu buka lagi node yg baru saja
// dieksplor (child query di-unmount saat parent ditutup, lihat GroupTree.jsx).
// `staleTime: 0` TETAP dipertahankan (data transaksi, komentar di bawah) --
// gcTime hanya memperpanjang JENDELA "instant dari cache + revalidate diam2 di
// background" ala TanStack, bukan melonggarkan kesegaran data yg ditampilkan.
const GROUP_NODE_GC_TIME = 5 * 60 * 1000;
// staleTime KHUSUS panggilan prefetch (hover / next-page): cukup besar supaya
// hover berulang dalam beberapa detik tak memicu request berulang, TAPI query
// SUNGGUHAN (useGroupNode, staleTime:0) tetap revalidate diam2 saat node itu
// benar2 dibuka -- hasil prefetch cuma jadi tampilan awal instan, bukan sumber
// kebenaran akhir.
const PREFETCH_STALE_TIME = 15_000;

// qs (bukan serializer axios): param bersarang `groupGranularity[kolom]` dan
// `groupRange[kolom]` harus berbentuk SAMA dgn request halaman yang dibaca
// GroupLevels::fromWire() di backend.
const serializeParams = (params) =>
  QueryString.stringify(params, { skipNulls: true });

// Kunci cache stabil: urutan key param tak boleh mempengaruhi kunci.
const hashParams = (params) =>
  QueryString.stringify(params, {
    skipNulls: true,
    sort: (a, b) => a.localeCompare(b),
  });

/**
 * Bentuk queryKey MODE PAGED (bukan infinite) -- diekspor supaya prefetch
 * (hover node tertutup, next-page pager) memakai kunci cache YANG SAMA PERSIS
 * dgn `useGroupNode`; kunci yg meleset sedikit saja membuat hasil prefetch
 * mendarat di entry cache lain (tak pernah kepakai).
 * @param {object} root0
 * @param {string} root0.pathname
 * @param {object} root0.params
 * @param {Array} root0.rawPath
 * @param {number} root0.page
 * @param {number|string} root0.version
 */
export const groupNodeQueryKey = ({
  pathname,
  params,
  rawPath,
  page,
  version,
}) => [
  GROUP_NODE_QUERY_KEY,
  pathname,
  hashParams(params),
  rawPath,
  page,
  version,
];

/**
 * Fetcher mentah (mode paged) -- dipakai `useGroupNode` (queryFn) DAN prefetch
 * (`queryClient.prefetchQuery`) supaya request-nya identik.
 * @param {object} root0
 * @param {string} root0.pathname
 * @param {object} root0.params
 * @param {Array} root0.rawPath
 * @param {number} root0.page
 * @param {AbortSignal} [root0.signal]
 */
export const fetchGroupNode = async ({
  pathname,
  params,
  rawPath,
  page,
  signal,
}) => {
  const { data } = await axios.get(pathname, {
    params: { ...params, groupPath: JSON.stringify(rawPath), groupPage: page },
    paramsSerializer: serializeParams,
    signal,
  });
  return data;
};

/**
 * Prefetch SATU halaman node (mode paged) ke cache TanStack Query -- dipanggil
 * saat hover header node tertutup (Requirement 21.7: instan saat diklik) dan
 * otomatis utk halaman BERIKUTNYA node yg sedang terbuka (Requirement 21.8:
 * klik "next" pager terasa instan). `staleTime` sengaja LEBIH LONGGAR dari
 * query sungguhan -- lihat `PREFETCH_STALE_TIME`.
 * @param {import("@tanstack/react-query").QueryClient} queryClient
 * @param {object} args lihat `groupNodeQueryKey`/`fetchGroupNode`
 */
export const prefetchGroupNode = (queryClient, args) =>
  queryClient.prefetchQuery({
    queryKey: groupNodeQueryKey(args),
    queryFn: ({ signal }) => fetchGroupNode({ ...args, signal }),
    staleTime: PREFETCH_STALE_TIME,
  });

/**
 * @param {object} root0
 * @param {string} root0.pathname URL index halaman (window.location.pathname)
 * @param {object} root0.params param halaman (ziggy.query tanpa `page`) + group
 *   wire eksplisit -- LIHAT GroupTree.expandParams()
 * @param {Array} root0.rawPath nilai `raw` grup leluhur s/d node ini
 * @param {number} root0.page halaman ANAK node ini (param `groupPage`)
 * @param {boolean} root0.enabled fetch hanya saat node terbuka
 * @param {number|string} root0.version naik saat data level-0 berganti / Reload
 *   -> kunci baru -> node terbuka di-refetch
 */
export function useGroupNode({
  pathname,
  params,
  rawPath,
  page,
  enabled,
  version,
}) {
  return useQuery({
    queryKey: groupNodeQueryKey({ pathname, params, rawPath, page, version }),
    queryFn: ({ signal }) =>
      fetchGroupNode({ pathname, params, rawPath, page, signal }),
    enabled,
    // OVERRIDE WAJIB: default QueryClient app = 120_000 ms (dibuat utk block
    // dashboard). Data transaksi tak boleh basi 2 menit -- dokumen bisa berubah
    // oleh orang lain kapan saja.
    staleTime: 0,
    gcTime: GROUP_NODE_GC_TIME,
    // Ganti halaman node tak berkedip: isi lama tetap tampil sampai halaman baru tiba.
    placeholderData: keepPreviousData,
  });
}

/**
 * Varian INFINITE SCROLL (mode mobile): isi node dimuat halaman demi halaman
 * (`groupPage` 1, 2, 3, ...) dan ditambahkan di bawah yang sudah ada, bukan
 * diganti pager. Halaman berikutnya diminta `fetchNextPage()` (dipicu
 * IntersectionObserver di GroupTree, yg rootMargin 200px-nya SENDIRI sudah
 * berfungsi sbg prefetch -- lihat GroupTree.jsx). Kunci query berbeda dari
 * `useGroupNode` (memuat "infinite") agar tak berbagi cache berbentuk lain.
 * @param {object} root0 lihat `useGroupNode` (tanpa `page`)
 * @param {string} root0.pathname
 * @param {object} root0.params
 * @param {Array} root0.rawPath
 * @param {boolean} root0.enabled
 * @param {number|string} root0.version
 */
export function useGroupNodeInfinite({
  pathname,
  params,
  rawPath,
  enabled,
  version,
}) {
  return useInfiniteQuery({
    queryKey: [
      GROUP_NODE_QUERY_KEY,
      "infinite",
      pathname,
      hashParams(params),
      rawPath,
      version,
    ],
    queryFn: ({ pageParam, signal }) =>
      fetchGroupNode({ pathname, params, rawPath, page: pageParam, signal }),
    initialPageParam: 1,
    // Ada halaman berikutnya selama yang sudah dimuat < total.
    getNextPageParam: (lastPage, allPages) =>
      lastPage.per_page && allPages.length * lastPage.per_page < lastPage.total
        ? allPages.length + 1
        : undefined,
    enabled,
    staleTime: 0,
    gcTime: GROUP_NODE_GC_TIME,
  });
}
