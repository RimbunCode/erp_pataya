import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "../../ui/alert-dialog";
import {
  Bookmark,
  BookmarkCheck,
  ChevronDown,
  Filter,
  Lock,
  Trash2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../../ui/dropdown-menu";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import useNestedFilters, {
  flattenFilters,
  NestedFiltersProvider,
} from "@/Hooks/useNestedFilters";

import { Button } from "../../ui/button";
import { FilterBuilderBody } from "./FilterBuilder";
import { Input } from "../../ui/input";
import LinkModel from "@/Components/LinkModel";
import LoadingIcon from "@/Components/LoadingIcon";
import axios from "axios";
import { cn } from "@/lib/utils";
import { gooeyToast as toast } from "@/lib/gooeyToast";
import { linkModelToFilterTree } from "@/lib/linkModelToFilterTree";
import { resolveColumn, validateTree } from "./filterValidation";
import { useLaravelReactI18n } from "laravel-react-i18n";

/**
 * FilterTable2 — pembungkus AlertDialog + saved-filter di sekitar FilterBuilder.
 * AlertDialog dipakai (bukan Dialog) agar klik overlay tidak menutup dialog —
 * mencegah kehilangan susunan filter karena misclick. Escape tetap menutup.
 *
 * Props:
 *   columns       : peta kolom (getColumns)
 *   initialFilters: tree filter aktif (controlled, dari DataTable2)
 *   onApply       : (tree) => void — kirim tree utuh untuk transport
 *   model         : FQCN model (untuk listing/save saved filter)
 *   activeFid     : id saved filter aktif (utk promote "Simpan")
 *   onSaved       : (savedFilter) => void — callback setelah named tersimpan
 *   isMobile      : tampilan trigger mobile
 *   trigger       : custom trigger element (opsional) — menggantikan tombol
 *     bawaan (Button/div) via AlertDialogTrigger asChild. Dipakai konsumen yang
 *     perlu trigger custom (mis. InputGroupButton di AdvanceSearchDialog LinkModel,
 *     spec linkmodel-advanced-search) — badge count jadi tanggung jawab konsumen
 *     sendiri saat trigger custom dipakai (activeCount internal tidak dirender).
 *   lockedFilters : tree LinkModelFilterTree NON-EDITABLE (opsional) — ditampilkan
 *     read-only di atas builder editable, TIDAK dihitung ke activeCount/badge
 *     (spec linkmodel-advanced-search, Requirement 5.6-5.8).
 * @param {object} root0
 * @param {object} root0.columns
 * @param {object} root0.initialFilters
 * @param {(tree: object) => void} root0.onApply
 * @param {string} root0.model
 * @param {string|number} root0.activeFid
 * @param {(savedFilter: object|null) => void} root0.onSaved
 * @param {boolean} [root0.isMobile]
 * @param {React.ReactNode} [root0.trigger]
 * @param {object} [root0.lockedFilters]
 * @returns {React.JSX.Element}
 */
function FilterTable({
  columns,
  initialFilters,
  onApply,
  model,
  activeFid,
  onSaved,
  isMobile = false,
  trigger,
  lockedFilters,
}) {
  const { t } = useLaravelReactI18n();
  const [open, setOpen] = useState(false);

  // Jumlah kondisi filter aktif (item lengkap) untuk badge di tombol Filter.
  // HANYA dari `initialFilters` (additive) -- `lockedFilters` sengaja TIDAK
  // pernah masuk hitungan ini (Requirement 4 AC4, Property 3 design.md).
  const activeCount = useMemo(() => {
    const root = initialFilters?.root;
    if (!root) return 0;
    return flattenFilters(root.c ?? root.children ?? {}).length;
  }, [initialFilters]);

  return (
    <NestedFiltersProvider initialFilters={initialFilters} columns={columns}>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogTrigger asChild>
          {trigger ??
            (isMobile ? (
              <div className="hover:bg-accent relative flex cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0">
                <Filter />
                {t("core.datatable.filter.filter")}
                {activeCount > 0 && (
                  <span className="ml-auto inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 py-0.5 text-xs font-semibold text-primary-foreground">
                    {activeCount}
                  </span>
                )}
              </div>
            ) : (
              <Button
                className={cn(
                  "flex-1 relative py-0! h-8 px-2! border-muted-foreground/50",
                  activeCount > 0 && "border-primary/60 text-primary",
                )}
                variant="secondary"
              >
                <Filter />
                {t("core.datatable.filter.filter")}
                {activeCount > 0 && (
                  <span className="inline-flex min-w-4.5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-semibold text-primary-foreground">
                    {activeCount}
                  </span>
                )}
              </Button>
            ))}
        </AlertDialogTrigger>
        <AlertDialogContent
          forceAsDialog
          onInteractOutside={(e) => e.preventDefault()}
          className="flex flex-col max-w-full md:max-w-(--breakpoint-xl) w-full h-auto max-h-[92svh] overflow-hidden"
        >
          <FilterTableContent
            initialFilters={initialFilters}
            onApply={onApply}
            model={model}
            activeFid={activeFid}
            onSaved={onSaved}
            isMobile={isMobile}
            open={open}
            setOpen={setOpen}
            lockedFilters={lockedFilters}
          />
        </AlertDialogContent>
      </AlertDialog>
    </NestedFiltersProvider>
  );
}

