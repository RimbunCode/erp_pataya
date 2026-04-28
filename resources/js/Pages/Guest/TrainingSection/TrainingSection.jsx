// resources/js/Pages/Guest/TrainingCatalogue.jsx

import { useState } from "react";
import GuestLayout from "@/Layouts/GuestLayout";
import Link from "@/Components/Link";
import { router } from "@inertiajs/react";

const courses = [
  {
    id: 1,
    title: "Advanced Project Planning & Control (PPC)",
    instructor: "Ir. Ahmad Sudirman, MT.",
    description:
      "Master the arts of scheduling, cost estimation, and risk management using modern BIM tools and industrial...",
    rating: 4.9,
    reviews: 128,
    students: 2450,
    hours: 24,
    sessions: 8,
    price: 2500000,
    certified: true,
    tags: ["Online", "Advanced"],
    tagActive: "Advanced",
    image: "https://picsum.photos/seed/classroom/400/300",
    path: "Professional Path",
    level: "Advanced",
    benefits: [
      "Full BIM Toolkit Access",
      "Real Case Study Exercises",
      "Expert Mentoring Sessions",
      "INKINDO Professional Certificate",
    ],
    syllabus: [
      "Project Lifecycle Management",
      "CPM & PERT Techniques",
      "Cost Estimation & Control",
      "Risk Assessment & Mitigation",
    ],
    certificate: "Professional Certificate",
  },
  {
    id: 2,
    title: "BIM Management for Structural Design",
    instructor: "Dr. Siti Aminah",
    description:
      "Comprehensive training for BIM integration in structural engineering workflows, including Revit and Tekla...",
    rating: 4.8,
    reviews: 256,
    students: 3120,
    hours: 32,
    sessions: 12,
    price: 3200000,
    certified: true,
    tags: ["Hybrid", "Intermediate"],
    tagActive: "Intermediate",
    image: "https://picsum.photos/seed/engineering/400/300",
    path: "Specialist Path",
    level: "Intermediate",
    benefits: [
      "Revit & Tekla Software Access",
      "Industrial Project Exposure",
      "Job Placement Support",
      "SKK Level 7 Equivalent",
    ],
    syllabus: [
      "3D Modeling Fundamentals",
      "Structural Analysis Integration",
      "Interdisciplinary Coordination",
      "Clash Detection & Resolution",
    ],
    certificate: "Professional Specialist",
  },
  {
    id: 3,
    title: "Ethics and Professionalism for Engineers",
    instructor: "Prof. Bambang Sutrisno",
    description:
      "Build a strong ethical foundation for your engineering career with case studies and real-world scenarios...",
    rating: 4.7,
    reviews: 89,
    students: 1870,
    hours: 16,
    sessions: 6,
    price: 1500000,
    certified: true,
    tags: ["Online"],
    tagActive: null,
    image: "https://picsum.photos/seed/ethics/400/300",
    path: "Foundation Path",
    level: "Beginner",
    benefits: [
      "Ethical Framework Training",
      "Case Study Analysis",
      "Professional Code of Conduct",
      "Attendance Certificate",
    ],
    syllabus: [
      "Engineering Ethics Fundamentals",
      "Professional Responsibility",
      "Legal Framework for Engineers",
      "Case Studies & Scenarios",
    ],
    certificate: "Attendance",
  },
  {
    id: 4,
    title: "Digital Construction Management",
    instructor: "Ir. Hendra Wijaya",
    description:
      "Learn to manage modern construction projects using digital tools, data analytics, and smart site technologies...",
    rating: 4.6,
    reviews: 142,
    students: 980,
    hours: 20,
    sessions: 8,
    price: 2100000,
    certified: true,
    tags: ["Offline", "Intermediate"],
    tagActive: "Intermediate",
    image: "https://picsum.photos/seed/digital/400/300",
    path: "Technology Path",
    level: "Intermediate",
    benefits: [
      "Smart Site Technology Access",
      "Data Analytics Training",
      "Industry Expert Sessions",
      "Competency Certificate",
    ],
    syllabus: [
      "Digital Twin Concepts",
      "IoT in Construction",
      "Data-Driven Decision Making",
      "Smart Site Management",
    ],
    certificate: "Competency",
  },
];

