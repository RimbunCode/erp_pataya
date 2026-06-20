import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import axios from "axios";
import { gooeyToast } from "@/lib/gooeyToast";
import { useLaravelReactI18n } from "laravel-react-i18n";

/** Konstanta internal: view "SELF" = lihat model induk (bukan relasi spesifik). */
export const SELF_OPTION = "__self__";

const DEFAULT_SORT = "-created_at";
const PER_PAGE_OPTIONS = [10, 25, 50, 100];
const FILTER_DEBOUNCE_MS = 300;

/**
 * Normalisasi prop `from` → objek `{ [modelClass]: config }`.
 * - string → `{ [from]: {} }`
 * - object → as-is
 * Warning dev bila ditemukan key `select` (singular) — hanya `selects` didukung.
 * @param {string | object} from
 * @returns {Object<string, Object>}
 */
function normalizeFrom(from) {
  if (typeof from === "string") {
    return { [from]: {} };
  }
  if (from && typeof from === "object") {
    if (import.meta.env?.DEV) {
      Object.entries(from).forEach(([model, config]) => {
        if (config && typeof config === "object" && "select" in config) {
          console.warn(
            `[SelectModel] Model "${model}" memakai key "select" (singular) yang TIDAK didukung. ` +
              `Gunakan "selects" (plural).`,
          );
        }
      });
    }
    return from;
  }
  return {};
}

/**
 * Terapkan columnAlias ke tiap row sebelum onSelected. Fungsi murni.
 * Untuk tiap entri alias `{ target: source }`, set `row[target] = row[source]`.
 * @param {Array<object>} rows
 * @param {Object<string, string>|undefined} alias
 * @returns {Array<object>}
 */
export function applyColumnAlias(rows, alias) {
  if (!alias || Object.keys(alias).length === 0) {
    return rows;
  }
  return rows.map((row) => {
    const next = { ...row };
    Object.entries(alias).forEach(([target, source]) => {
      next[target] = row[source];
    });
    return next;
  });
}

/**
 * Bangun map kolom dari array kolom backend, re-sort by `order` (getColumns
 * meng-usort by name sehingga urutan asli hilang — dikembalikan di sini).
 * @param {Array<object>} columns
 * @returns {Object<string, Object>}
 */
function buildColumnMap(columns) {
  const sorted = [...(columns ?? [])].sort(
    (a, b) => (a.order ?? Infinity) - (b.order ?? Infinity),
  );
  const map = {};
  sorted.forEach((col) => {
    map[col.name] = col;
  });
  return map;
}

/**
 * Hook orkestrasi state dialog SelectModel: model aktif, view, pagination,
 * filter (baseFilters non-editable + filters editable + fid), data, kolom.
 * @param {{ from: string|Object, onSelected: (payload: {
 *   items: Array<Object>, model: string,
 *   mode: "direct"|"self-extraction"|"per-item",
 *   sourceModel: string|null, sourceIds: Array|null,
 * }) => void }} opts
 */
