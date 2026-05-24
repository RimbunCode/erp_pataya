import {
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/Components/ui/card";
import { Head, useForm } from "@inertiajs/react";

import { Button } from "@/Components/ui/button";
import AuthLayout from "@/Layouts/AuthLayout";
import { Input } from "@/Components/ui/input";
import InputError from "@/Components/InputError";
import { Label } from "@/Components/ui/label";
import Link from "@/Components/Link";
import PasswordChecker from "@/Components/PasswordChecker";
import PasswordInput from "@/Components/PasswordInput";
import ToggleTheme from "@/Components/ToggleTheme";
import { useState } from "react";

export default function Register() {
  const route = window.route;
  const { data, setData, post, processing, errors, reset } = useForm({
    name: "",
    username: "",
    email: "",
    password: "",
    password_confirmation: "",
  });

  const submit = (event) => {
    event.preventDefault();

    post(route("register"), {
      onFinish: () => reset("password", "password_confirmation"),
    });
  };

  const [isVisible, setIsVisible] = useState(false);

  return (
    <AuthLayout>
      <Head title="Register" />
      <CardHeader>
        <div className="flex items-center justify-between gap-x-4">
          <div className="flex flex-col gap-y-2">
            <CardTitle className="text-xl">Create your account</CardTitle>
            <CardDescription>
              Register with your credentials or Google account
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
                <Label htmlFor="name">Full Name</Label>
                <Input
                  isFocused={true}
                  id="name"
                  type="text"
                  name="name"
                  autoComplete="name"
                  value={data.name}
                  onChange={(event) => setData("name", event.target.value)}
                  required
                />
                <InputError message={errors.name} className="mt-2" />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  type="text"
                  name="username"
                  autoComplete="username"
                  value={data.username}
                  onChange={(event) => setData("username", event.target.value)}
                  required
                />
                <InputError message={errors.username} className="mt-2" />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  name="email"
                  autoComplete="email"
                  value={data.email}
                  onChange={(event) => setData("email", event.target.value)}
                  required
                />
                <InputError message={errors.email} className="mt-2" />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="password">Password</Label>
                <PasswordInput
                  id="password"
                  type={isVisible ? "text" : "password"}
                  name="password"
                  autoComplete="password"
                  value={data.password}
                  onChange={(event) => setData("password", event.target.value)}
                  required
                  visible={isVisible}
                  onVisibleChange={setIsVisible}
                />
                <InputError message={errors.password} className="" />
                <PasswordChecker password={data.password} forceEnglish={true} />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="password_confirmation">Confirm Password</Label>
                <PasswordInput
                  id="password_confirmation"
                  type="password"
                  name="password_confirmation"
                  autoComplete="password_confirmation"
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

              <Button type="submit" className="w-full" disabled={processing}>
                Register
              </Button>
            </div>

            <div className="relative flex justify-center text-sm after:absolute after:inset-0 after:top-1/2 after:z-0 after:flex after:items-center after:border-t after:border-border">
              <span className="relative z-10 px-2 bg-background text-muted-foreground">
                Or continue with
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
                  Register with Google
                </a>
              </Button>
            </div>

            <div className="text-sm text-center">
              Already have an account?{" "}
              <Link
                href={route("login")}
                className="underline underline-offset-4"
              >
                Login Now
              </Link>
            </div>
          </div>
        </form>
      </CardContent>
    </AuthLayout>
  );
}
