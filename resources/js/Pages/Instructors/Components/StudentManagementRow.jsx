import { useState } from "react";
import StudentManagementProgressRing from "./StudentManagementProgressRing";
import {
  avatarColors,
  statusCfg,
} from "@/Pages/Instructors/Utils/studentManagementConfig";

export default function StudentManagementRow({ student, index, onOpen }) {
  const [hovered, setHovered] = useState(false);
  const cfg = statusCfg[student.status] ?? statusCfg.PENDING;
  const color = avatarColors[index % avatarColors.length];

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`grid grid-cols-[2fr_2fr_1fr_1fr_auto] items-center gap-4 px-6 py-4 border-b border-border transition-all cursor-pointer
        ${hovered ? "bg-primary-soft/40" : "bg-card"}`}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div
          className={`w-9 h-9 rounded-full ${color} flex items-center justify-center text-white text-xs font-black flex-shrink-0`}
        >
          {student.avatar}
        </div>
        <div className="min-w-0">
          <p className="text-xs font-black text-foreground truncate">
            {student.name}
          </p>
          <p className="text-[10px] text-muted-foreground font-medium truncate">
            {student.email}
          </p>
        </div>
      </div>

      <div className="min-w-0">
        <p className="text-[10px] font-bold text-foreground uppercase tracking-wide truncate">
          {student.course}
        </p>
        <p className="text-[9px] text-muted-foreground font-medium mt-0.5">
          Joined {student.joinDate}
        </p>
      </div>

      <div className="flex items-center gap-2">
        <StudentManagementProgressRing pct={student.progress} />
        <span className="text-xs font-black text-foreground">
          {student.progress}%
        </span>
      </div>

      <div>
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[9px] font-black tracking-widest uppercase ${cfg.pill}`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
          {student.status}
        </span>
        <p className="text-[9px] text-muted-foreground font-medium mt-1 pl-0.5">
          Active {student.lastActive}
        </p>
      </div>

      <button
        onClick={() => onOpen(student, index)}
        className={`px-4 py-2 text-[9px] font-black tracking-widest uppercase rounded-xl transition-all whitespace-nowrap
          ${hovered ? "bg-primary text-white shadow-md shadow-primary/20" : "bg-muted text-muted-foreground"}`}
      >
        View Detail
      </button>
    </div>
  );
}
