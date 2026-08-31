import BlockEditDialog from "@/Components/DashboardBlocks/BlockEditDialog";
import Link from "../Link";
import NumberCardDisplay from "@/Components/NumberCardDisplay";
import NumberCardLinkModel from "@/Components/NumberCardLinkModel";
import { PencilIcon } from "lucide-react";
import usePermission from "@/Hooks/usePermission";
import { usePage } from "@inertiajs/react";

// Feedback user: split dari ChartCardBlock.jsx — sekarang NumberCard punya
// entity sendiri (bukan lagi Widget bertipe "card"), block ini cuma
// referensi ke NumberCard yang sudah dibuat di Settings (edit konfigurasi
// tetap tanggung jawab Settings/NumberCard/Form terpisah).
export default function NumberCardBlock({
  block,
  canEdit,
  onUpdate,
  onDelete,
  editOpen,
  onEditOpenChange,
}) {
  // Feedback user: di LUAR mode edit dashboard (canEdit di sini = mode edit
  // block AKTIF, bukan hak akses), tetap tawarkan jalan pintas ke Settings
  // utk edit NumberCard-nya sendiri — cuma muncul saat hover, dan cuma
  // kalau (a) user punya hak akses edit Dashboard SAMA SEKALI
  // (`canEdit` page prop dari DeskController::canEditDashboard(), beda dari
  // `canEdit` prop di atas yang berarti "mode edit SEDANG aktif") DAN
  // (b) permission Write ke NumberCard.
  const { canEdit: canEditPermission } = usePage().props;
  const { can } = usePermission("App\\Models\\Core\\NumberCard");
  const showEditEntityLink =
    !canEdit && canEditPermission && can("write") && block.numberCard?.id;

  return (
    <div className="group relative">
      {block.numberCard ? (
        <NumberCardDisplay
          numberCard={block.numberCard}
          filters={block.numberCard.filters ?? {}}
        />
      ) : (
        <div className="flex h-24 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
          Belum ada Number Card dipilih
        </div>
      )}
      {showEditEntityLink && (
        <Link
          href={route("numberCards.show", block.numberCard.id)}
          className="absolute right-2 top-2 hidden items-center justify-center rounded-md border bg-background p-1.5 text-muted-foreground shadow-sm transition-colors hover:text-foreground group-hover:flex"
          title="Edit Number Card"
        >
          <PencilIcon className="size-3.5" />
        </Link>
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
          validate={(draft) =>
            !draft.numberCard?.id ? "Number Card wajib dipilih." : null
          }
          onSave={(draft) =>
            onUpdate({
              ...block,
              numberCard: draft.numberCard ?? block.numberCard,
              isNew: false,
            })
          }
          renderForm={(draft, patchDraft) => (
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">Number Card</label>
              <NumberCardLinkModel
                value={draft.numberCard}
                onValueChange={(val) => patchDraft({ numberCard: val })}
              />
            </div>
          )}
        />
      )}
    </div>
  );
}
