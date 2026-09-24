// SearchBar — kotak ketik hybrid Odoo (chip = filter tree) + GitHub
// (autocomplete kolom) untuk DataTable2 (design.md §2-§8, revisi 2; Requirement
// 1-10, 14-15). Host-agnostic: TIDAK mengimpor `router`/`usePage`, TIDAK
// menulis `fid` -- transport tree via `onTreeChange` (boleh Promise),
// transport saved filter via `onPickSaved`, transport group via
// `onGroupChange`. Satu-satunya I/O mandiri: fetch `saved-filters.index` saat
// `model` diberikan (dan `saved-filters.destroy` untuk hapus dari Panel, pola
// sama dgn `FilterTable2.removeSaved`).
//
// Revisi 2 (feedback visual): SATU border membungkus ikon+chip+input+chevron
// (bukan kotak terpisah-pisah); warna chip = peran (sumber emas, group biru,
// lainnya secondary); dropdown yang SAMA menampilkan Panel (fokus/chevron,
// input kosong) ATAU saran (mengetik) ATAU daftar nilai (mode value) -- tidak
// pernah dialog/popover terpisah utk memilih operator. Operator SELALU
// diturunkan dari tipe kolom (columnSearch.js); klik chip existing utk edit
// memakai widget nilai yang SAMA (bukan editor operator terpisah).

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/Components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/Components/ui/popover";
import { Bookmark, ChevronDown, Filter, X } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/Components/ui/tooltip";
import {
  addLeafChip,
  addSearchChip,
  buildOptionList,
  removeChip,
  treeToChips,
  updateChip,
} from "./searchChips";
import {
  buildDatePresets,
  buildLeafFromText,
  columnTitle,
  isColumnSearchable,
  resolveColumnPath,
  resolveValueMode,
} from "./columnSearch";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/Components/ui/button";
import ChipEditor, { computeGroupDefaults } from "./ChipEditor";
import ClickAwayListener from "react-click-away-listener";
import LoadingIcon from "@/Components/LoadingIcon";
import SearchPanel from "./SearchPanel";
import axios from "axios";
import { buildSuggestions } from "./searchSuggestions";
import { cn } from "@/lib/utils";
import { compareLabels } from "@/lib/compareLabels";
import { highlightMatch } from "@/lib/highlightMatch";
import { isFilterTreeDirty } from "../Filter/filterTreeCompare";
import { useLaravelReactI18n } from "laravel-react-i18n";

// Warna chip berdasarkan PERAN, bukan urutan (feedback visual revisi 2):
// sumber (saved filter aktif) = emas, group = biru, sisanya (leaf/search/
// advanced) = secondary -- sama seperti Button variant="secondary".
const CHIP_CLASS = {
  source: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  group: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  default: "bg-secondary text-secondary-foreground",
};
const chipClass = (kind) => CHIP_CLASS[kind] ?? CHIP_CLASS.default;

const sameGroup = (a, b) => {
  const an = a ?? null;
  const bn = b ?? null;
  if (!an && !bn) return true;
  if (!an || !bn) return false;
  return (
    (an.column ?? null) === (bn.column ?? null) &&
    (an.granularity ?? null) === (bn.granularity ?? null) &&
    (an.range ?? null) === (bn.range ?? null)
  );
};

