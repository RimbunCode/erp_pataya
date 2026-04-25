import MainLayout from "@/Layouts/MainLayout";
import { useState } from "react";

// ── Mock data ──────────────────────────────────────────────────────────────────
const classesData = [
  {
    id: 1,
    title: "BIM Mastery for Structural Engineers",
    instructor: "Ir. Ahmad Sudirman",
    meta: "Expires in 3 months",
    status: "IN PROGRESS",
    progress: 65,
    action: "RESUME",
    active: true,
  },
  {
    id: 2,
    title: "Advanced Project Planning & Control",
    instructor: "Dr. Siti Aminah",
    meta: "Completed 12 Jan 2024",
    status: "COMPLETED",
    progress: 100,
    action: "VIEW CERTIFICATE",
    active: false,
  },
  {
    id: 3,
    title: "Ethics and Professionalism",
    instructor: "Inkindo Board",
    meta: "Starts 20 Feb 2024",
    status: "PENDING",
    progress: 0,
    action: "RESUME",
    active: false,
  },
];

const statusConfig = {
  "IN PROGRESS": { text: "text-blue-600", bar: "bg-blue-600" },
  COMPLETED: { text: "text-green-600", bar: "bg-green-500" },
  PENDING: { text: "text-gray-400", bar: "bg-gray-300" },
};

// ── ClassCard ──────────────────────────────────────────────────────────────────
function ClassCard({ item }) {
  const cfg = statusConfig[item.status];
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className={`bg-white rounded-2xl border-2 flex items-center gap-5 px-5 py-4 transition-all duration-200
        ${hovered ? "border-blue-500 shadow-lg shadow-blue-100 -translate-y-0.5" : "border-gray-100 shadow-lg shadow-gray-100"}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Thumbnail */}
      <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center flex-shrink-0">
        <svg
          className="w-8 h-8 text-blue-400"
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
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-black text-gray-900 uppercase tracking-wide leading-snug">
          {item.title}
        </h3>
        <p className="text-[10px] font-bold tracking-widest text-gray-400 uppercase mt-1.5 flex items-center gap-2">
          {item.instructor}
          <span className="w-1 h-1 rounded-full bg-gray-300 inline-block" />
          {item.meta}
        </p>
      </div>

      {/* Progress */}
      <div className="flex flex-col gap-1.5 w-44 flex-shrink-0">
        <div className="flex items-center justify-between">
          <span
            className={`text-[10px] font-black tracking-widest uppercase ${cfg.text}`}
          >
            {item.status}
          </span>
          <span className="text-[10px] font-black text-gray-500">
            {item.progress}%
          </span>
        </div>
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${cfg.bar}`}
            style={{ width: `${item.progress}%` }}
          />
        </div>
      </div>

      {/* More */}
      <button className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-300 hover:text-gray-500 hover:bg-gray-100 transition-colors flex-shrink-0">
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 5a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm0 7a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm0 7a1.5 1.5 0 110-3 1.5 1.5 0 010 3z" />
        </svg>
      </button>

      {/* Action Button */}
      <button className="px-5 py-2.5 bg-blue-600 text-white text-[10px] font-black tracking-widest uppercase rounded-xl hover:bg-blue-700 transition-all shadow-md shadow-blue-100 flex-shrink-0 whitespace-nowrap">
        {item.action}
      </button>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function ManageClasses() {
  const [search, setSearch] = useState("");

  const filtered = classesData.filter((c) =>
    c.title.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <MainLayout title="Manage Classes" breadcrumb="My-Trainings">
      <div className="p-8 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h2 className="text-2xl font-black tracking-tight text-gray-900 uppercase">
              My Published Classes
            </h2>
            <p className="text-xs text-gray-400 font-medium mt-0.5">
              Manage and track all training sessions.
            </p>
          </div>

          {/* Search + Filter */}
          <div className="flex items-center gap-3">
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
                className="pl-9 pr-4 py-2.5 text-xs bg-gray-50 border border-gray-200 rounded-xl w-52 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all placeholder-gray-300"
              />
            </div>
            <button className="w-10 h-10 flex items-center justify-center rounded-xl border border-gray-200 text-gray-400 hover:text-gray-600 hover:border-gray-300 hover:bg-gray-50 transition-all">
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

        {/* Class List */}
        <div className="flex flex-col gap-4">
          {filtered.length > 0 ? (
            filtered.map((item) => <ClassCard key={item.id} item={item} />)
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100 py-16 flex flex-col items-center gap-3">
              <svg
                className="w-10 h-10 text-gray-200"
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
              <p className="text-xs font-bold text-gray-300 uppercase tracking-widest">
                No classes found
              </p>
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
