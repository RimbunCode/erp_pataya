// ValueChipList — chip nilai di dalam kotak (list/boolean, relation, text,
// number, date) yang diekstrak dari `SearchBar.jsx` supaya dipakai BERSAMA Search
// Bar atas dan Sel Filter per kolom (spec datatable2-column-search-row,
// Requirement 10.2). `onMouseDown preventDefault` di tombol x: fokus tetap di input.

import { X } from "lucide-react";
import { chipClass } from "./valueInputUtils";
import { cn } from "@/lib/utils";
import { useLaravelReactI18n } from "laravel-react-i18n";

/**
 * @param {object} p
 * @param {object} p.value controller `useColumnValueInput`
 * @returns {React.JSX.Element}
 */
export default function ValueChipList({ value }) {
  const { t } = useLaravelReactI18n();
  const {
    excludeMode,
    highlightedValueChipKey,
    removeValueChip,
    startEditValueChip,
    visibleValueChips,
    vmode,
  } = value;

  return (
    <>
      {visibleValueChips.map((chip) => (
        <span
          key={chip.key}
          data-excluded={excludeMode ? "true" : undefined}
          className={cn(
            "inline-flex! items-center gap-1 rounded-full px-2 py-0.5 text-xs shrink-0",
            // Mode kecualikan cukup ditandai badge kolom merah +
            // `data-excluded`; chip TIDAK merah -- bentrok dgn
            // ring merah penanda chip yg sedang tersorot.
            chipClass("value"),
            highlightedValueChipKey === chip.key && "ring-2 ring-destructive",
          )}
        >
          {vmode === "text" || vmode === "number" || vmode === "date" ? (
            // Chip nilai text/number/date dapat diklik utk diedit (Requirement 41.1).
            <button
              type="button"
              className="max-w-40 truncate whitespace-nowrap! cursor-text hover:underline"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => startEditValueChip(chip.key)}
            >
              {chip.label}
            </button>
          ) : (
            <span className="max-w-40 truncate whitespace-nowrap!">
              {chip.label}
            </span>
          )}
          <button
            type="button"
            aria-label={t("core.datatable.search.remove_chip", {
              label: chip.label,
            })}
            className="cursor-pointer opacity-70 hover:opacity-100"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => removeValueChip(chip.key)}
          >
            <X className="size-3" />
          </button>
        </span>
      ))}
    </>
  );
}
