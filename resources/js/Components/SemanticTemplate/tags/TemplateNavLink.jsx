import { useContext } from "react";
import Link from "@/Components/Link";
import { cn } from "@/lib/utils";
import { InsideLinkContext } from "./linkContext";
import useRecordLink from "./useRecordLink";

/**
 * <nav-link [to="rel"]> -- tautan ke record baris (tanpa `to`) atau record
 * relasi `to`. Tanpa izin/route, atau bila sudah berada di dalam tautan lain,
 * isi dirender sebagai konten biasa tanpa `<a>`.
 * @param {object} props
 * @param {string} [props.to]
 * @param {object} props.row
 * @param {object} [props.column]
 * @param {string} [props.className]
 * @param {import("react").ReactNode} props.children
 * @returns {JSX.Element}
 */
export default function TemplateNavLink({
  to,
  row,
  column,
  className,
  children,
}) {
  const inside = useContext(InsideLinkContext);
  const link = useRecordLink(row, {
    to: to || undefined,
    column,
    enabled: !inside,
  });

  if (!link) {
    return <>{children}</>;
  }

  return (
    <Link
      href={link.href}
      className={cn(
        "text-blue-800 dark:text-blue-200 hover:underline",
        className,
      )}
    >
      <InsideLinkContext.Provider value={true}>
        {children}
      </InsideLinkContext.Provider>
    </Link>
  );
}