/**
 * SearchBar — kontrak lengkap di `resources/js/Components/Table/Search/`
 * (design.md §2).
 * @param {object} root0
 * @param {object} root0.columns peta kolom hasil getColumns() -- sumber
 *   tipe/opsi/operator/title.
 * @param {object|null} root0.tree Filter Tree controlled; null = tanpa filter.
 * @param {(tree: object|null) => void|Promise<void>} root0.onTreeChange
 *   transport milik host; boleh return Promise (busy state, §8).
 * @param {() => string[]} [root0.getSearchColumns] dipanggil SAAT chip
 *   "Cari" dibuat (bukan state) -- lihat §6.2.
 * @param {string} [root0.model] opsional -> aktifkan saran & panel Filter
 *   Tersimpan.
 * @param {string|number} [root0.activeFid] opsional -> deteksi badge sumber
 *   setelah reload (§5.5).
 * @param {(saved: object) => void} [root0.onPickSaved] opsional -> host
 *   terapkan saved filter (tree + fid + sort + group).
 * @param {() => {sort: string|null, group: object|null}} [root0.getViewSnapshot]
 *   opsional -> dipakai "Simpan sebagai baru"/"Timpa".
 * @param {{column: string|null, granularity: string|null, range: number|null}} [root0.group]
 * @param {Array<{value: string, label: string}>} [root0.groupOptions]
 * @param {(patch: {column: string|null, granularity: string|null, range: number|null}) => void} [root0.onGroupChange]
 * @param {() => void} [root0.onOpenBuilder] buka FilterTable2.
 * @param {string} [root0.placeholder]
 * @returns {React.JSX.Element}
 */
