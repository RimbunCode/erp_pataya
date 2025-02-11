import {
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/Components/ui/card";
import { Head, Link, useForm } from "@inertiajs/react";

import { Button } from "@/Components/ui/button";
import { Checkbox } from "@/Components/ui/checkbox";
import GuestLayout from "@/Layouts/GuestLayout";
import { Input } from "@/Components/ui/input";
import { Label } from "@/Components/ui/label";
import ToggleTheme from "@/Components/ToggleTheme";
import { useLaravelReactI18n } from "laravel-react-i18n";
import { Skeleton } from "@/Components/ui/skeleton";

export default function Login() {
  const { t, loading } = useLaravelReactI18n();
  const route = window.route;
  // const { addToast } = useToasts();
  const { data, setData, post, processing, reset } = useForm({
    usernameOrEmail: "",
    password: "",
    remember: false,
  });

  const submit = (e) => {
    e.preventDefault();

    post(route("login"), {
      onFinish: () => reset("password"),
    });
  };

  return (
    <GuestLayout>
      <Head title="Login" />
      <CardHeader>
        <div className="flex items-center justify-between gap-x-4">
          <div className="flex flex-col gap-y-2">
            <CardTitle className="text-xl">
              {loading ? (
                <Skeleton className="w-52 h-7" />
              ) : (
                t("auth.login.title")
              )}
            </CardTitle>
            <CardDescription>
              {loading ? (
                <Skeleton className="w-full h-7" />
              ) : (
                t("auth.login.description")
              )}
            </CardDescription>
          </div>
          <ToggleTheme className="size-4" />
        </div>
      </CardHeader>
      <CardContent className="!pt-2">
        <form onSubmit={submit}>
          <div className="grid gap-6">
            <div className="grid gap-6">
              <div className="grid gap-2">
                <Label htmlFor="usernameOrEmail">
                  {loading ? (
                    <Skeleton className="w-52 h-7" />
                  ) : (
                    t("auth.login.usernameOrEmail")
                  )}
                </Label>
                <Input
                  isFocused={true}
                  id="usernameOrEmail"
                  type="text"
                  name="usernameOrEmail"
                  autoComplete="usernameOrEmail"
                  value={data.email}
                  onChange={(e) => setData("usernameOrEmail", e.target.value)}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="password">
                  {loading ? (
                    <Skeleton className="w-52 h-7" />
                  ) : (
                    t("auth.login.password")
                  )}
                </Label>
                <Input
                  id="password"
                  type="password"
                  name="password"
                  autoComplete="password"
                  value={data.password}
                  onChange={(e) => setData("password", e.target.value)}
                  required
                />
                <div className="flex items-center">
                  <div className="flex items-center space-x-2">
                    <Checkbox id="remember" />
                    <label
                      htmlFor="remember"
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      {loading ? (
                        <Skeleton className="w-32 h-7" />
                      ) : (
                        t("auth.login.remember")
                      )}
                    </label>
                  </div>
                  <Link
                    href={route("password.request")}
                    className="ml-auto text-sm underline-offset-4 hover:underline"
                  >
                    {loading ? (
                      <Skeleton className="w-40 h-7" />
                    ) : (
                      t("auth.login.forgotPassword")
                    )}
                  </Link>
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={processing}>
                {loading ? (
                  <Skeleton className="w-32 h-7" />
                ) : (
                  t("auth.login.button")
                )}
              </Button>
            </div>
            <div className="relative flex justify-center text-sm after:absolute after:inset-0 after:top-1/2 after:z-0 after:flex after:items-center after:border-t after:border-border">
              <span className="relative z-10 px-2 bg-background text-muted-foreground">
                {loading ? (
                  <Skeleton className="w-32 h-7" />
                ) : (
                  t("auth.login.or")
                )}
              </span>
            </div>
            <div className="flex flex-col gap-4">
              <Button variant="outline" className="w-full">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                  <path
                    d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"
                    fill="currentColor"
                  />
                </svg>
                {loading ? (
                  <Skeleton className="w-32 h-7" />
                ) : (
                  t("auth.login.google")
                )}
              </Button>
            </div>
            {loading ? (
              <Skeleton className="mx-auto w-44 h-7" />
            ) : (
              <div className="text-sm text-center">
                {t("auth.login.register")}{" "}
                <Link
                  href={route("register")}
                  className="underline underline-offset-4"
                >
                  {t("auth.login.registerLink")}
                </Link>
              </div>
            )}
          </div>
        </form>
      </CardContent>
    </GuestLayout>
  );
}
