import { useMemo } from "react";

import { Checkbox } from "@/Components/ui/checkbox";
import useLongPress from "./useLongPress";

/**
 * Pembungkus kartu mobile: menambahkan checkbox (saat mode seleksi), long-press
 * untuk masuk mode seleksi, dan slot menu aksi di sisi kanan.
 *
 * Saat mode seleksi, klik pada konten (termasuk link) dialihkan menjadi toggle.
 * Klik yang menyusul long-press ditelan agar tidak memicu navigasi/toggle ganda.
 * @param {{
 *   selectionMode: boolean,
 *   checked: boolean,
 *   onToggle: (checked: boolean) => void,
 *   onLongPress: () => void,
 *   menu: import("react").ReactNode,
 *   label: string,
 *   children: import("react").ReactNode,
 * }} props
 */
export default function MobileRowShell({
  selectionMode,
  checked,
  onToggle,
  onLongPress,
  menu,
  label,
  children,
}) {
  const { handlers, consumeLongPress } = useLongPress({ onLongPress });

  const contentHandlers = useMemo(
    () => ({
      ...handlers,
      onPointerDown: (e) => {
        if (e.pointerType === "mouse" && e.button !== 0) {
          return;
        }
        handlers.onPointerDown(e);
      },
    }),
    [handlers],
  );

  const handleClickCapture = (e) => {
    if (consumeLongPress()) {
      e.preventDefault();
      e.stopPropagation();

      return;
    }

    if (selectionMode) {
      e.preventDefault();
      e.stopPropagation();
      onToggle(!checked);
    }
  };

  return (
    <div className="flex items-stretch">
      {selectionMode && (
        <div className="flex items-center pl-3">
          <Checkbox
            aria-label={label}
            checked={checked}
            onCheckedChange={() => onToggle(!checked)}
          />
        </div>
      )}
      <div
        className="min-w-0 flex-1"
        onClickCapture={handleClickCapture}
        {...contentHandlers}
      >
        {children}
      </div>
      <div className="flex items-center">{menu}</div>
    </div>
  );
}
