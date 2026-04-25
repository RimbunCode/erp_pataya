import { useState } from "react";
import Link from "@/Components/Link";

const roles = [
  {
    key: "student",
    label: "Student / Learner",
    desc: "Access your courses, track progress, and get certified.",
    note: "We recommend using your campus or school email address for easier verification.",
    iconBg: "bg-blue-100",
    iconColor: "text-blue-600",
    borderColor: "border-blue-500",
    activeBg: "bg-blue-50",
    icon: (
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
          d="M12 14l9-5-9-5-9 5 9 5z"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 14l6.16-3.422A12.083 12.083 0 0112 21.5a12.083 12.083 0 01-6.16-10.922L12 14z"
        />
      </svg>
    ),
  },
  {
    key: "instructor",
    label: "Instructor",
    desc: "Create courses, manage students, and view earnings.",
    note: "We recommend using your institutional or professional email for credibility and verification.",
    iconBg: "bg-purple-100",
    iconColor: "text-purple-600",
    borderColor: "border-purple-500",
    activeBg: "bg-purple-50",
    icon: (
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
          d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
        />
      </svg>
    ),
  },
  {
    key: "organization",
    label: "Organization",
    desc: "Manage affiliate trainers and corporate training.",
    note: "Please use your official organization or corporate email address for account verification.",
    iconBg: "bg-green-100",
    iconColor: "text-green-600",
    borderColor: "border-green-500",
    activeBg: "bg-green-50",
    icon: (
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
          d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
        />
      </svg>
    ),
  },
];

