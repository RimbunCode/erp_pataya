// resources/js/Pages/Organization/PartnerTrainers.jsx

import { useState } from "react";
import MainLayout from "@/Layouts/MainLayout";

const trainers = [
  {
    id: 1,
    name: "Ir. Ahmad Sudirman",
    expertise: "BIM & Digital Twin",
    courses: 4,
    students: 312,
    rating: 4.9,
    status: "active",
    tier: "Platinum",
    tierColor: "text-amber-500 bg-amber-50 border-amber-200",
    initial: "A",
    color: "bg-blue-600",
    joined: "Jan 2023",
  },
  {
    id: 2,
    name: "Dr. Siti Aminah",
    expertise: "Project Management",
    courses: 3,
    students: 245,
    rating: 4.7,
    status: "active",
    tier: "Gold",
    tierColor: "text-yellow-600 bg-yellow-50 border-yellow-200",
    initial: "S",
    color: "bg-purple-600",
    joined: "Mar 2023",
  },
  {
    id: 3,
    name: "Prof. Bambang Sutrisno",
    expertise: "Structural Engineering",
    courses: 2,
    students: 189,
    rating: 4.8,
    status: "active",
    tier: "Gold",
    tierColor: "text-yellow-600 bg-yellow-50 border-yellow-200",
    initial: "B",
    color: "bg-green-600",
    joined: "Jun 2023",
  },
  {
    id: 4,
    name: "Ir. Hendra Wijaya",
    expertise: "AutoCAD & Design",
    courses: 2,
    students: 98,
    rating: 4.5,
    status: "inactive",
    tier: "Silver",
    tierColor: "text-gray-500 bg-gray-50 border-gray-200",
    initial: "H",
    color: "bg-orange-500",
    joined: "Sep 2023",
  },
  {
    id: 5,
    name: "Dr. Rina Kusuma",
    expertise: "Green Building",
    courses: 1,
    students: 67,
    rating: 4.6,
    status: "pending",
    tier: "Silver",
    tierColor: "text-gray-500 bg-gray-50 border-gray-200",
    initial: "R",
    color: "bg-teal-500",
    joined: "Nov 2023",
  },
];

const statusConfig = {
  active: {
    label: "Active",
    color: "text-green-600",
    bg: "bg-green-50",
    dot: "bg-green-500",
  },
  inactive: {
    label: "Inactive",
    color: "text-gray-400",
    bg: "bg-gray-100",
    dot: "bg-gray-300",
  },
  pending: {
    label: "Pending",
    color: "text-amber-500",
    bg: "bg-amber-50",
    dot: "bg-amber-400",
  },
};

