import { useState } from "react";
import GuestLayout from "@/Layouts/GuestLayout";
import Link from "@/Components/Link";

// ── Data ──────────────────────────────────────────────────────────────────────
const ALL_COURSES = [
  {
    id: 1,
    title: "ADVANCED PROJECT PLANNING & CONTROL (PPC)",
    author: "Ir. Ahmad Sudirman, MT.",
    category: "Management",
    type: "Online",
    level: "Advanced",
    certification: "Professional",
    desc: "Master the arts of scheduling, cost estimation, and risk management using modern BIM tools and industrial standards.",
    hours: 24,
    sessions: 8,
    price: "2,500,000",
    rating: 4.9,
    reviews: 128,
    image: "bg-gradient-to-br from-gray-700 via-slate-600 to-gray-800",
  },
  {
    id: 2,
    title: "BIM MANAGEMENT FOR STRUCTURAL DESIGN",
    author: "Dr. Siti Aminah",
    category: "Structural",
    type: "Hybrid",
    level: "Intermediate",
    certification: "Certified",
    desc: "Comprehensive training for BIM integration in structural engineering workflows, including Revit and Tekla mastery.",
    hours: 32,
    sessions: 12,
    price: "3,200,000",
    rating: 4.8,
    reviews: 256,
    image: "bg-gradient-to-br from-slate-400 via-slate-300 to-gray-400",
  },
  {
    id: 3,
    title: "GREEN BUILDING CERTIFICATION PREP",
    author: "Budi Setiawan, LEED AP",
    category: "Architecture",
    type: "Online",
    level: "Beginner",
    certification: "Professional",
    desc: "Prepare for LEED and GREENSHIP certification with comprehensive sustainability design modules.",
    hours: 20,
    sessions: 8,
    price: "1,800,000",
    rating: 4.7,
    reviews: 98,
    image: "bg-gradient-to-br from-green-700 via-emerald-600 to-green-800",
  },
  {
    id: 4,
    title: "CIVIL ENGINEERING FUNDAMENTALS",
    author: "Prof. Rahmat Hidayat",
    category: "Civil",
    type: "Offline",
    level: "Beginner",
    certification: "Attendance",
    desc: "Core civil engineering principles covering soil mechanics, hydrology, and infrastructure design.",
    hours: 16,
    sessions: 6,
    price: "1,200,000",
    rating: 4.6,
    reviews: 312,
    image: "bg-gradient-to-br from-orange-700 via-amber-600 to-orange-800",
  },
  {
    id: 5,
    title: "LEGAL ASPECTS OF CONSTRUCTION CONTRACTS",
    author: "Dr. Hendra Wijaya, SH.",
    category: "Legal",
    type: "Online",
    level: "Intermediate",
    certification: "Competency",
    desc: "Understand Indonesian construction law, contract management, and dispute resolution mechanisms.",
    hours: 12,
    sessions: 4,
    price: "950,000",
    rating: 4.5,
    reviews: 74,
    image: "bg-gradient-to-br from-blue-800 via-blue-700 to-indigo-800",
  },
  {
    id: 6,
    title: "STRUCTURAL ANALYSIS WITH SAP2000",
    author: "Ir. Dewi Kartika, MT.",
    category: "Structural",
    type: "Hybrid",
    level: "Advanced",
    certification: "Professional",
    desc: "Advanced structural modeling and analysis using SAP2000 for high-rise and bridge projects.",
    hours: 40,
    sessions: 16,
    price: "4,500,000",
    rating: 4.9,
    reviews: 189,
    image: "bg-gradient-to-br from-purple-700 via-violet-600 to-purple-800",
  },
];

// ── Stars ─────────────────────────────────────────────────────────────────────
function Stars({ rating }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <svg
          key={i}
          className={`w-3.5 h-3.5 ${i <= Math.round(rating) ? "text-yellow-400 fill-yellow-400" : "text-gray-300 fill-gray-300"}`}
          viewBox="0 0 20 20"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  );
}

// ── Badge ─────────────────────────────────────────────────────────────────────
function Badge({ label, variant = "dark" }) {
  const styles = {
    dark: "bg-gray-900/80 text-white",
    blue: "bg-blue-600 text-white",
    outline: "bg-white/20 text-white border border-white/40",
  };
  return (
    <span
      className={`text-[9px] font-bold tracking-widest uppercase px-2.5 py-1 rounded-full backdrop-blur-sm ${styles[variant]}`}
    >
      {label}
    </span>
  );
}

