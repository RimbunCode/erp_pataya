import { useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import MainLayout from "@/Layouts/MainLayout";

// ── Mock data ──────────────────────────────────────────────────────────────────
const revenueData = [
  { day: "Mon", rev: 3800 },
  { day: "Tue", rev: 3200 },
  { day: "Wed", rev: 6800 },
  { day: "Thu", rev: 7200 },
  { day: "Fri", rev: 6500 },
  { day: "Sat", rev: 9800 },
  { day: "Sun", rev: 11000 },
];

const announcements = [
  { id: 1, title: "Zoom link for BIM Mastery", time: "2H AGO" },
  { id: 2, title: "Module 4 Material Uploaded", time: "YESTERDAY" },
];

const trainings = [
  {
    id: 1,
    title: "Advanced Project Planning",
    tags: ["ZOOM LINK ADDED", "4 ASSETS"],
    students: 245,
    revenue: "Rp 12.2M",
    status: "ACTIVE",
  },
  {
    id: 2,
    title: "Building Information Modeling",
    tags: ["ZOOM LINK ADDED", "4 ASSETS"],
    students: 128,
    revenue: "Rp 24.5M",
    status: "ACTIVE",
  },
  {
    id: 3,
    title: "Structural Engineering Ethics",
    tags: ["ZOOM LINK ADDED", "4 ASSETS"],
    students: 89,
    revenue: "Rp 4.5M",
    status: "DRAFT",
  },
];

// ── Sub-components ─────────────────────────────────────────────────────────────

function StatCard({ icon, label, value, trend, trendLabel, iconBg }) {
  return (
    <div className="bg-white rounded-2xl p-6 flex flex-col gap-3 shadow-sm border border-gray-100 flex-1 min-w-0">
      <div className="flex items-start justify-between">
        <div
          className={`w-11 h-11 rounded-xl flex items-center justify-center ${iconBg}`}
        >
          {icon}
        </div>
        <span className="text-[10px] font-bold tracking-widest text-gray-400 uppercase">
          {label}
        </span>
      </div>
      <p className="text-2xl font-black text-gray-900 tracking-tight">
        {value}
      </p>
      <p className="text-xs font-bold text-green-500 flex items-center gap-1">
        <svg
          className="w-3 h-3"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={3}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M5 10l7-7m0 0l7 7m-7-7v18"
          />
        </svg>
        {trendLabel}
      </p>
    </div>
  );
}

function StatusBadge({ status }) {
  const isActive = status === "ACTIVE";
  return (
    <span
      className={`px-3 py-1 rounded-lg text-[10px] font-black tracking-widest border ${
        isActive
          ? "bg-green-50 text-green-600 border-green-200"
          : "bg-gray-100 text-gray-500 border-gray-200"
      }`}
    >
      {status}
    </span>
  );
}

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl px-4 py-2 shadow-lg text-xs">
        <p className="font-bold text-gray-700">{label}</p>
        <p className="text-blue-600 font-black">
          rev : {payload[0].value.toLocaleString()}
        </p>
      </div>
    );
  }
  return null;
};

// ── Main page ──────────────────────────────────────────────────────────────────

