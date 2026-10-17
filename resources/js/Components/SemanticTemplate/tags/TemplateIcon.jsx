import * as lucideIcons from "lucide-react";
import { cn } from "@/lib/utils";

/** Export lucide-react yang bukan ikon (komponen dasar / util). */
const NON_ICON_NAMES = new Set([
  "Icon",
  "LucideIcon",
  "Icons",
  "LucideProvider",
]);

/**
 * "truck" / "arrow-right" / "ArrowRight" -> komponen lucide, atau null.
 * @param {string} name
 * @returns {import("react").ElementType|null}
 */
export function resolveLucideIcon(name) {
  if (!name || typeof name !== "string") {
    return null;
  }
  const pascal = name
    .trim()
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
  if (!pascal || NON_ICON_NAMES.has(pascal)) {
    return null;
  }
  const icon = lucideIcons[`${pascal}Icon`] ?? lucideIcons[pascal];

  return icon && (typeof icon === "function" || typeof icon === "object")
    ? icon
    : null;
}

/**
 * <icon name="truck"/> -- ikon lucide; nama tak dikenal tidak dirender.
 * @param {object} props
 * @param {string} [props.name]
 * @param {string} [props.className]
 * @returns {JSX.Element|null}
 */
export default function TemplateIcon({ name, className }) {
  const Icon = resolveLucideIcon(name);
  if (!Icon) {
    return null;
  }

  return (
    <Icon
      aria-hidden="true"
      data-icon={name}
      className={cn("inline-block size-4 shrink-0", className)}
    />
  );
}
