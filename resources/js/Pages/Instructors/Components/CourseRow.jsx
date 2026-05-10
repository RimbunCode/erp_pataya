import { useState, useRef } from "react";
import { router, useForm } from "@inertiajs/react";
import { formatRp } from "../Utils/formatRp";
import { statusConfig } from "../Utils/statusConfig";
import { Avatar, AvatarFallback, AvatarImage } from "@/Components/ui/avatar";

export default function CourseRow({ course }) {
  const [hovered, setHovered] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const config = statusConfig[course.status] ?? statusConfig.draft;

  return (
    <div
      className={`bg-card rounded-2xl border-2 flex items-center gap-5 px-5 py-4 transition-all duration-200 cursor-pointer
        ${hovered ? "border-primary/50 shadow-lg shadow-primary/20 -translate-y-0.5" : "border-border shadow-sm"}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => {
        setHovered(false);
        setMenuOpen(false);
      }}
      onClick={() => router.visit(route("instructor.classes.show", course.id))}
    >
      <div className="w-20 h-16 rounded-xl overflow-hidden flex-shrink-0 bg-gradient-to-br from-primary to-indigo-700">
        <Avatar className="relative w-full h-auto border rounded-xl aspect-square  group">
          {course.thumbnail && (
            <AvatarImage
              src={
                route("files.preview", course.thumbnail) +
                `?v=${new Date(course.updated_at).getTime()}`
              }
              alt={course.name}
            />
          )}
          <AvatarFallback className="rounded-lg object-fit">
            <img
              src="/storage/images/logo-default.png"
              alt={course.title}
              className="w-full h-full object-fit"
            />
          </AvatarFallback>
        </Avatar>
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-black text-foreground uppercase tracking-wide leading-tight">
          {course.title}
        </h3>
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">
          {course.categories?.[0]} · {course.total_hours}h ·{" "}
          {course.total_sessions} sessions ·{" "}
          <span className="capitalize">{course.level}</span>
        </p>
      </div>
      <div className="text-center flex-shrink-0 w-20">
        <p className="text-lg font-black text-foreground">
          {course.students_count ?? 0}
        </p>
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
          Students
        </p>
      </div>
      <div className="flex-shrink-0 w-32 text-right">
        <p className="text-sm font-black text-primary">
          {formatRp(course.price)}
        </p>
      </div>
      <span
        className={`flex items-center gap-1.5 text-[10px] font-extrabold tracking-widest uppercase px-3 py-1.5 rounded-xl flex-shrink-0 ${config.bg} ${config.color}`}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
        {config.label}
      </span>
      <div
        className="relative flex-shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={() => setMenuOpen((v) => !v)}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-muted-foreground hover:bg-muted transition-colors"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 5a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm0 7a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm0 7a1.5 1.5 0 110-3 1.5 1.5 0 010 3z" />
          </svg>
        </button>
        {menuOpen && (
          <div className="absolute right-0 top-9 bg-card border border-border rounded-xl shadow-lg py-1 z-10 w-40">
            <button
              onClick={() =>
                router.visit(route("instructor.classes.show", course.id))
              }
              className="w-full text-left px-4 py-2 text-xs font-semibold text-foreground hover:bg-muted"
            >
              View Detail
            </button>
            <button
              onClick={() =>
                router.visit(route("instructor.classes.edit", course.id))
              }
              className="w-full text-left px-4 py-2 text-xs font-semibold text-foreground hover:bg-muted"
            >
              Edit Course
            </button>
            <button
              onClick={() =>
                router.patch(
                  route("instructor.classes.togglePublish", course.id),
                )
              }
              className="w-full text-left px-4 py-2 text-xs font-semibold text-foreground hover:bg-muted"
            >
              {course.status === "published" ? "Unpublish" : "Publish"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