export default function SearchBar({
  columns,
  tree,
  onTreeChange,
  getSearchColumns,
  model,
  activeFid,
  onPickSaved,
  getViewSnapshot,
  group,
  groupOptions,
  onGroupChange,
  onOpenBuilder,
  placeholder,
}) {
  const { t } = useLaravelReactI18n();
  const inputRef = useRef(null);

  const [open, setOpen] = useState(false);
  // Chevron / klik chip sumber MEMAKSA Panel tampil walau `inputValue` terisi
  // (Requirement revisi 2: "panel tidak hanya muncul saat chevron ditekan" --
  // fokus dgn input kosong SUDAH menampilkan Panel lewat formula `showPanel`
  // di bawah tanpa flag ini; flag ini utk override eksplisit).
  const [panelForced, setPanelForced] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [mode, setMode] = useState("key"); // "key" | "value"
  const [valueColumn, setValueColumn] = useState(null);
  // Id chip leaf yang sedang DIEDIT (bukan dibuat baru) -- commit lewat
  // `updateChip`, bukan `addLeafChip`. `null` = mode value sedang membuat
  // chip baru.
  const [editingLeafId, setEditingLeafId] = useState(null);
  const [valueError, setValueError] = useState(null);
  const [editingChip, setEditingChip] = useState(null); // {kind:"search"|"group", ...}
  const [highlightedChipId, setHighlightedChipId] = useState(null);
  const [highlightedKey, setHighlightedKey] = useState();
  const [busy, setBusy] = useState(false);
  const [sourceSaved, setSourceSaved] = useState(null);
  const [savedFilters, setSavedFilters] = useState([]);
  const [loadingSaved, setLoadingSaved] = useState(false);
  const fetchStartedRef = useRef(false);

  const closeDropdown = useCallback(() => {
    setOpen(false);
    setPanelForced(false);
  }, []);

  // --- Filter Tersimpan: fetch lazy (fokus pertama) / saat mount bila
  // `activeFid` ada (Requirement 3.11). ------------------------------------
  const refreshSaved = useCallback(() => {
    if (!model) return Promise.resolve([]);
    setLoadingSaved(true);
    return axios
      .get(window.route("saved-filters.index"), { params: { model } })
      .then((res) => {
        const list = res.data?.data ?? res.data ?? [];
        setSavedFilters(list);
        return list;
      })
      .catch(() => {
        setSavedFilters([]);
        return [];
      })
      .finally(() => setLoadingSaved(false));
  }, [model]);

  const ensureSavedFetched = useCallback(() => {
    if (!model || fetchStartedRef.current) return;
    fetchStartedRef.current = true;
    refreshSaved();
  }, [model, refreshSaved]);

  useEffect(() => {
    if (activeFid) ensureSavedFetched();
  }, [activeFid, ensureSavedFetched]);

  // Deteksi sumber setelah reload `?fid=` -- nama dari `index` (bukan
  // `show`, yang menyembunyikan nama dari non-owner). Hanya MENGISI, tidak
  // pernah mengosongkan berdasar prop (clear selalu eksplisit lewat aksi
  // user) -- lihat catatan dirty-tracking §5.5.
  useEffect(() => {
    if (!activeFid) return;
    const found = savedFilters.find((s) => s.id === activeFid);
    if (found && sourceSaved?.id !== found.id) setSourceSaved(found);
  }, [activeFid, savedFilters]);

  const removeSavedFilter = useCallback(
    (id) => {
      if (!id) return;
      axios
        .delete(window.route("saved-filters.destroy", { savedFilter: id }))
        .then(() => {
          setSavedFilters((prev) => prev.filter((x) => x.id !== id));
          setSourceSaved((prev) => (prev?.id === id ? null : prev));
          if (id === activeFid) {
            Promise.resolve(onTreeChange?.(null)).catch(() => {});
          }
        })
        .catch(() => {});
    },
    [activeFid, onTreeChange],
  );

  // --- Commit tree: busy state + tolak commit baru saat Promise pending
  // (Requirement 15.1-15.2). ------------------------------------------------
  const busyRef = useRef(false);
  const commitTree = useCallback(
    (nextTree) => {
      if (busyRef.current) return Promise.reject(new Error("busy"));
      const result = onTreeChange?.(nextTree);
      if (result && typeof result.then === "function") {
        busyRef.current = true;
        setBusy(true);
        return result.finally(() => {
          busyRef.current = false;
          setBusy(false);
        });
      }
      return Promise.resolve(result);
    },
    [onTreeChange],
  );

  /** Tambah leaf baru, ATAU perbarui leaf `editId` bila diberikan. */
  const commitOrUpdateLeaf = useCallback(
    (patch, editId) =>
      commitTree(
        editId ? updateChip(tree, editId, patch) : addLeafChip(tree, patch),
      ),
    [commitTree, tree],
  );

  // --- Dirty (Requirement 10.3). -------------------------------------------
  // Sengaja BUKAN useMemo: `getViewSnapshot` bisa stabil identitasnya tapi
  // membaca state host yang berubah (mis. lewat ref) -- dihitung ulang tiap
  // render (murah: satu walk tree kecil) supaya sort/group terbaru selalu
  // terbaca.
  const computeDirty = () => {
    if (!sourceSaved) return false;
    if (isFilterTreeDirty(sourceSaved.filter, tree)) return true;
    const snapshot = getViewSnapshot?.() ?? {};
    if (sourceSaved.sort != null && sourceSaved.sort !== snapshot.sort) {
      return true;
    }
    if (
      sourceSaved.group != null &&
      !sameGroup(sourceSaved.group, snapshot.group)
    ) {
      return true;
    }
    return false;
  };
  const dirty = computeDirty();

  // --- Chips (Requirement 2). -----------------------------------------------
  const baseChips = useMemo(
    () => treeToChips(tree, columns, t),
    [tree, columns, t],
  );
  const groupChip = useMemo(() => {
    if (!group?.column) return null;
    const col = columns?.[group.column];
    const colTitle = col ? columnTitle(col, t) : group.column;
    const isDate = ["date", "time", "datetime"].includes(col?.type);
    const sub = isDate
      ? t(`core.datatable.granularity.${group.granularity ?? "month"}`)
      : group.range != null
        ? `${group.range}`
        : null;
    return {
      id: "__group",
      kind: "group",
      label: sub ? `≡ ${colTitle} › ${sub}` : `≡ ${colTitle}`,
    };
  }, [group, columns, t]);
  const chips = useMemo(() => {
    const list = [...baseChips];
    if (groupChip) list.push(groupChip);
    return list;
  }, [baseChips, groupChip]);
  const hasTreeItems = Boolean(
    tree?.root?.c && Object.keys(tree.root.c).length > 0,
  );

  // --- Kolom Panel "Kolom" -- daftar kolom yang bisa dicari, sama dgn yang
  // dipakai buildSuggestions seksi "Kolom" (Requirement 9, kolom ke-3 Panel).
  const columnList = useMemo(
    () =>
      Object.values(columns ?? {})
        .filter((col) => isColumnSearchable(col, t))
        .map((col) => ({ name: col.name, label: columnTitle(col, t) }))
        .sort((a, b) => compareLabels(a.label, b.label)),
    [columns, t],
  );

  // --- Saran (Requirement 3). ------------------------------------------------
  // `getSearchColumns` dipanggil ULANG tiap kali saran dihitung (bukan
  // disimpan sbg state) -- cookie visibility kolom bisa berubah di Table2
  // tanpa me-render ulang host (design.md §6.2).
  const sections = useMemo(() => {
    if (mode !== "key" || !inputValue.trim()) return [];
    return buildSuggestions(inputValue, {
      columns,
      searchColumns: getSearchColumns?.() ?? [],
      savedFilters: model ? savedFilters : undefined,
      groupOptions: groupOptions?.length ? groupOptions : undefined,
      t,
    });
  }, [
    mode,
    inputValue,
    columns,
    getSearchColumns,
    model,
    savedFilters,
    groupOptions,
    t,
  ]);

  // --- Panel vs saran vs daftar nilai -- SATU dropdown, kontennya berganti
  // sesuai state (revisi 2: fokus/chevron dgn input kosong -> Panel; mengetik
  // -> saran; mode value list/date -> daftar nilai; tanpa dialog terpisah). --
  const showPanel = mode === "key" && (panelForced || inputValue.trim() === "");
  const showSuggestions = mode === "key" && !showPanel && sections.length > 0;
  const vmode = valueColumn ? resolveValueMode(valueColumn) : null;
  const inlineValueOptions = useMemo(() => {
    if (vmode !== "list") return [];
    const opts =
      valueColumn?.type === "boolean"
        ? [
            { value: true, label: t("core.datatable.yes") },
            { value: false, label: t("core.datatable.no") },
          ]
        : buildOptionList(valueColumn, t);
    const needle = inputValue.trim().toLowerCase();
    if (!needle) return opts;
    return opts.filter((o) => `${o.label}`.toLowerCase().includes(needle));
  }, [vmode, valueColumn, inputValue, t]);
  const datePresets = useMemo(() => {
    if (vmode !== "date") return [];
    const all = buildDatePresets(new Date(), t);
    const needle = inputValue.trim().toLowerCase();
    if (!needle) return all;
    return all.filter((p) => p.label.toLowerCase().includes(needle));
  }, [vmode, inputValue, t]);
  const showValueList =
    mode === "value" && (vmode === "list" || vmode === "date");
  const dropdownVisible =
    open && (showPanel || showSuggestions || showValueList);

  // cmdk dikontrol via `value`/`onValueChange` sendiri -- auto-highlight
  // bawaan cmdk cuma jalan sekali saat mount (gotcha yg sama dgn
  // Select.jsx:139-154 & MultiSelect.jsx). Panel TIDAK ikut (native
  // button/ul, bukan cmdk) -- highlight hanya relevan utk saran & daftar nilai.
  const visibleKeys = useMemo(() => {
    if (showSuggestions)
      return sections.flatMap((s) => s.items.map((i) => i.key));
    if (vmode === "list") return inlineValueOptions.map((o) => `${o.value}`);
    if (vmode === "date") return datePresets.map((p) => p.key);
    return [];
  }, [showSuggestions, sections, vmode, inlineValueOptions, datePresets]);
  useEffect(() => {
    if (!visibleKeys.includes(highlightedKey)) {
      setHighlightedKey(visibleKeys[0]);
    }
  }, [visibleKeys]);

  // --- Mode value: masuk/keluar, commit. ------------------------------------
  const exitValueMode = useCallback(() => {
    setMode("key");
    setValueColumn(null);
    setEditingLeafId(null);
    setInputValue("");
    setValueError(null);
  }, []);

  /**
   * Masuk mode value utk kolom `col` -- dipakai baik saat MEMBUAT chip baru
   * (saran/Panel "Kolom") maupun MENGEDIT chip existing (`opts.editId`).
   * Tanpa dialog/menu operator: operator SELALU tetap (ditentukan
   * `resolveValueMode`), user hanya mengisi/memilih nilai.
   */
  const enterValueMode = useCallback((col, opts = {}) => {
    if (!col) return;
    setInputValue(opts.initialText ?? "");
    setValueError(null);
    setEditingLeafId(opts.editId ?? null);
    setMode("value");
    setValueColumn(col);
    setPanelForced(false);
    setOpen(true);
  }, []);

  const commitValueModeFreeText = useCallback(() => {
    if (!valueColumn) return;
    const leaf = buildLeafFromText(valueColumn, inputValue);
    if (!leaf) {
      if (vmode === "number")
        setValueError(t("core.datatable.search.number_invalid"));
      return;
    }
    commitOrUpdateLeaf(leaf, editingLeafId)
      .then(() => exitValueMode())
      .catch(() => {});
  }, [
    valueColumn,
    vmode,
    inputValue,
    editingLeafId,
    commitOrUpdateLeaf,
    exitValueMode,
    t,
  ]);

  const pickValueOption = useCallback(
    (patch) => {
      if (!valueColumn) return;
      commitOrUpdateLeaf({ k: valueColumn.name, ...patch }, editingLeafId)
        .then(() => exitValueMode())
        .catch(() => {});
    },
    [valueColumn, editingLeafId, commitOrUpdateLeaf, exitValueMode],
  );

  // --- Pilih saran / kolom Panel. ---------------------------------------------
  const pickSaved = useCallback(
    (saved) => {
      setSourceSaved(saved);
      onPickSaved?.(saved);
      setInputValue("");
      closeDropdown();
    },
    [onPickSaved, closeDropdown],
  );

  const pickColumn = useCallback(
    (name) => {
      const col = columns?.[name];
      if (col) enterValueMode(col);
    },
    [columns, enterValueMode],
  );

  const selectSuggestion = useCallback(
    (section, item) => {
      if (section === "text") {
        const cols = getSearchColumns?.() ?? [];
        commitTree(addSearchChip(tree, item.payload.text, cols))
          .then(() => setInputValue(""))
          .catch(() => {});
        return;
      }
      if (section === "saved") {
        pickSaved(item.payload);
        return;
      }
      if (section === "column") {
        pickColumn(item.payload.column);
        return;
      }
      if (section === "value") {
        commitTree(addLeafChip(tree, item.payload))
          .then(() => setInputValue(""))
          .catch(() => {});
        return;
      }
      if (section === "group") {
        const col = columns?.[item.payload.column];
        onGroupChange?.(
          computeGroupDefaults(col ?? { name: item.payload.column }),
        );
        setInputValue("");
      }
    },
    [
      getSearchColumns,
      commitTree,
      tree,
      pickSaved,
      pickColumn,
      columns,
      onGroupChange,
    ],
  );

  // --- Chip: klik badan / hapus / edit. --------------------------------------
  // Klik chip `leaf` existing membuka widget nilai yang SAMA dgn membuat baru
  // (bukan editor operator terpisah) -- kolom & operator TETAP, hanya nilai
  // yang bisa diubah. Kolom yang tak lagi punya mode nilai yang didukung
  // (mis. sudah dihapus / tipe json) -> fallback buka Builder lanjutan.
  const openEditorForChip = useCallback(
    (chip) => {
      if (chip.kind === "advanced") {
        onOpenBuilder?.();
        return;
      }
      if (chip.kind === "group") {
        setEditingChip({ kind: "group" });
        return;
      }
      if (chip.kind === "search") {
        const value = Object.values(chip.node?.c ?? {})[0]?.v ?? "";
        const searchColumnTitles = (chip.columns ?? []).map((k) => {
          const col = resolveColumnPath(columns, k);
          return col ? columnTitle(col, t) : k;
        });
        setEditingChip({
          kind: "search",
          chipId: chip.id,
          value,
          searchColumnTitles,
        });
        return;
      }
      const column = resolveColumnPath(columns, chip.node?.k);
      const valueMode = column ? resolveValueMode(column) : null;
      if (!valueMode) {
        onOpenBuilder?.();
        return;
      }
      const isTyped =
        valueMode === "text" ||
        valueMode === "number" ||
        valueMode === "relation";
      enterValueMode(column, {
        editId: chip.id,
        initialText: isTyped ? String(chip.node?.v ?? "") : "",
      });
    },
    [columns, t, onOpenBuilder, enterValueMode],
  );

  const removeChipByKind = useCallback(
    (chip) => {
      if (chip.kind === "group") {
        onGroupChange?.({ column: null, granularity: null, range: null });
        return;
      }
      commitTree(removeChip(tree, chip.id)).catch(() => {});
    },
    [commitTree, tree, onGroupChange],
  );

  const applyEditingChip = useCallback(
    (patch) => {
      if (!editingChip) return;
      if (editingChip.kind === "group") {
        onGroupChange?.(patch);
        setEditingChip(null);
        return;
      }
      commitTree(updateChip(tree, editingChip.chipId, patch))
        .then(() => setEditingChip(null))
        .catch(() => {});
    },
    [editingChip, commitTree, tree, onGroupChange],
  );

  const removeSource = useCallback(() => {
    commitTree(null).catch(() => {});
    setSourceSaved(null);
  }, [commitTree]);

  // --- Keyboard (Requirement 8). ----------------------------------------------
  const handleInputKeyDown = useCallback(
    (e) => {
      if (e.key === "Backspace" && inputValue === "") {
        if (mode === "value") {
          exitValueMode();
          return;
        }
        if (highlightedChipId) {
          // Lewat removeChipByKind (bukan removeChip langsung): chip `group`
          // bukan node tree -- hapusnya = onGroupChange({column:null}).
          const target = chips.find((c) => c.id === highlightedChipId);
          if (target) removeChipByKind(target);
          setHighlightedChipId(null);
        } else if (chips.length > 0) {
          setHighlightedChipId(chips[chips.length - 1].id);
        }
        return;
      }
      if (highlightedChipId) setHighlightedChipId(null);

      if (e.key === "Escape") {
        if (mode === "value") {
          exitValueMode();
          return;
        }
        closeDropdown();
        return;
      }

      if (
        mode === "value" &&
        (vmode === "text" || vmode === "number" || vmode === "relation") &&
        e.key === "Enter"
      ) {
        e.preventDefault();
        commitValueModeFreeText();
      }
    },
    [
      inputValue,
      mode,
      highlightedChipId,
      chips,
      removeChipByKind,
      exitValueMode,
      vmode,
      commitValueModeFreeText,
      closeDropdown,
    ],
  );

  const handleInputChange = useCallback((e) => {
    setInputValue(e.target.value);
    setValueError(null);
    setPanelForced(false);
    setOpen(true);
  }, []);

  const openChevron = useCallback(() => {
    setPanelForced(true);
    setOpen(true);
    ensureSavedFetched();
    inputRef.current?.focus();
  }, [ensureSavedFetched]);

  const valueColumnTitle = valueColumn ? columnTitle(valueColumn, t) : null;

  return (
    <ClickAwayListener onClickAway={closeDropdown}>
      <div className="flex flex-col gap-1 flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-1 rounded-lg border border-input bg-background px-1.5 min-h-8 py-1 focus-within:ring-1 focus-within:ring-ring">
          <Filter className="size-3.5 text-muted-foreground shrink-0" />

          {sourceSaved && (
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs shrink-0",
                chipClass("source"),
              )}
            >
              <button
                type="button"
                className="inline-flex items-center gap-1 cursor-pointer max-w-40"
                onClick={() => {
                  setPanelForced(true);
                  setOpen(true);
                  ensureSavedFetched();
                }}
              >
                <Bookmark className="size-3 shrink-0" />
                <span className="truncate">
                  {sourceSaved.name ||
                    t("core.datatable.filter.saved.untitled")}
                </span>
                {dirty && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span
                        role="img"
                        aria-label={t("core.datatable.filter.saved.dirty")}
                        className="size-1.5 rounded-full bg-amber-500 shrink-0"
                      />
                    </TooltipTrigger>
                    <TooltipContent>
                      {t("core.datatable.filter.saved.dirty")}
                    </TooltipContent>
                  </Tooltip>
                )}
              </button>
              <button
                type="button"
                aria-label={t("core.datatable.search.remove_chip", {
                  label: sourceSaved.name ?? "",
                })}
                className="cursor-pointer opacity-70 hover:opacity-100"
                onClick={removeSource}
              >
                <X className="size-3" />
              </button>
            </span>
          )}

          {chips.map((chip) => {
            const isEditing = editingChip
              ? chip.kind === "group"
                ? editingChip.kind === "group"
                : editingChip.chipId === chip.id
              : false;
            return (
              <Popover
                key={chip.id}
                open={isEditing}
                onOpenChange={(o) => {
                  if (!o) setEditingChip(null);
                }}
              >
                <PopoverTrigger asChild>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs shrink-0",
                      chipClass(chip.kind),
                      highlightedChipId === chip.id &&
                        "ring-2 ring-destructive",
                    )}
                  >
                    <button
                      type="button"
                      className="cursor-pointer max-w-48 truncate"
                      title={
                        chip.kind === "search"
                          ? (chip.columns ?? []).join(", ")
                          : undefined
                      }
                      onClick={() => openEditorForChip(chip)}
                    >
                      {chip.label}
                    </button>
                    <button
                      type="button"
                      aria-label={t("core.datatable.search.remove_chip", {
                        label: chip.label,
                      })}
                      className="cursor-pointer opacity-70 hover:opacity-100"
                      onClick={() => removeChipByKind(chip)}
                    >
                      <X className="size-3" />
                    </button>
                  </span>
                </PopoverTrigger>
                {isEditing && (
                  <PopoverContent
                    className="w-auto p-2"
                    onOpenAutoFocus={(e) => e.preventDefault()}
                  >
                    <ChipEditor
                      kind={editingChip.kind}
                      value={
                        editingChip.kind === "group"
                          ? (group ?? {
                              column: null,
                              granularity: null,
                              range: null,
                            })
                          : editingChip.value
                      }
                      searchColumnTitles={editingChip.searchColumnTitles}
                      groupOptions={groupOptions}
                      columns={columns}
                      onApply={applyEditingChip}
                    />
                  </PopoverContent>
                )}
              </Popover>
            );
          })}

          {/* Command MEMBUNGKUS Popover UTUH (trigger + content), bukan cuma
              CommandList -- cmdk mengaitkan Enter->pilih-item-highlighted
              lewat keydown yg bubbling di DOM subtree Command sendiri; input
              (di PopoverTrigger, TIDAK terportal) wajib jadi keturunan DOM
              Command yg SAMA dgn CommandItem (yg terportal via
              PopoverContent) supaya Enter di input benar-benar memicu
              cmdk. Command nested di dalam SearchPanel (GroupPicker) aman --
              tiap <Command> React punya context sendiri, tak bentrok. */}
          <Command
            shouldFilter={false}
            value={highlightedKey}
            onValueChange={setHighlightedKey}
            className="contents"
          >
            <Popover open={dropdownVisible} onOpenChange={() => {}}>
              <PopoverTrigger asChild>
                <div className="flex flex-1 items-center gap-1 min-w-24">
                  {valueColumn && (
                    <span className="text-xs text-muted-foreground shrink-0">
                      [{valueColumnTitle}:]
                    </span>
                  )}
                  <input
                    ref={inputRef}
                    value={inputValue}
                    placeholder={placeholder}
                    onChange={handleInputChange}
                    onFocus={() => {
                      setOpen(true);
                      ensureSavedFetched();
                    }}
                    onKeyDown={handleInputKeyDown}
                    className="flex-1 min-w-0 h-6 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                  />
                </div>
              </PopoverTrigger>
              {dropdownVisible && (
                <PopoverContent
                  align="start"
                  onOpenAutoFocus={(e) => e.preventDefault()}
                  className={cn(
                    "p-0",
                    showPanel
                      ? "w-[min(90vw,42rem)]"
                      : "w-(--radix-popover-trigger-width)",
                  )}
                >
                  {showPanel ? (
                    <SearchPanel
                      model={model}
                      columns={columns}
                      savedFilters={savedFilters}
                      loadingSaved={loadingSaved}
                      sourceId={sourceSaved?.id}
                      onPickSaved={pickSaved}
                      onRemoveSaved={removeSavedFilter}
                      filter={tree}
                      saveItems={
                        sourceSaved && dirty && !sourceSaved.is_shared
                          ? [sourceSaved]
                          : []
                      }
                      getViewSnapshot={getViewSnapshot}
                      onSaved={(saved) => {
                        refreshSaved();
                        if (saved) {
                          setSourceSaved(saved);
                          onPickSaved?.(saved);
                        }
                      }}
                      onOpenBuilder={() => {
                        closeDropdown();
                        onOpenBuilder?.();
                      }}
                      onClearAll={() => {
                        commitTree(null).catch(() => {});
                        setSourceSaved(null);
                        closeDropdown();
                      }}
                      hasFilters={hasTreeItems}
                      groupOptions={groupOptions}
                      group={group}
                      onGroupChange={(patch) => onGroupChange?.(patch)}
                      columnList={columnList}
                      onPickColumn={pickColumn}
                    />
                  ) : (
                    <CommandList onMouseDown={(e) => e.preventDefault()}>
                      <CommandEmpty>{t("core.form.not_found")}</CommandEmpty>
                      {showSuggestions &&
                        sections.map((sec) => (
                          <CommandGroup
                            key={sec.section}
                            heading={
                              sec.section !== "text"
                                ? t(
                                    `core.datatable.search.section.${sec.section}`,
                                  )
                                : undefined
                            }
                          >
                            {sec.items.map((item) => (
                              <CommandItem
                                key={item.key}
                                value={item.key}
                                onSelect={() =>
                                  selectSuggestion(sec.section, item)
                                }
                              >
                                {/* Dibungkus 1 <span> -- CommandItem ber-`gap-2`
                                    flex, hasil highlightMatch (array node)
                                    kalau langsung jadi children akan dianggap
                                    flex-item TERPISAH & dapat gap visual di
                                    antara <mark> & teks sisanya (bug nyata,
                                    lihat screenshot verifikasi visual). */}
                                <span>
                                  {item.prefix}
                                  {highlightMatch(
                                    item.label.slice(item.prefix?.length ?? 0),
                                    inputValue,
                                  )}
                                </span>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        ))}
                      {showValueList &&
                        vmode === "list" &&
                        inlineValueOptions.map((opt) => (
                          <CommandItem
                            key={`${opt.value}`}
                            value={`${opt.value}`}
                            onSelect={() =>
                              pickValueOption({ o: "=", v: opt.value })
                            }
                          >
                            <span>{highlightMatch(opt.label, inputValue)}</span>
                          </CommandItem>
                        ))}
                      {showValueList &&
                        vmode === "date" &&
                        datePresets.map((preset) => (
                          <CommandItem
                            key={preset.key}
                            value={preset.key}
                            onSelect={() =>
                              pickValueOption({
                                o: "in_period",
                                v: preset.value,
                              })
                            }
                          >
                            <span>
                              {highlightMatch(preset.label, inputValue)}
                            </span>
                          </CommandItem>
                        ))}
                    </CommandList>
                  )}
                </PopoverContent>
              )}
            </Popover>
          </Command>

          {busy && (
            <LoadingIcon
              role="status"
              aria-label={t("core.datatable.search.applying")}
              className="size-4 text-primary shrink-0"
            />
          )}

          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-6 shrink-0"
            aria-label={t("core.datatable.search.open_panel")}
            onClick={openChevron}
          >
            <ChevronDown className="size-3.5" />
          </Button>
        </div>
        {valueError && (
          <span className="text-destructive text-xs px-1">{valueError}</span>
        )}
      </div>
    </ClickAwayListener>
  );
}
