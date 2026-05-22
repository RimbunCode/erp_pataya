export default function RoleSelectionCards({
  roles,
  onSelect,
  selectedRoleKey = null,
  className = "",
  compact = false,
}) {
  return (
    <div className={`flex flex-col divide-y divide-border ${className}`}>
      {roles.map((role) => {
        const isSelected = selectedRoleKey === role.key;

        return (
          <button
            key={role.key}
            type="button"
            onClick={() => onSelect(role)}
            className={`flex items-center gap-4 py-4 group -mx-2 px-2 rounded-xl border transition-colors text-left w-full
              ${
                isSelected
                  ? "bg-muted border-border"
                  : "border-transparent hover:border-border hover:bg-muted"
              }`}
          >
            <div
              className={`w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 ${role.iconBg} ${role.iconColor}`}
            >
              {role.icon}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-base font-black text-foreground uppercase tracking-wide">
                {role.label}
              </p>
              {!compact && (
                <p className="text-sm text-muted-foreground mt-0.5 leading-snug">
                  {role.desc}
                </p>
              )}
            </div>
            <svg
              className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 5l7 7-7 7"
              />
            </svg>
          </button>
        );
      })}
    </div>
  );
}
