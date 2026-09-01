import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/Components/ui/dialog";
import { useEffect, useState } from "react";

import { Button } from "@/Components/ui/button";

// Feedback user: tombol Edit + Dialog utk block Section/Shortcut/Link
// Card/Quick List/Card/Chart (Text TETAP inline — pengecualian, TipTap
// full-fitur natural diedit langsung di kanvas). Draft LOKAL di dalam
// dialog, Apply commit ke block via onSave, Cancel/close membuang draft
// tanpa memanggil onSave sama sekali (pola sama dgn Edit/Simpan/Batal
// level Dashboard, diterapkan lagi di level per-block).
//
// Feedback user: tombol Edit dipindah ke toolbar atas block (sejajar
// grip-drag), bukan lagi overlay di dalam body block — Dialog ini jadi
// CONTROLLED (open/onOpenChange dari SortableBlock), bukan lagi punya
// trigger/state open sendiri.
//
// Feedback user (pola ERPNext v16): block yang BARU disisipkan langsung
// membuka Dialog ini (isNew dari pemanggil) — Cancel pada kondisi itu
// MEMBATALKAN SELURUH insert (onCancelNew), bukan cuma menutup dialog
// tanpa efek. validate(draft) mengembalikan pesan error (string) atau
// null/undefined jika valid — tombol Terapkan disabled selama ada error.
export default function BlockEditDialog({
  title,
  block,
  canEdit,
  open,
  onOpenChange,
  onSave,
  renderForm,
  initialDraft,
  isNew,
  onApplied,
  onCancelNew,
  validate,
}) {
  const resolveInitial = () =>
    initialDraft !== undefined ? initialDraft : (block.config ?? {});
  const [draft, setDraft] = useState(resolveInitial);

  useEffect(() => {
    if (open) setDraft(resolveInitial());
  }, [open, block.config, initialDraft]);

  if (!canEdit) return null;

  const errorMessage = validate ? validate(draft) : null;

  const handleApply = () => {
    if (errorMessage) return;
    onSave(draft);
    onApplied?.();
    onOpenChange(false);
  };

  const handleCancel = () => {
    if (isNew && onCancelNew) {
      onCancelNew();
      return; // block dihapus oleh pemanggil — jangan onOpenChange(false) di
      // sini, komponen ini akan unmount bersama block-nya.
    }
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          handleCancel();
          return;
        }
        onOpenChange(next);
      }}
    >
      <DialogContent align="center" forceAsDialog className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          {renderForm(draft, (patch) =>
            setDraft((prev) => ({ ...prev, ...patch })),
          )}
          {errorMessage && (
            <div className="text-xs text-destructive">{errorMessage}</div>
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={handleCancel}>
            Batal
          </Button>
          <Button type="button" onClick={handleApply} disabled={!!errorMessage}>
            Terapkan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
