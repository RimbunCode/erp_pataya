import { Badge } from "@/Components/ui/badge";
import { cn } from "@/lib/utils";
import { resolveBadgeColor } from "../badgeColors";

/**
 * <badge color="…">. Warna dari atribut `color`; bila kosong, dari peta
 * `column.badgeColors` berdasarkan nilai mentah kolom (`row[column.name]`).
 * Warna di luar palet jatuh ke varian `secondary`.
 * @param {object} props
 * @param {string} [props.color]
 * @param {object} [props.row]
 * @param {object} [props.column]
 * @param {string} [props.className]
 * @param {import("react").ReactNode} props.children
 * @returns {JSX.Element}
 */
export default function TemplateBadge({
  color,
  row,
  column,
  className,
  children,
}) {
  const mapped =
    column?.name != null && row?.[column.name] != null
      ? column.badgeColors?.[String(row[column.name])]
      : undefined;
  const resolved = resolveBadgeColor(color || mapped);

  return (
    <Badge
      variant={resolved.variant}
      className={cn("w-fit px-2 py-0.5 text-xs", resolved.className, className)}
    >
      {children}
    </Badge>
  );
}