export default memo(FilterTable);

function FilterTableContent({
  initialFilters,
  onApply,
  model,
  activeFid,
  onSaved,
  isMobile,
  open,
  setOpen,
  lockedFilters,
}) {
  const { t } = useLaravelReactI18n();
  const { columns, filters, setErrors, clearErrors, setFromInitial } =
    useNestedFilters();
  const [applying, setApplying] = useState(false);
  // Status menyimpan/menimpa filter (dilaporkan SaveFilterControl) — dipakai
  // untuk meng-freeze seluruh dialog saat proses berjalan.
  const [saving, setSaving] = useState(false);
  const busy = applying || saving;
  // Daftar named filter (is_saved=true) milik user untuk model ini — di-share
  // antara SavedFilterBar (pilih) dan SaveFilterControl (timpa/baru) agar save
  // langsung me-refresh daftar tanpa reload.
  const [savedItems, setSavedItems] = useState([]);
  const [loadingSaved, setLoadingSaved] = useState(false);
  // Id filter yang SEDANG DIMUAT di builder (lokal dialog), terpisah dari
  // `activeFid` (filter yang sudah di-Apply ke tabel). Memilih/menyimpan hanya
  // mengubah ini — penerapan ke tabel baru terjadi saat tombol "Terapkan".
  const [loadedFid, setLoadedFid] = useState(activeFid ?? null);

  // Saat dialog dibuka, mulai dari filter aktif global.
  useEffect(() => {
    if (open) setLoadedFid(activeFid ?? null);
  }, [open, activeFid]);

  const loadSaved = useCallback(() => {
    if (!model) return;
    setLoadingSaved(true);
    axios
      .get(window.route("saved-filters.index"), { params: { model } })
      .then((res) => setSavedItems(res.data?.data ?? res.data ?? []))
      .catch(() => setSavedItems([]))
      .finally(() => setLoadingSaved(false));
  }, [model]);

  useEffect(() => {
    if (open) loadSaved();
  }, [open, loadSaved]);

  // Named filter yang sedang dimuat (untuk judul + deteksi dirty).
  const loadedSaved = useMemo(() => {
    if (!loadedFid) return null;
    return savedItems.find((x) => x.id === loadedFid) ?? null;
  }, [loadedFid, savedItems]);
  const loadedName = loadedSaved?.name ?? null;

  // Dirty: named filter aktif (is_saved=true) yang tree-nya sudah diubah di
  // builder. Bandingkan SELURUH item (termasuk yang belum lengkap) secara
  // urutan-independen — agar perubahan sekecil apa pun (mis. ganti operator,
  // tambah item kosong) langsung terdeteksi.
  const isDirty = useMemo(() => {
    if (!loadedSaved?.is_saved || !loadedSaved.filter) return false;
    const collectItems = (nodes, acc = []) => {
      for (const node of Object.values(nodes ?? {})) {
        if (!node || typeof node !== "object") continue;
        const children = node.c ?? node.children;
        if (children && typeof children === "object") {
          collectItems(children, acc);
        } else {
          acc.push([node.k ?? "", node.o ?? "", node.v ?? ""]);
        }
      }
      return acc;
    };
    const norm = (tree) => {
      const root = tree?.root ?? tree;
      return JSON.stringify(
        collectItems(root?.c ?? root?.children ?? {})
          .map((x) => JSON.stringify(x))
          .sort(),
      );
    };
    return norm(loadedSaved.filter) !== norm(filters);
  }, [loadedSaved, filters]);

  // Hapus sebuah named filter (per chip di SavedFilterBar).
  const removeSaved = useCallback(
    (id) => {
      if (!id) return;
      axios
        .delete(window.route("saved-filters.destroy", { savedFilter: id }))
        .then(() => {
          setSavedItems((prev) => prev.filter((x) => x.id !== id));
          if (id === loadedFid) setLoadedFid(null);
          // Bila yang dihapus adalah filter aktif global, lepaskan juga di tabel.
          if (id === activeFid) onSaved?.(null);
          toast.success(t("core.datatable.filter.saved.deleted_toast"));
        })
        .catch(() => {});
    },
    [loadedFid, activeFid, onSaved, t],
  );

  // Validasi frontend dulu, lalu kirim tree utuh ke parent (async save).
  // AlertDialogAction auto-close — kita selalu preventDefault dan mengontrol
  // penutupan dialog secara manual via setOpen agar:
  //  - invalid → dialog tetap terbuka + highlight error + toast
  //  - sukses  → dialog ditutup setelah save selesai
  //  - gagal   → dialog tetap terbuka (toast error dari caller)
  const applyFilters = async (e) => {
    e?.preventDefault?.();
    if (applying) return;

    const { valid, errors } = validateTree(filters, columns);
    if (!valid) {
      setErrors(errors);
      toast.error(t("core.datatable.filter.validation.invalid"));
      return;
    }

    clearErrors();
    setApplying(true);
    try {
      // Named filter yang dimuat & TIDAK diubah → terapkan langsung memakai id
      // named itu, tanpa membuat record baru. Bila diubah (dirty) atau ephemeral
      // → store (backend update-or-create; named yang dirty tak akan ditimpa).
      const useExisting = Boolean(loadedSaved?.is_saved) && !isDirty;
      // sort filter yang dimuat (null bila tak diatur) — dipakai caller utk
      // override sort halaman aktif (Requirement 5), tidak pernah dipaksa
      // bila null (AC 5.2).
      await onApply?.(filters, loadedFid, {
        useExisting,
        sort: loadedSaved?.sort ?? null,
      });
      setOpen?.(false);
    } catch {
      // Caller (DataTable2.persistFilterTree) sudah menampilkan toast error.
      // Dialog dibiarkan terbuka agar user dapat memperbaiki.
    } finally {
      setApplying(false);
    }
  };

  // Sinkronkan tree dari parent saat dialog dibuka.
  useEffect(() => {
    if (!open) return;
    setFromInitial(initialFilters);
  }, [open, initialFilters, setFromInitial]);

  return (
    <div className="relative flex flex-col min-h-0 flex-1">
      {/* Overlay freeze: kunci interaksi saat menyimpan/menerapkan. */}
      {busy && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-[1px] cursor-wait">
          <LoadingIcon className="size-6 text-primary" />
        </div>
      )}
      <fieldset
        disabled={busy}
        className={cn(
          "flex flex-col min-h-0 flex-1 border-0 p-0 m-0",
          busy && "pointer-events-none select-none",
        )}
      >
        <AlertDialogHeader className="border-b border-muted-foreground/30">
          <AlertDialogTitle className="pb-2 flex items-center gap-2">
            <span>{t("core.datatable.filter.filter")}</span>
            {loadedName && (
              <>
                <span className="text-muted-foreground">—</span>
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-base font-semibold transition-colors",
                    isDirty
                      ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                      : "bg-primary/10 text-primary",
                  )}
                  title={
                    isDirty ? t("core.datatable.filter.saved.dirty") : undefined
                  }
                >
                  {isDirty ? (
                    <span className="size-2 rounded-full bg-amber-500" />
                  ) : (
                    <BookmarkCheck className="size-4" />
                  )}
                  {loadedName}
                </span>
              </>
            )}
          </AlertDialogTitle>
          <AlertDialogDescription className="sr-only">
            {t("core.datatable.filter.filter")}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {model && (
          <SavedFilterBar
            items={savedItems}
            loading={loadingSaved}
            activeFid={loadedFid}
            onPick={(saved) => {
              // Hanya muat ke builder — belum diterapkan ke tabel (tunggu Apply).
              setFromInitial(saved.filter);
              setLoadedFid(saved.id);
            }}
            onRemove={removeSaved}
          />
        )}

        {lockedFilters && (
          <LockedFiltersSummary tree={lockedFilters} columns={columns} />
        )}

        <div className={cn(!isMobile && "max-h-[92%]", "flex flex-1 min-h-0")}>
          <FilterBuilderBody />
        </div>

        <div className="flex items-center justify-between pt-4 border-t gap-x-6 border-muted-foreground/50">
          {model && (
            <SaveFilterControl
              model={model}
              filter={filters}
              savedItems={savedItems}
              onSavingChange={setSaving}
              // Named filter yang dimuat & belum diubah tak punya yang perlu
              // disimpan → disable. Aktif lagi saat dirty / filter belum named.
              disabled={Boolean(loadedSaved?.is_saved) && !isDirty}
              onSaved={(saved) => {
                // Simpan hanya me-refresh daftar & menandai sebagai dimuat —
                // tidak menerapkan ke tabel (tunggu tombol Terapkan).
                loadSaved();
                if (saved?.id) setLoadedFid(saved.id);
              }}
            />
          )}
          <div className="flex gap-x-2 ml-auto">
            <AlertDialogCancel size="md" className="h-8 px-2! mt-0">
              {t("core.datatable.filter.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              size="md"
              className="h-8 px-2!"
              onClick={applyFilters}
              disabled={applying || busy}
            >
              {applying && <LoadingIcon className="size-4" />}
              {t("core.datatable.filter.apply_filters")}
            </AlertDialogAction>
          </div>
        </div>
      </fieldset>
    </div>
  );
}

