import { useState } from "react";

export default function MyCourseInnerSection({
  title,
  icon,
  children,
  accent = "blue",
  defaultOpen = true,
}) {
  const [open, setOpen] = useState(defaultOpen);
  const accents = {
    blue: {
      bg: "bg-primary-soft",
      border: "border-primary/20",
      text: "text-primary",
      dot: "bg-primary-soft0",
    },
    green: {
      bg: "bg-green-50",
      border: "border-green-100",
      text: "text-green-600",
      dot: "bg-green-500",
    },
    violet: {
      bg: "bg-violet-50",
      border: "border-violet-100",
      text: "text-violet-600",
      dot: "bg-violet-500",
    },
    amber: {
      bg: "bg-amber-50",
      border: "border-amber-100",
      text: "text-amber-600",
      dot: "bg-amber-500",
    },
  };
  const a = accents[accent];

  return (
    <div className={`rounded-xl border ${a.border} overflow-hidden`}>
      <button
        onClick={() => setOpen((o) => !o)}
        className={`w-full flex items-center justify-between px-4 py-3 ${a.bg} transition-all`}
      >
        <div className="flex items-center gap-2.5">
          <span className={`w-1.5 h-1.5 rounded-full ${a.dot}`} />
          <span
            className={`text-xs font-black tracking-widest uppercase ${a.text}`}
          >
            {title}
          </span>
          {icon}
        </div>
        <svg
          className={`w-3.5 h-3.5 ${a.text} transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>
      {open && <div className="px-4 py-4 bg-card space-y-3">{children}</div>}
    </div>
  );
}
