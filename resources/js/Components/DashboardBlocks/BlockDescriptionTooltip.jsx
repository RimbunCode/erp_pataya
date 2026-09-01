import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/Components/ui/tooltip";

import { Info } from "lucide-react";

/**
 * Description opsional yang tampil sebagai tooltip pada ikon info —
 * dipakai Link Card dan Quick List.
 *
 * Nilainya kini berbentuk { json, html } (hasil TiptapEditor). Data lama
 * masih berupa string biasa, jadi kedua bentuk tetap dirender: string
 * ditampilkan apa adanya, HTML lewat dangerouslySetInnerHTML — aman
 * karena sudah disanitasi backend (DeskController::sanitizeRowHtml).
 * @param description
 */
export function hasBlockDescription(description) {
  if (!description) return false;
  if (typeof description === "string") return description.trim().length > 0;

  return !!description.html?.trim();
}

export default function BlockDescriptionTooltip({ description }) {
  if (!hasBlockDescription(description)) return null;

  const isPlainText = typeof description === "string";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex size-4 items-center justify-center text-muted-foreground">
          <Info className="size-3.5" />
        </span>
      </TooltipTrigger>
      <TooltipContent>
        {isPlainText ? (
          description
        ) : (
          <div
            className="tiptap max-w-xs"
            dangerouslySetInnerHTML={{ __html: description.html }}
          />
        )}
      </TooltipContent>
    </Tooltip>
  );
}
