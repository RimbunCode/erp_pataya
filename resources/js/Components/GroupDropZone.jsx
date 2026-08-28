import { cn } from "@/lib/utils";
import { useDroppable } from "@dnd-kit/core";

// Drop-zone footer generik utk drag-to-nest — pola sama persis dgn
// GroupDropZone lokal di DeskMenuItemManager.jsx (selalu mounted di DOM
// spy dnd-kit mendaftarkannya sbg target valid sebelum drag dimulai,
// visually hidden via opacity-0 sampai drag aktif).
export default function GroupDropZone({ dropZoneId, disabled, isActive, label = "Lepas di sini" }) {
  const { setNodeRef, isOver } = useDroppable({ id: dropZoneId, disabled });

  if (disabled) return null;

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "mx-2 mb-2 rounded border-2 border-dashed p-2 text-center text-xs font-medium transition-all",
        isOver
          ? "border-primary bg-muted-foreground/20 text-foreground scale-[1.02]"
          : "border-border/60 text-muted-foreground",
        !isActive && "opacity-0",
      )}
    >
      {label}
    </div>
  );
}