const filters = {
  category: ["Civil", "Structural", "Architecture", "Management", "Legal"],
  trainingType: ["Online", "Offline", "Hybrid"],
  level: ["Beginner", "Intermediate", "Advanced"],
  certification: ["Professional", "Competency", "Attendance"],
};

function formatRp(amount) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(amount);
}

function StarRating({ rating, size = "w-4 h-4" }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <svg
          key={s}
          className={`${size} ${s <= Math.round(rating) ? "text-amber-400" : "text-gray-200"}`}
          fill="currentColor"
          viewBox="0 0 24 24"
        >
          <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
        </svg>
      ))}
    </div>
  );
}

// ── Compare Page ──────────────────────────────────
function CompareRow({ label, leftVal, rightVal, threeCol, thirdVal }) {
  return (
    <div
      className={`grid border-b border-gray-100 last:border-none ${threeCol ? "grid-cols-3" : "grid-cols-2"}`}
    >
      {[leftVal, rightVal, ...(threeCol ? [thirdVal] : [])].map((val, i) => (
        <div
          key={i}
          className={`px-8 py-5 ${i > 0 ? "border-l border-gray-100" : ""}`}
        >
          {label && i === 0 && (
            <p className="text-[10px] font-bold tracking-[2px] text-gray-400 uppercase mb-2">
              {label}
            </p>
          )}
          {label && i > 0 && (
            <p className="text-[10px] font-bold tracking-[2px] text-gray-400 uppercase mb-2">
              {label}
            </p>
          )}
          {val}
        </div>
      ))}
    </div>
  );
}

