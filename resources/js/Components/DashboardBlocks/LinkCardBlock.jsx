import {
  PencilIcon,
  PlusIcon,
  SquareArrowOutUpRightIcon,
  XIcon,
} from "lucide-react";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useState } from "react";

import BlockDescriptionTooltip from "@/Components/DashboardBlocks/BlockDescriptionTooltip";
import BlockEditDialog from "@/Components/DashboardBlocks/BlockEditDialog";
import { Button } from "@/Components/ui/button";
import { CSS } from "@dnd-kit/utilities";
import GroupDropZone from "@/Components/GroupDropZone";
import IconPicker from "@/Components/IconPicker";
import { Input } from "@/Components/ui/input";
import LinkPicker from "@/Components/LinkPicker";
import TiptapEditor from "@/Components/TiptapEditor";
import { cn } from "@/lib/utils";
import { richTextValue } from "@/lib/richText";
import { resolveIcon } from "@/lib/deskIcons";
import { resolveShortcutHref } from "@/Components/DashboardBlocks/ShortcutBlock";
import { usePage } from "@inertiajs/react";

let localItemRefCounter = 0;
function makeLocalItemRef() {
  localItemRefCounter += 1;

  return `link-item-${localItemRefCounter}`;
}

// Feedback user: tampilan link_card_item disamakan persis ERPNext Link Card
// — teks biru + ikon panah eksternal kecil, TANPA border per-item (mode
// baca). Mode edit tetap perlu handle (drag-reorder) + tombol edit/hapus.
function LinkCardItemRow({ item, canEdit, onUpdate, onDelete, allMenuItems }) {
  const [open, setOpen] = useState(!!item.isNew);
  const config = item.config ?? {};
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: item.ref ?? item.id,
    disabled: !canEdit,
  });

  const style = {
    // scaleX/scaleY (transform SIZE) dinetralkan, translate (posisi) tetap
    // -- konsisten dengan DashboardCanvas.jsx (block ecosystem yang sama).
    transform: CSS.Transform.toString(
      transform ? { ...transform, scaleX: 1, scaleY: 1 } : transform,
    ),
    transition,
  };

  if (!canEdit) {
    const href = resolveShortcutHref(config, allMenuItems);
    const Tag = href ? "a" : "span";

    return (
      <Tag
        href={href ?? undefined}
        className={cn(
          "inline-flex w-fit items-center gap-1 text-primary",
          href && "cursor-pointer hover:underline",
        )}
      >
        {config.label || "Item"}
        <SquareArrowOutUpRightIcon className="size-3" />
      </Tag>
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center justify-between gap-2 rounded border px-2 py-1.5 text-sm",
        isDragging && "opacity-60",
      )}
    >
      <div className="flex min-w-0 items-center gap-1.5">
        <button
          type="button"
          className="inline-flex size-5 shrink-0 cursor-grab items-center justify-center rounded text-muted-foreground hover:bg-accent active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <svg viewBox="0 0 16 16" className="size-3" fill="currentColor">
            <circle cx="5" cy="3" r="1.3" />
            <circle cx="11" cy="3" r="1.3" />
            <circle cx="5" cy="8" r="1.3" />
            <circle cx="11" cy="8" r="1.3" />
            <circle cx="5" cy="13" r="1.3" />
            <circle cx="11" cy="13" r="1.3" />
          </svg>
        </button>
        <span className="truncate">{config.label || "Item baru"}</span>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-accent"
        >
          <PencilIcon className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="inline-flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
        >
          <XIcon className="size-3.5" />
        </button>
      </div>
      <BlockEditDialog
        title="Edit Item"
        block={item}
        canEdit={canEdit}
        open={open}
        onOpenChange={setOpen}
        isNew={item.isNew}
        onCancelNew={onDelete}
        validate={(draft) =>
          !draft.label?.trim() ? "Label wajib diisi." : null
        }
        onSave={(draft) => onUpdate({ ...item, config: draft, isNew: false })}
        renderForm={(draft, patchDraft) => (
          <>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">Label</label>
              <Input
                value={draft.label ?? ""}
                onChange={(e) => patchDraft({ label: e.target.value })}
                placeholder="Label"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">Link</label>
              <LinkPicker
                value={{ link_type: draft.link_type, link_to: draft.link_to }}
                onValueChange={(val) => patchDraft(val)}
              />
            </div>
          </>
        )}
      />
    </div>
  );
}

