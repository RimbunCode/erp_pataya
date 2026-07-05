import * as React from "react";

import { Switch as SwitchPrimitive } from "radix-ui";
import { cn } from "@/lib/utils";

/**
 * Switch — basis shadcn, disederhanakan untuk proyek ini:
 *  - HANYA utility skala standar (tanpa arbitrary `[...]`): setup Tailwind ini
 *    tidak meng-generate arbitrary-value utilities (h-[1.15rem],
 *    translate-x-[calc(...)], data-[size=...]) → track jadi 0px / tak terlihat.
 *  - Warna konkret: token --input di-map `hsl(var(--input))` padahal nilainya
 *    non-HSL → `bg-input` invalid. Pakai zinc/indigo eksplisit.
 *  Track h-5 w-9, thumb size-4, geser translate-x-4 (track 2.25rem − thumb
 *  1rem − padding ≈ 1rem).
 * @param {object} root0
 * @param {string} [root0.className]
 * @returns {React.JSX.Element}
 */
function Switch({ className, ...props }) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent shadow-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 disabled:cursor-not-allowed disabled:opacity-50",
        "data-[state=unchecked]:bg-zinc-300 dark:data-[state=unchecked]:bg-zinc-600",
        "data-[state=checked]:bg-indigo-600 dark:data-[state=checked]:bg-indigo-500",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb className="pointer-events-none block size-4 rounded-full bg-white shadow ring-0 transition-transform data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0" />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
