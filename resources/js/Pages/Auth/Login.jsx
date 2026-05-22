import {
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/Components/ui/card";
import { Head, Link, router, useForm } from "@inertiajs/react";
import { useMemo, useState } from "react";
import AuthLayout from "@/Layouts/AuthLayout";
import RoleSelectionCards from "@/Components/Auth/RoleSelectionCards";
import { pickAuthRoles } from "@/lib/authRoles";

function getErrorMessage(value) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

export default function Login() {
  const route = window.route;
  const [step, setStep] = useState("credentials");
  const [showPassword, setShowPassword] = useState(false);
  const [availableRoles, setAvailableRoles] = useState([]);
  const [precheckProcessing, setPrecheckProcessing] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [errors, setErrors] = useState({});
  const { data, setData } = useForm({
    usernameOrEmail: "",
    password: "",
    remember: false,
  });

  const canSubmit =
    Boolean(data.usernameOrEmail) &&
    Boolean(data.password) &&
    !precheckProcessing &&
    !processing;

  const contactAdminUrl = useMemo(
    () => getErrorMessage(errors.contact_admin_url) ?? "/contact",
    [errors],
  );

  const handleFinalLogin = (preferredRole = null) => {
    setErrors({});
    setProcessing(true);

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
          setErrors(formErrors);

          if (formErrors.preferred_role) {
            setStep("select-role");
            return;
          }

          setStep("credentials");
        },
        onFinish: () => {
          setProcessing(false);
        },
      },
    );
  };

  const handlePrecheck = async () => {
    setErrors({});
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

      handleFinalLogin(response.data?.auto_role ?? null);
    } catch (error) {
      setErrors(error?.response?.data?.errors ?? {});
      setStep("credentials");
    } finally {
      setPrecheckProcessing(false);
    }
  };

  return (
    <AuthLayout className="max-w-xl">
      <Head title="Login" />
      <CardHeader>
        <CardTitle className="text-xl">Welcome Back</CardTitle>
        <CardDescription>
          Login with your credential or Google account
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-2!">
        {step === "credentials" ? (
          <div className="grid gap-4">
            <div className="grid gap-2">
              <label className="text-sm font-medium">Username or Email</label>
              <input
                type="text"
                value={data.usernameOrEmail}
                onChange={(event) => {
                  setData("usernameOrEmail", event.target.value);
                  setErrors({});
                }}
                className="w-full rounded-lg border border-border bg-background px-3 py-2"
              />
              {getErrorMessage(errors.usernameOrEmail) && (
                <p className="text-sm text-destructive">
                  {getErrorMessage(errors.usernameOrEmail)}
                </p>
              )}
            </div>

            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Password</label>
                <Link
                  href={route("password.request")}
                  className="text-sm text-primary hover:underline"
                >
                  Forgot your password?
                </Link>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={data.password}
                  onChange={(event) => {
                    setData("password", event.target.value);
                    setErrors({});
                  }}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 pr-11"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground"
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
              {getErrorMessage(errors.password) && (
                <p className="text-sm text-destructive">
                  {getErrorMessage(errors.password)}
                </p>
              )}
            </div>

            <label className="inline-flex items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={data.remember}
                onChange={(event) => setData("remember", event.target.checked)}
              />
              Remember me
            </label>

            {getErrorMessage(errors.status) && (
              <p className="text-sm text-destructive">
                {getErrorMessage(errors.status)}
              </p>
            )}

            {getErrorMessage(errors.contact_admin_url) && (
              <a
                href={contactAdminUrl}
                className="text-sm font-semibold text-primary hover:underline"
              >
                Contact Admin
              </a>
            )}

            <button
              type="button"
              disabled={!canSubmit}
              onClick={handlePrecheck}
              className={`rounded-lg px-4 py-2 text-sm font-semibold ${
                canSubmit
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {precheckProcessing || processing ? "Checking..." : "Continue"}
            </button>

            <a
              href={route("auth.login-provider", "google")}
              className="inline-flex items-center justify-center rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted"
            >
              Login with Google
            </a>
          </div>
        ) : (
          <div className="grid gap-4">
            <p className="text-sm text-muted-foreground">
              Select a role to continue.
            </p>
            <RoleSelectionCards
              roles={availableRoles}
              compact={true}
              onSelect={(role) => handleFinalLogin(role.key)}
            />
            <button
              type="button"
              onClick={() => setStep("credentials")}
              className="text-sm font-medium text-primary hover:underline"
            >
              Back to credentials
            </button>
          </div>
        )}
      </CardContent>
    </AuthLayout>
  );
}
