import { jsxs, jsx } from "react/jsx-runtime";
import { useForm, Head } from "@inertiajs/react";
import { B as Button } from "./button-Us2TB7GG.js";
import { G as GuestLayout, C as CardContent } from "./GuestLayout-BDOgVAas.js";
import { L as Link } from "./Link-p0Z4AKax.js";
import "react";
import "lucide-react";
import "radix-ui";
import "./utils-ClCZGsDL.js";
import "date-fns/locale";
import "lodash";
import "buffer";
import "clsx";
import "tailwind-merge";
import "class-variance-authority";
import "./MasterLayout-CRsmljQs.js";
import "@radix-ui/react-alert-dialog";
import "./use-mobile-BsFue-bT.js";
import "sonner";
import "zustand";
import "./tooltip-Df8khweJ.js";
import "@radix-ui/react-tooltip";
import "laravel-react-i18n";
import "@inertiajs/core";
function VerifyEmail({ status }) {
  const route = window.route;
  const { post, processing } = useForm({});
  const submit = (e) => {
    e.preventDefault();
    post(route("verification.send"));
  };
  return /* @__PURE__ */ jsxs(GuestLayout, { children: [
    /* @__PURE__ */ jsx(Head, { title: "Email Verification" }),
    /* @__PURE__ */ jsxs(CardContent, { children: [
      /* @__PURE__ */ jsxs("div", { className: "mb-4 text-sm text-gray-600 dark:text-gray-400", children: [
        "Thanks for signing up! Before getting started, could you verify your email address by clicking on the link we just emailed to you? If you",
        "didn't",
        " receive the email, we will gladly send you another."
      ] }),
      status === "verification-link-sent" && /* @__PURE__ */ jsx("div", { className: "mb-4 text-sm font-medium text-green-600 dark:text-green-400", children: "A new verification link has been sent to the email address you provided during registration." }),
      /* @__PURE__ */ jsx("form", { onSubmit: submit, children: /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-between mt-4", children: [
        /* @__PURE__ */ jsx(Button, { disabled: processing, children: "Resend Verification Email" }),
        /* @__PURE__ */ jsx(
          Link,
          {
            href: route("logout"),
            method: "post",
            as: "button",
            className: "text-sm text-gray-600 underline rounded-md hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:text-gray-400 dark:hover:text-gray-100 dark:focus:ring-offset-gray-800",
            children: "Log Out"
          }
        )
      ] }) })
    ] })
  ] });
}
export {
  VerifyEmail as default
};
