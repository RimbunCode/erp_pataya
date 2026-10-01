// GroupTree — pohon grup lazy (spec datatable2-group-tree, Requirement 14).
// Level-0 datang dari halaman (Inertia `data.data`, dipaginasi Pagination
// outer); isi tiap grup (sub-grup atau baris) baru di-fetch saat grup itu
// DIBUKA (useGroupNode). Render lewat render-prop sehingga SATU pohon dipakai
// desktop (`<tr>`) dan mobile (kartu):
//
//   <GroupTree key={resetKey} ... />   // key = reset state terbuka (lihat di bawah)
//
// State "terbuka" & halaman-per-node dipegang di sini (bukan state per node)
// supaya reset terkontrol: parent me-*remount* pohon (via `key`) saat halaman
// server berganti -- diturunkan dari `ziggy.query` (URL yang benar-benar
// dirender server), BUKAN dari `options` pending yang di-debounce (kalau tidak,
// tabel lama menutup sebelum data baru tiba). Default SEMUA tertutup.

import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useQueryClient } from "@tanstack/react-query";

import GroupPager from "./GroupPager";
import {
  prefetchGroupNode,
  useGroupNode,
  useGroupNodeInfinite,
} from "./useGroupNode";

// Sentinel infinite scroll (mode mobile): saat masuk layar (IntersectionObserver,
// margin 200px) -> minta halaman berikutnya node. Selagi memuat, tampil
// `renderLoading` (ikon + teks "Memuat"). Observer dibuat ulang tiap selesai
// memuat: bila sentinel masih terlihat (daftar pendek), halaman berikutnya
// langsung diminta lagi sampai memenuhi layar.
function LoadMoreSentinel({ onVisible, isFetching, depth, renderLoading }) {
  const ref = useRef(null);

  useEffect(() => {
    const element = ref.current;
    if (!element || isFetching || typeof IntersectionObserver === "undefined") {
      return undefined;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) onVisible();
      },
      { rootMargin: "200px" },
    );
    observer.observe(element);

    return () => observer.disconnect();
  }, [onVisible, isFetching]);

  return (
    <div ref={ref} data-testid="group-load-more">
      {isFetching ? renderLoading({ depth }) : null}
    </div>
  );
}

// Info "25 / 210" di header node pada mode infinite scroll (pengganti pager).
function LoadedInfo({ loaded, total }) {
  return (
    <span
      data-testid="group-loaded-info"
      className="ml-auto text-xs font-normal text-muted-foreground"
    >
      {loaded} / {total}
    </span>
  );
}

function GroupNodeList({ items, depth, parentPath, ctx }) {
  return items.map((item) => (
    <GroupNode
      key={item.key}
      item={item}
      depth={depth}
      path={[...parentPath, item.raw]}
      ctx={ctx}
    />
  ));
}

