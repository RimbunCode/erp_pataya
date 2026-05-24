import { ROLE_CFG } from "@/Pages/Admin/UserDirectory/config/roles";

export default function RoleBadge({ role }) {
  const c = ROLE_CFG[role] ?? ROLE_CFG.student;
  return (
    <span
      className={`px-2 py-0.5 rounded text-[11px] font-semibold ${c.color}`}
    >
      {c.label}
    </span>
  );
}
