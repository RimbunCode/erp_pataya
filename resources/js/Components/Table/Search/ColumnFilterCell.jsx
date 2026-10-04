// ColumnFilterCell — satu Sel Filter di Baris Filter Kolom (spec
// datatable2-column-search-row). Input + Badge Nilai untuk SATU kolom dengan
// sintaks & picker yang SAMA dgn Search Bar atas (logika dipakai bersama lewat
// `useColumnValueInput`, `ColumnValueDropdown`, `ValueChipList`).
//
// Sumber state tunggal = draft host (`useSearchDraft`): badge idle diturunkan
// dari `draftTree` (bukan state sel), commit = `draft.commitTreeChange` yang
// menulis draft lalu meng-apply SELURUH draft (Requirement 7.4). State lokal
// hanya sesi ketik/edit (ketikan, chip nilai yang belum di-Enter).
//
// Perbedaan sengaja dari Search Bar atas: hanya Enter (dan pilihan eksplisit)
// yang meng-APPLY; blur membiarkan ketikan tetap di input, Escape membuang
// sesi dan mengembalikan draft ke kondisi sebelum sesi (Requirement 6.4-6.5).
// Selama mengetik, leaf valid ditulis ke draft tanpa apply sehingga chip
// Search Bar atas ikut berubah saat itu juga (Requirement 14).

import { Command } from "@/Components/ui/command";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
  PopoverTrigger,
} from "@/Components/ui/popover";
import { SlidersHorizontal, X } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/Components/ui/tooltip";
import { addLeafChip, removeLeafValue, updateChip } from "./searchChips";
import {
  columnTitle,
  isColumnSearchable,
  resolveColumnPath,
  resolveValueMode,
} from "./columnSearch";
import {
  buildEditorPrefill,
  chipClass,
  dottedColumnFor,
} from "./valueInputUtils";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import ColumnValueDropdown from "./ColumnValueDropdown";
import ValueChipList from "./ValueChipList";
import { badgesForColumn, leafBelongsToColumn } from "./columnBadges";
import { cn } from "@/lib/utils";
import useColumnValueInput from "./useColumnValueInput";
import { useLiveDraftState, useLiveDraftSync } from "./useLiveDraft";
import { useLaravelReactI18n } from "laravel-react-i18n";

// Tinggi maksimum sel = 3 baris badge (`text-xs` + padding); selebihnya scroll
// di dalam sel supaya baris sticky tidak memakan viewport (Requirement 5.7).
const CELL_MAX_HEIGHT = "max-h-[5.25rem]";

/**
 * Badge idle (nilai yang sudah ada di draft tree untuk kolom ini).
 * @param {object} p
 * @param {object} p.badge
 * @param {boolean} p.highlighted
 * @param {() => void} p.onEdit
 * @param {() => void} p.onRemove
 * @returns {React.JSX.Element}
 */
function BadgeChip({ badge, highlighted, onEdit, onRemove }) {
  const { t } = useLaravelReactI18n();
  const readOnly = badge.editable === "builder";
  return (
    <span
      data-testid="column-filter-badge"
      data-negated={badge.negated ? "true" : undefined}
      className={cn(
        "inline-flex! items-center gap-1 rounded-full px-2 py-0.5 text-xs shrink-0",
        chipClass("value"),
        badge.negated && "italic",
        highlighted && "ring-2 ring-destructive",
      )}
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className={cn(
              "max-w-32 truncate whitespace-nowrap! hover:underline",
              readOnly ? "cursor-alias" : "cursor-text",
            )}
            onMouseDown={(e) => e.preventDefault()}
            onClick={onEdit}
          >
            {badge.label}
          </button>
        </TooltipTrigger>
        <TooltipContent>
          {readOnly
            ? `${badge.tooltip} — ${t("core.datatable.column_search.readonly_builder")}`
            : badge.tooltip}
        </TooltipContent>
      </Tooltip>
      <button
        type="button"
        aria-label={t("core.datatable.search.remove_chip", {
          label: badge.label,
        })}
        className="cursor-pointer opacity-70 hover:opacity-100"
        onMouseDown={(e) => e.preventDefault()}
        onClick={onRemove}
      >
        <X className="size-3" />
      </button>
    </span>
  );
}

