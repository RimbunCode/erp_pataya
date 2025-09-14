import {
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/Components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/Components/ui/tabs";

import GuestLayout from "@/Layouts/GuestLayout";
import { Head } from "@inertiajs/react";
import Link from "@/Components/Link";
import React from "react";
import { Skeleton } from "@/Components/ui/skeleton";
import ToggleTheme from "@/Components/ToggleTheme";
import { cn } from "@/lib/utils";
import { useLaravelReactI18n } from "laravel-react-i18n";

function Index({ lang, locales }) {
  const route = window.route;
  const { t, loading } = useLaravelReactI18n();
  return (
    <GuestLayout className="w-fit! min-w-80">
      <Head title="Select Language" />
      <CardHeader>
        <div className="flex items-center justify-between gap-x-4">
          <div className="flex flex-col gap-y-2">
            <CardTitle className="text-xl">
              {loading ? <Skeleton className="w-52 h-7" /> : t("lang.title")}
            </CardTitle>
            <CardDescription>
              {loading ? (
                <Skeleton className="w-full h-7" />
              ) : (
                t("lang.description")
              )}
            </CardDescription>
          </div>
          <ToggleTheme className="size-4" />
        </div>
      </CardHeader>
      <CardContent className="pt-0!">
        <Tabs
          defaultValue={lang}
          orientation="vertical"
          className="flex flex-col "
        >
          <TabsList className="flex flex-col h-auto bg-background! gap-y-2 p-0! ">
            {locales &&
              locales.map(({ code, name, countryCode }) => (
                <TabsTrigger
                  key={code}
                  value={code}
                  className="justify-start w-full py-2 text-lg text-left border"
                  asChild
                >
                  <Link
                    href={route("lang.set")}
                    method="post"
                    as="button"
                    data={{ code }}
                  >
                    <span className={cn("mr-2 fi", `fi-${countryCode}`)} />
                    {name}
                  </Link>
                </TabsTrigger>
              ))}
          </TabsList>
        </Tabs>
      </CardContent>
    </GuestLayout>
  );
}

export default Index;
