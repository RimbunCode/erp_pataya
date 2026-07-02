import { STATUS_CFG } from "@/Pages/Admin/UserDirectory/config/status";

const FALLBACK_CFG = {
  label: "Unknown",
  dot: "bg-zinc-400",
  pill: "bg-zinc-100 text-zinc-600 dark:bg-zinc-500/15 dark:text-zinc-300",
};

export default function StatusBadge({ status }) {
  const c = STATUS_CFG[status] ?? FALLBACK_CFG;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${c.pill}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {c.label}
    </span>
  );
}
