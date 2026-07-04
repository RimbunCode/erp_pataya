import { Avatar, AvatarFallback, AvatarImage } from "@/Components/ui/avatar";
import { cn, formatRp } from "@/lib/utils";

import { useState } from "react";
import CourseCompare from "./CourseCompare";
import {
  CreditCardIcon,
  GitCompareArrowsIcon,
  ShoppingCartIcon,
  XIcon,
} from "lucide-react";
import { router } from "@inertiajs/react";
export default function CourseCard({
  course,
  inCart,
  onAddToCart,
  onRemoveFromCart,
  viewMode,
  isSelected,
  onToggleCompare,
  compareCount,
  onCheckout,
}) {
  const [hovered, setHovered] = useState(false);
  const canAdd = !isSelected && compareCount < 3;
  const finalPrice = Number(course.final_price ?? course.price ?? 0);
  const hasDiscount = finalPrice < Number(course.price || 0);

  if (viewMode === "list") {
    return (
      <div
        className={`bg-card rounded-2xl border-2 flex items-center gap-5 px-5 py-4 transition-all duration-200
          ${hovered ? "border-primary/50 shadow-lg shadow-primary/20 -translate-y-0.5" : "border-border shadow-sm"}`}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <div
          onClick={() =>
            router.visit(route("student.course.preview", course.id))
          }
          className="w-24 h-20 rounded-xl overflow-hidden flex-shrink-0"
        >
          <Avatar className="relative w-full h-auto border rounded-xl aspect-square  group">
            {course.thumbnail && (
              <AvatarImage
                src={
                  route("files.preview", course.thumbnail) +
                  `?v=${new Date(course.updated_at).getTime()}`
                }
                alt={course.title}
              />
            )}
            <AvatarFallback className="rounded-lg">
              <img
                src="/storage/images/logo-default.png"
                alt={course.title}
                className="w-full h-full object-contain"
              />
            </AvatarFallback>
          </Avatar>
        </div>
        <div
          onClick={() =>
            router.visit(route("student.course.preview", course.id))
          }
          className="flex-1 min-w-0"
        >
          <h3 className="text-sm font-black text-foreground uppercase tracking-wide leading-tight">
            {course.title}
          </h3>
          <p className="text-xs text-primary font-bold mt-0.5">
            By {course.instructor}
          </p>
          <div className="flex items-center gap-2 mt-1.5">
            <div className="flex items-center gap-0.5">
              {[1, 2, 3, 4, 5].map((s) => (
                <svg
                  key={s}
                  className={`w-3 h-3 ${s <= Math.round(course.rating) ? "text-amber-400" : "text-muted-foreground"}`}
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                </svg>
              ))}
              <span className="text-[10px] font-bold text-muted-foreground ml-1">
                {course.rating} ({course.reviews})
              </span>
            </div>
          </div>
        </div>
        <div className="flex-shrink-0 flex flex-col items-end gap-2">
          {hasDiscount ? (
            <div className="flex flex-col items-end">
              <p className="text-xs text-muted-foreground line-through">
                {formatRp(course.price)}
              </p>
              <p className="text-base font-black text-primary">
                {formatRp(finalPrice)}
              </p>
            </div>
          ) : (
            <p className="text-base font-black text-foreground">
              {formatRp(course.price)}
            </p>
          )}

          <div className="flex items-center gap-1.5 mr-4">
            <button
              onClick={() => onToggleCompare(course)}
              disabled={!isSelected && !canAdd}
              className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-200
        ${isSelected ? "bg-primary text-white" : canAdd ? "border border-border text-muted-foreground hover:border-primary/40 hover:text-primary" : "border border-border text-muted-foreground cursor-not-allowed"}`}
            >
              {!isSelected ? (
                <GitCompareArrowsIcon className="w-3.5 h-3.5" />
              ) : (
                <XIcon className="w-3.5 h-3.5" />
              )}
            </button>

            <button
              onClick={() =>
                inCart ? onRemoveFromCart(course.id) : onAddToCart(course)
              }
              className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-200
        ${inCart ? "bg-primary text-white" : "border border-border text-muted-foreground hover:border-primary/40 hover:text-primary"}`}
            >
              {inCart ? (
                <XIcon className="w-3.5 h-3.5" />
              ) : (
                <ShoppingCartIcon className="w-3.5 h-3.5" />
              )}
            </button>
          </div>

          <button
            onClick={() => onCheckout([course])}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary hover:bg-primary-hover text-white shadow-md shadow-primary/20 hover:-translate-y-0.5 transition-all duration-200"
          >
            <CreditCardIcon className="w-3.5 h-3.5" />
            <span className="text-[10px] font-extrabold tracking-widest uppercase">
              Checkout
            </span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`bg-card rounded-2xl overflow-hidden border-2 transition-all duration-200
        ${hovered ? "border-primary/50 shadow-xl shadow-primary/20 -translate-y-1" : "border-border shadow-md"}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Image */}
      <div className="relative h-48 overflow-hidden">
        <Avatar
          onClick={() =>
            router.visit(route("student.course.preview", course.id))
          }
          className="relative w-full h-auto border rounded-xl aspect-square  group"
        >
          {course.thumbnail && (
            <AvatarImage
              src={
                route("files.preview", course.thumbnail) +
                `?v=${new Date(course.updated_at).getTime()}`
              }
              alt={course.title}
            />
          )}
          <AvatarFallback className="rounded-lg">
            <img
              src="/storage/images/logo-default.png"
              alt={course.title}
              className="w-full h-auto object-contain"
            />
          </AvatarFallback>
        </Avatar>
        <div className="absolute bottom-3 left-3 flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((s) => (
            <svg
              key={s}
              className={`w-3 h-3 ${s <= Math.round(course.rating) ? "text-amber-400" : "text-white/30"}`}
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
            </svg>
          ))}
          <span className="text-xs font-black text-white ml-1">
            {course.rating}
          </span>
          <span className="text-xs text-white/60 ml-0.5">
            ({course.reviews})
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="p-5">
        <h3 className="text-sm font-black text-foreground uppercase tracking-tight leading-tight mb-1 line-clamp-2">
          {course.title}
        </h3>
        <p className="text-[10px] font-bold tracking-widest text-primary uppercase mb-2">
          By {course.instructor}
        </p>
        <p className="text-xs text-muted-foreground leading-relaxed mb-4 line-clamp-2">
          {course.description}
        </p>

        <div
          onClick={() =>
            router.visit(route("student.course.preview", course.id))
          }
          className="flex items-center gap-3 text-xs text-muted-foreground mb-4"
        >
          <span className="flex items-center gap-1">
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            {course.total_hours}h ({course.total_sessions} sessions)
          </span>
          {course.certified && (
            <span className="flex items-center gap-1">
              <svg
                className="w-3.5 h-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              Certified
            </span>
          )}
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-border">
          <div>
            <p className="text-[9px] font-bold tracking-[2px] text-muted-foreground uppercase">
              Price
            </p>
            {hasDiscount ? (
              <div className="flex items-center gap-2">
                <p className="text-xs text-muted-foreground line-through">
                  {formatRp(course.price)}
                </p>
                <p className="text-base font-black text-primary">
                  {formatRp(finalPrice)}
                </p>
              </div>
            ) : (
              <p className="text-base font-black text-foreground">
                {formatRp(course.price)}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onToggleCompare(course)}
              disabled={!isSelected && !canAdd}
              className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200
                ${isSelected ? "bg-primary text-white" : canAdd ? "border border-border text-muted-foreground hover:border-primary/40 hover:text-primary" : "border border-border text-muted-foreground cursor-not-allowed"}`}
            >
              {!isSelected ? (
                <GitCompareArrowsIcon className="w-4 h-4" />
              ) : (
                <XIcon className="w-4 h-4" />
              )}
            </button>
            <button
              onClick={() =>
                inCart ? onRemoveFromCart(course.id) : onAddToCart(course)
              }
              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200
    ${
      inCart
        ? "bg-primary text-white"
        : "border border-border text-muted-foreground hover:border-primary/40 hover:text-primary "
    }`}
            >
              {inCart ? (
                <XIcon className="w-4 h-4" />
              ) : (
                <ShoppingCartIcon className="w-4 h-4 " />
              )}
            </button>
            <button
              onClick={() => onCheckout([course])}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-white shadow-md shadow-primary/20 hover:-translate-y-0.5 transition-all duration-200"
              title="Checkout now"
            >
              <CreditCardIcon className="w-4 h-4" />
              <span className="text-[10px] font-extrabold tracking-widest uppercase">
                Checkout
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
