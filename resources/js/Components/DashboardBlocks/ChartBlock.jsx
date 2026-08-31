import BlockEditDialog from "@/Components/DashboardBlocks/BlockEditDialog";
import ChartDisplay from "@/Components/ChartDisplay";
import ChartLinkModel from "@/Components/ChartLinkModel";
import Link from "../Link";
import { PencilIcon } from "lucide-react";
import usePermission from "@/Hooks/usePermission";
import { usePage } from "@inertiajs/react";

// Feedback user: split dari ChartCardBlock.jsx — Chart sekarang entity
// sendiri (bukan lagi Widget bertipe bar/pie/line/doughnut).
export default function ChartBlock({
  block,
  canEdit,
  onUpdate,
  onDelete,
  editOpen,
  onEditOpenChange,
}) {
  // Feedback user: sama seperti NumberCardBlock — jalan pintas hover ke
  // Settings utk edit Chart-nya sendiri, di LUAR mode edit block, gate
  // ganda: hak akses edit Dashboard (page prop `canEdit`, BEDA arti dari
  // prop `canEdit` di atas = "mode edit block sedang aktif") + permission
  // Write ke Chart.
  const { canEdit: canEditPermission } = usePage().props;
  const { can } = usePermission("App\\Models\\Core\\Chart");
  const showEditEntityLink =
    !canEdit && canEditPermission && can("write") && block.chart?.id;

  return (
    <div className="group relative">
      {block.chart ? (
        <ChartDisplay chart={block.chart} filters={block.chart.filters ?? {}} />
      ) : (
        <div className="flex h-24 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
          Belum ada Chart dipilih
        </div>
      )}
      {showEditEntityLink && (
        <Link
          href={route("charts.show", block.chart.id)}
          className="absolute right-2 top-2 hidden items-center justify-center rounded-md border bg-background p-1.5 text-muted-foreground shadow-sm transition-colors hover:text-foreground group-hover:flex"
          title="Edit Chart"
        >
          <PencilIcon className="size-3.5" />
        </Link>
      )}
      {canEdit && (
        <BlockEditDialog
          title="Edit Chart"
          block={block}
          canEdit={canEdit}
          initialDraft={{ chart: block.chart }}
          open={editOpen}
          onOpenChange={onEditOpenChange}
          isNew={block.isNew}
          onCancelNew={onDelete}
          validate={(draft) =>
            !draft.chart?.id ? "Chart wajib dipilih." : null
          }
          onSave={(draft) =>
            onUpdate({
              ...block,
              chart: draft.chart ?? block.chart,
              isNew: false,
            })
          }
          renderForm={(draft, patchDraft) => (
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">Chart</label>
              <ChartLinkModel
                value={draft.chart}
                onValueChange={(val) => patchDraft({ chart: val })}
              />
            </div>
          )}
        />
      )}
    </div>
  );
}
