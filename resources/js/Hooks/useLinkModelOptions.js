import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import axios from "axios";
import { gooeyToast } from "@/lib/gooeyToast";
import { useLaravelReactI18n } from "laravel-react-i18n";
import useDidMountEffect from "./useDidMountEffect";

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

let idbInstancePromise = null;
function getIdb() {
  if (idbInstancePromise) return idbInstancePromise;
  idbInstancePromise = new Promise((resolve, reject) => {
    const request = window.indexedDB.open("linkmodel-cache", 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("entries")) {
        db.createObjectStore("entries", { keyPath: "key" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return idbInstancePromise;
}

/**
 * Key penyimpanan `cacheStorage` -- diekspor supaya test bisa mencari
 *  entry yang ditulis hook tanpa menduplikasi format string ini sendiri.
 * @param {object} root0
 * @param {string} root0.model
 * @param {object} [root0.filters]
 * @param {object|Array} [root0.joins]
 * @param {object|Array} [root0.with]
 * @param {string} [root0.keywords]
 * @param {string} [root0.order]
 * @param {string} [root0.translate]
 * @returns {string}
 */
export function buildPersistKey({
  model,
  filters,
  joins,
  with: withParam,
  keywords,
  order,
  translate,
}) {
  return `linkmodel:${model}:${stableStringify(filters)}:${stableStringify(joins)}:${stableStringify(withParam)}:${keywords ?? ""}:${order ?? ""}:${translate ?? ""}`;
}

function getSyncStore(cacheStorage) {
  if (cacheStorage === "localStorage") return window?.localStorage ?? null;
  if (cacheStorage === "sessionStorage") return window?.sessionStorage ?? null;
  return null;
}

async function readStorage(cacheStorage, key) {
  if (!key) return null;
  if (cacheStorage === "indexedDB") {
    try {
      const db = await getIdb();
      return await new Promise((resolve, reject) => {
        const tx = db.transaction("entries", "readonly");
        const req = tx.objectStore("entries").get(key);
        req.onsuccess = () => resolve(req.result ?? null);
        req.onerror = () => reject(req.error);
      });
    } catch {
      return null;
    }
  }
  const store = getSyncStore(cacheStorage);
  if (!store) return null;
  try {
    const raw = store.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

async function writeStorage(cacheStorage, key, value) {
  if (!key) return;
  if (cacheStorage === "indexedDB") {
    try {
      const db = await getIdb();
      await new Promise((resolve, reject) => {
        const tx = db.transaction("entries", "readwrite");
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.objectStore("entries").put({ key, ...value });
      });
    } catch {
      // abaikan error persistence -- cache mode tetap jalan in-memory lewat useQuery
    }
    return;
  }
  const store = getSyncStore(cacheStorage);
  if (!store) return;
  try {
    store.setItem(key, JSON.stringify(value));
  } catch {
    // abaikan error quota/serialization
  }
}

/**
 * Bangun payload request `route("model")`. `filters` (+`filterForDefaultValue`
 * bila ada) SELALU disertakan terlepas dari `cacheMode` -- fix bug lama:
 * cache mode dulu strip `filters` sepenuhnya dari payload, backend selalu
 * balikin dataset penuh tak terfilter (lihat design.md, "Known Bugs Fixed").
 * `search`/`order`/`limit`/`fields`/`with` TETAP dikecualikan saat `cacheMode`
 * aktif -- itu semua difilter di client (`filteredOptions` di LinkModel.jsx),
 * bukan tanggung jawab payload ini.
 * @param {object} root0
 * @param {string} root0.model
 * @param {boolean} root0.cacheMode
 * @param {object|Array} [root0.joins]
 * @param {number} [root0.limit]
 * @param {string} [root0.search]
 * @param {object|Array} [root0.with]
 * @param {Array} [root0.fields]
 * @param {object} [root0.filters]
 * @param {object} [root0.filterForDefaultValue]
 * @param {string} [root0.keywords]
 * @param {string} [root0.order]
 * @param {string} [root0.translate]
 * @returns {object}
 */
export function buildOptionsPayload({
  model,
  cacheMode,
  joins,
  limit,
  search,
  with: withParam,
  fields,
  filters,
  filterForDefaultValue,
  keywords,
  order,
  translate,
}) {
  const payload = {
    model,
    cacheMode: !!cacheMode,
    joins,
    filters: { ...filters, ...filterForDefaultValue },
  };
  if (!cacheMode) {
    Object.assign(payload, {
      limit: limit ?? 10,
      search,
      with: withParam,
      fields,
      keywords,
      order,
      translate,
    });
  }
  return payload;
}

/**
 * Hook fetch untuk daftar opsi dropdown LinkModel (jalur search-mode &
 * cache-mode). Jalur resolve `defaultValue` dan resolve-by-id setelah
 * `FormPageDialog` sukses TETAP di LinkModel.jsx sebagai fetch imperatif
 * terpisah (lihat requirements.md Requirement 1 AC4) -- keduanya boleh
 * memakai `buildOptionsPayload` di atas, tapi TIDAK lewat hook reaktif ini.
 * @param {object} params
 * @param {string} params.model
 * @param {object} [params.filters]
 * @param {object|Array} [params.joins]
 * @param {object|Array} [params.with]
 * @param {Array} [params.fields]
 * @param {string} [params.keywords]
 * @param {string} [params.order]
 * @param {string} [params.translate]
 * @param {number} [params.limit]
 * @param {string} [params.search]
 * @param {boolean} params.open dropdown terbuka -- gate lazy-fetch mode search
 *   (mode cache TIDAK di-gate `open`, tetap eager preload sejak mount --
 *   mempertahankan UX lama: dropdown Currency/Country langsung berisi data
 *   begitu dibuka pertama kali, tanpa spinner).
 * @param {boolean} [params.allowSearch] false ketika `search` berubah
 *   BUKAN karena user mengetik (mis. disinkronkan ke label opsi yang baru
 *   dipilih) -- perubahan `search` diabaikan (tidak menggerakkan
 *   `debouncedSearch`/`queryKey`), supaya memilih opsi tidak memicu fetch
 *   pencarian baru. Pola sama `allowSearch` di `LinkModel.jsx` versi lama.
 * @param {boolean} [params.cacheMode]
 * @param {string} [params.cacheStorage]
 * @param {number} [params.staleTime]
 * @returns {{options: Array, total: number, loading: boolean}}
 */
export default function useLinkModelOptions({
  model,
  filters,
  joins,
  with: withParam,
  fields,
  keywords,
  order,
  translate,
  limit,
  search,
  open,
  allowSearch = true,
  cacheMode = false,
  cacheStorage = "memory",
  staleTime = 120_000,
}) {
  const { t } = useLaravelReactI18n();
  const queryClient = useQueryClient();

  const [debouncedSearch, setDebouncedSearch] = useState(search ?? "");
  useDidMountEffect(() => {
    if (!allowSearch) return;
    const timeout = setTimeout(() => {
      setDebouncedSearch(search ?? "");
    }, 500);
    return () => {
      clearTimeout(timeout);
    };
  }, [search, allowSearch]);

  const filtersKey = useMemo(() => stableStringify(filters), [filters]);
  const joinsKey = useMemo(() => stableStringify(joins), [joins]);
  const withKey = useMemo(() => stableStringify(withParam), [withParam]);

  const persistKey = useMemo(() => {
    if (!cacheMode || cacheStorage === "memory" || !model) return null;
    return buildPersistKey({
      model,
      filters,
      joins,
      with: withParam,
      keywords,
      order,
      translate,
    });
  }, [
    cacheMode,
    cacheStorage,
    model,
    filtersKey,
    joinsKey,
    withKey,
    keywords,
    order,
    translate,
  ]);

  const queryKey = useMemo(() => {
    if (cacheMode) {
      return [
        "linkModel",
        "cache",
        model,
        filtersKey,
        joinsKey,
        withKey,
        order,
        keywords,
      ];
    }
    return [
      "linkModel",
      "search",
      model,
      filtersKey,
      debouncedSearch,
      joinsKey,
      withKey,
      order,
      keywords,
    ];
  }, [
    cacheMode,
    model,
    filtersKey,
    joinsKey,
    withKey,
    order,
    keywords,
    debouncedSearch,
  ]);

  // Restore snapshot dari cacheStorage SEBELUM query aktif fetch -- `hydrated`
  // menahan `enabled` supaya tidak race dengan fetch network yang tidak perlu
  // kalau ternyata sudah ada snapshot valid (pola sama `cacheLoaded` gate di
  // LinkModel.jsx versi lama). Timestamp ASLI (`stored.ts`) dioper via
  // `setQueryData(..., { updatedAt })` supaya `staleTime` dihitung dari kapan
  // data itu SUNGGUH di-fetch, bukan dari saat restore.
  const [hydrated, setHydrated] = useState(
    !cacheMode || cacheStorage === "memory",
  );
  useEffect(() => {
    if (!cacheMode || cacheStorage === "memory" || !persistKey) {
      setHydrated(true);
      return;
    }
    let active = true;
    setHydrated(false);
    (async () => {
      const stored = await readStorage(cacheStorage, persistKey);
      if (!active) return;
      if (stored?.data) {
        queryClient.setQueryData(
          queryKey,
          { data: stored.data, total: stored.total ?? stored.data.length },
          { updatedAt: stored.ts ?? 0 },
        );
      }
      setHydrated(true);
    })();
    return () => {
      active = false;
    };
  }, [cacheMode, cacheStorage, persistKey]);

  const enabled = cacheMode ? !!model && hydrated : !!model && !!open;

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      const payload = buildOptionsPayload({
        model,
        cacheMode,
        joins,
        limit,
        search: debouncedSearch,
        with: withParam,
        fields,
        filters,
        keywords,
        order,
        translate,
      });
      try {
        const res = await axios.post(window.route("model"), payload);
        const data = res.data.data;
        const total = res.data.total ?? data.length;
        if (cacheMode && persistKey) {
          writeStorage(cacheStorage, persistKey, {
            data,
            total,
            ts: Date.now(),
          });
        }
        return { data, total };
      } catch {
        gooeyToast.error(t("core.errors.fetch_failed"));
        return { data: [], total: 0 };
      }
    },
    enabled,
    staleTime,
  });

  return {
    options: query.data?.data ?? [],
    total: query.data?.total ?? 0,
    loading: enabled && (!hydrated || query.isPending),
  };
}
