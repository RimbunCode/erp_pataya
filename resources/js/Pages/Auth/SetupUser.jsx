import { Head, Link, useForm } from "@inertiajs/react";
import { useMemo, useState } from "react";
import AuthLayout from "@/Layouts/AuthLayout";
import InputError from "@/Components/InputError";
import PasswordChecker from "@/Components/PasswordChecker";
import PasswordInput from "@/Components/PasswordInput";
import ToggleTheme from "@/Components/ToggleTheme";
import { LogOutIcon } from "lucide-react";

function normalizeRoles(roles) {
  if (!Array.isArray(roles)) {
    return [];
  }

  return roles
    .map((role) => (typeof role === "string" ? role : role?.name))
    .filter((role) => typeof role === "string")
    .map((role) => role.toLowerCase());
}

export default function SetupUser({ user, hasPassword, isWaiting }) {
  const route = window.route;
  const [isVisible, setIsVisible] = useState(false);
  const initialHasInstructorRole = useMemo(() => {
    return normalizeRoles(user?.roles).includes("instructor");
  }, [user?.roles]);

  const { data, setData, put, processing, errors } = useForm({
    name: user?.name ?? "",
    username: user?.username ?? "",
    email: user?.email ?? "",
    wants_instructor: initialHasInstructorRole,
    current_password: "",
    password: "",
    password_confirmation: "",
  });

  const onSubmit = (event) => {
    event.preventDefault();
    put(route("setup.update"));
  };

  const shouldShowNewPasswordFields = data.current_password || !hasPassword;

  return (
    <AuthLayout className="max-w-lg border-none bg-transparent shadow-none mt-6">
      <Head title="Setup Account" />
      <div className="bg-card text-card-foreground rounded-3xl border border-border shadow-2xl w-full p-8">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-black text-foreground uppercase tracking-tight mb-1">
              Setup Account
            </h1>
            <p className="text-base text-muted-foreground">
              Complete your account details before continuing.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <ToggleTheme className="size-4" />
            <Link
              href={route("logout")}
              method="post"
              as="button"
              className="inline-flex items-center justify-center rounded-lg border border-border p-2 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <LogOutIcon className="size-4" />
            </Link>
          </div>
        </div>

        {isWaiting && (
          <div className="mb-6 rounded-xl border border-amber-300/60 bg-amber-50 px-4 py-3 text-amber-900 dark:border-amber-400/40 dark:bg-amber-950/40 dark:text-amber-200">
            <p className="text-sm font-bold uppercase tracking-wide">
              Waiting for Admin Approval
            </p>
            <p className="text-sm mt-1">
              Your account is still pending approval. You can update your data
              while waiting.
            </p>
          </div>
        )}

        <form onSubmit={onSubmit}>
          <div className="flex flex-col gap-4">
            <div>
              <label className="block text-xs font-bold tracking-[2px] text-muted-foreground uppercase mb-2">
                Full Name
              </label>
              <input
                id="name"
                type="text"
                name="name"
                autoComplete="name"
                value={data.name}
                onChange={(event) => setData("name", event.target.value)}
                required
                className="w-full bg-muted border border-border rounded-xl px-4 py-3 text-base text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:bg-card hover:border-border shadow-sm transition-all"
              />
              <InputError message={errors.name} className="mt-2" />
            </div>

            <div>
              <label className="block text-xs font-bold tracking-[2px] text-muted-foreground uppercase mb-2">
                Username
              </label>
              <input
                id="username"
                type="text"
                name="username"
                autoComplete="username"
                value={data.username}
                onChange={(event) => setData("username", event.target.value)}
                required
                className="w-full bg-muted border border-border rounded-xl px-4 py-3 text-base text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:bg-card hover:border-border shadow-sm transition-all"
              />
              <InputError message={errors.username} className="mt-2" />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-bold tracking-[2px] text-muted-foreground uppercase">
                  Email
                </label>
                <span
                  className={`text-xs font-bold uppercase tracking-wider ${
                    user?.email_verified_at
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-amber-600 dark:text-amber-400"
                  }`}
                >
                  {user?.email_verified_at ? "Verified" : "Not Verified"}
                </span>
              </div>
              <input
                id="email"
                type="email"
                name="email"
                autoComplete="email"
                value={data.email}
                onChange={(event) => setData("email", event.target.value)}
                required
                className="w-full bg-muted border border-border rounded-xl px-4 py-3 text-base text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:bg-card hover:border-border shadow-sm transition-all"
              />
              <InputError message={errors.email} className="mt-2" />
            </div>

            <label className="flex items-start gap-2 cursor-pointer select-none rounded-xl border border-border bg-muted/40 px-3 py-3">
              <input
                type="checkbox"
                checked={data.wants_instructor}
                onChange={(event) =>
                  setData("wants_instructor", event.target.checked)
                }
                className="mt-0.5 w-4 h-4 rounded border-border text-primary focus:ring-ring"
              />
              <span className="text-sm text-muted-foreground">
                Also enable <span className="font-semibold">Instructor</span>{" "}
                access for this account.
              </span>
            </label>
            <InputError message={errors.wants_instructor} className="mt-0.5" />

            {hasPassword && (
              <div>
                <label className="block text-xs font-bold tracking-[2px] text-muted-foreground uppercase mb-2">
                  Current Password
                </label>
                <PasswordInput
                  id="current_password"
                  name="current_password"
                  autoComplete="current-password"
                  value={data.current_password}
                  onChange={(event) =>
                    setData("current_password", event.target.value)
                  }
                  visible={isVisible}
                  onVisibleChange={setIsVisible}
                />
                <p className="text-xs text-muted-foreground mt-1.5">
                  Fill this if you want to update your password.
                </p>
                <InputError
                  message={errors.current_password}
                  className="mt-2"
                />
              </div>
            )}

            {shouldShowNewPasswordFields && (
              <>
                <div>
                  <label className="block text-xs font-bold tracking-[2px] text-muted-foreground uppercase mb-2">
                    New Password
                  </label>
                  <PasswordInput
                    id="password"
                    name="password"
                    autoComplete="new-password"
                    value={data.password}
                    onChange={(event) =>
                      setData("password", event.target.value)
                    }
                    required
                    visible={isVisible}
                    onVisibleChange={setIsVisible}
                  />
                  <InputError message={errors.password} className="mt-2" />
                  <PasswordChecker
                    password={data.password}
                    forceEnglish={true}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold tracking-[2px] text-muted-foreground uppercase mb-2">
                    Confirm New Password
                  </label>
                  <PasswordInput
                    id="password_confirmation"
                    name="password_confirmation"
                    autoComplete="new-password"
                    value={data.password_confirmation}
                    onChange={(event) =>
                      setData("password_confirmation", event.target.value)
                    }
                    required
                    visible={isVisible}
                    onVisibleChange={setIsVisible}
                  />
                  <InputError
                    message={errors.password_confirmation}
                    className="mt-2"
                  />
                </div>
              </>
            )}

            <button
              type="submit"
              disabled={processing}
              className={`w-full font-extrabold tracking-widest uppercase text-sm py-4 rounded-xl flex items-center justify-center gap-2 transition-all duration-300 mt-2 ${
                processing
                  ? "bg-muted text-muted-foreground/70 cursor-not-allowed"
                  : "bg-primary hover:bg-primary-hover text-primary-foreground hover:-translate-y-0.5 shadow-md shadow-primary/25"
              }`}
            >
              {processing ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </AuthLayout>
  );
}
