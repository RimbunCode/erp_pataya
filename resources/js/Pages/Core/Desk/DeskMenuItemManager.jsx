import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTriggerCustom,
} from "@/Components/ui/accordion";
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  Dialog,
  DialogContent,
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
import { ChevronRight } from "lucide-react";
import { FormCheckbox } from "@/Components/ui/checkbox";
import { GripVertical } from "lucide-react";
import IconPicker from "@/Components/IconPicker";
import { Input } from "@/Components/ui/input";
import { PlusIcon } from "lucide-react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { generateRandom } from "@/lib/utils";
import { resolveIcon } from "@/lib/deskIcons";
import { useMemo } from "react";
import { usePage } from "@inertiajs/react";
import { useState } from "react";

const TOP_CONTAINER = "top";
// group-footer:{parentRowId} adalah id sintetis (bukan rowId row manapun) —
// bedakan drop ke strip footer grup dari drop biasa ke row lain.
const GROUP_FOOTER_PREFIX = "group-footer:";

// Picker "Tambah Menu" — dialog Accordion per-Modul + checklist, pola visual
// diadopsi dari Library.jsx/FolderItem.jsx/FileItems.jsx (browse file per
// folder di UploadDialog). `scopeParentId` (opsional) membatasi picker cuma
// tampilkan MenuItem yg parent_id (global) = ID itu — dipakai picker "+
// Sub-menu" (flat, tanpa Accordion Modul lagi krn konteksnya sudah 1 Modul).
function DeskMenuItemPickerDialog({
  open,
  onOpenChange,
  excludeIds,
  scopeParentId = null,
  onConfirm,
}) {
  const { allMenuItems = [] } = usePage().props;
  const [search, setSearch] = useState("");
  const [checked, setChecked] = useState(new Set());

  const available = useMemo(
    () => allMenuItems.filter((item) => !excludeIds.has(item.id)),
    [allMenuItems, excludeIds],
  );

  const filtered = useMemo(() => {
    if (!search.trim()) return available;
    const term = search.trim().toLowerCase();
    return available.filter((item) => item.label.toLowerCase().includes(term));
  }, [available, search]);

  const groups = useMemo(() => {
    if (scopeParentId) {
      return [
        {
          modul: null,
          items: filtered.filter((item) => item.parent_id === scopeParentId),
        },
      ];
    }
    // "Modul" (folder Accordion) HARUS punya minimal 1 child di ANTARA
    // seluruh allMenuItems (bukan cuma yg tersisa setelah exclude/search) —
    // kalau tidak, item top-level tanpa anak (mis. Dashboard, Tickets, Logs)
    // ikut dianggap folder kosong alih-alih ditawarkan sbg checkbox langsung.
    const topLevel = filtered.filter(
      (item) =>
        !item.parent_id && allMenuItems.some((i) => i.parent_id === item.id),
    );
    const withoutModul = filtered.filter(
      (item) =>
        !topLevel.some((t) => t.id === item.id) &&
        (!item.parent_id || !topLevel.some((t) => t.id === item.parent_id)),
    );
    return [
      ...topLevel.map((modul) => ({
        modul,
        items: filtered.filter((item) => item.parent_id === modul.id),
      })),
      ...(withoutModul.length > 0
        ? [{ modul: null, items: withoutModul }]
        : []),
    ];
  }, [filtered, scopeParentId]);

  function toggle(id) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function toggleModul(_modulId, items) {
    setChecked((prev) => {
      const next = new Set(prev);
      const allChecked = items.every((item) => next.has(item.id));
      items.forEach((item) => {
        if (allChecked) {
          next.delete(item.id);
        } else {
          next.add(item.id);
        }
      });
      return next;
    });
  }

  function handleConfirm() {
    const selected = available.filter((item) => checked.has(item.id));
    onConfirm(selected);
    setChecked(new Set());
    setSearch("");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent forceAsDialog className="max-w-lg overflow-hidden!">
        <DialogHeader className="pb-2 border-b">
          <DialogTitle>Tambah Menu</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-2 max-h-96 overflow-y-auto">
          <Input
            placeholder="Cari menu ..."
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {scopeParentId ? (
            <div className="flex flex-col">
              {groups[0].items.length === 0 && (
                <p className="py-2 text-sm text-muted-foreground">
                  Tidak ada menu tersedia.
                </p>
              )}
              {groups[0].items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center border-b last:border-b-0"
                >
                  <FormCheckbox
                    checked={checked.has(item.id)}
                    onCheckedChange={() => toggle(item.id)}
                    classNameLabel="flex items-center gap-x-2 overflow-hidden text-sm font-normal cursor-pointer py-2"
                  >
                    {item.label}
                  </FormCheckbox>
                </div>
              ))}
            </div>
          ) : (
            <Accordion type="multiple" className="w-full">
              {groups.map(({ modul, items }, index) =>
                modul ? (
                  <AccordionItem
                    key={modul.id}
                    value={modul.id}
                    className="border-b last:border-b-0"
                  >
                    <div className="flex items-center gap-1">
                      {items.length > 0 && (
                        <FormCheckbox
                          checked={
                            items.every((item) => checked.has(item.id))
                              ? true
                              : items.some((item) => checked.has(item.id))
                                ? "indeterminate"
                                : false
                          }
                          onCheckedChange={() => toggleModul(modul.id, items)}
                        />
                      )}
                      <AccordionTriggerCustom className="group flex-1 gap-x-2 cursor-pointer py-2! text-sm [&_svg]:size-4 data-[state=open]:border-b">
                        <ChevronRight className="shrink-0 transition-transform duration-200 group-data-[state=open]:rotate-90" />
                        {resolveIcon(modul.icon)}
                        {modul.label}
                      </AccordionTriggerCustom>
                    </div>
                    <AccordionContent className="pl-8 pb-0!">
                      {items.length === 0 ? (
                        <p className="py-2 text-sm text-muted-foreground">
                          Tidak ada menu tersedia.
                        </p>
                      ) : (
                        items.map((item) => (
                          <div
                            key={item.id}
                            className="flex items-center border-b last:border-b-0"
                          >
                            <FormCheckbox
                              checked={checked.has(item.id)}
                              onCheckedChange={() => toggle(item.id)}
                              classNameLabel="flex items-center gap-x-2 overflow-hidden text-sm font-normal cursor-pointer py-2"
                            >
                              {item.label}
                            </FormCheckbox>
                          </div>
                        ))
                      )}
                    </AccordionContent>
                  </AccordionItem>
                ) : (
                  <div key={`no-modul-${index}`} className="flex flex-col">
                    {items.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center border-b last:border-b-0"
                      >
                        <FormCheckbox
                          checked={checked.has(item.id)}
                          onCheckedChange={() => toggle(item.id)}
                          classNameLabel="flex items-center gap-x-2 overflow-hidden [&_svg]:size-5 text-sm font-normal cursor-pointer py-2"
                        >
                          <span className="flex items-center gap-x-2 overflow-hidden">
                            {resolveIcon(item.icon)}
                            <span className="truncate">{item.label}</span>
                          </span>
                        </FormCheckbox>
                      </div>
                    ))}
                  </div>
                ),
              )}
            </Accordion>
          )}
        </div>
        <DialogFooter className="pt-2 border-t">
          <Button
            type="button"
            disabled={checked.size === 0}
            size="sm"
            onClick={handleConfirm}
          >
            Tambah ({checked.size})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Row generik dipakai utk PARENT maupun CHILD — `depth` (0=parent, 1=child)
