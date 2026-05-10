import { Avatar, AvatarFallback, AvatarImage } from "@/Components/ui/avatar";
import { formatRp } from "../Utils/formatRp";
import { useState } from "react";
export default function CourseCard({
  course,
  inCart,
  onAddToCart,
  onRemoveFromCart,
  viewMode,
}) {
  const [hovered, setHovered] = useState(false);

  if (viewMode === "list") {
    return (
      <div
        className={`bg-white rounded-2xl border-2 flex items-center gap-5 px-5 py-4 transition-all duration-200
          ${hovered ? "border-blue-500 shadow-lg shadow-blue-100 -translate-y-0.5" : "border-gray-100 shadow-sm"}`}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <div className="w-24 h-20 rounded-xl overflow-hidden flex-shrink-0">
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
            <AvatarFallback className="rounded-lg">
              <img
                src="/storage/images/logo-default.png"
                alt={course.title}
                className="w-full h-full object-contain"
              />
            </AvatarFallback>
          </Avatar>
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-black text-gray-800 uppercase tracking-wide leading-tight">
            {course.title}
          </h3>
          <p className="text-xs text-blue-500 font-bold mt-0.5">
            By {course.instructor}
          </p>
          <div className="flex items-center gap-2 mt-1.5">
            <div className="flex items-center gap-0.5">
              {[1, 2, 3, 4, 5].map((s) => (
                <svg
                  key={s}
                  className={`w-3 h-3 ${s <= Math.round(course.rating) ? "text-amber-400" : "text-gray-200"}`}
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                </svg>
              ))}
              <span className="text-[10px] font-bold text-gray-400 ml-1">
                {course.rating} ({course.reviews})
              </span>
            </div>
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-base font-black text-gray-800">
            {formatRp(course.price)}
          </p>
          <button
            onClick={() =>
              inCart ? onRemoveFromCart(course.id) : onAddToCart(course)
            }
            className={`mt-2 flex items-center gap-1.5 px-4 py-2 text-[10px] font-extrabold tracking-widest uppercase rounded-xl transition-all duration-200
              ${
                inCart
                  ? "border-2 border-blue-200 text-blue-600 hover:bg-blue-50"
                  : "bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-200"
              }`}
          >
            {inCart ? "In Cart ✓" : "Add to Cart"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`bg-white rounded-2xl overflow-hidden border-2 transition-all duration-200
        ${hovered ? "border-blue-500 shadow-xl shadow-blue-100 -translate-y-1" : "border-gray-100 shadow-md"}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Image */}
      <div className="relative h-100 overflow-hidden">
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
        <h3 className="text-sm font-black text-gray-800 uppercase tracking-tight leading-tight mb-1 line-clamp-2">
          {course.title}
        </h3>
        <p className="text-[10px] font-bold tracking-widest text-blue-500 uppercase mb-2">
          By {course.instructor}
        </p>
        <p className="text-xs text-gray-500 leading-relaxed mb-4 line-clamp-2">
          {course.description}
        </p>

        <div className="flex items-center gap-3 text-xs text-gray-400 mb-4">
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

        <div className="flex items-center justify-between pt-3 border-t border-gray-100">
          <div>
            <p className="text-[9px] font-bold tracking-[2px] text-gray-400 uppercase">
              Price
            </p>
            <p className="text-base font-black text-gray-800">
              {formatRp(course.price)}
            </p>
          </div>
          <button
            onClick={() =>
              inCart ? onRemoveFromCart(course.id) : onAddToCart(course)
            }
            className={`flex items-center gap-1.5 px-4 py-2.5 text-[10px] font-extrabold tracking-widest uppercase rounded-xl transition-all duration-200
              ${
                inCart
                  ? "border-2 border-blue-200 text-blue-600 bg-blue-50 hover:bg-blue-100"
                  : "bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-200 hover:-translate-y-0.5"
              }`}
          >
            {inCart ? (
              <>
                <svg
                  className="w-3.5 h-3.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                In Cart
              </>
            ) : (
              <>
                <svg
                  className="w-3.5 h-3.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
                  />
                </svg>
                Add to Cart
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
