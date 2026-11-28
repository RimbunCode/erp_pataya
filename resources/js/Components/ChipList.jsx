import { DIFF_ADDED, DIFF_REMOVED, DIFF_REMOVED_TEXT } from "@/lib/diffUtils";

import { Button } from "./ui/button";
import { XIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * @typedef {object} ChipItem
 * @property {string} key kunci unik chip
 * @property {string} label teks chip (juga dipakai sbg tooltip bila terpotong)
 * @property {"added"|"removed"} [status] penanda diff (`valueBefore`): "added" =
 *   baru ditambah, "removed" = ada di nilai lama tapi sudah dicabut (dicoret,
 *   tanpa X)
 * @property {() => void} [onNavigate] ada -> label jadi tombol (mis. membuka
 *   halaman detail via `window.open`)
 * @property {string|null} [href] tanpa `onNavigate`: ada -> label jadi tautan
 *   `<a target="_blank">`; null/kosong -> teks biasa
 * @property {boolean} [removable] default true; false = X disembunyikan khusus chip ini
 */

/**
 * ChipList -- daftar chip nilai terpilih, dipakai bersama `LinkModel` (mode
 * `multiple`) dan `MultiSelect`. Tiap chip punya DUA area terpisah: label
 * (opsional bisa diklik utk navigasi) dan tombol X (mencabut chip). Chip tanpa
 * navigasi tampil sbg teks biasa (tanpa kursor/gaya tautan). Label panjang
 * terpotong (`truncate`) dgn tooltip bawaan browser (`title`); susunan membungkus.
 * `readOnly` HANYA menyembunyikan X -- label tetap berfungsi.
 * @param {object} props
 * @param {ChipItem[]} props.items
 * @param {(item: ChipItem) => void} [props.onRemove] tanpa ini X tak dirender
 * @param {boolean} [props.readOnly] sembunyikan semua X
 * @param {string} [props.className]
 * @param {(item: ChipItem) => string} [props.removeLabel] aria-label tombol X
 * @returns {React.JSX.Element|null}
 */
export default function ChipList({
  items,
  onRemove,
  readOnly = false,
  className,
  removeLabel = (item) => `Remove ${item.label}`,
}) {
  if (!items?.length) return null;

  return (
    <div
      data-testid="chip-list"
      className={cn("flex flex-wrap items-center gap-1 min-w-0", className)}
    >
      {items.map((item) => {
        const removed = item.status === "removed";
        const showRemove =
          !!onRemove && !readOnly && !removed && item.removable !== false;
        const labelClass = cn(
          "truncate max-w-64 text-left text-sm",
          removed && DIFF_REMOVED_TEXT,
        );
        const navigable = !removed && (item.onNavigate || item.href);

        return (
          <div
            key={item.key}
            data-testid="chip"
            data-status={item.status}
            className={cn(
              "flex items-center max-w-full px-2 py-0.5 rounded-md gap-x-1 bg-muted-foreground/10",
              item.status === "added" && DIFF_ADDED,
              removed && DIFF_REMOVED,
            )}
          >
            {navigable && item.onNavigate ? (
              <button
                type="button"
                title={item.label}
                className={cn(
                  labelClass,
                  "cursor-pointer underline-offset-2 hover:underline focus-visible:underline outline-none",
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  item.onNavigate();
                }}
              >
                {item.label}
              </button>
            ) : navigable ? (
              <a
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                title={item.label}
                className={cn(
                  labelClass,
                  "cursor-pointer underline-offset-2 hover:underline focus-visible:underline outline-none",
                )}
                onClick={(e) => e.stopPropagation()}
              >
                {item.label}
              </a>
            ) : (
              <span title={item.label} className={labelClass}>
                {item.label}
              </span>
            )}
            {showRemove && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={removeLabel(item)}
                className="rounded-full p-0! m-0! w-auto h-auto shrink-0"
                // Cegah input kehilangan fokus (menutup popover) sebelum klik terproses.
                onMouseDown={(e) => e.preventDefault()}
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(item);
                }}
              >
                <XIcon className="size-3.5!" />
              </Button>
            )}
          </div>
        );
      })}
    </div>
  );
}
