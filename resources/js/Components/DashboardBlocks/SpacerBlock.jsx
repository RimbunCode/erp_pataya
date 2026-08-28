import {
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
  AlignVerticalJustifyStart,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/Components/ui/tooltip";

import BlockEditDialog from "@/Components/DashboardBlocks/BlockEditDialog";
import Select from "@/Components/Select";
import { cn } from "@/lib/utils";

// Feedback user: ukuran Spacer/Divider bertingkat (xs..xl, default md) —
// BUKAN px bebas (lebih gampang dipilih, konsisten "spacing scale" ala
// design system drpd user menebak angka px yang pas).
const SIZE_PX = { xs: 8, sm: 16, md: 24, lg: 40, xl: 64 };
const SIZE_OPTIONS = [
  { value: "xs", label: "Extra Small" },
  { value: "sm", label: "Small" },
  { value: "md", label: "Medium (default)" },
  { value: "lg", label: "Large" },
  { value: "xl", label: "Extra Large" },
];

// Feedback user: style garis Divider — border-style CSS native (bukan
// render kustom), cukup untuk kebutuhan pemisah visual di dashboard.
// "Tebal" BUKAN border-style tersendiri (CSS tidak punya nilai itu) —
// direpresentasikan sbg solid dgn border-width lebih besar (lihat
// LINE_WIDTH_PX di render, dipetakan dari value yg sama ini).
const LINE_STYLE_OPTIONS = [
  { value: "solid", label: "Solid (garis lurus)" },
  { value: "dashed", label: "Putus-putus" },
  { value: "dotted", label: "Titik-titik" },
  { value: "thick", label: "Tebal" },
];

const LINE_WIDTH_PX = { thick: 4 };

// Feedback user: posisi HANYA relevan untuk variant "divider" (garis) —
// spacer polos tidak punya elemen visual untuk diposisikan. Toggle
// icon-only (bukan Select) dengan tooltip label, pola sama LinkPicker.
const POSITION_OPTIONS = [
  { value: "top", label: "Atas", icon: AlignVerticalJustifyStart },
  { value: "center", label: "Tengah", icon: AlignVerticalJustifyCenter },
  { value: "bottom", label: "Bawah", icon: AlignVerticalJustifyEnd },
];

function defaultSpacerConfig(config) {
  return {
    variant: config?.variant ?? "spacer",
    size: config?.size ?? "md",
    lineStyle: config?.lineStyle ?? "solid",
    position: config?.position ?? "center",
  };
}

function PositionToggle({ value, onChange }) {
  return (
    <div className="flex gap-1">
      {POSITION_OPTIONS.map((opt) => (
        <Tooltip key={opt.value}>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => onChange(opt.value)}
              aria-label={opt.label}
              className={cn(
                "inline-flex size-8 items-center justify-center rounded-md border",
                value === opt.value
                  ? "border-primary bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-accent",
              )}
            >
              <opt.icon className="size-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent>{opt.label}</TooltipContent>
        </Tooltip>
      ))}
    </div>
  );
}

// Feedback user (revisi): opsi vertical DIHAPUS — spacer/divider selalu
// horizontal dan selalu selebar 12 kolom, jadi tidak punya resizer
// maupun Expand/Shrink (lihat DashboardCanvas: hideResize untuk spacer).
// Yang diatur: tipe (jarak kosong vs garis), ukuran tinggi, dan — khusus
// divider — style garis serta posisinya dalam tinggi box.
export default function SpacerBlock({ block, canEdit, onUpdate, onDelete, editOpen, onEditOpenChange }) {
  const { variant, size, lineStyle, position } = defaultSpacerConfig(block.config);
  const isDivider = variant === "divider";
  const sizePx = SIZE_PX[size] ?? SIZE_PX.md;

  const previewStyle = { height: `${sizePx}px` };
  const linePosition = {
    top: "items-start",
    center: "items-center",
    bottom: "items-end",
  }[position];

  return (
    <div>
      <div
        style={previewStyle}
        className={cn(
          "flex justify-center rounded",
          isDivider ? linePosition : "items-center",
          canEdit && "border border-dashed",
        )}
      >
        {isDivider ? (
          <div
            className="w-full"
            style={{
              borderTopWidth: LINE_WIDTH_PX[lineStyle] ?? 2,
              borderTopStyle: lineStyle === "thick" ? "solid" : lineStyle,
              borderTopColor: "currentColor",
            }}
          />
        ) : (
          canEdit && (
            <span className="text-[10px] text-muted-foreground">Spacer · {size}</span>
          )
        )}
      </div>
      {canEdit && (
        <BlockEditDialog
          title="Edit Spacer"
          block={block}
          canEdit={canEdit}
          open={editOpen}
          onOpenChange={onEditOpenChange}
          isNew={block.isNew}
          onCancelNew={onDelete}
          onSave={(draft) => onUpdate({ ...block, config: draft, isNew: false })}
          renderForm={(draft, patchDraft) => (
            <>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium">Tipe</label>
                <Select
                  value={draft.variant ?? "spacer"}
                  onValueChange={(val) => patchDraft({ variant: val })}
                  options={[
                    { value: "spacer", label: "Spacer (jarak kosong)" },
                    { value: "divider", label: "Divider (garis pembatas)" },
                  ]}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium">Ukuran</label>
                <Select
                  value={draft.size ?? "md"}
                  onValueChange={(val) => patchDraft({ size: val })}
                  options={SIZE_OPTIONS}
                />
              </div>
              {draft.variant === "divider" && (
                <>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium">Style Garis</label>
                    <Select
                      value={draft.lineStyle ?? "solid"}
                      onValueChange={(val) => patchDraft({ lineStyle: val })}
                      options={LINE_STYLE_OPTIONS}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium">Posisi</label>
                    <PositionToggle
                      value={draft.position ?? "center"}
                      onChange={(val) => patchDraft({ position: val })}
                    />
                  </div>
                </>
              )}
            </>
          )}
        />
      )}
    </div>
  );
}
