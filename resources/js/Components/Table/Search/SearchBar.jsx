// SearchBar — kotak ketik hybrid Odoo (chip = filter tree) + GitHub
// (autocomplete kolom) untuk DataTable2 (design.md §2-§8; Requirement 1-10,
// 14-15). Host-agnostic: TIDAK mengimpor `router`/`usePage`, TIDAK menulis
// `fid` -- transport tree via `onTreeChange` (boleh Promise), transport saved
// filter via `onPickSaved`, transport group via `onGroupChange`. Satu-satunya
// I/O mandiri: fetch `saved-filters.index` saat `model` diberikan (dan
// `saved-filters.destroy` untuk hapus dari Panel, pola sama dgn
// `FilterTable2.removeSaved`).

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
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/Components/ui/button";
import ChipEditor, { computeGroupDefaults } from "./ChipEditor";
import ClickAwayListener from "react-click-away-listener";
import LoadingIcon from "@/Components/LoadingIcon";
import SearchPanel from "./SearchPanel";
import axios from "axios";
import { buildSuggestions } from "./searchSuggestions";
import { cn } from "@/lib/utils";
import { columnHasOptions } from "../Filter/operators";
import { highlightMatch } from "@/lib/highlightMatch";
import { isFilterTreeDirty } from "../Filter/filterTreeCompare";
import { resolveColumn } from "../Filter/filterValidation";
import { useLaravelReactI18n } from "laravel-react-i18n";