// murni styling (indent, ukuran). Icon HANYA configurable di level parent —
// child selalu pakai icon MenuItem aslinya, tidak ada override per-child.
function DeskMenuItemRow({
  row,
  depth = 0,
  disabled,
  isOverlay = false,
  onRemove,
  onIconChange,
  onLabelChange,
  onAddChild,
  hasChildren,
  collapsibleOpen,
  onToggleCollapsible,
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: row.rowId, disabled: disabled || isOverlay });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0 : 1,
  };
  const isVirtualGroup = !row.menu_item_id;

  return (
    <div
      ref={isOverlay ? undefined : setNodeRef}
      style={isOverlay ? undefined : style}
      className={cn(
        "flex items-center gap-2 p-2",
        depth === 1 && !isOverlay && "rounded-md border bg-muted/30",
        isOverlay && "rounded-lg border bg-background shadow-lg",
      )}
    >
      {!disabled && (
        <button
          type="button"
          {...(isOverlay ? {} : attributes)}
          {...(isOverlay ? {} : listeners)}
          className="cursor-grab rounded p-1 text-muted-foreground hover:bg-muted active:cursor-grabbing"
          aria-label="Urutkan menu"
        >
          <GripVertical className="size-4" />
        </button>
      )}
      {depth === 0 &&
        (hasChildren ? (
          <button
            type="button"
            onClick={onToggleCollapsible}
            className="p-1 rounded hover:bg-muted"
            aria-label="Buka/tutup sub-menu"
          >
            <ChevronRight
              className={cn(
                "size-4 transition-transform duration-200",
                collapsibleOpen && "rotate-90",
              )}
            />
          </button>
        ) : (
          <span className="size-6" />
        ))}
      {depth === 0 && (
        <IconPicker
          variant="button"
          value={row.icon ?? row.__menuItemIcon}
          onValueChange={onIconChange}
          disabled={disabled}
        />
      )}
      {isVirtualGroup && !disabled ? (
        <Input
          value={row.label ?? ""}
          onChange={(e) => onLabelChange(e.target.value)}
          placeholder="Label grup"
          className="h-7 text-sm flex-1"
        />
      ) : (
        <span className="flex-1 text-sm font-medium truncate">{row.label}</span>
      )}
      {!disabled && depth === 0 && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7"
          onClick={onAddChild}
          aria-label="Tambah sub-menu"
        >
          <PlusIcon className="size-4" />
        </Button>
      )}
      {!disabled && (
        <button
          type="button"
          onClick={onRemove}
          className="rounded p-1 text-muted-foreground hover:bg-muted"
          aria-label="Hapus menu"
        >
          <X className="size-4" />
        </button>
      )}
    </div>
  );
}

