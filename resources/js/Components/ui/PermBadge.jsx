import { PERMISSION_GROUPS } from "@/Pages/Admin/UserDirectory/config/roles";

export default function PermBadge({ pkey }) {
  const p = PERMISSION_GROUPS.find((g) => g.key === pkey);
  if (!p) return null;
  return (
    <span
      className={`px-2 py-0.5 rounded text-[10px] font-semibold ${p.color}`}
    >
      {p.label}
    </span>
  );
}
