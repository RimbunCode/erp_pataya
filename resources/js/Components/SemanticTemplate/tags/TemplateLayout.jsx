import { cn } from "@/lib/utils";

/**
 * Teks sekunder kecil redup (<muted>).
 * @param {object} props
 * @param {string} [props.className]
 * @param {import("react").ReactNode} props.children
 * @returns {JSX.Element}
 */
export function TemplateMuted({ className, children }) {
  return (
    <span className={cn("text-xs text-muted-foreground", className)}>
      {children}
    </span>
  );
}

/**
 * Susun anak vertikal dengan jarak konsisten (<stack>).
 * @param {object} props
 * @param {string} [props.className]
 * @param {import("react").ReactNode} props.children
 * @returns {JSX.Element}
 */
export function TemplateStack({ className, children }) {
  return (
    <div className={cn("flex flex-col gap-0.5", className)}>{children}</div>
  );
}

/**
 * Susun anak horizontal dengan jarak konsisten (<inline>).
 * @param {object} props
 * @param {string} [props.className]
 * @param {import("react").ReactNode} props.children
 * @returns {JSX.Element}
 */
export function TemplateInline({ className, children }) {
  return (
    <div
      className={cn("flex flex-row flex-wrap items-center gap-1.5", className)}
    >
      {children}
    </div>
  );
}

/**
 * Sorotan (<mark>), gaya sama dengan sorotan pencarian.
 * @param {object} props
 * @param {string} [props.className]
 * @param {import("react").ReactNode} props.children
 * @returns {JSX.Element}
 */
export function TemplateMark({ className, children }) {
  return <mark className={cn("bg-yellow-500", className)}>{children}</mark>;
}
