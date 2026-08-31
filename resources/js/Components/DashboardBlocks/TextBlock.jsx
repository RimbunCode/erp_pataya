import BlockEditDialog from "@/Components/DashboardBlocks/BlockEditDialog";
import TiptapEditor from "@/Components/TiptapEditor";
import { richTextValue } from "@/lib/richText";

// Requirement 2.2, 2a, 2b: TiptapEditor full-fitur (toolbar lengkap, tanpa
// imageUploadUrl/mentionSource — block dashboard tidak punya konteks upload
// atau dokumen untuk di-mention). Mode baca render config.html yang SUDAH
// tersanitasi backend (bukan getHTML() mentah), class "tiptap" sama seperti
// Comments.jsx supaya styling konsisten.
//
// Feedback user: migrasi dari inline-edit (TipTap selalu ter-mount tiap
// block Text di kanvas begitu canEdit — lambat kalau banyak block) ke
// pola Dialog SAMA seperti block lain — TipTap HANYA ter-mount saat
// Dialog benar-benar terbuka, bukan sepanjang mode edit aktif.
export default function TextBlock({ block, canEdit, onUpdate, onDelete, editOpen, onEditOpenChange }) {
  return (
    <div>
      <div
        className="tiptap min-h-[2rem]"
        dangerouslySetInnerHTML={{ __html: block.config?.html ?? "" }}
      />
      {canEdit && (
        <BlockEditDialog
          title="Edit Text"
          block={block}
          canEdit={canEdit}
          open={editOpen}
          onOpenChange={onEditOpenChange}
          isNew={block.isNew}
          onCancelNew={onDelete}
          onSave={(draft) => onUpdate({ ...block, config: draft, isNew: false })}
          renderForm={(draft, patchDraft) => (
            <TiptapEditor
              value={richTextValue(draft)}
              onValueChange={(json, html) => patchDraft({ json, html })}
            />
          )}
        />
      )}
    </div>
  );
}
