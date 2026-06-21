import { useState } from "react";
import { router } from "@inertiajs/react";
import { cn, formatRp } from "@/lib/utils";
import { statusConfig } from "../Utils/statusConfig";
import { Trash2Icon } from "lucide-react";
import Link from "@/Components/Link";
import { Button } from "@/Components/ui/button";

export default function CourseCard({ course }) {
  const [hovered, setHovered] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const config = statusConfig[course.status] ?? statusConfig.draft;
  const isPendingApproval = course.status === "pending";

  return (
    <div
      className={`bg-card rounded-2xl border-2 overflow-hidden transition-all duration-200 cursor-pointer
        ${hovered ? "border-primary/50 shadow-lg shadow-primary/20 -translate-y-0.5" : "border-border shadow-md"}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => {
        setHovered(false);
        setMenuOpen(false);
      }}
      onClick={() => router.visit(route("instructor.classes.show", course.id))}
    >
      <div className="relative h-44 overflow-hidden">
        <div className="relative h-auto overflow-hidden bg-muted">
          <img
            src={
              course.thumbnail
                ? route("files.preview", course.thumbnail) +
                  `?v=${new Date(course.updated_at).getTime()}`
                : "/storage/images/logo-default.png"
            }
            alt={course.title}
            className="w-full h-full object-contain"
            onError={(e) => {
              e.currentTarget.src = "/storage/images/logo-default.png";
            }}
          />
          {course.thumbnail && (
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20">
              <Button variant="destructive" size="icon" asChild>
                <Link href={route("instructor.image.delete")} method="delete">
                  <Trash2Icon className="size-5" />
                </Link>
              </Button>
            </div>
          )}
        </div>
        <div className="absolute top-3 left-3 flex flex-col gap-1.5">
          <span
            className={`flex items-center gap-1.5 text-[10px] font-extrabold tracking-widest uppercase px-2.5 py-1 rounded-lg ${config.bg} ${config.color}`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
            {config.label}
          </span>
          {course.has_pending_price_change_approval && (
            <span className="inline-flex items-center text-[9px] font-extrabold tracking-widest uppercase px-2.5 py-1 rounded-lg bg-amber-100 text-amber-700 border border-amber-200">
              Pending Price Approval
            </span>
          )}
        </div>
        {/* Menu button */}
        <div
          className="absolute top-3 right-3"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="w-8 h-8 rounded-xl bg-card/20 backdrop-blur-sm flex items-center justify-center text-white hover:bg-card/40 transition-colors"
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
                onClick={() => {
                  if (isPendingApproval) {
                    return;
                  }

                  router.patch(
                    route("instructor.classes.togglePublish", course.id),
                  );
                }}
                disabled={isPendingApproval}
                className="w-full text-left px-4 py-2 text-xs font-semibold text-foreground hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isPendingApproval
                  ? "Pending Approval"
                  : course.status === "published"
                    ? "Unpublish"
                    : "Publish"}
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="p-5">
        <h3 className="text-sm font-black text-foreground uppercase tracking-wide leading-tight mb-3 line-clamp-2">
          {course.title}
        </h3>
        <div className="flex items-center gap-3 text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-4">
          <span>{course.total_hours}h</span>
          <span>·</span>
          <span>{course.total_sessions} sessions</span>
          <span>·</span>
          <span className="capitalize">{course.level}</span>
        </div>
        <div className="flex items-center justify-between pt-3 border-t border-border">
          <div>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
              Students
            </p>
            <p className="text-lg font-black text-foreground">
              {course.students_count ?? 0}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
              Price
            </p>
            <p className="text-sm font-black text-primary">
              <span
                className={cn(
                  "font-black text-primary",
                  course.discount > 0 &&
                    "line-through text-muted-foreground text-sm",
                )}
              >
                {formatRp(course.price)}
              </span>
              {course.discount > 0 && (
                <span className="font-black ml-2 text-primary">
                  {course.discount_type === "percentage"
                    ? formatRp(
                        course.price - (course.price * course.discount) / 100,
                      )
                    : formatRp(course.price - course.discount)}
                </span>
              )}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
