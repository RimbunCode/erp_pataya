// resources/js/Pages/Instructor/StudentManagement.jsx

import MainLayout from "@/Layouts/MainLayout";
import { useState } from "react";

// ── Mock Data ──────────────────────────────────────────────────────────────────
const students = [
  {
    id: 1,
    name: "Budi Santoso",
    avatar: "BS",
    email: "budi.s@gmail.com",
    course: "BIM Mastery for Structural Engineers",
    progress: 65,
    status: "ACTIVE",
    joinDate: "12 Jan 2024",
    lastActive: "2h ago",
  },
  {
    id: 2,
    name: "Sari Dewi",
    avatar: "SD",
    email: "sari.dewi@email.com",
    course: "Advanced Project Planning & Control",
    progress: 100,
    status: "COMPLETED",
    joinDate: "5 Dec 2023",
    lastActive: "3d ago",
  },
  {
    id: 3,
    name: "Ahmad Fauzi",
    avatar: "AF",
    email: "a.fauzi@work.id",
    course: "BIM Mastery for Structural Engineers",
    progress: 42,
    status: "ACTIVE",
    joinDate: "20 Jan 2024",
    lastActive: "1h ago",
  },
  {
    id: 4,
    name: "Rina Marlina",
    avatar: "RM",
    email: "rina.m@email.com",
    course: "Ethics and Professionalism",
    progress: 0,
    status: "PENDING",
    joinDate: "18 Feb 2024",
    lastActive: "Never",
  },
  {
    id: 5,
    name: "Doni Prakoso",
    avatar: "DP",
    email: "doni.p@email.com",
    course: "Advanced Project Planning & Control",
    progress: 100,
    status: "COMPLETED",
    joinDate: "1 Nov 2023",
    lastActive: "1w ago",
  },
  {
    id: 6,
    name: "Mega Putri",
    avatar: "MP",
    email: "mega.p@email.com",
    course: "Ethics and Professionalism",
    progress: 18,
    status: "ACTIVE",
    joinDate: "22 Feb 2024",
    lastActive: "5h ago",
  },
  {
    id: 7,
    name: "Rizky Hamdani",
    avatar: "RH",
    email: "rizky.h@email.com",
    course: "BIM Mastery for Structural Engineers",
    progress: 88,
    status: "ACTIVE",
    joinDate: "8 Jan 2024",
    lastActive: "30m ago",
  },
  {
    id: 8,
    name: "Lestari Wulan",
    avatar: "LW",
    email: "lestari@email.com",
    course: "Ethics and Professionalism",
    progress: 0,
    status: "PENDING",
    joinDate: "25 Feb 2024",
    lastActive: "Never",
  },
];

const courses = [
  "All Courses",
  "BIM Mastery for Structural Engineers",
  "Advanced Project Planning & Control",
  "Ethics and Professionalism",
];

const statusCfg = {
  ACTIVE: {
    pill: "bg-blue-50 text-blue-600 border-blue-200",
    dot: "bg-blue-500",
  },
  COMPLETED: {
    pill: "bg-green-50 text-green-600 border-green-200",
    dot: "bg-green-500",
  },
  PENDING: {
    pill: "bg-gray-100 text-gray-400 border-gray-200",
    dot: "bg-gray-300",
  },
};

const avatarColors = [
  "bg-blue-500",
  "bg-violet-500",
  "bg-rose-500",
  "bg-amber-500",
  "bg-teal-500",
  "bg-pink-500",
  "bg-indigo-500",
  "bg-orange-500",
];

// ── ProgressRing ───────────────────────────────────────────────────────────────
function ProgressRing({ pct, size = 36, stroke = 3 }) {
  const r = (size - stroke * 2) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;
  const color = pct === 100 ? "#22c55e" : pct === 0 ? "#d1d5db" : "#2563eb";
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="#f3f4f6"
        strokeWidth={stroke}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeDasharray={circ}
        strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transition: "stroke-dashoffset 0.6s ease" }}
      />
    </svg>
  );
}