export default function RegisterModal({ onClose, onSwitchToLogin }) {
  const [form, setForm] = useState({
    fullName: "",
    nickname: "",
    email: "",
    password: "",
    confirmPassword: "",
    dobDay: "",
    dobMonth: "",
    dobYear: "",
  });
  const [selectedRole, setSelectedRole] = useState(null);

  const isFormComplete =
    form.fullName.trim() &&
    form.nickname.trim() &&
    form.email.trim() &&
    form.password.trim() &&
    form.confirmPassword.trim() &&
    form.dobDay &&
    form.dobMonth &&
    form.dobYear; // ← ganti dari dob

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    // reset role jika form diubah lagi
    setSelectedRole(null);
  };
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
    >
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg p-8 relative max-h-[90vh] overflow-y-auto">
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-gray-400 hover:text-gray-600 transition-colors"
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
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center">
            <svg
              className="w-5 h-5 text-white"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z" />
            </svg>
          </div>
          <span className="text-xl font-extrabold tracking-widest text-black uppercase">
            Create Account
          </span>
        </div>

        {/* Form Fields */}
        <div className="flex flex-col gap-4 mb-7">
          {/* Nama Lengkap */}
          <div>
            <label className="block text-[10px] font-bold tracking-[2px] text-black uppercase mb-2">
              Full Name
            </label>
            <input
              type="text"
              name="fullName"
              value={form.fullName}
              onChange={handleChange}
              placeholder="e.g. Budi Santoso"
              className="w-full bg-gray-50 border border-gray-250 rounded-xl px-4 py-3 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
            />
          </div>

          {/* Panggilan */}
          <div>
            <label className="block text-[10px] font-bold tracking-[2px] text-black uppercase mb-2">
              Nickname
            </label>
            <input
              type="text"
              name="nickname"
              value={form.nickname}
              onChange={handleChange}
              placeholder="e.g. Budi"
              className="w-full bg-gray-50 border border-gray-250 rounded-xl px-4 py-3 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
            />
          </div>

          {/* Email */}
          <div>
            <label className="block text-[10px] font-bold tracking-[2px] text-black uppercase mb-2">
              Email Address
            </label>
            <input
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              placeholder="john@example.com"
              className="w-full bg-gray-50 border border-gray-250 rounded-xl px-4 py-3 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
            />
          </div>

          {/* Password */}
          <div>
            <label className="block text-[10px] font-bold tracking-[2px] text-black uppercase mb-2">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                value={form.password}
                onChange={handleChange}
                placeholder="••••••••"
                className="w-full bg-gray-50 border border-gray-250 rounded-xl px-4 py-3 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 transition-colors"
              >
                {showPassword ? (
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
                      d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                    />
                  </svg>
                ) : (
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
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                    />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Confirm Password */}
          <div>
            <label className="block text-[10px] font-bold tracking-[2px] text-black uppercase mb-2">
              Confirm Password
            </label>
            <div className="relative">
              <input
                type={showConfirm ? "text" : "password"}
                name="confirmPassword"
                value={form.confirmPassword}
                onChange={handleChange}
                placeholder="••••••••"
                className={`w-full bg-gray-50 border rounded-xl px-4 py-3 pr-11 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:bg-white transition-all
        ${
          form.confirmPassword && form.password !== form.confirmPassword
            ? "border-red-300 focus:ring-red-400"
            : "border-gray-250 focus:ring-blue-500"
        }`}
              />
              <button
                type="button"
                onClick={() => setShowConfirm((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 transition-colors"
              >
                {showConfirm ? (
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
                      d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                    />
                  </svg>
                ) : (
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
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                    />
                  </svg>
                )}
              </button>
            </div>
            {/* Error message */}
            {form.confirmPassword && form.password !== form.confirmPassword && (
              <p className="mt-1.5 text-xs font-semibold text-red-400">
                Passwords do not match.
              </p>
            )}
          </div>

          {/* Tanggal Lahir */}
          <div>
            <label className="block text-[10px] font-bold tracking-[2px] text-black uppercase mb-2">
              Date of Birth
            </label>
            <div className="grid grid-cols-3 gap-2">
              <select
                name="dobDay"
                value={form.dobDay}
                onChange={handleChange}
                className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-3 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
              >
                <option value="">Day</option>
                {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>

              <select
                name="dobMonth"
                value={form.dobMonth}
                onChange={handleChange}
                className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-3 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
              >
                <option value="">Month</option>
                {[
                  "Jan",
                  "Feb",
                  "Mar",
                  "Apr",
                  "May",
                  "Jun",
                  "Jul",
                  "Aug",
                  "Sep",
                  "Oct",
                  "Nov",
                  "Dec",
                ].map((m, i) => (
                  <option key={m} value={i + 1}>
                    {m}
                  </option>
                ))}
              </select>

              <select
                name="dobYear"
                value={form.dobYear}
                onChange={handleChange}
                className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-3 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
              >
                <option value="">Year</option>
                {Array.from(
                  { length: 60 },
                  (_, i) => new Date().getFullYear() - i,
                ).map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Role Selection */}
        <div className="mb-7">
          <div className="flex items-center justify-between mb-3">
            <label className="block text-[10px] font-bold tracking-[2px] text-black uppercase">
              Select Your Role
            </label>
            {!isFormComplete && (
              <span className="text-[10px] font-semibold text-black uppercase tracking-widest">
                Please complete fields above to unlock
              </span>
            )}
          </div>

          <div className="grid grid-cols-3 gap-3">
            {roles.map((role) => {
              const isActive = selectedRole?.key === role.key;
              const isDisabled = !isFormComplete;

              return (
                <button
                  key={role.key}
                  onClick={() => !isDisabled && setSelectedRole(role)}
                  disabled={isDisabled}
                  className={`
                    relative flex flex-col items-center gap-2 p-4 rounded-2xl border-2 text-center transition-all duration-200
                    ${
                      isDisabled
                        ? "border-gray-100 bg-gray-50 opacity-40 cursor-not-allowed"
                        : isActive
                          ? `${role.borderColor} ${role.activeBg} shadow-sm`
                          : "border-gray-100 bg-white hover:border-gray-200 hover:bg-gray-50 cursor-pointer"
                    }
                  `}
                >
                  {/* Checkmark */}
                  {isActive && (
                    <div
                      className={`absolute top-2 right-2 w-4 h-4 rounded-full flex items-center justify-center ${role.iconBg}`}
                    >
                      <svg
                        className={`w-2.5 h-2.5 ${role.iconColor}`}
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
                  )}

                  <div
                    className={`w-12 h-12 rounded-2xl flex items-center justify-center ${role.iconBg} ${role.iconColor}`}
                  >
                    {role.icon}
                  </div>
                  <span
                    className={`text-[10px] font-extrabold tracking-wide uppercase leading-tight ${isActive ? role.iconColor : "text-gray-500"}`}
                  >
                    {role.label}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Role Note */}
          {selectedRole && (
            <div
              className={`mt-3 flex items-start gap-2 px-4 py-3 rounded-xl ${selectedRole.iconBg}`}
            >
              <svg
                className={`w-4 h-4 mt-0.5 flex-shrink-0 ${selectedRole.iconColor}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <p
                className={`text-xs font-semibold leading-snug ${selectedRole.iconColor}`}
              >
                {selectedRole.note}
              </p>
            </div>
          )}
        </div>

        {/* Submit */}
        <button
          disabled={!isFormComplete || !selectedRole}
          className={`w-full font-extrabold tracking-widest uppercase text-xs py-4 rounded-xl flex items-center justify-center gap-2 transition-all duration-300
            ${
              isFormComplete && selectedRole
                ? "bg-blue-600 hover:bg-blue-700 text-white hover:-translate-y-0.5 shadow-md shadow-blue-200 cursor-pointer"
                : "bg-gray-100 text-gray-300 cursor-not-allowed"
            }`}
        >
          Create Account
        </button>

        {/* Footer */}
        <div className="flex items-center justify-between mt-7 pt-5 border-t border-gray-100">
          <span className="text-[10px] font-bold tracking-widest text-gray-300 uppercase">
            Already have an account?
          </span>
          <button
            onClick={onSwitchToLogin}
            className="text-[10px] font-extrabold tracking-widest text-blue-600 hover:text-blue-700 uppercase transition-colors"
          >
            Sign In Here
          </button>
        </div>
      </div>
    </div>
  );
}
