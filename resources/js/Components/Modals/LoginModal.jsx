import { useMemo, useState } from "react";
import Link from "@/Components/Link";
import { router, useForm } from "@inertiajs/react";
import RoleSelectionCards from "@/Components/Auth/RoleSelectionCards";
import { pickAuthRoles } from "@/lib/authRoles";

function getErrorMessage(value) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

export default function LoginModal({ onClose, onSwitchToRegister }) {
  const route = window.route;
  const [showPassword, setShowPassword] = useState(false);
  const [step, setStep] = useState("credentials");
  const [precheckProcessing, setPrecheckProcessing] = useState(false);
  const [finalProcessing, setFinalProcessing] = useState(false);
  const [availableRoles, setAvailableRoles] = useState([]);
  const [localErrors, setLocalErrors] = useState({});
  const { data, setData } = useForm({
    usernameOrEmail: "",
    password: "",
    remember: false,
    preferred_role: null,
  });

  const mergedErrors = useMemo(() => ({ ...localErrors }), [localErrors]);

  const contactAdminUrl =
    getErrorMessage(mergedErrors.contact_admin_url) ?? "/contact";
  const hasContactAdminUrl = Boolean(
    getErrorMessage(mergedErrors.contact_admin_url),
  );

  const handlePrecheck = async () => {
    setLocalErrors({});
    setPrecheckProcessing(true);

    try {
      const response = await window.axios.post(route("login.roles"), {
        usernameOrEmail: data.usernameOrEmail,
        password: data.password,
      });

      const roles = pickAuthRoles(response.data?.roles ?? []);
      if (response.data?.requires_selection) {
        setAvailableRoles(roles);
        setStep("select-role");
        return;
      }

      await handleFinalLogin(response.data?.auto_role ?? null);
    } catch (error) {
      const responseErrors = error?.response?.data?.errors ?? {};
      setLocalErrors(responseErrors);
      setStep("credentials");
    } finally {
      setPrecheckProcessing(false);
    }
  };

  const handleFinalLogin = async (preferredRole) => {
    setLocalErrors({});
    setFinalProcessing(true);

    router.post(
      route("login"),
      {
        usernameOrEmail: data.usernameOrEmail,
        password: data.password,
        remember: data.remember,
        preferred_role: preferredRole,
      },
      {
        onError: (formErrors) => {
          setLocalErrors(formErrors);

          if (formErrors.preferred_role) {
            setStep("select-role");
            return;
          }

          setStep("credentials");
        },
        onFinish: () => {
          setFinalProcessing(false);
        },
      },
    );
  };

  const canSubmitCredentials =
    Boolean(data.usernameOrEmail) &&
    Boolean(data.password) &&
    !precheckProcessing &&
    !finalProcessing;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-background/70 backdrop-blur-sm">
      <div className="bg-card text-card-foreground rounded-3xl border border-border shadow-2xl w-full max-w-lg p-8 relative">
        <div className="flex items-center justify-between mb-6">
          {step === "select-role" ? (
            <button
              type="button"
              onClick={() => setStep("credentials")}
              className="flex items-center gap-1 text-xs font-bold tracking-widest text-muted-foreground hover:text-foreground uppercase transition-colors"
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
                  d="M15 19l-7-7 7-7"
                />
              </svg>
              Back
            </button>
          ) : (
            <div />
          )}

          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
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
        </div>

        {step === "credentials" && (
          <>
            <h2 className="text-2xl font-black text-foreground uppercase tracking-tight mb-1">
              Welcome Back
            </h2>
            <p className="text-base text-muted-foreground mb-7">
              Sign in with your credentials.
            </p>

            <div className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-bold tracking-[2px] text-muted-foreground uppercase mb-2">
                  Email or Username
                </label>
                <input
                  type="text"
                  value={data.usernameOrEmail}
                  onChange={(e) => {
                    setData("usernameOrEmail", e.target.value);
                    setLocalErrors({});
                  }}
                  placeholder="email@example.com"
                  className="w-full bg-muted border border-border rounded-xl px-4 py-3 text-base text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:bg-card hover:border-border shadow-sm transition-all"
                />
                {getErrorMessage(mergedErrors.usernameOrEmail) && (
                  <p className="mt-1.5 text-sm font-semibold text-destructive">
                    {getErrorMessage(mergedErrors.usernameOrEmail)}
                  </p>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-bold tracking-[2px] text-muted-foreground uppercase">
                    Password
                  </label>
                  <Link
                    href={route("password.request")}
                    className="text-xs font-bold tracking-widest text-primary hover:text-primary-hover uppercase transition-colors"
                  >
                    Forgot Password?
                  </Link>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={data.password}
                    onChange={(e) => {
                      setData("password", e.target.value);
                      setLocalErrors({});
                    }}
                    placeholder="••••••••"
                    className="w-full bg-muted border border-border rounded-xl px-4 py-3 pr-11 text-base text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:bg-card hover:border-border shadow-sm transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
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
                {getErrorMessage(mergedErrors.password) && (
                  <p className="mt-1.5 text-sm font-semibold text-destructive">
                    {getErrorMessage(mergedErrors.password)}
                  </p>
                )}
              </div>

              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={data.remember}
                  onChange={(e) => setData("remember", e.target.checked)}
                  className="w-4 h-4 rounded border-border text-primary focus:ring-ring"
                />
                <span className="text-sm font-semibold text-muted-foreground">
                  Remember me
                </span>
              </label>

              {getErrorMessage(mergedErrors.status) && (
                <p className="text-sm font-semibold text-destructive">
                  {getErrorMessage(mergedErrors.status)}
                </p>
              )}

              {hasContactAdminUrl && (
                <a
                  href={contactAdminUrl}
                  className="text-sm font-bold text-primary hover:text-primary-hover underline"
                >
                  Contact Admin
                </a>
              )}

              <button
                type="button"
                onClick={handlePrecheck}
                disabled={!canSubmitCredentials}
                className={`w-full font-extrabold tracking-widest uppercase text-sm py-4 rounded-xl flex items-center justify-center gap-2 transition-all duration-300 mt-2
                  ${
                    canSubmitCredentials
                      ? "bg-primary hover:bg-primary-hover text-primary-foreground hover:-translate-y-0.5 shadow-md shadow-primary/25"
                      : "bg-muted text-muted-foreground/70 cursor-not-allowed"
                  }`}
              >
                {precheckProcessing || finalProcessing
                  ? "Checking..."
                  : "Continue"}
              </button>

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
            </div>

            <div className="flex items-center justify-between mt-7 pt-5 border-t border-border">
              <span className="text-xs font-bold tracking-widest text-muted-foreground uppercase">
                Don&apos;t have an account?
              </span>
              <button
                type="button"
                onClick={onSwitchToRegister}
                className="text-xs font-extrabold tracking-widest text-primary hover:text-primary-hover uppercase transition-colors"
              >
                Register Here
              </button>
            </div>
          </>
        )}

        {step === "select-role" && (
          <>
            <h2 className="text-2xl font-black text-foreground uppercase tracking-tight mb-1">
              Choose Your Role
            </h2>
            <p className="text-base text-muted-foreground mb-7">
              Your account has multiple roles. Select one to continue.
            </p>

            <RoleSelectionCards
              roles={availableRoles}
              onSelect={(role) => handleFinalLogin(role.key)}
            />

            {getErrorMessage(mergedErrors.preferred_role) && (
              <p className="mt-3 text-sm font-semibold text-destructive">
                {getErrorMessage(mergedErrors.preferred_role)}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
