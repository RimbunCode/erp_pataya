import { useState } from "react";
import MainLayout from "@/Layouts/MainLayout";

const assignedTrainers = [
  {
    id: 1,
    name: "Ahmad Junaidi",
    role: "Lead Instructor",
    initial: "A",
    color: "bg-blue-600",
  },
  {
    id: 2,
    name: "Siti Aminah",
    role: "Co-Instructor",
    initial: "S",
    color: "bg-blue-500",
  },
];

const allTrainers = [
  { id: 3, name: "Hendra Wijaya", expertise: "BIM Specialist" },
  { id: 4, name: "Rina Kusuma", expertise: "Project Management" },
  { id: 5, name: "Bambang Sutrisno", expertise: "Structural Engineering" },
  { id: 6, name: "Dewi Anggraini", expertise: "AutoCAD Expert" },
];

function SelectTrainersModal({ assigned, onClose }) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(assigned.map((t) => t.id));

  const filtered = allTrainers.filter(
    (t) =>
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.expertise.toLowerCase().includes(search.toLowerCase()),
  );

  const toggle = (id) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ backgroundColor: "rgba(0,0,0,0.4)" }}
    >
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 relative">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-gray-300 hover:text-gray-500 transition-colors"
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
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-black text-gray-700 uppercase tracking-tight">
              Select Trainers
            </h3>
            <p className="text-xs text-gray-400">
              Assign trainers to BIM Expert Masterclass
            </p>
          </div>
        </div>

        <div className="relative mb-4">
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
            placeholder="Name or Expertise..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-600 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white hover:border-gray-300 shadow-sm transition-all"
          />
        </div>

        <div className="flex flex-col gap-2 mb-6">
          {filtered.map((t) => {
            const isSelected = selected.includes(t.id);
            return (
              <button
                key={t.id}
                onClick={() => toggle(t.id)}
                className={`flex items-center gap-4 px-4 py-3 rounded-xl border-2 transition-all duration-200 text-left
                  ${isSelected ? "border-blue-500 bg-blue-50" : "border-gray-100 hover:border-gray-200 hover:bg-gray-50"}`}
              >
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center text-white text-sm font-black flex-shrink-0 ${isSelected ? "bg-blue-600" : "bg-gray-300"}`}
                >
                  {t.name.slice(0, 1)}
                </div>
                <div className="flex-1 min-w-0">
                  <p
                    className={`text-sm font-bold ${isSelected ? "text-blue-700" : "text-gray-700"}`}
                  >
                    {t.name}
                  </p>
                  <p className="text-xs text-gray-400">{t.expertise}</p>
                </div>
                {isSelected && (
                  <svg
                    className="w-4 h-4 text-blue-600 flex-shrink-0"
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
                )}
              </button>
            );
          })}
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 text-xs font-extrabold tracking-widest text-gray-400 uppercase border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 text-xs font-extrabold tracking-widest uppercase rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-200 hover:-translate-y-0.5 transition-all duration-200"
          >
            Confirm Selection
          </button>
        </div>
      </div>
    </div>
  );
}
function CreateNewClassModal({ onClose }) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    title: "",
    category: "",
    description: "",
    startDate: "",
    endDate: "",
    maxStudents: "",
    price: "",
    level: "",
  });

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const isStep1Complete =
    form.title.trim() && form.category.trim() && form.description.trim();

  const isStep2Complete =
    form.startDate.trim() &&
    form.endDate.trim() &&
    form.maxStudents.trim() &&
    form.price.trim() &&
    form.level.trim();

  const inputClass =
    "w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-600 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white hover:border-gray-300 shadow-sm transition-all";

  const labelClass =
    "block text-[10px] font-bold tracking-[2px] text-gray-400 uppercase mb-2";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{
        backgroundColor: "rgba(0,0,0,0.5)",
        backdropFilter: "blur(6px)",
      }}
    >
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg relative overflow-hidden">
        {/* Top accent */}
        <div className="h-1.5 w-full bg-gradient-to-r from-blue-600 to-indigo-500" />

        <div className="p-8">
          {/* Close */}
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

          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center flex-shrink-0">
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
                  d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-black text-gray-700 uppercase tracking-tight">
                Create New Class
              </h3>
              <p className="text-xs text-gray-400">
                Step {step} of 2 —{" "}
                {step === 1 ? "Basic Information" : "Schedule & Pricing"}
              </p>
            </div>
          </div>

          {/* Step indicator */}
          <div className="flex items-center gap-2 mb-7">
            {[1, 2].map((s) => (
              <div key={s} className="flex items-center gap-2 flex-1">
                <div
                  className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-black transition-all duration-300
                  ${
                    step === s
                      ? "bg-blue-600 text-white shadow-md shadow-blue-200"
                      : step > s
                        ? "bg-green-500 text-white"
                        : "bg-gray-100 text-gray-400"
                  }`}
                >
                  {step > s ? (
                    <svg
                      className="w-3.5 h-3.5"
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
                  ) : (
                    s
                  )}
                </div>
                <div
                  className={`flex-1 h-0.5 rounded-full transition-all duration-300 ${s === 1 ? (step > 1 ? "bg-green-400" : "bg-gray-100") : "bg-gray-100"}`}
                />
              </div>
            ))}
            <div
              className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-black transition-all duration-300
              ${
                step === 2
                  ? "bg-blue-600 text-white shadow-md shadow-blue-200"
                  : "bg-gray-100 text-gray-400"
              }`}
            >
              2
            </div>
          </div>

          {/* ── Step 1 ── */}
          {step === 1 && (
            <div className="flex flex-col gap-4">
              <div>
                <label className={labelClass}>Class Title</label>
                <input
                  type="text"
                  name="title"
                  value={form.title}
                  onChange={handleChange}
                  placeholder="e.g. BIM Expert Masterclass"
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>Category</label>
                <select
                  name="category"
                  value={form.category}
                  onChange={handleChange}
                  className={inputClass}
                >
                  <option value="">Select a category...</option>
                  <option value="bim">BIM & Digital Twin</option>
                  <option value="structural">Structural Engineering</option>
                  <option value="project">Project Management</option>
                  <option value="autocad">AutoCAD & Design</option>
                  <option value="safety">Safety Engineering</option>
                  <option value="green">Green Building</option>
                </select>
              </div>

              <div>
                <label className={labelClass}>Description</label>
                <textarea
                  name="description"
                  value={form.description}
                  onChange={handleChange}
                  rows={4}
                  placeholder="Describe the course objectives and what students will learn..."
                  className={`${inputClass} resize-none`}
                />
              </div>
            </div>
          )}

          {/* ── Step 2 ── */}
          {step === 2 && (
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Start Date</label>
                  <input
                    type="date"
                    name="startDate"
                    value={form.startDate}
                    onChange={handleChange}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>End Date</label>
                  <input
                    type="date"
                    name="endDate"
                    value={form.endDate}
                    onChange={handleChange}
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Max Students</label>
                  <input
                    type="number"
                    name="maxStudents"
                    value={form.maxStudents}
                    onChange={handleChange}
                    placeholder="e.g. 50"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Price (IDR)</label>
                  <input
                    type="number"
                    name="price"
                    value={form.price}
                    onChange={handleChange}
                    placeholder="e.g. 500000"
                    className={inputClass}
                  />
                </div>
              </div>

              <div>
                <label className={labelClass}>Difficulty Level</label>
                <div className="grid grid-cols-3 gap-3">
                  {["Beginner", "Intermediate", "Advanced"].map((lvl) => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => setForm((p) => ({ ...p, level: lvl }))}
                      className={`py-3 rounded-xl text-xs font-extrabold tracking-widest uppercase border-2 transition-all duration-200
                        ${
                          form.level === lvl
                            ? "border-blue-500 bg-blue-50 text-blue-600"
                            : "border-gray-100 text-gray-400 hover:border-gray-200 hover:bg-gray-50"
                        }`}
                    >
                      {lvl}
                    </button>
                  ))}
                </div>
              </div>

              {/* Summary */}
              {isStep2Complete && (
                <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 mt-1">
                  <p className="text-[10px] font-bold tracking-[2px] text-blue-400 uppercase mb-2">
                    Summary
                  </p>
                  <div className="flex flex-col gap-1.5">
                    <div className="flex justify-between">
                      <span className="text-xs font-semibold text-gray-500">
                        Title
                      </span>
                      <span className="text-xs font-bold text-gray-700">
                        {form.title}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-xs font-semibold text-gray-500">
                        Duration
                      </span>
                      <span className="text-xs font-bold text-gray-700">
                        {form.startDate} → {form.endDate}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-xs font-semibold text-gray-500">
                        Price
                      </span>
                      <span className="text-xs font-bold text-gray-700">
                        {new Intl.NumberFormat("id-ID", {
                          style: "currency",
                          currency: "IDR",
                          minimumFractionDigits: 0,
                        }).format(form.price)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-xs font-semibold text-gray-500">
                        Level
                      </span>
                      <span className="text-xs font-bold text-gray-700">
                        {form.level}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 mt-7">
            {step === 1 ? (
              <button
                onClick={onClose}
                className="flex-1 px-4 py-3 text-xs font-extrabold tracking-widest text-gray-400 uppercase border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            ) : (
              <button
                onClick={() => setStep(1)}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 text-xs font-extrabold tracking-widest text-gray-500 uppercase border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
              >
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
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
                Back
              </button>
            )}

            {step === 1 ? (
              <button
                disabled={!isStep1Complete}
                onClick={() => setStep(2)}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-xs font-extrabold tracking-widest uppercase rounded-xl transition-all duration-200
                  ${
                    isStep1Complete
                      ? "bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-200 hover:-translate-y-0.5"
                      : "bg-gray-100 text-gray-300 cursor-not-allowed"
                  }`}
              >
                Next Step
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
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </button>
            ) : (
              <button
                disabled={!isStep2Complete}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-xs font-extrabold tracking-widest uppercase rounded-xl transition-all duration-200
                  ${
                    isStep2Complete
                      ? "bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-200 hover:-translate-y-0.5"
                      : "bg-gray-100 text-gray-300 cursor-not-allowed"
                  }`}
              >
                Create Class
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
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function OrganizationDashboard() {
  const [showSelectTrainers, setShowSelectTrainers] = useState(false);
  const [trainerSearch, setTrainerSearch] = useState("");
  const [showCreateClass, setShowCreateClass] = useState(false);

  return (
    <MainLayout title="Affiliate Portal" breadcrumb="Dashboard">
      <div className="p-8 flex flex-col gap-8">
        {/* ── Header ── */}
        <div className="flex items-center gap-5">
          {/* Icon */}
          <div className="w-16 h-16 rounded-2xl bg-blue-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-blue-200">
            <svg
              className="w-8 h-8 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0H5m14 0h2M5 21H3m2 0v-3a1 1 0 011-1h2a1 1 0 011 1v3m4 0v-5a1 1 0 011-1h2a1 1 0 011 1v5"
              />
            </svg>
          </div>
          <div className="flex-1">
            <h2 className="text-3xl font-black text-gray-700 uppercase tracking-tight">
              Affiliate Portal
            </h2>
            <p className="text-base text-gray-400 mt-1">
              Manage your partner ecosystem and shared trainings.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button className="px-5 py-3 text-sm font-extrabold tracking-widest uppercase border-2 border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 transition-colors">
              Manage Profile
            </button>
            <button
              onClick={() => setShowCreateClass(true)}
              className="flex items-center gap-2 px-5 py-3 text-sm font-extrabold tracking-widest uppercase bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-md shadow-blue-200 hover:-translate-y-0.5 transition-all duration-200"
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
                  d="M12 4v16m8-8H4"
                />
              </svg>
              Create New Class
            </button>
          </div>
        </div>

        {/* ── Stats ── */}
        <div className="grid grid-cols-3 gap-5">
          {[
            {
              label: "Total Revenue",
              value: "Rp 2.45B",
              growth: "+8.4%",
              positive: true,
              iconBg: "bg-blue-50",
              icon: (
                <svg
                  className="w-7 h-7 text-blue-500"
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
              ),
            },
            {
              label: "Enrolled Students",
              value: "1,248",
              growth: "+122",
              positive: true,
              iconBg: "bg-purple-50",
              icon: (
                <svg
                  className="w-7 h-7 text-purple-500"
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
              label: "Success Rate",
              value: "94.2%",
              growth: "High",
              positive: true,
              iconBg: "bg-green-50",
              icon: (
                <svg
                  className="w-7 h-7 text-green-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                  />
                </svg>
              ),
            },
          ].map((s) => (
            <div
              key={s.label}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm p-7"
            >
              <div className="flex items-start justify-between mb-5">
                <div
                  className={`w-14 h-14 rounded-2xl ${s.iconBg} flex items-center justify-center`}
                >
                  {s.icon}
                </div>
                <p className="text-xs font-bold tracking-[2px] text-gray-400 uppercase">
                  {s.label}
                </p>
              </div>
              <p className="text-4xl font-black text-gray-700">{s.value}</p>
              <div className="flex items-center gap-1.5 mt-3">
                <svg
                  className="w-4 h-4 text-green-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                  />
                </svg>
                <span className="text-sm font-extrabold text-green-500">
                  {s.growth}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* ── Trainer Assignment ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-7">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-black text-gray-700 uppercase tracking-widest">
              Trainer Assignment
            </h3>
            <button
              onClick={() => setShowSelectTrainers(true)}
              className="flex items-center gap-2 px-4 py-2.5 text-xs font-extrabold tracking-widest uppercase border-2 border-blue-200 text-blue-600 rounded-xl hover:bg-blue-50 transition-colors"
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
                  d="M12 4v16m8-8H4"
                />
              </svg>
              Select Trainers
            </button>
          </div>

          {/* Selected Trainers */}
          <div className="mb-6">
            <p className="text-xs font-bold tracking-[2px] text-gray-400 uppercase mb-4">
              Selected Trainers for {'"BIM Expert Masterclass"'}
            </p>
            <div className="flex items-center gap-3 flex-wrap">
              {assignedTrainers.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center gap-3 px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl hover:border-blue-200 hover:bg-blue-50 transition-all duration-200 cursor-pointer"
                >
                  <div
                    className={`w-10 h-10 rounded-xl ${t.color} flex items-center justify-center text-white font-black text-sm flex-shrink-0`}
                  >
                    {t.initial}
                  </div>
                  <div>
                    <p className="text-sm font-black text-gray-700">{t.name}</p>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                      {t.role}
                    </p>
                  </div>
                </div>
              ))}

              {/* Add slot */}
              <button
                onClick={() => setShowSelectTrainers(true)}
                className="flex items-center justify-center w-16 h-16 rounded-2xl border-2 border-dashed border-gray-200 text-gray-300 hover:border-blue-400 hover:text-blue-400 transition-all duration-200"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 4v16m8-8H4"
                  />
                </svg>
              </button>
            </div>
          </div>

          <hr className="border-gray-100 mb-6" />

          {/* Search + Affiliate Tier */}
          <div className="grid grid-cols-2 gap-5">
            <div>
              <p className="text-xs font-bold tracking-[2px] text-gray-400 uppercase mb-2">
                Search Partner Instructors
              </p>
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
                  placeholder="Name or Expertise..."
                  value={trainerSearch}
                  onChange={(e) => setTrainerSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-600 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white hover:border-gray-300 shadow-sm transition-all"
                />
              </div>
            </div>

            <div>
              <p className="text-xs font-bold tracking-[2px] text-gray-400 uppercase mb-2">
                Affiliate Tier
              </p>
              <div className="flex items-center gap-3 px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl">
                <svg
                  className="w-5 h-5 text-blue-600 flex-shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
                  />
                </svg>
                <span className="text-sm font-extrabold text-blue-600">
                  Platinum Partner (30% Profit Share)
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showSelectTrainers && (
        <SelectTrainersModal
          assigned={assignedTrainers}
          onClose={() => setShowSelectTrainers(false)}
        />
      )}
      {showCreateClass && (
        <CreateNewClassModal onClose={() => setShowCreateClass(false)} />
      )}
    </MainLayout>
  );
}