export default function useSelectModel({ from, onSelected }) {
  const route = window.route;
  const { t } = useLaravelReactI18n();
  const tableRef = useRef();

  const config = useMemo(() => normalizeFrom(from), [from]);
  const modelKeys = useMemo(() => Object.keys(config), [config]);

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeModel, setActiveModelState] = useState(modelKeys[0] ?? null);
  const [activeView, setActiveViewState] = useState(SELF_OPTION);

  // Server-state digabung dalam satu objek → hindari intermediate tak konsisten.
  const [server, setServer] = useState({
    model: null, // class model efektif dari response (relasi bila select di-set)
    columns: [],
    parentColumn: null,
    translateKey: null,
    data: [],
    pagination: { currentPage: 1, lastPage: 1, perPage: 25, total: 0 },
  });

  const [sort, setSortState] = useState(DEFAULT_SORT);
  const [page, setPageState] = useState(1);
  const [perPage, setPerPageState] = useState(25);
  const [userFilters, setUserFilters] = useState(null); // {root:{k,o,v,c}} | null
  const [appliedFilters, setAppliedFilters] = useState(null);
  const [savedFilterId, setSavedFilterId] = useState(null); // fid

  // Cache translateKey per model class (dari response) untuk label selector.
  // State (bukan ref) agar update memicu re-render label model selector.
  const [translateKeyMap, setTranslateKeyMap] = useState({});
  const abortRef = useRef(null);

  const activeConfig = config[activeModel] ?? {};
  const selectKeys = useMemo(
    () => Object.keys(activeConfig.selects ?? {}),
    [activeConfig],
  );
  const viewIsSelf = activeView === SELF_OPTION;
  const directMode = selectKeys.length === 0;
  const selectParam = viewIsSelf ? null : activeView;

  /** Sumber filter default (NON-EDITABLE) — tree LinkModel dari `from`. */
  const baseFilters = useMemo(() => {
    if (selectParam) {
      return activeConfig.selects?.[selectParam]?.filters ?? null;
    }
    return activeConfig.filters ?? null;
  }, [activeConfig, selectParam]);

  /** Kolom default visible (dari `from`) untuk model/relasi aktif. */
  const showedColumns = useMemo(() => {
    if (selectParam) {
      return activeConfig.selects?.[selectParam]?.columns ?? [];
    }
    return activeConfig.columns ?? [];
  }, [activeConfig, selectParam]);

  const loadData = useCallback(() => {
    if (!activeModel) return;

    // Batalkan request berjalan (race guard).
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    axios
      .post(
        route("model.selectData"),
        {
          model: activeModel,
          select: selectParam ?? undefined,
          columns: showedColumns.length > 0 ? showedColumns : undefined,
          baseFilters: baseFilters ?? undefined,
          filters: appliedFilters ?? undefined,
          fid: savedFilterId ?? undefined,
          sort,
          page,
          show: perPage,
          with:
            directMode || !viewIsSelf
              ? undefined
              : selectKeys.length > 0
                ? selectKeys
                : undefined,
        },
        { signal: controller.signal },
      )
      .then((res) => {
        const d = res.data;
        setTranslateKeyMap((prev) =>
          prev[d.model] === (d.translateKey ?? null)
            ? prev
            : { ...prev, [d.model]: d.translateKey ?? null },
        );
        setServer({
          model: d.model ?? activeModel,
          columns: d.columns ?? [],
          parentColumn: d.parentColumn ?? null,
          translateKey: d.translateKey ?? null,
          data: d.data?.data ?? [],
          pagination: {
            currentPage: d.data?.current_page ?? 1,
            lastPage: d.data?.last_page ?? 1,
            perPage: d.data?.per_page ?? perPage,
            total: d.data?.total ?? 0,
          },
        });
      })
      .catch((err) => {
        if (axios.isCancel?.(err) || err?.name === "CanceledError") return;
        setServer((prev) => ({
          ...prev,
          data: [],
          pagination: { ...prev.pagination, total: 0 },
        }));
        gooeyToast.error(t("core.errors.fetch_failed"));
      })
      .finally(() => {
        if (abortRef.current === controller) {
          setLoading(false);
        }
      });
  }, [
    activeModel,
    selectParam,
    showedColumns,
    baseFilters,
    appliedFilters,
    savedFilterId,
    sort,
    page,
    perPage,
    directMode,
    viewIsSelf,
    selectKeys,
    route,
    t,
  ]);

  // Fetch saat dialog dibuka + tiap dependency model/view/page/sort/filter ubah.
  // Debounce 300ms hanya untuk perubahan appliedFilters; selain itu langsung.
  useEffect(() => {
    if (!open) return;
    const handle = setTimeout(
      loadData,
      appliedFilters ? FILTER_DEBOUNCE_MS : 0,
    );
    return () => clearTimeout(handle);
  }, [open, loadData, appliedFilters]);

  // Abort request berjalan saat dialog ditutup.
  useEffect(() => {
    if (!open) {
      abortRef.current?.abort();
    }
  }, [open]);

  const columnMap = useMemo(
    () => buildColumnMap(server.columns),
    [server.columns],
  );

  const setActiveModel = useCallback((model) => {
    setActiveModelState(model);
    setActiveViewState(SELF_OPTION);
    setUserFilters(null);
    setAppliedFilters(null);
    setSavedFilterId(null);
    setPageState(1);
  }, []);

  const setActiveView = useCallback((view) => {
    setActiveViewState(view);
    setPageState(1);
  }, []);

  const setPerPage = useCallback((n) => {
    setPerPageState(n);
    setPageState(1);
  }, []);

  const setPage = useCallback((p) => {
    setPageState(p);
  }, []);

  const setSort = useCallback((s) => {
    setSortState(s);
  }, []);

  const resetSorting = useCallback(() => {
    setSortState(DEFAULT_SORT);
  }, []);

  const applyFilters = useCallback(() => {
    setAppliedFilters(userFilters);
    setPageState(1);
  }, [userFilters]);

  const clearFilters = useCallback(() => {
    setUserFilters(null);
    setAppliedFilters(null);
    setSavedFilterId(null);
    setPageState(1);
  }, []);

  const relatedModelOf = useCallback(
    (relName) => {
      const col = server.columns.find((c) => c.name === relName);
      return col?.related ?? null;
    },
    [server.columns],
  );

  const confirmSelection = useCallback(() => {
    const rows = tableRef.current?.getSelectedItem() ?? [];
    if (rows.length === 0) return; // R5.6 — no-op bila kosong

    let items;
    let model;
    let mode;
    let sourceModel = null;
    let sourceIds = null;

    if (directMode) {
      items = rows;
      model = activeModel;
      mode = "direct";
    } else if (viewIsSelf) {
      const relName = selectKeys[0];
      items = rows.flatMap((r) => r[relName] ?? []); // flatMap, bukan reduce
      model = relatedModelOf(relName) ?? activeModel;
      mode = "self-extraction";
      sourceModel = activeModel;
      sourceIds = rows.map((r) => r.id);
    } else {
      items = rows; // per-item: item lintas parent apa adanya
      model = server.model ?? activeModel; // response model = relasi target
      mode = "per-item";
    }

    const aliased = applyColumnAlias(items, activeConfig.columnAlias);
    onSelected?.({ items: aliased, model, mode, sourceModel, sourceIds });
    setOpen(false);
  }, [
    directMode,
    viewIsSelf,
    selectKeys,
    activeModel,
    activeConfig,
    server,
    relatedModelOf,
    onSelected,
  ]);

  const modelOptions = useMemo(
    () =>
      modelKeys.map((cls) => {
        const tk = translateKeyMap[cls];
        return {
          value: cls,
          label: tk ? t(`${tk}.title`) : cls.split("\\").pop(),
        };
      }),
    [modelKeys, t, translateKeyMap],
  );

  const viewOptions = useMemo(() => {
    if (selectKeys.length === 0) return [];
    const tk = server.translateKey;
    return [
      { value: SELF_OPTION, label: tk ? t(`${tk}.title`) : activeModel },
      ...selectKeys.map((k) => ({
        value: k,
        label: tk ? t(`${tk}.columns.${k}`) : k,
      })),
    ];
  }, [selectKeys, server.translateKey, activeModel, t]);

  // selectedCount reaktif tanpa mengubah engine Table2 (yang tak meng-emit event
  // seleksi): poll getSelectedItem() ringan via interval saat dialog terbuka.
  // Membaca ref di effect (bukan render) → tidak melanggar React purity.
  const [selectedCount, setSelectedCount] = useState(0);
  useEffect(() => {
    if (!open) {
      setSelectedCount(0);
      return;
    }
    const id = setInterval(() => {
      const count = tableRef.current?.getSelectedItem?.()?.length ?? 0;
      setSelectedCount((prev) => (prev === count ? prev : count));
    }, 200);
    return () => clearInterval(id);
  }, [open]);

  return {
    open,
    setOpen,
    loading,
    activeModel,
    setActiveModel,
    activeView,
    setActiveView,
    columns: server.columns,
    columnMap,
    parentColumn: server.parentColumn,
    data: server.data,
    pagination: server.pagination,
    perPage,
    setPerPage,
    setPage,
    sort,
    setSort,
    resetSorting,
    userFilters,
    setUserFilters,
    applyFilters,
    clearFilters,
    savedFilterId,
    setSavedFilterId,
    modelOptions,
    viewOptions,
    selectKeys,
    selectedCount,
    confirmSelection,
    tableRef,
    perPageOptions: PER_PAGE_OPTIONS,
  };
}
