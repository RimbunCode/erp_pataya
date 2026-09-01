import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import {
  BoxIcon,
  ChevronsLeftRightIcon,
  ChevronsRightLeftIcon,
  CopyIcon,
  CreditCardIcon,
  EllipsisIcon,
  GripVerticalIcon,
  LayoutIcon,
  LinkIcon,
  ListIcon,
  LogOutIcon,
  MinusIcon,
  MoveDownIcon,
  MoveUpIcon,
  PencilIcon,
  PlusIcon,
  SquareStackIcon,
  TypeIcon,
  XIcon,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/Components/ui/dropdown-menu";
import { useCallback, useMemo, useState } from "react";

import { CSS } from "@dnd-kit/utilities";
import DashboardBlock from "@/Components/DashboardBlock";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/Components/ui/popover";
import { cn } from "@/lib/utils";

// Feedback user: grid dipikirkan dalam satuan "slot" 3-kolom (12/3 = 4
// slot per baris) — resize (drag maupun shrink/expand tombol) SELALU
// snap ke kelipatan ini, supaya tata letak tidak berantakan (lebar block
// campur-aduk 1,2,5,7 kolom yang susah align visual).
// Feedback user (revisi): shrink/expand kembali ke kelipatan 1 kolom —
// tapi lebar TERKECIL dikunci di 3 kolom untuk SEMUA tipe block, supaya
// tidak ada block sesempit 1-2 kolom yang isinya tidak terbaca.
const GRID_STEP = 1;
const MIN_WIDTH = 3;
const MAX_WIDTH = 12;

// Feedback user: Shortcut boleh sekecil 1 kolom (isinya cuma ikon +
// label pendek, tetap terbaca) — tipe lain tetap minimal 3 kolom supaya
// kontennya tidak terpotong.
const MIN_WIDTH_BY_TYPE = {
  shortcut: 1,
};

function minWidthFor(type) {
  return MIN_WIDTH_BY_TYPE[type] ?? MIN_WIDTH;
}

/**
 * Menerjemahkan lebar block (satuan grid 12-kolom, nilai yang disimpan)
 * ke span pada breakpoint yang kolomnya lebih sedikit.
 *
 * Desktop memakai lebar apa adanya. Untuk tablet (6) & mobile (3),
 * yang dihitung adalah BERAPA BLOCK MUAT PER BARIS, lalu kolom dibagi
 * rata sebanyak itu — bukan memotong lebar begitu saja:
 *
 *   perBaris = bulat(kolom / lebar)      // pembulatan matematika
 *   span     = kolom / perBaris
 *
 * Contoh tablet (6 kolom):
 *   lebar 4 -> 6/4 = 1.5 -> 2 per baris -> span 6/2 = 3
 *   lebar 5 -> 6/5 = 1.2 -> 1 per baris -> span 6/1 = 6
 *
 * Bila kolom tidak habis dibagi perBaris, hasilnya bukan bilangan bulat
 * (mis. mobile 3 kolom dengan lebar 2 -> 1.5). Kasus itu diturunkan ke
 * 1 block per baris alias full-width — sesuai aturan "mobile: lebar 2
 * dipaksa jadi 3".
 * @param width
 * @param totalColumns
 */
function spanFor(width, totalColumns) {
  const base = Math.min(MAX_WIDTH, Math.max(1, width ?? MAX_WIDTH));

  if (totalColumns >= MAX_WIDTH) return base;

  let perRow = Math.max(1, Math.round(totalColumns / base));
  if (totalColumns % perRow !== 0) perRow = 1;

  return totalColumns / perRow;
}

// Feedback user: Shortcut default 3 kolom (ala ikon Desk grid /desks) —
// tipe lain tetap full-width (12) sbg default paling aman (chart/card/
// text/quick_list biasanya butuh ruang lebih luas).
const DEFAULT_WIDTH_BY_TYPE = {
  shortcut: MIN_WIDTH,
};

// Requirement 1: sinkron dgn App\Models\DashboardWidget::VALID_PARENTS —
// dipertahankan manual di FE (bukan fetch dari BE) krn daftar TIPE block
// statis, konsisten pola konstanta FE lain di codebase (mis. status enum).
// Feedback user: Chart/Card (Number Card) SEBELUMNYA tidak punya cara
// insert dari UI sama sekali (availableAtRoot:false, difilter keluar
// picker). Sekarang tersedia spt tipe lain — Dialog insert-nya (via
// ChartCardBlock) minta pilih Widget existing (WidgetLinkModel, sudah
// dukung create-inline juga), bukan query-builder baru di sini.
const BLOCK_TYPES = [
  {
    type: "section",
    label: "Section",
    icon: SquareStackIcon,
    availableAtRoot: true,
  },
  { type: "text", label: "Text", icon: TypeIcon, availableAtRoot: true },
  { type: "spacer", label: "Spacer", icon: MinusIcon, availableAtRoot: true },
  { type: "shortcut", label: "Shortcut", icon: BoxIcon, availableAtRoot: true },
  {
    type: "link_card",
    label: "Link Card",
    icon: LinkIcon,
    availableAtRoot: true,
  },
  {
    type: "quick_list",
    label: "Quick List",
    icon: ListIcon,
    availableAtRoot: true,
  },
  { type: "chart", label: "Chart", icon: LayoutIcon, availableAtRoot: true },
  {
    type: "card",
    label: "Number Card",
    icon: CreditCardIcon,
    availableAtRoot: true,
  },
];

let localRefCounter = 0;
function makeLocalRef() {
  localRefCounter += 1;

  return `local-${localRefCounter}`;
}

function defaultConfigFor(type) {
  switch (type) {
    case "section":
      // json: null (BUKAN {}) — TipTapEditor initialize `content: value ?? ""`,
      // objek kosong {} bukan valid ProseMirror doc schema (butuh minimal
      // {type:"doc",content:[...]}) dan bikin getHTML() gagal serialize
      // walau getJSON() tetap tampak berisi (bug nyata ditemukan saat
      // verifikasi visual — root cause "label section tidak persist").
      return { label: { json: null, html: "" }, icon: null, description: null };
    case "text":
      return { json: null, html: "" };
    case "shortcut":
      return {
        icon: null,
        link_type: "menu_item",
        link_to: "",
        background_color: null,
        foreground_color: null,
        stats_filter: null,
      };
    case "link_card":
      // description: {json, html} (TiptapEditor) — null saat kosong, sama
      // seperti description Section. Data lama masih bisa berupa string;
      // BlockDescriptionTooltip merender kedua bentuk.
      return { label: "", icon: null, description: null };
    case "quick_list":
      return {
        label: "",
        icon: null,
        description: null,
        model_id: null,
        model_class: null,
        filters: null,
        sort_by: null,
        sort_direction: "desc",
        limit: 5,
      };
    case "spacer":
      return {
        variant: "spacer",
        size: "md",
        lineStyle: "solid",
        position: "center",
      };
    default:
      return null;
  }
}

function BlockTypeOptions({ depth, onSelect }) {
  // section HANYA boleh root (VALID_PARENTS['section']=[]) — semua tipe
  // lain (termasuk chart/card SEKARANG) boleh di root ATAU di dalam
  // section (VALID_PARENTS mengizinkan [null,'section']).
  const options = BLOCK_TYPES.filter(
    (b) => depth === 0 || b.type !== "section",
  );

  return (
    <div className="grid w-56 grid-cols-2 gap-1 p-2">
      {options.map((opt) => (
        <button
          key={opt.type}
          type="button"
          onClick={() => onSelect(opt.type)}
          className="flex flex-col items-center gap-1 rounded-md p-2 text-xs hover:bg-accent"
        >
          <opt.icon className="size-4" />
          {opt.label}
        </button>
      ))}
    </div>
  );
}

/**
 * Tombol sisip block — dirender sebagai OVERLAY ABSOLUT di tepi block
 * (kiri/kanan), BUKAN sebagai grid item tersendiri.
 *
 * Bug yang diperbaiki: sebelumnya tombol ini grid item di grid 12-kolom.
 * Tanpa col-span dia dapat span 1 (menyisakan "ruang kosong" di samping
 * block 3-kolom); dengan col-span-full dia memaksa baris baru sehingga
 * dua block 3-kolom tidak pernah bisa bersebelahan di mode edit. Overlay
 * absolut menghilangkan kedua efek samping itu — tombol tidak lagi ikut
 * mempengaruhi alur grid sama sekali.
 * @param root0
 * @param root0.onInsert
 * @param root0.depth
 * @param root0.side
 */
function InsertBlockButton({ onInsert, depth, side = "right" }) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={
            side === "left"
              ? "Sisipkan block sebelum"
              : "Sisipkan block sesudah"
          }
          className={cn(
            "absolute top-1/2 z-10 hidden size-5 -translate-y-1/2 items-center justify-center rounded-full bg-primary text-primary-foreground shadow group-hover/block:flex",
            side === "left" ? "-left-2.5" : "-right-2.5",
            open && "flex",
          )}
        >
          <PlusIcon className="size-3" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="p-0">
        <BlockTypeOptions
          depth={depth}
          onSelect={(type) => {
            onInsert(type);
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

function EmptyStateInsertButton({ onInsert, depth }) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"
        >
          <PlusIcon className="size-4" />
          Tambah block pertama
        </button>
      </PopoverTrigger>
      <PopoverContent className="p-0">
        <BlockTypeOptions
          depth={depth}
          onSelect={(type) => {
            onInsert(type);
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

function ResizeHandle({ width, minWidth = MIN_WIDTH, onResize }) {
  const handlePointerDown = (e) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = width;
    const gridEl = e.currentTarget.closest("[data-dashboard-grid]");
    const colWidthPx = gridEl ? gridEl.clientWidth / 12 : 60;

    const onMove = (moveEvent) => {
      const delta = moveEvent.clientX - startX;
      // Drag resize memakai aturan grid yang sama dgn tombol shrink/expand
      // — kelipatan 1 kolom, dibatasi MIN_WIDTH..MAX_WIDTH.
      const deltaSteps = Math.round(delta / (colWidthPx * GRID_STEP));
      const nextWidth = Math.min(
        MAX_WIDTH,
        Math.max(minWidth, startWidth + deltaSteps * GRID_STEP),
      );
      onResize(nextWidth);
    };
    const onUp = () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
    };
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
  };

  return (
    <div
      onPointerDown={handlePointerDown}
      className="absolute right-0 top-0 hidden h-full w-2 cursor-col-resize md:flex"
    />
  );
}

// Feedback user: dropdown "..." per-block setara ERPNext (Move Up/Down,
// Shrink/Expand, Duplicate) — di luar drag-reorder yang sudah ada, sebagai
// cara presisi tanpa perlu drag utk operasi yang sama.
function BlockActionsMenu({
  canMoveUp,
  canMoveDown,
  width,
  minWidth = MIN_WIDTH,
  onMoveUp,
  onMoveDown,
  onShrink,
  onExpand,
  onDuplicate,
  onEject,
  hideResize,
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="inline-flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-accent"
        >
          <EllipsisIcon className="size-3.5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        {!hideResize && (
          <>
            <DropdownMenuItem onClick={onExpand} disabled={width >= MAX_WIDTH}>
              <ChevronsLeftRightIcon className="size-3.5" />
              Expand
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onShrink} disabled={width <= minWidth}>
              <ChevronsRightLeftIcon className="size-3.5" />
              Shrink
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuItem onClick={onMoveUp} disabled={!canMoveUp}>
          <MoveUpIcon className="size-3.5" />
          Move Up
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onMoveDown} disabled={!canMoveDown}>
          <MoveDownIcon className="size-3.5" />
          Move Down
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onDuplicate}>
          <CopyIcon className="size-3.5" />
          Duplicate
        </DropdownMenuItem>
        {/* Feedback user: block yang sudah masuk Section sebelumnya
            TERJEBAK di dalamnya — drag lintas DndContext (section punya
            konteks sendiri) tidak mungkin. Aksi eksplisit ini memindahkan
            block kembali ke level teratas kanvas. */}
        {onEject && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onEject}>
              <LogOutIcon className="size-3.5" />
              Keluarkan dari Section
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// Tipe block yang punya form config lewat BlockEditDialog — dipakai
// SortableBlock utk memutuskan apakah tombol Edit toolbar perlu dirender
// sama sekali (Text TIDAK — migrasi ke Dialog juga per feedback terbaru,
// lihat TextBlock.jsx; link_card_item pakai mekanisme Dialog-per-item
// tersendiri di LinkCardBlock.jsx, bukan lewat toolbar generik ini).
const EDITABLE_BLOCK_TYPES = new Set([
  "section",
  "text",
  "spacer",
  "shortcut",
  "link_card",
  "quick_list",
  "chart",
  "card",
]);

function SortableBlock({
  block,
  canEdit,
  onUpdate,
  onDelete,
  onMoveUp,
  onMoveDown,
  onShrink,
  onExpand,
  onDuplicate,
  onEject,
  canMoveUp,
  canMoveDown,
  _isDragActive,
  isDropTarget,
  _editOpen,
  onEditOpenChange,
  insertBefore,
  insertAfter,
  children,
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: block.ref ?? block.id,
  });

  const hasEditDialog = EDITABLE_BLOCK_TYPES.has(block.type);
  // Feedback user: Spacer/Divider vertical TIDAK ikut grid width biasa —
  // "col" di situ bukan slot layout, lebarnya murni ketebalan garis
  // (size-tier di SpacerBlock.jsx). Grid span dikunci 1 kolom; TINGGI-nya
  // mengikuti baris grid (align-items: stretch bawaan CSS Grid) selama
  // rantai elemen di dalamnya ikut h-full — itulah kenapa wrapper block
  // dan body-nya diberi h-full di bawah.
  // Feedback user: Spacer/Divider selalu selebar penuh dan tanpa kontrol
  // ukuran — hanya tinggi (size-tier) yang bisa diatur, lewat Dialog.
  const isSpacer = block.type === "spacer";
  // Link Card & Quick List harus setinggi baris (sejajar dengan block di
  // sebelahnya), bukan setinggi isinya sendiri — feedback user: dua Quick
  // List bersebelahan dgn jumlah baris beda kelihatan janggal kalau salah
  // satu lebih pendek.
  const stretchToRow =
    block.type === "link_card" || block.type === "quick_list";
  const width = isSpacer ? MAX_WIDTH : (block.width ?? MAX_WIDTH);
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    // Satu nilai lebar (satuan 12-kolom) diterjemahkan ke span per
    // breakpoint — mobile 3 kolom, tablet 6, desktop 12.
    "--col-span-sm": spanFor(width, 3),
    "--col-span-md": spanFor(width, 6),
    "--col-span-lg": spanFor(width, 12),
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-col-span={width}
      className={cn(
        "group/block relative [&[data-col-span]]:[grid-column:span_var(--col-span-sm)] [&[data-col-span]]:md:[grid-column:span_var(--col-span-md)] [&[data-col-span]]:lg:[grid-column:span_var(--col-span-lg)]",
        isDragging && "opacity-60",
        // Feedback user: bungkus border saat editor mode, biar batas tiap
        // block kelihatan jelas — bukan cuma saat hover, tapi selalu
        // terlihat selama canEdit aktif. isDropTarget: highlight lebih
        // kuat saat block ini jadi TARGET drop drag-reorder standar.
        canEdit &&
          "rounded-lg border border-dashed border-border/70 p-2 transition-colors",
        canEdit && isDropTarget && "border-primary bg-muted-foreground/10",
        // Link Card setinggi block tetangga di baris yang sama (grid
        // sudah stretch; rantai h-full yang perlu).
        stretchToRow && "flex h-full flex-col",
      )}
    >
      {insertBefore}
      {insertAfter}
      {canEdit && (
        <div className="mb-1 flex items-center justify-end gap-1">
          <button
            type="button"
            className="inline-flex size-6 cursor-grab items-center justify-center rounded text-muted-foreground hover:bg-accent active:cursor-grabbing"
            {...attributes}
            {...listeners}
          >
            <GripVerticalIcon className="size-3.5" />
          </button>
          {/* Feedback user: tombol Edit di toolbar, sebelah tombol trigger
              dnd (grip-drag) — bukan lagi overlay di dalam body block. */}
          {hasEditDialog && (
            <button
              type="button"
              onClick={() => onEditOpenChange(true)}
              className="inline-flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-accent"
            >
              <PencilIcon className="size-3.5" />
            </button>
          )}
          <BlockActionsMenu
            canMoveUp={canMoveUp}
            canMoveDown={canMoveDown}
            width={block.width ?? 12}
            minWidth={minWidthFor(block.type)}
            hideResize={isSpacer}
            onEject={onEject}
            onMoveUp={onMoveUp}
            onMoveDown={onMoveDown}
            onShrink={onShrink}
            onExpand={onExpand}
            onDuplicate={onDuplicate}
          />
          <button
            type="button"
            onClick={onDelete}
            className="inline-flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          >
            <XIcon className="size-3.5" />
          </button>
        </div>
      )}
      {children}
      {canEdit && !isSpacer && (
        <ResizeHandle
          width={block.width ?? 12}
          minWidth={minWidthFor(block.type)}
          onResize={(w) => onUpdate({ ...block, width: w })}
        />
      )}
    </div>
  );
}

