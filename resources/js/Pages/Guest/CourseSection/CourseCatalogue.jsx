// resources/js/Pages/Guest/TrainingCatalogue.jsx

import { useEffect, useMemo, useState } from "react";
import GuestLayout from "@/Layouts/GuestLayout";
import Link from "@/Components/Link";
import { router } from "@inertiajs/react";
import { Avatar, AvatarFallback, AvatarImage } from "@/Components/ui/avatar";
import { GitCompareArrowsIcon, PlusIcon, XIcon } from "lucide-react";
import { cn, formatRp } from "@/lib/utils";

function StarRating({ rating = 0, size = "w-4 h-4" }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <svg
          key={s}
          className={`${size} ${s <= Math.round(rating) ? "text-amber-400" : "text-muted-foreground"}`}
          fill="currentColor"
          viewBox="0 0 24 24"
        >
          <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
        </svg>
      ))}
    </div>
  );
}

// Warna thumbnail otomatis karena tidak ada image dari controller
const thumbColors = [
  "from-gray-700 to-gray-900",
  "from-primary to-primary",
  "from-green-600 to-green-800",
  "from-violet-600 to-violet-900",
  "from-teal-500 to-teal-700",
  "from-orange-500 to-orange-700",
  "from-rose-500 to-rose-700",
  "from-slate-400 to-slate-600",
];

const levelColor = {
  beginner: "bg-green-500",
  intermediate: "bg-amber-500",
  advanced: "bg-red-500",
};

