// useLinkModelInfiniteOptions — daftar opsi dropdown LinkModel MODE SEARCH
// dengan INFINITE SCROLL (spec linkmodel-grouping-search Requirement 8b) dan,
// bila grup efektif aktif, level-0 pohon grup. Menggantikan `limit` + baris
// "more": halaman dimuat per `LINKMODEL_PAGE_SIZE` saat sentinel di dasar
// daftar terlihat. Mode cache tetap memakai `useLinkModelOptions`.
//
// Satu permintaan melayani dua bentuk (route `model`, opt-in `groupTree`):
//  - tanpa level grup valid -> baris flat berpaginasi (`page`/`show`)
//  - ada level grup (prop `group` ATAU default model) -> daftar grup level-0
//    (`type: "groups"`, `groupMeta`, `defaultGroups`), isi tiap grup di-fetch
//    lazy lewat `fetchLinkModelGroupNode`.

import { useMemo, useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import axios from "axios";
import { useLaravelReactI18n } from "laravel-react-i18n";

import { gooeyToast } from "@/lib/gooeyToast";
import useDidMountEffect from "./useDidMountEffect";
import { buildOptionsPayload } from "./useLinkModelOptions";

export const LINKMODEL_PAGE_SIZE = 25;

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
 * Payload dasar permintaan (tanpa paginasi) -- dipakai level-0 DAN expand node
 * (`baseParams` GroupTree). `group` eksplisit (list `{column, granularity,
 * range}`; `[]` = "tanpa grup") bila diberikan; `undefined` -> server memakai
 * default model.
 * @param {object} root0
 * @param {Array<{column: string, granularity: *, range: *}>} [root0.group]
 */
export const buildLinkModelGroupPayload = ({ group, ...options }) => {
  const payload = buildOptionsPayload({ ...options, cacheMode: false });
  delete payload.limit;
  payload.groupTree = true;
  if (group !== undefined) payload.group = group;

  return payload;
};

/**
 * Fetcher `GroupTree` utk isi sebuah node (POST route `model`). `params` =
 * payload dasar dgn `group` EFEKTIF eksplisit (dari `groupMeta.levels`) --
 * request expand mengabaikan default model.
 * @param {object} root0
 * @param {object} root0.params
 * @param {Array} root0.rawPath
 * @param {number} root0.page
 * @param {AbortSignal} [root0.signal]
 */
export const fetchLinkModelGroupNode = async ({
  params,
  rawPath,
  page,
  signal,
}) => {
  const { data } = await axios.post(
    window.route("model"),
    {
      ...params,
      groupPath: JSON.stringify(rawPath),
      groupPage: page,
      show: LINKMODEL_PAGE_SIZE,
    },
    { signal },
  );

  return data;
};

/**
 * @param {object} params
 * @param {string} params.model
 * @param {object} [params.filters]
 * @param {object|Array} [params.joins]
 * @param {object|Array} [params.with]
 * @param {Array} [params.fields]
 * @param {string} [params.keywords]
 * @param {string} [params.order]
 * @param {string} [params.translate]
 * @param {string} [params.search]
 * @param {boolean} params.open gate fetch (dropdown terbuka)
 * @param {boolean} [params.allowSearch] lihat `useLinkModelOptions`
 * @param {Array} [params.group] grup EFEKTIF dari prop (`undefined` = default model)
 * @param {number} [params.staleTime]
 */
export default function useLinkModelInfiniteOptions({
  model,
  filters,
  joins,
  with: withParam,
  fields,
  keywords,
  order,
  translate,
  search,
  open,
  allowSearch = true,
  group,
  staleTime = 0,
}) {
  const { t } = useLaravelReactI18n();

  const [debouncedSearch, setDebouncedSearch] = useState(search ?? "");
  useDidMountEffect(() => {
    if (!allowSearch) return;
    const timeout = setTimeout(() => setDebouncedSearch(search ?? ""), 500);
    return () => clearTimeout(timeout);
  }, [search, allowSearch]);

  const filtersKey = useMemo(() => stableStringify(filters), [filters]);
  const joinsKey = useMemo(() => stableStringify(joins), [joins]);
  const withKey = useMemo(() => stableStringify(withParam), [withParam]);
  const fieldsKey = useMemo(() => stableStringify(fields), [fields]);
  const groupKey = useMemo(() => stableStringify(group), [group]);

  const enabled = !!model && !!open;

  const query = useInfiniteQuery({
    queryKey: [
      "linkModel",
      "infinite",
      model,
      filtersKey,
      joinsKey,
      withKey,
      fieldsKey,
      order,
      keywords,
      translate,
      groupKey,
      debouncedSearch,
    ],
    queryFn: async ({ pageParam }) => {
      const payload = {
        ...buildLinkModelGroupPayload({
          model,
          joins,
          search: debouncedSearch,
          with: withParam,
          fields,
          filters,
          keywords,
          order,
          translate,
          group,
        }),
        page: pageParam,
        groupPage: pageParam,
        show: LINKMODEL_PAGE_SIZE,
        // Pencarian: backend menyertakan isi grup yang otomatis terbuka
        // (`children` di deskriptor) supaya hasil pertama tak lazy per grup.
        ...(debouncedSearch?.trim() ? { prefill: LINKMODEL_PAGE_SIZE } : {}),
      };
      try {
        const res = await axios.post(window.route("model"), payload);

        return res.data;
      } catch {
        gooeyToast.error(t("core.errors.fetch_failed"));

        return {
          data: [],
          total: 0,
          current_page: pageParam,
          last_page: pageParam,
        };
      }
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.current_page < lastPage.last_page
        ? lastPage.current_page + 1
        : undefined,
    enabled,
    staleTime,
  });

  const pages = query.data?.pages ?? [];
  const first = pages[0];
  const isGrouped = first?.type === "groups";
  const groupMeta = isGrouped ? (first.groupMeta ?? null) : null;

  // `baseParams` expand: payload dasar + grup EFEKTIF eksplisit.
  const baseParams = useMemo(() => {
    if (!isGrouped || !groupMeta) return null;
    const params = buildLinkModelGroupPayload({
      model,
      joins,
      search: debouncedSearch,
      with: withParam,
      fields,
      filters,
      keywords,
      order,
      translate,
      group: groupMeta.levels.map(({ column, granularity, range }) => ({
        column,
        granularity,
        range,
      })),
    });
    // Expand membawa `group` eksplisit; `groupTree` hanya utk level-0.
    delete params.groupTree;

    return params;
  }, [
    isGrouped,
    groupMeta,
    model,
    joinsKey,
    debouncedSearch,
    withKey,
    fieldsKey,
    filtersKey,
    keywords,
    order,
    translate,
  ]);

  return {
    isGrouped,
    groupMeta,
    baseParams,
    defaultGroups: first?.defaultGroups ?? [],
    options: isGrouped ? [] : pages.flatMap((page) => page.data ?? []),
    rootItems: isGrouped ? pages.flatMap((page) => page.data ?? []) : [],
    // Ketikan yang hasilnya SEDANG ditampilkan -- LinkModel membatasi
    // auto-expand ke hasil yang cocok dgn ketikan sekarang (bukan sisa hasil
    // pencarian sebelumnya yang masih tampil selama debounce).
    settledSearch: debouncedSearch,
    total: first?.total ?? 0,
    loading: enabled && query.isPending,
    fetchNextPage: query.fetchNextPage,
    hasNextPage: !!query.hasNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
  };
}
