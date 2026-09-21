// SearchPanel — Panel ▾ di ujung Search Bar: kolom Filter Tersimpan (daftar +
// simpan/timpa + Builder lanjutan + Hapus semua filter) dan kolom Group by
// (design.md §5.8; Requirement 9). Host-agnostic: semua state (daftar saved
// filter, dirty, dsb) dimiliki `SearchBar` -- komponen ini murni presentasi +
// callback, mirror pola `SavedFilterBar`/`SaveFilterControl` di FilterTable2
// (parent yang pegang state & axios, child cuma render + lapor lewat prop).

import { Bookmark, BookmarkCheck, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/Components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/Components/ui/popover";

import { Button } from "@/Components/ui/button";
import { GroupPicker } from "./ChipEditor";
import LoadingIcon from "@/Components/LoadingIcon";
import { SaveFilterControl } from "../Filter/FilterTable2";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/Hooks/use-mobile";
import { useLaravelReactI18n } from "laravel-react-i18n";

/**
 * Daftar Filter Tersimpan -- badge Shared, penanda sumber aktif, tombol
 * hapus HANYA untuk item bukan shared (Requirement 9.2).
 * @param {object} root0
 * @param {Array<object>} root0.items
 * @param {boolean} root0.loading
 * @param {string|number} root0.activeId
 * @param {(item: object) => void} root0.onPick
 * @param {(id: string|number) => void} root0.onRemove
 * @param {(key: string, params?: object) => string} root0.t
 * @returns {React.JSX.Element}
 */
function SavedFilterList({ items, loading, activeId, onPick, onRemove, t }) {
  if (loading) {
    return (
      <span className="inline-flex items-center gap-2 text-muted-foreground text-sm py-1">
        <LoadingIcon className="size-4" />
        {t("core.datatable.filter.saved.loading")}
      </span>
    );
  }
  if (!items || items.length === 0) {
    return (
      <p className="text-muted-foreground/70 text-sm italic py-1">
        {t("core.datatable.filter.saved.empty")}
      </p>
    );
  }
  return (
    <ul className="flex flex-col gap-0.5 max-h-48 overflow-y-auto">
      {items.map((item) => {
        const isActive = item.id === activeId;
        return (
          <li
            key={item.id}
            className={cn(
              "group flex items-center gap-1.5 rounded-md px-2 py-1",
              isActive ? "bg-primary/10" : "hover:bg-accent",
            )}
          >
            <button
              type="button"
              aria-current={isActive ? "true" : undefined}
              className="flex-1 flex items-center gap-1.5 text-left text-sm overflow-hidden"
              onClick={() => onPick(item)}
            >
              {isActive ? (
                <BookmarkCheck className="size-3.5 shrink-0 text-primary" />
              ) : (
                <Bookmark className="size-3.5 shrink-0 text-muted-foreground" />
              )}
              <span className="truncate">
                {item.name || t("core.datatable.filter.saved.untitled")}
              </span>
              {item.is_shared && (
                <span className="shrink-0 rounded-full bg-muted-foreground/15 px-1.5 py-0 text-xs font-normal text-muted-foreground">
                  {t("core.datatable.filter.saved.shared_badge")}
                </span>
              )}
            </button>
            {!item.is_shared && (
              <button
                type="button"
                className="shrink-0 inline-flex size-5 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                title={t("core.datatable.filter.delete.label")}
                onClick={() => onRemove(item.id)}
              >
                <Trash2 className="size-3.5" />
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Isi Panel -- dipakai baik di Popover (desktop) maupun Dialog (mobile).
 * @param {object} root0
 * @param {(key: string, params?: object) => string} root0.t
 * @returns {React.JSX.Element}
 */
function SearchPanelBody({
  t,
  model,
  columns,
  savedFilters,
  loadingSaved,
  sourceId,
  onPickSaved,
  onRemoveSaved,
  filter,
  saveItems,
  getViewSnapshot,
  onSaved,
  onOpenBuilder,
  onClearAll,
  hasFilters,
  groupOptions,
  group,
  onGroupChange,
}) {
  const hasGroupSection = Array.isArray(groupOptions) && groupOptions.length > 0;
  return (
    <div
      className={cn(
        "flex flex-col gap-4",
        hasGroupSection && "md:flex-row md:divide-x md:divide-muted-foreground/20",
      )}
    >
      <div className="flex-1 flex flex-col gap-2 md:pr-4 min-w-56">
        {/* Tanpa `model`, Filter Tersimpan tidak aktif sama sekali (judul,
            daftar & simpan/timpa); aksi Builder/Hapus semua tetap ada. */}
        {model && (
          <>
            <span className="text-sm font-medium text-muted-foreground">
              {t("core.datatable.search.section.saved")}
            </span>
            <SavedFilterList
              items={savedFilters}
              loading={loadingSaved}
              activeId={sourceId}
              onPick={onPickSaved}
              onRemove={onRemoveSaved}
              t={t}
            />
          </>
        )}
        <div
          className={cn(
            "flex flex-col items-start gap-1",
            model && "pt-2 border-t border-muted-foreground/20",
          )}
        >
          {model && (
            <SaveFilterControl
              model={model}
              filter={filter}
              savedItems={saveItems ?? []}
              getViewSnapshot={getViewSnapshot}
              onSaved={onSaved}
            />
          )}
          <Button
            type="button"
            variant="ghost"
            className="justify-start h-8 px-2! w-full"
            onClick={onOpenBuilder}
          >
            {t("core.datatable.search.advanced_builder")}
          </Button>
          {hasFilters && (
            <Button
              type="button"
              variant="ghost"
              className="justify-start h-8 px-2! w-full text-destructive hover:text-destructive"
              onClick={onClearAll}
            >
              {t("core.datatable.search.clear_all")}
            </Button>
          )}
        </div>
      </div>
      {hasGroupSection && (
        <div className="flex-1 flex flex-col gap-2 md:pl-4 min-w-56">
          <span className="text-sm font-medium text-muted-foreground">
            {t("core.datatable.group_by")}
          </span>
          <GroupPicker
            groupOptions={groupOptions}
            columns={columns}
            value={group ?? { column: null, granularity: null, range: null }}
            onChange={onGroupChange}
          />
        </div>
      )}
    </div>
  );
}

/**
 * SearchPanel — Panel ▾: desktop `Popover`, mobile `Dialog` (Requirement 9.5).
 * @param {object} root0
 * @param {React.ReactNode} root0.trigger tombol ▾ (dirender via Trigger asChild)
 * @param {boolean} root0.open
 * @param {(open: boolean) => void} root0.onOpenChange
 * @param {string} [root0.model]
 * @param {object} root0.columns
 * @param {Array<object>} [root0.savedFilters]
 * @param {boolean} [root0.loadingSaved]
 * @param {string|number} [root0.sourceId]
 * @param {(item: object) => void} root0.onPickSaved
 * @param {(id: string|number) => void} root0.onRemoveSaved
 * @param {object} root0.filter tree aktif
 * @param {Array<object>} [root0.saveItems]
 * @param {() => {sort: string|null, group: object|null}} [root0.getViewSnapshot]
 * @param {(saved: object) => void} root0.onSaved
 * @param {() => void} root0.onOpenBuilder
 * @param {() => void} root0.onClearAll
 * @param {boolean} root0.hasFilters
 * @param {Array<{value: string, label: string}>} [root0.groupOptions]
 * @param {{column: string|null, granularity: string|null, range: number|null}} [root0.group]
 * @param {(patch: object) => void} root0.onGroupChange
 * @returns {React.JSX.Element}
 */
export default function SearchPanel({ trigger, open, onOpenChange, ...bodyProps }) {
  const { t } = useLaravelReactI18n();
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogTrigger asChild>{trigger}</DialogTrigger>
        <DialogContent forceAsDialog>
          <DialogHeader>
            <DialogTitle>{t("core.datatable.search.open_panel")}</DialogTitle>
            <DialogDescription className="sr-only">
              {t("core.datatable.search.open_panel")}
            </DialogDescription>
          </DialogHeader>
          <SearchPanelBody {...bodyProps} t={t} />
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent align="end" className="w-auto max-w-md p-4">
        <SearchPanelBody {...bodyProps} t={t} />
      </PopoverContent>
    </Popover>
  );
}
