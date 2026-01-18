import { jsxs, jsx, Fragment } from "react/jsx-runtime";
import { G as GuestLayout, a as CardHeader, b as CardTitle, c as CardDescription, C as CardContent } from "./GuestLayout-BDOgVAas.js";
import { useForm, Head } from "@inertiajs/react";
import { B as Button } from "./button-Us2TB7GG.js";
import { F as FormCheckbox } from "./checkbox-C_BEU5E4.js";
import { I as Input } from "./input-wk3Ou7wI.js";
import { L as Label } from "./label-DiFvdPYz.js";
import { L as Link } from "./Link-p0Z4AKax.js";
import { S as Skeleton } from "./skeleton-IN0PLOYc.js";
import { T as ToggleTheme } from "./ToggleTheme-BSs-sHS2.js";
import { toast } from "sonner";
import { useLaravelReactI18n } from "laravel-react-i18n";
import "react";
import "./utils-ClCZGsDL.js";
import "date-fns/locale";
import "lodash";
import "buffer";
import "clsx";
import "tailwind-merge";
import "./MasterLayout-CRsmljQs.js";
import "@radix-ui/react-alert-dialog";
import "./use-mobile-BsFue-bT.js";
import "lucide-react";
import "zustand";
import "./tooltip-Df8khweJ.js";
import "@radix-ui/react-tooltip";
import "radix-ui";
import "class-variance-authority";
import "@radix-ui/react-checkbox";
import "./avatar-_KK8H2Pc.js";
import "@radix-ui/react-avatar";
import "./AppLayout-Drqdr6Z-.js";
import "./command-BSnyCa9u.js";
import "@radix-ui/react-dialog";
import "cmdk";
import "@radix-ui/react-separator";
import "@radix-ui/react-slot";
import "./popover-CziqY8mR.js";
import "@radix-ui/react-popover";
import "./LoadingIcon-CRleOEtX.js";
import "axios";
import "pluralize";
import "react-detect-click-outside";
import "./tabs-DhZjhdeH.js";
import "@radix-ui/react-tabs";
import "./InputError-2JjWc6nJ.js";
import "./Select-DB9toH_t.js";
import "@radix-ui/react-accordion";
import "qs";
import "@radix-ui/react-progress";
import "@headlessui/react";
import "./Comments-Bvo3255G.js";
import "quill-mention/autoregister";
import "quill";
import "@date-fns/tz";
import "date-fns";
import "@remixicon/react";
import "./Tags-D6pM3ZUY.js";
import "@marcbachmann/cel-js";
import "@radix-ui/react-label";
import "@inertiajs/core";
import "@radix-ui/react-dropdown-menu";
function Login() {
  const { t, loading } = useLaravelReactI18n();
  const route = window.route;
  const { data, setData, post, processing, reset } = useForm({
    usernameOrEmail: "",
    password: "",
    remember: false
  });
  const submit = (e) => {
    e.preventDefault();
    post(route("login"), {
      onFinish: () => reset("password")
    });
  };
  return /* @__PURE__ */ jsxs(GuestLayout, { children: [
    /* @__PURE__ */ jsx(Head, { title: "Login" }),
    /* @__PURE__ */ jsx(CardHeader, { children: /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between gap-x-4", children: [
      /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-y-2", children: [
        /* @__PURE__ */ jsx(CardTitle, { className: "text-xl", children: loading ? /* @__PURE__ */ jsx(Skeleton, { className: "w-52 h-7" }) : t("auth.login.title") }),
        /* @__PURE__ */ jsx(CardDescription, { children: loading ? /* @__PURE__ */ jsx(Skeleton, { className: "w-full h-7" }) : t("auth.login.description") })
      ] }),
      /* @__PURE__ */ jsx(ToggleTheme, { className: "size-4" })
    ] }) }),
    /* @__PURE__ */ jsx(CardContent, { className: "pt-2!", children: /* @__PURE__ */ jsx("form", { onSubmit: submit, children: /* @__PURE__ */ jsxs("div", { className: "grid gap-6", children: [
      /* @__PURE__ */ jsxs("div", { className: "grid gap-6", children: [
        /* @__PURE__ */ jsxs("div", { className: "grid gap-2", children: [
          /* @__PURE__ */ jsx(Label, { htmlFor: "usernameOrEmail", children: loading ? /* @__PURE__ */ jsx(Skeleton, { className: "w-52 h-7" }) : t("auth.login.usernameOrEmail") }),
          /* @__PURE__ */ jsx(
            Input,
            {
              isFocused: true,
              id: "usernameOrEmail",
              type: "text",
              name: "usernameOrEmail",
              autoComplete: "usernameOrEmail",
              value: data.email,
              onChange: (e) => setData("usernameOrEmail", e.target.value),
              required: true
            }
          )
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "grid gap-2", children: [
          /* @__PURE__ */ jsx(Label, { htmlFor: "password", children: loading ? /* @__PURE__ */ jsx(Skeleton, { className: "w-52 h-7" }) : t("auth.login.password") }),
          /* @__PURE__ */ jsx(
            Input,
            {
              id: "password",
              type: "password",
              name: "password",
              autoComplete: "password",
              value: data.password,
              onChange: (e) => setData("password", e.target.value),
              required: true
            }
          ),
          /* @__PURE__ */ jsxs("div", { className: "flex items-center", children: [
            /* @__PURE__ */ jsx(
              FormCheckbox,
              {
                checked: data.remember,
                onCheckedChange: (v) => setData("remember", v),
                label: /* @__PURE__ */ jsx(Fragment, { children: loading ? /* @__PURE__ */ jsx(Skeleton, { className: "w-32 h-7" }) : t("auth.login.remember") })
              }
            ),
            /* @__PURE__ */ jsx(
              Link,
              {
                href: route("password.request"),
                className: "ml-auto text-sm underline-offset-4 hover:underline",
                children: loading ? /* @__PURE__ */ jsx(Skeleton, { className: "w-40 h-7" }) : t("auth.login.forgotPassword")
              }
            )
          ] })
        ] }),
        /* @__PURE__ */ jsx(Button, { type: "submit", className: "w-full", disabled: processing, children: loading ? /* @__PURE__ */ jsx(Skeleton, { className: "w-32 h-7" }) : t("auth.login.button") })
      ] }),
      /* @__PURE__ */ jsx("div", { className: "relative flex justify-center text-sm after:absolute after:inset-0 after:top-1/2 after:z-0 after:flex after:items-center after:border-t after:border-border", children: /* @__PURE__ */ jsx("span", { className: "relative z-10 px-2 bg-background text-muted-foreground", children: loading ? /* @__PURE__ */ jsx(Skeleton, { className: "w-32 h-7" }) : t("auth.login.or") }) }),
      /* @__PURE__ */ jsx("div", { className: "flex flex-col gap-4", children: /* @__PURE__ */ jsxs(
        Button,
        {
          variant: "outline",
          className: "w-full",
          onClick: () => {
            toast.success("A Sonner toast", {
              description: "With a description and an icon",
              duration: Infinity
            });
          },
          children: [
            /* @__PURE__ */ jsx("svg", { xmlns: "http://www.w3.org/2000/svg", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx(
              "path",
              {
                d: "M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z",
                fill: "currentColor"
              }
            ) }),
            loading ? /* @__PURE__ */ jsx(Skeleton, { className: "w-32 h-7" }) : t("auth.login.google")
          ]
        }
      ) }),
      loading ? /* @__PURE__ */ jsx(Skeleton, { className: "mx-auto w-44 h-7" }) : /* @__PURE__ */ jsxs("div", { className: "text-sm text-center", children: [
        t("auth.login.register"),
        " ",
        /* @__PURE__ */ jsx(
          Link,
          {
            href: route("register"),
            className: "underline underline-offset-4",
            children: t("auth.login.registerLink")
          }
        )
      ] })
    ] }) }) })
  ] });
}
export {
  Login as default
};
