import {
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/Components/ui/card";
import { Head, useForm, useFormContext } from "@inertiajs/react";

import GuestLayout from "@/Layouts/GuestLayout";
import { Input } from "@/Components/ui/input";
import { Skeleton } from "@/Components/ui/skeleton";
import ToggleTheme from "@/Components/ToggleTheme";
import { useLaravelReactI18n } from "laravel-react-i18n";

function SetupUser({ user }) {
  const route = window.route;
  const { t, loading } = useLaravelReactI18n();
  const { data, setData, put, processing, reset } = useForm(user);

  const onSubmit = (e) => {
    e.preventDefault();
    put(route("setup.update"), {
      onFinish: () => reset(),
    });
  };

  return (
    <GuestLayout>
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
          <ToggleTheme className="size-4" />
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit}>
          <div className="grid gap-y-4">
            <div className="grid gap-y-2">
              <Input
                id="name"
                type="text"
                placeholder={t("auth.register.name")}
                value={data.name}
                onChange={(e) => setData("name", e.target.value)}
              />
            </div>
          </div>
        </form>
      </CardContent>
    </GuestLayout>
  );
}

export default SetupUser;