function GroupNode({ item, depth, path, ctx }) {
  const pathKey = JSON.stringify(path);
  const isOpen = ctx.openKeys.has(pathKey);
  const page = ctx.pages[pathKey] ?? 1;
  // Kedua hook selalu dipanggil (urutan hook tetap); yang tak dipakai `enabled:
  // false` sehingga diam.
  const paged = useGroupNode({
    pathname: ctx.pathname,
    params: ctx.baseParams,
    rawPath: path,
    page,
    enabled: isOpen && !ctx.infinite,
    version: ctx.version,
  });
  const infinite = useGroupNodeInfinite({
    pathname: ctx.pathname,
    params: ctx.baseParams,
    rawPath: path,
    enabled: isOpen && ctx.infinite,
    version: ctx.version,
  });
  const query = ctx.infinite ? infinite : paged;
  // Mode infinite: gabungkan semua halaman yang sudah dimuat jadi satu daftar.
  const node = useMemo(() => {
    if (!ctx.infinite) return paged.data;
    const pages = infinite.data?.pages;
    if (!pages?.length) return undefined;

    return { ...pages[0], data: pages.flatMap((entry) => entry.data) };
  }, [ctx.infinite, paged.data, infinite.data]);

  // Prefetch (Requirement 21.7-21.8, permintaan user): hover/fokus header node
  // TERTUTUP -> mulai muat halaman 1 sebelum diklik, jadi terasa instan saat
  // dibuka. Hanya mode PAGED -- mode infinite (mobile) sudah punya prefetch-nya
  // sendiri lewat `rootMargin` sentinel di bawah.
  const onPrefetch =
    !isOpen && !ctx.infinite
      ? () =>
          prefetchGroupNode(ctx.queryClient, {
            pathname: ctx.pathname,
            params: ctx.baseParams,
            rawPath: path,
            page: 1,
            version: ctx.version,
          })
      : undefined;

  // Prefetch halaman BERIKUTNYA node yg sedang terbuka (mode paged) begitu
  // halaman aktif termuat -- klik "next" pager jadi instan. Efek, bukan
  // dipanggil langsung saat render: baru jalan setelah `node`/`page` benar2
  // menetap (commit), tak duplikat dgn fetch halaman aktif itu sendiri.
  // `isPlaceholderData` WAJIB dicek: selama halaman baru masih dimuat,
  // `node` (via `keepPreviousData`) sementara menampilkan data HALAMAN LAMA --
  // `total`/`per_page`-nya bisa "kebetulan" tetap sama, tapi memakainya utk
  // hitung halaman berikutnya SEBELUM data halaman aktif benar2 tiba memicu
  // prefetch ke halaman yg SALAH (bug nyata: prefetch page 3 saat baru pindah
  // ke page 2, page 2 sendiri belum settle -- ketahuan dari test yg gagal).
  useEffect(() => {
    if (ctx.infinite || !isOpen || paged.isPlaceholderData || !node?.per_page) {
      return undefined;
    }
    const lastPage = Math.ceil(node.total / node.per_page);
    if (page >= lastPage) return undefined;

    prefetchGroupNode(ctx.queryClient, {
      pathname: ctx.pathname,
      params: ctx.baseParams,
      rawPath: path,
      page: page + 1,
      version: ctx.version,
    });

    return undefined;
  }, [
    ctx.infinite,
    ctx.queryClient,
    ctx.pathname,
    ctx.baseParams,
    ctx.version,
    isOpen,
    paged.isPlaceholderData,
    node,
    page,
    path,
  ]);

  // Pager mengatur halaman ANAK node ini; tampil (di header) hanya bila perlu.
  // Mode infinite: info "dimuat / total" saja (tanpa tombol halaman).
  let pager = null;
  if (isOpen && node) {
    pager = ctx.infinite ? (
      node.total > node.per_page ? (
        <LoadedInfo loaded={node.data.length} total={node.total} />
      ) : null
    ) : (
      <GroupPager
        page={page}
        total={node.total}
        perPage={node.per_page}
        onPageChange={(next) => ctx.setPage(pathKey, next)}
      />
    );
  }

  let body = null;
  if (isOpen) {
    const list = node ? (
      node.type === "groups" ? (
        <GroupNodeList
          items={node.data}
          depth={depth + 1}
          parentPath={path}
          ctx={ctx}
        />
      ) : (
        node.data.map((row, index) => (
          <Fragment key={row.id ?? index}>
            {ctx.renderRow(row, { depth: depth + 1, index })}
          </Fragment>
        ))
      )
    ) : null;

    if (query.isError && !node) {
      body = ctx.renderError({
        depth: depth + 1,
        onRetry: () => query.refetch(),
      });
    } else if (!node) {
      body = ctx.renderLoading({ depth: depth + 1 });
    } else if (ctx.infinite) {
      body = (
        <>
          {list}
          {query.isError ? (
            // Gagal memuat halaman berikutnya: baris yg sudah ada tetap tampil,
            // "Coba lagi" meminta ulang halaman berikutnya saja.
            ctx.renderError({
              depth: depth + 1,
              onRetry: () => infinite.fetchNextPage(),
            })
          ) : infinite.hasNextPage ? (
            <LoadMoreSentinel
              onVisible={infinite.fetchNextPage}
              isFetching={infinite.isFetchingNextPage}
              depth={depth + 1}
              renderLoading={ctx.renderLoading}
            />
          ) : null}
        </>
      );
    } else {
      body = list;
    }
  }

  return (
    <>
      {ctx.renderGroupHeader({
        item,
        depth,
        level: ctx.levels[depth],
        isOpen,
        onToggle: () => ctx.toggle(pathKey),
        pager,
        onPrefetch,
      })}
      {body}
    </>
  );
}

