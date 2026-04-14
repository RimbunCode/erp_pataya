import {
  Alert,
  AlertContent,
  AlertDescription,
  AlertIcon,
  AlertTitle,
} from "@/Components/ui/alert";
import {
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/Components/ui/card";
import { Head, Link, useForm } from "@inertiajs/react";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/Components/ui/input-group";
import { LogOutIcon, MailCheckIcon, ShieldCheckIcon } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/Components/ui/tooltip";

import { Button } from "@/Components/ui/button";
import DatetimePicker from "@/Components/DatetimePicker";
import GuestLayout from "@/Layouts/GuestLayout";
import { Input } from "@/Components/ui/input";
import InputError from "@/Components/InputError";
import { Label } from "@/Components/ui/label";
import PasswordChecker from "@/Components/PasswordChecker";
import PasswordInput from "@/Components/PasswordInput";
import { RiErrorWarningFill } from "@remixicon/react";
import Select from "@/Components/Select";
import { Skeleton } from "@/Components/ui/skeleton";
import ToggleTheme from "@/Components/ToggleTheme";
import { useLaravelReactI18n } from "laravel-react-i18n";
import { useState } from "react";

function SetupUser({ user, hasPassword, isWaiting }) {
  const route = window.route;
  const { t, loading } = useLaravelReactI18n();
  const [isVisible, setIsVisible] = useState(false);
  const { data, setData, put, processing, errors } = useForm({
    name: user?.name ?? "",
    username: user?.username ?? "",
    gender: user?.gender ?? "",
    birthdate: user?.birthdate ?? "",
    phone: user?.phone ?? "",
    email: user?.email ?? "",
    current_password: "",
    password: "",
    password_confirmation: "",
  });

  const onSubmit = (e) => {
    e.preventDefault();
    put(route("setup.update"));
  };

  return (
    <GuestLayout className="max-w-xl">
      <Head title={t("auth.setupUser.title")} />
      <CardHeader>
        <div className="flex items-center justify-between gap-x-4">
          <div className="flex flex-col gap-y-2">
            <CardTitle className="text-xl">
              {loading ? (
                <Skeleton className="w-52 h-7" />
              ) : (
                t("auth.setupUser.title")
              )}
            </CardTitle>
            <CardDescription>
              {loading ? (
                <Skeleton className="w-full h-7" />
              ) : (
                t("auth.setupUser.description")
              )}
            </CardDescription>
          </div>
          <div className="flex gap-x-2 self-start">
            <ToggleTheme className="size-4" />
            <Button
              type="button"
              variant="destructive"
              size="icon"
              className="[&_svg]:size-4 p-2.5 h-fit w-fit"
              asChild
            >
              <Link href={route("logout")} method="post" as="button">
                <LogOutIcon />
              </Link>
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Alert variant="warning" appearance="light" className="mb-4">
          <AlertIcon>
            <RiErrorWarningFill />
          </AlertIcon>
          <AlertContent>
            <AlertTitle>{t("auth.setupUser.waiting.title")}</AlertTitle>
            <AlertDescription>
              {t("auth.setupUser.waiting.description")}
            </AlertDescription>
          </AlertContent>
        </Alert>
        <form onSubmit={onSubmit}>
          <div className="grid gap-y-4">
            <div className="border-b-0">
              <div className="w-full pb-1 mb-2 border-b border-muted-foreground/25 [&[data-state=open]_svg]:rotate-180">
                <div className="font-bold text-lg flex items-center justify-between gap-x-4">
                  {t("auth.setupUser.profile")}
                </div>
              </div>
              <div className="pt-2 columns-1 md:columns-2 space-x-3 space-y-4 [&>div]:break-inside-avoid">
                <div className="grid gap-2">
                  <Label htmlFor="name">
                    {loading ? (
                      <Skeleton className="w-52 h-7" />
                    ) : (
                      <>
                        {t("user.user.columns.name")}{" "}
                        {<span className="text-red-500">*</span>}
                      </>
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
                  <Label htmlFor="gender">
                    {loading ? (
                      <Skeleton className="w-52 h-7" />
                    ) : (
                      t("user.user.columns.gender")
                    )}
                  </Label>
                  <Select
                    id="gender"
                    name="gender"
                    autoComplete="gender"
                    value={data.gender}
                    onValueChange={(val) => setData("gender", val)}
                    optionTrans="user.user.columns.gender.options"
                    options={["male", "female"]}
                  />
                  <InputError message={errors.gender} className="mt-2" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="birthdate">
                    {loading ? (
                      <Skeleton className="w-52 h-7" />
                    ) : (
                      t("user.user.columns.birthdate")
                    )}
                  </Label>
                  <DatetimePicker
                    name="birthdate"
                    id="birthdate"
                    autoComplete="birthdate"
                    type="date"
                    value={data.birthdate}
                    onValueChange={(val) => setData("birthdate", val)}
                  />
                  <InputError message={errors.birthdate} className="mt-2" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="phone">
                    {loading ? (
                      <Skeleton className="w-52 h-7" />
                    ) : (
                      t("user.user.columns.phone")
                    )}
                  </Label>
                  <Input
                    isFocused={true}
                    id="phone"
                    type="text"
                    name="phone"
                    autoComplete="phone"
                    value={data.phone}
                    onChange={(e) => setData("phone", e.target.value)}
                  />
                  <InputError message={errors.phone} className="mt-2" />
                </div>
              </div>
            </div>
            <div className="border-b-0">
              <div className="w-full pb-1 mb-2 border-b border-muted-foreground/25 [&[data-state=open]_svg]:rotate-180">
                <div className="font-bold text-lg flex items-center justify-between gap-x-4">
                  {t("auth.setupUser.credential")}
                </div>
              </div>
              <div className="pt-2 space-y-4 [&>div]:break-inside-avoid">
                <div className="grid gap-2">
                  <Label htmlFor="username">
                    {loading ? (
                      <Skeleton className="w-52 h-7" />
                    ) : (
                      <>
                        {t("user.user.columns.username")}{" "}
                        {<span className="text-red-500">*</span>}
                      </>
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
                      <>
                        {t("user.user.columns.email")}{" "}
                        {<span className="text-red-500">*</span>}
                      </>
                    )}
                  </Label>

                  <InputGroup>
                    <InputGroupInput
                      id="email"
                      type="email"
                      name="email"
                      autoComplete="email"
                      required
                      value={data.email}
                      onChange={(e) => setData("email", e.target.value)}
                    />
                    {user.email_verified_at ? (
                      <InputGroupAddon align="inline-start">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <ShieldCheckIcon className="text-green-500 size-5" />
                          </TooltipTrigger>
                          <TooltipContent align="center" side="bottom">
                            {t("user.user.columns.email.verified")}
                          </TooltipContent>
                        </Tooltip>
                      </InputGroupAddon>
                    ) : (
                      <InputGroupAddon align="inline-end">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button type="button" variant="ghost" size="icon">
                              <MailCheckIcon />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent align="center" side="bottom">
                            {t("user.user.columns.email.verify")}
                          </TooltipContent>
                        </Tooltip>
                      </InputGroupAddon>
                    )}
                  </InputGroup>
                  <InputError message={errors.email} className="mt-2" />
                </div>
                {hasPassword && (
                  <div className="grid gap-2">
                    <Label htmlFor="current_password">
                      {loading ? (
                        <Skeleton className="w-52 h-7" />
                      ) : (
                        t("user.user.manage_password.columns.current_password")
                      )}
                    </Label>
                    <PasswordInput
                      id="current_password"
                      name="current_password"
                      autoComplete="off"
                      value={data.current_password}
                      onChange={(e) =>
                        setData("current_password", e.target.value)
                      }
                    />
                    <p className="text-sm mt-0.5 font-normal text-muted-foreground">
                      {t(
                        "user.user.manage_password.columns.current_password.description",
                      )}
                    </p>
                    <InputError
                      message={errors.current_password}
                      className=""
                    />
                  </div>
                )}
                {(data.current_password || !hasPassword) && (
                  <>
                    <div className="grid gap-2">
                      <Label htmlFor="password">
                        {loading ? (
                          <Skeleton className="w-52 h-7" />
                        ) : (
                          <>
                            {t(
                              data.current_password
                                ? "user.user.manage_password.columns.password"
                                : "user.user.columns.password",
                            )}{" "}
                            {<span className="text-red-500">*</span>}
                          </>
                        )}
                      </Label>
                      <PasswordInput
                        id="password"
                        name="password"
                        autoComplete="password"
                        value={data.password}
                        onChange={(e) => setData("password", e.target.value)}
                        required
                        visible={isVisible}
                        onVisibleChange={setIsVisible}
                      />
                      <InputError message={errors.password} className="" />
                      <PasswordChecker password={data.password} />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="password_confirmation">
                        {loading ? (
                          <Skeleton className="w-52 h-7" />
                        ) : (
                          <>
                            {t(
                              data.current_password
                                ? "user.user.manage_password.columns.password_confirmation"
                                : "user.user.columns.confirm_password",
                            )}{" "}
                            {<span className="text-red-500">*</span>}
                          </>
                        )}
                      </Label>
                      <PasswordInput
                        id="password_confirmation"
                        name="password_confirmation"
                        autoComplete="password_confirmation"
                        value={data.password_confirmation}
                        onChange={(e) =>
                          setData("password_confirmation", e.target.value)
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
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={processing}>
              {loading ? (
                <Skeleton className="w-52 h-7" />
              ) : (
                t("auth.setupUser.button.save")
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </GuestLayout>
  );
}

export default SetupUser;
