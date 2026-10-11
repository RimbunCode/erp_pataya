import { useEffect, useMemo, useState } from "react";

import axios from "axios";
import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";

function stableStringify(val) {
  try {
    return JSON.stringify(val, (_key, value) => {
      if (value && typeof value === "object" && !Array.isArray(value)) {
        return Object.keys(value)
          .sort()
          .reduce((acc, k) => {
            acc[k] = value[k];
            return acc;
          }, {});
      }
      return value;
    });
  } catch {
    return JSON.stringify(val);
  }
}

/**
 * Bangun peta kolom Advance Search Dialog dari `columns` mentah hasil
 * `model.selectData` -- dibatasi ke kolom sumber templateLink (locked) +
 * kolom data linkable lain (togglable). `templateLinkColumnNames` datang
 * LANGSUNG dari field response `templateLinkColumns` -- bukan heuristik.
 *
 * Klarifikasi keamanan: filter `linkable===true` di sini HANYA mengontrol
 * kolom mana yang jadi HEADER TABEL (UX). Keamanan sesungguhnya (kolom mana
 * yang benar-benar berisi data) ditentukan SERVER via `filterRowColumns()` +
 * `safeLookupColumns($includeAllLinkable=true)` -- fail-safe berlapis, sama
 * prinsip spec linkmodel-column-security.
 * @param {Array<object>} rawColumns
 * @param {string[]} [templateLinkColumnNames]
 * @returns {{[name: string]: object & {locked: boolean}}}
 */
export function buildAdvanceSearchColumnMap(
  rawColumns,
  templateLinkColumnNames = [],
) {
  const isTemplateLinkSource = (c) => templateLinkColumnNames.includes(c.name);
  const map = {};
  (rawColumns ?? [])
    .filter(
      (c) =>
        !c.hidden &&
        !c.ignore &&
        c.type !== "relations" &&
        c.type !== "mixed" &&
        c.type !== "json",
    )
    .filter((c) => c.linkable === true || isTemplateLinkSource(c))
    .forEach((c) => {
      const locked = isTemplateLinkSource(c);
      map[c.name] = { ...c, locked, show: c.show ?? locked };
    });
  return map;
}

/**
 * Peta kolom untuk FilterTable -- SEMUA kolom schema, BUKAN cuma yang linkable
 * (beda dari `buildAdvanceSearchColumnMap`). Gate `linkable` mengatur kolom yang
 * di-SELECT/tampil di tabel; backend mengevaluasi `filters` terhadap schema penuh
 * (`$target::getColumns(1)` di `ModelController::selectData()`), jadi membatasi
 * kolom filter ke yang linkable cuma memangkas UX tanpa manfaat keamanan.
 * FilterItem2 sendiri sudah menyaring searchable===false/hidden/ignore.
 * @param {Array<object>} rawColumns
 * @returns {{[name: string]: object}}
 */
export function buildAdvanceSearchFilterColumnMap(rawColumns) {
  const map = {};
  (rawColumns ?? []).forEach((c) => {
    if (c?.name) map[c.name] = c;
  });
  return map;
}

const PER_PAGE = 25;
const SEARCH_DEBOUNCE_MS = 300;

/**
 * Fetcher `GroupTree` utk isi sebuah node Advance Search (POST `model.selectData`
 * dgn `groupPath`/`groupPage`). `params` = payload dasar dgn `group` EFEKTIF
 * eksplisit (spec linkmodel-grouping-search Requirement 4). Respons sudah
 * tersaring kolom aman di server.
 * @param {object} root0
 * @param {object} root0.params
 * @param {Array} root0.rawPath
 * @param {number} root0.page
 * @param {AbortSignal} [root0.signal]
 */
export const fetchAdvanceGroupNode = async ({
  params,
  rawPath,
  page,
  signal,
}) => {
  const { data } = await axios.post(
    window.route("model.selectData"),
    {
      ...params,
      groupPath: JSON.stringify(rawPath),
      groupPage: page,
      show: PER_PAGE,
    },
    { signal },
  );

  return data;
};

/**
 * Hook fetch Advance Search Dialog -- infinite scroll via `useInfiniteQuery`
 * (TanStack Query, sudah dependency existing) ke `model.selectData` dengan
 * `includeAllLinkable: true` (SEMUA kolom linkable ikut, terlepas dari prop
 * `fields` instance LinkModel -- Requirement 2.3).
 * @param {object} params
 * @param {string} params.model
 * @param {object} [params.baseFilters] prop `filters` LinkModel (non-editable, apa adanya)
 * @param {object} [params.additiveFilters] tree FilterBuilder dari FilterTable (editable)
 * @param {string} [params.search]
 * @param {object|Array} [params.joins]
 * @param {object|Array} [params.with]
 * @param {string} [params.order]
 * @param {string} [params.translate]
 * @param {Array<{column: string, granularity: *, range: *}>} [params.group]
 *   grup EFEKTIF (`undefined` = default model di server, `[]` = tanpa grup)
 * @param {string} [params.groupSort] 'asc' | 'desc' -- urutan nilai grup
 * @param {boolean} params.open dialog terbuka -- gate fetch
 * @returns {object}
 */
