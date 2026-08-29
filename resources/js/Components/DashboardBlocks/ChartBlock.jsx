import BlockEditDialog from "@/Components/DashboardBlocks/BlockEditDialog";
import ChartDisplay from "@/Components/ChartDisplay";
import ChartLinkModel from "@/Components/ChartLinkModel";

// Feedback user: split dari ChartCardBlock.jsx — Chart sekarang entity
// sendiri (bukan lagi Widget bertipe bar/pie/line/doughnut).
export default function ChartBlock({ block, canEdit, onUpdate, onDelete, editOpen, onEditOpenChange }) {
  return (
    <div>
      {block.chart ? (
        <ChartDisplay chart={block.chart} />
      ) : (
        <div className="flex h-24 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
          Belum ada Chart dipilih
        </div>
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
          validate={(draft) => (!draft.chart?.id ? "Chart wajib dipilih." : null)}
          onSave={(draft) => onUpdate({ ...block, chart: draft.chart ?? block.chart, isNew: false })}
          renderForm={(draft, patchDraft) => (
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">Chart</label>
              <ChartLinkModel value={draft.chart} onValueChange={(val) => patchDraft({ chart: val })} />
            </div>
          )}
        />
      )}
    </div>
  );
}
