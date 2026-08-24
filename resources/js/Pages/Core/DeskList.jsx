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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/Components/ui/dropdown-menu";
import { FormPageDialog } from "@/Pages/Core/FormPage";
import { Head, router } from "@inertiajs/react";
import { PlusIcon, EllipsisVertical, Pencil, Check, X } from "lucide-react";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { useEffect, useMemo, useRef, useState } from "react";

import AppLayout from "@/Layouts/AppLayout";
import { Badge } from "@/Components/ui/badge";
import { Button } from "@/Components/ui/button";
import { CSS } from "@dnd-kit/utilities";
import DeskForm from "@/Pages/Core/Desk/Form";
import { cn } from "@/lib/utils";
import { getDeskColorStyle, resolveIcon } from "@/lib/deskIcons";
import useDeleteModal from "@/Hooks/useDeleteModal";

const VISIBLE_CONTAINER = "visible";
const HIDDEN_CONTAINER = "hidden";

function DeskCardVisual({
  desk,
  editMode,
  isOverlay = false,
  willHide = false,
  onSetDefault,
  onEdit,
  onDestroy,
  onToggleHidden,
  cardProps,
}) {
  const { className: colorClassName, style: colorStyle } =
    getDeskColorStyle(desk);

  return (
    <div
      {...cardProps}
      className={cn(
        "group relative flex flex-col items-center gap-3 rounded-lg p-4 text-center transition-colors",
        editMode
          ? "cursor-grab active:cursor-grabbing"
          : "cursor-pointer hover:bg-muted",
        editMode && desk.isHidden && !isOverlay && "opacity-50",
        // Overlay yg diseret berubah tampilan sesuai container yg sedang
        // di-hover — sinyal visual "akan disembunyikan" sblm dilepas.
        isOverlay && !willHide && "shadow-lg",
        isOverlay && willHide && "opacity-60 shadow-lg ring-2 ring-destructive",
      )}
    >
      {editMode ? (
        !desk.isHidden && (
          <button
            type="button"
            // dnd-kit listeners terpasang di onPointerDown card (parent) —
            // stopPropagation() di onClick saja TERLAMBAT (pointerdown sudah
            // duluan memulai drag session sebelum onClick sempat jalan).
            // Harus dihentikan di pointerdown/mousedown jg, event yg sama
            // dipakai sensor dnd-kit.
            onPointerDown={(event) => event.stopPropagation()}
            onMouseDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              onToggleHidden(desk);
            }}
            className="absolute top-1 right-1 rounded p-1 text-muted-foreground hover:bg-muted"
            aria-label="Sembunyikan desk"
          >
            <X className="size-4" />
          </button>
        )
      ) : (
        <div className="absolute top-1 right-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-7 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100"
                onClick={(event) => event.stopPropagation()}
                aria-label="Opsi desk"
              >
                <EllipsisVertical className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              onClick={(event) => event.stopPropagation()}
            >
              <DropdownMenuItem
                disabled={desk.isDefault}
                onSelect={() => onSetDefault(desk)}
              >
                Jadikan Default
              </DropdownMenuItem>
              {desk.canEdit && (
                <DropdownMenuItem onSelect={() => onEdit(desk)}>
                  Edit
                </DropdownMenuItem>
              )}
              {desk.canDelete && (
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onSelect={() => onDestroy(desk)}
                >
                  Hapus
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      <span
        className={cn(
          "flex size-16 items-center justify-center rounded-2xl [&>svg]:size-7",
          colorClassName,
        )}
        style={colorStyle}
      >
        {resolveIcon(desk.icon)}
      </span>

      <div className="flex flex-col items-center gap-1">
        <span className="text-sm font-medium">{desk.name}</span>
        {desk.isDefault && (
          <Badge variant="secondary" className="text-[10px]">
            Default
          </Badge>
        )}
      </div>
    </div>
  );
}

function DeskCard({
  desk,
  editMode,
  onOpen,
  onSetDefault,
  onEdit,
  onDestroy,
  onToggleHidden,
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: desk.id, disabled: !editMode });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    // Card asli disembunyikan (bukan di-unmount) selama drag — yang
    // terlihat bergerak cuma DragOverlay, mencegah flicker "kembali ke
    // posisi awal" saat React re-render array desks setelah drop.
    opacity: isDragging ? 0 : 1,
  };

  // Mode edit: card SENDIRI jadi trigger drag (bukan grip handle terpisah).
  // Klik statis (tanpa geser) TIDAK PERNAH memicu onDragEnd dnd-kit sama
  // sekali (MouseSensor perlu activationConstraint distance tercapai dulu
  // supaya drag session ter-"activate" — klik diam di 1 titik gagal
  // activation, sesi drag batal sebelum mulai). Aman ditangani onClick
  // React biasa tanpa risiko race condition dgn handleDragEnd.
  function handleClick() {
    if (!editMode) {
      onOpen(desk);
      return;
    }
    if (desk.isHidden) {
      onToggleHidden(desk);
    }
  }

  return (
    <DeskCardVisual
      desk={desk}
      editMode={editMode}
      onSetDefault={onSetDefault}
      onEdit={onEdit}
      onDestroy={onDestroy}
      onToggleHidden={onToggleHidden}
      cardProps={{
        ref: setNodeRef,
        style,
        role: "button",
        tabIndex: 0,
        onClick: handleClick,
        ...(editMode ? attributes : {}),
        ...(editMode ? listeners : {}),
      }}
    />
  );
}