// ── StatCard ───────────────────────────────────────────────────────────────────
function StatCard({
  label,
  value,
  sub,
  icon,
  accentBorder,
  accentDot,
  accentIcon,
  onClick,
  active,
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 min-w-0 text-left bg-white rounded-2xl p-5 border-2 transition-all shadow-sm hover:shadow-md
        ${active ? accentBorder : "border-gray-100 hover:border-gray-200"}`}
    >
      <div className="flex items-start justify-between mb-3">
        <div
          className={`w-10 h-10 rounded-xl flex items-center justify-center ${accentIcon}`}
        >
          {icon}
        </div>
        {active && <span className={`w-2 h-2 rounded-full ${accentDot}`} />}
      </div>
      <p className="text-2xl font-black text-gray-900 tracking-tight">
        {value}
      </p>
      <p className="text-[10px] font-black tracking-widest text-gray-400 uppercase mt-0.5">
        {label}
      </p>
      <p className="text-[9px] font-semibold text-gray-300 mt-1">{sub}</p>
    </button>
  );
}

// ── StudentModal ───────────────────────────────────────────────────────────────
function StudentModal({ student, index, onClose }) {
  if (!student) return null;

  const cfg = statusCfg[student.status];
  const color = avatarColors[index % avatarColors.length];

  const modules = [
    { title: "Introduction & Overview", done: true },
    { title: "Core Fundamentals", done: student.progress >= 30 },
    { title: "Practical Application", done: student.progress >= 60 },
    { title: "Advanced Techniques", done: student.progress >= 80 },
    { title: "Final Assessment", done: student.progress === 100 },
  ];

  const barColor =
    student.progress === 100
      ? "bg-green-500"
      : student.progress === 0
        ? "bg-gray-300"
        : "bg-blue-600";

  return (
    /* Backdrop — klik di luar untuk tutup */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{
        backdropFilter: "blur(6px)",
        backgroundColor: "rgba(15,23,42,0.45)",
      }}
      onClick={onClose}
    >
      {/* Modal panel */}
      <div
        className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Dark banner ── */}
        <div className="bg-gray-900 px-7 pt-7 pb-10 relative">
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-xl bg-white/10 text-white/60 hover:bg-white/20 hover:text-white transition-all"
          >
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
          </button>

          {/* Avatar + name */}
          <div className="flex items-center gap-4">
            <div
              className={`w-14 h-14 rounded-2xl ${color} flex items-center justify-center text-white text-lg font-black flex-shrink-0`}
            >
              {student.avatar}
            </div>
            <div>
              <h3 className="text-base font-black text-white tracking-wide">
                {student.name}
              </h3>
              <p className="text-xs text-gray-400 font-medium mt-0.5">
                {student.email}
              </p>
              <span
                className={`inline-flex items-center gap-1.5 mt-2 px-2.5 py-1 rounded-lg border text-[9px] font-black tracking-widest uppercase ${cfg.pill}`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                {student.status}
              </span>
            </div>
          </div>
        </div>

        {/* ── Body ── */}
        <div className="px-7 -mt-5 pb-7 space-y-5">
          {/* Quick info cards */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Joined", value: student.joinDate },
              { label: "Last Active", value: student.lastActive },
              { label: "Progress", value: `${student.progress}%` },
            ].map((item) => (
              <div
                key={item.label}
                className="bg-gray-50 rounded-2xl px-4 py-3 border border-gray-100"
              >
                <p className="text-[9px] font-black tracking-widest text-gray-400 uppercase">
                  {item.label}
                </p>
                <p className="text-sm font-black text-gray-800 mt-1">
                  {item.value}
                </p>
              </div>
            ))}
          </div>

          {/* Enrolled course */}
          <div className="bg-blue-50 rounded-2xl px-4 py-3 border border-blue-100 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
              <svg
                className="w-4 h-4 text-blue-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                />
              </svg>
            </div>
            <div className="min-w-0">
              <p className="text-[9px] font-black tracking-widest text-blue-400 uppercase">
                Enrolled Course
              </p>
              <p className="text-xs font-black text-blue-700 uppercase tracking-wide truncate mt-0.5">
                {student.course}
              </p>
            </div>
          </div>

          {/* Overall progress bar */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-black tracking-widest text-gray-500 uppercase">
                Overall Progress
              </p>
              <p className="text-[10px] font-black text-gray-700">
                {student.progress}%
              </p>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${barColor}`}
                style={{ width: `${student.progress}%` }}
              />
            </div>
          </div>

          {/* Module checklist */}
          <div>
            <p className="text-[10px] font-black tracking-widest text-gray-500 uppercase mb-3">
              Module Completion
            </p>
            <div className="space-y-2">
              {modules.map((mod, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border transition-all
                    ${mod.done ? "bg-green-50 border-green-100" : "bg-gray-50 border-gray-100"}`}
                >
                  <div
                    className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0
                    ${mod.done ? "bg-green-500" : "bg-gray-200"}`}
                  >
                    {mod.done && (
                      <svg
                        className="w-3 h-3 text-white"
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
                    className={`text-[10px] font-bold uppercase tracking-wide
                    ${mod.done ? "text-green-700" : "text-gray-400"}`}
                  >
                    {mod.title}
                  </span>
                  {!mod.done && (
                    <span className="ml-auto text-[9px] font-bold text-gray-300 uppercase tracking-widest">
                      Locked
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-3 pt-1">
            <button className="flex-1 py-2.5 text-[10px] font-black tracking-widest uppercase border-2 border-gray-200 rounded-xl text-gray-500 hover:border-gray-300 hover:text-gray-700 transition-all">
              Send Message
            </button>
            <button className="flex-1 py-2.5 text-[10px] font-black tracking-widest uppercase bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all shadow-md shadow-blue-200">
              View Full Report
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── StudentRow ─────────────────────────────────────────────────────────────────
function StudentRow({ student, index, onOpen }) {
  const [hovered, setHovered] = useState(false);
  const cfg = statusCfg[student.status];
  const color = avatarColors[index % avatarColors.length];

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`grid grid-cols-[2fr_2fr_1fr_1fr_auto] items-center gap-4 px-6 py-4 border-b border-gray-50 transition-all cursor-pointer
        ${hovered ? "bg-blue-50/40" : "bg-white"}`}
    >
      {/* Student */}
      <div className="flex items-center gap-3 min-w-0">
        <div
          className={`w-9 h-9 rounded-full ${color} flex items-center justify-center text-white text-xs font-black flex-shrink-0`}
        >
          {student.avatar}
        </div>
        <div className="min-w-0">
          <p className="text-xs font-black text-gray-800 truncate">
            {student.name}
          </p>
          <p className="text-[10px] text-gray-400 font-medium truncate">
            {student.email}
          </p>
        </div>
      </div>

      {/* Course */}
      <div className="min-w-0">
        <p className="text-[10px] font-bold text-gray-600 uppercase tracking-wide truncate">
          {student.course}
        </p>
        <p className="text-[9px] text-gray-300 font-medium mt-0.5">
          Joined {student.joinDate}
        </p>
      </div>

      {/* Progress */}
      <div className="flex items-center gap-2">
        <ProgressRing pct={student.progress} />
        <span className="text-xs font-black text-gray-700">
          {student.progress}%
        </span>
      </div>

      {/* Status */}
      <div>
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[9px] font-black tracking-widest uppercase ${cfg.pill}`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
          {student.status}
        </span>
        <p className="text-[9px] text-gray-300 font-medium mt-1 pl-0.5">
          Active {student.lastActive}
        </p>
      </div>

      {/* Action */}
      <button
        onClick={() => onOpen(student, index)}
        className={`px-4 py-2 text-[9px] font-black tracking-widest uppercase rounded-xl transition-all whitespace-nowrap
          ${hovered ? "bg-blue-600 text-white shadow-md shadow-blue-200" : "bg-gray-100 text-gray-400"}`}
      >
        View Detail
      </button>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function StudentManagement() {
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [filterCourse, setFilterCourse] = useState("All Courses");
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const handleOpen = (student, index) => {
    setSelectedStudent(student);
    setSelectedIndex(index);
  };
  const handleClose = () => setSelectedStudent(null);

  const total = students.length;
  const active = students.filter((s) => s.status === "ACTIVE").length;
  const completed = students.filter((s) => s.status === "COMPLETED").length;
  const pending = students.filter((s) => s.status === "PENDING").length;

  const filtered = students.filter((s) => {
    const matchSearch =
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.email.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === "ALL" || s.status === filterStatus;
    const matchCourse =
      filterCourse === "All Courses" || s.course === filterCourse;
    return matchSearch && matchStatus && matchCourse;
  });

  const statCards = [
    {
      label: "Total Students",
      value: total,
      sub: "Across all classes",
      key: "ALL",
      accentBorder: "border-gray-400",
      accentDot: "bg-gray-500",
      accentIcon: "bg-gray-50",
      icon: (
        <svg
          className="w-5 h-5 text-gray-500"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
          />
        </svg>
      ),
    },
    {
      label: "Active",
      value: active,
      sub: "Currently learning",
      key: "ACTIVE",
      accentBorder: "border-blue-500",
      accentDot: "bg-blue-500",
      accentIcon: "bg-blue-50",
      icon: (
        <svg
          className="w-5 h-5 text-blue-500"
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
      ),
    },
    {
      label: "Completed",
      value: completed,
      sub: "Finished all modules",
      key: "COMPLETED",
      accentBorder: "border-green-500",
      accentDot: "bg-green-500",
      accentIcon: "bg-green-50",
      icon: (
        <svg
          className="w-5 h-5 text-green-500"
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
      ),
    },
    {
      label: "Pending",
      value: pending,
      sub: "Not yet started",
      key: "PENDING",
      accentBorder: "border-amber-400",
      accentDot: "bg-amber-400",
      accentIcon: "bg-amber-50",
      icon: (
        <svg
          className="w-5 h-5 text-amber-400"
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
      ),
    },
  ];

  return (
    <>
      <MainLayout title="Student Management">
        <div className="p-8 space-y-6">
          {/* Header */}
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <h2 className="text-2xl font-black tracking-tight text-gray-900 uppercase">
                Student Management
              </h2>
              <p className="text-xs text-gray-400 font-medium mt-0.5">
                Monitor and manage all your enrolled students.
              </p>
            </div>
            <button className="px-5 py-2.5 text-xs font-black tracking-widest uppercase bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all flex items-center gap-2 shadow-md shadow-blue-200">
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
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                />
              </svg>
              Export CSV
            </button>
          </div>

          {/* Stat Cards */}
          <div className="flex gap-4 flex-wrap">
            {statCards.map((c) => (
              <StatCard
                key={c.key}
                label={c.label}
                value={c.value}
                sub={c.sub}
                icon={c.icon}
                accentBorder={c.accentBorder}
                accentDot={c.accentDot}
                accentIcon={c.accentIcon}
                active={filterStatus === c.key}
                onClick={() =>
                  setFilterStatus(
                    filterStatus === c.key && c.key !== "ALL" ? "ALL" : c.key,
                  )
                }
              />
            ))}
          </div>

          {/* Table */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {/* Toolbar */}
            <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-gray-100 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-gray-800 uppercase tracking-widest">
                  All Students
                </span>
                <span className="px-2 py-0.5 bg-blue-50 text-blue-600 text-[10px] font-black rounded-lg border border-blue-100">
                  {filtered.length}
                </span>
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <select
                  value={filterCourse}
                  onChange={(e) => setFilterCourse(e.target.value)}
                  className="text-xs font-bold text-gray-500 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                >
                  {courses.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
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
                    placeholder="Search student..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9 pr-4 py-2 text-xs bg-gray-50 border border-gray-200 rounded-xl w-48 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all placeholder-gray-300"
                  />
                </div>
              </div>
            </div>

            {/* Table Head */}
            <div className="grid grid-cols-[2fr_2fr_1fr_1fr_auto] gap-4 px-6 py-3 bg-gray-50/60 border-b border-gray-100">
              {["Student", "Course", "Progress", "Status", ""].map((h, i) => (
                <span
                  key={i}
                  className="text-[10px] font-black tracking-widest text-gray-400 uppercase"
                >
                  {h}
                </span>
              ))}
            </div>

            {/* Rows */}
            {filtered.length > 0 ? (
              filtered.map((s, i) => (
                <StudentRow
                  key={s.id}
                  student={s}
                  index={i}
                  onOpen={handleOpen}
                />
              ))
            ) : (
              <div className="py-16 flex flex-col items-center gap-3">
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
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
                <p className="text-xs font-bold text-gray-300 uppercase tracking-widest">
                  No students found
                </p>
              </div>
            )}

            {/* Pagination footer */}
            {filtered.length > 0 && (
              <div className="px-6 py-3 border-t border-gray-50 flex items-center justify-between">
                <p className="text-[10px] font-bold text-gray-300 uppercase tracking-widest">
                  Showing {filtered.length} of {total} students
                </p>
                <div className="flex items-center gap-1">
                  {["←", "1", "2", "→"].map((p) => (
                    <button
                      key={p}
                      className="w-7 h-7 flex items-center justify-center rounded-lg text-[10px] font-black text-gray-400 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </MainLayout>
      {/* Modal — rendered outside scroll container */}
      <StudentModal
        student={selectedStudent}
        index={selectedIndex}
        onClose={handleClose}
      />
    </>
  );
}
