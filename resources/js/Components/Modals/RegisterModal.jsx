import { useState, useEffect, useCallback } from "react";
import { router } from "@inertiajs/react";
import { format, setMonth, setYear } from "date-fns";
import DatetimePicker from "../DatetimePicker";
import { Input } from "../ui/input";
const CURRENT_YEAR = new Date().getFullYear();
const PASSWORD_MIN_LENGTH = 8;
const roles = [
  {
    key: "student",
    label: "Student / Learner",
    desc: "Access your courses, track progress, and get certified.",
    note: "We recommend using your campus or school email address for easier verification.",
    iconBg: "bg-blue-100 dark:bg-blue-500/20",
    iconColor: "text-blue-700 dark:text-blue-300",
    borderColor: "border-blue-500/70 dark:border-blue-400/70",
    activeBg: "bg-blue-50 dark:bg-blue-950/40",
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
    iconBg: "bg-violet-100 dark:bg-violet-500/20",
    iconColor: "text-violet-700 dark:text-violet-300",
    borderColor: "border-violet-500/70 dark:border-violet-400/70",
    activeBg: "bg-violet-50 dark:bg-violet-950/40",
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
];

export default function RegisterModal({ onClose, onSwitchToLogin }) {
  const route = window.route;
  const [errors, setErrors] = useState({});
  const [form, setForm] = useState({
    name: "",
    username: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    gender: "",
    birthdate: null,
  });
  const [selectedRole, setSelectedRole] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const isFormComplete =
    form.name.trim() &&
    form.email.trim() &&
    form.password.trim() &&
    form.confirmPassword.trim() &&
    form.password === form.confirmPassword;

  const isReadyToSubmit = isFormComplete && selectedRole;

  const handleSubmit = useCallback(() => {
    if (!isReadyToSubmit) return;

    if (form.password.length < PASSWORD_MIN_LENGTH) {
      setErrors((prev) => ({
        ...prev,
        password: `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`,
      }));
      return;
    }

    router.post(
      "/register",
      {
        name: form.name,
        username: form.username || undefined,
        email: form.email,
        phone: form.phone ? `+62${form.phone}` : undefined,
        password: form.password,
        password_confirmation: form.confirmPassword,
        role: selectedRole.key,
        gender: form.gender || undefined,
        birthdate: form.birthdate
          ? format(form.birthdate, "yyyy-MM-dd")
          : undefined,
      },
      { onError: (errors) => setErrors(errors) },
    );
  }, [form, selectedRole, isReadyToSubmit]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Enter") handleSubmit();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleSubmit]);

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setSelectedRole(null);
    setErrors((prev) => ({ ...prev, [e.target.name]: undefined }));
  };

  const handleBirthdate = (date) => {
    setForm((prev) => ({ ...prev, birthdate: date ?? null }));
    setSelectedRole(null);
  };

  const inputClass =
    "w-full bg-muted border border-border rounded-xl px-4 py-3 text-base text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:bg-card transition-all";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-background/70 backdrop-blur-sm">
      <div className="bg-card text-card-foreground rounded-3xl border border-border shadow-2xl w-full max-w-lg p-8 relative max-h-[90vh] overflow-y-auto">
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-muted-foreground hover:text-foreground transition-colors"
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
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
            <svg
              className="w-5 h-5 text-primary-foreground"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z" />
            </svg>
          </div>
          <span className="text-2xl font-extrabold tracking-widest text-foreground uppercase">
            Create Account
          </span>
        </div>

        {/* Google OAuth */}
        <div className="mb-6">
          <a
            href={route("auth.login-provider", "google")}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm font-bold tracking-widest text-foreground uppercase transition-all duration-300 hover:bg-muted hover:-translate-y-0.5"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              className="w-4 h-4"
              aria-hidden="true"
            >
              <path
                d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"
                fill="currentColor"
              />
            </svg>
            Login with Google
          </a>
          <div className="relative mt-4 flex justify-center text-xs font-bold tracking-widest text-muted-foreground uppercase after:absolute after:inset-0 after:top-1/2 after:border-t after:border-border">
            <span className="relative z-10 px-2 bg-card">
              or continue with email
            </span>
          </div>
        </div>

        {/* Form Fields */}
        <div className="flex flex-col gap-4 mb-7">
          {/* Full Name */}
          <div>
            <label className="block text-xs font-bold tracking-[2px] text-muted-foreground uppercase mb-2">
              Full Name <span className="text-destructive">*</span>
            </label>
            <Input
              type="text"
              name="name"
              value={form.name}
              onChange={handleChange}
              placeholder="e.g. Budi Santoso"
              className={inputClass}
            />
            {errors.name && (
              <p className="mt-1.5 text-sm font-semibold text-destructive">
                {errors.name}
              </p>
            )}
          </div>

          {/* Username */}
          <div>
            <label className="block text-xs font-bold tracking-[2px] text-muted-foreground uppercase mb-2">
              Username
            </label>
            <div className="relative">
              <Input
                type="text"
                name="username"
                value={form.username}
                onChange={handleChange}
                placeholder="budisantoso"
                className={`${inputClass}`}
              />
            </div>
            {errors.username && (
              <p className="mt-1.5 text-sm font-semibold text-destructive">
                {errors.username}
              </p>
            )}
          </div>

          {/* Email */}
          <div>
            <label className="block text-xs font-bold tracking-[2px] text-muted-foreground uppercase mb-2">
              Email Address <span className="text-destructive">*</span>
            </label>
            <Input
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              placeholder="john@example.com"
              className={inputClass}
            />
            {errors.email && (
              <p className="mt-1.5 text-sm font-semibold text-destructive">
                {errors.email}
              </p>
            )}
          </div>

          {/* Phone */}
          <div>
            <label className="block text-xs font-bold tracking-[2px] text-muted-foreground uppercase mb-2">
              Phone Number{" "}
              <span className="text-muted-foreground/50 font-semibold normal-case tracking-normal">
                (optional)
              </span>
            </label>
            <div className="flex rounded-xl overflow-hidden border border-border focus-within:ring-2 focus-within:ring-ring focus-within:bg-card transition-all">
              <span className="flex items-center px-4 bg-muted border-r border-border text-base font-semibold text-foreground select-none shrink-0">
                +62
              </span>
              <Input
                type="tel"
                name="phone"
                value={form.phone}
                onChange={(e) => {
                  let val = e.target.value
                    .replace(/^\+62/, "")
                    .replace(/^0/, "")
                    .replace(/\D/g, "")
                    .slice(0, 12);
                  setForm((prev) => ({ ...prev, phone: val }));
                  setSelectedRole(null);
                }}
                placeholder="812 3456 7890"
                maxLength={12}
                inputMode="numeric"
                className="flex-1 rounded-xl border-none bg-muted px-4 py-3 text-base text-foreground placeholder-muted-foreground focus:outline-none focus:ring-0"
              />
              {form.phone.length > 0 && (
                <span className="flex items-center pr-4 text-xs font-semibold tabular-nums text-muted-foreground/60 shrink-0 select-none">
                  {form.phone.length}/12
                </span>
              )}
            </div>
            {errors.phone && (
              <p className="mt-1.5 text-sm font-semibold text-destructive">
                {errors.phone}
              </p>
            )}
          </div>

          {/* Password */}
          <div>
            <label className="block text-xs font-bold tracking-[2px] text-muted-foreground uppercase mb-2">
              Password <span className="text-destructive">*</span>
            </label>
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                name="password"
                value={form.password}
                onChange={handleChange}
                placeholder="••••••••"
                className={`${inputClass} pr-11`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
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
            {errors.password ? (
              <p className="mt-1.5 text-sm font-semibold text-destructive">
                {errors.password}
              </p>
            ) : (
              <p className="mt-1.5 text-xs text-muted-foreground">
                Must be at least {PASSWORD_MIN_LENGTH} characters.
              </p>
            )}
          </div>

          {/* Confirm Password */}
          <div>
            <label className="block text-xs font-bold tracking-[2px] text-muted-foreground uppercase mb-2">
              Confirm Password <span className="text-destructive">*</span>
            </label>
            <div className="relative">
              <Input
                type={showConfirm ? "text" : "password"}
                name="confirmPassword"
                value={form.confirmPassword}
                onChange={handleChange}
                placeholder="••••••••"
                className={`${inputClass} pr-11 ${form.confirmPassword && form.password !== form.confirmPassword ? "border-destructive/60 focus:ring-destructive" : ""}`}
              />
              <button
                type="button"
                onClick={() => setShowConfirm((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
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
            {form.confirmPassword && form.password !== form.confirmPassword && (
              <p className="mt-1.5 text-sm font-semibold text-destructive">
                Passwords do not match.
              </p>
            )}
          </div>

          {/* Gender & Birthdate */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Gender */}
            <div>
              <label className="block text-xs font-bold tracking-[2px] text-muted-foreground uppercase mb-2">
                Gender{" "}
                <span className="text-muted-foreground/50 font-semibold normal-case tracking-normal">
                  (optional)
                </span>
              </label>
              <select
                name="gender"
                value={form.gender}
                onChange={handleChange}
                className="w-full bg-muted border border-border rounded-xl px-4 py-3 text-base text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:bg-card transition-all"
              >
                <option value="">Select gender</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
              {errors.gender && (
                <p className="mt-1.5 text-sm font-semibold text-destructive">
                  {errors.gender}
                </p>
              )}
            </div>

            {/* Birthdate — shadcn Popover + Calendar with custom Caption */}
            <div>
              <label className="block text-xs font-bold tracking-[2px] text-muted-foreground uppercase mb-2">
                Date of Birth{" "}
                <span className="text-muted-foreground/50 font-semibold normal-case tracking-normal">
                  (optional)
                </span>
              </label>
              <DatetimePicker
                placeholder="Select date of birth"
                type="date"
                value={form.birthdate}
                onValueChange={handleBirthdate}
                className="w-full bg-muted border border-border rounded-xl h-12 text-base text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:bg-card transition-all"
              />
              {errors.birthdate && (
                <p className="mt-1.5 text-sm font-semibold text-destructive">
                  {errors.birthdate}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Role Selection */}
        <div className="mb-7">
          <div className="flex items-center justify-between mb-3">
            <label className="block text-xs font-bold tracking-[2px] text-muted-foreground uppercase">
              Select Your Role
            </label>
            {!isFormComplete && (
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
                Complete fields above to unlock
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            {roles.map((role) => {
              const isActive = selectedRole?.key === role.key;
              const isDisabled = !isFormComplete;
              return (
                <button
                  key={role.key}
                  onClick={() => !isDisabled && setSelectedRole(role)}
                  disabled={isDisabled}
                  className={`relative flex flex-col items-center gap-2 p-4 rounded-2xl border-2 text-center transition-all duration-200
                    ${
                      isDisabled
                        ? "border-border bg-muted/50 opacity-50 cursor-not-allowed"
                        : isActive
                          ? `${role.borderColor} ${role.activeBg} shadow-sm`
                          : "border-border bg-card hover:border-primary/40 hover:bg-muted cursor-pointer"
                    }`}
                >
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
                    className={`text-xs font-extrabold tracking-wide uppercase leading-tight ${isActive ? role.iconColor : "text-muted-foreground"}`}
                  >
                    {role.label}
                  </span>
                </button>
              );
            })}
          </div>

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
          onClick={handleSubmit}
          disabled={!isReadyToSubmit}
          className={`w-full font-extrabold tracking-widest uppercase text-sm py-4 rounded-xl flex items-center justify-center gap-2 transition-all duration-300
            ${
              isReadyToSubmit
                ? "bg-primary hover:bg-primary-hover text-primary-foreground hover:-translate-y-0.5 shadow-md shadow-primary/25 cursor-pointer"
                : "bg-muted text-muted-foreground/70 cursor-not-allowed"
            }`}
        >
          Create Account
        </button>

        {/* Footer */}
        <div className="flex items-center justify-between mt-7 pt-5 border-t border-border">
          <span className="text-xs font-bold tracking-widest text-muted-foreground uppercase">
            Already have an account?
          </span>
          <button
            onClick={onSwitchToLogin}
            className="text-xs font-extrabold tracking-widest text-primary hover:text-primary-hover uppercase transition-colors"
          >
            Sign In Here
          </button>
        </div>
      </div>
    </div>
  );
}
