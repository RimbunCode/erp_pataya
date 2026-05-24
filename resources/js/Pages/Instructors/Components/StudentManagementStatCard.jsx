export default function StudentManagementStatCard({
  label,
  value,
  sub,
  icon,
  accentBorder,
  accentDot,
  accentIcon,
  onClick,
  active,
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 min-w-0 text-left bg-card rounded-2xl p-5 border-2 transition-all shadow-sm hover:shadow-md
        ${active ? accentBorder : "border-border hover:border-border"}`}
    >
      <div className="flex items-start justify-between mb-3">
        <div
          className={`w-10 h-10 rounded-xl flex items-center justify-center ${accentIcon}`}
        >
          {icon}
        </div>
        {active && <span className={`w-2 h-2 rounded-full ${accentDot}`} />}
      </div>
      <p className="text-2xl font-black text-foreground tracking-tight">
        {value}
      </p>
      <p className="text-[10px] font-black tracking-widest text-muted-foreground uppercase mt-0.5">
        {label}
      </p>
      <p className="text-[9px] font-semibold text-muted-foreground mt-1">
        {sub}
      </p>
    </button>
  );
}