/**
 * @param {object} p
 * @param {object} p.column kolom Kolom Searchable (`isColumnSearchable` true)
 * @param {object} p.columns peta kolom (resolusi kolom anak relasi bertitik)
 * @param {object} p.draft draft host (`useSearchDraft`)
 * @param {Array} p.chips hasil `treeToChips(draft.draftTree, ...)`
 * @param {Set<string>} p.advancedUsed kunci kolom di dalam chip advanced
 * @param {string[]} [p.monthsShort] nama bulan singkat locale aktif
 * @param {(draftTree: object|null) => void} [p.onOpenBuilder]
 * @returns {React.JSX.Element}
 */
function SearchableCell({
  column,
  columns,
  draft,
  chips,
  advancedUsed,
  monthsShort,
  onOpenBuilder,
}) {
  const { t } = useLaravelReactI18n();
  const inputRef = useRef(null);
  const wrapRef = useRef(null);
  const contentRef = useRef(null);
  const pendingEditKeyRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [highlightedBadge, setHighlightedBadge] = useState(null);

  const { commitTreeChange } = draft;
  // Draft LANGSUNG (Requirement 14): ketikan valid ditulis ke draft tanpa
  // apply; commit memakai snapshot sebelum sesi supaya leaf sementara tidak
  // ikut ganda.
  const live = useLiveDraftState(draft);
  const { baseFor, markCommitted, liveLeafId } = live;
  // Pilihan langsung (boolean, Diisi/Tidak diisi, enter) saat host SIBUK tak
  // boleh hilang: ditahan lalu dikomit begitu host selesai.
  const pendingCommitRef = useRef(null);
  const runCommit = useCallback(
    ({ patch, editId }) => {
      markCommitted();
      commitTreeChange((d) => {
        const base = baseFor(d);
        return editId
          ? updateChip(base, editId, patch)
          : addLeafChip(base, patch);
      }).catch(() => {});
    },
    [commitTreeChange, baseFor, markCommitted],
  );
  const onCommit = useCallback(
    (patch, { editId }) => {
      if (draft.busy) {
        pendingCommitRef.current = { patch, editId };
        return undefined;
      }
      runCommit({ patch, editId });
      return undefined;
    },
    [draft.busy, runCommit],
  );
  useEffect(() => {
    if (draft.busy || !pendingCommitRef.current) return;
    const pending = pendingCommitRef.current;
    pendingCommitRef.current = null;
    runCommit(pending);
  }, [draft.busy, runCommit]);
  const onRequestOpen = useCallback(() => setOpen(true), []);
  const onRequestClose = useCallback(() => setOpen(false), []);
  const value = useColumnValueInput({
    inputRef,
    onCommit,
    onRequestOpen,
    onRequestClose,
    commitOnEscape: false,
  });
  useLiveDraftSync({ live, value });
  const {
    valueColumn,
    editingLeafId,
    enterValueMode,
    exitValueMode,
    startEditValueChip,
    handleChange,
    handleKeyDown,
    inputValue,
    valueError,
    visibleValueChips,
    highlightedKey,
    setHighlightedKey,
    showValueList,
    showRelationResults,
    showHint,
    vmode,
    valueLegendCtx,
  } = value;

  // Badge idle diturunkan dari draft tree; leaf yang sedang diedit
  // disembunyikan selama sesi (nilainya sudah dimuat ke chip/input sesi).
  const badges = useMemo(
    () =>
      badgesForColumn(chips, column, { t, columns, monthsShort }).filter(
        (b) => b.leafId !== editingLeafId && b.leafId !== liveLeafId,
      ),
    [chips, column, t, columns, monthsShort, editingLeafId, liveLeafId],
  );

  const usedInAdvanced = useMemo(
    () => [...advancedUsed].some((k) => leafBelongsToColumn(k, column)),
    [advancedUsed, column],
  );

  const ensureSession = () => {
    if (!valueColumn) enterValueMode(column, {});
  };

  // Mulai edit satu chip nilai SETELAH sesi (prefill) ter-render.
  useEffect(() => {
    if (!valueColumn || pendingEditKeyRef.current === null) return;
    const key = pendingEditKeyRef.current;
    pendingEditKeyRef.current = null;
    startEditValueChip(key);
  }, [valueColumn, startEditValueChip]);

  const editBadge = (badge) => {
    if (badge.editable === "builder") {
      onOpenBuilder?.(draft.draftTree);
      return;
    }
    const chip = chips.find((c) => c.id === badge.leafId);
    if (!chip) return;
    const resolved =
      resolveColumnPath(columns, chip.node.k) ??
      (badge.editable === "dotted" ? dottedColumnFor(chip.node) : column);
    pendingEditKeyRef.current = badge.valueKey;
    enterValueMode(
      resolved,
      buildEditorPrefill(resolved, chip, { monthsShort }),
    );
  };

  const removeBadge = (badge) => {
    commitTreeChange((d) =>
      removeLeafValue(d, badge.leafId, badge.valueKey),
    ).catch(() => {});
    setHighlightedBadge(null);
  };

  const onKeyDown = (e) => {
    // Host sibuk: ketikan tetap diterima (tak hilang), tapi commit (Enter)
    // ditolak sampai selesai -- bukan `readOnly` yang membuang ketikan user.
    if (draft.busy && e.key === "Enter") {
      e.preventDefault();
      return;
    }
    const sessionChips = visibleValueChips.length > 0;
    const idleNav = inputValue === "" && !sessionChips && badges.length > 0;
    // Navigasi/hapus badge idle (2 langkah, pola chip Search Bar atas).
    if (idleNav || highlightedBadge !== null) {
      const idx = badges.findIndex((b) => b.key === highlightedBadge);
      const caretAtStart =
        e.currentTarget.selectionStart === 0 &&
        e.currentTarget.selectionEnd === 0;
      if (e.key === "ArrowLeft" && (idx >= 0 || (idleNav && caretAtStart))) {
        e.preventDefault();
        setHighlightedBadge(
          badges[idx < 0 ? badges.length - 1 : Math.max(idx - 1, 0)].key,
        );
        return;
      }
      if (e.key === "ArrowRight" && idx >= 0) {
        e.preventDefault();
        setHighlightedBadge(badges[idx + 1]?.key ?? null);
        return;
      }
      if ((e.key === "Backspace" || e.key === "Delete") && idx >= 0) {
        e.preventDefault();
        removeBadge(badges[idx]);
        return;
      }
      if (e.key === "Backspace" && idleNav && idx < 0) {
        e.preventDefault();
        setHighlightedBadge(badges[badges.length - 1].key);
        return;
      }
      if ((e.key === "Enter" || e.key === " ") && idx >= 0) {
        e.preventDefault();
        setHighlightedBadge(null);
        editBadge(badges[idx]);
        return;
      }
      if (!["Shift", "Control", "Alt", "Meta"].includes(e.key)) {
        setHighlightedBadge(null);
      }
    }
    if (!valueColumn) {
      // Sesi sudah berakhir (mis. sesudah commit) tapi input masih fokus: panah
      // atas/bawah memulai sesi baru dan membuka dropdown lagi.
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        ensureSession();
      }
      return;
    }
    handleKeyDown(e);
  };

  const onBlur = (e) => {
    const next = e.relatedTarget;
    if (wrapRef.current?.contains(next) || contentRef.current?.contains(next)) {
      return;
    }
    setOpen(false);
    setHighlightedBadge(null);
    // Edit leaf = sesi sementara: batalkan saat fokus pergi (badge asli tampil
    // lagi). Sesi nilai BARU dibiarkan -- ketikan tetap di input sampai Enter
    // atau Escape (Requirement 6.4).
    if (editingLeafId) exitValueMode();
  };

  const mode = resolveValueMode(column);
  const dropdownVisible =
    open &&
    Boolean(valueColumn) &&
    (showValueList || showRelationResults || showHint);
  const dateTwoColumn = vmode === "date";
  const empty = badges.length === 0 && !visibleValueChips.length;

  return (
    <Popover open={dropdownVisible} onOpenChange={() => {}}>
      <PopoverAnchor asChild>
        <div
          ref={wrapRef}
          data-testid="column-filter-cell"
          aria-busy={draft.busy ? "true" : undefined}
          onBlur={onBlur}
          className={cn(
            "flex flex-wrap items-center gap-1 w-full min-w-0 overflow-y-auto rounded-md border border-input bg-background px-1 py-0.5 min-h-7 focus-within:ring-1 focus-within:ring-ring",
            CELL_MAX_HEIGHT,
            draft.busy && "opacity-60",
          )}
        >
          {badges.map((badge) => (
            <BadgeChip
              key={badge.key}
              badge={badge}
              highlighted={highlightedBadge === badge.key}
              onEdit={() => editBadge(badge)}
              onRemove={() => removeBadge(badge)}
            />
          ))}
          <ValueChipList value={value} />
          <Command
            shouldFilter={false}
            value={highlightedKey}
            onValueChange={setHighlightedKey}
            className="contents"
          >
            <PopoverTrigger asChild>
              <div className="flex-1 min-w-12">
                <input
                  ref={inputRef}
                  value={inputValue}
                  aria-label={columnTitle(column, t)}
                  placeholder={
                    empty && mode
                      ? t(`core.datatable.column_search.placeholder.${mode}`)
                      : ""
                  }
                  onFocus={() => {
                    ensureSession();
                    setOpen(true);
                  }}
                  onClick={() => {
                    ensureSession();
                    setOpen(true);
                  }}
                  onChange={(e) => {
                    ensureSession();
                    handleChange(e);
                  }}
                  onKeyDown={onKeyDown}
                  className="w-full h-6 bg-transparent text-xs outline-none placeholder:text-muted-foreground disabled:opacity-60 border-0! shadow-none! focus:ring-0! focus-visible:ring-0! focus-visible:ring-offset-0!"
                />
              </div>
            </PopoverTrigger>
            {dropdownVisible && (
              <PopoverContent
                ref={contentRef}
                align="start"
                onOpenAutoFocus={(e) => e.preventDefault()}
                collisionPadding={8}
                className={cn(
                  "p-0 max-w-[calc(100vw-1rem)]",
                  dateTwoColumn ? "w-[min(90vw,42rem)]" : "w-72",
                )}
              >
                <ColumnValueDropdown value={value} legendCtx={valueLegendCtx} />
              </PopoverContent>
            )}
          </Command>
          {usedInAdvanced && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span
                  role="img"
                  aria-label={t("core.datatable.column_search.advanced_used")}
                  className="inline-flex! shrink-0 text-muted-foreground"
                >
                  <SlidersHorizontal className="size-3" />
                </span>
              </TooltipTrigger>
              <TooltipContent>
                {t("core.datatable.column_search.advanced_used")}
              </TooltipContent>
            </Tooltip>
          )}
          {valueError && (
            <span
              role="alert"
              className="basis-full text-[10px] leading-tight text-destructive px-1"
            >
              {valueError}
            </span>
          )}
        </div>
      </PopoverAnchor>
    </Popover>
  );
}

/**
 * Sel Filter. Kolom yang BUKAN Kolom Searchable menghasilkan sel kosong tanpa
 * input (Requirement 3.8); hooks sel hanya hidup di `SearchableCell`.
 * @param {object} props lihat `SearchableCell`
 * @returns {React.JSX.Element|null}
 */
export default function ColumnFilterCell(props) {
  if (!isColumnSearchable(props.column)) return null;
  return <SearchableCell {...props} />;
}