// Strip full-width di bawah children grup virtual — target drop EKSPLISIT
// (bukan hit-test posisi tengah card yg sempit/susah dijangkau) utk "masukkan
// row ini ke grup, di posisi terakhir". Hanya grup virtual yg py strip ini —
// MenuItem asli tidak pernah bisa jadi wadah nesting (lihat handleDragEnd).
function GroupDropZone({ parentRowId, disabled, isActive }) {
  const { setNodeRef, isOver } = useDroppable({
    id: `group-footer:${parentRowId}`,
    disabled,
  });

  if (disabled) return null;

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "mx-2 mb-2 rounded border border-dashed p-1.5 text-center text-xs text-muted-foreground transition-colors",
        isOver
          ? "border-primary bg-primary/10 text-primary"
          : "border-border/60",
        !isActive && "opacity-0",
      )}
    >
      Lepas di sini untuk masuk grup
    </div>
  );
}

function DroppableContainer({ id, children }) {
  const { setNodeRef } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className="space-y-2">
      {children}
    </div>
  );
}

// Resolve label/icon dari MenuItem asli (allMenuItems) untuk row yg baru
// ditambah dari picker — payload picker cuma {id,label,icon,parent_id}.
function toRow(menuItem) {
  return {
    rowId: generateRandom(10),
    menu_item_id: menuItem.id,
    label: menuItem.label,
    icon: null,
    __menuItemIcon: menuItem.icon,
    children: [],
  };
}