/** Tipe kolom yang langsung membuka ChipEditor di mode value (design.md §5.3). */
const resolveValueMode = (col) => {
  if (columnHasOptions(col) || col?.type === "boolean") return "list";
  if (col?.type === "string") return "text";
  if (["number", "currency"].includes(col?.type)) return "number";
  return "editor";
};

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

  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [mode, setMode] = useState("key"); // "key" | "value"
  const [valueColumn, setValueColumn] = useState(null);
  const [valueError, setValueError] = useState(null);
  const [draftEditor, setDraftEditor] = useState(null); // { column }
  const [editingChip, setEditingChip] = useState(null);
  const [highlightedChipId, setHighlightedChipId] = useState(null);
  const [highlightedKey, setHighlightedKey] = useState();
  const [panelOpen, setPanelOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sourceSaved, setSourceSaved] = useState(null);
  const [savedFilters, setSavedFilters] = useState([]);
  const [loadingSaved, setLoadingSaved] = useState(false);
  const fetchStartedRef = useRef(false);

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

  // Membuka Panel juga butuh daftar (kolom Filter Tersimpan) -- user bisa
  // membuka Panel TANPA pernah memfokus input.
  const changePanelOpen = useCallback(
    (nextOpen) => {
      setPanelOpen(nextOpen);
      if (nextOpen) ensureSavedFetched();
    },
    [ensureSavedFetched],
  );

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
  const baseChips = useMemo(() => treeToChips(tree, columns, t), [tree, columns, t]);
  const groupChip = useMemo(() => {
    if (!group?.column) return null;
    const col = columns?.[group.column];
    const colTitle =
      col?.title ?? (col?.titleTrans ? t(col.titleTrans) : group.column);
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

  // --- Saran (Requirement 3). ------------------------------------------------
  // `getSearchColumns` dipanggil ULANG tiap kali saran dihitung (bukan
  // disimpan sbg state) -- cookie visibility kolom bisa berubah di Table2
  // tanpa me-render ulang host (design.md §6.2).
  const sections = useMemo(() => {
    if (mode !== "key") return [];
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

  const dropdownVisible =
    open &&
    (Boolean(draftEditor) ||
      (mode === "key" && sections.length > 0) ||
      (mode === "value" && vmode === "list"));

  // cmdk dikontrol via `value`/`onValueChange` sendiri -- auto-highlight
  // bawaan cmdk cuma jalan sekali saat mount (gotcha yg sama dgn
  // Select.jsx:139-154 & MultiSelect.jsx).
  const visibleKeys = useMemo(() => {
    if (mode === "key") return sections.flatMap((s) => s.items.map((i) => i.key));
    if (vmode === "list") return inlineValueOptions.map((o) => `${o.value}`);
    return [];
  }, [mode, sections, vmode, inlineValueOptions]);
  useEffect(() => {
    if (!visibleKeys.includes(highlightedKey)) {
      setHighlightedKey(visibleKeys[0]);
    }
  }, [visibleKeys]);

  // --- Mode value: masuk/keluar, commit. ------------------------------------
  const exitValueMode = useCallback(() => {
    setMode("key");
    setValueColumn(null);
    setInputValue("");
    setValueError(null);
  }, []);

  const enterValueMode = useCallback((col) => {
    setInputValue("");
    setValueError(null);
    if (resolveValueMode(col) === "editor") {
      setDraftEditor({ column: col });
      setOpen(true);
      return;
    }
    setMode("value");
    setValueColumn(col);
    setOpen(true);
  }, []);

  const commitLeaf = useCallback(
    (patch) => {
      commitTree(addLeafChip(tree, patch))
        .then(() => {
          setInputValue("");
          setValueError(null);
          exitValueMode();
        })
        .catch(() => {});
    },
    [commitTree, tree, exitValueMode],
  );

  const commitValueModeFreeText = useCallback(() => {
    if (!valueColumn) return;
    const trimmed = inputValue.trim();
    if (vmode === "number") {
      if (trimmed === "" || Number.isNaN(Number(trimmed))) {
        setValueError(t("core.datatable.search.number_invalid"));
        return;
      }
      commitLeaf({ k: valueColumn.name, o: "=", v: Number(trimmed) });
      return;
    }
    if (!trimmed) return;
    commitLeaf({ k: valueColumn.name, o: "matches", v: trimmed });
  }, [valueColumn, vmode, inputValue, commitLeaf, t]);

  const applyDraftLeaf = useCallback(
    (patch) => {
      commitTree(addLeafChip(tree, patch))
        .then(() => {
          setDraftEditor(null);
          setOpen(false);
        })
        .catch(() => {});
    },
    [commitTree, tree],
  );

  // --- Pilih saran. ----------------------------------------------------------
  const pickSaved = useCallback(
    (saved) => {
      setSourceSaved(saved);
      onPickSaved?.(saved);
      setInputValue("");
      setOpen(false);
      setPanelOpen(false);
    },
    [onPickSaved],
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
        const col = columns?.[item.payload.column];
        if (col) enterValueMode(col);
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
        onGroupChange?.(computeGroupDefaults(col ?? { name: item.payload.column }));
        setInputValue("");
      }
    },
    [getSearchColumns, commitTree, tree, pickSaved, columns, enterValueMode, onGroupChange],
  );

  // --- Chip: klik badan / hapus / edit. --------------------------------------
  const openEditorForChip = useCallback(
    (chip) => {
      if (chip.kind === "advanced") {
        onOpenBuilder?.();
        return;
      }
      if (chip.kind === "group") {
        setEditingChip({ kind: "group", chipId: "__group" });
        return;
      }
      if (chip.kind === "search") {
        const text = Object.values(chip.node?.c ?? {})[0]?.v ?? "";
        const searchColumnTitles = (chip.columns ?? []).map((k) => {
          const col = resolveColumn(columns, k);
          return col?.title ?? (col?.titleTrans ? t(col.titleTrans) : k);
        });
        setEditingChip({ kind: "search", chipId: chip.id, value: text, searchColumnTitles });
        return;
      }
      const column = resolveColumn(columns, chip.node?.k);
      setEditingChip({
        kind: "leaf",
        chipId: chip.id,
        column,
        operator: chip.node?.o,
        value: chip.node?.v,
      });
    },
    [columns, t, onOpenBuilder],
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
        if (draftEditor) {
          setDraftEditor(null);
          return;
        }
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
        if (draftEditor) {
          setDraftEditor(null);
          return;
        }
        if (mode === "value") {
          exitValueMode();
          return;
        }
        setOpen(false);
        return;
      }

      if (mode === "value" && (vmode === "text" || vmode === "number") && e.key === "Enter") {
        e.preventDefault();
        commitValueModeFreeText();
      }
    },
    [
      inputValue,
      draftEditor,
      mode,
      highlightedChipId,
      chips,
      removeChipByKind,
      exitValueMode,
      vmode,
      commitValueModeFreeText,
    ],
  );

  const handleInputChange = useCallback((e) => {
    setInputValue(e.target.value);
    setValueError(null);
    // Mengetik lagi = user meninggalkan draft ChipEditor yang sedang terbuka.
    setDraftEditor(null);
    setOpen(true);
  }, []);

  const valueColumnTitle =
    valueColumn?.title ??
    (valueColumn?.titleTrans ? t(valueColumn.titleTrans) : valueColumn?.name);

  return (
    <ClickAwayListener
      onClickAway={() => {
        setOpen(false);
        setDraftEditor(null);
      }}
    >
      <div className="flex flex-col gap-1 flex-1 min-w-0">
        <div
          className={cn(
            "flex flex-wrap items-center gap-1 rounded-lg border border-input bg-background px-1.5 min-h-8 py-1",
          )}
        >
          <Filter className="size-3.5 text-muted-foreground shrink-0" />

          {sourceSaved && (
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs shrink-0",
                dirty
                  ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                  : "bg-primary/10 text-primary",
              )}
            >
              <button
                type="button"
                className="inline-flex items-center gap-1 cursor-pointer max-w-40"
                onClick={() => changePanelOpen(true)}
              >
                <Bookmark className="size-3 shrink-0" />
                <span className="truncate">
                  {sourceSaved.name || t("core.datatable.filter.saved.untitled")}
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
                      "inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary shrink-0",
                      highlightedChipId === chip.id && "ring-2 ring-destructive",
                    )}
                  >
                    <button
                      type="button"
                      className="cursor-pointer max-w-48 truncate"
                      title={chip.kind === "search" ? (chip.columns ?? []).join(", ") : undefined}
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
                      column={editingChip.column}
                      operator={editingChip.operator}
                      value={
                        editingChip.kind === "group"
                          ? (group ?? { column: null, granularity: null, range: null })
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

          <Command shouldFilter={false} value={highlightedKey} onValueChange={setHighlightedKey} className="contents">
            <Popover open={dropdownVisible} onOpenChange={() => {}}>
              <PopoverTrigger asChild>
                <div className="flex flex-1 items-center gap-1 min-w-24">
                  {valueColumn && (
                    <span className="text-xs text-muted-foreground shrink-0">
                      [{valueColumnTitle}:]
                    </span>
                  )}
                  <input
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
                  className="w-(--radix-popover-trigger-width) p-0"
                >
                  {draftEditor ? (
                    <div className="p-2">
                      <ChipEditor kind="leaf" column={draftEditor.column} onApply={applyDraftLeaf} />
                    </div>
                  ) : mode === "key" ? (
                    <CommandList onMouseDown={(e) => e.preventDefault()}>
                      <CommandEmpty>{t("core.form.not_found")}</CommandEmpty>
                      {sections.map((sec) => (
                        <CommandGroup
                          key={sec.section}
                          heading={
                            sec.section !== "text"
                              ? t(`core.datatable.search.section.${sec.section}`)
                              : undefined
                          }
                        >
                          {sec.items.map((item) => (
                            <CommandItem
                              key={item.key}
                              value={item.key}
                              onSelect={() => selectSuggestion(sec.section, item)}
                            >
                              {item.prefix}
                              {highlightMatch(
                                item.label.slice(item.prefix?.length ?? 0),
                                inputValue,
                              )}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      ))}
                    </CommandList>
                  ) : (
                    <CommandList onMouseDown={(e) => e.preventDefault()}>
                      <CommandEmpty>{t("core.form.not_found")}</CommandEmpty>
                      {inlineValueOptions.map((opt) => (
                        <CommandItem
                          key={`${opt.value}`}
                          value={`${opt.value}`}
                          onSelect={() =>
                            commitTree(
                              addLeafChip(tree, { k: valueColumn.name, o: "=", v: opt.value }),
                            )
                              .then(() => exitValueMode())
                              .catch(() => {})
                          }
                        >
                          {highlightMatch(opt.label, inputValue)}
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

          <SearchPanel
            trigger={
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-6 shrink-0"
                aria-label={t("core.datatable.search.open_panel")}
              >
                <ChevronDown className="size-3.5" />
              </Button>
            }
            open={panelOpen}
            onOpenChange={changePanelOpen}
            model={model}
            columns={columns}
            savedFilters={savedFilters}
            loadingSaved={loadingSaved}
            sourceId={sourceSaved?.id}
            onPickSaved={pickSaved}
            onRemoveSaved={removeSavedFilter}
            filter={tree}
            saveItems={sourceSaved && dirty && !sourceSaved.is_shared ? [sourceSaved] : []}
            getViewSnapshot={getViewSnapshot}
            onSaved={(saved) => {
              refreshSaved();
              if (saved) {
                setSourceSaved(saved);
                onPickSaved?.(saved);
              }
            }}
            onOpenBuilder={() => {
              setPanelOpen(false);
              onOpenBuilder?.();
            }}
            onClearAll={() => {
              commitTree(null).catch(() => {});
              setSourceSaved(null);
              setPanelOpen(false);
            }}
            hasFilters={hasTreeItems}
            groupOptions={groupOptions}
            group={group}
            onGroupChange={(patch) => onGroupChange?.(patch)}
          />
        </div>
        {valueError && (
          <span className="text-destructive text-xs px-1">{valueError}</span>
        )}
      </div>
    </ClickAwayListener>
  );
}