// ── Compare Page ──────────────────────────────────────────────────────────────
function TrainingCompare({ selected, onBack }) {
  const threeCol = selected.length === 3;
  const cols = threeCol ? "grid-cols-3" : "grid-cols-2";

  return (
    <GuestLayout>
      <div className="min-h-screen bg-muted">
        <div className="max-w-6xl mx-auto px-6 py-12">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-xs font-bold tracking-widest text-muted-foreground uppercase hover:text-foreground transition-colors mb-8"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M10 19l-7-7m0 0l7-7m-7 7h18"
              />
            </svg>
            Back to Catalogue
          </button>

          <h1 className="text-5xl font-black text-foreground uppercase tracking-tight mb-2">
            Compare Trainings
          </h1>
          <p className="text-base text-muted-foreground mb-10">
            Analyze side-by-side and choose the path that best fits your career
            goals.
          </p>

          <div className="bg-card rounded-3xl border border-border shadow-sm overflow-hidden">
            {/* Header */}
            <div className={`grid border-b border-border ${cols}`}>
              {selected.map((course, i) => (
                <div
                  key={course.id}
                  className={`px-8 py-8 ${i > 0 ? "border-l border-border" : ""}`}
                >
                  <span className="text-[10px] font-extrabold tracking-[2px] text-primary uppercase block mb-3">
                    {course.categories?.[0] ?? "General"}
                  </span>
                  <h3 className="text-lg font-black text-foreground uppercase tracking-tight leading-tight mb-2">
                    {course.title}
                  </h3>
                  <p className="text-[10px] font-bold tracking-[2px] text-primary uppercase mb-3">
                    By {course.instructor}
                  </p>
                  <div className="mb-5">
                    <p className="text-[10px] font-bold tracking-[2px] text-muted-foreground uppercase mb-1">
                      Investment
                    </p>
                    <p className="text-3xl font-black text-primary">
                      {formatRp(course.price)}
                    </p>
                  </div>
                  <button
                    onClick={() =>
                      router.visit(route("guest.training.preview", course.id))
                    }
                    className="w-full bg-primary hover:bg-primary-hover text-white font-extrabold tracking-widest uppercase text-xs py-4 rounded-xl shadow-md shadow-primary/20 transition-all duration-200"
                  >
                    View Details
                  </button>
                </div>
              ))}
            </div>

            {/* Description */}
            <div className={`grid border-b border-border ${cols}`}>
              {selected.map((course, i) => (
                <div
                  key={course.id}
                  className={`px-8 py-6 ${i > 0 ? "border-l border-border" : ""}`}
                >
                  <p className="text-[10px] font-bold tracking-[2px] text-muted-foreground uppercase mb-3">
                    Description
                  </p>
                  <p className="text-sm text-foreground leading-relaxed">
                    {course.description}
                  </p>
                </div>
              ))}
            </div>

            {/* Level */}
            <div className={`grid border-b border-border ${cols}`}>
              {selected.map((course, i) => (
                <div
                  key={course.id}
                  className={`px-8 py-5 ${i > 0 ? "border-l border-border" : ""}`}
                >
                  <p className="text-[10px] font-bold tracking-[2px] text-muted-foreground uppercase mb-3">
                    Level
                  </p>
                  <span className="text-xs font-extrabold tracking-widest uppercase px-3 py-1.5 bg-primary-soft text-primary rounded-lg capitalize">
                    {course.level}
                  </span>
                </div>
              ))}
            </div>

            {/* Duration */}
            <div className={`grid border-b border-border ${cols}`}>
              {selected.map((course, i) => (
                <div
                  key={course.id}
                  className={`px-8 py-5 flex items-center justify-between ${i > 0 ? "border-l border-border" : ""}`}
                >
                  <p className="text-[10px] font-bold tracking-[2px] text-muted-foreground uppercase">
                    Duration
                  </p>
                  <p className="text-sm font-black text-foreground">
                    {course.total_hours}h ({course.total_sessions} Sessions)
                  </p>
                </div>
              ))}
            </div>

            {/* Certificate */}
            <div className={`grid border-b border-border ${cols}`}>
              {selected.map((course, i) => (
                <div
                  key={course.id}
                  className={`px-8 py-5 flex items-center justify-between ${i > 0 ? "border-l border-border" : ""}`}
                >
                  <p className="text-[10px] font-bold tracking-[2px] text-muted-foreground uppercase">
                    Certificate
                  </p>
                  <p className="text-sm font-black text-foreground">
                    {course.certificate_type ?? "-"}
                  </p>
                </div>
              ))}
            </div>

            {/* Price */}
            <div className={`grid ${cols}`}>
              {selected.map((course, i) => (
                <div
                  key={course.id}
                  className={`px-8 py-6 flex items-center justify-between ${i > 0 ? "border-l border-border" : ""}`}
                >
                  <p className="text-[10px] font-bold tracking-[2px] text-muted-foreground uppercase">
                    Total Price
                  </p>
                  <div className="flex flex-col text-2xl font-black text-primary">
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
                      <span className="font-black text-primary">
                        {course.discount_type === "percentage"
                          ? formatRp(
                              course.price -
                                (course.price * course.discount) / 100,
                            )
                          : formatRp(course.price - course.discount)}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </GuestLayout>
  );
}

// ── Course Card ────────────────────────────────────────────────────────────────
function CourseCard({
  course,
  index,
  isSelected,
  onToggleCompare,
  compareCount,
  viewMode,
}) {
  const [hovered, setHovered] = useState(false);
  const canAdd = !isSelected && compareCount < 3;
  const color = thumbColors[index % thumbColors.length];
  const levelKey = course.level?.toLowerCase();
  const levelBg = levelColor[levelKey] ?? "bg-gray-400";
  const DEFAULT_THUMB = "images/logo-default.png";

  const goToDetail = () =>
    router.visit(route("guest.training.preview", course.id));

  if (viewMode === "list") {
    return (
      <div
        className={`bg-card rounded-2xl border-2 flex items-center gap-5 px-5 py-4 transition-all duration-200
          ${hovered ? "border-primary/50 shadow-lg shadow-primary/20 -translate-y-0.5" : "border-border shadow-sm"}`}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {/* Thumbnail */}
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
                className="w-full h-full object-fill"
              />
            </AvatarFallback>
          </Avatar>
          <span className="text-white text-[9px] font-black opacity-40 uppercase tracking-widest text-center px-1">
            {course.categories?.[0] ?? ""}
          </span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span
              className={`text-[9px] font-black text-white px-2 py-0.5 rounded-md capitalize ${levelBg}`}
            >
              {course.level}
            </span>
            {course.certificate_type && (
              <span className="text-[9px] font-black text-muted-foreground bg-muted px-2 py-0.5 rounded-md">
                {course.certificate_type}
              </span>
            )}
          </div>
          <h3 className="text-sm font-black text-foreground uppercase tracking-wide truncate">
            {course.title}
          </h3>
          <p className="text-xs text-primary font-bold mt-0.5">
            By {course.instructor}
          </p>
          <div className="flex items-center gap-2 mt-1.5">
            <StarRating rating={course.rating} size="w-3 h-3" />
            <span className="text-xs text-muted-foreground">
              {course.total_hours}h • {course.total_sessions} sesi
            </span>
          </div>
        </div>

        <div className="text-right flex-shrink-0">
          <div className="flex flex-col text-base font-black text-foreground">
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
              <span className="font-black text-primary">
                {course.discount_type === "percentage"
                  ? formatRp(
                      course.price - (course.price * course.discount) / 100,
                    )
                  : formatRp(course.price - course.discount)}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-2">
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
              onClick={goToDetail}
              className="px-4 py-2 text-xs font-extrabold tracking-widest uppercase bg-primary hover:bg-primary-hover text-white rounded-xl transition-colors"
            >
              View Details
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Grid view
  return (
    <div
      className={`flex flex-col bg-card rounded-2xl overflow-hidden border-2 transition-all duration-200
        ${hovered ? "border-primary/50 shadow-xl shadow-primary/20 -translate-y-1" : "border-border shadow-md"}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Thumbnail */}
      <div className="relative h-69 rounded-xl overflow-hidden flex-shrink-0 bg-gradient-to-br from-primary to-indigo-700">
        <Avatar className="relative w-full h-full border rounded-xl aspect-square  group">
          {course.thumbnail && (
            <AvatarImage
              src={
                route("files.preview", course.thumbnail) +
                `?v=${new Date(course.updated_at).getTime()}`
              }
              alt={course.name}
            />
          )}
          <AvatarFallback className="rounded-lg ">
            <img
              src="/storage/images/logo-default.png"
              alt={course.title}
              className="w-full h-full object-contain"
            />
          </AvatarFallback>
        </Avatar>
        <div className="absolute top-3 left-3 flex items-center gap-1.5 flex-wrap">
          <span
            className={`px-3 py-1 rounded-full text-[10px] font-extrabold tracking-widest uppercase text-white ${levelBg}`}
          >
            {course.level}
          </span>
          {course.categories?.slice(0, 1).map((cat) => (
            <span
              key={cat}
              className="px-3 py-1 rounded-full text-[10px] font-extrabold tracking-widest uppercase bg-card/20 backdrop-blur-sm text-white"
            >
              {cat}
            </span>
          ))}
        </div>
        <div className="absolute bottom-3 left-3 flex items-center gap-1.5">
          <StarRating rating={course.rating} size="w-3.5 h-3.5" />
          <span className="text-xs font-black text-white">
            {course.rating ?? "-"}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="grid grid-col-1 content-between p-5 h-full">
        <div>
          <h3 className="text-base font-black text-foreground uppercase tracking-tight leading-tight mb-1">
            {course.title}
          </h3>
          <p className="text-[10px] font-bold tracking-widest text-primary uppercase mb-2">
            By {course.instructor}
          </p>
          <p className="text-xs text-muted-foreground leading-relaxed mb-4 line-clamp-2">
            {course.description}
          </p>
        </div>

        <div>
          <div className="flex items-center gap-4 text-xs text-muted-foreground mb-5">
            <span className="flex items-center gap-1.5">
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
              {course.total_hours} Hours ({course.total_sessions} Sessions)
            </span>
            {course.certificate_type && (
              <span className="flex items-center gap-1.5">
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
                    d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"
                  />
                </svg>
                {course.certificate_type}
              </span>
            )}
          </div>
          <div className="flex items-center justify-between">
            <div>
              <div className="flex flex-col text-lg font-black text-foreground">
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
                  <span className="font-black text-primary">
                    {course.discount_type === "percentage"
                      ? formatRp(
                          course.price - (course.price * course.discount) / 100,
                        )
                      : formatRp(course.price - course.discount)}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => onToggleCompare(course)}
                disabled={!isSelected && !canAdd}
                title={
                  isSelected
                    ? "Remove from compare"
                    : canAdd
                      ? "Add to compare"
                      : "Maximum 3 courses"
                }
                className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200
                ${isSelected ? "bg-primary text-white shadow-md shadow-primary/20" : canAdd ? "border-2 border-border text-muted-foreground hover:border-primary/40 hover:text-primary" : "border-2 border-border text-muted-foreground cursor-not-allowed"}`}
              >
                {!isSelected ? (
                  <GitCompareArrowsIcon className="w-4 h-4" />
                ) : (
                  <XIcon className="w-4 h-4" />
                )}
              </button>
              <button
                onClick={goToDetail}
                className="px-4 py-2.5 text-xs font-extrabold tracking-widest uppercase bg-primary hover:bg-primary-hover text-white rounded-xl shadow-md shadow-primary/20 hover:-translate-y-0.5 transition-all duration-200"
              >
                View Details
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Filter Sidebar ─────────────────────────────────────────────────────────────
function FilterSidebar({ categories, activeFilters, onFilter, onReset }) {
  const levels = ["Beginner", "Intermediate", "Advanced"];
  const certTypes = ["Professional", "Competency", "Attendance"];

  const CheckItem = ({ label, filterKey, value }) => {
    const active = activeFilters[filterKey] === value;
    return (
      <button
        type="button"
        onClick={() => onFilter(filterKey, active ? "" : value)}
        className="flex w-full items-center gap-2.5 cursor-pointer group select-none text-left"
      >
        <div
          className={`w-4 h-4 rounded flex items-center justify-center transition-all duration-300 ease-out flex-shrink-0
            ${active ? "bg-primary scale-105 shadow-sm shadow-primary/30" : "border-2 border-border group-hover:border-primary/40"}`}
        >
          <svg
            className={`w-2.5 h-2.5 text-white transition-all duration-300 ease-out ${active ? "opacity-100 scale-100" : "opacity-0 scale-75"}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={3}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>
        <span
          className={`text-sm transition-all duration-200 ${active ? "font-bold text-foreground translate-x-0.5" : "text-foreground group-hover:text-foreground"}`}
        >
          {label}
        </span>
      </button>
    );
  };

  return (
    <div className="bg-card rounded-2xl border border-border shadow-sm p-6 transition-all duration-300 hover:shadow-md max-h-[calc(100vh-8rem)] overflow-y-auto">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xs font-extrabold tracking-[2px] text-foreground uppercase">
          Filters
        </h3>
        <svg
          className="w-4 h-4 text-muted-foreground"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z"
          />
        </svg>
      </div>

      {/* Category — dari DB */}
      <div className="mb-6">
        <p className="text-[10px] font-extrabold tracking-[2px] text-muted-foreground uppercase mb-3">
          Category
        </p>
        <div className="flex flex-col gap-2">
          {categories.map((cat) => (
            <CheckItem
              key={cat.slug}
              label={cat.name}
              filterKey="category"
              value={cat.slug}
            />
          ))}
        </div>
      </div>

      {/* Level */}
      <div className="mb-6">
        <p className="text-[10px] font-extrabold tracking-[2px] text-muted-foreground uppercase mb-3">
          Level
        </p>
        <div className="flex flex-col gap-2">
          {levels.map((l) => (
            <CheckItem
              key={l}
              label={l}
              filterKey="level"
              value={l.toLowerCase()}
            />
          ))}
        </div>
      </div>

      {/* Certification */}
      <div className="mb-6">
        <p className="text-[10px] font-extrabold tracking-[2px] text-muted-foreground uppercase mb-3">
          Certification
        </p>
        <div className="flex flex-col gap-2">
          {certTypes.map((c) => (
            <CheckItem key={c} label={c} filterKey="certification" value={c} />
          ))}
        </div>
      </div>

      <button
        onClick={onReset}
        className="w-full py-2.5 text-xs font-extrabold tracking-widest uppercase border-2 border-border rounded-xl text-muted-foreground hover:bg-muted transition-colors"
      >
        Clear All
      </button>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
// Props: courses, categories, filters — dari TrainingController@index
export default function TrainingCatalogue({
  courses = [],
  categories = [],
  filters: initialFilters = {},
}) {
  const [viewMode, setViewMode] = useState("grid");
  const [search, setSearch] = useState(initialFilters.search ?? "");
  const [compareList, setCompareList] = useState([]);
  const [showCompare, setShowCompare] = useState(false);
  const DEFAULT_THUMBNAIL = "/storage/images/logo-default.png";

  const [activeFilters, setActiveFilters] = useState({
    search: initialFilters.search ?? "",
    level: initialFilters.level ?? "",
    category: initialFilters.category ?? "",
    certification: initialFilters.certification ?? "",
  });

  const replaceQueryWithoutReload = (filters) => {
    const params = new URLSearchParams();

    Object.entries(filters).forEach(([key, value]) => {
      const normalizedValue = String(value ?? "").trim();
      if (normalizedValue !== "") {
        params.set(key, normalizedValue);
      }
    });

    const baseUrl = route("guest.training");
    const query = params.toString();
    const nextUrl = query === "" ? baseUrl : `${baseUrl}?${query}`;
    window.history.replaceState({}, "", nextUrl);
  };

  const applyFilter = (key, value) => {
    setActiveFilters((previousFilters) => {
      const nextFilters = { ...previousFilters, [key]: value };
      replaceQueryWithoutReload(nextFilters);

      return nextFilters;
    });
  };

  const handleSearch = () => {
    applyFilter("search", search);
  };

  const resetFilters = () => {
    const empty = { search: "", level: "", category: "", certification: "" };
    setSearch("");
    setActiveFilters(empty);
    replaceQueryWithoutReload(empty);
  };

  useEffect(() => {
    const normalizedSearch = String(search ?? "").trim();
    const normalizedActiveSearch = String(activeFilters.search ?? "").trim();

    if (normalizedSearch === normalizedActiveSearch) {
      return;
    }

    const debounceTimer = window.setTimeout(() => {
      applyFilter("search", normalizedSearch);
    }, 350);

    return () => {
      window.clearTimeout(debounceTimer);
    };
  }, [search, activeFilters.search]);

  const filteredCourses = useMemo(() => {
    const normalizedSearch = String(activeFilters.search ?? "")
      .trim()
      .toLowerCase();
    const normalizedLevel = String(activeFilters.level ?? "")
      .trim()
      .toLowerCase();
    const normalizedCertification = String(activeFilters.certification ?? "")
      .trim()
      .toLowerCase();
    const selectedCategoryName = categories.find(
      (category) => category.slug === activeFilters.category,
    )?.name;
    const normalizedCategoryName = String(selectedCategoryName ?? "")
      .trim()
      .toLowerCase();

    return courses.filter((course) => {
      const level = String(course.level ?? "")
        .trim()
        .toLowerCase();
      const certification = String(course.certificate_type ?? "")
        .trim()
        .toLowerCase();
      const courseCategories = (course.categories ?? []).map((categoryName) =>
        String(categoryName).trim().toLowerCase(),
      );
      const searchableText = [
        course.title,
        course.description,
        course.instructor,
        ...(course.categories ?? []),
      ]
        .map((value) => String(value ?? "").toLowerCase())
        .join(" ");

      if (normalizedLevel !== "" && level !== normalizedLevel) {
        return false;
      }

      if (
        normalizedCategoryName !== "" &&
        !courseCategories.includes(normalizedCategoryName)
      ) {
        return false;
      }

      if (
        normalizedCertification !== "" &&
        certification !== normalizedCertification
      ) {
        return false;
      }

      if (normalizedSearch !== "" && !searchableText.includes(normalizedSearch)) {
        return false;
      }

      return true;
    });
  }, [activeFilters, categories, courses]);

  const toggleCompare = (course) => {
    setCompareList((prev) => {
      const exists = prev.find((c) => c.id === course.id);
      if (exists) return prev.filter((c) => c.id !== course.id);
      if (prev.length >= 3) return prev;
      return [...prev, course];
    });
  };

  if (showCompare) {
    return (
      <TrainingCompare
        selected={compareList}
        onBack={() => setShowCompare(false)}
      />
    );
  }

  return (
    <GuestLayout>
      <div className="min-h-screen bg-muted">
        <div className="max-w-7xl mx-auto px-6 py-10">
          {/* ── Hero ── */}
          <div className="text-center mb-10">
            <h1 className="text-5xl font-black text-foreground uppercase tracking-tight mb-4">
              Training Catalogue
            </h1>
            <p className="text-base text-muted-foreground mb-8 max-w-xl mx-auto">
              Explore professional certifications and upscale your engineering
              career with INKINDO standards.
            </p>
            <div className="flex items-center gap-3 max-w-2xl mx-auto bg-card rounded-2xl border border-border shadow-sm px-5 py-3">
              <svg
                className="w-5 h-5 text-muted-foreground flex-shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <input
                type="text"
                placeholder="Search trainings, instructors, or keywords..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="flex-1 text-sm text-foreground placeholder-muted-foreground focus:outline-none bg-transparent"
              />
              <button
                onClick={handleSearch}
                className="bg-primary hover:bg-primary-hover text-white text-xs font-extrabold tracking-widest uppercase px-6 py-2.5 rounded-xl transition-colors flex-shrink-0"
              >
                Search
              </button>
            </div>
          </div>

          <div className="flex gap-7 items-start">
            {/* ── Sidebar ── */}
            <aside className="w-64 flex-shrink-0 self-start sticky top-28">
              <FilterSidebar
                categories={categories}
                activeFilters={activeFilters}
                onFilter={applyFilter}
                onReset={resetFilters}
              />
            </aside>

            {/* ── Main Content ── */}
            <div className="flex-1 min-w-0">
              {/* Results bar */}
              <div className="bg-card rounded-2xl border border-border shadow-sm px-5 py-3.5 flex items-center justify-between mb-5">
                <p className="text-xs font-extrabold tracking-[2px] text-muted-foreground uppercase">
                  <span className="text-primary">{filteredCourses.length}</span>{" "}
                  Results
                  Found
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setViewMode("grid")}
                    className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${viewMode === "grid" ? "bg-primary text-white" : "text-muted-foreground hover:bg-muted"}`}
                  >
                    <svg
                      className="w-4 h-4"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M3 3h7v7H3zm11 0h7v7h-7zM3 14h7v7H3zm11 0h7v7h-7z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => setViewMode("list")}
                    className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${viewMode === "list" ? "bg-primary text-white" : "text-muted-foreground hover:bg-muted"}`}
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M4 6h16M4 12h16M4 18h16"
                      />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Cards */}
              {filteredCourses.length > 0 ? (
                <div
                  className={
                    viewMode === "grid"
                      ? "grid grid-cols-2 gap-5"
                      : "flex flex-col gap-4"
                  }
                >
                  {filteredCourses.map((course, index) => (
                    <CourseCard
                      key={course.id}
                      course={course}
                      index={index}
                      isSelected={compareList.some((c) => c.id === course.id)}
                      onToggleCompare={toggleCompare}
                      compareCount={compareList.length}
                      viewMode={viewMode}
                    />
                  ))}
                </div>
              ) : (
                <div className="bg-card rounded-2xl border border-border py-20 flex flex-col items-center gap-3">
                  <svg
                    className="w-12 h-12 text-muted-foreground"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                    Tidak ada kelas ditemukan
                  </p>
                  <button
                    onClick={resetFilters}
                    className="text-xs font-black text-primary hover:text-primary uppercase tracking-widest"
                  >
                    Reset Filter
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Compare Floating Bar ── */}
        {compareList.length > 0 && (
          <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-40">
            <div
              className="flex items-center gap-4 px-6 py-4 rounded-2xl shadow-2xl"
              style={{
                background:
                  "linear-gradient(135deg, #0f172a 60%, #1e3a8a 100%)",
              }}
            >
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-xl bg-primary flex items-center justify-center">
                  <span className="text-xs font-black text-white">
                    {compareList.length}
                  </span>
                </div>
                <span className="text-sm font-extrabold tracking-widest text-white uppercase">
                  Compare Selected Trainings
                </span>
              </div>
              <div className="flex items-center gap-2">
                {compareList.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center gap-1.5 bg-card/10 rounded-xl px-3 py-1.5"
                  >
                    <span className="text-xs font-bold text-white/80 truncate max-w-24">
                      {c.title.split(" ").slice(0, 3).join(" ")}...
                    </span>
                    <button
                      onClick={() => toggleCompare(c)}
                      className="text-white/50 hover:text-white transition-colors"
                    >
                      <svg
                        className="w-3 h-3"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2.5}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
              <button
                onClick={() => setShowCompare(true)}
                disabled={compareList.length < 2}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-extrabold tracking-widest uppercase transition-all duration-200
                  ${compareList.length >= 2 ? "bg-primary hover:bg-primary-hover text-white hover:-translate-y-0.5" : "bg-card/10 text-white/40 cursor-not-allowed"}`}
              >
                Compare Now
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M13 7l5 5m0 0l-5 5m5-5H6"
                  />
                </svg>
              </button>
            </div>
          </div>
        )}
      </div>
    </GuestLayout>
  );
}
