import { jsxs, jsx } from "react/jsx-runtime";
import { G as GuestLayout, a as CardHeader, b as CardTitle, c as CardDescription, C as CardContent } from "./GuestLayout-BDOgVAas.js";
import { T as Tabs, a as TabsList, b as TabsTrigger } from "./tabs-DhZjhdeH.js";
import { Head } from "@inertiajs/react";
import { L as Link } from "./Link-p0Z4AKax.js";
import "react";
import { S as Skeleton } from "./skeleton-IN0PLOYc.js";
import { T as ToggleTheme } from "./ToggleTheme-BSs-sHS2.js";
import { c as cn } from "./utils-ClCZGsDL.js";
import { useLaravelReactI18n } from "laravel-react-i18n";
import "./MasterLayout-CRsmljQs.js";
import "@radix-ui/react-alert-dialog";
import "./button-Us2TB7GG.js";
import "lucide-react";
import "radix-ui";
import "class-variance-authority";
import "./use-mobile-BsFue-bT.js";
import "sonner";
import "zustand";
import "./tooltip-Df8khweJ.js";
import "@radix-ui/react-tooltip";
import "@radix-ui/react-tabs";
import "@inertiajs/core";
import "@radix-ui/react-dropdown-menu";
import "date-fns/locale";
import "lodash";
import "buffer";
import "clsx";
import "tailwind-merge";
function Index({ lang, locales }) {
  const route = window.route;
  const { t, loading } = useLaravelReactI18n();
  return /* @__PURE__ */ jsxs(GuestLayout, { className: "w-fit! min-w-80", children: [
    /* @__PURE__ */ jsx(Head, { title: "Select Language" }),
    /* @__PURE__ */ jsx(CardHeader, { children: /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between gap-x-4", children: [
      /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-y-2", children: [
        /* @__PURE__ */ jsx(CardTitle, { className: "text-xl", children: loading ? /* @__PURE__ */ jsx(Skeleton, { className: "w-52 h-7" }) : t("lang.title") }),
        /* @__PURE__ */ jsx(CardDescription, { children: loading ? /* @__PURE__ */ jsx(Skeleton, { className: "w-full h-7" }) : t("lang.description") })
      ] }),
      /* @__PURE__ */ jsx(ToggleTheme, { className: "size-4" })
    ] }) }),
    /* @__PURE__ */ jsx(CardContent, { className: "pt-0!", children: /* @__PURE__ */ jsx(
      Tabs,
      {
        defaultValue: lang,
        orientation: "vertical",
        className: "flex flex-col ",
        children: /* @__PURE__ */ jsx(TabsList, { className: "flex flex-col h-auto bg-background! gap-y-2 p-0! ", children: locales && locales.map(({ code, name, countryCode }) => /* @__PURE__ */ jsx(
          TabsTrigger,
          {
            value: code,
            className: "justify-start w-full py-2 text-lg text-left border",
            asChild: true,
            children: /* @__PURE__ */ jsxs(
              Link,
              {
                href: route("lang.set"),
                method: "post",
                as: "button",
                data: { code },
                children: [
                  /* @__PURE__ */ jsx("span", { className: cn("mr-2 fi", `fi-${countryCode}`) }),
                  name
                ]
              }
            )
          },
          code
        )) })
      }
    ) })
  ] });
}
export {
  Index as default
};