function DroppableArea({ id, className, activeClassName, children }) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      id={id}
      className={cn(className, isOver && activeClassName)}
    >
      {children}
    </div>
  );
}

function DeskGrid({ desks, editMode, ...cardHandlers }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {desks.map((desk) => (
        <DeskCard
          key={desk.id}
          desk={desk}
          editMode={editMode}
          {...cardHandlers}
        />
      ))}
    </div>
  );
}

export default function DeskList({ desks: initialDesks }) {
  const route = window.route;
  const addDeskDialogRef = useRef(null);
  const { deleteItem } = useDeleteModal();
  const [editMode, setEditMode] = useState(false);
  const [desks, setDesks] = useState(initialDesks);
  const [activeId, setActiveId] = useState(null);
  const [overContainer, setOverContainer] = useState(null);
  const hasChanges = useRef(false);

  // initialDesks HANYA dipakai sbg initial value useState — tidak re-sync
  // otomatis kalau Inertia navigasi balik ke /desks dgn props baru (mis.
  // sesudah create Desk baru, redirect ke desks.index reuse component
  // instance yg sama, state lokal lama TIDAK ke-replace tanpa effect ini).
  // Skip sync selama ada perubahan drag BELUM tersimpan (hasChanges true)
  // biar tidak menimpa optimistic state user di tengah reorder.
  useEffect(() => {
    if (!hasChanges.current) {
      setDesks(initialDesks);
    }
  }, [initialDesks]);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 10 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 250, tolerance: 5 },
    }),
  );

  const visibleDesks = useMemo(() => desks.filter((d) => !d.isHidden), [desks]);
  const hiddenDesks = useMemo(() => desks.filter((d) => d.isHidden), [desks]);
  const visibleIds = useMemo(
    () => visibleDesks.map((d) => d.id),
    [visibleDesks],
  );
  const hiddenIds = useMemo(() => hiddenDesks.map((d) => d.id), [hiddenDesks]);
  const activeDesk = useMemo(
    () => desks.find((d) => d.id === activeId) ?? null,
    [desks, activeId],
  );

  function openDesk(desk) {
    router.post(
      route("desk.switch"),
      { desk_id: desk.id, redirect_to_dashboard: true },
      { preserveScroll: true },
    );
  }

  function setDefault(desk) {
    router.post(
      route("desk.setDefault", desk.id),
      {},
      { preserveScroll: true },
    );
  }

  function editDesk(desk) {
    router.visit(route("desks.show", desk.id));
  }

  function destroyDesk(desk) {
    deleteItem("desks.destroy", desk.id);
  }

  function toggleHidden(desk) {
    hasChanges.current = true;
    setDesks((items) =>
      items.map((d) =>
        d.id === desk.id ? { ...d, isHidden: !d.isHidden } : d,
      ),
    );
  }

  function containerOf(id) {
    if (visibleIds.includes(id)) return VISIBLE_CONTAINER;
    if (hiddenIds.includes(id)) return HIDDEN_CONTAINER;
    // `over` bisa berupa container kosong itu sendiri (droppable id-nya
    // container name langsung, dipakai saat salah satu area kosong).
    if (id === VISIBLE_CONTAINER || id === HIDDEN_CONTAINER) return id;
    return null;
  }

  function handleDragStart(event) {
    setActiveId(event.active.id);
    setOverContainer(containerOf(event.active.id));
  }

  // Reorder LIVE selama drag berlangsung (bukan cuma di dragEnd) — card lain
  // di kedua container ikut animasi reflow real-time mengikuti posisi
  // kursor (standar pola dnd-kit multi-container, mis. kanban Trello).
  // Pindah container di sini men-toggle isHidden LANGSUNG (preview), commit
  // final tetap terjadi di dragEnd (server sync), tapi visual sudah
  // menyesuaikan sejak drag masih berlangsung.
  function handleDragOver(event) {
    const { active, over } = event;
    if (!over) {
      setOverContainer(null);
      return;
    }

    const toContainer = containerOf(over.id);
    setOverContainer(toContainer);

    const fromContainer = containerOf(active.id);
    if (!fromContainer || !toContainer || fromContainer === toContainer) {
      return;
    }

    // Pindah container secara live — toggle isHidden supaya card langsung
    // pindah render ke SortableContext tujuan selagi drag masih berjalan.
    setDesks((items) =>
      items.map((d) =>
        d.id === active.id
          ? { ...d, isHidden: toContainer === HIDDEN_CONTAINER }
          : d,
      ),
    );
  }

  function handleDragEnd(event) {
    setActiveId(null);
    setOverContainer(null);

    const { active, over } = event;
    if (!over) return;

    const fromContainer = containerOf(active.id);
    const toContainer = containerOf(over.id);
    if (!fromContainer || !toContainer) return;

    hasChanges.current = true;

    // Klik statis (tanpa geser) ditangani DeskCard::handleClick — drag
    // session tidak pernah ter-activate utk gesture itu, jadi tidak akan
    // sampai sini. active.id===over.id di titik ini murni drag berhenti
    // tepat di posisi semula — tidak perlu reorder.
    if (active.id === over.id) return;

    // fromContainer SELALU === toContainer di titik ini — pindah antar
    // container sudah di-commit live oleh handleDragOver (toggle isHidden
    // terjadi begitu drag menyentuh container lain), jadi yg tersisa
    // di sini murni finalisasi urutan DALAM container yg sekarang sudah sama.
    setDesks((items) => {
      const containerIds = (
        toContainer === VISIBLE_CONTAINER ? visibleDesks : hiddenDesks
      ).map((d) => d.id);
      const oldIndex = containerIds.indexOf(active.id);
      const newIndex = containerIds.indexOf(over.id);
      const reorderedContainerIds = arrayMove(containerIds, oldIndex, newIndex);

      const rest = items.filter((d) => !containerIds.includes(d.id));
      const reordered = reorderedContainerIds.map((id) =>
        items.find((d) => d.id === id),
      );

      return toContainer === VISIBLE_CONTAINER
        ? [...reordered, ...rest]
        : [...rest, ...reordered];
    });
  }

  function toggleEditMode() {
    if (editMode && hasChanges.current) {
      hasChanges.current = false;
      router.post(
        route("desk.reorder"),
        {
          desks: desks.map((d) => ({ id: d.id, is_hidden: d.isHidden })),
        },
        { preserveScroll: true, preserveState: true },
      );
    }

    setEditMode((prev) => !prev);
  }

  const cardHandlers = {
    onOpen: openDesk,
    onSetDefault: setDefault,
    onEdit: editDesk,
    onDestroy: destroyDesk,
    onToggleHidden: toggleHidden,
  };

  return (
    <AppLayout hideSidebar hideHomeBreadcrumb>
      <Head title="Desks" />

      <div className="flex justify-end p-6 pb-0">
        <Button
          type="button"
          variant={editMode ? "default" : "outline"}
          size="sm"
          onClick={toggleEditMode}
        >
          {editMode ? (
            <>
              <Check className="size-4" />
              Selesai
            </>
          ) : (
            <>
              <Pencil className="size-4" />
              Edit
            </>
          )}
        </Button>
      </div>

      {editMode ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div className="flex flex-col gap-6 p-6">
            <SortableContext items={visibleIds} strategy={rectSortingStrategy}>
              <DroppableArea
                id={VISIBLE_CONTAINER}
                className="grid grid-cols-2 gap-4 rounded-lg p-2 transition-colors sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
                activeClassName="bg-primary/5 ring-2 ring-primary/30"
              >
                {visibleDesks.map((desk) => (
                  <DeskCard
                    key={desk.id}
                    desk={desk}
                    editMode={editMode}
                    {...cardHandlers}
                  />
                ))}

                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => addDeskDialogRef.current?.open()}
                  className="flex cursor-pointer flex-col items-center gap-3 rounded-lg p-4 text-center transition-colors hover:bg-muted"
                >
                  <span className="flex size-16 items-center justify-center rounded-2xl border border-dashed bg-muted text-muted-foreground [&>svg]:size-7">
                    <PlusIcon />
                  </span>
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-sm font-medium">Tambah Desk</span>
                  </div>
                </div>
              </DroppableArea>
            </SortableContext>

            <div className="space-y-2 border-t pt-4">
              <p className="text-sm font-medium text-muted-foreground">
                Tersembunyi
              </p>
              <SortableContext items={hiddenIds} strategy={rectSortingStrategy}>
                <DroppableArea
                  id={HIDDEN_CONTAINER}
                  className="grid min-h-24 grid-cols-2 gap-4 rounded-lg border border-dashed p-4 transition-colors sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
                  activeClassName="border-destructive/50 bg-destructive/5"
                >
                  {hiddenDesks.map((desk) => (
                    <DeskCard
                      key={desk.id}
                      desk={desk}
                      editMode={editMode}
                      {...cardHandlers}
                    />
                  ))}
                </DroppableArea>
              </SortableContext>
            </div>
          </div>

          <DragOverlay>
            {activeDesk && (
              <DeskCardVisual
                desk={activeDesk}
                editMode={editMode}
                isOverlay
                willHide={overContainer === HIDDEN_CONTAINER}
                onSetDefault={setDefault}
                onEdit={editDesk}
                onDestroy={destroyDesk}
                onToggleHidden={toggleHidden}
                cardProps={{}}
              />
            )}
          </DragOverlay>
        </DndContext>
      ) : (
        <div className="p-6">
          <DeskGrid
            desks={visibleDesks}
            editMode={editMode}
            {...cardHandlers}
          />
        </div>
      )}

      <FormPageDialog
        ref={addDeskDialogRef}
        title="Desk Baru"
        name="desk"
        className="max-w-(--breakpoint-2xl)!"
        onSuccess={() => router.reload({ only: ["desks"] })}
      >
        <DeskForm />
      </FormPageDialog>
    </AppLayout>
  );
}