/**
 * SavedFilterBar — daftar named filter milik user untuk model ini. Daftar
 * dikelola parent (FilterTableContent) agar konsisten dengan aksi simpan/timpa.
 * Memilih satu memuat tree-nya ke builder; chip yang dimuat di-highlight. Tiap
 * chip punya tombol hapus.
 * @param {object} root0
 * @param {Array<object>} root0.items
 * @param {boolean} root0.loading
 * @param {string|number} root0.activeFid
 * @param {(item: object) => void} root0.onPick
 * @param {(id: string|number) => void} root0.onRemove
 * @returns {React.JSX.Element}
 */
function SavedFilterBar({ items, loading, activeFid, onPick, onRemove }) {
  const { t } = useLaravelReactI18n();

  return (
    <div className="flex flex-wrap items-center gap-2 pb-2 border-b border-muted-foreground/20">
      <span className="text-muted-foreground text-sm shrink-0">
        {t("core.datatable.filter.saved.list")}
      </span>
      {loading ? (
        <span className="inline-flex items-center gap-2 text-muted-foreground text-sm">
          <LoadingIcon className="size-4" />
          {t("core.datatable.filter.saved.loading")}
        </span>
      ) : items.length === 0 ? (
        <span className="text-muted-foreground/70 text-sm italic">
          {t("core.datatable.filter.saved.empty")}
        </span>
      ) : (
        items.map((item) => {
          const isActive = item.id === activeFid;
          return (
            <span
              key={item.id}
              className={cn(
                "group inline-flex items-center rounded-full border pl-2.5 pr-1 py-0.5 text-sm transition-colors",
                isActive
                  ? "border-primary/60 bg-primary/10 text-primary ring-1 ring-primary/30"
                  : "border-muted-foreground/30 hover:border-muted-foreground/60 hover:bg-accent",
              )}
            >
              <button
                type="button"
                className="inline-flex cursor-pointer items-center gap-1.5 font-medium"
                onClick={() => onPick(item)}
              >
                <BookmarkCheck
                  className={cn(
                    "size-3.5 shrink-0",
                    isActive ? "text-primary" : "text-muted-foreground",
                  )}
                />
                {item.name || t("core.datatable.filter.saved.untitled")}
                {item.is_shared && (
                  <span className="inline-flex items-center rounded-full bg-muted-foreground/15 px-1.5 py-0 text-xs font-normal text-muted-foreground">
                    {t("core.datatable.filter.saved.shared_badge")}
                  </span>
                )}
              </button>
              {/* Shared filter dikelola lewat halaman Filter Templates, bukan
                  dari dropdown ini — sembunyikan aksi hapus di sini agar tidak
                  memicu 403 (destroy owner-only) untuk non-pengelola. */}
              {!item.is_shared && (
                <button
                  type="button"
                  className="ml-1 inline-flex size-5 cursor-pointer items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                  title={t("core.datatable.filter.delete.label")}
                  onClick={() => onRemove?.(item.id)}
                >
                  <Trash2 className="size-3.5" />
                </button>
              )}
            </span>
          );
        })
      )}
    </div>
  );
}

