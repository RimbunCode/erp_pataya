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
import { Bookmark, BookmarkCheck, Filter, Trash2 } from "lucide-react";
import { memo, useCallback, useEffect, useState } from "react";
import useNestedFilters, {
  NestedFiltersProvider,
} from "@/Hooks/useNestedFilters";

import { Button } from "../../ui/button";
import { FilterBuilderBody } from "./FilterBuilder";
import { Input } from "../../ui/input";
import axios from "axios";
import { cn } from "@/lib/utils";
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
 */
function FilterTable({
  columns,
  initialFilters,
  onApply,
  model,
  activeFid,
  onSaved,
  isMobile = false,
}) {
  const { t } = useLaravelReactI18n();
  const [open, setOpen] = useState(false);

  return (
    <NestedFiltersProvider initialFilters={initialFilters} columns={columns}>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogTrigger asChild>
          {isMobile ? (
            <div className="hover:bg-accent relative flex cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0">
              <Filter />
              {t("core.datatable.filter.filter")}
            </div>
          ) : (
            <Button
              className={cn(
                "flex-1 relative py-0! h-8 px-2! border-muted-foreground/50",
              )}
              variant="secondary"
            >
              <Filter />
              {t("core.datatable.filter.filter")}
            </Button>
          )}
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
}) {
  const { t } = useLaravelReactI18n();
  const { filters, setFromInitial } = useNestedFilters();

  const applyFilters = () => {
    // Kirim tree utuh — bukan array datar — agar struktur AND/OR & nesting utuh.
    // AlertDialogAction menutup dialog otomatis setelah handler ini.
    onApply?.(filters);
  };

  // Sinkronkan tree dari parent saat dialog dibuka.
  useEffect(() => {
    if (!open) return;
    setFromInitial(initialFilters);
  }, [open, initialFilters, setFromInitial]);

  return (
    <>
      <AlertDialogHeader className="border-b border-muted-foreground/30">
        <AlertDialogTitle className="pb-2 ">
          {t("core.datatable.filter.filter")}
        </AlertDialogTitle>
        <AlertDialogDescription className="sr-only">
          {t("core.datatable.filter.filter")}
        </AlertDialogDescription>
      </AlertDialogHeader>

      {model && (
        <SavedFilterBar
          model={model}
          onPick={(saved) => {
            setFromInitial(saved.filter);
          }}
        />
      )}

      <div className={cn(!isMobile && "max-h-[92%]", "flex flex-1 min-h-0")}>
        <FilterBuilderBody />
      </div>

      <div className="flex items-center justify-between pt-4 border-t gap-x-6 border-muted-foreground/50">
        {model && (
          <SaveFilterControl
            model={model}
            filter={filters}
            activeFid={activeFid}
            onSaved={onSaved}
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
          >
            {t("core.datatable.filter.apply_filters")}
          </AlertDialogAction>
        </div>
      </div>
    </>
  );
}

/**
 * SavedFilterBar — daftar saved filter milik user (listing private) untuk model
 * ini. Memilih satu memuat tree-nya ke builder.
 */
function SavedFilterBar({ model, onPick }) {
  const { t } = useLaravelReactI18n();
  const [items, setItems] = useState([]);

  const load = useCallback(() => {
    axios
      .get(window.route("saved-filters.index"), { params: { model } })
      .then((res) => setItems(res.data?.data ?? res.data ?? []))
      .catch(() => setItems([]));
  }, [model]);

  useEffect(() => {
    load();
  }, [load]);

  const remove = (id) => {
    axios
      .delete(window.route("saved-filters.destroy", { savedFilter: id }))
      .then(() => setItems((prev) => prev.filter((x) => x.id !== id)))
      .catch(() => {});
  };

  if (items.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 pb-2 border-b border-muted-foreground/20">
      <span className="text-muted-foreground text-sm">
        {t("core.datatable.filter.saved.list")}
      </span>
      {items.map((item) => (
        <span
          key={item.id}
          className="inline-flex items-center gap-1 rounded-full border border-muted-foreground/30 px-2 py-0.5 text-sm"
        >
          <button
            type="button"
            className="hover:underline"
            onClick={() => onPick(item)}
          >
            {item.name}
          </button>
          <button
            type="button"
            className="text-muted-foreground hover:text-destructive"
            onClick={() => remove(item.id)}
          >
            <Trash2 className="size-3.5" />
          </button>
        </span>
      ))}
    </div>
  );
}

/**
 * SaveFilterControl — menyimpan filter aktif menjadi named. Bila `activeFid`
 * tersedia (filter sudah di-apply → ada row ephemeral), promote row itu via
 * PATCH; bila belum, buat row baru via POST lalu promote.
 */
function SaveFilterControl({ model, filter, activeFid, onSaved }) {
  const { t } = useLaravelReactI18n();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      let id = activeFid;
      if (!id) {
        const res = await axios.post(window.route("saved-filters.store"), {
          model,
          filter,
        });
        id = res.data?.id;
      }
      if (!id) return;
      const res = await axios.patch(
        window.route("saved-filters.update", { savedFilter: id }),
        { name: name.trim() },
      );
      onSaved?.(res.data ?? { id, name: name.trim() });
      setEditing(false);
      setName("");
    } finally {
      setSaving(false);
    }
  };

  if (!editing) {
    return (
      <Button
        variant="outline"
        className="h-8 px-2!"
        type="button"
        onClick={() => setEditing(true)}
      >
        <Bookmark />
        {t("core.datatable.filter.saved.save")}
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={t("core.datatable.filter.saved.name_placeholder")}
        className="h-8 w-48"
        onKeyDown={(e) => e.key === "Enter" && save()}
      />
      <Button
        className="h-8 px-2!"
        type="button"
        disabled={saving || !name.trim()}
        onClick={save}
      >
        <BookmarkCheck />
        {t("core.datatable.filter.saved.save")}
      </Button>
    </div>
  );
}
