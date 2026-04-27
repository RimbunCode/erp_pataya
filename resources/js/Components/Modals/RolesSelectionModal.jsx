import { useState } from "react";
import Link from "@/Components/Link";
import { router } from "@inertiajs/react";

const roles = [
  {
    key: "student",
    label: "Student",
    desc: "Access your courses, track progress, and get certified.",
    href: "/login/student",
    iconBg: "bg-blue-100",
    iconColor: "text-blue-600",
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
    href: "/login/instructor",
    iconBg: "bg-purple-100",
    iconColor: "text-purple-600",
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
    href: "/login/organization",
    iconBg: "bg-green-100",
    iconColor: "text-green-600",
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
  {
    key: "admin",
    label: "Administrator",
    desc: "System-wide management, approvals, and CMS.",
    href: "/login/admin",
    iconBg: "bg-gray-100",
    iconColor: "text-gray-600",
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
          d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
        />
      </svg>
    ),
  },
  {
    key: "multi",
    label: "Student + Instructor",
    desc: "Testing multi-role access.",
    href: "/student/dashboard",
    iconBg: "bg-indigo-100",
    iconColor: "text-indigo-600",
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
          d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
        />
      </svg>
    ),
  },
];

const studentRole = {
  key: "student",
  label: "Student",
  desc: "Access your courses, track progress, and get certified.",
  iconBg: "bg-blue-100",
  iconColor: "text-blue-600",
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
};

function StepSelectRole({ onSelect, onSwitchToRegister }) {
  return (
    <>
      <h2 className="text-2xl font-black text-gray-900 uppercase tracking-tight mb-1">
        Select Your Access Portal
      </h2>
      <p className="text-sm text-gray-400 mb-7">
        Please choose the role you would like to explore for this demonstration.
      </p>

      <div className="flex flex-col divide-y divide-gray-100">
        {roles.map((role) => (
          <button
            key={role.key}
            onClick={() => onSelect(role)}
            className="flex items-center gap-4 py-4 group hover:bg-gray-50 -mx-2 px-2 rounded-xl transition-colors text-left w-full"
          >
            <div
              className={`w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 ${role.iconBg} ${role.iconColor}`}
            >
              {role.icon}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-black text-gray-900 uppercase tracking-wide">
                {role.label}
              </p>
              <p className="text-xs text-gray-400 mt-0.5 leading-snug">
                {role.desc}
              </p>
            </div>
            <svg
              className="w-4 h-4 text-gray-300 group-hover:text-blue-500 transition-colors flex-shrink-0"
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
        ))}
      </div>

      <div className="flex items-center justify-between mt-7 pt-5 border-t border-gray-100">
        <span className="text-[10px] font-bold tracking-widest text-gray-300 uppercase">
          Don't have an account?
        </span>
        <button
          onClick={onSwitchToRegister}
          className="text-[10px] font-extrabold tracking-widest text-blue-600 hover:text-blue-700 uppercase transition-colors"
        >
          Register Here
        </button>
      </div>
    </>
  );
}

function StepLogin({ role, onSwitchToRegister }) {
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({
    usernameOrEmail: "",
    password: "",
    remember: false,
  });
  const [loading, setLoading] = useState(false);

  const handleLogin = () => {
    router.post("/mock-login", { role: role.key });
  };

  return (
    <>
      <div
        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl mb-5 ${role.iconBg}`}
      >
        <span className={`w-4 h-4 ${role.iconColor}`}>{role.icon}</span>
        <span
          className={`text-[10px] font-extrabold tracking-widest uppercase ${role.iconColor}`}
        >
          {role.label}
        </span>
      </div>

      <h2 className="text-2xl font-black text-gray-900 uppercase tracking-tight mb-1">
        Welcome Back
      </h2>
      <p className="text-sm text-gray-400 mb-7">
        Sign in to your account to continue.
      </p>

      <div className="flex flex-col gap-4">
        <div>
          <label className="block text-[10px] font-bold tracking-[2px] text-gray-400 uppercase mb-2">
            Email or Username
          </label>
          <input
            type="text"
            value={form.usernameOrEmail}
            onChange={(e) =>
              setForm((p) => ({ ...p, usernameOrEmail: e.target.value }))
            }
            placeholder="email@example.com"
            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white hover:border-gray-300 shadow-sm transition-all"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-[10px] font-bold tracking-[2px] text-gray-400 uppercase">
              Password
            </label>
            <Link
              href="/forgot-password"
              className="text-[10px] font-bold tracking-widest text-blue-500 hover:text-blue-600 uppercase transition-colors"
            >
              Forgot Password?
            </Link>
          </div>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              value={form.password}
              onChange={(e) =>
                setForm((p) => ({ ...p, password: e.target.value }))
              }
              placeholder="••••••••"
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 pr-11 text-sm text-gray-800 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white hover:border-gray-300 shadow-sm transition-all"
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

        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={form.remember}
            onChange={(e) =>
              setForm((p) => ({ ...p, remember: e.target.checked }))
            }
            className="w-4 h-4 rounded border-gray-200 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-xs font-semibold text-gray-500">
            Remember me
          </span>
        </label>

        <button
          onClick={handleLogin}
          disabled={loading || !form.usernameOrEmail || !form.password}
          className={`w-full font-extrabold tracking-widest uppercase text-xs py-4 rounded-xl flex items-center justify-center gap-2 transition-all duration-300 mt-2
            ${
              loading || !form.usernameOrEmail || !form.password
                ? "bg-gray-100 text-gray-300 cursor-not-allowed"
                : "bg-blue-600 hover:bg-blue-700 text-white hover:-translate-y-0.5 shadow-md shadow-blue-200"
            }`}
        >
          {loading ? (
            <>
              <svg
                className="w-4 h-4 animate-spin"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v8z"
                />
              </svg>
              Signing In...
            </>
          ) : (
            "Sign In"
          )}
        </button>
      </div>

      <div className="flex items-center justify-between mt-7 pt-5 border-t border-gray-100">
        <span className="text-[10px] font-bold tracking-widest text-gray-300 uppercase">
          Don't have an account?
        </span>
        <button
          onClick={onSwitchToRegister}
          className="text-[10px] font-extrabold tracking-widest text-blue-600 hover:text-blue-700 uppercase transition-colors"
        >
          Register Here
        </button>
      </div>
    </>
  );
}

export default function LoginModal({ onClose, onSwitchToRegister }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{
        backgroundColor: "rgba(0,0,0,0.5)",
        backdropFilter: "blur(6px)",
      }}
    >
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg p-8 relative">
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
          <span className="text-xs font-extrabold tracking-widest text-black uppercase">
            INKINDO Login
          </span>
        </div>

        <StepLogin role={studentRole} onSwitchToRegister={onSwitchToRegister} />
      </div>
    </div>
  );
}