// ── Course Card ───────────────────────────────────────────────────────────────
function CourseCard({ course, view }) {
  const [liked, setLiked] = useState(false);

  if (view === "list") {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 hover:shadow-md hover:border-blue-200 transition-all duration-300 flex overflow-hidden group">
        <div className={`w-48 shrink-0 ${course.image} relative`}>
          <div className="absolute top-3 left-3 flex gap-1.5">
            <Badge label={course.type} variant="dark" />
            <Badge label={course.level} variant="blue" />
          </div>
        </div>
        <div className="p-5 flex flex-col flex-1">
          <h3 className="font-black text-sm text-gray-900 group-hover:text-blue-600 transition-colors mb-1">
            {course.title}
          </h3>
          <p className="text-[10px] font-bold tracking-widest text-blue-600 uppercase mb-2">
            BY {course.author}
          </p>
          <p className="text-gray-400 text-xs leading-relaxed flex-1 mb-3">
            {course.desc}
          </p>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[9px] text-gray-400 uppercase tracking-widest font-semibold mb-0.5">
                INVESTMENT
              </p>
              <p className="text-blue-600 font-black text-base">
                Rp {course.price}
              </p>
            </div>
            <Link
              href="#"
              className="bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold tracking-widest uppercase px-5 py-2.5 rounded-lg transition-colors"
            >
              VIEW DETAILS
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 hover:shadow-md hover:border-blue-200 transition-all duration-300 overflow-hidden flex flex-col group">
      {/* Image */}
      <div className={`relative h-52 overflow-hidden ${course.image}`}>
        <div className="absolute top-3 left-3 flex gap-1.5">
          <Badge label={course.type} variant="dark" />
          <Badge label={course.level} variant="blue" />
        </div>
        <button
          onClick={() => setLiked((l) => !l)}
          className="absolute top-3 right-3 w-8 h-8 bg-white/90 hover:bg-white rounded-full flex items-center justify-center shadow transition-all"
        >
          <svg
            className={`w-4 h-4 ${liked ? "fill-red-500 text-red-500" : "text-gray-400"}`}
            fill={liked ? "currentColor" : "none"}
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
            />
          </svg>
        </button>
        {/* Rating overlay */}
        <div className="absolute bottom-3 left-3 flex items-center gap-1.5">
          <Stars rating={course.rating} />
          <span className="text-white text-[10px] font-bold drop-shadow">
            {course.rating} ({course.reviews})
          </span>
        </div>
      </div>

      {/* Body */}
      <div className="p-5 flex flex-col flex-1">
        <h3 className="font-black text-sm text-gray-900 group-hover:text-blue-600 transition-colors leading-tight mb-1">
          {course.title}
        </h3>
        <p className="text-[10px] font-bold tracking-widest text-blue-600 uppercase mb-3">
          BY {course.author}
        </p>
        <p className="text-gray-400 text-xs leading-relaxed flex-1 mb-4">
          {course.desc}
        </p>

        {/* Meta */}
        <div className="flex items-center gap-3 text-[11px] text-gray-400 mb-4">
          <span className="flex items-center gap-1">
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M12 6v6l4 2" />
            </svg>
            {course.hours} Hours ({course.sessions} Sessions)
          </span>
          <span className="flex items-center gap-1">
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
            </svg>
            {course.certification}
          </span>
        </div>

        {/* Price + CTA */}
        <div className="flex items-center justify-between pt-3 border-t border-gray-100">
          <div>
            <p className="text-[9px] text-gray-400 uppercase tracking-widest font-semibold mb-0.5">
              INVESTMENT
            </p>
            <p className="text-blue-600 font-black text-base">
              Rp {course.price}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button className="w-8 h-8 rounded-full border border-gray-200 hover:border-blue-400 flex items-center justify-center text-gray-400 hover:text-blue-500 transition-colors">
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M12 4v16m8-8H4" />
              </svg>
            </button>
            <Link
              href="#"
              className="bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold tracking-widest uppercase px-4 py-2.5 rounded-lg transition-colors"
            >
              VIEW DETAILS
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function FilterSidebar({ filters, setFilters, onClear }) {
  const toggle = (key, val) => {
    setFilters((prev) => ({
      ...prev,
      [key]: prev[key].includes(val)
        ? prev[key].filter((v) => v !== val)
        : [...prev[key], val],
    }));
  };

  const FilterGroup = ({ label, groupKey, options }) => (
    <div className="mb-6">
      <p className="text-[10px] font-black tracking-widest uppercase text-gray-500 mb-3">
        {label}
      </p>
      <ul className="space-y-2">
        {options.map((opt) => (
          <li
            key={opt}
            className="flex items-center gap-2 cursor-pointer group"
            onClick={() => toggle(groupKey, opt)}
          >
            <div
              className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors shrink-0 ${
                filters[groupKey].includes(opt)
                  ? "bg-blue-600 border-blue-600"
                  : "border-gray-300 group-hover:border-blue-400"
              }`}
            >
              {filters[groupKey].includes(opt) && (
                <svg
                  className="w-2.5 h-2.5 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="3"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              )}
            </div>
            <span
              className={`text-xs transition-colors ${
                filters[groupKey].includes(opt)
                  ? "text-blue-600 font-semibold"
                  : "text-gray-600 group-hover:text-gray-900"
              }`}
            >
              {opt}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
      <div className="flex items-center justify-between mb-6">
        <p className="text-[11px] font-black tracking-widest uppercase text-gray-700">
          FILTERS
        </p>
        <svg
          className="w-4 h-4 text-gray-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3 4h18M7 8h10M11 12h4"
          />
        </svg>
      </div>
      <FilterGroup
        label="CATEGORY"
        groupKey="category"
        options={["Civil", "Structural", "Architecture", "Management", "Legal"]}
      />
      <FilterGroup
        label="TRAINING TYPE"
        groupKey="type"
        options={["Online", "Offline", "Hybrid"]}
      />
      <FilterGroup
        label="LEVEL"
        groupKey="level"
        options={["Beginner", "Intermediate", "Advanced"]}
      />
      <FilterGroup
        label="CERTIFICATION"
        groupKey="certification"
        options={["Professional", "Competency", "Attendance"]}
      />
      <button
        onClick={onClear}
        className="w-full text-[10px] font-black tracking-widest uppercase text-gray-500 hover:text-red-500 transition-colors pt-4 border-t border-gray-100 mt-2"
      >
        CLEAR ALL
      </button>
    </div>
  );
}
// ── Main Page ─────────────────────────────────────────────────────────────────
export default function TrainingCatalogue() {
  const [search, setSearch] = useState("");
  const [view, setView] = useState("grid");
  const [filters, setFilters] = useState({
    category: [],
    type: [],
    level: [],
    certification: [],
  });

  const clearFilters = () =>
    setFilters({ category: [], type: [], level: [], certification: [] });

  const filtered = ALL_COURSES.filter((c) => {
    const matchSearch =
      search === "" ||
      c.title.toLowerCase().includes(search.toLowerCase()) ||
      c.author.toLowerCase().includes(search.toLowerCase());
    const matchCat =
      filters.category.length === 0 || filters.category.includes(c.category);
    const matchType =
      filters.type.length === 0 || filters.type.includes(c.type);
    const matchLevel =
      filters.level.length === 0 || filters.level.includes(c.level);
    const matchCert =
      filters.certification.length === 0 ||
      filters.certification.includes(c.certification);
    return matchSearch && matchCat && matchType && matchLevel && matchCert;
  });

  return (
    <GuestLayout>
      {/* Hero */}
      <section className="bg-gray-50 pt-16 pb-12 text-center px-6">
        <h1 className="text-5xl font-black text-gray-900 tracking-tight mb-3">
          TRAINING CATALOGUE
        </h1>
        <p className="text-gray-400 text-sm mb-8">
          Explore professional certifications and upscale your engineering
          career with INKINDO standards.
        </p>
        {/* Search bar */}
        <div className="max-w-2xl mx-auto flex items-center gap-0 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="pl-4 pr-2 flex items-center">
            <svg
              className="w-4 h-4 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
          </div>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search trainings, instructors, or keywords..."
            className="flex-1 py-3.5 text-sm text-gray-700 placeholder-gray-400 outline-none bg-transparent"
          />
          <button className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold tracking-widest uppercase px-6 py-3.5 transition-colors">
            SEARCH
          </button>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-10">
        <div className="flex gap-8">
          {/* FILTER SECTION */}
          <div className="w-72 flex-none">
            <FilterSidebar
              filters={filters}
              setFilters={setFilters}
              onClear={clearFilters}
            />
          </div>

          {/* CONTENT SECTION */}
          <div className="flex-1">
            {/* Toolbar */}
            <div className="flex items-center justify-between mb-6 bg-white rounded-xl border border-gray-100 shadow-sm px-5 py-3">
              <p className="text-[11px] font-bold tracking-widest uppercase text-gray-500">
                {filtered.length} RESULTS FOUND
              </p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setView("grid")}
                  className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                    view === "grid"
                      ? "bg-blue-600 text-white"
                      : "text-gray-400 hover:text-gray-600"
                  }`}
                >
                  <svg
                    className="w-4 h-4"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M3 3h7v7H3V3zm11 0h7v7h-7V3zM3 14h7v7H3v-7zm11 0h7v7h-7v-7z" />
                  </svg>
                </button>
                <button
                  onClick={() => setView("list")}
                  className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                    view === "list"
                      ? "bg-blue-600 text-white"
                      : "text-gray-400 hover:text-gray-600"
                  }`}
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth="2"
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

            {/* Empty State */}
            {filtered.length === 0 && (
              <div className="w-72 flex-none">
                <svg
                  className="w-12 h-12 mb-3 opacity-30"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="1"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <p className="text-sm font-semibold">No courses found.</p>
                <p className="text-xs mt-1">
                  Try adjusting your filters or search keyword.
                </p>
              </div>
            )}

            {/* Grid View */}
            {filtered.length > 0 && view === "grid" && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {filtered.map((c) => (
                  <CourseCard key={c.id} course={c} view="grid" />
                ))}
              </div>
            )}

            {/* List View */}
            {filtered.length > 0 && view === "list" && (
              <div className="flex flex-col gap-4">
                {filtered.map((c) => (
                  <CourseCard key={c.id} course={c} view="list" />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </GuestLayout>
  );
}
