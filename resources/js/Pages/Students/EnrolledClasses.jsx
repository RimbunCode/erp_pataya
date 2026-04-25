import { useState } from "react";
import MainLayout from "@/Layouts/MainLayout";

const courses = [
  {
    id: 1,
    title: "BIM Mastery for Structural Engineers",
    instructor: "Ir. Ahmad Sudirman",
    meta: "Expires in 3 months",
    progress: 65,
    status: "in_progress",
    image: "https://picsum.photos/seed/bim/200/150",
  },
  {
    id: 2,
    title: "Advanced Project Planning & Control",
    instructor: "Dr. Siti Aminah",
    meta: "Completed 12 Jan 2024",
    progress: 100,
    status: "completed",
    image: "https://picsum.photos/seed/planning/200/150",
  },
  {
    id: 3,
    title: "Ethics and Professionalism",
    instructor: "INKINDO Board",
    meta: "Starts 20 Feb 2024",
    progress: 0,
    status: "pending",
    image: "https://picsum.photos/seed/ethics/200/150",
  },
];

const statusConfig = {
  in_progress: {
    label: "In Progress",
    color: "text-blue-600",
    bar: "bg-blue-600",
  },
  completed: {
    label: "Completed",
    color: "text-green-600",
    bar: "bg-green-500",
  },
  pending: {
    label: "Pending",
    color: "text-gray-400",
    bar: "bg-gray-200",
  },
};

function CourseRow({ course }) {
  const [hovered, setHovered] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const config = statusConfig[course.status];

  return (
    <div
      className={`bg-white rounded-2xl border-2 flex items-center gap-5 px-5 py-4 transition-all duration-200 cursor-pointer
        ${hovered ? "border-blue-500 shadow-lg shadow-blue-100 -translate-y-0.5" : "border-gray-100 shadow-lg shadow-gray-100"}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => {
        setHovered(false);
        setMenuOpen(false);
      }}
    >
      {/* Thumbnail */}
      <div className="w-20 h-16 rounded-xl bg-blue-100 flex-shrink-0 overflow-hidden flex items-center justify-center">
        {course.image ? (
          <img
            src={course.image}
            alt={course.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <svg
            className="w-8 h-8 text-blue-300"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
            />
          </svg>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-black text-gray-900 uppercase tracking-wide leading-tight">
          {course.title}
        </h3>
        <p className="text-[10px] font-bold tracking-widest text-gray-400 uppercase mt-1">
          {course.instructor}
          <span className="mx-2">·</span>
          {course.meta}
        </p>
      </div>

      {/* Progress */}
      <div className="flex flex-col gap-1.5 w-48 flex-shrink-0">
        <div className="flex items-center justify-between">
          <span
            className={`text-[10px] font-extrabold tracking-widest uppercase ${config.color}`}
          >
            {config.label}
          </span>
          <span className="text-[10px] font-bold text-gray-400">
            {course.progress}%
          </span>
        </div>
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${config.bar}`}
            style={{ width: `${course.progress}%` }}
          />
        </div>
      </div>

      {/* Menu dots */}
      <div className="relative flex-shrink-0">
        <button
          onClick={(e) => {
            e.stopPropagation();
            setMenuOpen((v) => !v);
          }}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-300 hover:text-gray-500 hover:bg-gray-50 transition-colors"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 5a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm0 7a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm0 7a1.5 1.5 0 110-3 1.5 1.5 0 010 3z" />
          </svg>
        </button>
        {menuOpen && (
          <div className="absolute right-0 top-9 bg-white border border-gray-100 rounded-xl shadow-lg py-1 z-10 w-36">
            {["View Details", "Download Materials", "Unenroll"].map((item) => (
              <button
                key={item}
                className={`w-full text-left px-4 py-2 text-xs font-semibold transition-colors hover:bg-gray-50
                  ${item === "Unenroll" ? "text-red-400 hover:text-red-500" : "text-gray-600"}`}
              >
                {item}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* CTA Button */}
      <button
        className={`flex-shrink-0 text-[10px] font-extrabold tracking-widest uppercase px-5 py-2.5 rounded-xl transition-all duration-200
        ${
          course.status === "completed"
            ? "bg-green-500 hover:bg-green-600 text-white"
            : "bg-blue-600 hover:bg-blue-700 text-white"
        }`}
      >
        {course.status === "completed" ? "View Certificate" : "Resume"}
      </button>
    </div>
  );
}

export default function EnrolledClasses() {
  const [search, setSearch] = useState("");

  const filtered = courses.filter((c) =>
    c.title.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <MainLayout title="Enrolled Classes" breadcrumb="My-Trainings">
      <div className="p-8 flex flex-col gap-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-black text-gray-900 uppercase tracking-tight">
              My Enrolled Courses
            </h2>
            <p className="text-sm text-gray-400 mt-1">
              Manage and track all training sessions.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Search */}
            <div className="relative">
              <svg
                className="w-4 h-4 text-gray-300 absolute left-3 top-1/2 -translate-y-1/2"
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
                placeholder="Search trainings..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 pr-4 py-2.5 text-xs bg-white border border-gray-200 rounded-xl w-52 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all placeholder-gray-300"
              />
            </div>

            {/* Filter */}
            <button className="w-10 h-10 flex items-center justify-center bg-white border border-gray-200 rounded-xl text-gray-400 hover:text-blue-500 hover:border-blue-300 transition-colors">
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
                  d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Course List */}
        <div className="flex flex-col gap-4">
          {filtered.length > 0 ? (
            filtered.map((course) => (
              <CourseRow key={course.id} course={course} />
            ))
          ) : (
            <div className="text-center py-20 text-gray-300">
              <p className="text-sm font-bold uppercase tracking-widest">
                No courses found
              </p>
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
