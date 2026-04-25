// resources/js/Pages/Instructor/GrowthAnalytics.jsx

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

// ── Data per timespan ──────────────────────────────
const dataMap = {
  "7D": [
    { label: "Mon", value: 3800 },
    { label: "Tue", value: 3200 },
    { label: "Wed", value: 6800 },
    { label: "Thu", value: 7200 },
    { label: "Fri", value: 6500 },
    { label: "Sat", value: 9800 },
    { label: "Sun", value: 11000 },
  ],
  "30D": [
    { label: "Jan", value: 4200 },
    { label: "Feb", value: 2800 },
    { label: "Mar", value: 5100 },
    { label: "Apr", value: 7800 },
    { label: "May", value: 6600 },
    { label: "Jun", value: 9200 },
  ],
  "90D": [
    { label: "Jan", value: 4200 },
    { label: "Feb", value: 2800 },
    { label: "Mar", value: 5100 },
    { label: "Apr", value: 7800 },
    { label: "May", value: 6600 },
    { label: "Jun", value: 9200 },
    { label: "Jul", value: 8400 },
    { label: "Aug", value: 10200 },
    { label: "Sep", value: 11800 },
  ],
  "1Y": [
    { label: "Jan", value: 4200 },
    { label: "Feb", value: 2800 },
    { label: "Mar", value: 5100 },
    { label: "Apr", value: 7800 },
    { label: "May", value: 6600 },
    { label: "Jun", value: 9200 },
    { label: "Jul", value: 8400 },
    { label: "Aug", value: 10200 },
    { label: "Sep", value: 11800 },
    { label: "Oct", value: 10500 },
    { label: "Nov", value: 13200 },
    { label: "Dec", value: 15800 },
  ],
};

const timespans = ["7D", "30D", "90D", "1Y"];

const timespanLabel = {
  "7D": "Last 7 Days",
  "30D": "Last 30 Days",
  "90D": "Last 90 Days",
  "1Y": "Last 1 Year",
};

const metrics = [
  {
    label: "Conversion Rate",
    value: "12.4%",
    growth: "+2.1%",
    positive: true,
  },
  {
    label: "Engagement",
    value: "84%",
    growth: "+5.4%",
    positive: true,
  },
  {
    label: "Churn Rate",
    value: "0.8%",
    growth: "-0.2%",
    positive: false,
  },
];

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white border border-gray-100 rounded-xl px-4 py-2.5 shadow-lg">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">
          {label}
        </p>
        <p className="text-sm font-black text-blue-600">
          {payload[0].value.toLocaleString()}
        </p>
      </div>
    );
  }
  return null;
};

export default function GrowthAnalytics() {
  const [activeSpan, setActiveSpan] = useState("30D");
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const chartData = dataMap[activeSpan];

  return (
    <MainLayout title="Growth Analytics" breadcrumb="Analytics">
      <div className="p-8 flex flex-col gap-6">
        {/* ── Header ── */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-black text-gray-700 uppercase tracking-tight">
              Growth Analytics
            </h2>
            <p className="text-sm text-gray-400 mt-1">
              Insights and performance tracking.
            </p>
          </div>

          {/* Timespan dropdown */}
          <div className="relative">
            <button
              onClick={() => setDropdownOpen((v) => !v)}
              className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-xs font-extrabold tracking-widest text-gray-600 uppercase hover:bg-gray-50 transition-colors shadow-sm"
            >
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
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              {timespanLabel[activeSpan]}
              <svg
                className={`w-3 h-3 text-gray-400 transition-transform duration-200 ${dropdownOpen ? "rotate-180" : ""}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>

            {dropdownOpen && (
              <div className="absolute right-0 top-11 bg-white border border-gray-100 rounded-xl shadow-lg py-1 z-10 w-40">
                {timespans.map((span) => (
                  <button
                    key={span}
                    onClick={() => {
                      setActiveSpan(span);
                      setDropdownOpen(false);
                    }}
                    className={`w-full text-left px-4 py-2.5 text-xs font-bold tracking-widest uppercase transition-colors
                      ${
                        activeSpan === span
                          ? "text-blue-600 bg-blue-50"
                          : "text-gray-500 hover:bg-gray-50"
                      }`}
                  >
                    {timespanLabel[span]}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Chart + Key Metrics ── */}
        <div className="grid grid-cols-3 gap-6">
          {/* Chart */}
          <div className="col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-sm font-black text-gray-700 uppercase tracking-widest">
                Performance Trend
              </h3>
              {/* Pill tabs */}
              <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1">
                {timespans.map((span) => (
                  <button
                    key={span}
                    onClick={() => setActiveSpan(span)}
                    className={`px-3 py-1.5 text-[10px] font-extrabold tracking-widest uppercase rounded-lg transition-all duration-200
                      ${
                        activeSpan === span
                          ? "bg-white text-blue-600 shadow-sm"
                          : "text-gray-400 hover:text-gray-600"
                      }`}
                  >
                    {span}
                  </button>
                ))}
              </div>
            </div>

            <ResponsiveContainer width="100%" height={300}>
              <AreaChart
                data={chartData}
                margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#f1f5f9"
                  vertical={false}
                />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10, fill: "#94a3b8", fontWeight: 600 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "#94a3b8", fontWeight: 600 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => (v === 0 ? "0" : `${v / 1000}k`)}
                />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="#2563eb"
                  strokeWidth={2.5}
                  fill="url(#colorValue)"
                  dot={false}
                  activeDot={{ r: 5, fill: "#2563eb", strokeWidth: 0 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Key Metrics */}
          <div
            className="rounded-2xl p-6 flex flex-col gap-5"
            style={{
              background: "linear-gradient(160deg, #0f172a 60%, #1e3a8a 100%)",
            }}
          >
            <h3 className="text-sm font-black text-white uppercase tracking-widest">
              Key Metrics
            </h3>

            <div className="flex flex-col gap-5 flex-1">
              {metrics.map((m) => (
                <div key={m.label} className="flex flex-col gap-1">
                  <p className="text-[10px] font-bold tracking-[2px] text-white/40 uppercase">
                    {m.label}
                  </p>
                  <div className="flex items-center justify-between">
                    <p className="text-2xl font-black text-white">{m.value}</p>
                    <span
                      className={`text-[10px] font-extrabold tracking-widest px-2 py-1 rounded-lg
                      ${
                        m.positive
                          ? "bg-green-500/20 text-green-400"
                          : "bg-red-500/20 text-red-400"
                      }`}
                    >
                      {m.growth}
                    </span>
                  </div>
                  <div className="h-px bg-white/10 mt-1" />
                </div>
              ))}
            </div>

            <button className="w-full bg-blue-600 hover:bg-blue-500 text-white text-xs font-extrabold tracking-widest uppercase py-3.5 rounded-xl transition-colors duration-200">
              Export Report
            </button>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
