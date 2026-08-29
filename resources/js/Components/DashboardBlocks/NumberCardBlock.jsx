import BlockEditDialog from "@/Components/DashboardBlocks/BlockEditDialog";
import NumberCardDisplay from "@/Components/NumberCardDisplay";
import NumberCardLinkModel from "@/Components/NumberCardLinkModel";

// Feedback user: split dari ChartCardBlock.jsx — sekarang NumberCard punya
// entity sendiri (bukan lagi Widget bertipe "card"), block ini cuma
// referensi ke NumberCard yang sudah dibuat di Settings (edit konfigurasi
// tetap tanggung jawab Settings/NumberCard/Form terpisah).
export default function NumberCardBlock({ block, canEdit, onUpdate, onDelete, editOpen, onEditOpenChange }) {
  return (
    <div>
      {block.numberCard ? (
        <NumberCardDisplay numberCard={block.numberCard} />
      ) : (
        <div className="flex h-24 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
          Belum ada Number Card dipilih
        </div>
      )}
      {canEdit && (
        <BlockEditDialog
          title="Edit Number Card"
          block={block}
          canEdit={canEdit}
          initialDraft={{ numberCard: block.numberCard }}
          open={editOpen}
          onOpenChange={onEditOpenChange}
          isNew={block.isNew}
          onCancelNew={onDelete}
          validate={(draft) => (!draft.numberCard?.id ? "Number Card wajib dipilih." : null)}
          onSave={(draft) => onUpdate({ ...block, numberCard: draft.numberCard ?? block.numberCard, isNew: false })}
          renderForm={(draft, patchDraft) => (
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">Number Card</label>
              <NumberCardLinkModel value={draft.numberCard} onValueChange={(val) => patchDraft({ numberCard: val })} />
            </div>
          )}
        />
      )}
    </div>
  );
}