export default function InstructorDashboard() {
  return (
    <MainLayout>
      <div className="p-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h2 className="text-2xl font-black tracking-tight text-gray-900 uppercase">
              Instructor Hub
            </h2>
            <p className="text-xs text-gray-400 font-medium mt-0.5">
              Empower the next generation of engineers.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button className="px-5 py-2.5 text-xs font-black tracking-widest uppercase border-2 border-gray-200 rounded-xl text-gray-600 hover:border-gray-400 hover:text-gray-800 transition-all">
              View Public Profile
            </button>
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
                  d="M12 4v16m8-8H4"
                />
              </svg>
              Create New Class
            </button>
          </div>
        </div>

        {/* Stat Cards */}
        <div className="flex gap-4 flex-wrap">
          <StatCard
            label="Total Revenue"
            value="Rp 84.5M"
            trendLabel="+12.5%"
            iconBg="bg-blue-50"
            icon={
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
                  d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
                />
              </svg>
            }
          />
          <StatCard
            label="Active Students"
            value="1,284"
            trendLabel="+48"
            iconBg="bg-purple-50"
            icon={
              <svg
                className="w-5 h-5 text-purple-500"
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
            }
          />
          <StatCard
            label="Completion Rate"
            value="92.4%"
            trendLabel="+2.1%"
            iconBg="bg-green-50"
            icon={
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
            }
          />
        </div>

        {/* Revenue Analytics + Announcements */}
        <div className="flex gap-4 flex-wrap lg:flex-nowrap">
          {/* Chart */}
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex-1 min-w-0">
            <h3 className="text-xs font-black tracking-widest text-gray-900 uppercase mb-6">
              Revenue Analytics
            </h3>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart
                data={revenueData}
                margin={{ top: 4, right: 4, left: -20, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="revGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0.01} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#f0f0f0"
                  vertical={false}
                />
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 10, fill: "#9ca3af", fontWeight: 600 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "#9ca3af", fontWeight: 600 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey="rev"
                  stroke="#2563eb"
                  strokeWidth={2.5}
                  fill="url(#revGradient)"
                  dot={false}
                  activeDot={{
                    r: 5,
                    fill: "#2563eb",
                    stroke: "#fff",
                    strokeWidth: 2,
                  }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Announcements */}
          <div className="bg-gray-900 rounded-2xl p-6 flex flex-col gap-4 w-full lg:w-72 flex-shrink-0">
            <h3 className="text-xs font-black tracking-widest text-white uppercase">
              Active Announcements
            </h3>
            <div className="flex flex-col gap-3 flex-1">
              {announcements.map((a) => (
                <div key={a.id} className="bg-gray-800 rounded-xl px-4 py-3">
                  <p className="text-sm font-bold text-white leading-snug">
                    {a.title}
                  </p>
                  <p className="text-[10px] font-bold tracking-widest text-gray-400 mt-1">
                    {a.time}
                  </p>
                </div>
              ))}
            </div>
            <button className="w-full py-3 bg-blue-600 text-white text-xs font-black tracking-widest uppercase rounded-xl hover:bg-blue-500 transition-all">
              Broadcast New
            </button>
          </div>
        </div>

        {/* My Trainings */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
            <h3 className="text-xs font-black tracking-widest text-gray-900 uppercase">
              My Trainings
            </h3>
            <button className="text-[10px] font-black tracking-widest text-blue-600 uppercase hover:text-blue-800 transition-colors">
              See Detailed List
            </button>
          </div>

          {/* Table header */}
          <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 px-6 py-3 border-b border-gray-50">
            {["Training Title", "Students", "Revenue", "Status", ""].map(
              (col, i) => (
                <span
                  key={i}
                  className="text-[10px] font-black tracking-widest text-gray-400 uppercase"
                >
                  {col}
                </span>
              ),
            )}
          </div>

          {/* Rows */}
          {trainings.map((t, idx) => (
            <div
              key={t.id}
              className={`grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 items-center px-6 py-4 ${
                idx !== trainings.length - 1 ? "border-b border-gray-50" : ""
              } hover:bg-gray-50/50 transition-colors`}
            >
              {/* Title + tags */}
              <div>
                <p className="text-sm font-black text-gray-900 tracking-wide uppercase">
                  {t.title}
                </p>
                <div className="flex items-center gap-3 mt-1.5">
                  {t.tags.map((tag) => (
                    <span
                      key={tag}
                      className="flex items-center gap-1 text-[9px] font-bold tracking-widest text-gray-400 uppercase"
                    >
                      {tag.includes("ZOOM") ? (
                        <svg
                          className="w-3 h-3"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101"
                          />
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M14.828 14.828a4 4 0 015.656 0l4 4a4 4 0 01-5.656 5.656l-1.1-1.1"
                          />
                        </svg>
                      ) : (
                        <svg
                          className="w-3 h-3"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
                          />
                        </svg>
                      )}
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              {/* Students */}
              <div className="flex items-center gap-2">
                <span className="text-sm font-black text-gray-800">
                  {t.students}
                </span>
                <span className="text-[9px] font-black tracking-widest text-gray-400 uppercase bg-gray-100 px-2 py-0.5 rounded-md">
                  Enrolled
                </span>
              </div>

              {/* Revenue */}
              <span className="text-sm font-black text-gray-800">
                {t.revenue}
              </span>

              {/* Status */}
              <StatusBadge status={t.status} />

              {/* Actions */}
              <button className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-300 hover:text-gray-500 hover:bg-gray-100 transition-colors">
                <svg
                  className="w-4 h-4"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M12 5a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm0 7a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm0 7a1.5 1.5 0 110-3 1.5 1.5 0 010 3z" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      </div>
    </MainLayout>
  );
}
