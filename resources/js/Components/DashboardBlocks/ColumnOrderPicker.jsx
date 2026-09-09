import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { GripVerticalIcon, PlusIcon, XIcon } from "lucide-react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/Components/ui/dialog";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";

import { Button } from "@/Components/ui/button";
import { CSS } from "@dnd-kit/utilities";
import { FormCheckbox } from "@/Components/ui/checkbox";
import { cn, isMetaAppendColumn } from "@/lib/utils";
import { useEffect, useState } from "react";
import { useLaravelReactI18n } from "laravel-react-i18n";

// Tipe yang secara STRUKTURAL tidak bisa dirender sebagai satu sel tabel
// flat (koleksi one-to-many, campuran bebas bentuk) — sama seperti Cell
// Table2 yang me-return kosong utk tipe ini. `relation` (singular) dan
// `attribute` TIDAK di sini lagi: relation didukung penuh oleh quickList
// (eager-load + permission-check), attribute hanya perlu disaring per-NAMA
// via isMetaAppendColumn (bukan blanket per-tipe — attribute juga dipakai
// accessor bisnis asli, bukan cuma metadata framework).
const NON_RENDERABLE_TYPES = ["relations", "mixed", "json"];

/**
 * Menyaring kolom teknis dengan aturan yang sama seperti FilterItem2/
 * DataTable2 (isMetaAppendColumn): metadata framework (canDelete, route,
 * thisModel, ...) dibuang BY NAME, bukan by-type — supaya accessor bisnis
 * asli (type `attribute` yang bukan metadata) tetap bisa dipilih. Kolom
 * yang ditandai `hidden`/`ignore` (configColumns per-model) juga dibuang.
 * @param column
 */
export function isSelectableColumn(column) {
  if (NON_RENDERABLE_TYPES.includes(column.type)) return false;
  if (isMetaAppendColumn(column)) return false;

  return !column.hidden && !column.ignore;
}

/**
 * Label kolom mengikuti pola yang sama dengan manajemen kolom Table2 /
 * FormTable: pakai `title` bila ada, kalau tidak terjemahkan `titleTrans`.
 * Sebelumnya Quick List menampilkan `name` mentah (mis. "lang_code"),
 * tidak konsisten dengan tabel lain di aplikasi.
 * @param column
 * @param t
 */
export function columnLabel(column, t) {
  return (
    column?.title ?? (column?.titleTrans ? t(column.titleTrans) : column?.name)
  );
}

function SelectedColumnRow({ column, label, onRemove }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: column.name,
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "flex items-center gap-1.5 rounded border px-2 py-1 text-sm",
        isDragging && "opacity-60",
      )}
    >
      <button
        type="button"
        className="inline-flex size-5 shrink-0 cursor-grab items-center justify-center rounded text-muted-foreground hover:bg-accent active:cursor-grabbing"
        {...attributes}
        {...listeners}
        aria-label="Ubah urutan kolom"
      >
        <GripVerticalIcon className="size-3.5" />
      </button>
      <span className="flex-1 truncate">{label}</span>
      <button
        type="button"
        onClick={onRemove}
        className="inline-flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
        aria-label="Hapus kolom"
      >
        <XIcon className="size-3.5" />
      </button>
    </div>
  );
}

/**
 * Memilih SEKALIGUS mengurutkan kolom yang ditampilkan — pola gabungan
 * dari ColumnsFilter (checklist tambah/buang) dan konfigurasi kolom
 * FormTable (daftar terpilih yang bisa di-drag).
 *
 * `value` adalah array nama kolom TERURUT; urutannya ikut menentukan
 * urutan kolom di tabel Quick List.
 * @param root0
 * @param root0.columns
 * @param root0.value
 * @param root0.onChange
 */
export default function ColumnOrderPicker({ columns, value, onChange }) {
  const { t } = useLaravelReactI18n();
  const [pickerOpen, setPickerOpen] = useState(false);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  const available = columns.filter(isSelectableColumn);
  const byName = new Map(available.map((c) => [c.name, c]));
  const selected = (value ?? []).filter((name) => byName.has(name));

  const handleDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return;
    const oldIndex = selected.indexOf(active.id);
    const newIndex = selected.indexOf(over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    onChange(arrayMove(selected, oldIndex, newIndex));
  };

  return (
    <div className="flex flex-col gap-2">
      {selected.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Belum ada kolom dipilih — pilih minimal satu kolom untuk ditampilkan.
        </p>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={selected}
            strategy={verticalListSortingStrategy}
          >
            <div className="flex flex-col gap-1">
              {selected.map((name) => (
                <SelectedColumnRow
                  key={name}
                  column={byName.get(name)}
                  label={columnLabel(byName.get(name), t)}
                  onRemove={() => onChange(selected.filter((n) => n !== name))}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-fit gap-1.5"
        onClick={() => setPickerOpen(true)}
      >
        <PlusIcon className="size-3.5" />
        {t("core.formtable.add_or_remove_columns")}
      </Button>

      <SelectColumnDialog
        columns={available}
        selected={selected}
        open={pickerOpen}
        setOpen={setPickerOpen}
        onApply={onChange}
      />
    </div>
  );
}

/**
 * Dialog tambah/buang kolom — pola visual dan i18n mengikuti
 * `SelectColumn` di FormTable.jsx (grid checkbox masonry, tombol Pilih
 * Semua + Terapkan). Perbedaannya, di sini hasilnya berupa DAFTAR NAMA
 * TERURUT (bukan flag `show` per kolom), karena urutan kolom Quick List
 * ditentukan oleh urutan array itu sendiri.
 * @param root0
 * @param root0.columns
 * @param root0.selected
 * @param root0.open
 * @param root0.setOpen
 * @param root0.onApply
 */
function SelectColumnDialog({ columns, selected, open, setOpen, onApply }) {
  const { t } = useLaravelReactI18n();
  const [draft, setDraft] = useState(selected);

  useEffect(() => {
    if (open) setDraft(selected);
  }, [open]);

  const toggle = (name, checked) =>
    setDraft((current) =>
      checked ? [...current, name] : current.filter((n) => n !== name),
    );

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
      }}
    >
      <DialogContent className="max-w-full md:max-w-[50%] min-w-64">
        <DialogHeader className="pb-2 border-b border-muted-foreground/25">
          <DialogTitle>{t("core.formtable.select_columns")}</DialogTitle>
          <DialogDescription className="sr-only"></DialogDescription>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          {t("core.formtable.select_columns.description")}
        </p>
        <div className="overflow-y-auto overflow-x-hidden max-h-[60vh] grid items-start grid-cols-[repeat(auto-fill,minmax(196px,1fr))] gap-x-4 gap-y-5">
          {columns.map((col) => (
            <FormCheckbox
              key={col.name}
              label={columnLabel(col, t)}
              checked={draft.includes(col.name)}
              onCheckedChange={(val) => toggle(col.name, val)}
              className="overflow-x-hidden [&_label]:truncate"
            />
          ))}
        </div>
        <DialogFooter className="pt-2 -mb-2 border-t border-muted-foreground/25">
          <Button
            type="button"
            variant="secondary"
            className="h-8"
            onClick={() => setDraft(columns.map((c) => c.name))}
          >
            {t("core.formtable.select_all")}
          </Button>
          <DialogClose asChild>
            <Button
              type="button"
              className="h-8"
              onClick={() => onApply(draft)}
            >
              {t("core.formtable.apply")}
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