// Data dari server (show()) tidak punya rowId (client-only key stabil utk
// drag) — normalize sekali saat masuk. Row yg sudah py rowId (hasil edit FE
// sendiri) dipertahankan apa adanya supaya identity drag tidak reset tiap
// re-render.
function withRowIds(rows) {
  return rows.map((row) => ({
    ...row,
    rowId: row.rowId ?? row.id ?? generateRandom(10),
    children: (row.children ?? []).map((child) => ({
      ...child,
      rowId: child.rowId ?? child.id ?? generateRandom(10),
    })),
  }));
}

// Ratakan struktur nested (parent+children) jadi SATU list linear utk
// SortableContext — setiap entri simpan __parentRowId (null = top-level)
// supaya drag bisa pindah antar-grup (child A pindah jadi child grup B)
// dgn cara yg sama persis spt reorder biasa: SEMUA row (parent maupun
// child) adalah anggota SortableContext yg sama, cuma beda posisi linear.
function flattenRows(rows) {
  const flat = [];
  rows.forEach((row) => {
    flat.push({ ...row, __parentRowId: null });
    (row.children ?? []).forEach((child) => {
      flat.push({ ...child, __parentRowId: row.rowId });
    });
  });
  return flat;
}

// Kebalikan flattenRows — susun ulang nested rows dari urutan LINEAR flat
// (urutan array flat menentukan urutan tampil DAN urutan dalam grup masing2).
function unflattenRows(flat) {
  const parents = flat.filter((r) => !r.__parentRowId);
  return parents.map((parent) => ({
    ...parent,
    __parentRowId: undefined,
    children: flat
      .filter((r) => r.__parentRowId === parent.rowId)
      .map((child) => ({ ...child, __parentRowId: undefined })),
  }));
}

