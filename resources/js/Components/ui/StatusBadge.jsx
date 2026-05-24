import { STATUS_CFG } from "@/Pages/Admin/UserDirectory/config/status";

export default function StatusBadge({ status }) {
  const c = STATUS_CFG[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${c.pill}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {c.label}
    </span>
  );
}