// Requirement 2.5, 2.6, 3.9-3.11 (direvisi): label + icon + description
// (tooltip on-hover di icon info sebelah label) dikonfigurasi via Dialog
// utama Link Card. Anak (link_card_item) dikelola lewat tombol "+ Tambah
// Item" — masing-masing punya Dialog sendiri (LinkCardItemRow di atas) —
// BUKAN lagi FormTable bulk-editor. Reorder ITEM pakai DndContext LOKAL
// (terpisah dari DashboardCanvas rekursif — link_card_item bukan
// root-level widget kanvas). Drag-to-nest dari LUAR (GroupDropZone) TETAP
// tersedia sbg cara alternatif menambah item.
export default function LinkCardBlock({
  block,
  canEdit,
  onUpdate,
  onDelete,
  isDragActive,
  activeDragType,
  editOpen,
  onEditOpenChange,
}) {
  const { allMenuItems = [] } = usePage().props;
  const config = block.config ?? {};
  const hasIcon = !!config.icon;
  const children = block.children ?? [];

  const itemIds = children.map((c) => c.ref ?? c.id);

  const updateChild = (updated) => {
    onUpdate({
      ...block,
      children: children.map((c) =>
        (c.ref ?? c.id) === (updated.ref ?? updated.id) ? updated : c,
      ),
    });
  };

  const deleteChild = (target) => {
    onUpdate({
      ...block,
      children: children.filter(
        (c) => (c.ref ?? c.id) !== (target.ref ?? target.id),
      ),
    });
  };

  const addChild = () => {
    onUpdate({
      ...block,
      children: [
        ...children,
        {
          ref: makeLocalItemRef(),
          type: "link_card_item",
          config: {},
          width: 12,
          isNew: true,
        },
      ],
    });
  };

  return (
    // h-full: kartu mengisi tinggi baris grid (SortableBlock sudah
    // meregangkan cell-nya) supaya sejajar dengan kartu di sebelahnya,
    // bukan setinggi jumlah item-nya sendiri.
    <div className="flex h-full flex-col rounded-lg border p-3">
      <div className="mb-2 flex items-center gap-2">
        {hasIcon && (
          <span className="flex size-6 items-center justify-center [&>svg]:size-4">
            {resolveIcon(config.icon)}
          </span>
        )}
        <span className="font-medium">{config.label || "Link Card"}</span>
        <BlockDescriptionTooltip description={config.description} />
      </div>

      {canEdit ? (
        // Feedback user: item harus bisa dipindah ANTAR Link Card. Karena
        // itu SortableContext di sini TIDAK lagi dibungkus DndContext
        // lokal — ia ikut DndContext milik DashboardCanvas (pola
        // multi-container dnd-kit), sehingga drag bisa menyeberang ke
        // drop-zone Link Card lain. Reorder & perpindahan ditangani
        // handleDragEnd di canvas.
        <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col gap-1.5">
            {children.map((child) => (
              <LinkCardItemRow
                key={child.ref ?? child.id}
                item={child}
                canEdit={canEdit}
                onUpdate={updateChild}
                onDelete={() => deleteChild(child)}
                allMenuItems={allMenuItems}
              />
            ))}
          </div>
        </SortableContext>
      ) : (
        <div className="flex flex-col items-start gap-1.5">
          {children.map((child) => (
            <LinkCardItemRow
              key={child.ref ?? child.id}
              item={child}
              canEdit={false}
              allMenuItems={allMenuItems}
            />
          ))}
        </div>
      )}

      {canEdit && (
        <>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-2 gap-1.5"
            onClick={addChild}
          >
            <PlusIcon className="size-3.5" />
            Tambah Item
          </Button>
          {/* Feedback user: zona ini hanya relevan untuk link_card_item.
              Sebelumnya ikut menyala saat block tipe lain diseret — drop-nya
              memang diabaikan, tapi kedipan visualnya mengganggu. */}
          <GroupDropZone
            dropZoneId={`link-card-footer:${block.ref ?? block.id}`}
            isActive={isDragActive && activeDragType === "link_card_item"}
          />
        </>
      )}

      {canEdit && (
        <BlockEditDialog
          title="Edit Link Card"
          block={block}
          canEdit={canEdit}
          open={editOpen}
          onOpenChange={onEditOpenChange}
          isNew={block.isNew}
          onCancelNew={onDelete}
          validate={(draft) =>
            !draft.label?.trim() ? "Judul grup wajib diisi." : null
          }
          onSave={(draft) =>
            onUpdate({ ...block, config: draft, isNew: false })
          }
          renderForm={(draft, patchDraft) => (
            <>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium">Judul Grup</label>
                <Input
                  value={draft.label ?? ""}
                  onChange={(e) => patchDraft({ label: e.target.value })}
                  placeholder="Judul grup"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium">Icon</label>
                <IconPicker
                  value={draft.icon}
                  onValueChange={(val) => patchDraft({ icon: val })}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium">
                  Deskripsi{" "}
                  <span className="text-muted-foreground">
                    (opsional, tampil sbg tooltip)
                  </span>
                </label>
                <TiptapEditor
                  value={richTextValue(draft.description)}
                  onValueChange={(json, html) =>
                    patchDraft({ description: { json, html } })
                  }
                />
              </div>
            </>
          )}
        />
      )}
    </div>
  );
}