// Requirement 3: kanvas dashboard — grid CSS 12-kolom, drag-reorder (dalam
// 1 level), resize, insert, drag-to-nest via drop-zone eksplisit
// (GroupDropZone, bukan geometric threshold spt DeskMenuItemManager — scope
// lebih sederhana krn nesting di sini 2 jenis parent, bukan 1). Dipanggil
// REKURSIF oleh SectionBlock utk grid lokal children-nya (depth=1).
export default function DashboardCanvas({
  widgets,
  canEdit,
  onChange,
  depth = 0,
  dndContextId,
  onEjectBlock,
}) {
  const [isDragActive, setIsDragActive] = useState(false);
  // Tipe block yang SEDANG diseret — dipakai drop-zone utk memutuskan
  // apakah dirinya relevan (feedback user: drop-zone Link Card ikut
  // menyala saat block non-item diseret, padahal dropnya diabaikan).
  const [activeDragType, setActiveDragType] = useState(null);
  const [overId, setOverId] = useState(null);
  // Feedback user: tombol Edit dipindah ke toolbar (SortableBlock), Dialog
  // config jadi controlled — set berisi ref/id block yang Dialog-nya
  // sedang terbuka (auto-diisi saat block baru disisipkan, lihat insertBlock).
  const [openEditRefs, setOpenEditRefs] = useState(() => new Set());
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  const itemIds = useMemo(() => widgets.map((w) => w.ref ?? w.id), [widgets]);

  const setEditOpen = useCallback((blockKey, isOpen) => {
    setOpenEditRefs((prev) => {
      const next = new Set(prev);
      if (isOpen) next.add(blockKey);
      else next.delete(blockKey);
      return next;
    });
  }, []);

  const updateBlock = useCallback(
    (updated) => {
      onChange(
        widgets.map((w) =>
          (w.ref ?? w.id) === (updated.ref ?? updated.id) ? updated : w,
        ),
      );
    },
    [widgets, onChange],
  );

  const deleteBlock = useCallback(
    (target) => {
      const hasChildren = (target.children ?? []).length > 0;
      if (
        hasChildren &&
        !window.confirm("Hapus block ini beserta seluruh isinya?")
      ) {
        return;
      }
      onChange(
        widgets.filter((w) => (w.ref ?? w.id) !== (target.ref ?? target.id)),
      );
    },
    [widgets, onChange],
  );

  // Feedback user (pola ERPNext v16): block yang punya Dialog config
  // (semua KECUALI text — text inline murni, TipTap langsung fokus)
  // ditandai isNew SAAT disisipkan, dikonsumsi BlockEditDialog utk
  // auto-open + Cancel-batalkan-seluruh-insert.
  // Feedback user: Text migrasi ke pola Dialog SAMA seperti block lain
  // (TipTap inline lambat di-render) — tidak ada lagi pengecualian tipe
  // yang skip auto-open Dialog saat insert.
  const insertBlock = useCallback(
    (type, atIndex) => {
      const ref = makeLocalRef();
      const newBlock = {
        ref,
        type,
        config: defaultConfigFor(type),
        width: DEFAULT_WIDTH_BY_TYPE[type] ?? 12,
        children: [],
        isNew: true,
      };
      const next = [...widgets];
      next.splice(atIndex, 0, newBlock);
      onChange(next);
      setEditOpen(ref, true);
    },
    [widgets, onChange, setEditOpen],
  );

  // Feedback user: Move Up/Down, Shrink/Expand, Duplicate — pelengkap
  // presisi di luar drag-reorder yang sudah ada.
  const moveBlock = useCallback(
    (index, direction) => {
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= widgets.length) return;
      onChange(arrayMove(widgets, index, targetIndex));
    },
    [widgets, onChange],
  );

  // Feedback user: shrink/expand SEKALI KLIK = 3 kolom (bukan 1) — grid
  // dipikirkan dalam satuan "slot" 3-kolom (12/3 = 4 slot per baris),
  // konsisten dgn default width Shortcut (3 kol, Requirement baru).
  // Feedback user (revisi): SEMUA tipe block memakai aturan resize yang
  // sama — kelipatan 1 kolom, minimum 3, maksimum 12. Perlakuan khusus
  // Quick List (half/full diskrit) DIHAPUS.
  const resizeBlock = useCallback(
    (target, direction) => {
      const current = target.width ?? MAX_WIDTH;
      const minWidth = minWidthFor(target.type);
      const nextWidth = Math.min(
        MAX_WIDTH,
        Math.max(minWidth, current + direction * GRID_STEP),
      );
      updateBlock({ ...target, width: nextWidth });
    },
    [updateBlock],
  );

  const duplicateBlock = useCallback(
    (index, target) => {
      // ref lokal baru wajib — ref lama akan collide (jadi "sama" di mata
      // React key + backend saat flatten, dua row berbeda tidak boleh
      // berbagi identity sementara yang sama).
      const clone = {
        ...target,
        ref: makeLocalRef(),
        id: undefined,
        isNew: false,
      };
      const next = [...widgets];
      next.splice(index + 1, 0, clone);
      onChange(next);
    },
    [widgets, onChange],
  );

  // Cari link_card_item (beserta card induknya) berdasarkan id — item
  // bukan block root, jadi tidak ketemu lewat widgets.find biasa.
  const findItemLocation = useCallback(
    (itemId) => {
      for (const card of widgets) {
        if (card.type !== "link_card") continue;
        const index = (card.children ?? []).findIndex(
          (c) => (c.ref ?? c.id) === itemId,
        );
        if (index !== -1) return { card, item: card.children[index], index };
      }

      return null;
    },
    [widgets],
  );

  // Memindahkan satu child keluar dari section ke level teratas kanvas.
  // Didefinisikan di canvas PEMILIK section (root), lalu diturunkan ke
  // canvas nested lewat SectionBlock -> onEjectBlock.
  const ejectFromSection = useCallback(
    (section, child) => {
      const sectionKey = section.ref ?? section.id;
      const childKey = child.ref ?? child.id;
      const next = widgets.map((w) =>
        (w.ref ?? w.id) === sectionKey
          ? {
              ...w,
              children: (w.children ?? []).filter(
                (c) => (c.ref ?? c.id) !== childKey,
              ),
            }
          : w,
      );

      onChange([...next, child]);
    },
    [widgets, onChange],
  );

  const handleDragStart = (event) => {
    setIsDragActive(true);
    const draggedId = event.active?.id;
    const rootBlock = widgets.find((w) => (w.ref ?? w.id) === draggedId);
    setActiveDragType(
      rootBlock
        ? rootBlock.type
        : (findItemLocation(draggedId)?.item?.type ?? null),
    );
  };

  const handleDragOver = (event) => setOverId(event.over?.id ?? null);

  const handleDragEnd = (event) => {
    setIsDragActive(false);
    setOverId(null);
    setActiveDragType(null);
    const { active, over } = event;
    if (!over) return;

    // ── link_card_item: reorder dalam card, ATAU pindah antar card ─────
    // Feedback user: item harus bisa dipindah ke Link Card lain. Item
    // bukan block root, jadi sumbernya dicari lewat findItemLocation()
    // dan tujuannya bisa berupa footer card lain ATAU item lain (drop
    // tepat di posisi item tsb).
    const draggedItem = findItemLocation(active.id);
    if (draggedItem) {
      const overId = String(over.id);
      const sourceCardKey = draggedItem.card.ref ?? draggedItem.card.id;

      let targetCardKey = null;
      let insertAt = null;

      if (overId.startsWith("link-card-footer:")) {
        targetCardKey = overId.slice("link-card-footer:".length);
      } else {
        const overItem = findItemLocation(over.id);
        if (!overItem) return;
        targetCardKey = overItem.card.ref ?? overItem.card.id;
        insertAt = overItem.index;
      }

      if (targetCardKey === sourceCardKey && insertAt === null) return;

      onChange(
        widgets.map((w) => {
          const key = w.ref ?? w.id;
          if (key !== sourceCardKey && key !== targetCardKey) return w;

          // Buang dulu dari sumbernya, baru sisipkan di tujuan — urutan
          // ini penting saat sumber & tujuan adalah card yang SAMA
          // (reorder), supaya indeks tujuan tidak bergeser dua kali.
          let children = (w.children ?? []).filter(
            (c) => (c.ref ?? c.id) !== active.id,
          );

          if (key === targetCardKey) {
            const at =
              insertAt === null
                ? children.length
                : Math.min(insertAt, children.length);
            children = [
              ...children.slice(0, at),
              draggedItem.item,
              ...children.slice(at),
            ];
          }

          return { ...w, children };
        }),
      );

      return;
    }

    // Drop di footer section (drag-to-nest block apapun -> section)
    if (String(over.id).startsWith("section-footer:")) {
      const targetRef = String(over.id).slice("section-footer:".length);
      const draggedBlock = widgets.find((w) => (w.ref ?? w.id) === active.id);
      if (!draggedBlock || draggedBlock.type === "section") return;

      const withoutDragged = widgets.filter(
        (w) => (w.ref ?? w.id) !== active.id,
      );
      const target = withoutDragged.find((w) => (w.ref ?? w.id) === targetRef);
      if (!target) return;
      const nextTarget = {
        ...target,
        children: [...(target.children ?? []), draggedBlock],
      };
      onChange(
        withoutDragged.map((w) =>
          (w.ref ?? w.id) === targetRef ? nextTarget : w,
        ),
      );

      return;
    }

    if (active.id === over.id) return;
    const oldIndex = widgets.findIndex((w) => (w.ref ?? w.id) === active.id);
    const newIndex = widgets.findIndex((w) => (w.ref ?? w.id) === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    onChange(arrayMove(widgets, oldIndex, newIndex));
  };

  return (
    <DndContext
      id={dndContextId ?? `dashboard-canvas-${depth}`}
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={itemIds} strategy={rectSortingStrategy}>
        {/* Feedback user: jumlah kolom grid berbeda per breakpoint —
            mobile 3, tablet (md) 6, desktop (lg) 12. Lebar block disimpan
            dalam satuan 12-kolom lalu di-scale turun (lihat spanFor()). */}
        <div
          data-dashboard-grid
          className="grid grid-cols-3 gap-4 md:grid-cols-6 lg:grid-cols-12"
        >
          {widgets.length === 0 && canEdit && (
            <div className="col-span-3 md:col-span-6 lg:col-span-12 flex h-24 items-center justify-center rounded-lg border border-dashed">
              <EmptyStateInsertButton
                onInsert={(type) => insertBlock(type, 0)}
                depth={depth}
              />
            </div>
          )}
          {widgets.map((block, index) => {
            const blockKey = block.ref ?? block.id;
            const editOpen = openEditRefs.has(blockKey);
            const onEditOpenChange = (isOpen) => setEditOpen(blockKey, isOpen);

            return (
              <div key={blockKey} className="contents">
                <SortableBlock
                  block={block}
                  canEdit={canEdit}
                  onUpdate={updateBlock}
                  onDelete={() => deleteBlock(block)}
                  onMoveUp={() => moveBlock(index, -1)}
                  onMoveDown={() => moveBlock(index, 1)}
                  onShrink={() => resizeBlock(block, -1)}
                  onExpand={() => resizeBlock(block, 1)}
                  onDuplicate={() => duplicateBlock(index, block)}
                  onEject={onEjectBlock ? () => onEjectBlock(block) : undefined}
                  canMoveUp={index > 0}
                  canMoveDown={index < widgets.length - 1}
                  isDragActive={isDragActive}
                  isDropTarget={isDragActive && overId === blockKey}
                  editOpen={editOpen}
                  onEditOpenChange={onEditOpenChange}
                  insertBefore={
                    canEdit && index === 0 ? (
                      <InsertBlockButton
                        side="left"
                        onInsert={(type) => insertBlock(type, 0)}
                        depth={depth}
                      />
                    ) : null
                  }
                  insertAfter={
                    canEdit ? (
                      <InsertBlockButton
                        side="right"
                        onInsert={(type) => insertBlock(type, index + 1)}
                        depth={depth}
                      />
                    ) : null
                  }
                >
                  <DashboardBlock
                    block={block}
                    canEdit={canEdit}
                    onUpdate={updateBlock}
                    onDelete={() => deleteBlock(block)}
                    isDragActive={isDragActive}
                    activeDragType={activeDragType}
                    depth={depth}
                    editOpen={editOpen}
                    onEditOpenChange={onEditOpenChange}
                    onEjectChild={(child) => ejectFromSection(block, child)}
                  />
                </SortableBlock>
              </div>
            );
          })}
        </div>
      </SortableContext>
    </DndContext>
  );
}
