import { useEffect, useMemo, useState } from "react";

import axios from "axios";
import { useInfiniteQuery } from "@tanstack/react-query";

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

const PER_PAGE = 25;
const SEARCH_DEBOUNCE_MS = 300;

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

  const query = useInfiniteQuery({
    queryKey: [
      "linkModel",
      "advanceSearch",
      model,
      baseFiltersKey,
      additiveFiltersKey,
      debouncedSearch,
      order,
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
      });
      return res.data;
    },
    getNextPageParam: (lastPage) =>
      lastPage.data.current_page < lastPage.data.last_page
        ? lastPage.data.current_page + 1
        : undefined,
    initialPageParam: 1,
    enabled: open && !!model,
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
  const rows = useMemo(
    () => (query.data?.pages ?? []).flatMap((p) => p.data.data),
    [query.data],
  );
  const total = firstPage?.data.total ?? 0;

  return {
    columnMap,
    lockedColumnNames: templateLinkColumnNames,
    rows,
    total,
    isLoading: query.isPending,
    isFetchingNextPage: query.isFetchingNextPage,
    hasNextPage: query.hasNextPage,
    fetchNextPage: query.fetchNextPage,
  };
}
