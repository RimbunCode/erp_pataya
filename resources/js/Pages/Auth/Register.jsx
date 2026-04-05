import { CardContent, CardHeader, CardTitle } from "@/Components/ui/card";
import { CheckIcon, EyeIcon, EyeOffIcon, XIcon } from "lucide-react";
import { Head, useForm } from "@inertiajs/react";
import { useMemo, useState } from "react";

import { Button } from "@/Components/ui/button";
import { CardDescription } from "@/Components/ui/card";
import GuestLayout from "@/Layouts/GuestLayout";
import { Input } from "@/Components/ui/input";
import InputError from "@/Components/InputError";
import { Label } from "@/Components/ui/label";
import Link from "@/Components/Link";
import { Skeleton } from "@/Components/ui/skeleton";
import ToggleTheme from "@/Components/ToggleTheme";
import { useLaravelReactI18n } from "laravel-react-i18n";

export default function Register() {
  const { t, loading } = useLaravelReactI18n();
  const route = window.route;
  const { data, setData, post, processing, errors, reset } = useForm({
    name: "",
    username: "",
    email: "",
    password: "",
    password_confirmation: "",
  });

  const submit = (e) => {
    e.preventDefault();

    post(route("register"), {
      onFinish: () => reset("password", "password_confirmation"),
    });
  };
  const [isVisible, setIsVisible] = useState(false);
  const toggleVisibility = () => setIsVisible((prevState) => !prevState);
  const checkStrength = (pass) => {
    const requirements = [
      {
        regex: /.{8,}/,
        text: t("auth.register.password.strengths.requirements.length"),
      },
      {
        regex: /[0-9]/,
        text: t("auth.register.password.strengths.requirements.num"),
      },
      {
        regex: /[a-z]/,
        text: t("auth.register.password.strengths.requirements.lowercase"),
      },
      {
        regex: /[A-Z]/,
        text: t("auth.register.password.strengths.requirements.uppercase"),
      },
      {
        regex: /[!@#$%^&*(),.?":{}|<>]/,
        text: t("auth.register.password.strengths.requirements.special"),
      },
    ];
    return requirements.map((req) => ({
      met: req.regex.test(pass),
      text: req.text,
    }));
  };
  const strength = checkStrength(data.password);
  const strengthScore = useMemo(() => {
    return strength.filter((req) => req.met).length;
  }, [strength]);
  const getStrengthColor = (score) => {
    if (score === 0) return "bg-border";
    if (score <= 1) return "bg-red-500";
    if (score <= 2) return "bg-orange-500";
    if (score <= 3) return "bg-amber-500";
    if (score <= 4) return "bg-green-500";
    return "bg-emerald-500";
  };
  const getStrengthText = (score) => {
    if (score === 0) return "";
    if (score <= 2) return t("auth.register.password.strengths.status.weak");
    if (score <= 3) return t("auth.register.password.strengths.status.medium");
    if (score <= 4) return t("auth.register.password.strengths.status.good");
    return t("auth.register.password.strengths.status.strong");
  };
  return (
    <GuestLayout>
      <Head title="Register" />
      <CardHeader>
        <div className="flex items-center justify-between gap-x-4">
          <div className="flex flex-col gap-y-2">
            <CardTitle className="text-xl">
              {loading ? (
                <Skeleton className="w-52 h-7" />
              ) : (
                t("auth.register.title")
              )}
            </CardTitle>
            <CardDescription>
              {loading ? (
                <Skeleton className="w-full h-7" />
              ) : (
                t("auth.register.description")
              )}
            </CardDescription>
          </div>
          <ToggleTheme className="size-4" />
        </div>
      </CardHeader>
      <CardContent className="pt-0!">
        <form onSubmit={submit}>
          <div className="grid gap-6">
            <div className="grid gap-6">
              <div className="grid gap-2">
                <Label htmlFor="username">
                  {loading ? (
                    <Skeleton className="w-52 h-7" />
                  ) : (
                    t("auth.register.name")
                  )}
                </Label>
                <Input
                  isFocused={true}
                  id="name"
                  type="text"
                  name="name"
                  autoComplete="name"
                  value={data.name}
                  onChange={(e) => setData("name", e.target.value)}
                  required
                />
                <InputError message={errors.name} className="mt-2" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="username">
                  {loading ? (
                    <Skeleton className="w-52 h-7" />
                  ) : (
                    t("auth.register.username")
                  )}
                </Label>
                <Input
                  id="username"
                  type="text"
                  name="username"
                  autoComplete="username"
                  value={data.username}
                  onChange={(e) => setData("username", e.target.value)}
                  required
                />
                <InputError message={errors.username} className="mt-2" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="email">
                  {loading ? (
                    <Skeleton className="w-52 h-7" />
                  ) : (
                    t("auth.register.email")
                  )}
                </Label>
                <Input
                  id="email"
                  type="email"
                  name="email"
                  autoComplete="email"
                  value={data.email}
                  onChange={(e) => setData("email", e.target.value)}
                  required
                />
                <InputError message={errors.email} className="mt-2" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="password">
                  {loading ? (
                    <Skeleton className="w-52 h-7" />
                  ) : (
                    t("auth.register.password")
                  )}
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={isVisible ? "text" : "password"}
                    name="password"
                    autoComplete="password"
                    value={data.password}
                    onChange={(e) => setData("password", e.target.value)}
                    required
                  />{" "}
                  <button
                    aria-controls="password"
                    aria-label={isVisible ? "Hide password" : "Show password"}
                    aria-pressed={isVisible}
                    className="text-muted-foreground/80 hover:text-foreground focus-visible:border-ring focus-visible:ring-ring/50 absolute inset-y-0 inset-e-0 flex h-full w-9 items-center justify-center rounded-e-md transition-[color,box-shadow] outline-none focus:z-10 focus-visible:ring-[3px] disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50"
                    onClick={toggleVisibility}
                    type="button"
                  >
                    {isVisible ? (
                      <EyeOffIcon className="size-3.5" aria-hidden="true" />
                    ) : (
                      <EyeIcon className="size-3.5" aria-hidden="true" />
                    )}
                  </button>
                </div>
                <InputError message={errors.password} className="" />
                <div className="mt-2 flex items-center justify-between">
                  <p
                    className="text-foreground text-sm font-medium"
                    id={`password-description`}
                  >
                    {getStrengthText(strengthScore)}
                  </p>
                </div>
                <div
                  aria-label="Password strength"
                  aria-valuemax={5}
                  aria-valuemin={0}
                  aria-valuenow={strengthScore}
                  className="mb-3 flex gap-1"
                  role="progressbar"
                >
                  {[...Array(5)].map((_, i) => (
                    <div
                      key={i}
                      className={`h-1 flex-1 rounded-full transition-colors duration-500 ${
                        i < strengthScore
                          ? getStrengthColor(strengthScore)
                          : "bg-border"
                      }`}
                    />
                  ))}
                </div>
                <ul aria-label="Password requirements" className="space-y-1.5">
                  {strength.map((req) => (
                    <li className="flex items-center gap-1" key={req.text}>
                      {req.met ? (
                        <CheckIcon
                          className="size-3.5 text-emerald-500"
                          aria-hidden="true"
                        />
                      ) : (
                        <XIcon
                          className="text-muted-foreground/60 size-3.5"
                          aria-hidden="true"
                        />
                      )}
                      <span
                        className={`text-xs transition-colors ${req.met ? "text-emerald-600" : "text-muted-foreground"}`}
                      >
                        {req.text}
                        <span className="sr-only">
                          {req.met
                            ? " - Requirement met"
                            : " - Requirement not met"}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="password_confirmation">
                  {loading ? (
                    <Skeleton className="w-52 h-7" />
                  ) : (
                    t("auth.register.confirm_password")
                  )}
                </Label>
                <Input
                  id="password_confirmation"
                  type="password"
                  name="password_confirmation"
                  autoComplete="password_confirmation"
                  value={data.password_confirmation}
                  onChange={(e) =>
                    setData("password_confirmation", e.target.value)
                  }
                  required
                />
                <InputError
                  message={errors.password_confirmation}
                  className="mt-2"
                />
              </div>
              <Button type="submit" className="w-full" disabled={processing}>
                {loading ? (
                  <Skeleton className="w-52 h-7" />
                ) : (
                  t("auth.register.button")
                )}
              </Button>
            </div>
            <div className="relative flex justify-center text-sm after:absolute after:inset-0 after:top-1/2 after:z-0 after:flex after:items-center after:border-t after:border-border">
              <span className="relative z-10 px-2 bg-background text-muted-foreground">
                {loading ? (
                  <Skeleton className="w-32 h-7" />
                ) : (
                  t("auth.register.or")
                )}
              </span>
            </div>
            <div className="flex flex-col gap-4">
              <Button variant="outline" className="w-full" asChild>
                <a href={route("auth.login-provider", "google")}>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                    <path
                      d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"
                      fill="currentColor"
                    />
                  </svg>
                  {loading ? (
                    <Skeleton className="w-32 h-7" />
                  ) : (
                    t("auth.register.google")
                  )}
                </a>
              </Button>
            </div>
            {loading ? (
              <Skeleton className="mx-auto w-44 h-7" />
            ) : (
              <div className="text-sm text-center">
                {t("auth.register.login")}{" "}
                <Link
                  href={route("login")}
                  className="underline underline-offset-4"
                >
                  {t("auth.register.loginLink")}
                </Link>
              </div>
            )}
          </div>
        </form>
      </CardContent>
    </GuestLayout>
  );
}
