// SearchPanel — isi dropdown Search Bar saat input kosong: TIGA kolom, Filter
// (filter tersimpan + simpan/timpa + Builder lanjutan + Hapus semua), Group
// (group by) dan Kolom (daftar kolom yang bisa dicari -> klik = mode value).
// Spec datatable2-advanced-search revisi 2 (Requirement 9). Host-agnostic:
// semua state (daftar saved filter, dirty, dsb) dimiliki `SearchBar` -- ini
// murni presentasi + callback. Wadahnya (Popover anchor ke bar) juga milik
// SearchBar, jadi komponen ini TIDAK punya Popover/Dialog sendiri.

import { Bookmark, BookmarkCheck, Trash2 } from "lucide-react";

import { Button } from "@/Components/ui/button";
import GroupLevelsEditor from "@/Components/Table/Group/GroupLevelsEditor";
import LoadingIcon from "@/Components/LoadingIcon";
import { SaveFilterControl } from "../Filter/FilterTable2";
import { cn } from "@/lib/utils";
import { useLaravelReactI18n } from "laravel-react-i18n";

// Requirement 33: navigasi keyboard roving-tabindex -- BUKAN via state
// "highlighted key" virtual (pola cmdk yg dipakai saran/daftar nilai
// SearchBar), krn konten 3 kolom Panel HETEROGEN & jumlah item per kolom tak
// terprediksi (SavedFilterList jumlahnya dinamis, GroupLevelsEditor py beberapa
// sub-kontrol sendiri, ColumnList jumlahnya ikut daftar kolom) -- fokus DOM
// NATIF (`.focus()`) dipakai sbg gantinya: robust ke isi kolom apa pun tanpa
// perlu tahu strukturnya, Enter/Space aktivasi tombol otomatis (bawaan
// browser), tak perlu logic terpisah. Pindah-kolom (Left/Right) coba
// pertahankan INDEX yg sama, di-clamp kalau kolom tujuan lebih pendek.
// `tabindex="-1"` dikecualikan JUGA utk button/input: Checkbox visual di baris
// GroupLevelsEditor (aria-hidden, tabIndex -1, hanya hiasan -- targetnya baris
// role="checkbox") tak boleh jadi tujuan fokus panah.
const FOCUSABLE_SELECTOR =
  'button:not([disabled]):not([tabindex="-1"]), [href], input:not([disabled]):not([tabindex="-1"]), [tabindex]:not([tabindex="-1"])';

const focusableItemsIn = (section) =>
  Array.from(section.querySelectorAll(FOCUSABLE_SELECTOR));

// Jumlah kolom grid per jumlah seksi (kelas Tailwind harus statis).
const GRID_COLS = {
  1: "md:grid-cols-1",
  2: "md:grid-cols-2",
  3: "md:grid-cols-3",
};

const SectionTitle = ({ children }) => (
  <span className="text-sm font-medium text-muted-foreground">{children}</span>
);

/**
 * Daftar Filter Tersimpan -- badge Shared, penanda sumber aktif (emas, sama
 * dgn chip sumber), tombol hapus HANYA untuk item bukan shared
 * (Requirement 9.2).
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
              isActive ? "bg-amber-500/15" : "hover:bg-accent",
            )}
          >
            <button
              type="button"
              aria-current={isActive ? "true" : undefined}
              className="flex-1 flex items-center gap-1.5 text-left text-sm overflow-hidden"
              onClick={() => onPick(item)}
            >
              {isActive ? (
                <BookmarkCheck className="size-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
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
 * Daftar kolom yang bisa dicari (klik = SearchBar masuk mode value utk kolom
 * itu, tanpa dialog operator).
 * @param {object} root0
 * @param {Array<{name: string, label: string}>} root0.items
 * @param {(name: string) => void} root0.onPick
 * @returns {React.JSX.Element}
 */
function ColumnList({ items, onPick }) {
  return (
    <ul className="flex flex-col gap-0.5 max-h-56 overflow-y-auto">
      {items.map((item) => (
        <li key={item.name}>
          <button
            type="button"
            className="w-full text-left text-sm rounded-md px-2 py-1 hover:bg-accent truncate"
            onClick={() => onPick(item.name)}
          >
            {item.label}
          </button>
        </li>
      ))}
    </ul>
  );
}