/**
 * SaveFilterControl — simpan filter aktif sebagai named. Dropdown:
 *  - "Simpan sebagai baru": input nama → SELALU buat record baru (POST tanpa
 *    fid) lalu promote menjadi named via PATCH name.
 *  - "Timpa <named>": overwrite TREE named existing via PATCH filter.
 * Setelah berhasil → toast + onSaved(refresh daftar).
 * @param {object} root0
 * @param {string} root0.model
 * @param {object} root0.filter
 * @param {Array<object>} root0.savedItems
 * @param {(saved: object) => void} root0.onSaved
 * @param {(saving: boolean) => void} root0.onSavingChange
 * @param {boolean} [root0.disabled]
 * @returns {React.JSX.Element}
 */
function SaveFilterControl({
  model,
  filter,
  savedItems,
  onSaved,
  onSavingChange,
  disabled = false,
}) {
  const { t } = useLaravelReactI18n();
  // mode: null (idle) | "new" (input nama)
  const [mode, setMode] = useState(null);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  // Laporkan status saving ke parent agar dialog bisa di-freeze.
  useEffect(() => {
    onSavingChange?.(saving);
  }, [saving, onSavingChange]);

  // Simpan sebagai named BARU: SELALU buat row baru (POST tanpa fid agar tidak
  // menimpa filter aktif), lalu promote dengan name.
  const saveAsNew = async () => {
    const trimmed = name.trim();
    if (!trimmed || saving) return;
    setSaving(true);
    try {
      const created = await axios.post(window.route("saved-filters.store"), {
        model,
        filter,
      });
      const id = created.data?.id;
      if (!id) return;
      const res = await axios.patch(
        window.route("saved-filters.update", { savedFilter: id }),
        { name: trimmed },
      );
      onSaved?.(res.data ?? { id, name: trimmed, filter });
      toast.success(t("core.datatable.filter.saved.saved_toast"));
      setMode(null);
      setName("");
    } catch {
      toast.error(t("core.datatable.filter.saved.save_error"));
    } finally {
      setSaving(false);
    }
  };

  // Timpa TREE named existing (nama tak berubah).
  const overwrite = async (target) => {
    if (saving) return;
    setSaving(true);
    try {
      const res = await axios.patch(
        window.route("saved-filters.update", { savedFilter: target.id }),
        { filter },
      );
      onSaved?.(res.data ?? { ...target, filter });
      toast.success(t("core.datatable.filter.saved.updated_toast"));
    } catch {
      toast.error(t("core.datatable.filter.saved.save_error"));
    } finally {
      setSaving(false);
    }
  };

  // Mode input nama (Simpan sebagai baru).
  if (mode === "new") {
    return (
      <div className="flex items-center gap-2">
        <Input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("core.datatable.filter.saved.name_placeholder")}
          className="h-8 w-48"
          onKeyDown={(e) => e.key === "Enter" && saveAsNew()}
        />
        <Button
          className="h-8 px-2!"
          type="button"
          disabled={saving || !name.trim()}
          onClick={saveAsNew}
        >
          <BookmarkCheck />
          {t("core.datatable.filter.saved.save")}
        </Button>
        <Button
          variant="ghost"
          className="h-8 px-2!"
          type="button"
          onClick={() => {
            setMode(null);
            setName("");
          }}
        >
          {t("core.datatable.filter.cancel")}
        </Button>
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className="h-8 px-2!"
          type="button"
          disabled={disabled}
        >
          <Bookmark />
          {t("core.datatable.filter.saved.save")}
          <ChevronDown className="size-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuItem onSelect={() => setMode("new")}>
          <Bookmark className="size-4" />
          {t("core.datatable.filter.saved.save_new")}
        </DropdownMenuItem>
        {savedItems.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-muted-foreground text-xs">
              {t("core.datatable.filter.saved.list")}
            </DropdownMenuLabel>
            {savedItems.map((item) => (
              <DropdownMenuItem key={item.id} onSelect={() => overwrite(item)}>
                <BookmarkCheck className="size-4" />
                {t("core.datatable.filter.saved.overwrite", {
                  name: item.name || t("core.datatable.filter.saved.untitled"),
                })}
              </DropdownMenuItem>
            ))}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * LockedFiltersSummary — ringkasan READ-ONLY kondisi prop `filters` LinkModel
 * (non-editable) di dalam FilterTable. Sengaja TERPISAH TOTAL dari tree
 * additive/editable (`useNestedFilters`) -- BUKAN node `locked` disisipkan ke
 * tree yang sama -- supaya:
 *  (a) tidak perlu extend `removeNode`/`updateItem`/`wrapItemWithGroup` dgn
 *      guard `locked` (state itu dipakai bersama DataTable2, blast radius lebih
 *      besar kalau disentuh);
 *  (b) badge count (`activeCount` di atas, dari `flattenFilters(initialFilters)`)
 *      OTOMATIS tidak pernah menghitung kondisi locked -- konsekuensi gratis
 *      dari pemisahan ini, bukan logic exclude tambahan (Property 3 design.md).
 * Reuse penuh `linkModelToFilterTree()` (konversi grammar) -- kondisi relasi
 * match-by-id (mis. `{ customer: { id: 5 } }`) otomatis jadi node `{k,o:"=",v}`
 * yang direnderkan via `<LinkModel disabled>` di bawah (bukan reimplementasi
 * parsing sendiri). Requirement 5.6-5.8.
 * @param {object} root0
 * @param {object} root0.tree LinkModelFilterTree (prop `filters` LinkModel, apa adanya)
 * @param {object} root0.columns peta kolom (getColumns)
 * @returns {React.JSX.Element|null}
 */
function LockedFiltersSummary({ tree, columns }) {
  const { t } = useLaravelReactI18n();
  const converted = useMemo(
    () => linkModelToFilterTree(tree, columns ?? {}),
    [tree, columns],
  );
  const rootChildren = converted?.root?.c ?? {};
  if (Object.keys(rootChildren).length === 0) return null;

  return (
    <div className="flex flex-col gap-1.5 pb-3 mb-3 border-b border-muted-foreground/20">
      <span className="text-muted-foreground text-sm flex items-center gap-1.5">
        <Lock className="size-3.5" />
        {t("core.datatable.filter.locked.label")}
      </span>
      <LockedFilterNodes nodes={rootChildren} columns={columns} t={t} />
    </div>
  );
}

/**
 * @param {object} root0
 * @param {{[id: string]: object}} root0.nodes
 * @param {object} root0.columns
 * @param {(key: string) => string} root0.t
 * @returns {React.JSX.Element}
 */
function LockedFilterNodes({ nodes, columns, t }) {
  return (
    <div className="flex flex-col gap-1">
      {Object.entries(nodes ?? {}).map(([id, node]) => (
        <LockedFilterNode key={id} node={node} columns={columns} t={t} />
      ))}
    </div>
  );
}

/**
 * @param {object} root0
 * @param {object} root0.node node tree FilterBuilder -- group {k,c} atau leaf {k,o,v}
 * @param {object} root0.columns
 * @param {(key: string) => string} root0.t
 * @returns {React.JSX.Element|null}
 */
function LockedFilterNode({ node, columns, t }) {
  if (!node) return null;

  // Group (AND/OR).
  if (node.c !== undefined && node.k) {
    const groupLabel =
      String(node.k).toLowerCase() === "or"
        ? t("core.datatable.filter.operator.or")
        : t("core.datatable.filter.operator.and");
    return (
      <div className="flex flex-col gap-1 pl-3 border-l-2 border-muted-foreground/20">
        <span className="text-muted-foreground text-xs uppercase">
          {groupLabel}
        </span>
        <LockedFilterNodes nodes={node.c} columns={columns} t={t} />
      </div>
    );
  }

  // Leaf {k: column, o: operator, v: value}.
  const colNode = resolveColumn(columns, node.k);
  const colLabel =
    colNode?.title ?? (colNode?.titleTrans ? t(colNode.titleTrans) : node.k);
  const opLabel = t(`core.datatable.filter.operator.${node.o}`);
  const isRelationEquals =
    colNode &&
    ["relation", "relations"].includes(colNode.type) &&
    node.o === "=";

  return (
    <div className="flex flex-wrap items-center gap-2 py-1 px-2 rounded-md bg-muted/40 text-sm">
      <span className="font-medium">{colLabel}</span>
      <span className="text-muted-foreground text-xs">{opLabel}</span>
      {isRelationEquals ? (
        <div className="pointer-events-none opacity-90">
          <LinkModel
            model={colNode.related}
            value={node.v ?? null}
            disabled
            onValueChange={() => {}}
          />
        </div>
      ) : (
        <span className="text-muted-foreground">
          {Array.isArray(node.v) ? node.v.join(", ") : String(node.v ?? "")}
        </span>
      )}
    </div>
  );
}