export default function DeskMenuItemManager({ value, onChange, disabled }) {
  const { allMenuItems = [] } = usePage().props;
  const rows = useMemo(() => withRowIds(value ?? []), [value]);
  const flatRows = useMemo(() => flattenRows(rows), [rows]);
  const [activeId, setActiveId] = useState(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [subMenuTargetRowId, setSubMenuTargetRowId] = useState(null);
  const [collapsedIds, setCollapsedIds] = useState(new Set());

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 10 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 250, tolerance: 5 },
    }),
  );

  const visibleFlatRows = useMemo(
    () =>
      flatRows.filter(
        (r) => !r.__parentRowId || !collapsedIds.has(r.__parentRowId),
      ),
    [flatRows, collapsedIds],
  );
  const visibleRowIds = useMemo(
    () => visibleFlatRows.map((r) => r.rowId),
    [visibleFlatRows],
  );
  const childrenCountByParent = useMemo(() => {
    const counts = new Map();
    flatRows.forEach((r) => {
      if (r.__parentRowId) {
        counts.set(r.__parentRowId, (counts.get(r.__parentRowId) ?? 0) + 1);
      }
    });
    return counts;
  }, [flatRows]);

  const selectedIds = useMemo(() => {
    const ids = new Set();
    flatRows.forEach((row) => {
      if (row.menu_item_id) ids.add(row.menu_item_id);
    });
    return ids;
  }, [flatRows]);

  const activeRow = useMemo(
    () => flatRows.find((r) => r.rowId === activeId) ?? null,
    [flatRows, activeId],
  );

  function commitFlat(nextFlat) {
    onChange(unflattenRows(nextFlat));
  }

  function updateFlat(updater) {
    commitFlat(updater(flatRows));
  }

  function removeRow(rowId) {
    updateFlat((items) =>
      items.filter((r) => r.rowId !== rowId && r.__parentRowId !== rowId),
    );
  }

  function updateRow(rowId, patch) {
    updateFlat((items) =>
      items.map((r) => (r.rowId === rowId ? { ...r, ...patch } : r)),
    );
  }

  function addVirtualGroup() {
    updateFlat((items) => [
      ...items,
      {
        rowId: generateRandom(10),
        menu_item_id: null,
        label: "",
        icon: null,
        __parentRowId: null,
      },
    ]);
  }

  // Item hasil pilihan picker "Tambah Menu" SELALU dibungkus grup virtual
  // ber-label Modul asalnya (parent_id GLOBAL milik MenuItem itu), bahkan
  // kalau cuma 1 item yg dipilih dari Modul itu — pengguna diminta struktur
  // per-Modul selalu terlihat, bukan flat. Kalau grup virtual utk Modul yg
  // SAMA sudah ada di list (ditandai __sourceModulId, BUKAN cocokkan label
  // text — grup custom manual yg kebetulan sama nama TIDAK ikut ke-merge),
  // child baru di-APPEND ke situ, bukan bikin grup baru (mencegah duplikat
  // parent). Item yg TIDAK py Modul asal (top-level murni, mis. Dashboard)
  // tetap masuk sbg row flat biasa — tidak ada dasar utk dijadikan parent.
  function addFromPicker(menuItems) {
    updateFlat((items) => {
      let next = [...items];

      const withModul = menuItems.filter((m) => m.parent_id);
      const withoutModul = menuItems.filter((m) => !m.parent_id);

      next = [
        ...next,
        ...withoutModul.map((m) => ({ ...toRow(m), __parentRowId: null })),
      ];

      const byModulId = new Map();
      withModul.forEach((m) => {
        if (!byModulId.has(m.parent_id)) byModulId.set(m.parent_id, []);
        byModulId.get(m.parent_id).push(m);
      });

      byModulId.forEach((menuItemsInModul, modulId) => {
        const modul = allMenuItems.find((i) => i.id === modulId);
        let parentRowId = next.find(
          (r) => !r.menu_item_id && r.__sourceModulId === modulId,
        )?.rowId;

        if (!parentRowId) {
          parentRowId = generateRandom(10);
          next.push({
            rowId: parentRowId,
            menu_item_id: null,
            label: modul?.label ?? "",
            icon: modul?.icon ?? null,
            __sourceModulId: modulId,
            __parentRowId: null,
          });
        }

        next.push(
          ...menuItemsInModul.map((m) => ({
            ...toRow(m),
            __parentRowId: parentRowId,
          })),
        );
      });

      return next;
    });
  }

  function addChildrenFromPicker(rowId, menuItems) {
    updateFlat((items) => [
      ...items,
      ...menuItems.map((m) => ({
        rowId: generateRandom(10),
        menu_item_id: m.id,
        label: m.label,
        icon: null,
        __menuItemIcon: m.icon,
        __parentRowId: rowId,
      })),
    ]);
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      next.delete(rowId);
      return next;
    });
  }

  function toggleCollapsed(rowId) {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(rowId)) {
        next.delete(rowId);
      } else {
        next.add(rowId);
      }
      return next;
    });
  }

  function handleDragStart(event) {
    setActiveId(event.active.id);
  }

  function handleDragEnd(event) {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const draggedRow = flatRows.find((r) => r.rowId === active.id);
    if (!draggedRow) return;

    // Row ber-children (parent dgn sub-menu) TIDAK BOLEH jadi child row lain
    // — batasan 1 level. MenuItem ASLI (py menu_item_id, py route/model)
    // TIDAK PERNAH boleh jadi wadah nesting — HANYA grup virtual (custom,
    // tanpa menu_item_id) yg boleh menampung children.
    const draggedHasChildren = childrenCountByParent.has(draggedRow.rowId);

    // Drop di strip footer grup — target EKSPLISIT, selalu masuk grup itu
    // di posisi PALING AKHIR (append), terlepas posisi drag persis di mana.
    if (String(over.id).startsWith(GROUP_FOOTER_PREFIX)) {
      const targetParentRowId = String(over.id).slice(
        GROUP_FOOTER_PREFIX.length,
      );
      if (draggedHasChildren || targetParentRowId === draggedRow.rowId) {
        return;
      }

      updateFlat((items) => {
        const withoutDragged = items.filter(
          (r) => r.rowId !== draggedRow.rowId,
        );
        const lastChildIndex = withoutDragged.reduce(
          (acc, r, idx) => (r.__parentRowId === targetParentRowId ? idx : acc),
          withoutDragged.findIndex((r) => r.rowId === targetParentRowId),
        );
        const nextDragged = {
          ...draggedRow,
          __parentRowId: targetParentRowId,
        };
        return [
          ...withoutDragged.slice(0, lastChildIndex + 1),
          nextDragged,
          ...withoutDragged.slice(lastChildIndex + 1),
        ];
      });
      return;
    }

    if (active.id === over.id) return;
    const targetRow = flatRows.find((r) => r.rowId === over.id);
    if (!targetRow) return;

    // Drop di SEPERTIGA TENGAH tinggi card target = niat nesting (draggedRow
    // jadi child GRUP target). Target GRUP-nya SENDIRI harus grup virtual
    // (menu_item_id null) — drop di atas MenuItem asli TIDAK PERNAH nest,
    // selalu jatuh ke reorder biasa di bawah. Grup target = target sendiri
    // kalau target top-level, atau target.__parentRowId kalau target sudah
    // child (child bisa "pindah grouping" dgn drop di tengah child lain).
    const targetGroupId = targetRow.__parentRowId ?? targetRow.rowId;
    const targetGroupRow = flatRows.find((r) => r.rowId === targetGroupId);
    const targetGroupIsVirtual = targetGroupRow && !targetGroupRow.menu_item_id;

    const draggedRect = active.rect.current.translated;
    const targetRect = over.rect;
    const isNestZone =
      targetGroupIsVirtual &&
      draggedRect &&
      targetRect &&
      draggedRect.top + draggedRect.height / 2 >
        targetRect.top + targetRect.height * 0.3 &&
      draggedRect.top + draggedRect.height / 2 <
        targetRect.top + targetRect.height * 0.7;

    if (isNestZone && !draggedHasChildren) {
      if (targetGroupId === draggedRow.rowId) return;

      updateFlat((items) => {
        const withoutDragged = items.filter(
          (r) => r.rowId !== draggedRow.rowId,
        );
        const insertAt = withoutDragged.findIndex(
          (r) => r.rowId === targetRow.rowId,
        );
        const nextDragged = { ...draggedRow, __parentRowId: targetGroupId };
        return [
          ...withoutDragged.slice(0, insertAt + 1),
          nextDragged,
          ...withoutDragged.slice(insertAt + 1),
        ];
      });
      return;
    }

    updateFlat((items) => {
      const oldIndex = items.findIndex((r) => r.rowId === active.id);
      const newIndex = items.findIndex((r) => r.rowId === over.id);
      if (oldIndex === -1 || newIndex === -1) return items;

      // Reorder linear TIDAK mengubah grouping — draggedRow ikut menyerap
      // __parentRowId milik posisi barunya (row yg sekarang ada tepat
      // SEBELUM dia), supaya geser child A dari grup X ke celah dalam grup Y
      // ikut memindahkan groupingnya (bukan cuma posisi visual).
      const moved = arrayMove(items, oldIndex, newIndex);
      const movedIndex = moved.findIndex((r) => r.rowId === active.id);
      if (draggedHasChildren) {
        // Parent ber-children hanya boleh reorder di level top (posisi
        // sesudah target top-level terdekat), tidak pernah ikut masuk
        // __parentRowId siapa pun.
        moved[movedIndex] = { ...moved[movedIndex], __parentRowId: null };
        return moved;
      }
      const prevSibling = moved[movedIndex - 1];
      const nextParentRowId =
        prevSibling &&
        (prevSibling.__parentRowId ?? prevSibling.rowId) ===
          (targetRow.__parentRowId ?? targetRow.rowId)
          ? (targetRow.__parentRowId ?? null)
          : (targetRow.__parentRowId ?? null);
      moved[movedIndex] = {
        ...moved[movedIndex],
        __parentRowId: nextParentRowId,
      };
      return moved;
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={() => setPickerOpen(true)}
        >
          <PlusIcon className="size-4" /> Tambah Menu
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={addVirtualGroup}
        >
          <PlusIcon className="size-4" /> Grup Custom
        </Button>
      </div>

      {flatRows.length === 0 ? (
        <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
          Belum ada menu dipilih.
        </p>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={visibleRowIds}
            strategy={verticalListSortingStrategy}
          >
            <DroppableContainer id={TOP_CONTAINER}>
              {visibleFlatRows
                .filter((row) => !row.__parentRowId)
                .map((parentRow) => {
                  const isVirtualGroup = !parentRow.menu_item_id;
                  const children = visibleFlatRows.filter(
                    (r) => r.__parentRowId === parentRow.rowId,
                  );
                  return (
                    <div
                      key={parentRow.rowId}
                      className="rounded-lg border bg-background"
                    >
                      <DeskMenuItemRow
                        row={parentRow}
                        depth={0}
                        disabled={disabled}
                        hasChildren={children.length > 0}
                        collapsibleOpen={!collapsedIds.has(parentRow.rowId)}
                        onToggleCollapsible={() =>
                          toggleCollapsed(parentRow.rowId)
                        }
                        onRemove={() => removeRow(parentRow.rowId)}
                        onIconChange={(val) =>
                          updateRow(parentRow.rowId, { icon: val })
                        }
                        onLabelChange={(val) =>
                          updateRow(parentRow.rowId, { label: val })
                        }
                        onAddChild={() =>
                          setSubMenuTargetRowId(parentRow.rowId)
                        }
                      />
                      {!collapsedIds.has(parentRow.rowId) &&
                        children.length > 0 && (
                          <div className="ml-8 mr-2 mb-2 space-y-1 border-l pl-3">
                            {children.map((child) => (
                              <DeskMenuItemRow
                                key={child.rowId}
                                row={child}
                                depth={1}
                                disabled={disabled}
                                onRemove={() => removeRow(child.rowId)}
                              />
                            ))}
                          </div>
                        )}
                      {isVirtualGroup && (
                        <GroupDropZone
                          parentRowId={parentRow.rowId}
                          disabled={disabled}
                          isActive={
                            activeId !== null && activeId !== parentRow.rowId
                          }
                        />
                      )}
                    </div>
                  );
                })}
            </DroppableContainer>
          </SortableContext>

          <DragOverlay>
            {activeRow && (
              <DeskMenuItemRow
                row={activeRow}
                depth={activeRow.__parentRowId ? 1 : 0}
                disabled={disabled}
                hasChildren={childrenCountByParent.has(activeRow.rowId)}
                isOverlay
              />
            )}
          </DragOverlay>
        </DndContext>
      )}

      <DeskMenuItemPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        excludeIds={selectedIds}
        onConfirm={addFromPicker}
      />
      <DeskMenuItemPickerDialog
        open={!!subMenuTargetRowId}
        onOpenChange={(open) => !open && setSubMenuTargetRowId(null)}
        excludeIds={selectedIds}
        scopeParentId={
          subMenuTargetRowId
            ? flatRows.find((r) => r.rowId === subMenuTargetRowId)?.menu_item_id
            : null
        }
        onConfirm={(menuItems) => {
          if (subMenuTargetRowId) {
            addChildrenFromPicker(subMenuTargetRowId, menuItems);
          }
        }}
      />
    </div>
  );
}