/**
 * SearchPanel — isi panel 3 kolom.
 * @param {object} root0
 * @param {string} [root0.model] tanpa ini daftar & simpan/timpa tidak aktif
 * @param {object} root0.columns peta kolom (utk GroupLevelsEditor)
 * @param {Array<object>} [root0.savedFilters]
 * @param {boolean} [root0.loadingSaved]
 * @param {string|number} [root0.sourceId] saved filter sumber aktif
 * @param {(item: object) => void} root0.onPickSaved
 * @param {(id: string|number) => void} root0.onRemoveSaved
 * @param {object} root0.filter tree aktif
 * @param {Array<object>} [root0.saveItems] filter sumber yg sedang diubah
 *   (dirty, bukan shared) -- namanya jadi isi awal isian nama simpan
 * @param {() => {sort: string|null, group: object|null}} [root0.getViewSnapshot]
 * @param {(saved: object) => void} root0.onSaved
 * @param {() => void} root0.onOpenBuilder
 * @param {() => void} root0.onClearAll
 * @param {boolean} root0.hasFilters
 * @param {Array<{value: string, label: string}>} [root0.groupOptions]
 * @param {Array<{column: string, granularity: *, range: *}>} [root0.group] `Groups` aktif (urutan = nesting)
 * @param {(groups: Array) => void} root0.onGroupChange
 * @param {Array<{name: string, label: string}>} [root0.columnList] kolom yang
 *   bisa dicari (sudah disaring & diurut host)
 * @param {(name: string) => void} [root0.onPickColumn]
 * @param {() => void} [root0.onFocusInput] Revisi 12: panah ATAS di item
 *   pertama kolom -> kembalikan fokus ke kotak search.
 * @param {() => void} [root0.onClose] Requirement 33: Escape saat fokus SUDAH
 *   pindah ke tombol di dalam Panel (bukan lagi di input) -- tanpa ini,
 *   Escape cuma tertangkap `handleInputKeyDown` yg tak lagi ke-trigger.
 * @returns {React.JSX.Element}
 */
