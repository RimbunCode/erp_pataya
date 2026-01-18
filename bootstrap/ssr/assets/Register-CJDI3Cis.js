import { jsxs, jsx } from "react/jsx-runtime";
import { G as GuestLayout, a as CardHeader, b as CardTitle, c as CardDescription, C as CardContent } from "./GuestLayout-BDOgVAas.js";
import { useForm, Head } from "@inertiajs/react";
import { B as Button } from "./button-Us2TB7GG.js";
import { I as Input } from "./input-wk3Ou7wI.js";
import { I as InputError } from "./InputError-2JjWc6nJ.js";
import { L as Label } from "./label-DiFvdPYz.js";
import { L as Link } from "./Link-p0Z4AKax.js";
import { S as Skeleton } from "./skeleton-IN0PLOYc.js";
import { T as ToggleTheme } from "./ToggleTheme-BSs-sHS2.js";
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
import "sonner";
import "zustand";
import "./tooltip-Df8khweJ.js";
import "@radix-ui/react-tooltip";
import "radix-ui";
import "class-variance-authority";
import "@radix-ui/react-label";
import "@inertiajs/core";
import "@radix-ui/react-dropdown-menu";
function Register() {
  const { t, loading } = useLaravelReactI18n();
  const route = window.route;
  const { data, setData, post, processing, errors, reset } = useForm({
    name: "",
    username: "",
    email: "",
    password: "",
    password_confirmation: ""
  });
  const submit = (e) => {
    e.preventDefault();
    post(route("register"), {
      onFinish: () => reset("password", "password_confirmation")
    });
  };
  return /* @__PURE__ */ jsxs(GuestLayout, { children: [
    /* @__PURE__ */ jsx(Head, { title: "Register" }),
    /* @__PURE__ */ jsx(CardHeader, { children: /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between gap-x-4", children: [
      /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-y-2", children: [
        /* @__PURE__ */ jsx(CardTitle, { className: "text-xl", children: loading ? /* @__PURE__ */ jsx(Skeleton, { className: "w-52 h-7" }) : t("auth.register.title") }),
        /* @__PURE__ */ jsx(CardDescription, { children: loading ? /* @__PURE__ */ jsx(Skeleton, { className: "w-full h-7" }) : t("auth.register.description") })
      ] }),
      /* @__PURE__ */ jsx(ToggleTheme, { className: "size-4" })
    ] }) }),
    /* @__PURE__ */ jsx(CardContent, { className: "pt-0!", children: /* @__PURE__ */ jsx("form", { onSubmit: submit, children: /* @__PURE__ */ jsxs("div", { className: "grid gap-6", children: [
      /* @__PURE__ */ jsxs("div", { className: "grid gap-6", children: [
        /* @__PURE__ */ jsxs("div", { className: "grid gap-2", children: [
          /* @__PURE__ */ jsx(Label, { htmlFor: "username", children: loading ? /* @__PURE__ */ jsx(Skeleton, { className: "w-52 h-7" }) : t("auth.register.name") }),
          /* @__PURE__ */ jsx(
            Input,
            {
              isFocused: true,
              id: "name",
              type: "text",
              name: "name",
              autoComplete: "name",
              value: data.name,
              onChange: (e) => setData("name", e.target.value),
              required: true
            }
          ),
          /* @__PURE__ */ jsx(InputError, { message: errors.name, className: "mt-2" })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "grid gap-2", children: [
          /* @__PURE__ */ jsx(Label, { htmlFor: "username", children: loading ? /* @__PURE__ */ jsx(Skeleton, { className: "w-52 h-7" }) : t("auth.register.username") }),
          /* @__PURE__ */ jsx(
            Input,
            {
              id: "username",
              type: "text",
              name: "username",
              autoComplete: "username",
              value: data.username,
              onChange: (e) => setData("username", e.target.value),
              required: true
            }
          ),
          /* @__PURE__ */ jsx(InputError, { message: errors.username, className: "mt-2" })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "grid gap-2", children: [
          /* @__PURE__ */ jsx(Label, { htmlFor: "email", children: loading ? /* @__PURE__ */ jsx(Skeleton, { className: "w-52 h-7" }) : t("auth.register.email") }),
          /* @__PURE__ */ jsx(
            Input,
            {
              id: "email",
              type: "email",
              name: "email",
              autoComplete: "email",
              value: data.email,
              onChange: (e) => setData("email", e.target.value),
              required: true
            }
          ),
          /* @__PURE__ */ jsx(InputError, { message: errors.email, className: "mt-2" })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "grid gap-2", children: [
          /* @__PURE__ */ jsx(Label, { htmlFor: "password", children: loading ? /* @__PURE__ */ jsx(Skeleton, { className: "w-52 h-7" }) : t("auth.register.password") }),
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
          /* @__PURE__ */ jsx(InputError, { message: errors.password, className: "" })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "grid gap-2", children: [
          /* @__PURE__ */ jsx(Label, { htmlFor: "password_confirmation", children: loading ? /* @__PURE__ */ jsx(Skeleton, { className: "w-52 h-7" }) : t("auth.register.confirm_password") }),
          /* @__PURE__ */ jsx(
            Input,
            {
              id: "password_confirmation",
              type: "password",
              name: "password_confirmation",
              autoComplete: "password_confirmation",
              value: data.password_confirmation,
              onChange: (e) => setData("password_confirmation", e.target.value),
              required: true
            }
          ),
          /* @__PURE__ */ jsx(
            InputError,
            {
              message: errors.password_confirmation,
              className: "mt-2"
            }
          )
        ] }),
        /* @__PURE__ */ jsx(Button, { type: "submit", className: "w-full", disabled: processing, children: loading ? /* @__PURE__ */ jsx(Skeleton, { className: "w-52 h-7" }) : t("auth.register.button") })
      ] }),
      /* @__PURE__ */ jsx("div", { className: "relative flex justify-center text-sm after:absolute after:inset-0 after:top-1/2 after:z-0 after:flex after:items-center after:border-t after:border-border", children: /* @__PURE__ */ jsx("span", { className: "relative z-10 px-2 bg-background text-muted-foreground", children: loading ? /* @__PURE__ */ jsx(Skeleton, { className: "w-32 h-7" }) : t("auth.register.or") }) }),
      /* @__PURE__ */ jsx("div", { className: "flex flex-col gap-4", children: /* @__PURE__ */ jsxs(Button, { variant: "outline", className: "w-full", children: [
        /* @__PURE__ */ jsx("svg", { xmlns: "http://www.w3.org/2000/svg", viewBox: "0 0 24 24", children: /* @__PURE__ */ jsx(
          "path",
          {
            d: "M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z",
            fill: "currentColor"
          }
        ) }),
        loading ? /* @__PURE__ */ jsx(Skeleton, { className: "w-32 h-7" }) : t("auth.register.google")
      ] }) }),
      loading ? /* @__PURE__ */ jsx(Skeleton, { className: "mx-auto w-44 h-7" }) : /* @__PURE__ */ jsxs("div", { className: "text-sm text-center", children: [
        t("auth.register.login"),
        " ",
        /* @__PURE__ */ jsx(
          Link,
          {
            href: route("login"),
            className: "underline underline-offset-4",
            children: t("auth.register.loginLink")
          }
        )
      ] })
    ] }) }) })
  ] });
}
export {
  Register as default
};