function TrainingCompare({ selected, onBack }) {
  const threeCol = selected.length === 3;

  return (
    <GuestLayout>
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-6xl mx-auto px-6 py-12">
          {/* Back */}
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-xs font-bold tracking-widest text-gray-400 uppercase hover:text-gray-600 transition-colors mb-8"
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

          <h1 className="text-5xl font-black text-gray-900 uppercase tracking-tight mb-2">
            Compare Trainings
          </h1>
          <p className="text-base text-gray-400 mb-10">
            Analyze side-by-side and choose the path that best fits your career
            goals.
          </p>

          {/* Compare Card */}
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
            {/* Header — course info */}
            <div
              className={`grid border-b border-gray-100 ${threeCol ? "grid-cols-3" : "grid-cols-2"}`}
            >
              {selected.map((course, i) => (
                <div
                  key={course.id}
                  className={`px-8 py-8 ${i > 0 ? "border-l border-gray-100" : ""}`}
                >
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center">
                      <svg
                        className="w-4 h-4 text-blue-600"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M13 10V3L4 14h7v7l9-11h-7z"
                        />
                      </svg>
                    </div>
                    <span className="text-[10px] font-extrabold tracking-[2px] text-blue-600 uppercase">
                      {course.path}
                    </span>
                  </div>
                  <h3 className="text-lg font-black text-gray-900 uppercase tracking-tight leading-tight mb-3">
                    {course.title}
                  </h3>
                  <p className="text-[10px] font-bold tracking-[2px] text-blue-500 uppercase mb-3">
                    By {course.instructor}
                  </p>
                  <div className="flex items-center gap-2 mb-6">
                    <StarRating rating={course.rating} />
                    <span className="text-sm font-black text-gray-700">
                      {course.rating}
                    </span>
                    <span className="text-xs text-gray-400">
                      ({course.students.toLocaleString()} students)
                    </span>
                  </div>
                  <div className="mb-5">
                    <p className="text-[10px] font-bold tracking-[2px] text-gray-400 uppercase mb-1">
                      Investment
                    </p>
                    <p className="text-3xl font-black text-blue-600">
                      {formatRp(course.price)}
                    </p>
                    <p className="text-[10px] font-bold text-gray-400 mt-0.5">
                      One-time payment • Full access
                    </p>
                  </div>
                  <button className="w-full bg-blue-600 hover:bg-blue-700 text-white font-extrabold tracking-widest uppercase text-xs py-4 rounded-xl hover:-translate-y-0.5 shadow-md shadow-blue-200 transition-all duration-200">
                    Enroll This Path
                  </button>
                </div>
              ))}
            </div>

            {/* Description */}
            <div
              className={`grid border-b border-gray-100 ${threeCol ? "grid-cols-3" : "grid-cols-2"}`}
            >
              {selected.map((course, i) => (
                <div
                  key={course.id}
                  className={`px-8 py-6 ${i > 0 ? "border-l border-gray-100" : ""}`}
                >
                  <p className="text-[10px] font-bold tracking-[2px] text-gray-400 uppercase mb-3">
                    Description
                  </p>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    {course.description.replace("...", "")}
                  </p>
                </div>
              ))}
            </div>

            {/* Level */}
            <div
              className={`grid border-b border-gray-100 ${threeCol ? "grid-cols-3" : "grid-cols-2"}`}
            >
              {selected.map((course, i) => (
                <div
                  key={course.id}
                  className={`px-8 py-5 ${i > 0 ? "border-l border-gray-100" : ""}`}
                >
                  <p className="text-[10px] font-bold tracking-[2px] text-gray-400 uppercase mb-3">
                    Level
                  </p>
                  <span className="text-xs font-extrabold tracking-widest uppercase px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg">
                    {course.level}
                  </span>
                </div>
              ))}
            </div>

            {/* Key Benefits */}
            <div
              className={`grid border-b border-gray-100 ${threeCol ? "grid-cols-3" : "grid-cols-2"}`}
            >
              {selected.map((course, i) => (
                <div
                  key={course.id}
                  className={`px-8 py-6 ${i > 0 ? "border-l border-gray-100" : ""}`}
                >
                  <p className="text-[10px] font-bold tracking-[2px] text-gray-400 uppercase mb-4">
                    Key Benefits
                  </p>
                  <ul className="flex flex-col gap-3">
                    {course.benefits.map((b) => (
                      <li key={b} className="flex items-center gap-2.5">
                        <svg
                          className="w-4 h-4 text-green-500 flex-shrink-0"
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
                        <span className="text-sm font-semibold text-gray-700">
                          {b}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            {/* Syllabus Highlights */}
            <div
              className={`grid border-b border-gray-100 ${threeCol ? "grid-cols-3" : "grid-cols-2"}`}
            >
              {selected.map((course, i) => (
                <div
                  key={course.id}
                  className={`px-8 py-6 ${i > 0 ? "border-l border-gray-100" : ""}`}
                >
                  <p className="text-[10px] font-bold tracking-[2px] text-gray-400 uppercase mb-4">
                    Syllabus Highlights
                  </p>
                  <div className="flex flex-col gap-2">
                    {course.syllabus.map((s) => (
                      <div
                        key={s}
                        className="px-4 py-2.5 border border-gray-100 rounded-xl text-sm text-gray-600 font-medium"
                      >
                        {s}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Duration */}
            <div
              className={`grid border-b border-gray-100 ${threeCol ? "grid-cols-3" : "grid-cols-2"}`}
            >
              {selected.map((course, i) => (
                <div
                  key={course.id}
                  className={`px-8 py-5 flex items-center justify-between ${i > 0 ? "border-l border-gray-100" : ""}`}
                >
                  <p className="text-[10px] font-bold tracking-[2px] text-gray-400 uppercase">
                    Duration
                  </p>
                  <p className="text-sm font-black text-gray-800">
                    {course.hours} Hours ({course.sessions} Sessions)
                  </p>
                </div>
              ))}
            </div>

            {/* Certificate */}
            <div
              className={`grid border-b border-gray-100 ${threeCol ? "grid-cols-3" : "grid-cols-2"}`}
            >
              {selected.map((course, i) => (
                <div
                  key={course.id}
                  className={`px-8 py-5 flex items-center justify-between ${i > 0 ? "border-l border-gray-100" : ""}`}
                >
                  <p className="text-[10px] font-bold tracking-[2px] text-gray-400 uppercase">
                    Certificate
                  </p>
                  <p className="text-sm font-black text-gray-800">
                    {course.certificate}
                  </p>
                </div>
              ))}
            </div>

            {/* Price */}
            <div className={`grid ${threeCol ? "grid-cols-3" : "grid-cols-2"}`}>
              {selected.map((course, i) => (
                <div
                  key={course.id}
                  className={`px-8 py-6 flex items-center justify-between ${i > 0 ? "border-l border-gray-100" : ""}`}
                >
                  <p className="text-[10px] font-bold tracking-[2px] text-gray-400 uppercase">
                    Total Price
                  </p>
                  <p className="text-2xl font-black text-blue-600">
                    {formatRp(course.price)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </GuestLayout>
  );
}

// ── Course Card ───────────────────────────────────
function CourseCard({
  course,
  isSelected,
  onToggleCompare,
  compareCount,
  viewMode,
}) {
  const [hovered, setHovered] = useState(false);
  const canAdd = !isSelected && compareCount < 3;

  if (viewMode === "list") {
    return (
      <div
        className={`bg-white rounded-2xl border-2 flex items-center gap-5 px-5 py-4 transition-all duration-200
          ${hovered ? "border-blue-500 shadow-lg shadow-blue-100 -translate-y-0.5" : "border-gray-100 shadow-sm"}`}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <div className="w-24 h-20 rounded-xl overflow-hidden flex-shrink-0">
          <img
            src={course.image}
            alt={course.title}
            className="w-full h-full object-cover"
          />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-black text-gray-900 uppercase tracking-wide">
            {course.title}
          </h3>
          <p className="text-xs text-blue-500 font-bold mt-0.5">
            By {course.instructor}
          </p>
          <div className="flex items-center gap-2 mt-1.5">
            <StarRating rating={course.rating} size="w-3 h-3" />
            <span className="text-xs font-bold text-gray-500">
              {course.rating} ({course.reviews})
            </span>
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-base font-black text-gray-900">
            {formatRp(course.price)}
          </p>
          <div className="flex items-center gap-2 mt-2">
            <button
              onClick={() => onToggleCompare(course)}
              disabled={!isSelected && !canAdd}
              className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200
                ${
                  isSelected
                    ? "bg-blue-600 text-white"
                    : canAdd
                      ? "border border-gray-200 text-gray-400 hover:border-blue-400 hover:text-blue-500"
                      : "border border-gray-100 text-gray-200 cursor-not-allowed"
                }`}
            >
              {isSelected ? (
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
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              ) : (
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
                    d="M12 4v16m8-8H4"
                  />
                </svg>
              )}
            </button>
            <Link href="/guest/training/preview">
              <button className="px-4 py-2 text-xs font-extrabold tracking-widest uppercase bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors">
                View Details
              </button>
            </Link>
          </div>
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
      <div className="relative h-52 overflow-hidden">
        <img
          src={course.image}
          alt={course.title}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />

        {/* Tags */}
        <div className="absolute top-3 left-3 flex items-center gap-1.5">
          {course.tags.map((tag) => (
            <span
              key={tag}
              className={`px-3 py-1 rounded-full text-[10px] font-extrabold tracking-widest uppercase
                ${
                  tag === course.tagActive
                    ? "bg-blue-600 text-white"
                    : "bg-white/20 backdrop-blur-sm text-white"
                }`}
            >
              {tag}
            </span>
          ))}
        </div>

        {/* Wishlist + Compare */}
        <div className="absolute top-3 right-3 flex items-center gap-2">
          <button className="w-8 h-8 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/40 transition-colors">
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
                d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
              />
            </svg>
          </button>
        </div>

        {/* Rating */}
        <div className="absolute bottom-3 left-3 flex items-center gap-1.5">
          <StarRating rating={course.rating} size="w-3.5 h-3.5" />
          <span className="text-xs font-black text-white">{course.rating}</span>
          <span className="text-xs text-white/70">({course.reviews})</span>
        </div>
      </div>

      {/* Content */}
      <div className="p-5">
        <h3 className="text-base font-black text-gray-900 uppercase tracking-tight leading-tight mb-1">
          {course.title}
        </h3>
        <p className="text-[10px] font-bold tracking-widest text-blue-500 uppercase mb-2">
          By {course.instructor}
        </p>
        <p className="text-xs text-gray-500 leading-relaxed mb-4 line-clamp-2">
          {course.description}
        </p>

        <div className="flex items-center gap-4 text-xs text-gray-400 mb-5">
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
            {course.hours} Hours ({course.sessions} Sessions)
          </span>
          {course.certified && (
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
              Certified
            </span>
          )}
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-[9px] font-bold tracking-[2px] text-gray-400 uppercase">
              Investment
            </p>
            <p className="text-lg font-black text-gray-900">
              {formatRp(course.price)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Compare toggle */}
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
                ${
                  isSelected
                    ? "bg-blue-600 text-white shadow-md shadow-blue-200"
                    : canAdd
                      ? "border-2 border-gray-200 text-gray-400 hover:border-blue-400 hover:text-blue-500"
                      : "border-2 border-gray-100 text-gray-200 cursor-not-allowed"
                }`}
            >
              {isSelected ? (
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
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              ) : (
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
                    d="M12 4v16m8-8H4"
                  />
                </svg>
              )}
            </button>

            <Link href="/guest/training/preview">
              <button className="px-4 py-2.5 text-xs font-extrabold tracking-widest uppercase bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-md shadow-blue-200 hover:-translate-y-0.5 transition-all duration-200">
                View Details
              </button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────
export default function TrainingSection() {
  const [viewMode, setViewMode] = useState("grid");
  const [selectedFilters, setSelectedFilters] = useState({});
  const [search, setSearch] = useState("");
  const [compareList, setCompareList] = useState([]);
  const [showCompare, setShowCompare] = useState(false);

  const filteredCourses = courses.filter(
    (c) =>
      c.title.toLowerCase().includes(search.toLowerCase()) ||
      c.instructor.toLowerCase().includes(search.toLowerCase()),
  );

  const toggleCompare = (course) => {
    setCompareList((prev) => {
      const exists = prev.find((c) => c.id === course.id);
      if (exists) return prev.filter((c) => c.id !== course.id);
      if (prev.length >= 3) return prev;
      return [...prev, course];
    });
  };

  const toggleFilter = (group, value) => {
    setSelectedFilters((prev) => {
      const current = prev[group] ?? [];
      return {
        ...prev,
        [group]: current.includes(value)
          ? current.filter((v) => v !== value)
          : [...current, value],
      };
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
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-6 py-10">
          {/* ── Hero Section ── */}
          <div className="text-center mb-10">
            <h1 className="text-5xl font-black text-gray-900 uppercase tracking-tight mb-4">
              Training Catalogue
            </h1>
            <p className="text-base text-gray-400 mb-8 max-w-xl mx-auto">
              Explore professional certifications and upscale your engineering
              career with INKINDO standards.
            </p>

            {/* Search bar */}
            <div className="flex items-center gap-3 max-w-2xl mx-auto bg-white rounded-2xl border border-gray-200 shadow-sm px-5 py-3">
              <svg
                className="w-5 h-5 text-gray-300 flex-shrink-0"
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
                className="flex-1 text-sm text-gray-700 placeholder-gray-300 focus:outline-none bg-transparent"
              />
              <button className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold tracking-widest uppercase px-6 py-2.5 rounded-xl transition-colors flex-shrink-0">
                Search
              </button>
            </div>
          </div>
          <div className="flex gap-7">
            {/* ── Sidebar Filters ── */}
            <aside className="w-64 flex-shrink-0">
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 sticky top-24">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xs font-extrabold tracking-[2px] text-gray-700 uppercase">
                    Filters
                  </h3>
                  <svg
                    className="w-4 h-4 text-gray-400"
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

                {Object.entries(filters).map(([group, options]) => (
                  <div key={group} className="mb-6">
                    <p className="text-[10px] font-extrabold tracking-[2px] text-gray-400 uppercase mb-3">
                      {group === "trainingType" ? "Training Type" : group}
                    </p>
                    <div className="flex flex-col gap-2">
                      {options.map((option) => {
                        const active = selectedFilters[group]?.includes(option);
                        return (
                          <label
                            key={option}
                            className="flex items-center gap-2.5 cursor-pointer group"
                          >
                            <div
                              onClick={() => toggleFilter(group, option)}
                              className={`w-4 h-4 rounded flex items-center justify-center transition-all flex-shrink-0
                                ${active ? "bg-blue-600" : "border-2 border-gray-200 group-hover:border-blue-400"}`}
                            >
                              {active && (
                                <svg
                                  className="w-2.5 h-2.5 text-white"
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
                              )}
                            </div>
                            <span
                              className={`text-sm transition-colors ${active ? "font-bold text-gray-800" : "text-gray-600 group-hover:text-gray-800"}`}
                            >
                              {option}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}

                <button
                  onClick={() => setSelectedFilters({})}
                  className="w-full py-2.5 text-xs font-extrabold tracking-widest uppercase border-2 border-gray-200 rounded-xl text-gray-500 hover:bg-gray-50 transition-colors"
                >
                  Clear All
                </button>
              </div>
            </aside>

            {/* ── Main Content ── */}
            <div className="flex-1 min-w-0">
              {/* Results bar */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-3.5 flex items-center justify-between mb-5">
                <p className="text-xs font-extrabold tracking-[2px] text-gray-500 uppercase">
                  {filteredCourses.length} Results Found
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setViewMode("grid")}
                    className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors
                      ${viewMode === "grid" ? "bg-blue-600 text-white" : "text-gray-400 hover:bg-gray-50"}`}
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
                    className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors
                      ${viewMode === "list" ? "bg-blue-600 text-white" : "text-gray-400 hover:bg-gray-50"}`}
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

              {/* Course grid / list */}
              <div
                className={
                  viewMode === "grid"
                    ? "grid grid-cols-2 gap-5"
                    : "flex flex-col gap-4"
                }
              >
                {filteredCourses.map((course) => (
                  <CourseCard
                    key={course.id}
                    course={course}
                    isSelected={compareList.some((c) => c.id === course.id)}
                    onToggleCompare={toggleCompare}
                    compareCount={compareList.length}
                    viewMode={viewMode}
                  />
                ))}
              </div>
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
                <div className="w-7 h-7 rounded-xl bg-blue-600 flex items-center justify-center">
                  <span className="text-xs font-black text-white">
                    {compareList.length}
                  </span>
                </div>
                <span className="text-sm font-extrabold tracking-widest text-white uppercase">
                  Compare Selected Trainings
                </span>
              </div>

              {/* Mini previews */}
              <div className="flex items-center gap-2">
                {compareList.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center gap-1.5 bg-white/10 rounded-xl px-3 py-1.5"
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
                  ${
                    compareList.length >= 2
                      ? "bg-blue-600 hover:bg-blue-500 text-white hover:-translate-y-0.5"
                      : "bg-white/10 text-white/40 cursor-not-allowed"
                  }`}
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