/**
 * @param {object} root0
 * @param {Array} root0.rootItems deskriptor grup level-0 (`data.data` halaman)
 * @param {Array<{column: string, granularity: *, range: *, type: string}>} root0.levels `groupMeta.levels`
 * @param {object} root0.baseParams param expand (lihat buildExpandParams)
 * @param {string} [root0.pathname] URL index (default window.location.pathname)
 * @param {number|string} [root0.version] naik -> node terbuka di-refetch
 * @param {number|string} [root0.subLevelVersion] naik -> node TERBUKA di
 *   kedalaman >=1 dipaksa tertutup (Requirement 24, ganti sub-level grup:
 *   identitas node di bawah level 0 tak valid lagi)
 * @param {boolean} [root0.infinite] mode INFINITE SCROLL (mobile): isi node
 *   dimuat halaman demi halaman saat sentinel di dasar daftar terlihat, tanpa
 *   pager; header menampilkan "dimuat / total"
 * @param {(args: {item: object, depth: number, level: object, isOpen: boolean, onToggle: () => void, pager: *, onPrefetch: (() => void)|undefined}) => *} root0.renderGroupHeader
 *   `onPrefetch` (hanya ada saat node TERTUTUP & mode paged) -- pasang di
 *   `onMouseEnter`/`onFocus` elemen header supaya isinya mulai dimuat sebelum
 *   diklik (Requirement 21.7)
 * @param {(row: object, args: {depth: number, index: number}) => *} root0.renderRow
 * @param {(args: {depth: number}) => *} root0.renderLoading
 * @param {(args: {depth: number, onRetry: () => void}) => *} root0.renderError
 */
export default function GroupTree({
  rootItems,
  levels,
  baseParams,
  pathname = typeof window === "undefined" ? "/" : window.location.pathname,
  version = 0,
  subLevelVersion = 0,
  infinite = false,
  renderGroupHeader,
  renderRow,
  renderLoading,
  renderError,
}) {
  const [openKeys, setOpenKeys] = useState(() => new Set());
  const [pages, setPages] = useState({});
  // Requirement 24 (permintaan user): ubah SUB-level grup (kolom level 1 ke
  // bawah), level 0 (root) tak berubah -> daftar grup level-0 tetap valid,
  // reload Inertia dilewati (baseParams berubah -> TanStack otomatis refetch
  // via kunci cache baru, lihat useGroupNode.js). TAPI node yg SUDAH terbuka
  // di kedalaman >=1 (path.length > 1) identitasnya jadi TAK VALID lagi --
  // nilai `raw`-nya menunjuk kolom LAMA (mis. id customer), sedangkan server
  // sekarang membaca posisi itu sbg kolom BARU (mis. status); dipaksa
  // tertutup di sini, user membukanya lagi -> fetch normal dgn sub-level yg
  // baru. `pages` DIRESET SEMUA (bukan cuma kedalaman >=1) -- pagination
  // anak SETIAP node (termasuk depth 0 yg tetap terbuka) berubah krn jumlah
  // & urutan sub-grup di bawahnya berbeda; halaman lama bisa nunjuk ke
  // halaman yg sekarang tak ada / isinya beda.
  const prevSubLevelVersionRef = useRef(subLevelVersion);
  if (prevSubLevelVersionRef.current !== subLevelVersion) {
    prevSubLevelVersionRef.current = subLevelVersion;
    setOpenKeys((prev) => {
      const pruned = [...prev].filter((key) => JSON.parse(key).length <= 1);
      return pruned.length === prev.size ? prev : new Set(pruned);
    });
    setPages((prev) => (Object.keys(prev).length === 0 ? prev : {}));
  }
  // Prefetch (hover node tertutup, next-page pager) menulis ke cache TanStack
  // Query YANG SAMA dgn `useGroupNode`/`useGroupNodeInfinite` -- ambil instance
  // dari QueryClientProvider ancestor (sudah wajib ada, `useGroupNode` sendiri
  // butuh itu).
  const queryClient = useQueryClient();

  const toggle = useCallback((pathKey) => {
    setOpenKeys((prev) => {
      const next = new Set(prev);
      if (next.has(pathKey)) next.delete(pathKey);
      else next.add(pathKey);
      return next;
    });
  }, []);
  const setPage = useCallback((pathKey, page) => {
    setPages((prev) => ({ ...prev, [pathKey]: page }));
  }, []);

  const ctx = useMemo(
    () => ({
      openKeys,
      pages,
      toggle,
      setPage,
      levels,
      baseParams,
      pathname,
      version,
      infinite,
      queryClient,
      renderGroupHeader,
      renderRow,
      renderLoading,
      renderError,
    }),
    [
      openKeys,
      pages,
      toggle,
      setPage,
      levels,
      baseParams,
      pathname,
      version,
      infinite,
      queryClient,
      renderGroupHeader,
      renderRow,
      renderLoading,
      renderError,
    ],
  );

  return (
    <GroupNodeList items={rootItems} depth={0} parentPath={[]} ctx={ctx} />
  );
}
