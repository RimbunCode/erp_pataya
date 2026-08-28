import BlockDescriptionTooltip from "@/Components/DashboardBlocks/BlockDescriptionTooltip";
import BlockEditDialog from "@/Components/DashboardBlocks/BlockEditDialog";
import IconPicker from "@/Components/IconPicker";
import { resolveIcon } from "@/lib/deskIcons";
import { cn } from "@/lib/utils";
import { richTextValue } from "@/lib/richText";
import DashboardCanvas from "@/Components/DashboardCanvas";
import GroupDropZone from "@/Components/GroupDropZone";
import TiptapEditor from "@/Components/TiptapEditor";

// Requirement 1.7-1.11, 2.1-2.1d, 3.7, 3.12: container universal — label
// rich-text-lite (TiptapEditor variant="minimal") + description opsional
// (TiptapEditor full), KEDUANYA dikonfigurasi dalam SATU Dialog yang sama
// (feedback user: description ikut masuk Edit Dialog, tidak lagi inline
// terpisah) — grid nested-lokal via rekursi DashboardCanvas (depth=1).
export default function SectionBlock({ block, canEdit, onUpdate, onDelete, depth, isDragActive, activeDragType, onEjectChild, editOpen, onEditOpenChange }) {
  const config = block.config ?? {};

  return (
    // Feedback user: border + padding horizontal HANYA relevan saat mode
    // edit (menandai batas container yang bisa di-drop). Di mode baca,
    // section adalah pengelompokan visual murni — bingkai justru bikin
    // dashboard terlihat penuh kotak bersarang.
    <div className={cn(canEdit && "rounded-lg border-2 border-dashed px-4", "py-2")}>
      {/* Feedback user: header Section kini seragam dengan block lain —
          ikon opsional + judul + deskripsi sebagai tooltip (bukan lagi
          paragraf terpisah di bawah judul). */}
      <div className="flex items-center gap-2">
        {config.icon && (
          <span className="flex size-6 items-center justify-center [&>svg]:size-4">
            {resolveIcon(config.icon)}
          </span>
        )}
        <div
          className="tiptap text-lg font-semibold"
          dangerouslySetInnerHTML={{ __html: config.label?.html || "Section" }}
        />
        <BlockDescriptionTooltip description={config.description} />
      </div>
      {canEdit && (
        <BlockEditDialog
          title="Edit Section"
          block={block}
          canEdit={canEdit}
          open={editOpen}
          onOpenChange={onEditOpenChange}
          isNew={block.isNew}
          onCancelNew={onDelete}
          validate={(draft) =>
            !draft.label?.html?.replace(/<[^>]*>/g, "").trim() ? "Judul Section wajib diisi." : null
          }
          onSave={(draft) => onUpdate({ ...block, config: draft, isNew: false })}
          renderForm={(draft, patchDraft) => (
            <>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium">Judul Section</label>
                <TiptapEditor
                  variant="minimal"
                  value={richTextValue(draft.label)}
                  onValueChange={(json, html) => patchDraft({ label: { json, html } })}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium">
                  Icon <span className="text-muted-foreground">(opsional)</span>
                </label>
                <IconPicker
                  value={draft.icon}
                  onValueChange={(val) => patchDraft({ icon: val })}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium">
                  Deskripsi <span className="text-muted-foreground">(opsional, tampil sbg tooltip)</span>
                </label>
                <TiptapEditor
                  value={richTextValue(draft.description)}
                  onValueChange={(json, html) => patchDraft({ description: { json, html } })}
                />
              </div>
            </>
          )}
        />
      )}

      <div className="mt-3">
        <DashboardCanvas
          widgets={block.children ?? []}
          canEdit={canEdit}
          depth={(depth ?? 0) + 1}
          dndContextId={`dashboard-section-${block.ref ?? block.id}`}
          onChange={(children) => onUpdate({ ...block, children })}
          onEjectBlock={onEjectChild}
        />
      </div>

      {/* Bug ditemukan: handleDragEnd di DashboardCanvas SUDAH menangani
          drop id "section-footer:*" (memindahkan block ke dalam section),
          tetapi drop-zone dgn id itu TIDAK PERNAH dirender di mana pun —
          jadi drag dari luar ke dalam section praktis mustahil. Zona ini
          melengkapi mekanisme yang sudah ada. */}
      {canEdit && (
        <GroupDropZone
          dropZoneId={`section-footer:${block.ref ?? block.id}`}
          isActive={isDragActive && activeDragType !== null && activeDragType !== "section" && activeDragType !== "link_card_item"}
          label="Lepas di sini untuk masuk section"
        />
      )}
    </div>
  );
}