export default function useAdvanceSearchModel({
  model,
  baseFilters,
  additiveFilters,
  search,
  joins,
  with: withParam,
  order,
  translate,
  group,
  groupSort,
  open,
}) {
  const [debouncedSearch, setDebouncedSearch] = useState(search ?? "");
  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedSearch(search ?? "");
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timeout);
  }, [search]);

  const baseFiltersKey = useMemo(
    () => stableStringify(baseFilters),
    [baseFilters],
  );
  const additiveFiltersKey = useMemo(
    () => stableStringify(additiveFilters),
    [additiveFilters],
  );

  const groupKey = useMemo(() => stableStringify(group), [group]);

  const query = useInfiniteQuery({
    queryKey: [
      "linkModel",
      "advanceSearch",
      model,
      baseFiltersKey,
      additiveFiltersKey,
      debouncedSearch,
      order,
      groupKey,
      groupSort,
    ],
    queryFn: async ({ pageParam = 1 }) => {
      const res = await axios.post(window.route("model.selectData"), {
        model,
        includeAllLinkable: true,
        baseFilters: baseFilters ?? undefined,
        filters: additiveFilters ?? undefined,
        search: debouncedSearch,
        joins,
        with: withParam,
        order,
        translate,
        page: pageParam,
        show: PER_PAGE,
        // Opt-in pohon grup (server menerapkan default model bila `group`
        // tak dikirim); tanpa level grup valid respons tetap flat.
        groupTree: true,
        ...(group !== undefined && { group }),
        ...(groupSort === "desc" && { groupSort }),
      });
      return res.data;
    },
    getNextPageParam: (lastPage) =>
      lastPage.data.current_page < lastPage.data.last_page
        ? lastPage.data.current_page + 1
        : undefined,
    initialPageParam: 1,
    enabled: open && !!model,
    // Ganti filter/grup tak mengosongkan daftar sampai hasil baru tiba.
    placeholderData: keepPreviousData,
  });

  const firstPage = query.data?.pages?.[0];
  const templateLinkColumnNames = firstPage?.templateLinkColumns ?? [];
  const columnMap = useMemo(
    () =>
      buildAdvanceSearchColumnMap(
        firstPage?.columns ?? [],
        templateLinkColumnNames,
      ),
    [firstPage, templateLinkColumnNames],
  );
  const filterColumnMap = useMemo(
    () => buildAdvanceSearchFilterColumnMap(firstPage?.columns),
    [firstPage],
  );
  const items = useMemo(
    () => (query.data?.pages ?? []).flatMap((p) => p.data.data),
    [query.data],
  );
  const groupMeta = firstPage?.groupMeta ?? null;
  const isGrouped = groupMeta !== null;
  const total = firstPage?.data.total ?? 0;

  // Param dasar expand node: payload dasar + grup EFEKTIF eksplisit (expand
  // mengabaikan default model) -- `groupTree` hanya utk level-0.
  const groupBaseParams = useMemo(() => {
    if (!groupMeta) return null;

    return {
      model,
      includeAllLinkable: true,
      baseFilters: baseFilters ?? undefined,
      filters: additiveFilters ?? undefined,
      search: debouncedSearch,
      joins,
      with: withParam,
      order,
      translate,
      group: groupMeta.levels.map(({ column, granularity, range }) => ({
        column,
        granularity,
        range,
      })),
      ...(groupSort === "desc" && { groupSort }),
    };
  }, [
    groupMeta,
    model,
    baseFiltersKey,
    additiveFiltersKey,
    debouncedSearch,
    groupKey,
    groupSort,
    order,
    translate,
  ]);

  return {
    columnMap,
    filterColumnMap,
    lockedColumnNames: templateLinkColumnNames,
    // Flat: baris model. Grup aktif: `rows` kosong, `rootItems` = deskriptor level-0.
    rows: isGrouped ? [] : items,
    rootItems: isGrouped ? items : [],
    isGrouped,
    groupMeta,
    groupBaseParams,
    defaultGroups: firstPage?.defaultGroups ?? [],
    total,
    isLoading: query.isPending,
    isFetchingNextPage: query.isFetchingNextPage,
    hasNextPage: query.hasNextPage,
    fetchNextPage: query.fetchNextPage,
  };
}