function InviteTrainerModal({ onClose }) {
  const [form, setForm] = useState({
    name: "",
    email: "",
    expertise: "",
    tier: "",
  });
  const isComplete =
    form.name.trim() &&
    form.email.trim() &&
    form.expertise.trim() &&
    form.tier.trim();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{
        backgroundColor: "rgba(0,0,0,0.5)",
        backdropFilter: "blur(6px)",
      }}
    >
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md relative overflow-hidden">
        <div className="h-1.5 w-full bg-gradient-to-r from-blue-600 to-indigo-500" />
        <div className="p-8">
          <button
            onClick={onClose}
            className="absolute top-6 right-6 text-gray-300 hover:text-gray-500 transition-colors"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>

          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center">
              <svg
                className="w-5 h-5 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
                />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-black text-gray-700 uppercase tracking-tight">
                Invite Trainer
              </h3>
              <p className="text-xs text-gray-400">
                Send an invitation to a partner trainer.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            {[
              {
                label: "Full Name",
                name: "name",
                type: "text",
                placeholder: "e.g. Dr. Budi Santoso",
              },
              {
                label: "Email Address",
                name: "email",
                type: "email",
                placeholder: "trainer@example.com",
              },
              {
                label: "Area of Expertise",
                name: "expertise",
                type: "text",
                placeholder: "e.g. BIM Specialist",
              },
            ].map((f) => (
              <div key={f.name}>
                <label className="block text-[10px] font-bold tracking-[2px] text-gray-400 uppercase mb-2">
                  {f.label}
                </label>
                <input
                  type={f.type}
                  placeholder={f.placeholder}
                  value={form[f.name]}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, [f.name]: e.target.value }))
                  }
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-600 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white hover:border-gray-300 shadow-sm transition-all"
                />
              </div>
            ))}

            <div>
              <label className="block text-[10px] font-bold tracking-[2px] text-gray-400 uppercase mb-2">
                Partnership Tier
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  {
                    value: "Silver",
                    label: "Silver",
                    sub: "15% Share",
                    color: "border-gray-300 text-gray-500",
                  },
                  {
                    value: "Gold",
                    label: "Gold",
                    sub: "22% Share",
                    color: "border-yellow-300 text-yellow-600",
                  },
                  {
                    value: "Platinum",
                    label: "Platinum",
                    sub: "30% Share",
                    color: "border-amber-400 text-amber-500",
                  },
                ].map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setForm((p) => ({ ...p, tier: t.value }))}
                    className={`py-3 px-2 rounded-xl border-2 text-center transition-all duration-200
                      ${
                        form.tier === t.value
                          ? `${t.color} bg-opacity-10 shadow-sm scale-105`
                          : "border-gray-100 text-gray-400 hover:border-gray-200"
                      }`}
                  >
                    <p
                      className={`text-xs font-extrabold tracking-widest uppercase ${form.tier === t.value ? t.color.split(" ")[1] : "text-gray-400"}`}
                    >
                      {t.label}
                    </p>
                    <p className="text-[10px] text-gray-400 mt-0.5">{t.sub}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex gap-3 mt-7">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-3 text-xs font-extrabold tracking-widest text-gray-400 uppercase border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              disabled={!isComplete}
              className={`flex-1 px-4 py-3 text-xs font-extrabold tracking-widest uppercase rounded-xl transition-all duration-200
                ${
                  isComplete
                    ? "bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-200 hover:-translate-y-0.5"
                    : "bg-gray-100 text-gray-300 cursor-not-allowed"
                }`}
            >
              Send Invitation
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function TrainerDetailModal({ trainer, onClose }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{
        backgroundColor: "rgba(0,0,0,0.5)",
        backdropFilter: "blur(6px)",
      }}
    >
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md relative overflow-hidden">
        <div className="h-1.5 w-full bg-gradient-to-r from-blue-600 to-indigo-500" />

        {/* Header dark */}
        <div
          className="px-8 pt-8 pb-6 flex items-center gap-4"
          style={{
            background: "linear-gradient(135deg, #0f172a 60%, #1e3a8a 100%)",
          }}
        >
          <button
            onClick={onClose}
            className="absolute top-6 right-6 text-white/40 hover:text-white transition-colors"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>

          <div
            className={`w-16 h-16 rounded-2xl ${trainer.color} flex items-center justify-center text-white text-2xl font-black flex-shrink-0`}
          >
            {trainer.initial}
          </div>
          <div>
            <h3 className="text-lg font-black text-white">{trainer.name}</h3>
            <p className="text-xs text-white/50 mt-0.5">{trainer.expertise}</p>
            <div className="flex items-center gap-2 mt-2">
              <span
                className={`text-[10px] font-extrabold tracking-widest uppercase px-2.5 py-1 rounded-lg border ${trainer.tierColor}`}
              >
                {trainer.tier}
              </span>
              <span
                className={`flex items-center gap-1 text-[10px] font-extrabold tracking-widest uppercase px-2.5 py-1 rounded-lg ${statusConfig[trainer.status].bg} ${statusConfig[trainer.status].color}`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${statusConfig[trainer.status].dot}`}
                />
                {statusConfig[trainer.status].label}
              </span>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 divide-x divide-gray-100 border-b border-gray-100">
          {[
            { label: "Courses", value: trainer.courses },
            { label: "Students", value: trainer.students },
            { label: "Rating", value: trainer.rating },
          ].map((s) => (
            <div key={s.label} className="text-center py-5">
              <p className="text-2xl font-black text-gray-700">{s.value}</p>
              <p className="text-[10px] font-bold tracking-[2px] text-gray-400 uppercase mt-1">
                {s.label}
              </p>
            </div>
          ))}
        </div>

        <div className="p-8 flex flex-col gap-4">
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">
              Member Since
            </span>
            <span className="text-sm font-bold text-gray-700">
              {trainer.joined}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">
              Profit Share
            </span>
            <span className="text-sm font-bold text-gray-700">
              {trainer.tier === "Platinum"
                ? "30%"
                : trainer.tier === "Gold"
                  ? "22%"
                  : "15%"}
            </span>
          </div>

          <div className="flex gap-3 mt-2">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-3 text-xs font-extrabold tracking-widest text-gray-400 uppercase border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
            >
              Close
            </button>
            <button className="flex-1 px-4 py-3 text-xs font-extrabold tracking-widest uppercase rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-200 hover:-translate-y-0.5 transition-all duration-200">
              Manage Trainer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function TrainerCard({ trainer, onClick }) {
  const [hovered, setHovered] = useState(false);
  const config = statusConfig[trainer.status];

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`bg-white rounded-2xl border-2 p-6 flex flex-col gap-4 cursor-pointer transition-all duration-200
        ${hovered ? "border-blue-500 shadow-lg shadow-blue-100 -translate-y-0.5" : "border-gray-100 shadow-lg shadow-gray-100"}`}
    >
      {/* Top row */}
      <div className="flex items-start justify-between">
        <div
          className={`w-14 h-14 rounded-2xl ${trainer.color} flex items-center justify-center text-white text-xl font-black flex-shrink-0`}
        >
          {trainer.initial}
        </div>
        <span
          className={`flex items-center gap-1.5 text-[10px] font-extrabold tracking-widest uppercase px-3 py-1.5 rounded-xl ${config.bg} ${config.color}`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
          {config.label}
        </span>
      </div>

      {/* Info */}
      <div>
        <h3 className="text-sm font-black text-gray-700 leading-tight">
          {trainer.name}
        </h3>
        <p className="text-xs text-gray-400 mt-1">{trainer.expertise}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "Courses", value: trainer.courses },
          { label: "Students", value: trainer.students },
          { label: "Rating", value: trainer.rating },
        ].map((s) => (
          <div
            key={s.label}
            className="bg-gray-50 rounded-xl p-2.5 text-center"
          >
            <p className="text-sm font-black text-gray-700">{s.value}</p>
            <p className="text-[9px] font-bold tracking-widest text-gray-400 uppercase mt-0.5">
              {s.label}
            </p>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-1 border-t border-gray-100">
        <span
          className={`text-[10px] font-extrabold tracking-widest uppercase px-2.5 py-1 rounded-lg border ${trainer.tierColor}`}
        >
          {trainer.tier}
        </span>
        <span className="text-[10px] font-bold text-gray-400">
          Since {trainer.joined}
        </span>
      </div>
    </div>
  );
}

export default function PartnerTrainers() {
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("All");
  const [showInvite, setShowInvite] = useState(false);
  const [selectedTrainer, setSelectedTrainer] = useState(null);

  const filtered = trainers.filter((t) => {
    const matchSearch =
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.expertise.toLowerCase().includes(search.toLowerCase());
    const matchStatus =
      filterStatus === "All" || t.status === filterStatus.toLowerCase();
    return matchSearch && matchStatus;
  });

  return (
    <MainLayout title="Partner Trainers" breadcrumb="Trainers">
      <div className="p-8 flex flex-col gap-6">
        {/* ── Header ── */}
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-black text-gray-700 uppercase tracking-tight">
              Partner Trainers
            </h2>
            <p className="text-sm text-gray-400 mt-1">
              Manage and monitor your affiliated instructors.
            </p>
          </div>
          <button
            onClick={() => setShowInvite(true)}
            className="flex items-center gap-2 px-5 py-3 text-xs font-extrabold tracking-widest uppercase bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-md shadow-blue-200 hover:-translate-y-0.5 transition-all duration-200"
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
                d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
              />
            </svg>
            Invite Trainer
          </button>
        </div>

        {/* ── Summary strip ── */}
        <div className="grid grid-cols-4 gap-4">
          {[
            {
              label: "Total Trainers",
              value: trainers.length,
              color: "text-blue-600",
              bg: "bg-blue-50",
            },
            {
              label: "Active",
              value: trainers.filter((t) => t.status === "active").length,
              color: "text-green-600",
              bg: "bg-green-50",
            },
            {
              label: "Pending",
              value: trainers.filter((t) => t.status === "pending").length,
              color: "text-amber-500",
              bg: "bg-amber-50",
            },
            {
              label: "Inactive",
              value: trainers.filter((t) => t.status === "inactive").length,
              color: "text-gray-400",
              bg: "bg-gray-100",
            },
          ].map((s) => (
            <div
              key={s.label}
              className={`${s.bg} rounded-2xl px-5 py-4 flex items-center gap-3`}
            >
              <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-widest leading-tight">
                {s.label}
              </p>
            </div>
          ))}
        </div>

        {/* ── Filters ── */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1">
            {["All", "Active", "Pending", "Inactive"].map((f) => (
              <button
                key={f}
                onClick={() => setFilterStatus(f)}
                className={`px-4 py-2 text-[10px] font-extrabold tracking-widest uppercase rounded-lg transition-all duration-200
                  ${
                    filterStatus === f
                      ? "bg-white text-blue-600 shadow-sm"
                      : "text-gray-400 hover:text-gray-600"
                  }`}
              >
                {f}
              </button>
            ))}
          </div>

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
              placeholder="Search trainers..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-4 py-2.5 text-xs bg-white border border-gray-200 rounded-xl w-52 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all placeholder-gray-300"
            />
          </div>
        </div>

        {/* ── Grid ── */}
        {filtered.length > 0 ? (
          <div className="grid grid-cols-3 gap-5">
            {filtered.map((trainer) => (
              <TrainerCard
                key={trainer.id}
                trainer={trainer}
                onClick={() => setSelectedTrainer(trainer)}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-20 bg-white rounded-2xl border border-gray-100">
            <p className="text-sm font-bold uppercase tracking-widest text-gray-300">
              No trainers found
            </p>
          </div>
        )}
      </div>

      {showInvite && (
        <InviteTrainerModal onClose={() => setShowInvite(false)} />
      )}
      {selectedTrainer && (
        <TrainerDetailModal
          trainer={selectedTrainer}
          onClose={() => setSelectedTrainer(null)}
        />
      )}
    </MainLayout>
  );
}
