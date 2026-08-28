import BlockEditDialog from "@/Components/DashboardBlocks/BlockEditDialog";
import ColorInput from "@/Components/ColorInput";
import IconPicker from "@/Components/IconPicker";
import { Input } from "@/Components/ui/input";
import LinkPicker from "@/Components/LinkPicker";
import { cn } from "@/lib/utils";
import { usePage } from "@inertiajs/react";
import { getDeskColorStyle, resolveIcon } from "@/lib/deskIcons";

function resolveShortcutHref(config, allMenuItems) {
  if (config?.link_type === "url") {
    return config.link_to || null;
  }
  const menuItem = allMenuItems?.find((item) => item.id === config?.link_to);

  return menuItem?.url ?? null;
}

// Requirement 2.4, 2.9-2.11: icon + link (menu_item|url) + label dari
// config. Feedback user: tampilan disamakan dgn Desk Item card (/desks,
// DeskCardVisual) — icon box bulat dgn bg/fg yang bisa diatur (bukan cuma
// 1 warna teks polos), reuse getDeskColorStyle yang SAMA persis dipakai
// grid /desks (satu sumber kebenaran styling, bukan implementasi kedua
// yang bisa drift). Trigger Edit di toolbar SortableBlock (Dialog
// controlled lewat editOpen/onEditOpenChange).
export default function ShortcutBlock({ block, canEdit, onUpdate, onDelete, editOpen, onEditOpenChange }) {
  const { allMenuItems = [] } = usePage().props;
  const config = block.config ?? {};
  const { className: colorClassName, style: colorStyle } = getDeskColorStyle({
    background_color: config.background_color,
    foreground_color: config.foreground_color,
  });

  // Feedback user: shortcut adalah LINK — di mode baca harus benar-benar
  // bisa diklik (anchor asli, cursor-pointer), bukan sekadar kartu statis.
  // Di mode edit anchor sengaja TIDAK dipakai supaya klik/drag tidak
  // memicu navigasi saat menyusun tata letak.
  const href = canEdit ? null : resolveShortcutHref(config, allMenuItems);
  const Wrapper = href ? "a" : "div";

  return (
    <div>
      <Wrapper
        href={href ?? undefined}
        className={cn(
          "flex flex-col items-center gap-2 rounded-lg p-3 text-center",
          href && "cursor-pointer transition-colors hover:bg-muted",
        )}
      >
        <span
          className={cn(
            "flex size-16 items-center justify-center rounded-2xl [&>svg]:size-7",
            colorClassName,
          )}
          style={colorStyle}
        >
          {resolveIcon(config.icon)}
        </span>
        <span className="text-sm font-medium">{config.label ?? "Shortcut"}</span>
      </Wrapper>
      {canEdit && (
        <BlockEditDialog
          title="Edit Shortcut"
          block={block}
          canEdit={canEdit}
          open={editOpen}
          onOpenChange={onEditOpenChange}
          isNew={block.isNew}
          onCancelNew={onDelete}
          validate={(draft) => (!draft.label?.trim() ? "Label wajib diisi." : null)}
          onSave={(draft) => onUpdate({ ...block, config: draft, isNew: false })}
          renderForm={(draft, patchDraft) => (
            <>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium">Label</label>
                <Input
                  value={draft.label ?? ""}
                  onChange={(e) => patchDraft({ label: e.target.value })}
                  placeholder="Label"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium">Icon</label>
                <IconPicker
                  value={draft.icon}
                  onValueChange={(val) => patchDraft({ icon: val })}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium">Link</label>
                <LinkPicker
                  value={{ link_type: draft.link_type, link_to: draft.link_to }}
                  onValueChange={(val) => patchDraft(val)}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium">Warna Latar</label>
                  <ColorInput
                    value={draft.background_color ?? ""}
                    onValueChange={(val) => patchDraft({ background_color: val })}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium">Warna Icon</label>
                  <ColorInput
                    value={draft.foreground_color ?? ""}
                    onValueChange={(val) => patchDraft({ foreground_color: val })}
                  />
                </div>
              </div>
            </>
          )}
        />
      )}
    </div>
  );
}

export { resolveShortcutHref };