export default function SearchPanel({
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
  columnList,
  onPickColumn,
  onClose,
  onFocusInput,
}) {
  const { t } = useLaravelReactI18n();
  const hasGroupSection =
    Array.isArray(groupOptions) && groupOptions.length > 0;
  const hasColumnSection = Array.isArray(columnList) && columnList.length > 0;
  const sectionCount = 1 + Number(hasGroupSection) + Number(hasColumnSection);

  /**
   * Requirement 33: Up/Down pindah item DALAM kolom aktif (clamp, tak wrap);
   * Left/Right pindah ANTAR kolom (wrap-around), coba pertahankan index yg
   * sama (clamp ke kolom tujuan bila lebih pendek); Escape tutup Panel.
   * @param {React.KeyboardEvent<HTMLDivElement>} e
   */
  const handlePanelKeyDown = (e) => {
    // Handle urutan level Group (dnd-kit) yang SEDANG diangkat via keyboard
    // (`aria-pressed="true"`): Spasi/panah/Enter/Escape milik dnd-kit -- tanpa
    // pengecualian ini panah memindah fokus ke baris lain & Spasi berikutnya
    // menoggle baris itu (bug nyata, ketahuan di browser; jsdom tak menjalankan
    // sensor keyboard dnd-kit).
    if (
      e.target instanceof Element &&
      e.target.closest('[aria-roledescription="sortable"][aria-pressed="true"]')
    ) {
      return;
    }
    if (e.key === "Escape") {
      onClose?.();
      return;
    }
    // Enter TIDAK boleh sampai ke `<Command>` cmdk milik SearchBar: Panel
    // dirender di dalam portal Popover yg (lewat React tree) tetap turunan
    // `<Command>` itu, dan `onKeyDown` root cmdk memanggil `preventDefault()`
    // utk Enter (mau "pilih item ter-highlight") -- akibatnya klik native
    // tombol yg sedang fokus di Panel dibatalkan & Enter tak berbuat apa pun
    // (bug nyata dari feedback pemakaian). Panel bukan item cmdk, jadi cmdk
    // tak punya urusan dgn Enter di sini.
    if (e.key === "Enter") {
      e.stopPropagation();
      return;
    }
    if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
      return;
    }
    const root = e.currentTarget;
    const sections = Array.from(root.children).filter(
      (el) => el.tagName === "SECTION",
    );
    const active = document.activeElement;
    const sectionIdx = sections.findIndex((s) => s.contains(active));
    if (sectionIdx === -1) return;

    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      const items = focusableItemsIn(sections[sectionIdx]);
      const idx = items.indexOf(active);
      const nextIdx = e.key === "ArrowDown" ? idx + 1 : idx - 1;
      if (nextIdx >= 0 && nextIdx < items.length) {
        e.preventDefault();
        items[nextIdx].focus();
      } else if (e.key === "ArrowUp" && idx === 0) {
        // Revisi 12: panah ATAS di item pertama kolom = kembali ke kotak search.
        e.preventDefault();
        onFocusInput?.();
      }
      return;
    }

    const currentItems = focusableItemsIn(sections[sectionIdx]);
    const idx = Math.max(0, currentItems.indexOf(active));
    const delta = e.key === "ArrowRight" ? 1 : -1;
    const nextSectionIdx =
      (sectionIdx + delta + sections.length) % sections.length;
    const nextItems = focusableItemsIn(sections[nextSectionIdx]);
    if (nextItems.length > 0) {
      e.preventDefault();
      nextItems[Math.min(idx, nextItems.length - 1)].focus();
    }
  };

  return (
    <div
      onKeyDown={handlePanelKeyDown}
      className={cn(
        "grid grid-cols-1 gap-4 p-3 max-h-[min(70vh,26rem)] overflow-y-auto",
        GRID_COLS[sectionCount],
        "md:gap-0 md:divide-x md:divide-muted-foreground/20",
      )}
    >
      <section className="flex flex-col gap-2 md:px-3 md:first:pl-0 min-w-0">
        <SectionTitle>{t("core.datatable.filter.filter")}</SectionTitle>
        {/* Tanpa `model`, Filter Tersimpan tidak aktif sama sekali (daftar &
            simpan/timpa); aksi Builder/Hapus semua tetap ada. */}
        {model && (
          <SavedFilterList
            items={savedFilters}
            loading={loadingSaved}
            activeId={sourceId}
            onPick={onPickSaved}
            onRemove={onRemoveSaved}
            t={t}
          />
        )}
        <div
          className={cn(
            "flex flex-col items-start gap-1",
            model && "pt-2 border-t border-muted-foreground/20",
          )}
        >
          {model && (
            // Tanpa filter satu pun backend menolak (422 empty_tree) -- nonaktif.
            // Nama yg sama dgn filter tersimpan MILIK SENDIRI (bukan shared --
            // dikelola lewat Filter Templates) = timpa, bukan duplikat. Nama
            // sumber yg sedang diubah (`saveItems`) jadi isi awal: Enter = timpa.
            <SaveFilterControl
              model={model}
              filter={filter}
              savedItems={(savedFilters ?? []).filter(
                (item) => !item.is_shared,
              )}
              defaultName={saveItems?.[0]?.name}
              disabled={!hasFilters}
              className="w-full justify-start"
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
      </section>
      {hasGroupSection && (
        <section className="flex flex-col gap-2 md:px-3 min-w-0">
          <SectionTitle>{t("core.datatable.group_by")}</SectionTitle>
          <GroupLevelsEditor
            options={groupOptions}
            columns={columns}
            value={group ?? []}
            onChange={onGroupChange}
            className="w-full"
          />
        </section>
      )}
      {hasColumnSection && (
        <section className="flex flex-col gap-2 md:px-3 md:last:pr-0 min-w-0">
          <SectionTitle>
            {t("core.datatable.search.section.column")}
          </SectionTitle>
          <ColumnList
            items={columnList}
            onPick={(name) => onPickColumn?.(name)}
          />
        </section>
      )}
    </div>
  );
}
