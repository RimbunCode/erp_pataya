import { cn } from "@/lib/utils";
import { resolveDotColor } from "../badgeColors";

/**
 * <dot color="…"> -- titik indikator warna, opsional diikuti teks (children).
 * @param {object} props
 * @param {string} [props.color]
 * @param {string} [props.className]
 * @param {import("react").ReactNode} [props.children]
 * @returns {JSX.Element}
 */
export default function TemplateDot({ color, className, children }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <span
        data-slot="dot"
        aria-hidden="true"
        className={cn(
          "inline-block size-2 shrink-0 rounded-full",
          resolveDotColor(color),
        )}
      />
      {children}
    </span>
  );
}
